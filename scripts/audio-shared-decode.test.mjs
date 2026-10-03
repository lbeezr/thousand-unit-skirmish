import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGameAudio } from '../src/audio.mjs';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const parameter = () => ({ value: 0, setTargetAtTime() {}, setValueAtTime() {},
  linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
const node = () => ({ connect() {}, disconnect() {}, start() {}, stop() {} });
const settle = () => new Promise((resolve) => setImmediate(resolve));
const buffer = { duration: 1, length: 100, numberOfChannels: 1 };

async function fixture(t) {
  const previous = globalThis.AudioContext;
  const f = { reads: 0, decodes: 0, decoded: deferred(), jobs: [], samples: [], cues: [], statuses: [], clock: 1000 };
  t.mock.method(performance, 'now', () => f.clock);
  f.advance = () => { f.clock += 2000; };
  class SourceBlob extends Blob {
    async arrayBuffer() { f.reads++; return super.arrayBuffer(); }
  }
  globalThis.AudioContext = class {
    constructor() { f.context = this; }
    state = 'running'; currentTime = 10; sampleRate = 100; destination = node();
    createGain() { return { ...node(), gain: parameter() }; }
    createBiquadFilter() { return { ...node(), frequency: parameter() }; }
    createBuffer(_channels, length) { return { getChannelData: () => new Float32Array(length) }; }
    createBufferSource() { return { ...node(), buffer: null,
      start() { if (this.buffer?.length) f.samples.push(this); } }; }
    createOscillator() { return { ...node(), frequency: parameter() }; }
    async decodeAudioData() { f.decodes++; f.jobs.push(f.decoded); return f.decoded.promise; }
    async suspend() { this.state = 'suspended'; }
    async resume() { this.state = 'running'; }
    async close() { this.state = 'closed'; }
  };
  let visibility;
  const doc = { hidden: false, addEventListener(_event, callback) { visibility = callback; }, removeEventListener() {} };
  f.hide = () => { doc.hidden = true; visibility(); };
  f.show = async () => { doc.hidden = false; visibility(); await settle(); };
  f.audio = createGameAudio({ storage: null, doc, onCue: (cue) => f.cues.push(cue),
    onPackStatus: (status) => f.statuses.push(status) });
  f.audio.unlock();
  f.pack = { id: 'shared', name: 'Shared', compositions: [], profiles: [{ id: 'field', music: {}, bindings: {
    'unit.worker.select': { bus: 'voice', cooldownMs: 0, variants: [{ sourceId: 'shared' }] },
    'unit.worker.move': { bus: 'effects', cooldownMs: 0, variants: [{ sourceId: 'shared' }] },
    'unit.worker.gather.wood': { bus: 'effects', cooldownMs: 0, variants: [{ sourceId: 'shared' }] },
  } }] };
  f.library = { async loadPack() { return { pack: f.pack, sourceBlobs: { shared: new SourceBlob([Uint8Array.of(1)]) } }; } };
  f.reference = { packId: 'shared', profileId: 'field' };
  await f.audio.setMapAudio(f.reference, f.library);
  f.request = (cue) => f.audio.playEvent({ cue, kind: 'worker', resource: 'wood' });
  f.cleanup = () => { f.decoded.resolve(buffer); for (const job of f.jobs) job.resolve(buffer);
    f.audio.dispose(); globalThis.AudioContext = previous; };
  return f;
}

test('three eligible same-source consumers read and decode once', async (t) => {
  const f = await fixture(t);
  try {
    for (const cue of ['select', 'move', 'gather']) assert.equal(f.request(cue), true);
    await settle();
    console.log(JSON.stringify({ consumers: 3, blobReads: f.reads, decodeCalls: f.decodes }));
    assert.equal(f.reads, 1);
    assert.equal(f.decodes, 1);
    assert.equal(f.audio.getInspector().pendingSources, 1);
    assert.equal(f.audio.getInspector().decodeConsumers, 3);
    f.decoded.resolve(buffer); await settle();
    assert.equal(f.samples.length, 3);
    assert.ok(f.samples.every((source) => source.buffer === buffer), 'all consumers retain the same decoded object');
    assert.equal(f.audio.getInspector().decodedBytes, 400, 'shared references charge the cache once');
    assert.equal(f.audio.getInspector().decodeConsumers, 0);
    assert.equal(f.audio.getInspector().pendingSources, 0);
    assert.deepEqual(f.cues.sort(), ['gather', 'move', 'select']);
  } finally { f.cleanup(); }
});

for (const failure of [false, true]) {
  test(`muting voice preserves the effects consumer of a shared ${failure ? 'failed' : 'successful'} decode`, async (t) => {
    const f = await fixture(t);
    try {
      assert.equal(f.request('select'), true);
      assert.equal(f.request('move'), true);
      await settle();
      f.audio.setSettings({ voiceLevel: 0 });
      if (failure) f.decoded.reject(new Error('Shared codec failure'));
      else f.decoded.resolve(buffer);
      await settle();
      assert.equal(f.decodes, 1);
      assert.deepEqual(f.cues, ['move'], 'only the eligible effects sample/fallback acknowledges');
      assert.equal(f.samples.length, failure ? 0 : 1);
      assert.equal(f.audio.getInspector().decodeConsumers, 0);
      assert.equal(f.statuses.filter((status) => status.includes('could not decode')).length, failure ? 1 : 0);
      f.audio.setSettings({ voiceLevel: 1 }); f.advance();
      if (failure) f.decoded = deferred();
      assert.equal(f.request('select'), true);
      await settle();
      f.decoded.resolve(buffer); await settle();
      assert.equal(f.decodes, failure ? 2 : 1, 'failure retries; a successful shared buffer is reused');
      assert.equal(f.samples.length, failure ? 1 : 2);
      assert.deepEqual(f.cues, ['move', 'select']);
    } finally { f.cleanup(); }
  });
}

test('hide/return joins a pending same-pack decode only for a fresh interaction', async (t) => {
  const f = await fixture(t);
  try {
    assert.equal(f.request('select'), true); await settle();
    f.hide(); await f.show(); f.advance();
    assert.equal(f.request('move'), true); await settle();
    assert.equal(f.reads, 1); assert.equal(f.decodes, 1);
    f.decoded.resolve(buffer); await settle();
    assert.equal(f.samples.length, 1);
    assert.deepEqual(f.cues, ['move']);
    assert.equal(f.audio.getInspector().decodedBytes, 400);
  } finally { f.cleanup(); }
});

test('late old-pack completion cannot retain PCM or remove a new same-ID decode', async (t) => {
  const f = await fixture(t);
  try {
    assert.equal(f.request('select'), true); assert.equal(f.request('move'), true);
    await settle();
    const oldJob = f.decoded;
    await f.audio.setMapAudio(f.reference, f.library);
    assert.equal(f.audio.getInspector().decodeConsumers, 0);
    f.decoded = deferred();
    assert.equal(f.request('gather'), true); await settle();
    oldJob.resolve(buffer); await settle();
    assert.equal(f.samples.length, 0);
    assert.equal(f.audio.getInspector().decodedBytes, 0);
    assert.equal(f.audio.getInspector().pendingSources, 1);
    assert.equal(f.audio.getInspector().decodeConsumers, 1);
    f.advance(); assert.equal(f.request('move'), true); await settle();
    assert.equal(f.decodes, 2, 'new-pack peer joins the current job after the old completion');
    const currentBuffer = { ...buffer, length: 200 };
    f.decoded.resolve(currentBuffer); await settle();
    assert.equal(f.samples.length, 2);
    assert.ok(f.samples.every((source) => source.buffer === currentBuffer));
    assert.deepEqual(f.cues.sort(), ['gather', 'move']);
    assert.equal(f.audio.getInspector().decodedBytes, 800);
  } finally { f.cleanup(); }
});

for (const failure of [false, true]) {
  test(`dispose clears pending shared consumers before a ${failure ? 'failed' : 'successful'} decode completes`, async (t) => {
    const f = await fixture(t);
    try {
      assert.equal(f.request('select'), true); assert.equal(f.request('move'), true);
      await settle(); f.audio.dispose();
      assert.equal(f.audio.getInspector().pendingSources, 0);
      assert.equal(f.audio.getInspector().decodeConsumers, 0);
      if (failure) f.decoded.reject(new Error('Disposed decode failure'));
      else f.decoded.resolve(buffer);
      await settle();
      assert.equal(f.samples.length, 0);
      assert.deepEqual(f.cues, []);
      assert.equal(f.audio.getInspector().decodedBytes, 0);
      assert.ok(!f.statuses.some((status) => status.includes('could not decode')));
    } finally { f.cleanup(); }
  });
}
