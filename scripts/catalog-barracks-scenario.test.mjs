import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { catalogBarracksObservation } from '../src/catalog-barracks-observation.mjs';
import { CATALOG_BARRACKS_MAP, CATALOG_BARRACKS_FLAGS, catalogBarracksBeforeScript, observeCatalogPage,
  runCatalogBarracksScenario, validatePaidBarracks, validateScenarioObservation, workerClearanceExpression } from './catalog-barracks-scenario.mjs';

const revision = 'a'.repeat(40);
const manifestPath = 'assets/buildings/frontier-civilization-military-models-v1/barracks-complete-renderer.json';
const manifest = JSON.parse(await readFile(new URL(`../${manifestPath}`, import.meta.url)));
const camera = manifest.camera, view = manifest.completeState.views.find(row => row.index === 1);
const base = { frame: 12, renderedAt: 200, mapId: CATALOG_BARRACKS_MAP, team: 0, zoom: 0.91,
  viewport: [1280, 720], dpr: 1, bank: { food: 2000, wood: 3000 }, buildings: [], workers: [], selectedIds: [], selectedBuildingId: null };
const sourceCapture = { manifestPath: `/${manifestPath}`, requestKey: 'complete:1:#5aa7d7',
  spriteVisible: true, bodyDepthVisible: true,
  scale: camera.framePixels.map(value => value / camera.pixelsPerWorldUnit),
  pivot: [camera.anchorPixelFromTopLeft[0] / camera.framePixels[0], 1 - camera.anchorPixelFromTopLeft[1] / camera.framePixels[1]],
  view: { path: view.path, sha256: view.sha256 }, texturePixels: camera.framePixels };
const complete = { ...base, bank: { food: 2000, wood: 2825 }, buildings: [{ id: 7, team: 0, type: 'barracks',
  x: -20.5, z: -6.5, hp: 1800, maxHp: 1800, progress: 1, complete: true,
  groupVisible: true, fallbackVisible: false, capture: sourceCapture }] };
const constructing = { ...complete, buildings: [{ ...complete.buildings[0], complete: false, progress: 0.2,
  fallbackVisible: true, capture: { ...sourceCapture, spriteVisible: false, bodyDepthVisible: false, requestKey: null } }] };
const catalog = { alternateAssets: false, state: base, catalogVisible: true, grayscale: false,
  catalog: { cameraZoom: 0.91, building: { defaultBinding: true, spriteVisible: true, readability: 'unverified' },
    icon: { readability: 'unverified' } },
  samples: [16, 20, 24].map(size => ({ width: size, height: size, source: '/assets/ui/icons/actions/follow.svg',
    decoded: true, label: `Follow ${size}`, objectFit: 'contain', visible: true })) };

test('owned observation projects actual loader data without changing world objects or disclosing the other seat', () => {
  const sprite = { visible: true, material: { map: { image: { width: 1024, height: 1024 } } },
    scale: { x: 8, y: 8 }, center: { x: sourceCapture.pivot[0], y: sourceCapture.pivot[1] },
    userData: { capturedBuildingArt: { manifestUrl: `https://fixture.invalid/${manifestPath}`, manifest,
      requestKey: sourceCapture.requestKey, bodyDepth: { visible: true, material: { map: {} } } } } };
  const unit = { id: 0, team: 0, kind: 'worker', hp: 30, serverX: 1, serverZ: 2, renderX: 1.1, renderZ: 2.1, task: 'idle' };
  const args = { ...base, time: base.renderedAt, food: 2000, wood: 2825,
    selectedIds: [0], units: [unit, { ...unit, id: 1, team: 1 }],
    buildings: [...complete.buildings, { ...complete.buildings[0], id: 8, team: 1 }],
    buildingVisuals: new Map([[7, { group: { visible: true }, frontierCaptureEntry: { sprite, fallbackRoot: { visible: false } } }]]),
    project: point => ({ x: point.x + 400, y: point.z + 300, depth: 0 }) };
  const before = structuredClone({ sprite, unit });
  const observed = catalogBarracksObservation(args);
  assert.deepEqual(observed.workers.map(row => row.id), [0]); assert.deepEqual(observed.buildings.map(row => row.id), [7]);
  assert.deepEqual(observed.bank, complete.bank); assert.equal(observed.renderedAt, base.renderedAt);
  assert.deepEqual(observed.buildings[0].capture, sourceCapture);
  assert.deepEqual(observed.workers[0].screen, { x: 401.1, y: 302.1, depth: 0 });
  assert.deepEqual([observed.workers[0].x, observed.workers[0].z, observed.workers[0].serverX, observed.workers[0].serverZ], [1.1, 2.1, 1, 2]);
  assert.deepEqual({ sprite, unit }, before);
  observed.selectedIds.push(2); assert.deepEqual(args.selectedIds, [0]);
});

test('actual mirrored clearance expressions parse and reject missing, empty or nonfinite Worker observations', () => {
  for (const site of [{ x: -20.5, z: -6.5 }, { x: 20.5, z: -6.5 }]) {
    const expression = workerClearanceExpression([0], site);
    const evaluate = state => vm.runInNewContext(expression, { o: { state } });
    assert.equal(evaluate({ workers: [{ id: 0, x: site.x + 4, z: site.z }] }), true);
    assert.equal(evaluate({}), false);
    for (const workers of [[], [{ id: 1, x: site.x + 4, z: site.z }],
      [{ id: 0, x: site.x, z: site.z }], [{ id: 0, x: undefined, z: undefined }]]) {
      assert.equal(evaluate({ workers }), false);
    }
    assert.equal(vm.runInNewContext(workerClearanceExpression([], site), { o: { state: { workers: [] } } }), false);
  }
});

test('room-only beforeScript preserves ordinary menu entry and attaches QA flags before real room main loads', () => {
  for (const room of [false, true]) {
    const href = `http://127.0.0.1:4321/${room ? `?room=${'A'.repeat(32)}` : ''}`;
    let replaced = null;
    const changed = vm.runInNewContext(catalogBarracksBeforeScript(), { URL, location: { href },
      history: { replaceState: (_, __, url) => { replaced = url; } } });
    assert.equal(changed, room);
    if (!room) assert.equal(replaced, null);
    else {
      const result = new URL(replaced); assert.equal(result.searchParams.get('room'), 'A'.repeat(32));
      for (const [key, value] of Object.entries(CATALOG_BARRACKS_FLAGS)) assert.equal(result.searchParams.get(key), value);
    }
  }
});

test('actual browser observation rejects glyph rows outside panel/viewport, clipped labels, occlusion and invisibility', () => {
  const rect = (left, top, width, height) => ({ left, top, right: left + width, bottom: top + height, width, height });
  for (const defect of [null, 'off-scroll', 'clipped-label', 'occluded', 'transparent']) {
    const imageRect = rect(930, 350, 16, 16);
    const rowRect = defect === 'off-scroll' ? rect(930, 710, 90, 20)
      : defect === 'clipped-label' ? rect(930, 350, 340, 20) : rect(930, 350, 90, 20);
    const root = { isConnected: true, clientLeft: 0, clientTop: 0, clientWidth: 360, clientHeight: 610,
      getBoundingClientRect: () => rect(900, 80, 360, 610), querySelectorAll: () => [image], querySelector: () => image };
    const row = { textContent: 'Follow 16', getBoundingClientRect: () => rowRect, contains: node => node === image,
      parentElement: { style: { filter: '' } } };
    const image = { complete: true, naturalWidth: 24, parentElement: row, style: { objectFit: 'contain' },
      getBoundingClientRect: () => imageRect, getAttribute: () => '/assets/ui/icons/actions/follow.svg' };
    const observation = vm.runInNewContext(`(${observeCatalogPage.toString()})()`, {
      URL, location: { href: 'http://127.0.0.1:4321/?room=public-test' }, innerWidth: 1280, innerHeight: 720,
      window: { __rtsCatalogBarracksCapture: { snapshot: base }, __rtsAssetReadabilitySnapshot: catalog.catalog },
      getComputedStyle: () => ({ visibility: 'visible', opacity: defect === 'transparent' ? '0' : '1' }),
      document: { querySelector: () => root, elementFromPoint: () => defect === 'occluded' ? {} : image },
    });
    assert.equal(observation.samples[0].decoded, true, 'decoded dimensions alone cannot prove visibility');
    assert.equal(observation.samples[0].visible, defect === null);
  }
});

test('catalog checkpoints reject alternate art, wrong context, hidden/undecoded samples and premature approval', () => {
  validateScenarioObservation(catalog, { team: 0, zoom: 0.91, catalog: true });
  for (const mutate of [
    o => { o.alternateAssets = true; }, o => { o.state.team = 1; }, o => { o.state.mapId = 'open-field'; },
    o => { o.state.viewport[0] = 640; }, o => { o.state.dpr = 2; }, o => { o.state.zoom = 0.48; },
    o => { o.state.frame = 0; }, o => { o.catalogVisible = false; }, o => { o.grayscale = true; },
    o => { o.samples[0].decoded = false; }, o => { o.samples[0].visible = false; }, o => { o.samples[0].width = 32; },
    o => { o.samples[0].objectFit = 'cover'; }, o => { o.samples[0].label = ''; },
    o => { o.catalog.building.defaultBinding = false; }, o => { o.catalog.building.spriteVisible = false; },
    o => { o.catalog.cameraZoom = 0.48; }, o => { o.catalog.icon.readability = 'approved'; },
  ]) {
    const changed = structuredClone(catalog); mutate(changed);
    assert.throws(() => validateScenarioObservation(changed, { team: 0, zoom: 0.91, catalog: true }));
  }
  assert.throws(() => validateScenarioObservation(catalog, { team: 0, zoom: 0.91 }), /close the developer panel/);
});

test('paid construction accepts real payment and retained fallback, and rejects free/prebuilt/substituted outcomes', () => {
  validatePaidBarracks(base, constructing);
  for (const mutate of [
    o => { o.bank.wood = 3000; }, o => { o.bank.food = 1999; }, o => { o.buildings[0].team = 1; },
    o => { o.buildings[0].x = -10; }, o => { o.buildings[0].complete = true; },
    o => { o.buildings[0].groupVisible = false; }, o => { o.buildings[0].fallbackVisible = false; },
    o => { o.buildings[0].capture.spriteVisible = true; }, o => { o.buildings.push({ ...o.buildings[0], id: 8 }); },
  ]) {
    const changed = structuredClone(constructing); mutate(changed);
    assert.throws(() => validatePaidBarracks(base, changed));
  }
  assert.throws(() => validatePaidBarracks({ ...base, buildings: complete.buildings }, constructing), /one new paid/);
});

test('Complete checkpoints reject wrong loaded pixels, heading, pivot/density, depth or construction state', () => {
  validatePaidBarracks(base, complete, { complete: true, manifest });
  for (const mutate of [
    o => { o.buildings[0].capture.manifestPath = '/older-pack.json'; },
    o => { o.buildings[0].capture.requestKey = 'complete:7:#5aa7d7'; },
    o => { o.buildings[0].capture.view.sha256 = 'b'.repeat(64); },
    o => { o.buildings[0].capture.scale[0] = 16; }, o => { o.buildings[0].capture.pivot[0] = 0; },
    o => { o.buildings[0].capture.texturePixels = [512, 512]; },
    o => { o.buildings[0].capture.bodyDepthVisible = false; }, o => { o.buildings[0].fallbackVisible = true; },
    o => { o.buildings[0].hp = 900; }, o => { o.buildings[0].complete = false; },
  ]) {
    const changed = structuredClone(complete); mutate(changed);
    assert.throws(() => validatePaidBarracks(base, changed, { complete: true, manifest }));
  }
});

test('adapter cannot capture or launch without source, ordinary-entry and exact map-import receipts', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'rts-catalog-scenario-test-'));
  try {
    const mapBytes = await readFile(new URL('../docs/qa-evidence/default-frontier-buildings-2026-10-03/acceptance-map-flat.json', import.meta.url));
    const qualifiedSource = Object.freeze({ revision, digest: `sha256:${'b'.repeat(64)}` });
    for (const [index, entryEvidence] of [undefined, { ordinaryEntry: true, sourceRevision: revision,
      mapId: CATALOG_BARRACKS_MAP, mapSha256: '0'.repeat(64) }, { ordinaryEntry: false, sourceRevision: revision,
      mapId: CATALOG_BARRACKS_MAP, mapSha256: createHash('sha256').update(mapBytes).digest('hex') }].entries()) {
      const output = path.join(directory, String(index));
      const report = await runCatalogBarracksScenario({ page: { cdp: { evaluate() { assert.fail('invalid entry queried the browser'); } } },
        source: qualifiedSource, outputDirectory: output, entryEvidence },
      { capture() { assert.fail('invalid entry captured pixels'); } });
      assert.equal(report.status, 'failed'); assert.equal(report.issues[0].stage, 'context');
      assert.equal(report.readability, 'unverified'); assert.equal(report.paidBarracksAcceptance, 'open');
      assert.deepEqual(await readdir(output), ['catalog-barracks.json']);
    }
    const source = await readFile(new URL('./catalog-barracks-scenario.mjs', import.meta.url), 'utf8');
    assert.doesNotMatch(source, /import.*(?:child_process|fortified-browser)|qualifyRendererCapability\(|qualifyPackedGame\(|workflow_dispatch|__rtsEnvironmentCaptureCommand\(/);
    assert.match(source, /Input\.dispatchMouseEvent/); assert.match(source, /Input\.dispatchKeyEvent/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('normal entrypoints keep their art selectors outside the gated post-render observer', async () => {
  const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
  const start = main.indexOf('const catalogBarracksCapture =');
  const end = main.indexOf('\nfunction animate(', start);
  const hook = main.slice(start, end);
  assert.match(hook, /rendererCapture.*environment-state/); assert.match(hook, /assetScenario.*catalog-barracks/);
  assert.doesNotMatch(hook, /sendCommand|createGameplayBuildingVisual|frontierBuildingManifestUrl|camera\.zoom\s*=/);
  const render = main.indexOf('renderer.render(scene, camera);', end);
  const observe = main.indexOf('catalogBarracksCapture.snapshot = catalogBarracksObservation', render);
  assert.ok(observe > render);
});
