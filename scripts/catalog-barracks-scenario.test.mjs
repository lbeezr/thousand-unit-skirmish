import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { catalogBarracksObservation } from '../src/catalog-barracks-observation.mjs';
import { CATALOG_BARRACKS_MAP, runCatalogBarracksScenario, validatePaidBarracks, validateScenarioObservation } from './catalog-barracks-scenario.mjs';

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
    decoded: true, label: `Follow ${size}`, objectFit: 'contain' })) };

test('owned observation projects actual loader data without changing world objects or disclosing the other seat', () => {
  const sprite = { visible: true, material: { map: { image: { width: 1024, height: 1024 } } },
    scale: { x: 8, y: 8 }, center: { x: sourceCapture.pivot[0], y: sourceCapture.pivot[1] },
    userData: { capturedBuildingArt: { manifestUrl: `https://fixture.invalid/${manifestPath}`, manifest,
      requestKey: sourceCapture.requestKey, bodyDepth: { visible: true, material: { map: {} } } } } };
  const unit = { id: 0, team: 0, kind: 'worker', hp: 30, x: 1, z: 2, renderX: 1.1, renderZ: 2.1, task: 'idle' };
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
  assert.deepEqual({ sprite, unit }, before);
  observed.selectedIds.push(2); assert.deepEqual(args.selectedIds, [0]);
});

test('catalog checkpoints reject alternate art, wrong context, hidden/undecoded samples and premature approval', () => {
  validateScenarioObservation(catalog, { team: 0, zoom: 0.91, catalog: true });
  for (const mutate of [
    o => { o.alternateAssets = true; }, o => { o.state.team = 1; }, o => { o.state.mapId = 'open-field'; },
    o => { o.state.viewport[0] = 640; }, o => { o.state.dpr = 2; }, o => { o.state.zoom = 0.48; },
    o => { o.state.frame = 0; }, o => { o.catalogVisible = false; }, o => { o.grayscale = true; },
    o => { o.samples[0].decoded = false; }, o => { o.samples[0].width = 32; },
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
    const pack = { directory, sourceRevision: revision, sourceDirty: false, digest: `sha256:${'b'.repeat(64)}`,
      files: ['room-supervisor.mjs', 'server.mjs', 'src/main.js', 'package-lock.json'] };
    for (const [index, entryEvidence] of [undefined, { ordinaryEntry: true, sourceRevision: revision,
      mapId: CATALOG_BARRACKS_MAP, mapSha256: '0'.repeat(64) }, { ordinaryEntry: false, sourceRevision: revision,
      mapId: CATALOG_BARRACKS_MAP, mapSha256: createHash('sha256').update(mapBytes).digest('hex') }].entries()) {
      const output = path.join(directory, String(index));
      const report = await runCatalogBarracksScenario({ page: { cdp: { evaluate() { assert.fail('invalid entry queried the browser'); } } },
        pack, revision, browserVersion: { product: 'CPU mock' }, outputDirectory: output, entryEvidence },
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
