import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePlantManifest } from './validate-environment-plants.mjs';
import * as THREE from 'three';
import { PLANT_ASSETS } from '../src/environment-plant-assets.mjs';
const base = fileURLToPath(new URL('../assets/environment/frontier-v1/', import.meta.url));
const manifest = JSON.parse(await readFile(path.join(base, 'vesperra-understory-manifest.json'), 'utf8'));
const dir = await mkdtemp(path.join(os.tmpdir(), 'rts-plant-validation-'));
try {
  for (const f of manifest.files) await copyFile(path.join(base, f.path), path.join(dir, f.path));
  await copyFile(path.join(base, manifest.prompts), path.join(dir, manifest.prompts));
  manifest.reference = path.resolve(base, manifest.reference);
  const target = path.join(dir, 'manifest.json');
  await writeFile(target, JSON.stringify(manifest));
  assert.equal((await validatePlantManifest(target)).asset, 'vesperra-shade-fern');
  const runtime = path.join(dir, manifest.files.find(f => f.role === 'runtime-image').path);
  const bytes = await readFile(runtime), corrupted = Buffer.from(bytes); corrupted[corrupted.length - 1] ^= 1;
  await writeFile(runtime, corrupted);
  await assert.rejects(validatePlantManifest(target), /file hash mismatch/);
  await writeFile(runtime, bytes);
  for (const [mutate, reason] of [
    [m => { m.asset.worldWidth *= 1.2; }, /world aspect/],
    [m => { m.asset.worldWidth *= 1.2; m.asset.worldHeight *= 1.2; }, /runtime contract mismatch/],
    [m => { m.asset.pivot = [0.5, 0.5]; }, /pivot/],
    [m => { m.referenceSha256 = '0'.repeat(64); }, /reference hash/],
    [m => { m.files[0].dimensionsPx.width -= 1; }, /encoded dimensions/],
    [m => { m.cropPx[2] = m.files[0].dimensionsPx.width + 1; }, /crop outside/],
    [m => { m.asset.kind = 'unregistered'; }, /unsupported surface/],
  ]) {
    const changed = structuredClone(manifest); mutate(changed);
    await writeFile(target, JSON.stringify(changed));
    await assert.rejects(validatePlantManifest(target), reason);
  }
  console.log('Environment plant validation rejects corrupted bytes, stale reference/dimensions, wrong crop/aspect/pivot, uniform runtime scale drift and unsupported surfaces.');
} finally { await rm(dir, { recursive: true, force: true }); }

// Exercise the canonical descriptors through the real renderer, with only
// network/image acquisition replaced. This establishes CPU contracts, not pixels.
const packs = [
  ['vesperra-spiral-podvine', 'podvine-low-pack', 'PODVINE_LOW_PACK', 'vesperra-podvine-low-v1', 'lifecycle-atlas.webp'],
  ['vesperra-veilcap', 'veilcap-worked-pack', 'VEILCAP_WORKED_PACK', 'vesperra-veilcap-worked-v2', 'veilcap-worked-atlas.webp'],
  ['ellionar-sunbloom', 'sunbloom-low-pack', 'SUNBLOOM_LOW_PACK', 'ellionar-sunbloom-low-v4', 'sunbloom-low-atlas.webp'],
];
const originalFetch = globalThis.fetch, originalLoad = THREE.TextureLoader.prototype.load;
const originalLocation = Object.getOwnPropertyDescriptor(globalThis, 'location');
try {
  globalThis.location = { search: '' };
  globalThis.fetch = async url => {
    if (!String(url).endsWith('-lifecycle-atlas.json')) return new Response('', { status: 404 });
    return new Response(await readFile(new URL(`../${url}`, import.meta.url)));
  };
  THREE.TextureLoader.prototype.load = function(url) {
    const texture = new THREE.Texture(); texture.userData.url = url; return texture;
  };
  const art = await import('../src/environment-art.mjs');
  await art.resourceStateAssetsReady;
  for (const [id, module, binding, folder, atlasFile] of packs) {
    const canonical = await import(`../src/presentation/assets/plant-packs/${module}.mjs`);
    const legacy = await import(`../src/${module}.mjs`);
    const pack = canonical[binding], registration = PLANT_ASSETS[id];
    assert.deepEqual(Object.keys(canonical), [binding]);
    assert.deepEqual(Object.keys(legacy), [binding]);
    assert.equal(legacy[binding], pack, `${id}: forwarding keeps object identity`);
    assert.ok(Object.isFrozen(pack));
    for (const key of Object.keys(pack).filter(key => Array.isArray(pack[key]))) {
      assert.equal(legacy[binding][key], pack[key], `${id}: ${key} identity`);
      assert.equal(Object.isFrozen(pack[key]), false, 'existing freezing stays shallow');
      for (const value of pack[key]) if (Array.isArray(value)) assert.equal(Object.isFrozen(value), false);
    }
    const manifest = JSON.parse(await readFile(new URL(`../assets/environment/${folder}/manifest.json`, import.meta.url)));
    assert.equal(pack.url, `./assets/environment/${folder}/${atlasFile}`);
    for (const key of ['atlasSizePx', 'frameSizePx', 'worldSize', 'pivot']) assert.deepEqual(pack[key], manifest[key]);
    assert.deepEqual(pack.worldSize, [registration.worldWidth, registration.worldHeight]);
    assert.deepEqual(pack.pivot, registration.pivot);
    for (const [key, state] of [['rectsPx', 'full'], ['workedRectsPx', 'worked'], ['lowRectsPx', 'low']]) {
      const expected = manifest.frames.filter(frame => frame.state === state).map(frame => frame.rectPx);
      if (expected.length) assert.deepEqual(pack[key], expected);
      else assert.equal(Object.hasOwn(pack, key), false, `${id}: absent ${state} art stays absent`);
    }
    const points = Array.from({ length: 32 }, (_, cell) => ({ cell, x: cell % 8, z: Math.floor(cell / 8), scale: 1, flip: true, yaw: .8 }));
    const mesh = art.createEnvironmentSpriteInstances(id, ...pack.worldSize, points);
    const views = mesh.userData.authoredPlantViews;
    assert.equal(views.pack, pack, `${id}: production consumes the canonical binding`);
    assert.equal(mesh.material.map.userData.url, pack.url);
    assert.equal(new Set(views.viewIndices).size, 4, 'all existing directions are exercised');
    assert.deepEqual(views.frameIds, ['front', 'right', 'rear', 'left']);
    assert.equal(views.measured3DCapture, false);
    const tree = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial(), points.length);
    for (const [index, point] of points.entries()) {
      const [rx, ry, rw, rh] = pack.rectsPx[views.viewIndices[index]], [pw, ph] = pack.atlasSizePx;
      const fullUV = [(rx + .5) / pw, 1 - (ry + rh - .5) / ph, (rw - 1) / pw, (rh - 1) / ph];
      assert.ok(Array.from(views.rects.array.slice(index * 4, index * 4 + 4))
        .every((value, i) => Math.abs(value - fullUV[i]) < 1e-7), `${id}: initial full UVs`);
      const initial = new THREE.Matrix4(); mesh.getMatrixAt(index, initial);
      assert.ok(initial.determinant() > 0, 'authored directions ignore mirroring');
      const slot = { mesh: tree, index, ...point, understory: { mesh, index, ...point } };
      for (const stock of [6, 5, 3, 2, 1, 0, -1, 6]) {
        const view = views.viewIndices[index];
        art.setForestSpriteStock(slot, stock);
        const low = stock > 0 && stock <= 2 && Boolean(pack.lowRectsPx);
        const worked = stock > 0 && stock < 6;
        const [x, y, w, h] = (low ? pack.lowRectsPx : worked ? pack.workedRectsPx : pack.rectsPx)[view];
        const [pw, ph] = pack.atlasSizePx;
        const expected = [(x + .5) / pw, 1 - (y + h - .5) / ph, (w - 1) / pw, (h - 1) / ph];
        const actual = Array.from(views.rects.array.slice(index * 4, index * 4 + 4));
        assert.ok(actual.every((value, i) => Math.abs(value - expected[i]) < 1e-7), `${id}: stock ${stock} UVs`);
        assert.equal(views.viewIndices[index], view, 'state change keeps the selected direction');
        assert.equal(views.worked[index], low ? 2 : worked ? 1 : 0);
        const matrix = new THREE.Matrix4(); mesh.getMatrixAt(index, matrix);
        if (stock <= 0) assert.equal(matrix.determinant(), 0, 'depletion hides the plant');
        else assert.deepEqual(matrix.elements, initial.elements, 'renewed/full/worked/low states keep the root');
      }
    }
    assert.equal(art.createEnvironmentSpriteInstances(id, ...pack.worldSize, []), null);
    assert.throws(() => art.createEnvironmentSpriteInstances(id, pack.worldSize[0] + .1, pack.worldSize[1], points), /registered contract/);
    globalThis.location.search = '?plantViews=legacy';
    const oldMesh = art.createEnvironmentSpriteInstances(id, ...pack.worldSize, points);
    assert.equal(oldMesh.userData.authoredPlantViews, undefined, 'legacy opt-out keeps the original single-view path');
    assert.equal(oldMesh.material.map.userData.url, `./assets/environment/frontier-v1/${id}.webp`);
    oldMesh.geometry.dispose(); oldMesh.material.dispose();
    globalThis.location.search = '';
    mesh.geometry.dispose(); mesh.material.dispose();
    tree.geometry.dispose(); tree.material.dispose();
  }
  console.log('Three canonical plant packs preserve forwarding identity, manifest/registration values, actual full/worked/low/depleted transitions and legacy selection. CPU only.');
} finally {
  globalThis.fetch = originalFetch;
  THREE.TextureLoader.prototype.load = originalLoad;
  if (originalLocation) Object.defineProperty(globalThis, 'location', originalLocation);
  else delete globalThis.location;
}
