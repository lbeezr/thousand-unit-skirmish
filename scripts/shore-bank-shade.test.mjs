import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createShoreBankShade, SHORE_BANK_WIDTH, SHORE_BANK_OPACITY, SHORE_BANK_QUAD_LIMIT } from '../src/shore-bank-shade.mjs';
import { buildWaterSurfaceGeometry } from '../src/water-surface-geometry.mjs';

const pond = () => ({ width: 12, height: 12, terrainBase: 'meadow', terrainSeed: 7,
  obstacles: [{ column: 4, row: 4, width: 4, height: 4, material: 'water' }],
  resourceNodes: [{ id: 'fish', type: 'food', resourceVariant: 'shore-fish', x: -2.5, z: -.5, stock: 40 }] });
function dispose(mesh) { mesh?.geometry.dispose(); mesh?.material.dispose(); }

test('dry maps and fully wet map boundaries allocate no bank shade', () => {
  for (const definition of [{ ...pond(), obstacles: [] }, { ...pond(),
    obstacles: [{ column: 0, row: 0, width: 12, height: 12, material: 'water' }] }]) {
    assert.equal(createShoreBankShade(definition), null);
  }
  for (const width of [0, -1, 513, NaN, 1.5]) assert.equal(createShoreBankShade({ ...pond(), width }), null);
});

test('one static, non-picking transparent batch feathers on the land side', () => {
  const definition = pond(), before = structuredClone(definition);
  const shade = createShoreBankShade(definition);
  assert.ok(shade);
  assert.deepEqual(definition, before);
  assert.equal(shade.children.length, 0);
  assert.equal(shade.material.map, null);
  assert.equal(shade.material.fog, true);
  assert.equal(shade.material.depthWrite, false);
  assert.equal(shade.material.transparent, true);
  assert.equal(shade.material.forceSinglePass, true, 'flat double-sided decoration uses one Three draw pass');
  assert.equal(shade.material.opacity, SHORE_BANK_OPACITY);
  assert.equal(shade.onBeforeRender, THREE.Object3D.prototype.onBeforeRender);
  const hits = []; shade.raycast(new THREE.Raycaster(), hits); assert.deepEqual(hits, []);
  const p = shade.geometry.attributes.position, c = shade.geometry.attributes.color;
  assert.equal(p.count, shade.userData.shoreBankShade.quads * 4);
  assert.equal(shade.geometry.index.count, shade.userData.shoreBankShade.quads * 6);
  let dryOuterVertices = 0;
  for (let i = 0; i < p.count; i += 4) {
    assert.equal(c.getW(i), 1); assert.equal(c.getW(i + 1), 1);
    assert.equal(c.getW(i + 2), 0); assert.equal(c.getW(i + 3), 0);
    for (let j = i; j < i + 4; j++) {
      assert.ok(Number.isFinite(p.getX(j)) && Number.isFinite(p.getZ(j)));
      assert.ok(Math.abs(p.getY(j) - .008) < 1e-8);
    }
    assert.ok(Math.hypot(p.getX(i + 2) - p.getX(i), p.getZ(i + 2) - p.getZ(i)) <= SHORE_BANK_WIDTH * 1.8 + 1e-6);
    if (Math.abs(p.getX(i + 2)) > 2 || Math.abs(p.getZ(i + 2)) > 2) dryOuterVertices++;
  }
  assert.ok(dryOuterVertices > 0, 'feather reaches dry ground rather than duplicating the inner water rim');
  dispose(shade);
});

test('dry islands receive inward-facing land shade without closing water holes', () => {
  const definition = { ...pond(), obstacles: [
    { column: 3, row: 3, width: 6, height: 2, material: 'water' },
    { column: 3, row: 7, width: 6, height: 2, material: 'water' },
    { column: 3, row: 5, width: 2, height: 2, material: 'water' },
    { column: 7, row: 5, width: 2, height: 2, material: 'water' },
  ] };
  const water = buildWaterSurfaceGeometry(definition);
  const before = water.attributes.position.array.slice();
  const shade = createShoreBankShade(definition), p = shade.geometry.attributes.position;
  let islandVertices = 0;
  for (let i = 2; i < p.count; i += 4) {
    if (Math.abs(p.getX(i)) < 1 && Math.abs(p.getZ(i)) < 1) islandVertices++;
  }
  assert.ok(islandVertices > 0);
  assert.equal(water.userData.waterIslandCount, 1);
  assert.deepEqual(water.attributes.position.array, before);
  dispose(shade); water.dispose();
});

test('raised banks and water are omitted instead of spanning a cliff', () => {
  const definition = { ...pond(), elevationPatches: [{ column: 0, row: 0, width: 12, height: 12, level: 2 }] };
  assert.equal(createShoreBankShade(definition), null);
});

test('decorative topology has a strict whole-batch complexity ceiling', () => {
  const definition = { width: 64, height: 64, obstacles: [] };
  for (let row = 0; row < 64; row += 2) for (let column = 0; column < 64; column += 2) {
    definition.obstacles.push({ column, row, width: 1, height: 1, material: 'water' });
  }
  assert.equal(createShoreBankShade(definition), null, 'omit the effect rather than allocate an unbounded or truncated shoreline');
  assert.equal(SHORE_BANK_QUAD_LIMIT, 4096);
});

test('actual default ground factory adds one bank batch, below fog and above ground paint', async () => {
  const original = { load: THREE.TextureLoader.prototype.load, fetch: globalThis.fetch,
    location: globalThis.location, warn: console.warn };
  const surfaces = [];
  try {
    THREE.TextureLoader.prototype.load = () => new THREE.Texture();
    globalThis.fetch = async () => ({ ok: false, status: 404 });
    globalThis.location = { search: '' }; console.warn = () => {};
    const { createGroundSurfaces, resourceStateAssetsReady } = await import('../src/environment-art.mjs');
    await resourceStateAssetsReady; console.warn = original.warn;
    for (const search of ['', '?waterQuality=low']) {
      globalThis.location.search = search;
      const definition = pond(), before = structuredClone(definition);
      const actual = createGroundSurfaces(definition); surfaces.push(...actual);
      const shades = actual.filter(mesh => mesh.userData.shoreBankShade);
      assert.equal(shades.length, 1, 'ordinary URLs need no new preview flag');
      assert.equal(shades[0].renderOrder, -2);
      assert.equal(actual[0].userData.terrainSurface, true);
      assert.ok(actual.find(mesh => mesh.userData.waterStudy));
      assert.deepEqual(definition, before, 'node positions, finite stock, terrain and water rules are untouched');
    }
  } finally {
    for (const mesh of surfaces) mesh.traverse(child => {
      child.geometry?.dispose(); child.material?.dispose();
      for (const texture of child.userData.ownedGroundTextures || []) texture.dispose();
    });
    THREE.TextureLoader.prototype.load = original.load; globalThis.fetch = original.fetch;
    if (original.location === undefined) delete globalThis.location; else globalThis.location = original.location;
    console.warn = original.warn;
  }
});

test('representative shipped shoreline counts stay within the one-batch budget', () => {
  for (const id of ['bellweather-millrace', 'shore-fishing', 'sombral-mere-shore-gardens']) {
    const definition = JSON.parse(readFileSync(new URL(`../maps/${id}.json`, import.meta.url)));
    const shade = createShoreBankShade(definition);
    assert.ok(shade, id);
    assert.ok(shade.userData.shoreBankShade.quads <= SHORE_BANK_QUAD_LIMIT);
    dispose(shade);
  }
});
