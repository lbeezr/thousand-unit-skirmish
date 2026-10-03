import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { settlementGround } from '../src/settlement-authoring.mjs';
import { townCenterFootprintCells } from '../src/town-center-spawn.mjs';
import { seededMirroredResourceClusters } from '../src/resource-cluster-authoring.mjs';
import { seedMillraceSheep } from '../src/millrace-sheep.mjs';
const paintGrid = map => {
  const cells = Array(map.width * map.height).fill(map.terrainBase);
  for (const rect of map.terrainPatches) for (let row = rect.row; row < rect.row + rect.height; row++) {
    for (let col = rect.column; col < rect.column + rect.width; col++) cells[row * map.width + col] = rect.material;
  }
  return cells;
};
const baseline = JSON.parse(await readFile('scripts/fixtures/settlement-ground-baseline.json', 'utf8'));
// The settlement snapshot predates the reviewed glade adoption (3405588).
// Keep its ground/rule contract, but pin Rootways blockers to that approved layout.
const glades = JSON.parse(await readFile('docs/qa-evidence/underbough-wide-glades-2026-10-01/candidate.json', 'utf8'));
for (const id of ['bellweather-millrace', 'underbough-rootways']) {
  const map = JSON.parse(await readFile(`maps/${id}.json`, 'utf8'));
  const before = baseline.maps[id];
  const input = JSON.stringify(before), patches = settlementGround(before);
  assert.equal(JSON.stringify(before), input, 'settlement paint never mutates input rules');
  assert.deepEqual(patches, settlementGround(before), 'settlement wear is deterministic');
  const settlementPaint = id === 'underbough-rootways' ? map.terrainPatches.filter(p => p.material !== 'long-grass') : map.terrainPatches;
  assert.deepEqual(patches, settlementPaint, 'woodland ground preserves the historical settlement paint');
  for (const key of Object.keys(before).filter(key => key !== 'terrainPatches' && key !== 'terrainBase')) {
    const expected = id === 'underbough-rootways' && key === 'obstacles' ? glades.obstacles
      : id === 'bellweather-millrace' && key === 'resourceNodes' ? seedMillraceSheep(seededMirroredResourceClusters({ ...before, terrainPatches: patches })) : before[key];
    assert.deepEqual(map[key], expected, `${key}: preserve historical settlement rules and approved layout`);
  }
  assert.equal(map.terrainBase, id === 'underbough-rootways' ? 'meadow' : before.terrainBase, 'authored clearing material is explicit');
  const oldPaint = paintGrid({...before, terrainBase:map.terrainBase}), newPaint = paintGrid(map);
  const blocked = new Set();
  for (const rect of map.obstacles) for (let row = rect.row; row < rect.row + rect.height; row++) for (let col = rect.column; col < rect.column + rect.width; col++) blocked.add(row * map.width + col);
  assert.ok(newPaint.filter((material, cell) => material !== oldPaint[cell]).length > 20, 'real hall pads and working tracks are added');
  if (id === 'underbough-rootways') {
    assert.deepEqual(map.terrainPatches.filter(p => p.material === 'long-grass'), glades.terrainPatches.filter(p => p.material === 'long-grass'),
      'glade adoption retains the reviewed woodland-margin paint');
    // Glades relocated forest after the margin paint was authored; that pass
    // deliberately retained ground patches. Check its original forest boundary.
    const wooded = before.obstacles.filter(r => r.material === 'forest').flatMap(r =>
      Array.from({length:r.width*r.height}, (_, index) => (r.row + Math.floor(index/r.width))*map.width + r.column + index%r.width));
    const dense = newPaint.map((material, cell) => material === 'long-grass' ? cell : -1).filter(cell => cell >= 0);
    assert.ok(dense.length > 0, 'authored woodland margins are visible');
    for (const cell of dense) {
      assert.equal(oldPaint[cell], 'meadow', 'dense growth preserves previously authored clearings and paths');
      assert.ok(wooded.some(tree => Math.hypot(cell % map.width - tree % map.width, Math.floor(cell/map.width) - Math.floor(tree/map.width)) <= 2.25), 'dense growth follows woodland edges at margin-paint adoption');
    }
  }
  const wearPaint = paintGrid({...map, terrainPatches:settlementPaint});
  for (const cell of blocked) assert.equal(wearPaint[cell], oldPaint[cell], 'settlement wear does not suggest a path through blockers');
  for (let team = 0; team < 2; team++) for (const cell of townCenterFootprintCells(map.spawnPoints, team, map.width, map.height)) assert.equal(newPaint[cell], 'dirt', 'wear grounds the real Town Center footprint');
  for (let row = 0; row < map.height; row++) for (let col = 0; col < map.width / 2; col++) assert.equal(newPaint[row * map.width + col], newPaint[row * map.width + map.width - 1 - col]);
}
console.log('Settlement ground: Town Center pads, mirrored working tracks, no blocked-path paint, approved Millrace clusters and preserved other rules passed.');
