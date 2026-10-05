import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parse } from 'acorn';
import * as THREE from 'three';
import { RESOURCE_VISUAL_STAGES, resourceVisualStage, resourceVisualScale,
  resourceVisualTransitionStages } from '../src/resource-visual-state.mjs';
import { setActiveTerrain } from '../src/terrain-height.mjs';

const root = new URL('../', import.meta.url);
const source = await readFile(new URL('src/main.js', root), 'utf8');
const declarations = parse(source, { ecmaVersion: 'latest', sourceType: 'module' }).body;
const production = ['buildBerryNodeInstances', 'setBerryNodeStage'].map(name => {
  const matches = declarations.filter(node => node.type === 'FunctionDeclaration' && node.id.name === name);
  assert.equal(matches.length, 1);
  return source.slice(matches[0].start, matches[0].end);
}).join('\n');
const interactive = JSON.parse(await readFile(new URL('assets/environment/frontier-interactive-v1/manifest.json', root)));
const registration = JSON.parse(await readFile(new URL('assets/environment/vaelora-region-kits-v2/underbough/thornberry-registration.json', root)));
const runtimeFiles = interactive.files.filter(file => file.role === 'runtime-image');
const byPath = new Map(runtimeFiles.map(file => [file.path, file]));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

function assertRegisteredRoot(mesh, modelCanvas = false) {
  const positions = mesh.geometry.attributes.position, uvs = mesh.geometry.attributes.uv;
  // V3 pixel root (320,480) on a 640-square canvas; painted states use bottom-centre.
  const pivotV = modelCanvas ? .25 : 0;
  const rootVertices = [];
  for (let index = 0; index < positions.count; index++) {
    if (uvs.getY(index) === pivotV) rootVertices.push(index);
    if (modelCanvas) {
      const y = positions.getY(index);
      const expectedZ = -Math.min(0, y) * Math.hypot(.78, .78) / 1.12;
      assert(Math.abs(positions.getZ(index) - expectedZ) < 1e-6, 'baked below-root slope stays registered');
    }
  }
  assert.equal(rootVertices.length, 2, 'the root row spans the two card edges');
  for (const index of rootVertices) {
    assert.equal(positions.getY(index), 0, 'registered root lies at local ground height');
    assert.equal(positions.getZ(index), 0, 'registered root stays on the slot plane');
  }
  const width = mesh.geometry.parameters.width;
  assert.deepEqual(rootVertices.map(index => positions.getX(index)), [Math.fround(-width / 2), Math.fround(width / 2)]);
  assert.equal(uvs.getX(rootVertices[0]), 0); assert.equal(uvs.getX(rootVertices[1]), 1);
}

test('thornberry preserves the exact four registered public derivatives and one shared crop', async () => {
  assert.deepEqual(registration.states.map(state => state.stage), RESOURCE_VISUAL_STAGES);
  assert.deepEqual(registration.directions, ['fixed-painted-oblique']);
  assert.deepEqual(registration.runtimePixels, [1176, 867]);
  assert.equal(registration.worldWidth, 1.8);
  assert.equal(registration.worldHeight, 1.8 * 867 / 1176);
  for (const state of registration.states) {
    const url = new URL(state.runtime, new URL('assets/environment/vaelora-region-kits-v2/underbough/', root));
    assert.equal(hash(await readFile(url)), state.runtimeSha256);
  }
});

test('ordinary berry production binds the right four states with stable roots, scales and full-view identity', async () => {
  const previous = { fetch: globalThis.fetch, document: globalThis.document, Image: globalThis.Image,
    location: globalThis.location, warn: console.warn };
  const objects = [];
  class ImageMock {
    width = 640; height = 640; listeners = new Map();
    addEventListener(name, fn) { this.listeners.set(name, fn); }
    removeEventListener(name) { this.listeners.delete(name); }
    set src(value) {
      this.url = String(value);
      Promise.resolve().then(async () => {
        if (this.url.includes('frontier-interactive-v1/')) {
          const file = byPath.get(this.url.split('/').at(-1));
          this.sha256 = hash(await readFile(new URL(this.url, root)));
          this.width = file.dimensionsPx.width; this.height = file.dimensionsPx.height;
        }
        this.listeners.get('load')?.call(this);
      });
    }
  }
  globalThis.document = { createElementNS() { return new ImageMock(); } };
  globalThis.Image = ImageMock; globalThis.location = { search: '' }; console.warn = () => {};
  globalThis.fetch = async url => {
    // Oak atlas decoding is unrelated; retain its normal individual fallback.
    if (String(url).includes('frontier-oak-depletion-atlas-v1/')) return new Response('', { status: 404 });
    try { return new Response(await readFile(new URL(url, root))); }
    catch { return new Response('', { status: 404 }); }
  };
  try {
    const art = await import('../src/environment-art.mjs?berry-bindings-default');
    await art.resourceStateAssetsReady;
    assert.equal(art.RESOURCE_STATE_ASSETS_AVAILABLE, true);
    for (const region of [undefined, 'underbough']) {
      const definition = { id: region ? 'underbough-rootways' : 'woodland-expanse', region,
        width: 20, height: 20, obstacles: [] };
      setActiveTerrain(definition);
      const nodes = [{ id: 'picked', type: 'food', stock: 100, x: 3, z: 4 },
        { id: 'neighbor', type: 'food', stock: 100, x: -3, z: 4 }];
      const before = JSON.stringify(nodes);
      const context = vm.createContext({ ...art, THREE, RESOURCE_VISUAL_STAGES, resourceVisualStage,
        resourceVisualScale, resourceVisualTransitionStages, mapDefinition: definition,
        berrySpriteMeshes: new Map(), berryNodeSlots: new Map(), berryNodeStages: new Map(), berryStageCounts: new Map(),
        isShoreFish: () => false, addMapObject: mesh => objects.push(mesh) });
      vm.runInContext(production, context);
      context.buildBerryNodeInstances(nodes);
      await new Promise(resolve => setImmediate(resolve));
      const full = context.berrySpriteMeshes.get('full');
      const fullMatrix = new THREE.Matrix4(); full.getMatrixAt(0, fullMatrix);
      const rect = full.userData.resourceDirections?.rects.array.slice(0, 4);
      assertRegisteredRoot(full, !region);
      if (region) {
        assert.equal(full.userData.resourceFoodFamily, 'underbough-thornberry');
        assert.equal(full.geometry.parameters.width, registration.worldWidth);
        assert.equal(full.geometry.parameters.height, registration.worldHeight);
      } else {
        assert.equal(full.userData.resourceDirections.family, 'berries');
        assert.match(full.material.map.image.url, /frontier-meshy-fixed-camera-v3\/berries\/berries-atlas.webp$/);
        assert.equal(full.geometry.parameters.width, 5);
        assert.equal(full.geometry.parameters.height, 5);
      }
      for (const stock of [66, 33, 0, 100]) {
        const stage = resourceVisualStage(stock, 100); context.setBerryNodeStage('picked', stage);
        const mesh = context.berrySpriteMeshes.get(stage), matrix = new THREE.Matrix4();
        assertRegisteredRoot(mesh, !region && stage === 'full');
        mesh.getMatrixAt(0, matrix); assert.deepEqual(matrix.toArray(), fullMatrix.toArray());
        if (!region) assert.deepEqual(full.userData.resourceDirections.rects.array.slice(0, 4), rect,
          'the existing full-view UV is retained during depletion and reset before any rebuild');
        assert.equal(context.berryNodeStages.get('neighbor'), 'full');
        assert.equal(context.berryStageCounts.get('full'), stage === 'full' ? 2 : 1);
        if (region) {
          const state = registration.states.find(state => state.stage === stage);
          assert.equal(mesh.userData.resourceFoodFamily, registration.family);
          assert.ok(mesh.material.map.image.url.endsWith(state.runtime.split('/').at(-1)));
          assert.equal(mesh.geometry.parameters.width, registration.worldWidth);
          assert.equal(mesh.geometry.parameters.height, registration.worldHeight);
        } else if (stage !== 'full') {
          const file = runtimeFiles.find(file => file.path === `berries-${stage}.webp`);
          assert.equal(mesh.material.map.image.sha256, file.sha256);
          assert.equal(mesh.geometry.parameters.width, 2.55); assert.equal(mesh.geometry.parameters.height, 1.56);
        }
        for (const [otherStage, otherMesh] of context.berrySpriteMeshes) {
          if (otherStage === stage) continue;
          const hidden = new THREE.Matrix4(); otherMesh.getMatrixAt(0, hidden);
          assert.equal(new THREE.Vector3().setFromMatrixScale(hidden).length(), 0);
        }
      }
      context.buildBerryNodeInstances(nodes);
      const rebuilt = context.berrySpriteMeshes.get('full'), matrix = new THREE.Matrix4(); rebuilt.getMatrixAt(0, matrix);
      assertRegisteredRoot(rebuilt, !region);
      assert.deepEqual(matrix.toArray(), fullMatrix.toArray());
      if (!region) assert.deepEqual(rebuilt.userData.resourceDirections.rects.array.slice(0, 4), rect);
      assert.equal(JSON.stringify(nodes), before, 'presentation never changes authoritative stock/identity');
    }
  } finally {
    for (const mesh of objects) { mesh.geometry.dispose(); mesh.material.dispose(); }
    console.warn = previous.warn;
    for (const key of ['fetch', 'document', 'Image', 'location']) {
      if (previous[key] === undefined) delete globalThis[key]; else globalThis[key] = previous[key];
    }
  }
});
