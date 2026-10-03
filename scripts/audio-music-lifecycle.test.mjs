import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGameAudio } from '../src/audio.mjs';

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};
const parameter = () => ({ value: 0, setTargetAtTime() {}, setValueAtTime() {},
  linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
const node = () => ({ connect() {}, disconnect() {}, start() {}, stop() {} });
const composition = { schemaVersion: 1, id: 'music', name: 'Music', bpm: 120,
  beatsPerBar: 4, lengthBars: 30, tracks: [{ id: 'bed', name: 'Music', gain: 1,
    pan: 0, mute: false, solo: false, clips: [{ id: 'loop', sourceId: 'music',
      startBeat: 0, durationBeats: 120, offsetSeconds: 0, gain: 1, loop: true,
      fadeInSeconds: 0, fadeOutSeconds: 0 }] }] };
const pack = { id: 'fixture', name: 'Fixture', compositions: [composition],
  profiles: [{ id: 'field', bindings: {}, music: { defaultCompositionId: 'music' } }] };
const library = { async loadPack() {
  return { pack, sourceBlobs: { music: new Blob([Uint8Array.of(1)]) } };
} };
const reference = { packId: pack.id, profileId: 'field' };

test('profile music loading respects visibility, mute, replacement and disposal', async (t) => {
  const previousContext = globalThis.AudioContext;
  let fixture;
  class Context {
    constructor() { fixture.context = this; }
    state = 'running'; currentTime = 10; sampleRate = 100; destination = node();
    createGain() { return { ...node(), gain: parameter() }; }
    createBiquadFilter() { return { ...node(), frequency: parameter() }; }
    createBuffer(_channels, length) { return { getChannelData: () => new Float32Array(length) }; }
    createBufferSource() {
      const source = { ...node(), buffer: null, active: false,
        start() {
          this.active = true;
          if (this.buffer?.music) { fixture.starts.push(this); fixture.started.resolve(); }
        },
        stop(at) { if (at === undefined) this.active = false; } };
      return source;
    }
    async decodeAudioData() {
      fixture.decodeCount++;
      fixture.decoding.resolve();
      if (fixture.pendingDecode) await fixture.pendingDecode.promise;
      return { music: true, duration: 60, length: 6000, numberOfChannels: 1 };
    }
    async resume() { this.state = 'running'; }
    async suspend() { this.state = 'suspended'; }
    async close() { this.state = 'closed'; }
  }
  function createFixture({ pendingDecode = false, state = 'running' } = {}) {
    fixture = { starts: [], decodeCount: 0, ready: deferred(), decoding: deferred(), started: deferred(),
      pendingDecode: pendingDecode ? deferred() : null };
    let visibility;
    const doc = { hidden: false,
      addEventListener(_event, callback) { visibility = callback; }, removeEventListener() {} };
    fixture.audio = createGameAudio({ storage: null, doc,
      onPackStatus(status) { if (status.includes(' ready.')) fixture.ready.resolve(); } });
    fixture.hide = () => { doc.hidden = true; visibility(); };
    fixture.show = () => { doc.hidden = false; visibility(); };
    fixture.audio.unlock();
    fixture.context.state = state;
    return fixture;
  }
  async function waitForStart(f) {
    let timer;
    try {
      await Promise.race([f.started.promise, new Promise((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('Music did not start after activation')), 1000);
      })]);
    } finally { clearTimeout(timer); }
  }
  const interruptions = [
    ['hidden page', (f) => f.hide()],
    ['music bus muted', (f) => f.audio.setSettings({ musicLevel: 0 })],
    ['master muted', (f) => f.audio.setSettings({ enabled: false })],
    ['master volume zero', (f) => f.audio.setSettings({ volume: 0 })],
    ['map removed', (f) => f.audio.setMapAudio(null)],
    ['disposed audio', (f) => f.audio.dispose()],
  ];
  globalThis.AudioContext = Context;
  try {
    for (const [name, interrupt] of interruptions) {
      await t.test(`${name} cancels music while its player module loads`, async () => {
        const f = createFixture();
        try {
          const loading = f.audio.setMapAudio(reference, library);
          await f.ready.promise;
          await interrupt(f);
          await loading;
          assert.equal(f.starts.length, 0, 'cancelled loading must not schedule a music source');
        } finally { f.audio.dispose(); }
      });
      await t.test(`${name} cancels music while its source decodes`, async () => {
        const f = createFixture({ pendingDecode: true });
        try {
          const loading = f.audio.setMapAudio(reference, library);
          await f.decoding.promise;
          await interrupt(f);
          f.pendingDecode.resolve();
          await loading;
          assert.equal(f.starts.length, 0, 'cancelled decoding must not schedule a music source');
        } finally { f.pendingDecode.resolve(); f.audio.dispose(); }
      });
    }
    await t.test('a suspended context waits for activation before starting one music loop', async () => {
      const f = createFixture({ state: 'suspended' });
      try {
        await f.audio.setMapAudio(reference, library);
        assert.equal(f.starts.length, 0);
        f.audio.unlock();
        await waitForStart(f);
        assert.equal(f.starts.length, 1);
      } finally { f.audio.dispose(); }
    });
    await t.test('master mute stops a playing loop and unmute starts one replacement', async () => {
      const f = createFixture();
      try {
        await f.audio.setMapAudio(reference, library);
        assert.equal(f.starts.filter((source) => source.active).length, 1);
        f.audio.setSettings({ enabled: false });
        assert.equal(f.starts.filter((source) => source.active).length, 0);
        f.started = deferred();
        f.audio.setSettings({ enabled: true });
        await waitForStart(f);
        assert.equal(f.starts.filter((source) => source.active).length, 1);
        f.hide();
        assert.equal(f.starts.filter((source) => source.active).length, 0);
        f.started = deferred();
        f.show();
        await waitForStart(f);
        assert.equal(f.starts.filter((source) => source.active).length, 1);
      } finally { f.audio.dispose(); }
    });
    await t.test('overlapping activation callbacks share one pending decode and loop', async () => {
      const f = createFixture({ state: 'suspended', pendingDecode: true });
      const resumed = deferred();
      try {
        await f.audio.setMapAudio(reference, library);
        f.context.resume = async () => { await resumed.promise; f.context.state = 'running'; };
        f.audio.unlock(); f.audio.unlock();
        resumed.resolve();
        await f.decoding.promise;
        assert.equal(f.decodeCount, 1);
        f.pendingDecode.resolve();
        await waitForStart(f);
        assert.equal(f.starts.length, 1);
      } finally { resumed.resolve(); f.pendingDecode.resolve(); f.audio.dispose(); }
    });
    for (const name of ['master mute/unmute', 'hide/return']) {
      await t.test(`${name} reconciles a suspension that completes after return`, async () => {
        const f = createFixture();
        const suspended = deferred();
        try {
          await f.audio.setMapAudio(reference, library);
          f.started = deferred();
          f.context.suspend = async () => { await suspended.promise; f.context.state = 'suspended'; };
          if (name === 'hide/return') { f.hide(); f.show(); }
          else { f.audio.setSettings({ enabled: false }); f.audio.setSettings({ enabled: true }); }
          suspended.resolve();
          await waitForStart(f);
          assert.equal(f.context.state, 'running');
          assert.equal(f.starts.filter((source) => source.active).length, 1);
        } finally { suspended.resolve(); f.audio.dispose(); }
      });
    }
  } finally { globalThis.AudioContext = previousContext; }
});
