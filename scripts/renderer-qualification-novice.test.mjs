// CPU rejection/pass-through controls; these establish zero rendered game frames.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { clickNovicePoint, noviceBeforeScript, readNoviceUi, reduceNoviceCommand,
  reduceNoviceMessage, runNoviceScenario, validateNoviceFrames, validateNoviceOrder } from './renderer-qualification-novice.mjs';

const revision = 'a'.repeat(40), digest = `sha256:${'b'.repeat(64)}`;
const worker = { id: 4, team: 0, x: -57.5, z: .5, hp: 35, generation: 2, task: 'moving' };
const row = [worker.id, 0, worker.x, worker.z, 35, 'worker', 0, null, 2, 'moving'];
const state = { type: 'state', tick: 12, mapId: 'veyrholds-terraced-vale', matchModeId: 'skirmish',
  matchModeVersion: 1, armySize: 24, units: [row, [8, 1, 2, 3, 35, 'worker', 0, null, 2, 'idle']] };
const welcome = { type: 'welcome', player: { team: 0, sessionToken: 'private-seat-token' }, state,
  map: { id: state.mapId, width: 160, height: 160, private: 'private-map-extra' }, private: 'private-message-extra' };
const command = { type: 'move', ids: [4], unitGenerations: [2], x: -57.5, z: 7.5, clientOrderToken: 1 };
const ui = { selected: 1, context: 'workers', contextVisible: true,
  feedback: { visible: true, state: 'applied', text: 'MOVE ORDER · 1 UNITS' } };
function png() {
  const bytes = Buffer.alloc(12000); Buffer.from('89504e470d0a1a0a', 'hex').copy(bytes);
  bytes.write('IHDR', 12); bytes.writeUInt32BE(1280, 16); bytes.writeUInt32BE(720, 20); return bytes;
}

test('native messages reduce to owned living Worker identity without private payloads', () => {
  const safe = reduceNoviceMessage(welcome);
  assert.deepEqual(safe.workers, [worker]); assert.deepEqual(safe.map, { id: state.mapId, width: 160, height: 160 });
  assert.doesNotMatch(JSON.stringify(safe), /private|sessionToken|cargo/);
  assert.equal(reduceNoviceMessage(state), null); assert.deepEqual(reduceNoviceMessage(state, 0).workers, [worker]);
  assert.deepEqual(reduceNoviceMessage({ type: 'mapChange', state, map: welcome.map }, 0).map, safe.map);
  for (const change of [{ tick: -1 }, { tick: NaN }, { units: null }]) assert.equal(reduceNoviceMessage({ ...state, ...change }, 0), null);
  for (const [index, value] of [[0, -1], [2, NaN], [3, Infinity], [4, 0], [5, 'infantry'], [8, 0], [8, 0x100000000], [9, 'private-task']]) {
    const bad = [...row]; bad[index] = value;
    assert.deepEqual(reduceNoviceMessage({ ...state, units: [bad] }, 0).workers, []);
  }
  assert.equal(reduceNoviceMessage({ ...state, mapId: 'private/token?value=secret' }, 0).mapId, null);
});

test('Move observation retains only matching finite native command fields', () => {
  assert.deepEqual(reduceNoviceCommand({ ...command, sessionToken: 'private-seat-token', extra: 'private' }), command);
  for (const change of [{ type: 'gather' }, { ids: [] }, { ids: [-1] }, { ids: [4, 5] },
    { unitGenerations: [0] }, { unitGenerations: [] }, { x: NaN }, { z: Infinity }, { clientOrderToken: 0 }]) {
    assert.equal(reduceNoviceCommand({ ...command, ...change }), null);
  }
});

function probeFixture() {
  let raf, rendered = false, reads = 0; const nativeSends = [], nativeErrors = [], handlers = [];
  class NativeSocket {
    constructor(...args) { this.args = args; this.listeners = []; }
    addEventListener(name, callback) { if (name === 'message') this.listeners.push(callback); }
    receive(data) { for (const callback of this.listeners) callback({ data }); }
    send(data) { nativeSends.push(data); return 'native-result'; }
  }
  const gl = { drawingBufferWidth: 1280, drawingBufferHeight: 720, VERSION: 1, RGBA: 2, UNSIGNED_BYTE: 3,
    readPixels(x, y, width, height, format, type, pixel) { assert.equal(rendered, true); pixel.set([++reads, 20, 40, 255]); },
    getParameter: () => 'WebGL 2.0', getError: () => 0, isContextLost: () => false };
  const window = { WebSocket: NativeSocket, requestAnimationFrame: callback => { raf = callback; return 1; },
    addEventListener: (_, callback) => handlers.push(callback) };
  const context = vm.createContext({ window, WeakSet, URL, location: { href: 'http://127.0.0.1:4321/', host: '127.0.0.1:4321' },
    performance: { now: () => 125 }, console: { error: (...args) => nativeErrors.push(args) },
    document: { querySelector: () => ({ getContext: () => gl, toDataURL: () => `data:image/png;base64,${png().toString('base64')}` }) } });
  vm.runInContext(noviceBeforeScript, context);
  return { window, context, handlers, nativeSends, nativeErrors,
    render: () => { window.requestAnimationFrame(() => { rendered = true; }); raf(130); return reads; } };
}

test('passive socket observer preserves original delivery/send, isolates unrelated sockets and reads after real render', async () => {
  const f = probeFixture(), socket = new f.window.WebSocket('ws://127.0.0.1:4321/ws?room=private-room', ['rts-v1', 'private-protocol']);
  let delivered; socket.addEventListener('message', event => { delivered = event.data; });
  const raw = JSON.stringify(welcome); socket.receive(raw); assert.equal(delivered, raw);
  assert.equal(socket.send(JSON.stringify({ ...command, token: 'private-token' })), 'native-result');
  socket.send('invalid private JSON'); assert.equal(f.nativeSends.at(-1), 'invalid private JSON');
  const remote = new f.window.WebSocket('ws://remote.invalid/ws'); remote.receive(raw); remote.send(JSON.stringify(command));
  assert.equal(f.window.__rtsNovice.sent.length, 1);
  vm.runInContext("console.error('private-console-text')", f.context); f.handlers[0]({ target: f.window });
  const framePromise = f.window.__rtsNovice.request(worker.id); assert.equal(f.render(), 48);
  const frame = JSON.parse(JSON.stringify(await framePromise));
  assert.deepEqual(frame.worker, worker); assert.equal(frame.tick, 12); assert.equal(frame.stateAgeMs, 0);
  assert.equal(frame.number, 1); assert.equal(frame.time, 130); assert.equal(frame.pixels.length, 192);
  const safeProbe = JSON.parse(JSON.stringify(f.window.__rtsNovice));
  assert.doesNotMatch(JSON.stringify(safeProbe), /private|sessionToken|protocols|room=/);
  assert.equal(f.nativeErrors[0][0], 'private-console-text');
  assert.deepEqual(safeProbe.errors, [{ kind: 'command-observation-failed' }, { kind: 'console-error' }, { kind: 'exception' }]);
});

test('native pointer helper uses one paired input event and rejects invalid coordinates', async () => {
  const calls = [], page = { cdp: { call: async (...args) => calls.push(args) } };
  await clickNovicePoint(page, { x: 300, y: 200 }, 'right');
  assert.deepEqual(calls.map(call => call[0]), ['Page.bringToFront', 'Input.dispatchMouseEvent', 'Input.dispatchMouseEvent']);
  assert.deepEqual(calls.slice(1).map(call => call[1].type), ['mousePressed', 'mouseReleased']);
  for (const call of calls.slice(1)) { assert.equal(call[1].button, 'right'); assert.equal(call[1].clickCount, 1); assert.equal(call[1].modifiers, 0); }
  for (const point of [{ x: NaN, y: 20 }, { x: -1, y: 20 }, { x: 1280, y: 20 }, { x: 20, y: 720 }]) await assert.rejects(clickNovicePoint(page, point));
  assert.equal(calls.length, 3);
});

test('order acceptance rejects hidden feedback, wrong Worker/generation and substituted input', () => {
  const start = { worker }; validateNoviceOrder(start, command, { x: -57.5, z: 7.5 }, ui);
  for (const change of [{ type: 'gather' }, { ids: [8] }, { unitGenerations: [3] }, { x: 0 }]) {
    assert.throws(() => validateNoviceOrder(start, { ...command, ...change }, { x: -57.5, z: 7.5 }, ui));
  }
  for (const change of [{ selected: 4 }, { context: 'military' }, { contextVisible: false },
    { feedback: { ...ui.feedback, visible: false } }, { feedback: { ...ui.feedback, state: 'failed' } },
    { feedback: { ...ui.feedback, text: 'MOVE ORDER · 4 UNITS' } }]) {
    assert.throws(() => validateNoviceOrder(start, command, { x: -57.5, z: 7.5 }, { ...ui, ...change }));
  }
});

test('frame acceptance rejects reused generation, stale state and unchanged tick alongside motion', () => {
  const start = { worker, number: 1, time: 100, tick: 12, observedAt: 90 };
  const frames = [2, 3].map(number => ({ number, time: number * 100, tick: 12 + number,
    observedAt: number * 90, stateAgeMs: 100, pngSha256: String(number).repeat(64), canvasSha256: String(number).repeat(64),
    worker: { ...worker, z: worker.z + number } }));
  validateNoviceFrames(start, frames);
  for (const change of [{ tick: frames[0].tick }, { observedAt: frames[0].observedAt }, { stateAgeMs: 2001 },
    { stateAgeMs: -1 }, { stateAgeMs: NaN }, { worker: { ...frames[1].worker, generation: 3 } }]) {
    assert.throws(() => validateNoviceFrames(start, [frames[0], { ...frames[1], ...change }]));
  }
});

test('UI evidence omits diagnostic values, unknown feedback and unrelated DOM text', () => {
  const context = vm.createContext({ window: { __rtsNovice: {} }, URL, performance: { now: () => 5 },
    location: { href: 'http://127.0.0.1:4321/?room=private-room&token=private-token&mode=pve&mapSeed=4&policySeed=5' },
    getComputedStyle: () => ({ display: 'block', visibility: 'visible', opacity: '1' }),
    document: { documentElement: { dataset: { entry: 'game', boot: 'ready' } }, querySelector: selector => selector === '#field-order-feedback'
      ? { hidden: false, getClientRects: () => [{}], dataset: { state: 'failed' }, textContent: 'private-token in error' } : null } });
  const actual = JSON.parse(JSON.stringify(vm.runInContext(`(${readNoviceUi.toString()})()`, context)));
  assert.equal(actual.roomEntry, true); assert.equal(actual.mapSeed, 4); assert.equal(actual.policySeed, 5);
  assert.equal(actual.feedback.text, null); assert.doesNotMatch(JSON.stringify(actual), /private|token|room=/);
});

test('actual adapter preserves the first failure and bounded capture before returning, with no launch or command injection', async () => {
  for (const captureFails of [false, true]) {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'rts-novice-test-')), calls = [];
    const safeView = { available: true }, health = { ok: true, buildIdentity: {
      status: 'identified', origin: 'packed-manifest', sourceRevision: revision, sourceDirty: false, digest } };
    const page = { errors: [], wait: async () => { calls.push('wait'); throw Error('private-menu-token'); }, cdp: {
      on() {}, evaluate: async expression => expression === 'location.href' ? 'about:blank' : safeView,
      call: async (method, params) => { calls.push(method);
        if (method === 'Page.captureScreenshot') { if (captureFails) throw Error('private-capture-token'); return { data: png().toString('base64') }; }
        if (method === 'Page.navigate') assert.equal(params.url, 'http://127.0.0.1:4321/');
        return {};
      } } };
    try {
      const report = await runNoviceScenario({ origin: 'http://127.0.0.1:4321', page,
        release: { sourceRevision: revision, digest }, evidenceDirectory: directory,
        fetchImpl: async () => new Response(JSON.stringify(health)) });
      assert.equal(report.status, 'failed'); assert.deepEqual(report.issues, [{ stage: 'menu', code: 'execution-failed', systemCode: null }]);
      assert.ok(calls.indexOf('Page.addScriptToEvaluateOnNewDocument') < calls.indexOf('Page.navigate'));
      assert.ok(calls.indexOf('wait') < calls.indexOf('Page.captureScreenshot'));
      assert.equal(calls.filter(call => call === 'Input.dispatchMouseEvent').length, 0);
      assert.doesNotMatch(await readFile(path.join(directory, 'novice.json'), 'utf8'), /private/);
      if (captureFails) assert.deepEqual(report.failureCapture, { available: false });
      else assert.ok((await readFile(path.join(directory, 'failure.png'))).equals(png()));
    } finally { await rm(directory, { recursive: true, force: true }); }
  }
});
