import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';

const root = new URL('../', import.meta.url);
const pack = JSON.parse(await readFile(new URL('assets/environment/frontier-resource-atlas-v1-candidate/oak-fallback-runtime.json', root)));
const interactive = JSON.parse(await readFile(new URL('assets/environment/frontier-interactive-v1/manifest.json', root)));
const dimensions = new Map(interactive.files.filter(file => file.role === 'runtime-image')
  .map(file => [file.path, file.dimensionsPx]));

test('export registration matches actual generic oak factories; default full and regional art remain distinct', async () => {
  const previous = { fetch: globalThis.fetch, document: globalThis.document, Image: globalThis.Image,
    location: globalThis.location, warn: console.warn };
  class DecodedImage {
    listeners = new Map(); width = 640; height = 640;
    addEventListener(name, callback) { this.listeners.set(name, callback); }
    removeEventListener(name) { this.listeners.delete(name); }
    set src(url) {
      const file = String(url).split('/').at(-1);
      const size = dimensions.get(file);
      if (size) { this.width = size.width; this.height = size.height; }
      else if (String(url).includes('frontier-painted-material-atlas-mip-')) {
        this.width = this.height = 1920 / 2 ** Number(file.match(/-mip-(\d)/)[1]);
      }
      queueMicrotask(() => this.listeners.get('load')?.call(this));
    }
  }
  globalThis.document = { createElementNS() { return new DecodedImage(); } };
  globalThis.Image = DecodedImage;
  globalThis.fetch = async url => {
    try { return new Response(await readFile(new URL(url, root))); }
    catch { return new Response('', { status: 404 }); }
  };
  console.warn = () => {};
  const meshes = [];
  try {
    for (const [mode, search] of [['normal', ''], ['legacy', '?meshyResources=0']]) {
      globalThis.location = { search };
      const art = await import(`../src/environment-art.mjs?oak-registration=${mode}`);
      await art.resourceStateAssetsReady;
      assert.equal(art.RESOURCE_STATE_ASSETS_AVAILABLE, true, 'existing verified state loader succeeds');
      for (const frame of pack.frames.filter(frame => mode === 'legacy' || frame.id !== 'full')) {
        const mesh = art.createWoodResourceInstances({ id: 'millrace', obstacles: [] }, frame.id,
          [{ x: 3, z: 4, scale: 1, cell: 5 }]);
        meshes.push(mesh);
        const { width, height } = frame.worldSize;
        assert.equal(mesh.geometry.parameters.width, width);
        assert.equal(mesh.geometry.parameters.height, height);
        mesh.geometry.computeBoundingBox();
        assert.equal(mesh.geometry.boundingBox.min.y, 0);
        assert.equal(mesh.geometry.boundingBox.max.y, height);
        const localPivot = new THREE.Vector3((frame.groundPivotPx.x / frame.canvasPx.width - .5) * width,
          (1 - frame.groundPivotPx.y / frame.canvasPx.height) * height, 0);
        const matrix = new THREE.Matrix4(); mesh.getMatrixAt(0, matrix);
        localPivot.applyMatrix4(matrix);
        assert.equal(localPivot.x, 3); assert.equal(localPivot.z, 4);
        assert.equal(mesh.material.alphaTest, .08); assert.equal(mesh.material.depthWrite, true);
      }
      if (mode === 'normal') {
        const full = art.createWoodResourceInstances({ id: 'millrace', obstacles: [] }, 'full', [{ x: 0, z: 0 }]);
        meshes.push(full);
        assert.equal(full.geometry.parameters.width, 5);
        assert.equal(full.userData.resourceDirections.family, 'oak', 'default full still uses the separate directional design');
        const regional = art.createWoodResourceInstances({ id: 'underbough-rootways', region: 'underbough' },
          'worked', [{ x: 0, z: 0 }]);
        meshes.push(regional);
        assert.equal(regional.userData.resourceWoodFamily, 'underbough-root-oak');
        assert.notEqual(regional.geometry.parameters.width, pack.frames[0].worldSize.width);
      }
    }
  } finally {
    for (const mesh of meshes) { mesh.geometry.dispose(); mesh.material.dispose(); }
    for (const [key, value] of Object.entries(previous)) {
      if (key === 'warn') console.warn = value;
      else if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  }
});
