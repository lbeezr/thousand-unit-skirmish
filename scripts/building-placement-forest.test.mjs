import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import {BUILDING_DEFINITIONS} from '../src/gameplay-definitions.mjs';

const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const placement = source.slice(source.indexOf('function buildPlacementAt('),
  source.indexOf('\nfunction updateBuildPlacementGhost('));
const receipt = source.slice(source.indexOf('function applyForestState('),
  source.indexOf('\nlet terrainSurface'));
const width = 16;
const cells = Array.from({length: 9}, (_, i) => (6 + Math.floor(i / 3)) * width + 6 + i % 3);
function fixture(team, obstacles = [{column: 6, row: 6, width: 3, height: 3, material: 'forest'}]) {
  const context = vm.createContext({BUILDING_DEFINITIONS, buildPlacementType: 'house',
    MAP_WIDTH: width, MAP_HEIGHT: width, MAP_HALF_X: 8, MAP_HALF_Z: 8,
    mapDefinition: {obstacles, resourceNodes: [], triggers: []}, localTeam: team,
    latestFood: [150, 150], latestWood: [250, 250], latestBuildings: [],
    buildingFootprint: type => BUILDING_DEFINITIONS[type].footprint,
    buildingWoodCost: type => BUILDING_DEFINITIONS[type].cost.wood,
    formatResourceRequirement: String, worldAt: () => ({x: -0.5, z: -0.5}),
    selectedIds: () => [0], units: [{kind: 'worker'}], teamUnits: [[], []],
    latestForestEpoch: 1, latestForestStocks: new Map(), latestResourceStocks: new Map(),
    forestTreeSlots: new Map(cells.map(cell => [cell, {}])),
    setForestTreeVisual() {}, resourceVisualStage: value => value,
    drawMinimap() {}, performance: {now: () => 0},
  });
  vm.runInContext(placement + receipt, context);
  return {context, clear: entries => context.applyForestState({forestEpoch: 1,
    forestStocks: entries.map(cell => [cell, 0])}), at: () => context.buildPlacementAt(0, 0)};
}

for (const team of [0, 1]) {
  test(`seat ${team} can place on fully depleted disclosed forest cells`, () => {
    const f = fixture(team);
    assert.equal(f.at().valid, false, 'implicit forest remains blocked');
    f.clear(cells);
    assert.equal(f.context.latestForestStocks.size, 9);
    assert.equal(f.at().valid, true);
    assert.equal(f.at().blockedReason, '');
  });
  test(`seat ${team} preserves uncleared, unknown and reset forest blocking`, () => {
    const f = fixture(team);
    f.clear(cells.slice(1));
    assert.equal(f.at().valid, false, 'an undisclosed cell must remain blocked');
    f.context.applyForestState({forestEpoch: 1, forestStocks: [[cells[0], 0.01]]});
    assert.equal(f.at().valid, false, 'partially harvested stock still blocks');
    f.clear(cells);
    assert.equal(f.at().valid, true);
    f.context.applyForestState({forestEpoch: 1, forestStocks: []});
    assert.equal(f.at().valid, true, 'already disclosed zero stock remains known without new updates');
    f.context.applyForestState({forestEpoch: 2, forestStocks: []});
    assert.equal(f.at().valid, false, 'epoch/reset discards prior clearing knowledge');
    assert.equal(f.context.latestForestStocks.size, 0);
  });
}

test('only overlapping cells need disclosed depletion, across separate forest rectangles', () => {
  const f = fixture(0, [
    {column: 4, row: 6, width: 3, height: 3, material: 'forest'},
    {column: 8, row: 6, width: 3, height: 3, material: 'forest'},
  ]);
  f.clear(cells);
  assert.equal(f.at().valid, true, 'forest outside the footprint does not block it');
  f.context.latestForestStocks.delete(cells[2]);
  assert.equal(f.at().valid, false, 'one uncleared overlapping rectangle still blocks');
});

test('depletion never admits hard terrain or other existing placement blockers', () => {
  const f = fixture(0);
  f.clear(cells);
  for (const material of ['stone', 'water', undefined]) {
    f.context.mapDefinition.obstacles.push({column: 7, row: 7, width: 1, height: 1, material});
    assert.equal(f.at().blockedReason, 'TERRAIN BLOCKS THIS SITE');
    f.context.mapDefinition.obstacles.pop();
  }
  f.context.mapDefinition.resourceNodes = [{x: -0.5, z: -0.5}];
  assert.equal(f.at().blockedReason, 'RESOURCE IN THIS SITE');
  f.context.mapDefinition.resourceNodes = [];
  f.context.mapDefinition.triggers = [{zone: {column: 7, row: 7, width: 1, height: 1}}];
  assert.equal(f.at().blockedReason, 'CAPTURE ZONE IN THIS SITE');
  f.context.mapDefinition.triggers = [];
  f.context.teamUnits[0] = [{hp: 100, serverX: -0.5, serverZ: -0.5}];
  assert.equal(f.at().blockedReason, 'MOVE UNITS OUT OF THIS SITE');
  f.context.teamUnits[0] = [];
  f.context.latestBuildings = [{type: 'house', x: -0.5, z: -0.5}];
  assert.equal(f.at().blockedReason, 'ANOTHER BUILDING TOO CLOSE');
});
