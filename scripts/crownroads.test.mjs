import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { generateCrownroads, LARGE_LAYOUT as layout } from './generate-crownroads.mjs';
import { auditMap, searchGrid } from './map-scale-audit.mjs';
import { buildElevationGrid, validateElevationPatches } from '../src/map-utils.mjs';
import { townCenterFootprintCells } from '../src/town-center-spawn.mjs';

const map = JSON.parse(await readFile(new URL('../maps/veyrholds-crownroads.json', import.meta.url)));
const side = 256, levels = buildElevationGrid(side, side, map.elevationPatches), scenery = new Uint8Array(side * side);
for (const o of map.obstacles) for (let y = o.row; y < o.row + o.height; y++) for (let x = o.column; x < o.column + o.width; x++) {
  assert.equal(scenery[y * side + x], 0); scenery[y * side + x] = 1;
}
const blocked = scenery.slice();
for (const team of [0, 1]) for (const c of townCenterFootprintCells(map.spawnPoints, team, side, side)) blocked[c] = 1;
const cell = p => Math.floor(p.z + 128) * side + Math.floor(p.x + 128);
const audit = auditMap(map, { forestWoodPerCell: 6, defaultArmySize: 24, maxBuildings: 128 });

test('Large authoring is deterministic and preserves normal opening, fog and authored elimination', async () => {
  assert.deepEqual(await generateCrownroads(), map);
  assert.deepEqual([map.width, map.height, map.startingArmySize], [256, 256, 24]);
  assert.deepEqual(map.startingResources, { food: 150, wood: 250 });
  assert.equal(map.fogOfWar, true); assert.match(map.summary, /^Large · 256/);
  assert.ok(map.summary.length <= 120); assert.equal(map.economyProfileId, undefined);
  assert.deepEqual([map.triggers, map.scenarioEvents], [[], []]);
  assert.equal(map.timedVictory, undefined); assert.equal(map.victoryHoldSeconds, undefined);
  assert.equal(validateElevationPatches(side, side, map.elevationPatches), null);
});

test('all usable cells and ridge tops connect; clearing forests preserves the 90–105-second base pacing', () => {
  assert.equal(audit.geometry.initialWalkableCells, 57278);
  assert.deepEqual(audit.geometry.reachableCellsBySeat, [57278, 57278]);
  assert.equal(audit.travel.minimumElevationCostRoute.worldLength, 251);
  assert.equal(audit.travel.allForestClearedRoute.worldLength, 251);
  assert.deepEqual(audit.travel.minimumElevationCostRoute.nominalTravelSeconds, { worker: 96.538, infantry: 96.538, scout: 55.778 });
  assert.deepEqual([levels[128 * side + 87], levels[128 * side + 97], levels[128 * side + 101], levels[128 * side + 127]], [1, 1, 2, 0]);
});

test('two 20-row low passes, 20-row causeway and 16-row northern route remain complete forced alternatives', () => {
  for (const [strip, expected] of [...layout.crossings.map((r, i) => [r, i < 2 ? 251 : 369]), [layout.flank, 379]]) {
    const mask = blocked.slice();
    for (let y = 0; y < side; y++) if (y < strip[0] || y > strip[1]) {
      for (const x of layout.ridgeColumns) mask[y * side + x] = 1;
    }
    assert.equal(searchGrid(side, side, mask, levels, cell(map.spawnPoints[0]), false).distance[cell(map.spawnPoints[1])], expected);
  }
});

test('flat 53-square home campuses fit the city template; eight sites reserve flat resource-free 11-square rings', () => {
  for (const [cx, cy] of layout.homes) for (let y = cy - 26; y <= cy + 26; y++) for (let x = cx - 26; x <= cx + 26; x++) {
    assert.equal(scenery[y * side + x], 0); assert.equal(levels[y * side + x], 1);
  }
  assert.deepEqual(audit.buildingSpace.cityTemplate.staticGreedyFlatPadFitsBySeat.map(s => s.placedBuildings), [30, 30]);
  const nodes = new Set(map.resourceNodes.map(cell));
  for (const [left, cy, level] of layout.sites) for (const cx of [left, 255 - left]) {
    for (let y = cy - 9; y <= cy + 9; y++) for (let x = cx - 9; x <= cx + 9; x++) assert.equal(levels[y * side + x], level);
    for (let y = cy - 5; y <= cy + 5; y++) for (let x = cx - 5; x <= cx + 5; x++) {
      assert.equal(blocked[y * side + x], 0); assert.equal(nodes.has(y * side + x), false);
    }
  }
});

test('paired access and terrain mirror; the four sites have deliberate finite stock and distinct routes', () => {
  for (let y = 0; y < side; y++) for (let x = 0; x < side / 2; x++) {
    assert.equal(scenery[y * side + x], scenery[y * side + side - 1 - x]);
    assert.equal(levels[y * side + x], levels[y * side + side - 1 - x]);
  }
  assert.deepEqual(audit.economy.ordinaryNodeStockTotals, { food: 19700, wood: 24150 });
  assert.equal(audit.economy.initialForestWoodPotential, 49356);
  const expected = [12, 12, 72, 88, 140, 156, 99, 115, 134, 144];
  for (const [i, node] of audit.economy.resources.filter(r => r.id.startsWith('s0-')).entries()) {
    const mirror = audit.economy.resources.find(r => r.id === node.id.replace('s0-', 's1-'));
    assert.equal(node.stock, mirror.stock);
    assert.deepEqual(node.shortestCostRouteWorldLengths, [...mirror.shortestCostRouteWorldLengths].reverse());
    assert.equal(node.shortestCostRouteWorldLengths[0], expected[i]);
  }
  for (const [cx, cy, level] of layout.sites) {
    const ownNodes = map.resourceNodes.filter(n => Math.abs(n.x + 127.5 - cx) === 8 && n.z + 127.5 === cy);
    assert.equal(ownNodes.length, 2); assert.ok(ownNodes.every(n => levels[cell(n)] === level));
  }
});
