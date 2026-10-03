import { validFarmStock } from '../src/farm-harvest.mjs';
import { validGateState, buildingBlocksMovement } from '../src/palisade-gate.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { PALISADE_TUNING_PROPOSAL as tuning, palisadeDraftDefinition,
  preparePaidWallLine } from '../src/wall-construction-draft.mjs';
import { GAMEPLAY_DEFINITIONS, BUILDING_DEFINITIONS, UNIT_DEFINITIONS,
  validateGameplayDefinitions } from '../src/gameplay-definitions.mjs';
import { unfinishedRefund, buildingRepairStep } from '../src/base-lifecycle.mjs';
import { canTraverseElevation } from '../src/elevation.mjs';
import { activeWallBuildOrder } from '../src/wall-build-order.mjs';
import { planWallLine } from '../src/wall-line-planner.mjs';

const source = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
const definition = palisadeDraftDefinition(tuning);
const definitions = { ...BUILDING_DEFINITIONS, [definition.id]: definition };
const rules = type => definitions[type] && { ...definitions[type], label: definitions[type].label.toUpperCase(), trainLabel: '' };
const point = (column, row) => ({ column, row });
const prepare = options => preparePaidWallLine({ tuning, team: 0, width: 16, height: 16,
  balance: { food: 0, wood: 100 }, buildingCount: 0, buildingLimit: 128,
  nextBuildingId: 1, idCeiling: 1_000_000_000, points: [point(7, 7), point(9, 7)],
  assessPlacement: cells => ({ entitiesConnected: true, activeRoutesConnected: true,
    access: cells.map(cell => ({ cell, accessCell: cell - 16 })) }), ...options });
const extract = (name, next) => {
  const start = source.indexOf(`function ${name}(`), end = source.indexOf(`\nfunction ${next}(`, start);
  assert.ok(start >= 0 && end > start, `existing server function ${name} remains discoverable`);
  return source.slice(start, end);
};
const functions = [
  ['cellIndex', 'nearestOpenCellInComponent'], ['rebuildWalkableComponents', 'findAvailableCellNear'],
  ['buildingAccessCells', 'findBuildingAttackApproachCell'],
  ['captureBuildingConnectivity', 'rejectBuild'], ['pendingMoveAssignmentsByUnit', 'pathIntersectsCells'],
  ['creditRefund', 'cancelTraining'], ['destroyBuilding', 'pendingMoveAssignmentsByUnit'],
  ['updateWallBuildOrders', 'updateTeamResearch'],
].map(([a, b]) => extract(a, b)).join('\n');

function fixture(team = 0) {
  const worker = { id: 0, team, kind: 'worker', hp: 100, x: -4.5, z: 0.5,
    buildingTargetId: null, repairing: false, orderRevision: 0,
    attackTargetId: -1, attackBuildingTargetId: -1, path: [], pathIndex: 0,
    queuedWaypoints: [], moveGoalCell: -1, gatherForestCell: -1, gatherPhase: '' };
  const context = vm.createContext({ validGateState, buildingBlocksMovement, BUILDING_DEFINITIONS: definitions, UNIT_DEFINITIONS,
    MAP_WIDTH: 16, MAP_HEIGHT: 16, MAP_HALF_X: 8, MAP_HALF_Z: 8, CELL_COUNT: 256,
    blocked: new Uint8Array(256), buildingBlocked: new Uint8Array(256), townCenterBlocked: new Uint8Array(256),
    elevationLevelByCell: new Uint8Array(256), canTraverseElevation,
    units: [worker], buildings: [], buildingsById: new Map(),
    homeTownCenters: [], spawnByTeam: [{ x: -6.5, z: 0.5 }, { x: 6.5, z: 0.5 }],
    mapDefinition: { resourceNodes: [] }, teamFood: [0, 0], teamWood: [100, 100], teamResearch: [null, null],
    workerProduction: [], activeMovePlanningJob: null, movePlanningQueue: [],
    STEP_SECONDS: 1, BUILDER_INTERACTION_RANGE: 1.6, buildingRulesFor: rules,
    unfinishedRefund, buildingRepairStep: (b, wood, seconds) => buildingRepairStep(b, wood, seconds,
      { ...GAMEPLAY_DEFINITIONS, buildings: definitions }),
    unitHasCapability: (u, capability) => UNIT_DEFINITIONS[u.kind].capabilities.includes(capability),
    activeWallBuildOrder, navigationRevision: 0, attackFlowFields: new Map(), dirty: false,
    broadcastGameplayNotice() {}, sendOrderNotice() {}, clearAttackTarget() {},
  });
  vm.runInContext(functions, context);
  context.rebuildWalkableComponents();
  const assessPlacement = cells => {
    const groups = context.captureBuildingConnectivity(), oldMask = context.buildingBlocked;
    const components = context.walkableComponents.slice();
    try {
      context.buildingBlocked = oldMask.slice();
      for (const cell of cells) context.buildingBlocked[cell] = 1;
      context.rebuildWalkableComponents();
      const entitiesConnected = context.canPlaceBuildingWithoutDisconnectingEntities(groups);
      const activeRoutesConnected = context.activeMoveRoutesRemainConnected(components);
      const spawn = context.spawnByTeam[team];
      const spawnComponent = context.walkableComponents[context.worldToCell(spawn.x, spawn.z)];
      const workerComponent = context.walkableComponents[context.worldToCell(worker.x, worker.z)];
      const access = cells.flatMap(cell => {
        const accessCell = context.buildingAccessCells([cell]).find(c =>
          worker.hp > 0 && workerComponent === spawnComponent
          && context.walkableComponents[c] === workerComponent);
        return accessCell === undefined ? [] : [{ cell, accessCell }];
      });
      return { entitiesConnected, activeRoutesConnected, access };
    } finally {
      context.buildingBlocked = oldMask;
      context.rebuildWalkableComponents();
    }
  };
  return { context, worker, assessPlacement };
}

test('provisional registered tuning remains explicitly configurable without adding currency', () => {
  const extended = structuredClone(GAMEPLAY_DEFINITIONS);
  extended.buildings[definition.id] = definition;
  validateGameplayDefinitions(extended);
  assert.deepEqual(BUILDING_DEFINITIONS[definition.id], definition);
  assert.deepEqual(definition.cost, { food: 0, wood: 15 });
  assert.deepEqual(palisadeDraftDefinition({ ...tuning, cost: { food: 0, wood: 20 }, maxHp: 250 }).cost,
    { food: 0, wood: 20 });
  for (const value of [undefined, { ...tuning, footprint: 2 }, { ...tuning, maxHp: 0 },
    { ...tuning, cost: { food: 1, wood: 15 } }, { ...tuning, cost: { food: 0, wood: 15, stone: 1 } }]) {
    assert.throws(() => palisadeDraftDefinition(value), TypeError);
  }
});

for (const team of [0, 1]) test(`seat ${team}: paid preparation creates one full line, preserving facts and IDs until commit`, () => {
  const f = fixture(team), mask = f.context.buildingBlocked.slice();
  const result = prepare({ team, assessPlacement: f.assessPlacement });
  assert.equal(result.status, 'ready');
  assert.equal(result.plan.buildings.length, 3);
  assert.deepEqual(result.plan.cost, { food: 0, wood: 45 });
  assert.equal(result.plan.nextBuildingId, 4);
  assert.deepEqual(result.plan.buildings.map(b => [b.id, b.team, b.footprint[0]]), [[1, team, 119], [2, team, 120], [3, team, 121]]);
  assert.ok(result.plan.buildings.every(b => b.hp === 300 && b.progress === 0 && !b.complete));
  assert.deepEqual(f.context.buildingBlocked, mask);
  assert.equal(f.context.buildings.length, 0);
  assert.deepEqual(f.context.teamWood, [100, 100], 'preparation does not debit');
});

test('a full-line cut rejects even when each segment in isolation would be legal', () => {
  const f = fixture(), points = [point(8, 0), point(8, 15)];
  assert.equal(prepare({ points: [point(8, 0)], assessPlacement: f.assessPlacement }).status, 'ready');
  assert.equal(prepare({ points: [point(8, 15)], assessPlacement: f.assessPlacement }).status, 'ready');
  const rejected = prepare({ points, balance: { food: 0, wood: 500 }, assessPlacement: f.assessPlacement });
  assert.equal(rejected.status, 'would-block-route');
  assert.equal(rejected.plan, null);
  assert.equal(f.context.buildingBlocked.reduce((a, b) => a + b, 0), 0);
  assert.deepEqual(f.context.teamWood, [100, 100]);
});

test('preserves active queued routes and requires reachable Workers for every new segment', () => {
  const f = fixture();
  f.worker.queuedWaypoints = [{ destination: 10 * 16 + 10 }];
  // A closed loop surrounds the queued destination, without cutting spawn/entity access.
  const points = [point(9, 9), point(11, 9), point(11, 11), point(9, 11), point(9, 9)];
  const cells = planWallLine({ width: 16, height: 16, points,
    segmentCost: tuning.cost }).plan.added.map(p => p.cell);
  const assessment = f.assessPlacement(cells);
  assert.equal(assessment.entitiesConnected, true);
  assert.equal(assessment.activeRoutesConnected, false, 'the active-route guard supplies the rejection');
  assert.equal(prepare({ points, balance: { food: 0, wood: 500 }, assessPlacement: f.assessPlacement }).status, 'would-block-route');
  f.worker.queuedWaypoints = [];
  assert.equal(prepare({ points, balance: { food: 0, wood: 500 }, assessPlacement: f.assessPlacement }).status, 'ready');
  f.worker.hp = 0;
  assert.equal(prepare({ assessPlacement: f.assessPlacement }).status, 'no-reachable-workers');
  assert.equal(prepare({ assessPlacement: cells => ({ entitiesConnected: true,
    activeRoutesConnected: true, access: [{ cell: cells[0], accessCell: cells[0] - 16 }] }) }).plan, null);
});

test('insufficient funds, occupied cells, building and ID limits return no partial transaction', () => {
  for (const [options, status] of [
    [{ balance: { food: 0, wood: 44.99 } }, 'insufficient-resources'],
    [{ occupiedCells: [120] }, 'invalid'], [{ buildingCount: 126 }, 'building-limit'],
    [{ nextBuildingId: 999_999_998 }, 'id-limit'],
  ]) assert.equal(prepare(options).status, status);
  assert.throws(() => prepare({ balance: null }), TypeError);
  assert.throws(() => prepare({ assessPlacement: () => Promise.resolve({}) }), TypeError);
  assert.throws(() => prepare({ assessPlacement: cells => ({ entitiesConnected: true,
    activeRoutesConnected: true, access: cells.map(cell => ({ cell, accessCell: cell })) }) }), TypeError);
  assert.throws(() => prepare({ existingWallCells: [103] }), /Worker access/,
    'a claimed access point on an existing wall is not walkable');
});

test('reusing a line retains existing IDs, price and progress instead of repaying or resetting it', () => {
  const result = prepare({ existingWallCells: [119, 120, 121], balance: { food: 0, wood: 0 },
    assessPlacement() { throw new Error('a no-op must not stage occupancy'); } });
  assert.equal(result.status, 'ready');
  assert.deepEqual(result.plan, { buildings: [], cost: { food: 0, wood: 0 }, nextBuildingId: 1, access: [], topologyUpdates: [] });
});

for (const team of [0, 1]) test(`seat ${team}: existing cancellation/destruction paths refund once and release occupancy`, () => {
  const f = fixture(team), building = prepare({ team }).plan.buildings[0];
  building.progress = 0.4; building.hp = 120;
  f.context.buildings.push(building); f.context.buildingsById.set(building.id, building);
  f.context.buildingBlocked[119] = 1;
  f.context.teamWood[team] -= tuning.cost.wood;
  f.worker.buildingTargetId = building.id;
  f.context.cancelConstruction({ team: 1 - team }, { buildingId: building.id });
  assert.equal(f.context.teamWood[team], 85);
  f.context.cancelConstruction({ team }, { buildingId: building.id });
  assert.equal(f.context.teamWood[team], 94, 'refunds only 60% unbuilt work: nine wood');
  assert.equal(f.context.buildingBlocked[119], 0);
  assert.equal(f.worker.buildingTargetId, null);
  assert.equal(f.context.navigationRevision, 1);
  f.context.cancelConstruction({ team }, { buildingId: building.id });
  assert.equal(f.context.teamWood[team], 94);
  assert.equal(f.context.destroyBuilding(building), false, 'replayed removal has no effect');
  const second = prepare({ nextBuildingId: 2 }).plan.buildings[0];
  second.hp = 0;
  f.context.buildings.push(second); f.context.buildingsById.set(second.id, second);
  f.context.buildingBlocked[119] = 1;
  f.context.destroyBuilding(second);
  assert.equal(f.context.teamWood[team], 94, 'combat destruction itself returns no refund');
  assert.equal(f.context.buildingBlocked[119], 0);
});

test('existing construction retains damage through completion; repairs retain the ten-wood minimum', () => {
  const f = fixture(), building = prepare().plan.buildings[0];
  building.hp = 150;
  f.context.buildings.push(building); f.context.buildingsById.set(building.id, building);
  f.context.buildingBlocked[119] = 1;
  f.worker.x = building.x; f.worker.z = building.z - 1; f.worker.buildingTargetId = building.id;
  for (let step = 0; step < 5; step++) f.context.updateBuildingAndProduction();
  assert.equal(building.complete, true); assert.equal(building.progress, 1);
  assert.equal(building.hp, 150, 'construction does not heal combat damage');
  assert.equal(f.worker.buildingTargetId, null);
  const repair = buildingRepairStep({ ...building, hp: 0 }, 100, 100,
    { ...GAMEPLAY_DEFINITIONS, buildings: definitions });
  assert.deepEqual(repair, { hp: 300, wood: 10 });
  building.hp = 300;
  f.context.cancelConstruction({ team: 0 }, { buildingId: building.id });
  assert.equal(f.context.buildings.length, 1, 'completed segments cannot be cancelled for a refund');
});

test('existing checkpoint building checks accept one-cell records and reject corrupt recovery data', () => {
  const start = source.indexOf('  assertSnapshot(Array.isArray(state.buildings)'),
    end = source.indexOf('\n  for (let team = 0; team < 2; team++) {', start);
  assert.ok(start >= 0 && end > start);
  const records = prepare().plan.buildings;
  records[0].progress = 0.4; records[0].hp = 120;
  const context = vm.createContext({ validFarmStock, validGateState, buildingBlocksMovement, definition: { width: 16, height: 16, obstacles: [], resourceNodes: [] },
    cellCount: 256, MAX_BUILDINGS: 128, MAX_BUILDING_QUEUE: 12, BUILDING_DEFINITIONS: definitions,
    UNIT_DEFINITIONS, checkpointForestMask: new Uint8Array(256), savedForestStocks: new Map(),
    FOREST_WOOD_PER_CELL: 100, buildingRulesFor: rules,
    finite: Number.isFinite, integerIn: (n, low, high) => Number.isInteger(n) && n >= low && n <= high,
    assertSnapshot: (ok, message) => { if (!ok) throw new Error(message); } });
  const validate = rows => { context.state = { buildings: rows, resourceNodes: [] }; vm.runInContext(`{${source.slice(start, end)}}`, context); };
  const recovered = JSON.parse(JSON.stringify(records));
  validate(recovered);
  assert.deepEqual(recovered, records, 'partial construction, damaged HP, identity and queues survive JSON');
  for (const mutate of [b => { b.hp = 301; }, b => { b.footprint = [118]; }, b => { b.progress = 2; },
    b => { b.type = 'unregistered-wall'; }, b => { b.productionQueue = ['worker']; b.queue = 1; }]) {
    const corrupt = structuredClone(records); mutate(corrupt[0]); assert.throws(() => validate(corrupt));
  }
  assert.throws(() => validate([...records, { ...records[0] }]));
});

test('existing restore copies damaged/partial records and cancellation after recovery never re-debits or double-refunds', () => {
  const start = source.indexOf('  buildings.length = 0;', source.indexOf('function restoreMatchCheckpoint(')),
    end = source.indexOf('\n  resetHomeTownCenters(', start);
  assert.ok(start >= 0 && end > start);
  const records = prepare().plan.buildings;
  records[0].progress = 0.4; records[0].hp = 120;
  const state = JSON.parse(JSON.stringify({ buildings: records }));
  const f = fixture();
  f.context.teamWood[0] = 55; // The line's 45 wood was already paid before the checkpoint.
  vm.runInContext(`function restoreDraftBuildingsForTest(state) {${source.slice(start, end)}}`, f.context);
  f.context.restoreDraftBuildingsForTest(state);
  assert.equal(f.context.teamWood[0], 55, 'restore does not charge the already-paid line');
  assert.equal(f.context.buildingBlocked.reduce((a, b) => a + b, 0), 3);
  const restored = f.context.buildingsById.get(1);
  assert.equal(restored.hp, 120); assert.equal(restored.progress, 0.4);
  assert.notEqual(restored.footprint, state.buildings[0].footprint);
  f.context.cancelConstruction({ team: 0 }, { buildingId: 1 });
  assert.equal(f.context.teamWood[0], 64);
  assert.equal(f.context.buildingBlocked[119], 0);
  f.context.cancelConstruction({ team: 0 }, { buildingId: 1 });
  assert.equal(f.context.teamWood[0], 64, 'replayed cancellation after restore credits nothing');
});

test('tentative occupancy is restored even when a connectivity assessment throws', () => {
  const f = fixture(), oldMask = f.context.buildingBlocked;
  f.context.canPlaceBuildingWithoutDisconnectingEntities = () => { throw new Error('assessment failed'); };
  assert.throws(() => prepare({ assessPlacement: f.assessPlacement }), /assessment failed/);
  assert.equal(f.context.buildingBlocked, oldMask);
  assert.equal(oldMask.reduce((a, b) => a + b, 0), 0);
  assert.deepEqual(f.context.teamWood, [100, 100]);
  assert.equal(f.context.buildings.length, 0);
});

test('parent-supplied one-cell palisade art layout maps all sixteen cardinal connection combinations', () => {
  const center = 8 * 16 + 8, directions = ['north', 'east', 'south', 'west'],
    neighbours = [center - 16, center + 1, center + 16, center - 1];
  for (let mask = 0; mask < 16; mask++) {
    const expected = directions.filter((_, i) => mask & (1 << i));
    const existingWallCells = neighbours.filter((_, i) => mask & (1 << i));
    const result = planWallLine({ width: 16, height: 16, points: [point(8, 8)],
      segmentCost: tuning.cost, existingWallCells });
    const piece = result.plan.added[0];
    assert.deepEqual(piece.connections, expected);
    assert.equal(result.plan.updated.length, expected.length, 'each existing half-arm gets its reciprocal join');
    assert.equal(piece.kind, expected.length === 0 ? 'post' : expected.length === 1 ? 'end'
      : expected.length >= 3 ? 'junction' : mask === 5 || mask === 10 ? 'straight' : 'corner');
    const record = prepare({ points: [point(8, 8)] }).plan.buildings[0];
    assert.deepEqual(record.footprint, [center]);
    assert.equal(record.x, 0.5); assert.equal(record.z, 0.5);
    for (const direction of piece.connections) {
      const [dx, dz] = { north: [0, -0.5], east: [0.5, 0], south: [0, 0.5], west: [-0.5, 0] }[direction];
      const neighbour = prepare({ points: [point(8 + dx * 2, 8 + dz * 2)] }).plan.buildings[0];
      assert.equal(record.x + dx, neighbour.x - dx, 'opposing half-arms meet at one x seam');
      assert.equal(record.z + dz, neighbour.z - dz, 'opposing half-arms meet at one z seam');
    }
  }
});

test('wall removal clears a dead Worker target so recovery never references a removed building', () => {
  const f = fixture(), building = prepare().plan.buildings[0];
  f.context.buildings.push(building); f.context.buildingsById.set(building.id, building);
  f.context.buildingBlocked[119] = 1;
  Object.assign(f.worker, { hp: 0, generation: 3, buildingTargetId: building.id,
    wallBuildOrder: { ids: [building.id], generation: 3, revision: f.worker.orderRevision } });
  f.context.destroyBuilding(building);
  assert.equal(f.worker.buildingTargetId, null, 'full checkpoint validation requires every retained unit target to exist');
  assert.equal(f.worker.wallBuildOrder, null);
  assert.equal(f.context.teamWood[0], 100, 'death/destruction never credits construction refunds');
});
