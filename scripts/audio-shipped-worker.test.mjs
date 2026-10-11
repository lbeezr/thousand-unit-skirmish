import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash, webcrypto } from 'node:crypto';
import { createShippedAudioLoader } from '../src/client/audio/shipped-audio-worker-client.mjs';
import { createShippedAudioWorkerEndpoint } from '../src/client/audio/shipped-audio-worker.mjs';
import { loadShippedAudio } from '../src/audio-shipped-loader.mjs';
import { SHIPPED_AUDIO_REFERENCES } from '../src/audio-shipped-catalog.mjs';
import { createGameAudio } from '../src/audio.mjs';

const turn = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const value = name => ({ pack: { id: name }, sourceBlobs: { sample: new Blob([name], { type: 'audio/mpeg' }) } });
function fixture(load) {
  const workers = [];
  class Worker {
    constructor(url, options) {
      this.url = url; this.options = options; this.listeners = new Map(); this.messages = []; this.terminated = false;
      this.endpoint = createShippedAudioWorkerEndpoint({ load, postMessage: message => {
        const copied = structuredClone(message);
        queueMicrotask(() => this.emit('message', { data: copied }));
      } });
      workers.push(this);
    }
    addEventListener(type, listener) { const set = this.listeners.get(type) || new Set(); set.add(listener); this.listeners.set(type, set); }
    removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
    emit(type, event = {}) { for (const listener of [...(this.listeners.get(type) || [])]) listener(event); }
    postMessage(message) {
      this.messages.push(structuredClone(message));
      queueMicrotask(() => { if (!this.terminated) void this.endpoint.handleMessage(structuredClone(message)); });
    }
    terminate() { this.terminated = true; this.endpoint.dispose(); }
  }
  const client = createShippedAudioLoader({ Worker });
  return { client, workers, Worker };
}

test('one lazy module worker returns structured-cloned verified Blobs and keeps request identities distinct', async t => {
  const calls = [], f = fixture(async reference => { calls.push(reference); return value(reference.packId); });
  t.after(() => f.client.dispose());
  assert.equal(f.workers.length, 0);
  const [a, b] = await Promise.all([f.client.load({ packId: 'a' }), f.client.load({ packId: 'b' })]);
  assert.equal(f.workers.length, 1);
  const worker = f.workers[0];
  assert.ok(worker.url.pathname.endsWith('/src/client/audio/shipped-audio-worker.mjs'));
  assert.deepEqual(worker.options, { type: 'module' });
  assert.deepEqual(worker.messages.map(m => [m.type, m.requestId]), [['load', 1], ['load', 2]]);
  assert.deepEqual(calls.map(r => r.packId), ['a', 'b']);
  assert.equal(a.pack.id, 'a'); assert.equal(b.pack.id, 'b');
  assert.ok(a.sourceBlobs.sample instanceof Blob);
  assert.equal(await a.sourceBlobs.sample.text(), 'a');
});

test('actual game audio owns the worker default load and disposal prevents a late profile install', async t => {
  const pending = deferred(), f = fixture(() => pending.promise), previousWorker = globalThis.Worker;
  globalThis.Worker = f.Worker;
  const reference = { packId: 'default', profileId: 'interactions', version: 'v1', sha256: 'a'.repeat(64) };
  const audio = createGameAudio({ storage: null, doc: null, defaultReference: reference });
  t.after(() => {
    audio.dispose(); f.client.dispose();
    if (previousWorker === undefined) delete globalThis.Worker; else globalThis.Worker = previousWorker;
  });
  assert.equal(f.workers.length, 0);
  const loading = audio.setMapAudio(null); await turn();
  assert.equal(f.workers.length, 1);
  assert.deepEqual(f.workers[0].messages[0], { type: 'load', requestId: 1, reference });
  audio.dispose(); await loading;
  assert.equal(f.workers[0].terminated, true);
  pending.resolve({ pack: { id: 'default', compositions: [], profiles: [{ id: 'interactions', music: {},
    bindings: { 'unit.worker.select': { bus: 'voice', variants: [{ sourceId: 'sample' }] } } }] },
    sourceBlobs: { sample: new Blob(['late']) } });
  await turn();
  assert.equal(audio.getInspector().profileId, null);
  assert.equal(audio.playEvent({ cue: 'select', kind: 'worker' }), false);
});

test('individual abort reaches its worker controller, rejects immediately and cannot cancel or overwrite another request', async t => {
  const loads = new Map(), f = fixture((reference, { signal }) => {
    const d = deferred(); loads.set(reference.packId, { ...d, signal }); return d.promise;
  });
  t.after(() => f.client.dispose());
  const controller = new AbortController(), aborted = f.client.load({ packId: 'old' }, { signal: controller.signal });
  const other = f.client.load({ packId: 'current' });
  await turn(); controller.abort();
  await assert.rejects(aborted, { name: 'AbortError' }); await turn();
  assert.equal(loads.get('old').signal.aborted, true);
  assert.equal(loads.get('current').signal.aborted, false);
  assert.deepEqual(f.workers[0].messages.at(-1), { type: 'abort', requestId: 1 });
  loads.get('old').resolve(value('stale')); loads.get('current').resolve(value('current'));
  assert.equal((await other).pack.id, 'current');
  f.workers[0].emit('message', { data: { type: 'loaded', requestId: 1, loaded: value('late') } });
  assert.equal((await f.client.load({ packId: 'later' }, { signal: AbortSignal.abort() }).catch(e => e)).name, 'AbortError');
  assert.equal(f.workers[0].messages.filter(m => m.type === 'load').length, 2, 'pre-aborted calls never transfer');
});

test('caller abort listeners are removed on success and disposal; disposal terminates and rejects pending work', async () => {
  const controller = new AbortController(), listeners = new Set();
  const signal = {
    get aborted() { return controller.signal.aborted; },
    addEventListener(type, listener, options) { listeners.add(listener); controller.signal.addEventListener(type, listener, options); },
    removeEventListener(type, listener) { listeners.delete(listener); controller.signal.removeEventListener(type, listener); },
  };
  const wait = deferred(); let calls = 0;
  const f = fixture(() => ++calls === 1 ? value('done') : wait.promise);
  await f.client.load({}, { signal }); assert.equal(listeners.size, 0);
  const pending = f.client.load({}, { signal }); await turn();
  assert.equal(listeners.size, 1);
  f.client.dispose(); f.client.dispose();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(listeners.size, 0); assert.equal(f.workers[0].terminated, true);
  assert.ok([...f.workers[0].listeners.values()].every(set => set.size === 0));
  wait.resolve(value('late')); await turn();
  await assert.rejects(f.client.load({}), { name: 'AbortError' });
});

test('worker failure rejects all pending requests, removes listeners and never silently retries', async () => {
  const f = fixture(() => new Promise(() => {}));
  const a = f.client.load({}), b = f.client.load({}); await turn();
  f.workers[0].emit('error', { message: 'private-url?secret=value' });
  for (const pending of [a, b]) await assert.rejects(pending, { message: 'Shipped audio worker unavailable' });
  await assert.rejects(f.client.load({}), { message: 'Shipped audio worker unavailable' });
  assert.equal(f.workers.length, 1); assert.equal(f.workers[0].terminated, true);
  assert.ok([...f.workers[0].listeners.values()].every(set => set.size === 0));
  f.client.dispose();
});

test('worker construction failure remains terminal and does not retry the network through fallback', async () => {
  let constructions = 0, directCalls = 0;
  const client = createShippedAudioLoader({ Worker: class { constructor() { constructions++; throw Error('private construction detail'); } },
    directLoader: () => { directCalls++; } });
  for (let i = 0; i < 2; i++) await assert.rejects(client.load({}), { message: 'Shipped audio worker unavailable' });
  assert.equal(constructions, 1); assert.equal(directCalls, 0); client.dispose();
});

test('client watchdog bounds a silent worker and releases timers on success, abort and disposal', async () => {
  const timers = new Map(), messages = [], listeners = new Map();
  let nextTimer = 1, directCalls = 0, worker;
  class SilentWorker {
    constructor() { worker = this; }
    addEventListener(type, fn) { listeners.set(type, fn); }
    removeEventListener(type) { listeners.delete(type); }
    postMessage(message) { messages.push(message); }
    terminate() { this.terminated = true; }
  }
  const client = createShippedAudioLoader({ Worker: SilentWorker,
    directLoader: () => { directCalls++; },
    scheduleTimeout: (fn, ms) => { assert.equal(ms, 30000); const id = nextTimer++; timers.set(id, fn); return id; },
    cancelTimeout: id => timers.delete(id),
  });
  const stalled = client.load({}); assert.equal(timers.size, 1);
  timers.values().next().value();
  await assert.rejects(stalled, { name: 'TimeoutError', message: 'Shipped audio load timed out' });
  assert.equal(timers.size, 0); assert.equal(directCalls, 0);
  assert.deepEqual(messages.map(m => [m.type, m.requestId]), [['load', 1], ['abort', 1]]);
  listeners.get('message')({ data: { type: 'loaded', requestId: 1, loaded: value('late') } });

  const completed = client.load({});
  listeners.get('message')({ data: { type: 'loaded', requestId: 2, loaded: value('done') } });
  assert.equal((await completed).pack.id, 'done'); assert.equal(timers.size, 0);
  const controller = new AbortController(), cancelled = client.load({}, { signal: controller.signal });
  controller.abort(); await assert.rejects(cancelled, { name: 'AbortError' }); assert.equal(timers.size, 0);
  const disposed = client.load({}); client.dispose();
  await assert.rejects(disposed, { name: 'AbortError' }); assert.equal(timers.size, 0);
  assert.equal(worker.terminated, true); assert.equal(listeners.size, 0);
});

test('unsupported Worker uses direct loader with abort and disposal isolation', async () => {
  const calls = [], client = createShippedAudioLoader({ Worker: null, directLoader: (reference, { signal }) => {
    const wait = deferred(); calls.push({ reference, signal, ...wait }); return wait.promise;
  } });
  const controller = new AbortController(), a = client.load({ packId: 'a' }, { signal: controller.signal }), b = client.load({ packId: 'b' });
  await turn(); controller.abort(); await assert.rejects(a, { name: 'AbortError' });
  assert.equal(calls[0].signal.aborted, true); assert.equal(calls[1].signal.aborted, false);
  calls[0].resolve(value('late')); calls[1].resolve(value('b'));
  assert.equal((await b).pack.id, 'b');
  const c = client.load({ packId: 'c' }); await turn(); client.dispose();
  await assert.rejects(c, { name: 'AbortError' }); assert.equal(calls[2].signal.aborted, true);
  calls[2].resolve(value('late'));
});

test('client and worker endpoint bound outstanding work, reject replayed IDs, and sanitize loader failures', async () => {
  const wait = deferred(), f = fixture(() => wait.promise);
  const pending = Array.from({ length: 8 }, () => f.client.load({}));
  await assert.rejects(f.client.load({}), /Too many pending audio loads/);
  assert.equal(f.workers[0].messages.length, 8);
  f.client.dispose(); await Promise.all(pending.map(p => assert.rejects(p, { name: 'AbortError' })));
  const messages = [], calls = [];
  const endpoint = createShippedAudioWorkerEndpoint({ postMessage: m => messages.push(m), load: (reference, { signal }) => {
    calls.push({ reference, signal }); return wait.promise;
  } });
  const jobs = Array.from({ length: 8 }, (_, i) => endpoint.handleMessage({ type: 'load', requestId: i + 1, reference: { id: i } }));
  endpoint.handleMessage({ type: 'load', requestId: 9, reference: {} });
  endpoint.handleMessage({ type: 'load', requestId: 1, reference: {} });
  endpoint.handleMessage({ type: 'load', requestId: -1, reference: {} });
  await turn(); assert.equal(calls.length, 8);
  assert.deepEqual(messages, [{ type: 'failed', requestId: 9, cancelled: false }]);
  wait.reject(Error('https://private.test/?secret=private-payload'));
  await Promise.all(jobs);
  assert.equal(messages.length, 9);
  assert.ok(messages.every(m => m.type === 'failed' && !m.cancelled));
  assert.ok(!JSON.stringify(messages).includes('private'));
  endpoint.dispose();
});

test('actual endpoint retains canonical byte/hash validation and verified worker-side cache', async () => {
  const original = SHIPPED_AUDIO_REFERENCES[0], root = new URL('../', import.meta.url);
  const manifest = JSON.parse(await readFile(new URL(`assets/audio/runtime/${original.packId}/${original.version}/manifest.json`, root)));
  manifest.pack.id = 'worker-canonical-verification';
  const bytes = Buffer.from(JSON.stringify(manifest));
  const reference = { ...original, packId: manifest.pack.id, sha256: createHash('sha256').update(bytes).digest('hex') };
  const paths = [], messages = [];
  const endpoint = createShippedAudioWorkerEndpoint({ postMessage: m => messages.push(structuredClone(m)),
    load: (ref, options) => loadShippedAudio(ref, { ...options, crypto: webcrypto, fetch: async (url, { signal, redirect }) => {
      assert.ok(signal instanceof AbortSignal); assert.equal(redirect, 'error'); paths.push(url);
      const data = url.endsWith('.json') ? bytes : await readFile(new URL(url.slice(1), root));
      return new Response(data, { headers: { 'content-type': url.endsWith('.json') ? 'application/json' : 'audio/mpeg' } });
    } }) });
  await endpoint.handleMessage({ type: 'load', requestId: 1, reference });
  assert.equal(messages[0].type, 'loaded');
  assert.equal(Object.keys(messages[0].loaded.sourceBlobs).length, manifest.pack.sources.length);
  const count = paths.length;
  await endpoint.handleMessage({ type: 'load', requestId: 2, reference });
  assert.equal(paths.length, count, 'repeat request must use the canonical verified cache');
  await endpoint.handleMessage({ type: 'load', requestId: 3, reference: { ...reference, sha256: '0'.repeat(64) } });
  assert.deepEqual(messages[2], { type: 'failed', requestId: 3, cancelled: false });
  assert.equal(paths.length, count + 1, 'bad manifest hash must stop before source transfers');
  endpoint.dispose();
});
