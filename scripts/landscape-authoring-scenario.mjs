import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { landscapeRectangles, shapeRegionalLandscape } from '../src/landscape-authoring.mjs';

function grid(rectangles, width, height) {
  const cells = Array(width * height).fill(null);
  for (const rect of rectangles) {
    assert.ok(rect.column >= 0 && rect.row >= 0 && rect.width > 0 && rect.height > 0);
    assert.ok(rect.column + rect.width <= width && rect.row + rect.height <= height);
    for (let y = rect.row; y < rect.row + rect.height; y++) for (let x = rect.column; x < rect.column + rect.width; x++) {
      const cell = y * width + x;
      assert.equal(cells[cell], null, 'compiled rectangles must not overlap');
      cells[cell] = rect.material;
    }
  }
  return cells;
}
const sample = { width: 80, height: 72, terrainSeed: 93000,
  obstacles: [{ column: 8, row: 4, width: 8, height: 8, material: 'forest' },
    { column: 64, row: 4, width: 8, height: 8, material: 'forest' }],
  terrainPatches: [{ column: 0, row: 32, width: 80, height: 8, material: 'dirt' }] };
const original = JSON.stringify(sample);
const shaped = shapeRegionalLandscape(sample);
assert.equal(JSON.stringify(sample), original);
assert.deepEqual(shaped, shapeRegionalLandscape(sample), 'same seed reproduces the landscape');
assert.notDeepEqual(shaped.obstacles, shapeRegionalLandscape({ ...sample, terrainSeed: 93001 }).obstacles);
const before = grid(sample.obstacles, 80, 72), after = grid(shaped.obstacles, 80, 72);
assert.ok(after.filter(Boolean).length < before.filter(Boolean).length, 'groves lose rectangular corners');
assert.ok(after.filter(Boolean).length > before.filter(Boolean).length * 0.5, 'groves retain their dense core');
after.forEach((material, cell) => { if (material) assert.equal(material, before[cell], 'feature stays within its tactical envelope'); });
assert.deepEqual(grid(landscapeRectangles(80, 72, (x, y) => after[Math.floor(y) * 80 + Math.floor(x)]), 80, 72), after);
assert.deepEqual(landscapeRectangles(4, 4, () => 'forest'), [{ column: 0, row: 0, width: 4, height: 4, material: 'forest' }]);

let count = 0;
for (const file of await readdir('maps')) {
  const map = JSON.parse(await readFile(`maps/${file}`, 'utf8'));
  if (!map.region) continue;
  for (const rectangles of [map.obstacles, map.terrainPatches]) {
    assert.ok(rectangles.length < 4096, `${file}: portable rectangle budget`);
    const cells = grid(rectangles, map.width, map.height);
    for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width / 2; x++) {
      assert.equal(cells[y * map.width + x], cells[y * map.width + map.width - 1 - x], `${file}: equal seat footprints`);
    }
  }
  assert.ok(Buffer.byteLength(JSON.stringify(map)) < 900000);
  count++;
}
console.log(`${count} regional landscapes: reproducible shapes, nonoverlapping portable rectangles, equal seat footprints and bounded feature envelopes passed.`);
