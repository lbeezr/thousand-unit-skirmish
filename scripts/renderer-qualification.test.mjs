// CPU rejection contracts. These tests do not constitute hosted GPU evidence.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { installReadbackProbe, validateFrame, validateMotion, validateRelease } from './renderer-qualification.mjs';

const source = { revision: 'a'.repeat(40), dirty: false };
const pack = { sourceRevision: source.revision, sourceDirty: false, digest: `sha256:${'b'.repeat(64)}`,
  files: ['server.mjs', 'src/main.js'] };
const worker = { id: 0, team: 0, x: -20, z: 0, task: 'moving' };
const start = { number: 10, time: 100, worker };
function frame(number = 11) {
  return { version: 'WebGL 2.0', contextLost: false, glError: 0, number, time: number * 10,
    pixels: Array.from({ length: 48 }, (_, i) => [i, 20, 40, 255]).flat(),
    worker: { ...worker, x: worker.x + (number - 10) }, pngSha256: String(number % 10).repeat(64) };
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
  validateFrame(frame(), png());
  for (const change of [{ version: 'WebGL 1.0' }, { contextLost: true }, { glError: 1282 }, { number: 0 },
    { time: NaN }, { pixels: [] }, { pixels: Array(192).fill(0) }, { pixels: Array(48).fill([0, 0, 0, 255]).flat() },
    { pixels: frame().pixels.map((v, i) => i === 0 ? 256 : v) }, { worker: null },
    { worker: { ...worker, x: NaN } }, { worker: { ...worker, task: 'idle' } }]) {
    assert.throws(() => validateFrame({ ...frame(), ...change }, png()));
  }
  for (const bad of [Buffer.alloc(12000), png().subarray(0, 100), (() => { const p = png(); p.writeUInt32BE(1, 16); return p; })()]) {
    assert.throws(() => validateFrame(frame(), bad));
  }
});

test('two live captures must retain identity and advance worker, frame, time and image', () => {
  const first = frame(), second = frame(12); validateMotion(start, [first, second]);
  assert.throws(() => validateMotion(start, [first]));
  for (const change of [{ number: first.number }, { time: first.time }, { pngSha256: first.pngSha256 },
    { pngSha256: null }, { worker: { ...second.worker, x: first.worker.x } },
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
  const context = vm.createContext({ window, console: { error() {} }, document: { querySelector: () => ({ getContext: () => gl }) } });
  vm.runInContext(`(${installReadbackProbe.toString()})()`, context);
  vm.runInContext("console.error('private-session-token')", context);
  errors[0]({ target: window });
  const capture = window.__rtsQualification.request(0);
  window.requestAnimationFrame(() => { rendered = true; }); raf(110);
  const actual = JSON.parse(JSON.stringify(await capture));
  validateFrame(actual, png()); assert.equal(reads, 48); assert.equal(actual.number, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(window.__rtsQualification.errors)), [{ kind: 'console-error' }, { kind: 'exception' }]);
  assert.doesNotMatch(JSON.stringify(window.__rtsQualification.errors), /private-session-token/);
});

test('hosted workflow is bounded, read-only, non-root and retains failures', async () => {
  const workflow = await readFile(new URL('../.github/workflows/renderer-qualification.yml', import.meta.url), 'utf8');
  assert.match(workflow, /runs-on: ubuntu-latest/); assert.match(workflow, /timeout-minutes: 10/);
  assert.match(workflow, /contents: read/); assert.match(workflow, /id -u.*-gt 0/);
  assert.match(workflow, /if: always\(\)/); assert.match(workflow, /retention-days: 1/);
  assert.doesNotMatch(workflow, /continue-on-error|no-sandbox|sudo|secrets\./);
  assert.ok(workflow.indexOf('renderer-capability.mjs --launch') < workflow.indexOf('renderer-qualification.mjs "'));
});
