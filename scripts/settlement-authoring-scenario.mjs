import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { settlementGround } from '../src/settlement-authoring.mjs';
import { townCenterFootprintCells } from '../src/town-center-spawn.mjs';
const paintGrid = map => {
  const cells = Array(map.width * map.height).fill(map.terrainBase);
  for (const rect of map.terrainPatches) for (let row = rect.row; row < rect.row + rect.height; row++) {
    for (let col = rect.column; col < rect.column + rect.width; col++) cells[row * map.width + col] = rect.material;
  }
  return cells;
};
const baseline = JSON.parse(await readFile('scripts/fixtures/settlement-ground-baseline.json', 'utf8'));
for (const id of ['bellweather-millrace', 'underbough-rootways']) {
  const map = JSON.parse(await readFile(`maps/${id}.json`, 'utf8'));
  const before = baseline.maps[id];
  const input = JSON.stringify(before), patches = settlementGround(before);
  assert.equal(JSON.stringify(before), input, 'settlement paint never mutates input rules');
  assert.deepEqual(patches, settlementGround(before), 'settlement wear is deterministic');
  const settlementPaint = id === 'underbough-rootways' ? map.terrainPatches.filter(p => p.material !== 'long-grass') : map.terrainPatches;
  assert.deepEqual(patches, settlementPaint, 'woodland ground preserves the historical settlement paint');
  for (const key of Object.keys(before).filter(key => key !== 'terrainPatches' && key !== 'terrainBase')) assert.deepEqual(map[key], before[key], `${key}: visual paint must not change match rules`);
  assert.equal(map.terrainBase, id === 'underbough-rootways' ? 'meadow' : before.terrainBase, 'authored clearing material is explicit');
  const oldPaint = paintGrid({...before, terrainBase:map.terrainBase}), newPaint = paintGrid(map);
  const blocked = new Set();
  for (const rect of map.obstacles) for (let row = rect.row; row < rect.row + rect.height; row++) for (let col = rect.column; col < rect.column + rect.width; col++) blocked.add(row * map.width + col);
  assert.ok(newPaint.filter((material, cell) => material !== oldPaint[cell]).length > 20, 'real hall pads and working tracks are added');
  if (id === 'underbough-rootways') {
    const wooded = [...blocked].filter(cell => map.obstacles.some(r => r.material === 'forest' && cell % map.width >= r.column && cell % map.width < r.column+r.width && Math.floor(cell/map.width) >= r.row && Math.floor(cell/map.width) < r.row+r.height));
    const dense = newPaint.map((material, cell) => material === 'long-grass' ? cell : -1).filter(cell => cell >= 0);
    assert.ok(dense.length > 0, 'authored woodland margins are visible');
    for (const cell of dense) {
      assert.equal(oldPaint[cell], 'meadow', 'dense growth preserves previously authored clearings and paths');
      assert.ok(wooded.some(tree => Math.hypot(cell % map.width - tree % map.width, Math.floor(cell/map.width) - Math.floor(tree/map.width)) <= 2.25), 'dense growth follows woodland edges');
    }
  }
  for (const cell of blocked) assert.equal(newPaint[cell], oldPaint[cell], 'wear does not suggest a path through blockers');
  for (let team = 0; team < 2; team++) for (const cell of townCenterFootprintCells(map.spawnPoints, team, map.width, map.height)) assert.equal(newPaint[cell], 'dirt', 'wear grounds the real Town Center footprint');
  for (let row = 0; row < map.height; row++) for (let col = 0; col < map.width / 2; col++) assert.equal(newPaint[row * map.width + col], newPaint[row * map.width + map.width - 1 - col]);
}
console.log('Settlement ground: real Town Center pads, working tracks, deterministic mirrored paint, no blocked-path paint and unchanged match rules passed.');
