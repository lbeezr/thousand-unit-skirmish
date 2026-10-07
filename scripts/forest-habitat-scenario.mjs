import assert from 'node:assert/strict';
import { forestHabitatDepth, forestCanopyFactor } from '../src/presentation/rendering/forest/habitat.mjs';
const map = { width: 9, height: 9, obstacles: [{ column: 1, row: 1, width: 7, height: 7, material: 'forest' }] };
const original = JSON.stringify(map);
const depth = forestHabitatDepth(map);
assert.equal(depth[4 * 9 + 4], 4);
assert.equal(depth[1 * 9 + 4], 1);
assert.equal(depth[2 * 9 + 4], 2);
assert.equal(depth[0], 0);
assert.ok(forestCanopyFactor(1) < forestCanopyFactor(2));
assert.ok(forestCanopyFactor(2) < forestCanopyFactor(4));
assert.equal(JSON.stringify(map), original, 'habitat presentation never changes wood stock or blockers');
const rows = { ...map, obstacles: Array.from({ length: 7 }, (_, i) => ({ column: 1, row: 1 + i, width: 7, height: 1, material: 'forest' })) };
assert.deepEqual(depth, forestHabitatDepth(rows), 'rectangle compression does not create artificial woodland edges');
const hole = { ...rows, obstacles: rows.obstacles.filter(rect => rect.row !== 4) };
assert.equal(forestHabitatDepth(hole)[3 * 9 + 4], 1, 'internal glades receive a real margin');
assert.equal(forestCanopyFactor(forestHabitatDepth({ width: 4, height: 4, obstacles: [{ column: 0, row: 0, width: 4, height: 4, material: 'forest' }] })[5]), 1,
  'woodland continuing past the map edge retains its canopy core');
console.log('Forest habitat: graduated core/margin, glades, map edges, compression independence and unchanged authoritative cells passed.');
