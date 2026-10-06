import assert from 'node:assert/strict';
import test from 'node:test';
import { workerFoodGatherMultiplier } from '../src/server/worker-food-tools.mjs';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { createWorkerPerformingActions } from '../src/worker-performing-action.mjs';
import { BUILDING_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { buildingRepairStep } from '../src/base-lifecycle.mjs';
import { FOREST_GATHER_SOURCE_KIND, isAreaGatherResource, activeWorkIntent, createGatherWorkIntent, clearGatherWorkIntent } from '../src/work-intent.mjs';
import { gatherWorkArea } from '../src/gather-work-area.mjs';
import { createMoveGoalPoint } from '../src/unit-movement.mjs';
import { constructionServerBindings, constructionServerFunctions, loadConstructionServerFixture } from './construction-server-fixture.mjs';

const source = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
function fn(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, name);
  const end = source.indexOf('\nfunction ', start + 1);
  return source.slice(start, end);
}
const constructionStart = source.indexOf('function updateBuildingAndProduction(');
const construction = source.slice(constructionStart,
  source.indexOf('\n  for (const building of buildings) {', constructionStart)) + '\n}\n';
function fixture() {
  const unit = { id: 0, team: 0, kind: 'worker', generation: 1, orderRevision: 0,
    hp: 100, x: 0, z: 0, cargo: 0, cargoType: null, gatherPhase: 'to-node',
    gatherNodeId: 'node', gatherForestCell: -1, buildingTargetId: null, repairing: false,
    attackTargetId: -1, attackBuildingTargetId: -1, holdingPosition: false,
    workIntent: null, path: [], pathIndex: 0, movePlanningPending: false, moveGoalCell: -1, queuedWaypoints: [] };
  const node = { id: 'node', type: 'food', x: 0, z: 0, stock: 10 };
  const building = { id: 1, type: 'farm', x: 0, z: 0, hp: 100, complete: false, progress: 0 };
  const journal = createWorkerPerformingActions();
  const context = vm.createContext({ ...constructionServerBindings(), units: [unit], tickNumber: 1, dirty: false, workerEconomyRouteScope: null,
    workerPerformingActions: journal, BUILDING_DEFINITIONS, buildingRepairStep,
    // Receipt-only open ground; endpoint admission still uses production policy.
    MAP_WIDTH: 64, MAP_HEIGHT: 64, MAX_UNITS: 2000,
    isWalkable: cell => Number.isInteger(cell) && cell >= 0 && cell < 64 * 64,
    FOREST_GATHER_SOURCE_KIND, isAreaGatherResource, activeWorkIntent, createGatherWorkIntent, clearGatherWorkIntent, gatherWorkArea,
    // This receipt fixture has no reachable replacement area. Full authority
    // resource-job tests exercise continuation; these check confirmed grants.
    nearestOpenCell: () => 0, walkableComponents: [-1],
    buildingsById: new Map([[1, building]]), resourceNodeStates: new Map([[node.id, node]]), teamWood: [100, 100],
    mapDefinition: { fogOfWar: true }, STATE_EVERY_TICKS: 3,
    WORKER_INTERACTION_RANGE: 1.4, BUILDER_INTERACTION_RANGE: 1.4,
    WORKER_CARRY_CAPACITY: 10, GATHER_RATE: 2, STEP_SECONDS: 1 / 30,
    workerFoodGatherMultiplier, teamUpgrades: [{}, {}],
    forestCellMask: [1], forestWoodRemaining: [10],
    forestStockChangedCells: new Set(), pendingForestClears: new Set(),
    cellToWorld: () => ({ x: 0, z: 0 }), worldToCell: () => 0,
    cellVisibleToTeam: () => true, unitHasCapability: () => true,
    workerAtDropoff: () => false, activateWildlifeHarvest: () => false,
    markWildlifeDepleted() {}, broadcastGameplayNotice() {}, updateWallBuildOrders() {},
    harvestNodeById: id => id === node.id ? node : null,
    distanceToBuildingEdge: () => Math.max(0, Math.abs(unit.x) - 1.5),
    routeWorker(u, phase) { u.orderRevision++; u.gatherPhase = phase; },
    routeForestWorker(u, phase) { u.orderRevision++; u.gatherPhase = phase; },
    buildingRulesFor: type => BUILDING_DEFINITIONS[type],
    workerAudioExecution: () => null, workerGatherHeading: () => null,
    workerFishingPresentation: () => null,
  });
  vm.runInContext(['compatibleWorkerPerformingAction', 'workerPerformingAction',
    'snapshotUnits', 'workerTaskStatus', 'stopGathering', 'ensureGatherWorkIntent',
    'continueAreaGathering', 'updateForestWorkerEconomy',
    'updateWorkerEconomy', 'finishFarmReplantHarvest'].map(fn).join('\n') + '\n' + constructionServerFunctions + construction, context);
  context.flushPendingForestClears = () => {};
  journal.beginStep(context.tickNumber);
  return { unit, node, building, journal, context,
    action: () => context.workerPerformingAction(unit),
    row: team => context.snapshotUnits(team)[0],
    gather: () => context.updateWorkerEconomy(),
    build: () => context.updateBuildingAndProduction(),
    finish() {
      const changed = journal.finishStep(context.tickNumber, context.compatibleWorkerPerformingAction);
      if (changed) context.dirty = true;
      return changed;
    },
    next() { context.tickNumber++; journal.beginStep(context.tickNumber); context.dirty = false; },
  };
}

for (const type of ['food', 'wood', 'stone']) test(`positive ${type} grant owns the receipt independently of previous cargo identity`, () => {
  const f = fixture(); f.node.type = type; f.unit.cargoType = 'wood'; f.gather();
  assert.equal(f.action(), `gather-${type}`); assert.equal(f.unit.cargoType, type);
  assert.equal(f.unit.cargo, 2 / 30); assert.equal(f.node.stock, 10 - 2 / 30);
  assert.equal(f.row(0)[17], `gather-${type}`);
  assert.equal(f.row(1)[17], undefined, 'visible enemy activity remains withheld under fog');
  f.context.cellVisibleToTeam = () => false; assert.equal(f.context.snapshotUnits(1).length, 0);
  f.context.mapDefinition.fogOfWar = false; assert.equal(f.row(null)[17], `gather-${type}`);
});

for (const [name, setup] of [
  ['blocked approach', f => { f.node.x = 20; }],
  ['queued planning', f => { f.node.x = 20; f.unit.movePlanningPending = true; }],
  ['retained phase outside reach', f => { f.node.x = 20; f.unit.gatherPhase = 'gathering'; }],
  ['empty stock', f => { f.node.stock = 0; }],
  ['full capacity', f => { f.unit.cargo = 10; f.unit.cargoType = 'food'; }],
  ['dead Worker', f => { f.unit.hp = 0; }],
  ['incompatible carried resource', f => { f.unit.cargo = 1; f.unit.cargoType = 'stone'; }],
]) test(`${name} has no confirmed work`, () => {
  const f = fixture(); setup(f); const before = f.unit.cargo; f.gather();
  assert.equal(f.unit.cargo, before); assert.equal(f.action(), null); assert.equal(f.row(0)[17], null);
});

test('forest and Farm grants use existing finite stock without adding any authoritative fields', () => {
  const f = fixture(); f.unit.gatherForestCell = 0; f.unit.gatherNodeId = null;
  const fields = Object.keys(f.unit); f.gather();
  assert.equal(f.action(), 'gather-wood'); assert.equal(f.context.forestWoodRemaining[0], 10 - 2 / 30);
  assert.deepEqual(Object.keys(f.unit), fields, 'receipt stays outside checkpoint units');
  f.unit.gatherForestCell = -1; f.unit.gatherNodeId = 'farm:1'; f.node.id = 'farm:1';
  f.node.sourceBuildingId = 1; f.unit.cargo = 0; f.unit.gatherPhase = 'to-node';
  f.next(); f.gather(); assert.equal(f.action(), 'gather-food');
});

test('Stone productive → no-progress → resume → Stop snapshots follow actual grants and dirty clears', () => {
  const f = fixture(); f.node.type = 'stone'; f.gather();
  assert.equal(f.row(0)[17], 'gather-stone'); assert.equal(f.finish(), true);
  f.next(); const cargo = f.unit.cargo; f.node.x = 20; f.gather();
  assert.equal(f.unit.cargo, cargo); assert.equal(f.row(0)[9], 'gathering');
  assert.equal(f.row(0)[17], null); assert.equal(f.finish(), true);
  f.next(); f.node.x = 0; f.gather();
  assert.ok(f.unit.cargo > cargo); assert.equal(f.row(0)[17], 'gather-stone');
  assert.equal(f.finish(), true);
  f.context.stopGathering(f.unit);
  assert.equal(f.row(0)[9], 'idle'); assert.equal(f.row(0)[17], null);
  assert.equal(f.finish(), true);
});

test('depletion and full capacity clear positive grants once the Worker starts returning', () => {
  for (const forest of [false, true]) for (const capacity of [false, true]) {
    const f = fixture(); if (forest) f.unit.gatherForestCell = 0;
    if (capacity) { f.unit.cargo = 9.99; f.unit.cargoType = forest ? 'wood' : 'food'; }
    else { f.node.stock = 0.01; f.context.forestWoodRemaining[0] = 0.01; }
    f.gather(); assert.equal(f.unit.gatherPhase, 'to-base'); assert.equal(f.action(), null);
  }
});

test('order revision, target, generation and death invalidate the same-tick receipt; resuming needs a new grant', () => {
  for (const invalidate of [f => { f.unit.orderRevision++; }, f => { f.unit.generation++; },
    f => { f.unit.gatherNodeId = 'another'; }, f => { f.unit.hp = 0; },
    f => { f.context.stopGathering(f.unit); }]) {
    const f = fixture(); f.gather(); assert.equal(f.action(), 'gather-food');
    invalidate(f); assert.equal(f.action(), null);
  }
  const f = fixture(); f.gather(); f.context.stopGathering(f.unit);
  f.unit.gatherNodeId = 'node'; f.unit.gatherPhase = 'to-node';
  assert.equal(f.action(), null); f.gather(); assert.equal(f.action(), 'gather-food');
  f.next(); assert.equal(f.action(), null, 'a receipt never survives into a later tick');
  f.unit.kind = 'infantry'; f.journal.record(f.unit, 'build', 1); assert.equal(f.row(0)[17], undefined);
});

test('only the contributing builder receives activity; completion, wait and target removal clear it', () => {
  const f = fixture(); f.unit.gatherNodeId = null; f.unit.buildingTargetId = 1;
  const far = { ...f.unit, id: 1, x: 20 }; f.context.units.push(far); f.build();
  assert.equal(f.building.progress, 1 / (30 * BUILDING_DEFINITIONS.farm.buildSeconds));
  assert.equal(f.action(), 'build'); assert.equal(f.context.workerPerformingAction(far), null);
  f.building.progress = 1 - 0.001; f.build();
  assert.equal(f.building.complete, true); assert.equal(f.building.harvestStock, 200);
  assert.equal(f.action(), null); assert.equal(f.context.workerPerformingAction(far), null);
  f.building.complete = false; f.unit.buildingTargetId = 1; f.build();
  f.context.buildingsById.delete(1); assert.equal(f.action(), null);
});

test('positive repair → retained no-wood wait requests a broadcast, while continuous work does not add one', () => {
  const f = fixture(); f.unit.gatherNodeId = null; f.unit.buildingTargetId = 1;
  f.unit.repairing = true; f.building.complete = true;
  const repair = buildingRepairStep(f.building, 100, 1 / 30);
  f.context.teamWood[0] = repair.wood; f.build();
  assert.equal(f.action(), 'repair'); assert.equal(f.building.hp, 100 + repair.hp);
  assert.equal(f.context.teamWood[0], 0); assert.equal(f.finish(), true);
  f.next(); const hp = f.building.hp; f.build();
  assert.equal(f.action(), null); assert.equal(f.unit.buildingTargetId, 1);
  assert.equal(f.row(0)[9], 'repairing'); assert.equal(f.building.hp, hp);
  assert.equal(f.finish(), true); assert.equal(f.context.dirty, true);
  f.next(); f.build(); assert.equal(f.finish(), false); assert.equal(f.context.dirty, false);
  f.context.teamWood[0] = 100; f.next(); f.build(); assert.equal(f.finish(), true);
  f.next(); f.build(); assert.equal(f.action(), 'repair'); assert.equal(f.finish(), false);
  f.next(); f.unit.x = 20; f.build(); assert.equal(f.action(), null); assert.equal(f.finish(), true);
});

test('complete repair and fresh generation/rematch/recovery journals have no stale action', () => {
  const f = fixture(); f.unit.gatherNodeId = null; f.unit.buildingTargetId = 1;
  f.unit.repairing = true; f.building.complete = true;
  f.building.hp = BUILDING_DEFINITIONS.farm.maxHp - 0.01; f.build();
  assert.equal(f.building.hp, BUILDING_DEFINITIONS.farm.maxHp); assert.equal(f.action(), null);
  f.unit.gatherNodeId = 'node'; f.unit.gatherPhase = 'to-node'; f.gather();
  assert.equal(f.action(), 'gather-food'); f.journal.clear(); assert.equal(f.action(), null);
  f.journal.beginStep(f.context.tickNumber); assert.equal(f.finish(), false);
  f.journal.record(f.unit, 'unknown', 'node'); assert.equal(f.action(), null);
});

// Tiny remaining wood can be consumed while HP addition rounds to the same
// float. Presentation must follow actual HP progress without changing that math.
test('a positive repair request with no representable HP increase has no activity', () => {
  const f = fixture(); f.unit.gatherNodeId = null; f.unit.buildingTargetId = 1;
  f.unit.repairing = true; f.building.complete = true;
  f.context.teamWood[0] = 9 * buildingRepairStep(f.building, 100, 1 / 30).wood;
  for (let i = 0; i < 9; i++) { f.next(); f.build(); assert.equal(f.action(), 'repair'); f.finish(); }
  assert.ok(f.context.teamWood[0] > 0 && f.context.teamWood[0] < Number.EPSILON);
  const hp = f.building.hp; f.next(); f.build();
  assert.equal(f.building.hp, hp); assert.equal(f.context.teamWood[0], 0);
  assert.equal(f.action(), null); assert.equal(f.finish(), true);
});

for (const team of [0, 1]) for (const repairing of [false, true])
test(`seat ${team}: a pending friendly endpoint withholds ${repairing ? 'repair' : 'build'} receipts until released`, () => {
  const f = fixture(); f.unit.team = team; f.building.team = team;
  f.unit.gatherNodeId = null; f.unit.gatherPhase = ''; f.unit.buildingTargetId = 1;
  f.unit.repairing = repairing; f.building.complete = repairing;
  const military = { ...f.unit, id: 1, kind: 'infantry', x: 8, z: 8,
    buildingTargetId: null, repairing: false, moveGoalCell: 32 * 64 + 32,
    movePlanningPending: true };
  military.moveGoalPoint = createMoveGoalPoint(military, 0, 0, military.moveGoalCell, 64, 64);
  f.context.units.push(military);
  const before = { hp: f.building.hp, progress: f.building.progress, wood: f.context.teamWood[team] };
  f.build();
  assert.equal(f.action(), null, 'accepted unpublished military endpoints prevent confirmed work');
  assert.equal(f.building.hp, before.hp); assert.equal(f.building.progress, before.progress);
  assert.equal(f.context.teamWood[team], before.wood); assert.equal(f.unit.buildingTargetId, 1);
  assert.equal(military.movePlanningPending, true); assert.deepEqual(military.path, []);
  military.moveGoalCell = 40 * 64 + 40;
  military.moveGoalPoint = createMoveGoalPoint(military, 8, 8, military.moveGoalCell, 64, 64);
  f.next(); f.build();
  assert.equal(f.action(), repairing ? 'repair' : 'build');
  assert.equal(military.movePlanningPending, true); assert.deepEqual(military.path, []);
  if (repairing) {
    assert.ok(f.building.hp > before.hp); assert.ok(f.context.teamWood[team] < before.wood);
  } else {
    assert.ok(f.building.progress > before.progress); assert.equal(f.context.teamWood[team], before.wood);
  }
});

// These loader contracts share the existing receipt CI registration. They
// exercise dependency drift without running or rewriting the server entrypoint.
async function constructionFixtureSource(run) {
  const directory = await mkdtemp(join(tmpdir(), 'rts-construction-imports-'));
  const sourceURL = pathToFileURL(join(directory, 'server.mjs'));
  const source = (imports = '', pose = 'return true;', extra = '') => `${imports}
    function constructionEndpointSnapshotGetter() { return () => constructionPoseAvailable(); }
    function constructionPoseAvailable() { ${pose} }
    ${extra}
    function updateConstructionAccess() { return constructionPoseAvailable(); }
    function updateWallBuildOrders() { throw new Error('outside construction seam'); }
    throw new Error('server startup must not execute');
  `;
  try { await run({ directory, sourceURL, source }); }
  finally { await rm(directory, { recursive: true, force: true }); }
}

test('construction loader includes an inserted helper and binds aliased, default and namespace production imports', async () => {
  await constructionFixtureSource(async ({ directory, sourceURL, source }) => {
    await writeFile(join(directory, 'policy.mjs'), 'export default 2; export const bonus = 3; export const positive = value => value + 1;');
    await writeFile(sourceURL, source(
      "import amount, { positive as grant } from './policy.mjs'; import * as policy from './policy.mjs';",
      'return insertedConstructionHelper();',
      'function insertedConstructionHelper() { return grant(amount) + policy.bonus; }'));
    const loaded = await loadConstructionServerFixture(sourceURL), context = vm.createContext(loaded.bindings);
    const policy = await import(pathToFileURL(join(directory, 'policy.mjs')).href);
    assert.equal(loaded.bindings.grant, policy.positive); assert.equal(loaded.bindings.policy, policy);
    vm.runInContext(loaded.functions, context);
    assert.equal(context.constructionEndpointSnapshotGetter()(), 6);
    assert.equal(context.updateConstructionAccess(), 6);
    assert.equal(context.updateWallBuildOrders, undefined);
  });
});

test('construction loader ignores property labels, strings and comments instead of importing unrelated host modules', async () => {
  await constructionFixtureSource(async ({ directory, sourceURL, source }) => {
    await writeFile(join(directory, 'unused.mjs'), "throw new Error('unused module must not execute'); export const ignored = 0;");
    await writeFile(sourceURL, source("import path from 'node:path'; import { ignored } from './unused.mjs';",
      "const position = { path: 2 }; const text = 'ignored()'; /* ignored() */ return position.path + ({ ignored: 1 }).ignored;"));
    const loaded = await loadConstructionServerFixture(sourceURL), context = vm.createContext(loaded.bindings);
    assert.deepEqual(Object.keys(loaded.bindings), []);
    vm.runInContext(loaded.functions, context); assert.equal(context.constructionPoseAvailable(), 3);
  });
});

test('construction loader retains shorthand and computed property value dependencies', async () => {
  await constructionFixtureSource(async ({ directory, sourceURL, source }) => {
    await writeFile(join(directory, 'policy.mjs'), "export const key = 'value', value = 7;");
    await writeFile(sourceURL, source("import { key, value } from './policy.mjs';", 'const record = { value }; return record[key];'));
    const loaded = await loadConstructionServerFixture(sourceURL), context = vm.createContext(loaded.bindings);
    vm.runInContext(loaded.functions, context); assert.equal(context.constructionPoseAvailable(), 7);
  });
});

test('construction loader rejects changed boundaries and missing required helpers during fixture setup', async () => {
  await constructionFixtureSource(async ({ sourceURL, source }) => {
    for (const [before, after, message] of [
      ['function constructionEndpointSnapshotGetter()', 'function renamedGetter()', /boundaries changed/],
      ['function updateWallBuildOrders()', 'function renamedBoundary()', /boundaries changed/],
      ['function constructionPoseAvailable()', 'function renamedPose()', /Missing production construction helper/],
    ]) {
      await writeFile(sourceURL, source().replace(before, after));
      await assert.rejects(loadConstructionServerFixture(sourceURL), message);
    }
  });
});

test('construction loader rejects an absent production export before a scenario reaches the dependency', async () => {
  await constructionFixtureSource(async ({ directory, sourceURL, source }) => {
    await writeFile(join(directory, 'policy.mjs'), 'export const another = 1;');
    await writeFile(sourceURL, source("import { missing } from './policy.mjs';", 'return missing();'));
    await assert.rejects(loadConstructionServerFixture(sourceURL), /Missing production construction import: missing/);
  });
});

test('construction loader rejects referenced host imports and conservatively rejects their local shadows', async () => {
  await constructionFixtureSource(async ({ sourceURL, source }) => {
    for (const pose of ['return path.sep;', "const path = 'local'; return path;"]) {
      await writeFile(sourceURL, source("import path from 'node:path';", pose));
      await assert.rejects(loadConstructionServerFixture(sourceURL), /require local production imports/);
    }
  });
});

test('construction loader resolves completion imports and the actual queue limit without widening its body slice', async () => {
  await constructionFixtureSource(async ({ directory, sourceURL, source }) => {
    await writeFile(join(directory, 'completion.mjs'), 'export const policy = limit => limit;');
    const text = source("import { policy as completionPolicy } from './completion.mjs';")
      + '\nconst MAX_QUEUED_WAYPOINTS = 7;\nfunction updateBuildingAndProduction() { return completionPolicy(MAX_QUEUED_WAYPOINTS); }\n';
    await writeFile(sourceURL, text);
    const loaded = await loadConstructionServerFixture(sourceURL);
    assert.equal(loaded.bindings.MAX_QUEUED_WAYPOINTS, 7, 'read the production declaration, never a fixture default');
    assert.equal(loaded.bindings.completionPolicy(loaded.bindings.MAX_QUEUED_WAYPOINTS), 7);
    assert.ok(!loaded.functions.includes('updateBuildingAndProduction'), 'completion state/body stays with its caller');
    await writeFile(sourceURL, text.replace('const MAX_QUEUED_WAYPOINTS = 7;', 'const MAX_QUEUED_WAYPOINTS = missing;'));
    await assert.rejects(loadConstructionServerFixture(sourceURL), /Missing production construction queue limit/);
  });
});

test('shared construction fixtures retain separate retry state with identical production policies', () => {
  const first = constructionServerBindings(), second = constructionServerBindings();
  const unit = { generation: 1, orderRevision: 2 }, building = { id: 3 };
  const retry = { accessBlocked: true, siteId: 3, epoch: 0, generation: 1, revision: 2 };
  first.palisadeConstructionRetries.set(unit, retry);
  const contexts = [first, second].map(bindings => {
    const context = vm.createContext(bindings); vm.runInContext(constructionServerFunctions, context); return context;
  });
  assert.equal(contexts[0].currentConstructionAccessRetry(unit, building), retry);
  assert.equal(contexts[1].currentConstructionAccessRetry(unit, building), null);
  assert.equal(first.constructionMovementActive, second.constructionMovementActive);
});
