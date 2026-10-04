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
import { stopChild } from './temporary-resources.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export function validateRelease(pack, source) {
  assert.match(source.revision, /^[a-f0-9]{40}$/, 'source revision is required');
  assert.equal(source.dirty, false, 'qualification requires a clean checkout');
  assert.equal(pack.sourceRevision, source.revision, 'pack must match the checked-out source');
  assert.equal(pack.sourceDirty, false, 'qualification requires a clean release');
  assert.match(pack.digest, /^sha256:[a-f0-9]{64}$/, 'release digest is required');
  assert.ok(Array.isArray(pack.files) && pack.files.includes('server.mjs') && pack.files.includes('src/main.js'),
    'pack must contain the game server and renderer');
  assert.equal(new Set(pack.files).size, pack.files.length, 'release entries must be unique');
  for (const file of pack.files) assert.ok(typeof file === 'string' && file !== ''
    && !path.isAbsolute(file) && !file.split(/[\\/]/).includes('..'), 'release entry must stay inside the pack');
}

export function validateFrame(frame, png) {
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
  assert.ok(frame.worker && Number.isInteger(frame.worker.id) && Number.isInteger(frame.worker.team)
    && Number.isFinite(frame.worker.x) && Number.isFinite(frame.worker.z), 'live worker coordinates are required');
  assert.equal(frame.worker.task, 'moving', 'worker must be moving during capture');
}

export function validateMotion(start, frames) {
  assert.equal(frames.length, 2, 'two movement captures are required');
  let previous = start;
  for (const frame of frames) {
    assert.match(frame.pngSha256 ?? '', /^[a-f0-9]{64}$/, 'movement PNG digest is required');
    assert.equal(frame.worker.id, start.worker.id, 'captures must follow the commanded worker');
    assert.equal(frame.worker.team, start.worker.team, 'captures must retain the commanded team');
    assert.ok(frame.number > previous.number && frame.time > previous.time, 'rendered frames must advance');
    assert.ok(Math.hypot(frame.worker.x - previous.worker.x, frame.worker.z - previous.worker.z) >= 0.2,
      'live worker must move between captures');
    previous = frame;
  }
  assert.notEqual(frames[0].pngSha256, frames[1].pngSha256, 'movement screenshots must differ');
}

// Read immediately after the real animation callback renders: the game's default
// preserveDrawingBuffer=false makes a later arbitrary CDP readback unreliable.
export function installReadbackProbe() {
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
      glError: gl.getError(), pixels, worker: window.__rtsEnvironmentStateSnapshot?.workers.find(w => w.id === pending.workerId) });
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

export async function qualifyPackedGame(packFile, evidenceDirectory) {
  await mkdir(evidenceDirectory, { recursive: true });
  const report = { schemaVersion: 1, scope: 'local-packed-game-movement', status: 'failed', sandbox: 'enabled',
    uid: process.getuid?.() ?? null, source: null, release: null, frames: [], assets: [], browserEvents: [], issues: [] };
  let stage = 'release', browser, server, temporary;
  try {
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
    stage = 'server';
    temporary = await mkdtemp(path.join(os.tmpdir(), 'rts-packed-renderer-'));
    const port = await reservePort(), origin = `http://127.0.0.1:${port}`;
    let serverLog = '', serverError;
    server = spawn(process.execPath, [path.join(pack.directory, 'server.mjs')], { cwd: pack.directory,
      env: { PATH: process.env.PATH, PORT: String(port), RTS_HOST: '127.0.0.1', RTS_MAP: 'maps/open-field.json',
        RTS_CUSTOM_MAP_DIRECTORY: path.join(temporary, 'maps'), RTS_MATCH_STATE_PATH: path.join(temporary, 'match.json') },
      stdio: ['ignore', 'pipe', 'pipe'] });
    server.on('error', error => { serverError = error; });
    for (const stream of [server.stdout, server.stderr]) stream.on('data', bytes => { serverLog = (serverLog + bytes).slice(-12000); });
    const deadline = Date.now() + 20000;
    while (true) {
      assert.ok(!serverError && server.exitCode === null, 'packed server exited before startup');
      const response = await fetch(`${origin}/health`, { signal: AbortSignal.timeout(1000) }).catch(() => null);
      if (response?.ok && (await response.json()).ok) break;
      assert.ok(Date.now() < deadline, 'packed server startup timed out'); await sleep(100);
    }
    // Retain only known safe startup facts, never protocol frames or session tokens.
    report.server = { map: 'open-field', logBytes: Buffer.byteLength(serverLog), listening: true };
    for (const file of ['index.html', 'src/main.js']) {
      const response = await fetch(`${origin}/${file}`, { signal: AbortSignal.timeout(5000) });
      assert.equal(response.status, 200, 'packed entry file must be served');
      const hash = sha256(Buffer.from(await response.arrayBuffer()));
      assert.equal(hash, sha256(await readFile(path.join(pack.directory, file))), 'served entry must match packed bytes');
      report.assets.push({ path: file, sha256: hash });
    }
    stage = 'browser'; browser = await createFortifiedBrowser(); report.browser = browser.version;
    const page = await browser.page(`${origin}/?rendererCapture=environment-state`, { beforeScript: `(${installReadbackProbe.toString()})()` });
    page.cdp.on('Runtime.consoleAPICalled', event => {
      if (event.type === 'error') report.browserEvents.push({ kind: 'console-error' });
    });
    page.cdp.on('Network.responseReceived', event => {
      if (event.response.status >= 400) report.browserEvents.push({ kind: 'http-error', status: event.response.status });
    });
    page.cdp.on('Network.loadingFailed', event => report.browserEvents.push({ kind: 'request-failed', canceled: event.canceled === true }));
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
      validateFrame(frame, png);
      const name = `movement-${i}.png`; await writeFile(path.join(evidenceDirectory, name), png);
      frame.png = name; frame.pngSha256 = sha256(png); frame.readbackSha256 = sha256(Buffer.from(frame.pixels));
      report.frames.push(frame); previous = frame;
    }
    validateMotion(start, report.frames); report.start = start; report.command = command;
    report.browserEvents.push(...await page.cdp.evaluate('window.__rtsQualification.errors'));
    assert.deepEqual(page.errors, [], 'game browser exceptions are disallowed');
    assert.deepEqual(report.browserEvents, [], 'game console/network failures are disallowed');
    report.status = 'passed';
  } catch (error) {
    report.issues.push({ stage, code: error instanceof assert.AssertionError ? 'contract-failed' : 'execution-failed',
      message: error instanceof assert.AssertionError ? error.message.split('\n')[0] : `Qualification failed during ${stage}` });
  } finally {
    for (const cleanup of [() => browser?.dispose(), () => stopChild(server, { graceMs: 2500 }),
      () => temporary && rm(temporary, { recursive: true, force: true })]) {
      try { await cleanup(); } catch { report.status = 'failed'; report.issues.push({ stage: 'cleanup', code: 'cleanup-failed' }); }
    }
    await writeFile(path.join(evidenceDirectory, 'qualification.json'), `${JSON.stringify(report, null, 2)}\n`);
  }
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 4) { process.stderr.write('Usage: node scripts/renderer-qualification.mjs PACK_JSON EVIDENCE_DIRECTORY\n'); process.exitCode = 2; }
  else { const report = await qualifyPackedGame(process.argv[2], process.argv[3]); console.log(JSON.stringify(report)); process.exitCode = report.status === 'passed' ? 0 : 1; }
}
