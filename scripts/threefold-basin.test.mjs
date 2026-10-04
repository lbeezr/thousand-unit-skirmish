import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { generateThreefoldBasin, SMALL_LAYOUT } from './generate-threefold-basin.mjs';
import { auditMap, searchGrid } from './map-scale-audit.mjs';
import { buildElevationGrid } from '../src/map-utils.mjs';
import { townCenterFootprintCells } from '../src/town-center-spawn.mjs';

const map = JSON.parse(await readFile(new URL('../maps/veyrholds-threefold-basin.json', import.meta.url)));
const levels = buildElevationGrid(192, 192, map.elevationPatches), blocked = new Uint8Array(192 * 192);
for (const o of map.obstacles) for (let y = o.row; y < o.row + o.height; y++) for (let x = o.column; x < o.column + o.width; x++) {
  assert.equal(blocked[y * 192 + x], 0); blocked[y * 192 + x] = 1;
}
const scenery = blocked.slice();
for (const team of [0, 1]) for (const c of townCenterFootprintCells(map.spawnPoints, team, 192, 192)) blocked[c] = 1;
const cell = p => Math.floor(p.z + 96) * 192 + Math.floor(p.x + 96);
const audit = auditMap(map, { forestWoodPerCell: 6, defaultArmySize: 24, maxBuildings: 128 });

test('Small is deterministic with ordinary opening, elimination, fog and existing audio', async () => {
  assert.deepEqual(await generateThreefoldBasin(), map);
  assert.deepEqual([map.width, map.height, map.startingArmySize], [192, 192, 24]);
  assert.deepEqual(map.startingResources, { food: 150, wood: 250 });
  assert.equal(map.fogOfWar, true); assert.match(map.summary, /^Small · 192/);
  assert.equal(map.scenarioEvents.length, 0); assert.ok(map.triggers.every(t => t.victory === false));
  assert.equal(map.timedVictory, undefined); assert.equal(map.victoryHoldSeconds, undefined);
  const tiny = JSON.parse(await readFile(new URL('../maps/veyrholds-terraced-vale.json', import.meta.url)));
  assert.deepEqual(map.audio, tiny.audio);
});

test('expanded playable land is connected; base pacing is 60–75 seconds after forest cutting too', () => {
  assert.equal(audit.geometry.initialWalkableCells, 32798);
  assert.deepEqual(audit.geometry.reachableCellsBySeat, [32798, 32798]);
  assert.equal(audit.travel.minimumElevationCostRoute.worldLength, 157);
  assert.equal(audit.travel.allForestClearedRoute.worldLength, 157);
  assert.ok(audit.travel.minimumElevationCostRoute.nominalTravelSeconds.worker >= 60);
  assert.ok(audit.travel.minimumElevationCostRoute.nominalTravelSeconds.worker <= 75);
});

test('two valley passes, southern causeway and northern high flank provide complete independent alternatives', () => {
  for (const [strip, expected] of [...SMALL_LAYOUT.crossings.map((r, i) => [r, i < 2 ? 157 : 239]), [SMALL_LAYOUT.flank, 245]]) {
    const mask = blocked.slice();
    for (let y = 0; y < 192; y++) if (y < strip[0] || y > strip[1]) mask[y * 192 + 95] = 1;
    assert.equal(searchGrid(192, 192, mask, levels, cell(map.spawnPoints[0]), false).distance[cell(map.spawnPoints[1])], expected);
  }
  assert.equal(levels[152 * 192 + 95], 1, 'causeway is raised');
  assert.equal(levels[80 * 192 + 95], 0, 'north pass stays in the valley');
});

test('both home campuses fit the developed-city template and three flat expansion rings', () => {
  for (const [cx, cy] of SMALL_LAYOUT.homes) for (let y = cy - 22; y <= cy + 22; y++) for (let x = cx - 22; x <= cx + 22; x++) {
    assert.equal(scenery[y * 192 + x], 0); assert.equal(levels[y * 192 + x], 1);
  }
  assert.deepEqual(audit.buildingSpace.cityTemplate.staticGreedyFlatPadFitsBySeat.map(s => s.placedBuildings), [30, 30]);
  const nodes = new Set(map.resourceNodes.map(cell));
  for (const [cx, cy] of SMALL_LAYOUT.expansions) for (let y = cy - 4; y <= cy + 4; y++) for (let x = cx - 4; x <= cx + 4; x++) {
    const c = y * 192 + x;
    assert.equal(blocked[c], 0); assert.equal(nodes.has(c), false); assert.equal(levels[c], levels[cy * 192 + cx]);
  }
});

test('resource stock and access are mirrored, with three useful progressively farther pockets per seat', () => {
  for (let y = 0; y < 192; y++) for (let x = 0; x < 96; x++) {
    assert.equal(scenery[y * 192 + x], scenery[y * 192 + 191 - x]);
    assert.equal(levels[y * 192 + x], levels[y * 192 + 191 - x]);
  }
  assert.deepEqual(audit.economy.ordinaryNodeStockTotals, { food: 9700, wood: 11950 });
  const expected = [12, 12, 55, 67, 80, 92, 114, 126];
  for (const [i, node] of audit.economy.resources.filter(r => r.id.startsWith('s0-')).entries()) {
    const mirror = audit.economy.resources.find(r => r.id === node.id.replace('s0-', 's1-'));
    assert.equal(node.stock, mirror.stock);
    assert.deepEqual(node.shortestCostRouteWorldLengths, [...mirror.shortestCostRouteWorldLengths].reverse());
    assert.equal(node.shortestCostRouteWorldLengths[0], expected[i]);
  }
});
