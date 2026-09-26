import assert from 'node:assert/strict';
import {
  mapMirroredAtlasUv,
  mirrorRepeatCoordinate,
  tessellateMirroredAtlasQuad,
} from '../src/painted-material-atlas.mjs';

assert.equal(mirrorRepeatCoordinate(0.25), 0.25);
assert.equal(mirrorRepeatCoordinate(1.25), 0.75);
assert.equal(mirrorRepeatCoordinate(2.25), 0.25);
assert.equal(mirrorRepeatCoordinate(-0.25), 0.25);
assert.equal(mirrorRepeatCoordinate(-1.25), 0.75);

const uvRectTopLeft = {
  min: { u: 0.1, v: 0.2 },
  max: { u: 0.4, v: 0.5 },
};
assert.deepEqual(mapMirroredAtlasUv(0, 0, uvRectTopLeft), [0.1, 0.5]);
assert.deepEqual(mapMirroredAtlasUv(1, 1, uvRectTopLeft), [0.4, 0.8]);
assert.deepEqual(mapMirroredAtlasUv(2, 2, uvRectTopLeft), [0.1, 0.5]);
assert.deepEqual(mapMirroredAtlasUv(-1, -1, uvRectTopLeft), [0.4, 0.8]);

const patch = tessellateMirroredAtlasQuad({
  x0: 0, z0: 0, x1: 24, z1: 14, y: -0.019,
  u0: 0.25, v0: 0.2, u1: 2.25, v1: 1.4,
  uvRectTopLeft,
  alpha: [0, 1, 0.25, 0.75],
});
assert.equal(patch.quadCount, 6, 'a 2 by 1.2 UV region crosses three by two repeat tiles');
assert.equal(patch.vertices.length, 6 * 4 * 3);
assert.equal(patch.uvs.length, 6 * 4 * 2);
assert.equal(patch.colors.length, 6 * 4 * 4);
assert.equal(patch.indices.length, 6 * 6);
assert.ok(patch.uvs.every((value) => value >= 0 && value <= 1));
assert.ok(patch.colors.every(Number.isFinite));

// A shared repeat boundary has the same atlas UV on both sides of the split.
assert.deepEqual(patch.uvs.slice(2, 4), patch.uvs.slice(8, 10));
assert.deepEqual(patch.uvs.slice(10, 12), patch.uvs.slice(16, 18));
assert.throws(() => mirrorRepeatCoordinate(Number.NaN), /must be finite/);
assert.throws(() => tessellateMirroredAtlasQuad({}), /finite and increasing/);

process.stdout.write('Painted-material atlas UV scenario passed: mirrored coordinates, negative repeats, tile splits, alpha interpolation, and GL UV orientation.\n');
