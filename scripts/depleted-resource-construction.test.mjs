import { economyClientBindings } from './economy-client-fixture.mjs';
import { buildingBlocksMovement } from '../src/palisade-gate.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { BUILDING_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { validWildlifeNodeState } from '../src/wildlife-state.mjs';
import { validResourceVariantState } from '../src/shore-fishing.mjs';

const server = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
const client = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const occupancy = server.slice(server.indexOf('function isResourceCell('), server.indexOf('function rejectBuild('));
const preview = client.slice(client.indexOf('function buildPlacementAt('), client.indexOf('\nfunction updateBuildPlacementGhost('));
const savedResources = server.slice(server.indexOf('  assertSnapshot(Array.isArray(state.resourceNodes)'),
  server.indexOf('  for (const building of state.buildings)', server.indexOf('  const resourceCells = new Set(')));
const types = [
  { id: 'sheep', type: 'food', wildlifeSpecies: 'bellweather-sheep' },
  { id: 'berries', type: 'food' }, { id: 'timber', type: 'wood' },
  { id: 'fish', type: 'food', resourceVariant: 'shore-fish' },
];
function authority(node, stock) {
  const context = vm.createContext({ ...economyClientBindings(), buildingBlocksMovement, mapDefinition: { resourceNodes: [node] },
    resourceNodeStates: new Map(stock === undefined ? [] : [[node.id, { ...node, stock }]]),
    worldToCell: x => x, nearestOpenCell: cell => cell, walkableComponents: [0, 0, 0, 0],
    spawnByTeam: [{ x: 0, z: 0 }, { x: 1, z: 0 }],
    units: [{ hp: 100, x: 2, z: 0 }], buildings: [], homeTownCenters: [],
    buildingAccessCells: cells => cells,
  });
  vm.runInContext(occupancy, context);
  return context;
}
function clientPreview(team, node) {
  const context = vm.createContext({ ...economyClientBindings(), buildingBlocksMovement, BUILDING_DEFINITIONS, buildPlacementType: 'house',
    MAP_WIDTH: 16, MAP_HEIGHT: 16, MAP_HALF_X: 8, MAP_HALF_Z: 8,
    mapDefinition: { obstacles: [], resourceNodes: [node], triggers: [] }, localTeam: team,
    latestFood: [150, 150], latestWood: [250, 250], latestBuildings: [],
    buildingFootprint: type => BUILDING_DEFINITIONS[type].footprint,
    buildingWoodCost: type => BUILDING_DEFINITIONS[type].cost.wood,
    formatResourceRequirement: String, worldAt: () => ({ x: -0.5, z: -0.5 }),
    selectedIds: () => [0], units: [{ kind: 'worker' }], teamUnits: [[], []],
    latestForestStocks: new Map(), latestResourceStocks: new Map(),
  });
  vm.runInContext(preview, context);
  return context;
}

for (const type of types) {
  test(`${type.id}: server excludes only depleted stock from footprint and connectivity`, () => {
    const node = { ...type, x: 3, z: 0, stock: 100 };
    for (const stock of [undefined, 100, 0.25, NaN, -1, 0]) {
      const context = authority(node, stock);
      const blocks = stock !== 0;
      assert.equal(context.isResourceCell(3), blocks);
      const before = context.captureBuildingConnectivity();
      assert.equal(before.get(0).length, blocks ? 4 : 3);
      context.walkableComponents[3] = -1;
      assert.equal(context.canPlaceBuildingWithoutDisconnectingEntities(before), !blocks,
        'blocking an exhausted node does not invent a live resource route to preserve');
      context.walkableComponents[2] = -1;
      assert.equal(context.canPlaceBuildingWithoutDisconnectingEntities(before), false, 'living units remain protected');
    }
  });
  for (const team of [0, 1]) test(`${type.id}: seat ${team} preview requires disclosed exact-zero stock`, () => {
    const node = { ...type, x: -0.5, z: -0.5, stock: 100 };
    const context = clientPreview(team, node);
    assert.equal(context.buildPlacementAt(0, 0).blockedReason, 'RESOURCE IN THIS SITE', 'authored stock alone cannot release a site');
    for (const stock of [100, 0.25, NaN, -1, null, undefined]) {
      context.latestResourceStocks.set(node.id, stock);
      assert.equal(context.buildPlacementAt(0, 0).valid, false);
    }
    context.latestResourceStocks.set(node.id, 0);
    assert.equal(context.buildPlacementAt(0, 0).valid, true);
  });
}

test('depletion preserves terrain, living units, objectives and building exclusions', () => {
  const node = { ...types[0], x: -0.5, z: -0.5, stock: 100 };
  const context = clientPreview(0, node); context.latestResourceStocks.set(node.id, 0);
  context.mapDefinition.obstacles.push({ column: 7, row: 7, width: 1, height: 1, material: 'water' });
  assert.equal(context.buildPlacementAt(0, 0).blockedReason, 'TERRAIN BLOCKS THIS SITE');
  context.mapDefinition.obstacles = [];
  context.teamUnits[0] = [{ hp: 100, visible: true, serverX: node.x, serverZ: node.z }];
  assert.equal(context.buildPlacementAt(0, 0).blockedReason, 'MOVE UNITS OUT OF THIS SITE');
  context.teamUnits[0] = [];
  context.mapDefinition.triggers = [{ zone: { column: 7, row: 7, width: 1, height: 1 } }];
  assert.equal(context.buildPlacementAt(0, 0).blockedReason, 'CAPTURE ZONE IN THIS SITE');
  context.mapDefinition.triggers = [];
  context.latestBuildings = [{ type: 'house', x: node.x, z: node.z }];
  assert.equal(context.buildPlacementAt(0, 0).blockedReason, 'ANOTHER BUILDING TOO CLOSE');
});

test('checkpoint overlap uses validated remaining stock at authored positions', () => {
  const definition = { width: 16, height: 16,
    resourceNodes: types.map((type, index) => ({ ...type, x: index - 1.5, z: -0.5, stock: 100 })) };
  function check(rows) {
    const context = vm.createContext({ ...economyClientBindings(), buildingBlocksMovement, definition, state: { resourceNodes: rows }, finite: Number.isFinite,
      validWildlifeNodeState, validResourceVariantState,
      assertSnapshot: (condition, message) => { assert.ok(condition, message); },
    });
    vm.runInContext(savedResources, context);
    return Array.from(vm.runInContext('resourceCells', context));
  }
  const rows = definition.resourceNodes.map(node => ({ ...node,
    ...(node.wildlifeSpecies ? { wildlifeState: 'alive' } : {}) }));
  assert.equal(check(rows).length, 4);
  const depletedRows = rows.map(node => ({ ...node, stock: 0,
    ...(node.wildlifeSpecies ? { wildlifeState: 'depleted' } : {}) }));
  assert.equal(check(depletedRows).length, 0);
  const partial = rows.map(node => ({ ...node, stock: 0.25,
    ...(node.wildlifeSpecies ? { wildlifeState: 'carcass' } : {}) }));
  assert.equal(check(partial).length, 4);
  const movedStateRows = rows.map(node => ({ ...node, x: 1000, z: 1000 }));
  assert.deepEqual(check(movedStateRows), check(rows), 'untrusted saved coordinates cannot move the exclusion');
  for (const invalid of [rows.slice(1), [rows[0], rows[0], rows[2], rows[3]],
    rows.map(node => ({ ...node, stock: -1 })),
    [{ ...depletedRows[0], wildlifeState: 'alive' }, ...depletedRows.slice(1)],
    [{ ...depletedRows[0], id: 'unknown' }, ...depletedRows.slice(1)]]) {
    assert.throws(() => check(invalid), /invalid resource/);
  }
});

test('atomic palisade admission shares the exact-zero resource exclusion', () => {
  const wall = server.slice(server.indexOf('function buildWallLine('), server.indexOf('function buildBuilding('));
  const node = { id: 'sheep', x: 1, z: 0, stock: 100, type: 'food', wildlifeSpecies: 'bellweather-sheep' };
  for (const stock of [undefined, 100, 0.25, 0]) {
    let preparation;
    const context = vm.createContext({ ...economyClientBindings(), buildingBlocksMovement, mapDefinition: { resourceNodes: [node], triggers: [] },
      resourceNodeStates: new Map(stock === undefined ? [] : [[node.id, { ...node, stock }]]),
      buildings: [], units: [{ hp: 100, x: 0, z: 0 }], commandUnits: () => [{ hp: 100, team: 0 }],
      unitHasCapability: () => true, worldToCell: x => x,
      CELL_COUNT: 2, MAP_WIDTH: 2, MAP_HEIGHT: 1, MAX_BUILDINGS: 32,
      HOME_TOWN_CENTER_ID_BASE: 1000, nextBuildingId: 1, BUILDING_DEFINITIONS,
      blocked: [0, 0], townCenterBlocked: [0, 0], buildingBlocked: [0, 0],
      teamFood: [0, 0], teamWood: [100, 100], rejectBuild() {},
      preparePaidWallLine: args => { preparation = args; return { plan: null, status: 'invalid' }; },
    });
    vm.runInContext(wall, context);
    context.buildWallLine({ team: 0 }, { ids: [0], points: [{ column: 1, row: 0 }] });
    assert.deepEqual(Array.from(preparation.blockedCells), stock === 0 ? [] : [1]);
    assert.deepEqual(Array.from(preparation.occupiedCells), [0], 'living unit occupancy remains independent');
    assert.deepEqual(context.teamWood, [100, 100]);
  }
});
