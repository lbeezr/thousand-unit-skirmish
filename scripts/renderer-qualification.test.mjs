// CPU rejection contracts. These tests do not constitute hosted GPU evidence.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { installReadbackProbe, qualifyRendererCapability, validateFrame, validateMotion, validateRelease } from './renderer-qualification.mjs';

const source = { revision: 'a'.repeat(40), dirty: false };
const pack = { sourceRevision: source.revision, sourceDirty: false, digest: `sha256:${'b'.repeat(64)}`,
  files: ['server.mjs', 'src/main.js'] };
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
  vm.runInContext("console.error('private-session-token')", context);
  errors[0]({ target: window });
  const capture = window.__rtsQualification.request(0);
  window.requestAnimationFrame(() => { rendered = true; }); raf(110);
  const actual = JSON.parse(JSON.stringify(await capture));
  validateFrame(actual, png(), Buffer.from(actual.canvasPng, 'base64')); assert.equal(reads, 48); assert.equal(actual.number, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(window.__rtsQualification.errors)), [{ kind: 'console-error' }, { kind: 'exception' }]);
  assert.doesNotMatch(JSON.stringify(window.__rtsQualification.errors), /private-session-token/);
});

test('hosted workflow is bounded, read-only, non-root and retains failures', async () => {
  const workflow = await readFile(new URL('../.github/workflows/renderer-qualification.yml', import.meta.url), 'utf8');
  assert.match(workflow, /runs-on: ubuntu-latest/); assert.match(workflow, /timeout-minutes: 10/);
  assert.match(workflow, /contents: read/); assert.match(workflow, /id -u.*-gt 0/);
  assert.match(workflow, /if: always\(\)/); assert.match(workflow, /retention-days: 1/);
  assert.doesNotMatch(workflow, /continue-on-error|no-sandbox|sudo|secrets\./);
  assert.ok(workflow.indexOf('renderer-qualification.mjs --preflight') < workflow.indexOf('renderer-qualification.mjs "'));
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
  const files = ['server.mjs', 'src/main.js', 'index.html'], bytes = Buffer.from('packed test bytes');
  const digest = createHash('sha256');
  for (const file of [...files].sort()) digest.update(file).update('\0').update(bytes).update('\0');
  const manifest = { sourceRevision: source.revision, sourceDirty: false, digest: `sha256:${digest.digest('hex')}`, files };
  // Execute the actual orchestration with CPU-only boundaries; never launch a
  // browser/server or mistake these injected bytes for visual qualification.
  let code = (await readFile(new URL('./renderer-qualification.mjs', import.meta.url), 'utf8'))
    .replace(/^import .*;\n/gm, '').replace(/^export /gm, '').replace(/const root = .*;/, "const root = '/fixture';");
  code = code.slice(0, code.indexOf('\nif (process.argv[1]'));
  assert.match(code, /const port = await reservePort\(\)/);
  code = code.replace('const port = await reservePort()', 'const port = 4321');
  for (const mode of ['browser-fault', 'asset-timeout', 'spawn-fault', 'evidence-fault']) {
    let written, probeReads = 0; const cleanup = [], listeners = new Map();
    const fault = Object.assign(new Error('private-token-in-error'), { code: mode === 'spawn-fault' ? 'ENOENT' : 'EPERM' });
    const server = { pid: 123, exitCode: null, stdout: { on() {} }, stderr: { on() {} },
      on(event, callback) { if (mode === 'spawn-fault' && event === 'error') callback(fault); } };
    const page = { errors: ['private-browser-token'], wait: async () => { throw new Error('asset timeout: private-token'); }, cdp: {
      on: (event, callback) => listeners.set(event, callback),
      call: async method => { assert.equal(method, 'Page.navigate'); listeners.get('Network.responseReceived')({ response: { status: 503 } }); },
      evaluate: async () => { probeReads++; cleanup.push('read-flags'); if (mode === 'evidence-fault') throw fault;
        return [{ kind: 'console-error', payload: 'private-token' }, { kind: 'resource-error' }]; },
    } };
    const context = vm.createContext({ assert, createHash, Buffer, path, os, Date, setTimeout, AbortSignal,
      process: { getuid: () => 1000, execPath: 'node', env: { PATH: 'safe' } },
      execFileSync: (_, args) => args[0] === 'rev-parse' ? source.revision : '',
      mkdir: async () => {}, mkdtemp: async () => '/owned-temp', rm: async () => { cleanup.push('temp'); },
      readFile: async file => file === '/pack.json' ? JSON.stringify({ directory: '/pack', ...manifest })
        : file.endsWith('release-manifest.json') ? JSON.stringify(manifest) : bytes,
      writeFile: async (_, text) => { written = JSON.parse(text); }, spawn: () => server,
      stopChild: async () => { cleanup.push('server'); },
      fetch: async () => ({ ok: true, status: 200, json: async () => ({ ok: true }), arrayBuffer: async () => bytes }),
      createFortifiedBrowser: async () => { if (mode === 'browser-fault') throw fault;
        return { version: { product: 'CPU mock' }, page: async url => { assert.equal(url, 'about:blank'); return page; },
          dispose: async () => { cleanup.push('browser'); } }; },
    });
    vm.runInContext(code, context);
    const report = JSON.parse(JSON.stringify(await context.qualifyPackedGame('/pack.json', '/evidence')));
    assert.equal(report.status, 'failed'); assert.equal(written.status, 'failed');
    assert.ok(cleanup.includes('server') && cleanup.includes('temp'));
    assert.doesNotMatch(JSON.stringify(report), /private-.*token/);
    if (mode === 'browser-fault' || mode === 'spawn-fault') {
      assert.equal(report.issues[0].code, 'execution-failed');
      assert.equal(report.issues[0].systemCode, mode === 'spawn-fault' ? 'ENOENT' : 'EPERM');
    } else {
      assert.equal(probeReads, 1); assert.ok(cleanup.indexOf('read-flags') < cleanup.indexOf('browser'));
      assert.ok(report.browserEvents.some(e => e.kind === 'http-error' && e.status === 503));
      assert.ok(report.browserEvents.some(e => e.kind === 'exception' && e.count === 1));
      if (mode === 'evidence-fault') assert.ok(report.issues.some(i => i.code === 'browser-evidence-unavailable'));
      else assert.ok(report.browserEvents.some(e => e.kind === 'resource-error'));
    }
  }
});
