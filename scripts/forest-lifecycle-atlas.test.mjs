import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse } from 'acorn';
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

test('normal Bellweather forest consumes its registered atlas from the real release inventory', async () => {
  const THREE = await import('three');
  const { setActiveTerrain } = await import('../src/terrain-height.mjs');
  const moduleUrl = new URL('../src/environment-art.mjs', import.meta.url);
  const source = await readFile(moduleUrl, 'utf8');
  // Keep every production body; resolve its actual imports before loading an
  // isolated module so each negative control gets fresh loader state.
  const imports = parse(source, { ecmaVersion: 'latest', sourceType: 'module' }).body
    .filter(node => node.source && ['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration']
      .includes(node.type)).map(node => node.source).reverse();
  const importProduction = async (body, mode) => {
    for (const specifier of imports) {
      const url = specifier.value.startsWith('.') ? new URL(specifier.value, moduleUrl).href
        : import.meta.resolve(specifier.value);
      body = body.slice(0, specifier.start) + JSON.stringify(url) + body.slice(specifier.end);
    }
    return import(`data:text/javascript;base64,${Buffer.from(`${body}\n// ${mode}`).toString('base64')}`);
  };
  const release = JSON.parse(execFileSync(process.execPath, ['scripts/pack-railway-release.mjs', '--allow-dirty'],
    { cwd: fileURLToPath(root), encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }));
  const manifestPath = 'assets/environment/frontier-v1/bellweather-lifecycle-atlas.json';
  const pack = await readPack('bellweather');
  const descriptor = forestLifecycleAtlasDescriptor(pack, 'bellweather');
  const pagePath = `assets/environment/frontier-v1/${descriptor.file.path}`;
  const selector = "bellweather ? 'bellweather-field-maple' : 'field-maple'";
  assert(source.includes(selector), 'negative control must mutate the actual selector');
  const controls = [{ label: 'normal', omitted: null, body: source },
    ...[manifestPath, pagePath].map(omitted => ({ label: omitted, omitted, body: source })),
    { label: 'wrong-family', omitted: null,
      body: source.replace(selector, "bellweather ? 'field-maple' : 'field-maple'") }];
  const original = { fetch: globalThis.fetch, document: globalThis.document, Image: globalThis.Image,
    location: globalThis.location, warn: console.warn };
  const objects = [], pending = [];
  const digest = bytes => createHash('sha256').update(bytes).digest('hex');
  try {
    for (const { label, omitted, body } of controls) {
      assert(release.files.includes(manifestPath) && release.files.includes(pagePath));
      const available = new Set(release.files.filter(file => file !== omitted));
      const packedBytes = url => {
        const relative = new URL(url, root).pathname.slice(fileURLToPath(root).length);
        return available.has(relative) ? readFile(new URL(relative, pathToFileURL(`${release.directory}/`)))
          : Promise.reject(new Error(`omitted release dependency: ${relative}`));
      };
      class ImageMock {
        width = 640; height = 640; listeners = new Map();
        addEventListener(name, fn) { this.listeners.set(name, fn); }
        removeEventListener(name) { this.listeners.delete(name); }
        set src(value) {
          this.url = String(value);
          pending.push(packedBytes(value).then(bytes => {
            this.sha256 = digest(bytes); this.listeners.get('load')?.call(this);
          }, () => this.listeners.get('error')?.call(this)));
        }
      }
      globalThis.document = { createElementNS() { return new ImageMock(); } };
      globalThis.Image = ImageMock; globalThis.location = { search: '' }; console.warn = () => {};
      globalThis.fetch = async url => {
        try { return new Response(await packedBytes(url)); }
        catch { return new Response('', { status: 404 }); }
      };
      const art = await importProduction(body, label);
      await art.resourceStateAssetsReady;
      const authored = JSON.parse(await readFile(new URL('maps/bellweather-millrace.json', root)));
      const definition = { id: authored.id, region: authored.region,
        terrainBase: authored.terrainBase, terrainSeed: authored.terrainSeed, width: 20, height: 20,
        obstacles: [{ material: 'forest', row: 4, column: 4, width: 10, height: 10 }] };
      setActiveTerrain(definition);
      const slots = art.addObstacleEnvironmentSprites(definition, 10, 10, mesh => objects.push(mesh));
      await Promise.all(pending);
      const check = () => {
        assert.equal(slots.size, 100);
        const maples = [...slots.values()].filter(slot => slot.family === descriptor.asset.id);
        assert(maples.length > 0, 'normal Bellweather must select its registered family');
        for (const slot of maples) {
          assert(slot.atlas, 'registered default atlas must reach the release consumer');
          assert.equal(slot.mesh.material.map.image?.sha256, descriptor.file.sha256,
            'the consumer must load actual registered page bytes');
          const initial = new THREE.Matrix4(); slot.mesh.getMatrixAt(slot.index, initial);
          for (const [stock, expectedStage] of [[6, 'full'], [4, 'worked'], [2, 'low'], [0, 'depleted'], [6, 'full']]) {
            const stage = art.setForestSpriteStock(slot, stock);
            assert.equal(stage, expectedStage);
            const matrix = new THREE.Matrix4(); slot.mesh.getMatrixAt(slot.index, matrix);
            assert.deepEqual(matrix.toArray(), initial.toArray());
            const rect = descriptor.asset.frames.find(frame => frame.id === expectedStage).fallbackRectPx.rectPx;
            const size = descriptor.page.dimensionsPx;
            const expected = [(rect.x + .5) / size.width, 1 - (rect.y + rect.height - .5) / size.height,
              (rect.width - 1) / size.width, (rect.height - 1) / size.height].map(Math.fround);
            assert.deepEqual(Array.from(slot.atlas.rects.array.slice(slot.index * 4, slot.index * 4 + 4)),
              expected, 'each stock stage uses its registered distinct page cell');
          }
        }
      };
      if (label !== 'normal') assert.throws(check,
        /registered default atlas|actual registered page bytes|normal Bellweather must select/);
      else check();
    }
  } finally {
    for (const mesh of objects) { mesh.geometry.dispose(); mesh.material.dispose(); }
    console.warn = original.warn;
    for (const key of ['fetch', 'document', 'Image', 'location']) {
      if (original[key] === undefined) delete globalThis[key]; else globalThis[key] = original[key];
    }
    await rm(release.directory, { recursive: true, force: true });
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
