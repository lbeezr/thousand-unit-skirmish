import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createWorkerPerformingActions } from '../src/worker-performing-action.mjs';
import { BUILDING_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { buildingRepairStep } from '../src/base-lifecycle.mjs';

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
    path: [], pathIndex: 0, movePlanningPending: false, moveGoalCell: -1, queuedWaypoints: [] };
  const node = { id: 'node', type: 'food', x: 0, z: 0, stock: 10 };
  const building = { id: 1, type: 'farm', x: 0, z: 0, hp: 100, complete: false, progress: 0 };
  const journal = createWorkerPerformingActions();
  const context = vm.createContext({ units: [unit], tickNumber: 1, dirty: false,
    workerPerformingActions: journal, BUILDING_DEFINITIONS, buildingRepairStep,
    buildingsById: new Map([[1, building]]), resourceNodeStates: new Map([[node.id, node]]), teamWood: [100, 100],
    mapDefinition: { fogOfWar: true }, STATE_EVERY_TICKS: 3,
    WORKER_INTERACTION_RANGE: 1.4, BUILDER_INTERACTION_RANGE: 1.4,
    WORKER_CARRY_CAPACITY: 10, GATHER_RATE: 2, STEP_SECONDS: 1 / 30,
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
    'snapshotUnits', 'workerTaskStatus', 'stopGathering', 'updateForestWorkerEconomy',
    'updateWorkerEconomy'].map(fn).join('\n') + '\n' + construction, context);
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
