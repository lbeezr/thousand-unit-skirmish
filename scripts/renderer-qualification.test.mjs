// CPU rejection contracts. These tests do not constitute hosted GPU evidence.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { isGameEntry } from '../src/game-entry-session.mjs';
import { installReadbackProbe, qualifyRendererCapability, safeRequestPath, validateFrame, validateMotion, validateRelease } from './renderer-qualification.mjs';

const source = { revision: 'a'.repeat(40), dirty: false };
const pack = { sourceRevision: source.revision, sourceDirty: false, digest: `sha256:${'b'.repeat(64)}`,
  files: ['room-supervisor.mjs', 'server.mjs', 'src/main.js', 'package-lock.json'] };
const worker = { id: 0, team: 0, x: -20, z: 0, task: 'moving' };
const start = { number: 10, time: 100, worker };
function frame(number = 11) {
  return { version: 'WebGL 2.0', contextLost: false, glError: 0, number, time: number * 10,
    pixels: Array.from({ length: 48 }, (_, i) => [i, 20, 40, 255]).flat(),
    worker: { ...worker, x: worker.x + (number - 10) }, pngSha256: String(number % 10).repeat(64),
    canvasSha256: String(number % 10).repeat(64), canvasWidth: 1280, canvasHeight: 720 };
}
function png() {
  const bytes = Buffer.alloc(12000); Buffer.from('89504e470d0a1a0a', 'hex').copy(bytes);
  bytes.write('IHDR', 12); bytes.writeUInt32BE(1280, 16); bytes.writeUInt32BE(720, 20); return bytes;
}

test('release acceptance requires exact clean source, complete entries and a digest', () => {
  validateRelease(pack, source);
  for (const change of [{ sourceRevision: 'c'.repeat(40) }, { sourceDirty: true }, { digest: 'unknown' },
    { files: [] }, { files: [...pack.files, '../private'] }, { files: [...pack.files, '/private'] },
    { files: [...pack.files, 'server.mjs'] }]) assert.throws(() => validateRelease({ ...pack, ...change }, source));
  for (const change of [{ revision: null }, { dirty: true }]) assert.throws(() => validateRelease(pack, { ...source, ...change }));
});

test('request evidence retains exact local known paths without queries, credentials or arbitrary paths', () => {
  const origin = 'http://127.0.0.1:4321';
  assert.equal(safeRequestPath(`${origin}/src/main.js?token=private-token`, origin, pack.files), '/src/main.js');
  assert.equal(safeRequestPath(`${origin}/vendor/three.module.js`, origin, pack.files), '/vendor/three.module.js');
  assert.equal(safeRequestPath(`${origin}/favicon.ico`, origin, pack.files), '/favicon.ico');
  for (const url of ['invalid', 'https://remote.invalid/src/main.js', `${origin}/api/rooms/private-invite`, `${origin}/private-token`]) {
    assert.equal(safeRequestPath(url, origin, pack.files), null);
  }
});

test('frame rejection covers GL/context, blank pixels, wrong image and nonmoving state', () => {
  validateFrame(frame(), png(), png());
  for (const change of [{ version: 'WebGL 1.0' }, { contextLost: true }, { glError: 1282 }, { number: 0 },
    { time: NaN }, { pixels: [] }, { pixels: Array(192).fill(0) }, { pixels: Array(48).fill([0, 0, 0, 255]).flat() },
    { pixels: frame().pixels.map((v, i) => i === 0 ? 256 : v) }, { worker: null },
    { worker: { ...worker, x: NaN } }, { worker: { ...worker, task: 'idle' } }, { canvasWidth: 0 }, { canvasHeight: 1 }]) {
    assert.throws(() => validateFrame({ ...frame(), ...change }, png(), png()));
  }
  for (const bad of [Buffer.alloc(12000), png().subarray(0, 100), (() => { const p = png(); p.writeUInt32BE(1, 16); return p; })()]) {
    assert.throws(() => validateFrame(frame(), bad, png()));
    assert.throws(() => validateFrame(frame(), png(), bad));
  }
});

test('two live captures must retain identity and advance worker, frame, time and image', () => {
  const first = frame(), second = frame(12); validateMotion(start, [first, second]);
  assert.throws(() => validateMotion(start, [first]));
  for (const change of [{ number: first.number }, { time: first.time }, { pngSha256: first.pngSha256 },
    { pngSha256: null }, { canvasSha256: first.canvasSha256 }, { canvasSha256: null }, { worker: { ...second.worker, x: first.worker.x } },
    { worker: { ...second.worker, id: 1 } }, { worker: { ...second.worker, team: 1 } }]) {
    assert.throws(() => validateMotion(start, [first, { ...second, ...change }]));
  }
});

test('readback runs after the actual animation callback and retains early failures without payloads', async () => {
  let raf, rendered = false, reads = 0; const errors = [];
  const gl = { drawingBufferWidth: 1280, drawingBufferHeight: 720, VERSION: 1, RGBA: 2, UNSIGNED_BYTE: 3,
    readPixels(x, y, width, height, format, type, pixel) {
      assert.equal(rendered, true); assert.ok(x >= 0 && x < 1280 && y >= 0 && y < 720);
      assert.equal(width, 1); assert.equal(height, 1); pixel.set([++reads, 20, 40, 255]);
    }, getParameter: () => 'WebGL 2.0', getError: () => 0, isContextLost: () => false };
  const window = { requestAnimationFrame: callback => { raf = callback; return 1; },
    addEventListener: (_, callback) => errors.push(callback), __rtsEnvironmentStateSnapshot: { workers: [worker] } };
  const context = vm.createContext({ window, console: { error() {} }, document: {
    querySelector: () => ({ getContext: () => gl, toDataURL: () => `data:image/png;base64,${png().toString('base64')}` }),
  } });
  vm.runInContext(`(${installReadbackProbe.toString()})()`, context);
  assert.equal(window.__rtsCaptureDiagnostics, true);
  assert.equal(isGameEntry('http://localhost/'), false);
  vm.runInContext("console.error('private-session-token')", context);
  errors[0]({ target: window });
  const capture = window.__rtsQualification.request(0);
  window.requestAnimationFrame(() => { rendered = true; }); raf(110);
  const actual = JSON.parse(JSON.stringify(await capture));
  validateFrame(actual, png(), Buffer.from(actual.canvasPng, 'base64')); assert.equal(reads, 48); assert.equal(actual.number, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(window.__rtsQualification.errors)), [{ kind: 'console-error' }, { kind: 'exception' }]);
  assert.doesNotMatch(JSON.stringify(window.__rtsQualification.errors), /private-session-token/);
});

test('existing snapshot and asset diagnostics opt in without changing normal menu entry', async () => {
  const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
  const snapshot = main.slice(main.indexOf('function updateEnvironmentStateCaptureSnapshot('), main.indexOf('\nfunction applyWaypointQueueCounts('));
  const assetCallback = main.slice(main.indexOf('resourceStateAssetsReady.then((status) => {'), main.indexOf('\nfunction buildFogOverlay('));
  const placementStart = main.lastIndexOf("  if (roomPageUrl.searchParams.get('rendererCapture')");
  const placementSnapshot = main.slice(placementStart, main.indexOf('\n  renderer.render(scene, camera);', placementStart));
  for (const [flag, query, enabled] of [[undefined, '', false], [false, '', false], [true, '', true],
    ['true', '', false], [undefined, '?rendererCapture=environment-state', true]]) {
    let callback;
    const window = { __rtsCaptureDiagnostics: flag };
    const context = vm.createContext({ window, roomPageUrl: new URL(`http://localhost/${query}`),
      resourceStateAssetsReady: { then(fn) { callback = fn; } },
      camera: {zoom: .91}, localTeam: 0, mapDefinition: {}, resourceNodeVisuals: new Map(), mapObjects: [],
      constructionGroundMeshes: new Map(), palisadeGroundMeshes: new Map(), RESOURCE_STATE_ASSET_STATUS: 'fixture',
      sendCommand: () => true,
      treeTargetCaptureSnapshot: () => null,
      buildingPlacementPreview: { sprite: null }, buildPlacementActive: false, buildPlacementPending: false,
      buildPlacementType: 'house', buildPlacementOrientation: 0,
      placementGhost: { visible: false, position: { toArray: () => [0, 0, 0] } },
      ui: {}, latestBuildings: [], buildingVisuals: new Map(),
    });
    vm.runInContext(`${snapshot}\n${assetCallback}\n${placementSnapshot}\nupdateEnvironmentStateCaptureSnapshot({mapId:'veyrholds-terraced-vale', units:[]})`, context);
    callback({ ready: false });
    assert.equal(Boolean(window.__rtsEnvironmentStateSnapshot), enabled);
    assert.equal(Boolean(window.__rtsEnvironmentAssetStatus), enabled);
    assert.equal(Boolean(window.__rtsBuildingPlacementSnapshot), enabled);
    if (enabled) assert.equal(window.__rtsEnvironmentStateSnapshot.mapId, 'veyrholds-terraced-vale');
    if (!query) assert.equal(isGameEntry(context.roomPageUrl), false);
  }
});

test('hosted workflow is bounded, read-only, non-root and retains failures', async () => {
  const workflow = await readFile(new URL('../.github/workflows/renderer-qualification.yml', import.meta.url), 'utf8');
  assert.match(workflow, /runs-on: ubuntu-latest/); assert.match(workflow, /timeout-minutes: 10/);
  assert.match(workflow, /contents: read/); assert.match(workflow, /id -u.*-gt 0/);
  assert.match(workflow, /if: always\(\)/); assert.match(workflow, /retention-days: 1/);
  assert.doesNotMatch(workflow, /continue-on-error|no-sandbox|sudo|secrets\./);
  assert.ok(workflow.indexOf('renderer-qualification.mjs --preflight') < workflow.indexOf('renderer-qualification.mjs "'));
  assert.match(workflow, /execFileSync\('npm', \['ci', '--omit=dev', '--no-audit', '--no-fund'\], \{ cwd: pack.directory/);
  assert.ok(workflow.indexOf('Pack clean source') < workflow.indexOf('Install locked packed runtime dependencies'));
  assert.ok(workflow.indexOf('Install locked packed runtime dependencies') < workflow.indexOf('Capture live packed-game movement'));
});

test('preflight retries only owned-profile ENOTEMPTY cleanup, with one browser launch and retained errno', async () => {
  for (const [failureCode, failures, expectedAttempts, status] of [
    ['ENOTEMPTY', 1, 2, 'ready'], ['ENOTEMPTY', 3, 3, 'blocked'], ['EPERM', 1, 1, 'blocked'],
    ['EACCES', 1, 1, 'blocked'], ['private-error-code', 1, 1, 'blocked'],
  ]) {
    let launches = 0, disposals = 0;
    const report = await qualifyRendererCapability({ getSource: () => source, openBrowser: async () => {
      launches++;
      return { version: { product: 'CPU mock' }, page: async () => ({ errors: [], cdp: { on() {}, evaluate: async () => ({
        available: true, renderer: { version: 'WebGL 2.0', unmaskedName: 'CPU mock' },
        contextLost: false, glError: 0, samples: [[17, 33, 65, 255], [91, 123, 177, 255]],
      }) } }), dispose: async () => { if (++disposals <= failures) throw Object.assign(new Error('private-token'), { code: failureCode }); } };
    } });
    assert.equal(launches, 1); assert.equal(disposals, expectedAttempts); assert.equal(report.status, status);
    assert.equal(report.cleanup.attempts, expectedAttempts); assert.equal(report.webglReadbackPassed, true);
    assert.equal(report.cleanup.errors[0].systemCode, failureCode === 'private-error-code' ? null : failureCode);
    assert.doesNotMatch(JSON.stringify(report), /private-/);
  }
});

test('actual orchestration retains early network/exception flags, safe OS codes and cleanup on failure', async () => {
  const files = [...pack.files, 'index.html', 'assets/mock.png'], bytes = Buffer.from('packed test bytes');
  const lockBytes = Buffer.from(JSON.stringify({ packages: { 'node_modules/three': { version: '0.180.0' } } }));
  const digest = createHash('sha256');
  for (const file of [...files].sort()) digest.update(file).update('\0').update(file === 'package-lock.json' ? lockBytes : bytes).update('\0');
  const manifest = { sourceRevision: source.revision, sourceDirty: false, digest: `sha256:${digest.digest('hex')}`, files };
  // Execute the actual orchestration with CPU-only boundaries; never launch a
  // browser/server or mistake these injected bytes for visual qualification.
  let code = (await readFile(new URL('./renderer-qualification.mjs', import.meta.url), 'utf8'))
    .replace(/^import .*;\n/gm, '').replace(/^export /gm, '').replace(/const root = .*;/, "const root = '/fixture';");
  code = code.slice(0, code.indexOf('\nif (process.argv[1]'));
  assert.match(code, /const port = await reservePort\(\)/);
  code = code.replace('const port = await reservePort()', 'const port = 4321');
  for (const mode of ['browser-fault', 'asset-timeout', 'spawn-fault', 'evidence-fault', 'missing-dependency',
    'wrong-version', 'vendor-404', 'vendor-hash', 'room-404', 'optional-icon', 'icon-forbidden', 'saturated-icons',
    'building-fault-after-movement', 'feature-pass', 'feature-blocked', 'feature-timeout', 'feature-private-assertion', 'feature-page-limit', 'second-page-fault']) {
    let written, probeReads = 0, launches = 0, pageCount = 0, savedRuntime; const cleanup = [], listeners = new Map();
    const featureMode = mode.startsWith('feature-') || mode === 'second-page-fault';
    const buildingMode = mode === 'building-fault-after-movement'; let frameNumber = 10;
    const variedPng = number => { const p = png(); p[p.length - 1] = number; return p; };
    const fault = Object.assign(new Error('private-token-in-error'), { code: mode === 'spawn-fault' ? 'ENOENT' : 'EPERM' });
    const server = { pid: 123, exitCode: null, stdout: { on() {} }, stderr: { on() {} },
      on(event, callback) { if (mode === 'spawn-fault' && event === 'error') callback(fault); } };
    const iconMode = ['optional-icon', 'icon-forbidden'].includes(mode);
    const page = { errors: iconMode || featureMode || buildingMode ? [] : ['private-browser-token'], wait: async expression => {
      if (!buildingMode) throw new Error('asset timeout: private-token');
      if (expression.includes('AssetStatus')) return { ready: true, oakDepletionAtlas: true, loadedFiles: [
        { path: 'assets/mock.png', sha256: createHash('sha256').update(bytes).digest('hex'), dimensionsPx: { width: 1, height: 1 } }] };
      return { mapId: 'open-field', team: 0, workers: [worker] };
    }, cdp: {
      on: (event, callback) => listeners.set(event, callback),
      call: async method => {
        if (buildingMode && method === 'Page.captureScreenshot') return { data: variedPng(frameNumber).toString('base64') };
        assert.equal(method, 'Page.navigate'); if (buildingMode) return;
        if (mode === 'saturated-icons') for (let i = 0; i < 100; i++) {
          listeners.get('Network.responseReceived')({ response: { status: 404, url: 'http://127.0.0.1:4321/favicon.ico' } });
        }
        listeners.get('Network.responseReceived')({ response: { status: iconMode ? mode === 'optional-icon' ? 404 : 403 : 503,
          url: `http://127.0.0.1:4321/${iconMode ? 'favicon.ico' : 'src/main.js'}?token=private-token` } });
        if (!iconMode) {
          listeners.get('Network.requestWillBeSent')({ requestId: '1', request: { url: 'http://127.0.0.1:4321/src/main.js?token=private-token' } });
          listeners.get('Network.loadingFailed')({ requestId: '1', canceled: true });
        }
      },
      evaluate: async expression => {
        if (buildingMode) {
          if (expression.startsWith('({worker:')) return start;
          if (expression.startsWith('window.__rtsEnvironmentCaptureCommand(')) return true;
          if (expression.startsWith('window.__rtsQualification.request(')) return { ...frame(++frameNumber), canvasPng: variedPng(frameNumber).toString('base64') };
        }
        if (expression !== 'window.__rtsQualification.errors') return { entry: 'game', boot: 'ready', canvas: true,
          assets: { ready: false, state: 'load-failed', loaded: 0, reason: 'private-token' }, private: 'private-token' };
        probeReads++; cleanup.push('read-flags'); if (mode === 'evidence-fault') throw fault;
        if (iconMode || featureMode || buildingMode) return [];
        return [{ kind: 'console-error', payload: 'private-token' }, { kind: 'resource-error' }]; },
    } };
    const context = vm.createContext({ assert, createHash, Buffer, path, os, Date, setTimeout, AbortSignal, URL,
      captureBuildingOrientation: async () => { assert.equal(frameNumber, 12, 'failure follows two successful movement frames'); throw new Error('placement timeout'); },
      process: { getuid: () => 1000, execPath: 'node', env: { PATH: 'safe' } },
      execFileSync: (_, args) => args[0] === 'rev-parse' ? source.revision : '',
      mkdir: async () => {}, mkdtemp: async () => '/owned-temp', rm: async () => { cleanup.push('temp'); },
      readFile: async file => file === '/pack.json' ? JSON.stringify({ directory: '/pack', ...manifest })
        : file.endsWith('release-manifest.json') ? JSON.stringify(manifest)
        : file.endsWith('package-lock.json') ? lockBytes
        : file.endsWith('node_modules/three/package.json') ? mode === 'missing-dependency'
          ? Promise.reject(Object.assign(new Error('private-token'), { code: 'ENOENT' }))
          : JSON.stringify({ name: 'three', version: mode === 'wrong-version' ? '0.179.0' : '0.180.0' }) : bytes,
      writeFile: async (file, text) => { if (file.endsWith('qualification.json')) written = JSON.parse(text); }, spawn: (_, args, options) => {
        assert.equal(args[0], '/pack/room-supervisor.mjs');
        assert.equal(options.env.RTS_ROOM_DATA_DIRECTORY, '/owned-temp/rooms');
        assert.equal(options.env.RTS_MAP, featureMode ? undefined : 'maps/open-field.json');
        assert.equal(options.env.RTS_ACCESS_PASSWORD, undefined); return server;
      },
      stopChild: async (_, options) => { assert.equal(options.graceMs, 9000); cleanup.push('server'); },
      fetch: async url => ({ ok: true, status: (mode === 'vendor-404' && url.endsWith('/vendor/three.module.js'))
        || (mode === 'room-404' && url.endsWith('/api/rooms/status')) ? 404 : 200,
        json: async () => ({ ok: true, enabled: true }),
        arrayBuffer: async () => mode === 'vendor-hash' && url.endsWith('/vendor/three.module.js') ? Buffer.from('different') : bytes }),
      createFortifiedBrowser: async () => { launches++; if (mode === 'browser-fault') throw fault;
        return { version: { product: 'CPU mock' }, page: async url => { assert.equal(url, 'about:blank'); pageCount++;
          return mode === 'second-page-fault' && pageCount === 2 ? { ...page, errors: ['private-second-page-token'] } : page; },
          dispose: async () => { cleanup.push('browser'); } }; },
    });
    vm.runInContext(code, context);
    const captureCase = featureMode ? { id: 'novice-flow', run: async runtime => {
      savedRuntime = runtime;
      assert.equal(runtime.origin, 'http://127.0.0.1:4321'); assert.equal(runtime.pack.sourceRevision, source.revision);
      if (mode === 'second-page-fault') await runtime.openPage();
      if (mode === 'feature-timeout') throw vm.runInContext('new CaptureCaseTimeoutError()', context);
      if (mode === 'feature-private-assertion') assert.fail('private-session-token');
      if (mode === 'feature-page-limit') for (let i = 0; i < 5; i++) await runtime.openPage();
      return mode === 'feature-blocked' ? 'blocked' : 'passed';
    } } : undefined;
    const report = JSON.parse(JSON.stringify(await context.qualifyPackedGame('/pack.json', '/evidence', { captureCase, buildingPlacement: buildingMode })));
    const expectedStatus = mode === 'feature-pass' ? 'passed' : mode === 'feature-blocked' ? 'blocked' : 'failed';
    assert.equal(report.status, expectedStatus); assert.equal(written.status, expectedStatus);
    assert.ok(cleanup.includes('server'));
    if (!['missing-dependency', 'wrong-version'].includes(mode)) assert.ok(cleanup.includes('temp'));
    if (cleanup.includes('temp')) assert.ok(cleanup.indexOf('server') < cleanup.indexOf('temp'));
    assert.doesNotMatch(JSON.stringify(report), /private-.*token/);
    if (buildingMode) {
      assert.equal(report.frames.length, 2); assert.equal(report.issues[0].stage, 'building-placement');
      assert.equal(report.issues[0].code, 'execution-failed'); assert.equal(report.unexpectedBrowserEvent, false);
      continue;
    }
    if (featureMode) {
      assert.equal(report.scope, 'ordinary-feature-novice-flow'); assert.equal(report.server.map, null);
      assert.equal(report.pageBoots.length, mode === 'second-page-fault' ? 2 : mode === 'feature-page-limit' ? 5 : 1);
      const previousPages = pageCount;
      await assert.rejects(savedRuntime.openPage()); assert.equal(pageCount, previousPages);
      if (mode === 'feature-private-assertion') {
        assert.equal(report.issues[0].code, 'contract-failed');
        assert.equal(report.issues[0].message, 'Qualification failed during scenario');
      }
      if (mode === 'feature-timeout') assert.equal(report.issues[0].code, 'scenario-timeout');
      if (mode === 'second-page-fault') assert.ok(report.issues.some(issue => issue.code === 'browser-errors'));
      continue;
    }
    if (['missing-dependency', 'wrong-version', 'vendor-404', 'vendor-hash', 'room-404'].includes(mode)) {
      assert.equal(launches, 0);
      assert.equal(report.issues[0].stage, ['missing-dependency', 'wrong-version'].includes(mode) ? 'dependencies' : 'server');
      assert.equal(report.issues[0].code, mode === 'missing-dependency' ? 'execution-failed' : 'contract-failed');
      continue;
    }
    if (mode === 'browser-fault' || mode === 'spawn-fault') {
      assert.equal(report.issues[0].code, 'execution-failed');
      assert.equal(report.issues[0].systemCode, mode === 'spawn-fault' ? 'ENOENT' : 'EPERM');
    } else {
      assert.equal(probeReads, 1); assert.ok(cleanup.indexOf('read-flags') < cleanup.indexOf('browser'));
      assert.equal(report.boot.entry, 'game'); assert.equal(report.boot.assets.state, 'load-failed');
      if (mode === 'saturated-icons') {
        assert.equal(report.browserEvents.length, 100); assert.ok(report.browserEvents.every(e => e.expected));
        assert.equal(report.droppedBrowserEvents, 5); assert.equal(report.unexpectedBrowserEvent, true);
        assert.ok(report.issues.some(i => i.code === 'browser-errors')); continue;
      }
      if (iconMode) {
        assert.equal(report.browserEvents[0].path, '/favicon.ico');
        assert.equal(report.browserEvents[0].expected, mode === 'optional-icon');
        assert.equal(report.issues.some(i => i.code === 'browser-errors'), mode !== 'optional-icon'); continue;
      }
      assert.ok(report.browserEvents.some(e => e.kind === 'http-error' && e.status === 503));
      assert.ok(report.browserEvents.some(e => e.kind === 'request-failed' && e.path === '/src/main.js'));
      assert.ok(report.browserEvents.some(e => e.kind === 'exception' && e.count === 1));
      if (mode === 'evidence-fault') assert.ok(report.issues.some(i => i.code === 'browser-evidence-unavailable'));
      else assert.ok(report.browserEvents.some(e => e.kind === 'resource-error'));
    }
  }
});
