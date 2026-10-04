import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { loadOakDepletionAtlas, oakDepletionAtlasDescriptor, oakDepletionStage,
  applyOakDepletionSampling, OAK_DEPLETION_ATLAS_ROOT } from '../src/oak-depletion-atlas-runtime.mjs';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL(`${OAK_DEPLETION_ATLAS_ROOT}manifest.json`, root)));
const interactive = JSON.parse(await readFile(new URL('assets/environment/frontier-interactive-v1/manifest.json', root)));
const fileFetch = async url => { try { return new Response(await readFile(new URL(url, root))); }
  catch { return new Response('', { status: 404 }); } };

test('verified six-level shared page uses exact half-pixel state transforms and cap5 sampling', async () => {
  const urls = [];
  const atlas = await loadOakDepletionAtlas({ fetchImpl: async url => { urls.push(String(url)); return fileFetch(url); },
    decodeImage: async (_bytes, file) => file.dimensionsPx });
  assert.equal(urls.length, 7);
  const first = atlas.texture('worked');
  for (const frame of manifest.frames) {
    const texture = atlas.texture(frame.id), rect = frame.uvRectTopLeft;
    assert.equal(texture.source, first.source); assert.equal(texture, atlas.texture(frame.id));
    assert.equal(texture.colorSpace, THREE.SRGBColorSpace); assert.equal(texture.generateMipmaps, false);
    assert.equal(texture.anisotropy, 1); assert.equal(texture.mipmaps.length, 6);
    assert.equal(texture.offset.x, rect.min.u); assert.equal(texture.offset.y, 1 - rect.max.v);
    assert.equal(texture.repeat.x, rect.max.u - rect.min.u); assert.equal(texture.repeat.y, rect.max.v - rect.min.v);
    const material = applyOakDepletionSampling(new THREE.MeshBasicMaterial({ map: texture }));
    const shader = { uniforms: {}, fragmentShader: '#include <map_fragment>\n#include <alphatest_fragment>' };
    material.onBeforeCompile(shader);
    assert.match(shader.fragmentShader, /textureLod\(map, vMapUv, min\(5\.0/);
    assert.deepEqual(shader.uniforms.oakAtlasSize.value.toArray(), [3936, 1376]);
  }
  for (const name of ['full', 'berries-worked', 'underbough-root-oak-low']) assert.equal(atlas.texture(name), null);
  assert.equal(oakDepletionStage('oak-full'), null); assert.equal(oakDepletionStage('oak-worked'), 'worked');
});

test('unsafe contract, hash drift, missing mip and decoded dimension drift fail before binding', async () => {
  for (const mutate of [pack => { pack.files[0].path = 'https://bad.invalid/art.webp'; },
    pack => { pack.page.sampling.maxMipLevel = 6; }, pack => { pack.frames[0].groundPivotPx.y--; },
    pack => { pack.frames[0].uvRectTopLeft.min.u = 0; }]) {
    const pack = structuredClone(manifest); mutate(pack); assert.throws(() => oakDepletionAtlasDescriptor(pack));
  }
  await assert.rejects(loadOakDepletionAtlas({ fetchImpl: async url => String(url).endsWith('mip-3.webp')
    ? new Response('', { status: 404 }) : fileFetch(url), decodeImage: async (_b, file) => file.dimensionsPx }), /HTTP 404/);
  await assert.rejects(loadOakDepletionAtlas({ fetchImpl: async url => String(url).endsWith('mip-0.webp')
    ? new Response(new Uint8Array([1, 2, 3])) : fileFetch(url), decodeImage: async (_b, file) => file.dimensionsPx }), /hash differs/);
  await assert.rejects(loadOakDepletionAtlas({ fetchImpl: fileFetch, decodeImage: async () => ({ width: 1, height: 1 }) }), /dimensions differ/);
});

test('actual factories switch pending materials, skip duplicate states, retain fallback/full/regional roots and alpha', async () => {
  const previous = { fetch: globalThis.fetch, document: globalThis.document, Image: globalThis.Image,
    location: globalThis.location, warn: console.warn, create: URL.createObjectURL, revoke: URL.revokeObjectURL };
  const blobUrls = new Map();
  const byHash = new Map(manifest.files.map(file => [file.sha256, file.dimensionsPx]));
  const dims = new Map(interactive.files.filter(f => f.role === 'runtime-image').map(f => [f.path, f.dimensionsPx]));
  class ImageMock {
    listeners = new Map(); width = 640; height = 640;
    addEventListener(name, callback) { this.listeners.set(name, callback); }
    removeEventListener(name) { this.listeners.delete(name); }
    set src(url) {
      Promise.resolve().then(async () => {
        let size = dims.get(String(url).split('/').at(-1));
        if (blobUrls.has(url)) size = byHash.get(createHash('sha256').update(Buffer.from(await blobUrls.get(url).arrayBuffer())).digest('hex'));
        if (String(url).includes('frontier-painted-material-atlas-mip-')) {
          const n = 1920 / 2 ** Number(String(url).match(/-mip-(\d)/)[1]); size = { width: n, height: n };
        }
        if (size) { this.width = size.width; this.height = size.height; }
        this.listeners.get('load')?.call(this);
      });
    }
  }
  let blobIndex = 0;
  URL.createObjectURL = blob => { const url = `blob:oak-test-${blobIndex++}`; blobUrls.set(url, blob); return url; };
  URL.revokeObjectURL = url => blobUrls.delete(url);
  globalThis.document = { createElementNS() { return new ImageMock(); } }; globalThis.Image = ImageMock;
  console.warn = () => {};
  const meshes = [];
  try {
    for (const mode of ['normal', 'failed', 'legacy']) {
      const requests = []; let release;
      const gate = new Promise(resolve => { release = resolve; });
      globalThis.location = { search: mode === 'legacy' ? '?meshyResources=0' : '' };
      globalThis.fetch = async url => {
        requests.push(String(url));
        if (String(url).includes(OAK_DEPLETION_ATLAS_ROOT) && String(url).endsWith('mip-3.webp')) {
          if (mode === 'failed') return new Response('', { status: 404 });
          await gate;
        }
        return fileFetch(url);
      };
      const art = await import(`../src/environment-art.mjs?oak-depletion-test=${mode}`);
      const early = art.createWoodResourceInstances({ id: 'millrace' }, 'worked', [{ x: 3, z: 4, scale: 1 }]);
      meshes.push(early); release(); await art.resourceStateAssetsReady;
      assert.equal(art.RESOURCE_STATE_ASSETS_AVAILABLE, true);
      assert.equal(art.RESOURCE_STATE_ASSET_STATUS.oakDepletionAtlas, mode !== 'failed');
      const oldRequests = requests.filter(url => /frontier-interactive-v1\/oak-(worked|low|depleted)\.webp$/.test(url));
      assert.equal(oldRequests.length, mode === 'failed' ? 3 : 0);
      for (const state of ['worked', 'low', 'depleted']) {
        const mesh = state === 'worked' ? early : art.createWoodResourceInstances({ id: 'millrace' }, state,
          [{ x: 3, z: 4, scale: 1 }]); meshes.push(mesh);
        assert.equal(mesh.material.map.userData.oakDepletionAtlas === true, mode !== 'failed');
        assert.equal(mesh.geometry.parameters.width, 4.1); assert.equal(mesh.geometry.parameters.height, 3.75);
        mesh.geometry.computeBoundingBox(); assert.equal(mesh.geometry.boundingBox.min.y, 0);
        const matrix = new THREE.Matrix4(); mesh.getMatrixAt(0, matrix);
        const pivot = new THREE.Vector3().applyMatrix4(matrix);
        assert.equal(pivot.x, 3); assert.equal(pivot.z, 4);
        assert.equal(mesh.material.alphaTest, .08); assert.equal(mesh.material.depthWrite, true);
      }
      const full = art.createWoodResourceInstances({ id: 'millrace' }, 'full', [{ x: 0, z: 0 }]); meshes.push(full);
      assert.equal(full.material.map.userData.oakDepletionAtlas, undefined);
      if (mode !== 'legacy') assert.equal(full.userData.resourceDirections.family, 'oak');
      else assert.equal(full.geometry.parameters.width, 4.1);
      const regional = art.createWoodResourceInstances({ id: 'underbough-rootways', region: 'underbough' },
        'low', [{ x: 0, z: 0 }]); meshes.push(regional);
      assert.equal(regional.userData.resourceWoodFamily, 'underbough-root-oak');
      assert.equal(regional.material.map.userData.oakDepletionAtlas, undefined);
      assert.equal(blobUrls.size, 0, 'verified-image blob URLs are revoked');
    }
  } finally {
    for (const mesh of new Set(meshes)) { mesh.geometry.dispose(); mesh.material.dispose(); }
    URL.createObjectURL = previous.create; URL.revokeObjectURL = previous.revoke;
    for (const [key, value] of Object.entries(previous)) {
      if (['create', 'revoke'].includes(key)) continue;
      if (key === 'warn') console.warn = value;
      else if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  }
});
