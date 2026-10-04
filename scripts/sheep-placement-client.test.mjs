import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { economyClientBindings } from './economy-client-fixture.mjs';
import { wildlifeClientBindings, wildlifeClientFunctionSource } from './wildlife-client-fixture-bindings.mjs';
import { BUILDING_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { previewWallPlacement } from '../src/wall-placement.mjs';

const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
function fn(name) {
  const start = main.indexOf(`function ${name}(`), end = main.indexOf('\nfunction ', start + 1);
  assert.ok(start >= 0 && end > start); return main.slice(start, end);
}
const authored = { id: 'placement-sheep', type: 'food', wildlifeSpecies: 'bellweather-sheep',
  stock: 100, x: -4.5, z: -3.5 };
const current = { ...authored, x: 4.5, z: 3.5, wildlifeState: 'alive', wildlifeTeam: null,
  wildlifeHeading: 0, wildlifeActivity: 'idle' };
const map = { id: 'placement-sheep-map', width: 16, height: 16, fogOfWar: true,
  obstacles: [], triggers: [], resourceNodes: [authored] };
const cell = point => ({ column: Math.floor(point.x + 8), row: Math.floor(point.z + 8) });
function fixture(team) {
  const fog = new Uint8Array(256).fill(2);
  const context = vm.createContext({ ...economyClientBindings(), ...wildlifeClientBindings(),
    BUILDING_DEFINITIONS, previewWallPlacement, localTeam: team, mapDefinition: map,
    MAP_WIDTH: 16, MAP_HEIGHT: 16, MAP_HALF_X: 8, MAP_HALF_Z: 8, latestFogCells: fog,
    latestForestStocks: new Map(), latestResourceStocks: new Map([[authored.id, 100]]),
    latestBuildings: [], resourceNodeVisuals: new Map(), latestWood: [250, 250], latestFood: [150, 150],
    selected: new Set(), selectedBuildingId: null, units: [{ id: 0, team, kind: 'worker', hp: 40 }],
    teamUnits: [[], []], selectedIds: () => [0], buildPlacementType: 'house', cursorShift: false,
    buildingFootprint: type => BUILDING_DEFINITIONS[type].footprint,
    buildingWoodCost: type => BUILDING_DEFINITIONS[type].cost.wood, formatResourceRequirement: String,
    worldAt: () => context.pointerPoint, wildlifeRenderer: { reconcile() {} },
    attackMoveMode: false, persistentTargetMode: null, tapOrderArmed: false, tapOrderPointer: null,
  });
  vm.runInContext(wildlifeClientFunctionSource() + fn('buildPlacementAt') + fn('wallPlacementAt'), context);
  return { context, fog,
    disclose(rows, epoch = 7) {
      context.applyWildlifeState({ mapId: map.id, forestEpoch: epoch, resourceNodes: rows });
      for (const row of rows) if (context.latestWildlifeView?.rows.has(row.id)) context.latestResourceStocks.set(row.id, row.stock);
    },
    building(point) { context.pointerPoint = point; return context.buildPlacementAt(0, 0); },
    wall(point) { return context.wallPlacementAt([cell(point)]); },
  };
}

for (const team of [0, 1]) test(`seat ${team}: building and wall previews reserve actual food, then preserve its last disclosed location through fog`, () => {
  const f = fixture(team);
  assert.equal(f.building(authored).blockedReason, 'RESOURCE IN THIS SITE', 'unknown food remains conservatively authored');
  f.disclose([{ ...current, wildlifeTeam: 1 - team }]);
  assert.equal(f.building(authored).valid, true, 'relocated food releases the vacated site');
  assert.equal(f.wall(authored).valid, true);
  assert.equal(f.building(current).blockedReason, 'RESOURCE IN THIS SITE');
  assert.equal(f.wall(current).blockedReason, 'RESOURCE IN THIS LINE');
  f.fog.fill(0);
  f.disclose([{ ...current, x: 6.5, z: 5.5 }]);
  assert.equal(f.context.latestWildlifeView.rows.size, 0, 'a hidden row cannot provide new position knowledge');
  assert.equal(f.building(current).blockedReason, 'RESOURCE IN THIS SITE');
  f.disclose([]);
  assert.equal(f.wall(current).blockedReason, 'RESOURCE IN THIS LINE', 'omission cannot free unknown positive food');
});

for (const team of [0, 1]) test(`seat ${team}: exact disclosed depletion releases both previews; epoch change clears remembered relocation`, () => {
  const f = fixture(team); f.disclose([current]);
  const depleted = { ...current, stock: 0, wildlifeState: 'depleted' }; delete depleted.wildlifeActivity;
  f.disclose([depleted]);
  assert.equal(f.building(current).valid, true); assert.equal(f.wall(current).valid, true);
  // Actual forest/resource receipt restores stock on epoch change; this fixture
  // isolates the position consumer while the socket/rematch harness proves receipt.
  f.context.latestResourceStocks.set(authored.id, authored.stock); f.disclose([], 8);
  assert.equal(f.context.wildlifePositionMemory.positions.size, 0);
  assert.equal(f.building(authored).blockedReason, 'RESOURCE IN THIS SITE');
  assert.equal(f.building(current).valid, true);
});
