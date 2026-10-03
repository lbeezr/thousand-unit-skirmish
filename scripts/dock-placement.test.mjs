import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createDockPlacementContext } from '../src/dock-placement.mjs';
import { createWaterRouteGraph, isWaterCellRouteValid } from '../src/water-route-graph.mjs';
import { BUILDING_DEFINITIONS as B, GAMEPLAY_DEFINITIONS, GAMEPLAY_RULESET_REVISION, validateGameplayDefinitions } from '../src/gameplay-definitions.mjs';
import { buildingPresentation } from '../src/gameplay-presentation.mjs';

const center = 8 * 20 + 8;
const maps = {
  north: { column: 7, row: 2, width: 3, height: 5 },
  east: { column: 10, row: 7, width: 5, height: 3 },
  south: { column: 7, row: 10, width: 3, height: 5 },
  west: { column: 2, row: 7, width: 5, height: 3 },
};
const mapFor = side => ({ width: 20, height: 20, obstacles: [{ ...maps[side], material: 'water' }] });

for (const side of Object.keys(maps)) test(`Dock ${side} shore yields a clear berth and legal outward route`, () => {
  const map = mapFor(side), before = structuredClone(map);
  const access = createDockPlacementContext(map, B.dock).accessAt(center);
  assert.equal(access.valid, true); assert.equal(access.side, side);
  assert.equal(access.spawnFootprint.length, 9);
  assert.equal(new Set(access.spawnFootprint).size, 9);
  assert.equal(isWaterCellRouteValid(createWaterRouteGraph(map, { clearanceCells: 1 }), access.route), true);
  assert.deepEqual(access.route, [access.spawnCell, access.exitCell]);
  assert.deepEqual(map, before, 'placement neither consumes stock nor reserves water');
});

test('inland, submerged, raised, narrow, enclosed and map-edge sites reject without snapping', () => {
  const dry = { width: 20, height: 20, obstacles: [] };
  assert.equal(createDockPlacementContext(dry, B.dock).accessAt(center).valid, false);
  for (const map of [
    { width: 20, height: 20, obstacles: [{ material: 'water', column: 7, row: 7, width: 8, height: 3 }] },
    { ...mapFor('east'), elevationPatches: [{ column: 7, row: 7, width: 3, height: 3, level: 1 }] },
    { ...mapFor('east'), elevationPatches: [{ column: 10, row: 7, width: 5, height: 3, level: 1 }] },
    { width: 20, height: 20, obstacles: [{ material: 'water', column: 10, row: 8, width: 5, height: 1 }] },
    { width: 20, height: 20, obstacles: [{ material: 'water', column: 10, row: 7, width: 3, height: 3 }] },
  ]) assert.equal(createDockPlacementContext(map, B.dock).accessAt(center).valid, false);
  const context = createDockPlacementContext(mapFor('east'), B.dock);
  for (const cell of [-1, 0, 399, 400, NaN, 1.5]) assert.equal(context.accessAt(cell).valid, false);
});

test('water reservations include berth and exit clearance; rebuilding rejects a stale launch route', () => {
  const map = mapFor('east'), access = createDockPlacementContext(map, B.dock).accessAt(center);
  for (const cell of [...access.spawnFootprint, access.exitCell + 1]) {
    const reserved = { reservedCells: [cell] };
    assert.equal(createDockPlacementContext(map, B.dock, reserved).accessAt(center).valid, false);
    assert.equal(isWaterCellRouteValid(createWaterRouteGraph(map, { ...reserved, clearanceCells: 1 }), access.route), false);
  }
});

test('facing selection is deterministic and independent of obstacle order', () => {
  const map = mapFor('east'); map.obstacles.push({ ...maps.north, material: 'water' });
  assert.equal(createDockPlacementContext(map, B.dock).accessAt(center).side, 'north');
  map.obstacles.reverse();
  assert.equal(createDockPlacementContext(map, B.dock).accessAt(center).side, 'north');
});

test('context snapshots authored water/elevation and returned arrays cannot mutate it', () => {
  const map = mapFor('east'), context = createDockPlacementContext(map, B.dock);
  const before = context.accessAt(center);
  map.obstacles.length = 0; map.elevationPatches = [{ column: 7, row: 7, width: 3, height: 3, level: 2 }];
  context.accessAt(center).route.length = 0; context.accessAt(center).spawnFootprint.fill(-1);
  assert.deepEqual(context.accessAt(center), before);
  assert.equal(createDockPlacementContext(map, B.dock).accessAt(center).valid, false);
  assert.ok(Object.isFrozen(context));
});

test('Dock explicitly declares provisional land/shore placement and placeholder, without production or drop-off', () => {
  assert.equal(B.dock.footprint, 3);
  assert.deepEqual(B.dock.placement, { kind: 'shoreline', waterClearanceCells: 1 });
  assert.deepEqual(B.dock.products, []);
  assert.equal(B.dock.dropoff, undefined); assert.equal(B.dock.populationCapacity, undefined);
  assert.deepEqual(buildingPresentation('dock'), { backend: 'procedural', role: 'house' });
  for (const placement of [null, [], { kind: 'naval' }, { kind: 'shoreline', waterClearanceCells: 0 },
    { kind: 'shoreline', waterClearanceCells: 1, pierWidth: 3 }]) {
    const definitions = structuredClone(GAMEPLAY_DEFINITIONS); definitions.buildings.dock.placement = placement;
    assert.throws(() => validateGameplayDefinitions(definitions), /Unsupported building placement/);
  }
  assert.throws(() => createDockPlacementContext(mapFor('east'), { ...B.dock, footprint: 5 }), /Unsupported Dock/);
});

for (const team of [0, 1]) test(`seat ${team} browser preview enforces the shared shore rule and ordinary land exclusions`, () => {
  const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const placement = source.slice(source.indexOf('function buildPlacementAt('), source.indexOf('\nfunction updateBuildPlacementGhost('));
  const map = { ...mapFor('east'), resourceNodes: [], triggers: [] };
  const context = vm.createContext({ BUILDING_DEFINITIONS: B, buildPlacementType: 'dock',
    MAP_WIDTH: 20, MAP_HEIGHT: 20, MAP_HALF_X: 10, MAP_HALF_Z: 10,
    mapDefinition: map, dockPlacementContext: createDockPlacementContext(map, B.dock), localTeam: team,
    latestFood: [0, 0], latestWood: [100, 100], latestBuildings: [],
    buildingFootprint: type => B[type].footprint, buildingWoodCost: type => B[type].cost.wood,
    formatResourceRequirement: String, worldAt: () => ({ x: -1.5, z: -1.5 }),
    selectedIds: () => [0], units: [{ kind: 'worker' }], teamUnits: [[], []],
    latestForestStocks: new Map(), latestResourceStocks: new Map(),
  });
  vm.runInContext(placement, context);
  assert.equal(context.buildPlacementAt(0, 0).valid, true);
  context.mapDefinition.resourceNodes.push({ id: 'shore-food', x: -1.5, z: -1.5, stock: 10 });
  assert.equal(context.buildPlacementAt(0, 0).blockedReason, 'RESOURCE IN THIS SITE');
  context.latestResourceStocks.set('shore-food', 0);
  assert.equal(context.buildPlacementAt(0, 0).valid, true, 'disclosed depletion retains the current land rule');
  context.mapDefinition.resourceNodes.length = 0;
  context.latestBuildings.push({ type: 'house', x: -1.5, z: -1.5 });
  assert.equal(context.buildPlacementAt(0, 0).blockedReason, 'ANOTHER BUILDING TOO CLOSE');
  context.latestBuildings.length = 0;
  context.dockPlacementContext = createDockPlacementContext({ ...map, obstacles: [] }, B.dock);
  assert.equal(context.buildPlacementAt(0, 0).blockedReason, 'DOCK NEEDS CLEAR WATER BERTH');
  context.buildPlacementType = 'house';
  assert.equal(context.buildPlacementAt(0, 0).valid, true, 'ordinary buildings retain their land rule');
});

test('only known compatible pre-Dock checkpoints migrate, and older pins cannot claim Dock content', () => {
  const source = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
  const migration = source.slice(source.indexOf('function migrateMatchCheckpoint('), source.indexOf('\nasync function drainMatchCheckpointWrites('));
  const context = vm.createContext({ MATCH_CHECKPOINT_SCHEMA_VERSION: 22, MATCH_RULES_VERSION: 6, GAMEPLAY_RULESET_REVISION });
  vm.runInContext(migration, context);
  const prior = 'v1:c8a30de45cf9bfa527046662d022a0dc2cb28efc3ddd8b24521c5992eae328c2';
  const paid = { schemaVersion: 22, rulesVersion: 6, rulesetRevision: prior,
    state: { buildings: [{ type: 'mill', id: 3 }], units: [], teamWood: [17, 23] } };
  assert.equal(context.migrateMatchCheckpoint(paid).rulesetRevision, GAMEPLAY_RULESET_REVISION);
  assert.deepEqual(paid.state.teamWood, [17, 23]);
  for (const pin of [prior, 'v1:fe00d0541953e6ed6d2c4e121789dd26fa6a962abce9ab8b4de1f067064ad801',
    'v1:d85f5a09decc0d0ade81803ab289b52ec5a08e84ff5a1771e85401d4c3611eab', undefined, 'unknown']) {
    const snapshot = { schemaVersion: 22, rulesVersion: 6, rulesetRevision: pin,
      state: { buildings: [{ type: 'dock' }], units: [] } };
    assert.equal(context.migrateMatchCheckpoint(snapshot).rulesetRevision, pin);
  }
});
