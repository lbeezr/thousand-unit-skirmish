// Bounded local packed-game proof. This is not staging or an art-acceptance baseline.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFortifiedBrowser } from './fortified-browser-fixture.mjs';
import { checkRendererCapability } from './renderer-capability.mjs';
import { stopChild } from './temporary-resources.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export class CaptureCaseTimeoutError extends Error {
  constructor() { super('Capture case exceeded its time bound'); this.name = 'CaptureCaseTimeoutError'; }
}

// Chrome descendants can finish writing an owned profile after Browser.close.
// Retry only its idempotent disposal on ENOTEMPTY, never browser launch, sandbox
// setup, permission failures or graphics checks. Retain the actual safe errno.
function withProfileCleanup(browser, cleanup) {
  return { ...browser, dispose: async () => {
      for (let attempt = 1; attempt <= cleanup.maxAttempts; attempt++) {
        cleanup.attempts++;
        try { await browser.dispose(); return; }
        catch (error) {
          cleanup.errors.push({ systemCode: ['ENOTEMPTY', 'EPERM', 'EACCES', 'EBUSY'].includes(error.code) ? error.code : null });
          if (error.code !== 'ENOTEMPTY' || attempt === cleanup.maxAttempts) throw error;
          await sleep(100 * attempt);
        }
      }
  } };
}
export async function qualifyRendererCapability({ openBrowser = createFortifiedBrowser, getSource } = {}) {
  const cleanup = { maxAttempts: 3, attempts: 0, errors: [] };
  const result = await checkRendererCapability({ getSource,
    openBrowser: async () => withProfileCleanup(await openBrowser(), cleanup) });
  return { ...result, cleanup };
}

export function validateRelease(pack, source) {
  assert.match(source.revision, /^[a-f0-9]{40}$/, 'source revision is required');
  assert.equal(source.dirty, false, 'qualification requires a clean checkout');
  assert.equal(pack.sourceRevision, source.revision, 'pack must match the checked-out source');
  assert.equal(pack.sourceDirty, false, 'qualification requires a clean release');
  assert.match(pack.digest, /^sha256:[a-f0-9]{64}$/, 'release digest is required');
  assert.ok(Array.isArray(pack.files) && ['room-supervisor.mjs', 'server.mjs', 'src/main.js', 'package-lock.json']
    .every(file => pack.files.includes(file)), 'pack must contain the supervisor, game server, renderer and lockfile');
  assert.equal(new Set(pack.files).size, pack.files.length, 'release entries must be unique');
  for (const file of pack.files) assert.ok(typeof file === 'string' && file !== ''
    && !path.isAbsolute(file) && !file.split(/[\\/]/).includes('..'), 'release entry must stay inside the pack');
}

// Retain only exact known local paths. Queries, invite codes, remote URLs and
// arbitrary error messages never enter an uploaded evidence artifact.
export function safeRequestPath(value, origin, files) {
  try {
    const url = new URL(value);
    if (url.origin !== origin) return null;
    return files.includes(url.pathname.slice(1))
      || ['/', '/vendor/three.module.js', '/vendor/three.core.js', '/api/rooms/status', '/favicon.ico'].includes(url.pathname)
      ? url.pathname : null;
  } catch { return null; }
}

export function validateFrame(frame, png, canvasPng) {
  assert.match(frame.version ?? '', /^WebGL 2\.0/, 'game must use WebGL2');
  assert.equal(frame.contextLost, false, 'game WebGL context was lost');
  assert.equal(frame.glError, 0, 'game readback returned a GL error');
  assert.ok(Number.isInteger(frame.number) && frame.number > 0 && Number.isFinite(frame.time), 'rendered frame identity is required');
  assert.ok(Array.isArray(frame.pixels) && frame.pixels.length === 192
    && frame.pixels.every(v => Number.isInteger(v) && v >= 0 && v <= 255), '48 RGBA readback samples are required');
  const colors = new Set(Array.from({ length: 48 }, (_, i) => frame.pixels.slice(i * 4, i * 4 + 4).join(',')));
  assert.ok(colors.size > 1 && frame.pixels.some((v, i) => i % 4 !== 3 && v > 0), 'game readback must contain nonblank varied pixels');
  assert.ok(png.length > 10000 && png.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')),
    'game screenshot must be a nonempty PNG');
  assert.equal(png.toString('ascii', 12, 16), 'IHDR', 'PNG dimensions are required');
  assert.equal(png.readUInt32BE(16), 1280, 'screenshot width must match the viewport');
  assert.equal(png.readUInt32BE(20), 720, 'screenshot height must match the viewport');
  assert.ok(Number.isInteger(frame.canvasWidth) && frame.canvasWidth >= 320
    && Number.isInteger(frame.canvasHeight) && frame.canvasHeight >= 200, 'game canvas dimensions are required');
  assert.ok(canvasPng.length > 10000 && canvasPng.subarray(0, 8).equals(png.subarray(0, 8)), 'canvas capture must be a nonempty PNG');
  assert.equal(canvasPng.toString('ascii', 12, 16), 'IHDR', 'canvas PNG dimensions are required');
  assert.equal(canvasPng.readUInt32BE(16), frame.canvasWidth, 'canvas PNG must match the drawing buffer width');
  assert.equal(canvasPng.readUInt32BE(20), frame.canvasHeight, 'canvas PNG must match the drawing buffer height');
  assert.ok(frame.worker && Number.isInteger(frame.worker.id) && Number.isInteger(frame.worker.team)
    && Number.isFinite(frame.worker.x) && Number.isFinite(frame.worker.z), 'live worker coordinates are required');
  assert.equal(frame.worker.task, 'moving', 'worker must be moving during capture');
}

export function validateMotion(start, frames) {
  assert.equal(frames.length, 2, 'two movement captures are required');
  let previous = start;
  for (const frame of frames) {
    assert.match(frame.pngSha256 ?? '', /^[a-f0-9]{64}$/, 'movement PNG digest is required');
    assert.match(frame.canvasSha256 ?? '', /^[a-f0-9]{64}$/, 'movement canvas digest is required');
    assert.equal(frame.worker.id, start.worker.id, 'captures must follow the commanded worker');
    assert.equal(frame.worker.team, start.worker.team, 'captures must retain the commanded team');
    assert.ok(frame.number > previous.number && frame.time > previous.time, 'rendered frames must advance');
    assert.ok(Math.hypot(frame.worker.x - previous.worker.x, frame.worker.z - previous.worker.z) >= 0.2,
      'live worker must move between captures');
    previous = frame;
  }
  assert.notEqual(frames[0].pngSha256, frames[1].pngSha256, 'movement screenshots must differ');
  assert.notEqual(frames[0].canvasSha256, frames[1].canvasSha256, 'game canvas pixels must advance independently of the HUD');
}

// Read immediately after the real animation callback renders: the game's default
// preserveDrawingBuffer=false makes a later arbitrary CDP readback unreliable.
export function installReadbackProbe() {
  // Enable existing diagnostics across normal menu/room navigation without
  // changing the entry URL, gameplay defaults or selecting preview assets.
  window.__rtsCaptureDiagnostics = true;
  const nativeRaf = window.requestAnimationFrame.bind(window);
  let number = 0, pending = null;
  window.__rtsQualification = { number: 0, errors: [], request: workerId => new Promise(resolve => { pending = { workerId, resolve }; }) };
  const nativeConsoleError = console.error.bind(console);
  console.error = (...args) => {
    window.__rtsQualification.errors.push({ kind: 'console-error' }); nativeConsoleError(...args);
  };
  window.addEventListener('error', event => window.__rtsQualification.errors.push({
    kind: event.target === window ? 'exception' : 'resource-error',
  }), true);
  window.addEventListener('unhandledrejection', () => window.__rtsQualification.errors.push({ kind: 'promise-rejection' }));
  window.requestAnimationFrame = callback => nativeRaf(time => {
    callback(time);
    window.__rtsQualification.number = ++number;
    if (!pending) return;
    const canvas = document.querySelector('#viewport canvas'), gl = canvas?.getContext('webgl2');
    if (!gl) { pending.resolve({ number, time, version: null }); pending = null; return; }
    const pixels = [], pixel = new Uint8Array(4);
    for (let y = 0; y < 6; y++) for (let x = 0; x < 8; x++) {
      gl.readPixels(Math.floor((x + 0.5) * gl.drawingBufferWidth / 8),
        Math.floor((y + 0.5) * gl.drawingBufferHeight / 6), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      pixels.push(...pixel);
    }
    pending.resolve({ number, time, version: gl.getParameter(gl.VERSION), contextLost: gl.isContextLost(),
      glError: gl.getError(), pixels, canvasWidth: gl.drawingBufferWidth, canvasHeight: gl.drawingBufferHeight,
      canvasPng: canvas.toDataURL('image/png').split(',')[1],
      worker: window.__rtsEnvironmentStateSnapshot?.workers.find(w => w.id === pending.workerId) });
    pending = null;
  });
}

async function reservePort() {
  const socket = createServer();
  await new Promise((resolve, reject) => { socket.once('error', reject); socket.listen(0, '127.0.0.1', resolve); });
  const { port } = socket.address();
  await new Promise((resolve, reject) => socket.close(error => error ? reject(error) : resolve()));
  return port;
}

// Ordinary feature adapters share the qualified pack/server/browser ownership.
// The default movement contract below remains independently available.
export async function qualifyPackedGame(packFile, evidenceDirectory, { captureCase } = {}) {
  await mkdir(evidenceDirectory, { recursive: true });
  const report = { schemaVersion: 1, scope: 'local-packed-game-movement', status: 'failed', sandbox: 'enabled',
    uid: process.getuid?.() ?? null, source: null, release: null, runtimeDependencies: [], frames: [], assets: [],
    browserEvents: [], droppedBrowserEvents: 0, unexpectedBrowserEvent: false, issues: [],
    cleanup: { maxAttempts: 3, attempts: 0, errors: [] } };
  let stage = 'release', browser, page, server, temporary;
  const pages = [], acquiringPages = new Set();
  let pagesOpen = true, pageCount = 0;
  const recordBrowserEvent = event => {
    if (event.expected !== true) report.unexpectedBrowserEvent = true;
    if (report.browserEvents.length < 100) report.browserEvents.push(event);
    else report.droppedBrowserEvents++;
  };
  try {
    if (captureCase) assert.ok(typeof captureCase.id === 'string' && /^[a-z][a-z-]{0,63}$/.test(captureCase.id) && typeof captureCase.run === 'function',
      'capture adapter identity and executable are required');
    if (captureCase) report.scope = `ordinary-feature-${captureCase.id}`;
    assert.ok(Number.isInteger(report.uid) && report.uid > 0, 'qualification must run as a non-root user');
    report.source = { revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
      dirty: execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim() !== '' };
    const pack = JSON.parse(await readFile(packFile, 'utf8'));
    validateRelease(pack, report.source);
    const manifest = JSON.parse(await readFile(path.join(pack.directory, 'release-manifest.json'), 'utf8'));
    assert.deepEqual(manifest, { sourceRevision: pack.sourceRevision, sourceDirty: pack.sourceDirty, digest: pack.digest, files: pack.files },
      'pack output must match its release manifest');
    const digest = createHash('sha256');
    for (const file of [...pack.files].sort()) digest.update(file).update('\0').update(await readFile(path.join(pack.directory, file))).update('\0');
    assert.equal(`sha256:${digest.digest('hex')}`, pack.digest, 'packed bytes must match the release digest');
    report.release = { sourceRevision: pack.sourceRevision, digest: pack.digest, files: pack.files.length };
    stage = 'dependencies';
    const lockBytes = await readFile(path.join(pack.directory, 'package-lock.json'));
    const lock = JSON.parse(lockBytes), installed = JSON.parse(await readFile(path.join(pack.directory, 'node_modules/three/package.json'), 'utf8'));
    assert.equal(installed.name, 'three', 'packed runtime must install Three.js');
    assert.ok(typeof lock.packages?.['node_modules/three']?.version === 'string', 'lockfile must identify Three.js');
    assert.equal(installed.version, lock.packages['node_modules/three'].version, 'installed Three.js must match the release lockfile');
    report.runtimeDependencies.push({ name: 'three', version: installed.version, lockSha256: sha256(lockBytes), files: [] });
    stage = 'server';
    temporary = await mkdtemp(path.join(os.tmpdir(), 'rts-packed-renderer-'));
    const port = await reservePort(), origin = `http://127.0.0.1:${port}`;
    let serverLog = '', serverError;
    server = spawn(process.execPath, [path.join(pack.directory, 'room-supervisor.mjs')], { cwd: pack.directory,
      env: { PATH: process.env.PATH, PORT: String(port), RTS_HOST: '127.0.0.1',
        ...(captureCase ? {} : { RTS_MAP: 'maps/open-field.json' }),
        RTS_CUSTOM_MAP_DIRECTORY: path.join(temporary, 'maps'), RTS_ROOM_DATA_DIRECTORY: path.join(temporary, 'rooms') },
      stdio: ['ignore', 'pipe', 'pipe'] });
    server.on('error', error => { serverError = error; });
    for (const stream of [server.stdout, server.stderr]) stream.on('data', bytes => { serverLog = (serverLog + bytes).slice(-12000); });
    const deadline = Date.now() + 20000;
    while (true) {
      if (serverError) throw serverError;
      assert.equal(server.exitCode, null, 'packed server exited before startup');
      const response = await fetch(`${origin}/health`, { signal: AbortSignal.timeout(1000) }).catch(() => null);
      if (response?.ok && (await response.json()).ok) break;
      assert.ok(Date.now() < deadline, 'packed server startup timed out'); await sleep(100);
    }
    // Retain only known safe startup facts, never protocol frames or session tokens.
    report.server = { entry: 'room-supervisor.mjs', map: captureCase ? null : 'open-field', logBytes: Buffer.byteLength(serverLog), listening: true };
    const roomStatus = await fetch(`${origin}/api/rooms/status`, { signal: AbortSignal.timeout(5000) });
    assert.equal(roomStatus.status, 200, 'packed supervisor must serve the room-status API');
    assert.equal((await roomStatus.json()).enabled, true, 'packed room service must be enabled');
    for (const file of ['index.html', 'src/main.js', 'vendor/three.module.js', 'vendor/three.core.js']) {
      const response = await fetch(`${origin}/${file}`, { signal: AbortSignal.timeout(5000) });
      assert.equal(response.status, 200, 'packed entry file must be served');
      const hash = sha256(Buffer.from(await response.arrayBuffer()));
      const vendor = file.startsWith('vendor/');
      assert.equal(hash, sha256(await readFile(path.join(pack.directory, vendor ? `node_modules/three/build/${path.basename(file)}` : file))),
        'served entry must match packed runtime bytes');
      (vendor ? report.runtimeDependencies[0].files : report.assets).push({ path: file, sha256: hash });
    }
    stage = 'browser'; browser = withProfileCleanup(await createFortifiedBrowser(), report.cleanup); report.browser = browser.version;
    const openPage = () => {
      const allowed = pagesOpen, count = ++pageCount;
      const acquisition = (async () => {
      assert.equal(allowed, true, 'capture context is closed');
      assert.ok(count <= 5, 'capture supports one primary and four additional pages');
      const page = await browser.page('about:blank', { beforeScript: `(${installReadbackProbe.toString()})()` });
      pages.push(page);
      assert.equal(pagesOpen, true, 'capture context closed during page acquisition');
      page.cdp.on('Runtime.consoleAPICalled', event => {
        if (event.type === 'error') recordBrowserEvent({ kind: 'console-error' });
      });
      const requests = new Map();
      page.cdp.on('Network.requestWillBeSent', event => {
        if (requests.size < 2000) requests.set(event.requestId, safeRequestPath(event.request.url, origin, pack.files));
      });
      page.cdp.on('Network.responseReceived', event => {
        if (event.response.status >= 400) {
          const pathname = safeRequestPath(event.response.url, origin, pack.files);
          recordBrowserEvent({ kind: 'http-error', status: event.response.status, path: pathname,
            // Chrome's implicit optional icon request is not a game resource.
            expected: event.response.status === 404 && pathname === '/favicon.ico' });
        }
      });
      page.cdp.on('Network.loadingFinished', event => requests.delete(event.requestId));
      page.cdp.on('Network.loadingFailed', event => {
        recordBrowserEvent({ kind: 'request-failed', path: requests.get(event.requestId) ?? null, canceled: event.canceled === true });
        requests.delete(event.requestId);
      });
      return page;
      })();
      acquiringPages.add(acquisition);
      acquisition.then(() => acquiringPages.delete(acquisition), () => acquiringPages.delete(acquisition));
      return acquisition;
    };
    page = await openPage();
    if (captureCase) {
      stage = 'scenario';
      const status = await captureCase.run({ page, openPage, origin, pack, browserVersion: browser.version });
      assert.ok(['passed', 'failed', 'blocked'].includes(status), 'capture adapter must report a known status');
      report.status = status;
    } else {
      await page.cdp.call('Page.navigate', { url: `${origin}/?rendererCapture=environment-state` });
      stage = 'assets';
      const status = await page.wait('window.__rtsEnvironmentAssetStatus?.ready && window.__rtsEnvironmentAssetStatus', 'pilot runtime assets', 30000);
      assert.equal(status.oakDepletionAtlas, true, 'default oak atlas must decode');
      assert.ok(status.loadedFiles.length > 0, 'decoded runtime asset evidence is required');
      for (const file of status.loadedFiles) {
        const relative = file.path.startsWith('assets/') ? file.path : `assets/environment/frontier-interactive-v1/${file.path}`;
        assert.ok(pack.files.includes(relative), 'browser-decoded asset must be in the pack');
        assert.equal(file.sha256, sha256(await readFile(path.join(pack.directory, relative))), 'decoded asset must match packed bytes');
        assert.ok(file.dimensionsPx.width > 0 && file.dimensionsPx.height > 0, 'runtime image must decode dimensions');
        report.assets.push({ path: relative, sha256: file.sha256, dimensionsPx: file.dimensionsPx });
      }
      const state = await page.wait('window.__rtsEnvironmentStateSnapshot?.workers.some(w => w.team === window.__rtsEnvironmentStateSnapshot.team) && window.__rtsEnvironmentStateSnapshot', 'live worker snapshot');
      assert.equal(state.mapId, 'open-field', 'capture must use the packed Open Field map');
      const worker = state.workers.find(w => w.team === state.team);
      const start = await page.cdp.evaluate(`({worker:${JSON.stringify(worker)}, number:window.__rtsQualification.number,time:performance.now()})`);
      const command = { type: 'move', ids: [worker.id], x: worker.x + 8, z: worker.z + 8 };
      stage = 'movement';
      assert.equal(await page.cdp.evaluate(`window.__rtsEnvironmentCaptureCommand(${JSON.stringify(command)})`), true, 'move must use the live game socket');
      let previous = start;
      for (let i = 1; i <= 2; i++) {
        await page.wait(`window.__rtsEnvironmentStateSnapshot.workers.some(w => w.id === ${worker.id} && w.task === 'moving' && Math.hypot(w.x - ${previous.worker.x},w.z - ${previous.worker.z}) >= 0.3)`, 'live worker displacement');
        const frame = await page.cdp.evaluate(`window.__rtsQualification.request(${worker.id})`);
        const png = Buffer.from((await page.cdp.call('Page.captureScreenshot', { format: 'png', fromSurface: true })).data, 'base64');
        const canvasPng = Buffer.from(frame.canvasPng, 'base64'); delete frame.canvasPng;
        validateFrame(frame, png, canvasPng);
        const name = `movement-${i}.png`; await writeFile(path.join(evidenceDirectory, name), png);
        frame.canvas = `canvas-${i}.png`; await writeFile(path.join(evidenceDirectory, frame.canvas), canvasPng);
        frame.canvasSha256 = sha256(canvasPng);
        frame.png = name; frame.pngSha256 = sha256(png); frame.readbackSha256 = sha256(Buffer.from(frame.pixels));
        report.frames.push(frame); previous = frame;
      }
      validateMotion(start, report.frames); report.start = start; report.command = command;
      report.status = 'passed';
    }
  } catch (error) {
    report.issues.push({ stage, code: error instanceof CaptureCaseTimeoutError ? 'scenario-timeout'
      : error instanceof assert.AssertionError ? 'contract-failed' : 'execution-failed',
      systemCode: ['ENOENT', 'EACCES', 'EPERM', 'ENOSPC', 'ECONNREFUSED', 'EADDRINUSE', 'ETIMEDOUT'].includes(error.code) ? error.code : null,
      errorType: ['Error', 'TypeError', 'RangeError', 'AssertionError'].includes(error.name) ? error.name : 'Error',
      // Adapter assertions may contain session values. Retain their fault type
      // and stage, but only our fixed message in public scenario evidence.
      message: stage !== 'scenario' && error instanceof assert.AssertionError
        ? error.message.split('\n')[0] : `Qualification failed during ${stage}` });
  } finally {
    pagesOpen = false;
    if (acquiringPages.size) {
      report.status = 'failed'; report.issues.push({ stage: 'scenario', code: 'page-acquisition-unfinished' });
    }
    for (const page of pages) {
      if (page.errors.length) recordBrowserEvent({ kind: 'exception', count: page.errors.length });
      try {
        const flags = await page.cdp.evaluate('window.__rtsQualification.errors');
        assert.ok(Array.isArray(flags), 'browser probe error flags are required');
        for (const flag of flags.slice(0, 100)) {
          if (['console-error', 'exception', 'resource-error', 'promise-rejection'].includes(flag?.kind)) recordBrowserEvent({ kind: flag.kind });
        }
      } catch { report.status = 'failed'; report.issues.push({ stage: 'evidence', code: 'browser-evidence-unavailable' }); }
      try {
        const state = await page.cdp.evaluate(`({entry:document.documentElement.dataset.entry, boot:document.documentElement.dataset.boot,
          assets:window.__rtsEnvironmentAssetStatus && {state:window.__rtsEnvironmentAssetStatus.state,
            ready:window.__rtsEnvironmentAssetStatus.ready, oak:window.__rtsEnvironmentAssetStatus.oakDepletionAtlas,
            loaded:window.__rtsEnvironmentAssetStatus.loadedFiles?.length}, canvas:Boolean(document.querySelector('#viewport canvas'))})`);
        report.boot = { entry: ['menu', 'game'].includes(state?.entry) ? state.entry : null,
          ready: state?.boot === 'ready', canvas: state?.canvas === true,
          assets: state?.assets ? { state: ['loading', 'unavailable', 'load-failed', 'ready'].includes(state.assets.state) ? state.assets.state : null,
            ready: state.assets.ready === true, oakDepletionAtlas: state.assets.oak === true,
            loaded: Number.isInteger(state.assets.loaded) && state.assets.loaded >= 0 ? state.assets.loaded : null } : null };
        (report.pageBoots ??= []).push(report.boot);
      } catch { report.status = 'failed'; report.issues.push({ stage: 'evidence', code: 'boot-evidence-unavailable' }); }
      if (report.unexpectedBrowserEvent) { report.status = 'failed'; report.issues.push({ stage: 'browser', code: 'browser-errors' }); }
    }
    // The supervisor gives its one default worker seven seconds to stop; let it
    // reap that child before the shared helper's fallback kill and data removal.
    for (const cleanup of [() => browser?.dispose(), () => stopChild(server, { graceMs: 9000 }),
      () => temporary && rm(temporary, { recursive: true, force: true })]) {
      try { await cleanup(); } catch { report.status = 'failed'; report.issues.push({ stage: 'cleanup', code: 'cleanup-failed' }); }
    }
    await writeFile(path.join(evidenceDirectory, 'qualification.json'), `${JSON.stringify(report, null, 2)}\n`);
  }
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 4) { process.stderr.write('Usage: node scripts/renderer-qualification.mjs --preflight|PACK_JSON EVIDENCE_DIRECTORY\n'); process.exitCode = 2; }
  else if (process.argv[2] === '--preflight') {
    const report = await qualifyRendererCapability(); await mkdir(process.argv[3], { recursive: true });
    await writeFile(path.join(process.argv[3], 'preflight.json'), `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report)); process.exitCode = report.status === 'ready' ? 0 : 1;
  }
  else { const report = await qualifyPackedGame(process.argv[2], process.argv[3]); console.log(JSON.stringify(report)); process.exitCode = report.status === 'passed' ? 0 : 1; }
}
