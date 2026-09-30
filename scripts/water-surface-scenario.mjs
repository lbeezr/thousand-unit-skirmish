import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildWaterSurfaceGeometry } from '../src/water-surface-geometry.mjs';

const map = {
  width: 4,
  height: 4,
  terrainBase: 'meadow',
  terrainPatches: [{ column: 0, row: 1, width: 1, height: 1, material: 'sand' }],
  obstacles: [{ column: 1, row: 1, width: 2, height: 1, material: 'water' }],
};
const original = JSON.stringify(map);
const water = buildWaterSurfaceGeometry(map);
assert.ok(water, 'a map with blocked water cells should produce a water surface');
assert.equal(water.userData.waterCellCount, 2, 'a 2-cell stream should create one batched surface');
assert.equal(water.userData.shorelineEdgeCount, 6, 'the connected 2-cell stream should expose only its six outer land edges');
assert.equal(water.userData.sandyShorelineEdgeCount, 1, 'sand-adjacent shoreline should receive the warm shallows treatment');
assert.ok(water.getIndex().count > (2 + 6) * 6, 'beveled water polygons and contour shore bands share one geometry');
const positions = water.getAttribute('position');
assert.ok(Array.from({ length: positions.count }, (_, i) => positions.getX(i)).some(x => Math.abs(x + 0.55) < 1e-5),
  'exposed water corners are clipped to a sub-cell diagonal rather than a square');
for (let i = 0; i < positions.count; i++) {
  assert.ok(positions.getX(i) >= -1 && positions.getX(i) <= 1);
  assert.ok(positions.getZ(i) >= -1 && positions.getZ(i) <= 0, 'shore geometry stays inside the blocked-water envelope');
}
assert.equal(JSON.stringify(map), original, 'surface creation must not change map obstacle or passability data');

assert.equal(buildWaterSurfaceGeometry({
  width: 2, height: 2, terrainBase: 'meadow', obstacles: [{ column: 0, row: 0, width: 1, height: 1, material: 'forest' }],
}), null, 'maps without water should not create an empty water surface');

const boundaryWater = buildWaterSurfaceGeometry({
  width: 2, height: 2, terrainBase: 'meadow',
  obstacles: [{ column: 0, row: 0, width: 1, height: 1, material: 'water' }],
});
assert.equal(boundaryWater.userData.shorelineEdgeCount, 2,
  'map-boundary edges should stay open while interior land edges receive shore bands');

const forkedVale = JSON.parse(readFileSync(new URL('../maps/forked-vale.json', import.meta.url), 'utf8'));
const forkedValeWater = buildWaterSurfaceGeometry(forkedVale);
const expectedForkedValeWaterCells = forkedVale.obstacles
  .filter((obstacle) => obstacle.material === 'water')
  .reduce((count, obstacle) => count + obstacle.width * obstacle.height, 0);
assert.equal(forkedValeWater.userData.waterCellCount, expectedForkedValeWaterCells,
  'Forked Vale streams should retain the existing blocked-water footprint');
assert.ok(forkedValeWater.userData.shorelineEdgeCount > 0,
  'Forked Vale streams should expose connected shore edges');

process.stdout.write('Water surface scenario passed: blocked cells form a batched surface, connected shores, and sand-aware shallows on Forked Vale.\n');
