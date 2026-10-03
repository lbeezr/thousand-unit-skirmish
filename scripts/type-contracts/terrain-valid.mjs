// Compile-only contract: immutable paint/obstacle inputs produce ordered RGBA byte masks.
import { buildTerrainBlendMasks, buildForestGroundMask } from '../../src/terrain-blend.mjs';

/** @type {import('../../src/terrain-blend.mjs').TerrainMaskMap} */
const map = Object.freeze({ width: 4, height: 4, terrainSeed: 42,
  terrainPatches: Object.freeze([Object.freeze({ column: 0, row: 0, width: 2, height: 4, material: 'sand' })]),
  obstacles: Object.freeze([Object.freeze({ column: 1, row: 1, width: 2, height: 2, material: 'forest' })]),
});
const materials = Object.freeze(['meadow', 'sand']);
const masks = buildTerrainBlendMasks(map, materials, 'meadow', true);
for (const mask of masks) {
  /** @type {Uint8Array} */
  const rgba = mask.pixels;
  rgba.subarray(0, mask.width * mask.height * 4);
  mask.material.toUpperCase();
}
buildTerrainBlendMasks({ width: 4, height: 4, terrainPatches: null }, materials, 'meadow');
buildForestGroundMask({ width: 4, height: 4, obstacles: null });
const ground = buildForestGroundMask(map, 'garden-loam');
if (ground) ground.pixels.subarray(0, ground.width * ground.height * 4);
