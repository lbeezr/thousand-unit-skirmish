import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { generateRivenEscarpment, MEDIUM_LAYOUT } from './generate-riven-escarpment.mjs';
import { auditMap, searchGrid } from './map-scale-audit.mjs';
import { buildElevationGrid, validateElevationPatches } from '../src/map-utils.mjs';
import { townCenterFootprintCells } from '../src/town-center-spawn.mjs';

const map = JSON.parse(await readFile(new URL('../maps/veyrholds-riven-escarpment.json', import.meta.url)));
const side = 224, levels = buildElevationGrid(side, side, map.elevationPatches), scenery = new Uint8Array(side * side);
for (const o of map.obstacles) for (let y = o.row; y < o.row + o.height; y++) for (let x = o.column; x < o.column + o.width; x++) {
  assert.equal(scenery[y * side + x], 0); scenery[y * side + x] = 1;
}
const blocked = scenery.slice();
for (const team of [0, 1]) for (const c of townCenterFootprintCells(map.spawnPoints, team, side, side)) blocked[c] = 1;
const cell = p => Math.floor(p.z + 112) * side + Math.floor(p.x + 112);
const audit = auditMap(map, { forestWoodPerCell: 6, defaultArmySize: 24, maxBuildings: 128 });

test('Medium authoring is deterministic, admitted in size and retains ordinary economy/fog/elimination', async () => {
  assert.deepEqual(await generateRivenEscarpment(), map);
  assert.deepEqual([map.width, map.height, map.startingArmySize], [224, 224, 24]);
  assert.deepEqual(map.startingResources, { food: 150, wood: 250 });
  assert.equal(map.fogOfWar, true); assert.match(map.summary, /^Medium · 224/);
  assert.equal(map.economyProfileId, undefined);
  assert.deepEqual([map.triggers, map.scenarioEvents], [[], []]);
  assert.equal(map.timedVictory, undefined); assert.equal(map.victoryHoldSeconds, undefined);
  assert.equal(validateElevationPatches(side, side, map.elevationPatches), null);
  const small = JSON.parse(await readFile(new URL('../maps/veyrholds-threefold-basin.json', import.meta.url)));
  assert.deepEqual(map.audio, small.audio);
});

test('all usable land and raised ridge tops connect; base pacing stays 75–90 seconds after forest clearing', () => {
  assert.equal(audit.geometry.initialWalkableCells, 43734);
  assert.deepEqual(audit.geometry.reachableCellsBySeat, [43734, 43734]);
  assert.equal(audit.travel.minimumElevationCostRoute.worldLength, 207);
  assert.equal(audit.travel.allForestClearedRoute.worldLength, 207);
  assert.deepEqual(audit.travel.minimumElevationCostRoute.nominalTravelSeconds, { worker: 79.615, infantry: 79.615, scout: 46 });
  assert.deepEqual([levels[112 * side + 75], levels[112 * side + 84], levels[112 * side + 88], levels[112 * side + 111]], [1, 1, 2, 0]);
});

test('two 18-row low passes, southern causeway and northern high route are complete forced alternatives', () => {
  for (const [strip, expected] of [...MEDIUM_LAYOUT.crossings.map((r, i) => [r, i < 2 ? 207 : 301]), [MEDIUM_LAYOUT.flank, 319]]) {
    const mask = blocked.slice();
    for (let y = 0; y < side; y++) if (y < strip[0] || y > strip[1]) {
      for (const x of MEDIUM_LAYOUT.ridgeColumns) mask[y * side + x] = 1;
    }
    assert.equal(searchGrid(side, side, mask, levels, cell(map.spawnPoints[0]), false).distance[cell(map.spawnPoints[1])], expected);
  }
  assert.deepEqual([levels[87 * side + 88], levels[137 * side + 88], levels[185 * side + 88], levels[32 * side + 88]], [0, 0, 1, 1]);
});

test('flat 49-square home campuses fit both city templates; all six expansions reserve flat resource-free 11-square rings', () => {
  for (const [cx, cy] of MEDIUM_LAYOUT.homes) for (let y = cy - 24; y <= cy + 24; y++) for (let x = cx - 24; x <= cx + 24; x++) {
    assert.equal(scenery[y * side + x], 0); assert.equal(levels[y * side + x], 1);
  }
  assert.deepEqual(audit.buildingSpace.cityTemplate.staticGreedyFlatPadFitsBySeat.map(s => s.placedBuildings), [30, 30]);
  const nodes = new Set(map.resourceNodes.map(cell));
  for (const [cx, cy] of MEDIUM_LAYOUT.expansions) for (let y = cy - 5; y <= cy + 5; y++) for (let x = cx - 5; x <= cx + 5; x++) {
    const c = y * side + x;
    assert.equal(blocked[c], 0); assert.equal(nodes.has(c), false); assert.equal(levels[c], levels[cy * side + cx]);
  }
});

test('terrain and paired economic access mirror; three progressively farther pockets have explicit finite stock', () => {
  for (let y = 0; y < side; y++) for (let x = 0; x < side / 2; x++) {
    assert.equal(scenery[y * side + x], scenery[y * side + side - 1 - x]);
    assert.equal(levels[y * side + x], levels[y * side + side - 1 - x]);
  }
  assert.deepEqual(audit.economy.ordinaryNodeStockTotals, { food: 12100, wood: 14950 });
  assert.equal(audit.economy.initialForestWoodPotential, 38460);
  const expected = [12, 12, 71, 87, 81, 97, 113, 129];
  for (const [i, node] of audit.economy.resources.filter(r => r.id.startsWith('s0-')).entries()) {
    const mirror = audit.economy.resources.find(r => r.id === node.id.replace('s0-', 's1-'));
    assert.equal(node.stock, mirror.stock);
    assert.deepEqual(node.shortestCostRouteWorldLengths, [...mirror.shortestCostRouteWorldLengths].reverse());
    assert.equal(node.shortestCostRouteWorldLengths[0], expected[i]);
  }
  for (const [cx, cy] of MEDIUM_LAYOUT.expansions) {
    const ownNodes = map.resourceNodes.filter(n => Math.abs(n.x + 111.5 - cx) === 8 && n.z + 111.5 === cy);
    assert.equal(ownNodes.length, 2);
    assert.ok(ownNodes.every(n => levels[cell(n)] === levels[cy * side + cx]));
  }
});
