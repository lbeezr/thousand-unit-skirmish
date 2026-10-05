import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import { forestLifecycleAtlasDescriptor } from '../src/forest-lifecycle-atlas.mjs';
import { RESOURCE_VISUAL_STAGES } from '../src/resource-visual-state.mjs';

const root = new URL('../', import.meta.url);
const directory = new URL('assets/environment/frontier-v1/', root);
const readPack = async region => JSON.parse(await readFile(new URL(`${region}-lifecycle-atlas.json`, directory)));

test('all 21 approved regional pages have exact fixed-view state bindings and shared roots/canvases', async () => {
  const files = (await readdir(directory)).filter(file => file.endsWith('-lifecycle-atlas.json'));
  assert.equal(files.length, 21);
  for (const filename of files) {
    const region = filename.replace('-lifecycle-atlas.json', '');
    const pack = await readPack(region), before = JSON.stringify(pack);
    const descriptor = forestLifecycleAtlasDescriptor(pack, region);
    assert.equal(descriptor.asset, pack.assets[0]);
    assert.deepEqual(descriptor.asset.frames.map(frame => frame.id), RESOURCE_VISUAL_STAGES);
    assert.equal(JSON.stringify(pack), before, 'validation preserves approved metadata');
  }
});

test('state aliases, mixed headings, shifted roots/scales and unsafe page cells are rejected', async () => {
  const pack = await readPack('underbough-root-oak');
  const changes = [
    p => p.assets[0].frames.push(structuredClone(p.assets[0].frames[0])),
    p => p.assets[0].frames[1].id = 'full',
    p => p.assets[0].clips[1].stateId = 'full',
    p => p.assets[0].clips[1].sequence[0].frameId = 'low',
    p => p.assets[0].clips[2].directionId = 'view-03',
    p => p.assets[0].frames[2].groundPivotPx.y--,
    p => p.assets[0].frames.forEach(frame => frame.groundPivotPx.x--),
    p => p.assets[0].frames[2].canvasPx.width--,
    p => p.assets[0].frames[2].fallbackRectPx.rectPx.width--,
    p => p.assets[0].frames[2].fallbackRectPx.pageId = 'other',
    p => p.assets[0].frames[2].fallbackRectPx.rectPx.x = -1,
    p => p.assets[0].frames[2].fallbackRectPx.rectPx.y = p.pages[0].dimensionsPx.height,
    p => p.assets[0].frames[2].fallbackRectPx.rectPx = structuredClone(p.assets[0].frames[0].fallbackRectPx.rectPx),
    p => p.pages[0].sampling.maxMipLevel = 7,
    p => p.files.find(file => file.id === 'runtime').dimensionsPx.width--,
    p => p.assets[0].id = 'underbough-old-plum',
  ];
  for (const change of changes) {
    const copy = structuredClone(pack); change(copy);
    assert.throws(() => forestLifecycleAtlasDescriptor(copy, 'underbough-root-oak'));
  }
  // Frame order is metadata order, not the state/heading selection policy.
  const reversed = structuredClone(pack); reversed.assets[0].frames.reverse(); reversed.assets[0].clips.reverse();
  assert.doesNotThrow(() => forestLifecycleAtlasDescriptor(reversed, 'underbough-root-oak'));
});

test('production forest stock/reset preserves slot matrices and rejects shifted atlas into individual fallback', async () => {
  const THREE = await import('three');
  const { setActiveTerrain } = await import('../src/terrain-height.mjs');
  const previous = { fetch: globalThis.fetch, document: globalThis.document, Image: globalThis.Image,
    location: globalThis.location, warn: console.warn };
  class ImageMock {
    width = 640; height = 640; listeners = new Map();
    addEventListener(name, fn) { this.listeners.set(name, fn); }
    removeEventListener(name) { this.listeners.delete(name); }
    set src(value) { this.url = String(value); queueMicrotask(() => this.listeners.get('load')?.call(this)); }
  }
  const objects = [], warnings = [];
  globalThis.document = { createElementNS() { return new ImageMock(); } };
  globalThis.Image = ImageMock; globalThis.location = { search: '' };
  console.warn = (...args) => warnings.push(args.join(' '));
  try {
    for (const mode of ['normal', 'shifted']) {
      globalThis.fetch = async url => {
        if (mode === 'shifted' && String(url).endsWith('underbough-root-oak-lifecycle-atlas.json')) {
          const pack = await readPack('underbough-root-oak'); pack.assets[0].frames[2].groundPivotPx.y--;
          return Response.json(pack);
        }
        try { return new Response(await readFile(new URL(url, root))); }
        catch { return new Response('', { status: 404 }); }
      };
      const art = await import(`../src/environment-art.mjs?forest-lifecycle-test=${mode}`);
      await art.resourceStateAssetsReady;
      const definition = { id: 'flora-regression', width: 20, height: 20, region: 'underbough',
        terrainBase: 'forest-floor', terrainSeed: 93002,
        obstacles: [{ material: 'forest', row: 4, column: 4, width: 10, height: 10 }] };
      setActiveTerrain(definition);
      const createSlots = () => art.addObstacleEnvironmentSprites(definition, 10, 10, mesh => objects.push(mesh));
      const slots = createSlots(); assert.equal(slots.size, 100);
      await new Promise(resolve => setImmediate(resolve));
      const slot = [...slots.values()].find(item => item.family === 'underbough-root-oak');
      assert.ok(slot);
      const matrices = new Map();
      for (const stock of [6, 4, 3, 2, 1, 0, 6]) {
        const stage = art.setForestSpriteStock(slot, stock);
        const active = slot.atlas ? slot.mesh : slot.stateMeshes[stage];
        const matrix = new THREE.Matrix4(); active.getMatrixAt(slot.index, matrix);
        matrices.set(stage, matrix.toArray());
        assert.deepEqual(matrix.toArray(), matrices.get('full'), 'stock changes retain root, scale, mirror and card yaw');
        if (slot.atlas) {
          assert.equal(mode, 'normal');
          const rect = Array.from(slot.atlas.rects.array.slice(slot.index * 4, slot.index * 4 + 4));
          assert.deepEqual(rect, slot.atlas.frameRects[stage].map(Math.fround));
        } else {
          assert.equal(mode, 'shifted');
          assert.match(active.material.map.image.url, new RegExp(`underbough-root-oak${stage === 'full' ? '' : `-${stage}`}\\.webp$`));
          for (const [otherStage, mesh] of Object.entries(slot.stateMeshes)) {
            if (otherStage === stage) continue;
            const hidden = new THREE.Matrix4(); mesh.getMatrixAt(slot.index, hidden);
            assert.equal(new THREE.Vector3().setFromMatrixScale(hidden).length(), 0);
          }
        }
      }
      const rebuilt = createSlots().get(slot.cell);
      const rebuiltMatrix = new THREE.Matrix4(); rebuilt.mesh.getMatrixAt(rebuilt.index, rebuiltMatrix);
      assert.deepEqual(rebuiltMatrix.toArray(), matrices.get('full'), 'same seed/cell rebuild retains appearance');
      assert.equal(!!slot.atlas, mode === 'normal');
    }
    assert(warnings.some(message => message.includes('Forest atlas underbough-root-oak unavailable')));
  } finally {
    for (const mesh of objects) { mesh.geometry.dispose(); mesh.material.dispose(); }
    console.warn = previous.warn;
    for (const key of ['fetch', 'document', 'Image', 'location']) {
      if (previous[key] === undefined) delete globalThis[key]; else globalThis[key] = previous[key];
    }
  }
});
