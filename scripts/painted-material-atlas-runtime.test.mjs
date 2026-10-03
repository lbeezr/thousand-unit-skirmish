import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { loadPaintedMaterialAtlas, groundTextureName, PAINTED_MATERIAL_NAMES,
  paintedMaterialAtlasDescriptor } from '../src/painted-material-atlas-runtime.mjs';
import { applyTerrainTextureSampling } from '../src/terrain-texture-sampling.mjs';
import { mapMirroredAtlasUv } from '../src/painted-material-atlas.mjs';
import { terrainHeightField } from '../src/terrain-height.mjs';
import { buildTerrainBlendMasks } from '../src/terrain-blend.mjs';
import { TERRAIN_MATERIALS } from '../src/terrain-materials.mjs';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('assets/environment/frontier-painted-material-atlas-v1/manifest.json', root)));
const fetchManifest = async () => new Response(JSON.stringify(manifest));
const mipSize = url => 1920 / 2 ** Number(String(url).match(/-mip-(\d)\.webp/)[1]);

test('six authored mips form one shared sRGB page, only the eight represented names select cells', async () => {
  const loaded = [];
  const atlas = await loadPaintedMaterialAtlas({ fetchImpl: fetchManifest,
    imageLoader: { async loadAsync(url) { loaded.push(url); return { width: mipSize(url), height: mipSize(url) }; } } });
  assert.equal(loaded.length, 6);
  const meadow = atlas.texture('meadow');
  for (const name of PAINTED_MATERIAL_NAMES) {
    const texture = atlas.texture(name);
    assert.equal(texture, atlas.texture(name), 'a paint wrapper is cached');
    assert.equal(texture.source, meadow.source, 'all wrappers share one GPU source');
    assert.equal(texture.colorSpace, THREE.SRGBColorSpace);
    assert.equal(texture.wrapS, THREE.ClampToEdgeWrapping);
    assert.equal(texture.wrapT, THREE.ClampToEdgeWrapping);
    assert.equal(texture.generateMipmaps, false);
    assert.equal(texture.minFilter, THREE.LinearMipmapLinearFilter);
    assert.deepEqual(texture.mipmaps.map(image => image.width), [1920, 960, 480, 240, 120, 60]);
    assert.deepEqual(texture.userData.paintedMaterialAtlasUvRect,
      manifest.materials.find(material => material.id === name).uvRectTopLeft);
  }
  for (const name of ['snow', 'tidal-mud', 'lunar-soil', 'jungle-loam', 'garden-loam', 'underbough-root-soil-v2']) {
    assert.equal(atlas.texture(name), null, `${name} keeps the individual texture path`);
  }
  assert.equal(groundTextureName('forest-floor', { region: 'underbough' }), 'underbough-root-soil-v2');
  assert.equal(groundTextureName('forest-floor', { region: 'underbough' }, true), 'underbough-root-soil-02-v2');
  assert.equal(groundTextureName('forest-floor', { region: 'underbough' }, true, '?groundVariants=single'), null);
  assert.equal(groundTextureName('forest-floor', { region: 'underbough' }, false, '?regionalGrounds=legacy'), 'forest-floor');
  for (const [name, search, expected] of [
    ['meadow', '?meadowSurface=quiet', 'bellweather-quiet-meadow'],
    ['snow', '', 'pale-meridian-quiet-snow'], ['tidal-mud', '', 'siltmouths-quiet-mud'],
    ['jungle-loam', '', 'vesperra-quiet-loam'], ['snow', '?snowSurface=legacy', 'snow'],
  ]) assert.equal(groundTextureName(name, {}, false, search), expected);
});

test('loader rejects damaged/unsupported manifests or a missing/incorrect decoded mip', async () => {
  for (const change of [
    pack => { pack.page.sampling.maxMipLevel = 6; },
    pack => { pack.materials[0].uvRectTopLeft.min.u += 0.001; },
    pack => { pack.page.mipLevels.pop(); },
    pack => { pack.files.find(file => file.id === 'atlas-mip-1').path = 'https://external.invalid/image.webp'; },
  ]) {
    const pack = structuredClone(manifest); change(pack);
    assert.throws(() => paintedMaterialAtlasDescriptor(pack));
  }
  await assert.rejects(loadPaintedMaterialAtlas({ fetchImpl: async () => new Response('', { status: 404 }) }), /HTTP 404/);
  await assert.rejects(loadPaintedMaterialAtlas({ fetchImpl: fetchManifest,
    imageLoader: { async loadAsync() { return { width: 1, height: 1 }; } } }), /dimensions disagree/);
  await assert.rejects(loadPaintedMaterialAtlas({ fetchImpl: fetchManifest,
    imageLoader: { async loadAsync(url) { if (url.includes('-mip-3.')) throw new Error('missing mip');
      return { width: mipSize(url), height: mipSize(url) }; } } }), /missing mip/);
});

function compile(material) {
  const shader = { uniforms: {}, fragmentShader: '#include <map_fragment>\n#include <alphamap_fragment>' };
  material.onBeforeCompile(shader);
  return shader;
}

test('atlas addressing runs in mirror and stochastic paths, keeps independent variant and feather coverage', () => {
  const map = new THREE.Texture();
  const rect = manifest.materials[0].uvRectTopLeft;
  map.userData.paintedMaterialAtlasUvRect = rect;
  const variant = new THREE.Texture();
  const materials = [false, true].map(enabled => applyTerrainTextureSampling(
    new THREE.MeshBasicMaterial({ map, alphaMap: new THREE.Texture() }), 42, enabled, true, variant));
  for (const material of materials) {
    const shader = compile(material);
    const r = shader.uniforms.vaeloraMapRect.value;
    assert.deepEqual([r[0], r[1]], mapMirroredAtlasUv(0, 0, rect), 'WebGL cell origin agrees with existing UV helper');
    const corner = mapMirroredAtlasUv(1, 1, rect);
    for (const [actual, expected] of [[r[0] + r[2], corner[0]], [r[1] + r[3], corner[1]]]) {
      assert.ok(Math.abs(actual - expected) < 1e-12);
    }
    assert.ok(shader.fragmentShader.indexOf('dFdx(vMapUv)') < shader.fragmentShader.indexOf('if (vaeloraPaintAlpha'),
      'coverage discard follows derivatives for feathered sparse paint');
    assert.match(shader.fragmentShader, /diffuseColor.a \*= vaeloraPaintAlpha/);
  }
  assert.match(compile(materials[0]).fragmentShader, /diffuseColor \*= vaeloraMapSample\(/);
  assert.equal(materials[0].defines.VAELORA_GROUND_VARIANT, undefined);
  const stochastic = compile(materials[1]);
  assert.match(stochastic.fragmentShader, /diffuseColor \*= vaeloraGround\(/);
  assert.equal(stochastic.uniforms.vaeloraVariantMap.value, variant);
  assert.equal(stochastic.uniforms.vaeloraTerrainSeed.value, 42 / 17);
  assert.equal(stochastic.uniforms.vaeloraFreeRotation.value, 1);
  assert.notEqual(materials[0].customProgramCacheKey(), materials[1].customProgramCacheKey());
  const regular = applyTerrainTextureSampling(new THREE.MeshBasicMaterial({ map: variant }), 42);
  assert.equal(regular.defines?.VAELORA_GROUND_ATLAS, undefined);
  assert.equal(compile(regular).uniforms.vaeloraMapRect, undefined);
});

test('real normal ground factory uses atlas paints and retains world/height/mask alignment and regional variants', async () => {
  const previous = { fetch: globalThis.fetch, document: globalThis.document, Image: globalThis.Image,
    location: globalThis.location, warn: console.warn };
  class TestImage {
    listeners = new Map(); width = 640; height = 640;
    addEventListener(name, callback) { this.listeners.set(name, callback); }
    removeEventListener(name) { this.listeners.delete(name); }
    set src(url) {
      if (String(url).includes('-mip-')) this.width = this.height = mipSize(url);
      queueMicrotask(() => this.listeners.get('load')?.call(this));
    }
    decode() { return Promise.resolve(); }
  }
  const requests = [];
  globalThis.document = { createElementNS() { return new TestImage(); } };
  globalThis.Image = TestImage;
  globalThis.location = { search: '' };
  globalThis.fetch = async url => {
    requests.push(String(url));
    try { return new Response(await readFile(new URL(url, root))); }
    catch { return new Response('', { status: 404 }); }
  };
  console.warn = () => {};
  let art;
  try {
    art = await import('../src/environment-art.mjs');
    await art.resourceStateAssetsReady;
    const map = { width: 28, height: 20, terrainBase: 'meadow', terrainSeed: 42, obstacles: [],
      terrainPatches: [{ column: 4, row: 4, width: 12, height: 8, material: 'dirt' }],
      elevationPatches: [{ column: 0, row: 0, width: 8, height: 20, level: 1 }] };
    const surfaces = art.createGroundSurfaces(map);
    assert.equal(surfaces[0].material.map.name, 'painted-ground:meadow');
    const paint = surfaces.find(surface => surface.material.map?.name === 'painted-ground:dirt');
    assert.ok(paint, 'real default paint layer uses the corresponding cell');
    assert.equal(paint.material.map.source, surfaces[0].material.map.source);
    assert.equal(paint.material.transparent, true);
    assert.equal(paint.material.depthWrite, false);
    const mask = buildTerrainBlendMasks(map, TERRAIN_MATERIALS, 'meadow')[0];
    assert.deepEqual(paint.material.alphaMap.image.data, mask.pixels, 'feather mask pixels are unchanged');
    const field = terrainHeightField(map);
    for (const surface of [surfaces[0], paint]) {
      const position = surface.geometry.getAttribute('position'), uv = surface.geometry.getAttribute('uv');
      const repeat = surface.material.map.repeat;
      for (let i = 0; i < position.count; i++) {
        const x = position.getX(i), z = position.getZ(i);
        assert.ok(Math.abs(uv.getX(i) * repeat.x - (x + map.width / 2) / 12) < 1e-6);
        assert.ok(Math.abs(uv.getY(i) * repeat.y - (z + map.height / 2) / 12) < 1e-6);
        assert.ok(Math.abs(position.getY(i) - field.sample(x, z) - (surface === paint ? -.019 : -.025)) < 1e-6);
      }
    }
    const regional = art.createGroundSurfaces({ width: 8, height: 8, region: 'underbough', terrainBase: 'forest-floor', obstacles: [] });
    assert.equal(regional[0].material.map.userData.paintedMaterialAtlasUvRect, undefined);
    assert.ok(regional[0].material.userData.groundVariantTexture, 'normal regional variant is retained');
    assert.equal(groundTextureName('forest-floor', { region: 'underbough' }, true), 'underbough-root-soil-02-v2');
    assert.ok(requests.some(url => url.endsWith('frontier-painted-material-atlas-v1/manifest.json')));
    for (const surface of [...surfaces, ...regional]) {
      surface.geometry.dispose(); surface.material.dispose();
      for (const texture of surface.userData.ownedGroundTextures || []) texture.dispose();
    }
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (key === 'warn') console.warn = value;
      else if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  }
});
