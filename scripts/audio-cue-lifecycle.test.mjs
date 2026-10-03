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

test('sampled selection and command lifecycle races', async (t) => {
  const previousContext = globalThis.AudioContext;
  let clock = 1000;
  t.mock.method(performance, 'now', () => clock);
  async function fixture(bus = 'voice') {
    const f = { starts: [], cues: [], captions: [], statuses: [], entered: deferred(),
      decode: deferred(), closing: deferred(), context: null };
    globalThis.AudioContext = class {
      constructor() { f.context = this; }
      state = 'running'; currentTime = 10; sampleRate = 100; destination = node();
      createGain() { return { ...node(), gain: parameter() }; }
      createBiquadFilter() { return { ...node(), frequency: parameter() }; }
      createBuffer(_channels, length) { return { getChannelData: () => new Float32Array(length) }; }
      createBufferSource() {
        const source = { ...node(), buffer: null, active: false,
          start() { this.active = true; f.starts.push(this); },
          stop(at) { if (at === undefined) { this.active = false; this.onended?.(); } } };
        return source;
      }
      createOscillator() { return { ...node(), frequency: parameter(), active: false,
        start() { this.active = true; f.starts.push(this); },
        stop(at) { if (at === undefined) { this.active = false; this.onended?.(); } } }; }
      async decodeAudioData() { f.entered.resolve(); return f.decode.promise; }
      async suspend() { this.state = 'suspended'; }
      async resume() { this.state = 'running'; }
      async close() { await f.closing.promise; this.state = 'closed'; }
    };
    let visibility;
    const doc = { hidden: false,
      addEventListener(_event, callback) { visibility = callback; }, removeEventListener() {} };
    f.hide = () => { doc.hidden = true; visibility(); };
    f.show = async () => { doc.hidden = false; visibility(); await settle(); };
    f.audio = createGameAudio({ storage: null, doc,
      onCue: (cue) => f.cues.push(cue), onProfileCaption: (caption) => f.captions.push(caption),
      onPackStatus: (status) => f.statuses.push(status) });
    f.audio.unlock();
    f.buffer = { sampled: true, duration: 1, length: 100, numberOfChannels: 1 };
    f.samples = () => f.starts.filter((source) => source.buffer?.sampled);
    const binding = { bus, variants: [{ sourceId: 'ack', caption: 'Current interaction' }] };
    const pack = { id: 'fixture', name: 'Fixture', compositions: [], profiles: [
      { id: 'field', bindings: { 'unit.worker.select': binding, 'unit.worker.move': binding }, music: {} },
    ] };
    await f.audio.setMapAudio({ packId: 'fixture', profileId: 'field' }, {
      async loadPack() { return { pack, sourceBlobs: { ack: new Blob([Uint8Array.of(1)]) } }; },
    });
    f.cleanup = () => { f.decode.resolve(f.buffer); f.closing.resolve(); f.audio.dispose(); };
    return f;
  }
  const muted = (bus) => bus === 'voice' ? { voiceLevel: 0 }
    : bus === 'ambience' ? { ambience: false } : { effectsLevel: 0 };
  const restored = (bus) => bus === 'voice' ? { voiceLevel: 1 }
    : bus === 'ambience' ? { ambience: true } : { effectsLevel: 1 };
  const transitions = [
    ['hide/return', async (f) => { f.hide(); await f.show(); }],
    ['bus mute/restore', async (f, bus) => { f.audio.setSettings(muted(bus)); f.audio.setSettings(restored(bus)); }],
    ['master mute/restore', async (f) => { f.audio.setSettings({ enabled: false }); f.audio.setSettings({ enabled: true }); }],
    ['zero master volume/restore', async (f) => { f.audio.setSettings({ volume: 0 }); f.audio.setSettings({ volume: 0.5 }); }],
  ];
  try {
    for (const bus of ['voice', 'effects', 'ambience']) {
      for (const cue of ['select', 'move']) {
        for (const [name, transition] of transitions) {
          for (const failure of [false, true]) {
            await t.test(`${bus} ${cue}: ${name} cancels ${failure ? 'failed' : 'successful'} decode`, async () => {
              const f = await fixture(bus);
              try {
                assert.equal(f.audio.playEvent({ cue, kind: 'worker' }), true);
                await f.entered.promise;
                await transition(f, bus);
                if (failure) f.decode.reject(new Error('Old decode failed'));
                else f.decode.resolve(f.buffer);
                await settle();
                assert.equal(f.samples().length, 0, 'old interaction never schedules a sample after return');
                assert.deepEqual(f.cues, [], 'old decode cannot emit selection/command acknowledgement or synthesis');
                assert.deepEqual(f.captions, [], 'old profile caption cannot acknowledge selection');
                assert.ok(!f.statuses.some((status) => status.includes('could not decode')), 'cancelled errors are silent');
                // Preserve the normal binding/speech cooldown rather than waiting on wall time.
                clock += 2000;
                if (failure) {
                  f.decode = deferred(); f.decode.resolve(f.buffer);
                }
                assert.equal(f.audio.playEvent({ cue, kind: 'worker' }), true);
                await settle();
                assert.equal(f.samples().length, 1, 'one fresh authorized interaction schedules once');
                assert.deepEqual(f.cues, [cue]);
                assert.deepEqual(f.captions, ['Current interaction']);
              } finally { f.cleanup(); }
            });
          }
        }
      }
      await t.test(`${bus}: muting stops active samples and restoration never replays them`, async () => {
        const f = await fixture(bus);
        try {
          f.audio.playEvent({ cue: 'select', kind: 'worker' });
          await f.entered.promise; f.decode.resolve(f.buffer); await settle();
          assert.equal(f.samples().filter((source) => source.active).length, 1);
          f.audio.setSettings(muted(bus));
          assert.equal(f.audio.getInspector().activeSamples, 0);
          f.audio.setSettings(restored(bus)); await settle();
          assert.equal(f.samples().filter((source) => source.active).length, 0);
          assert.equal(f.samples().length, 1);
        } finally { f.cleanup(); }
      });
    }
    for (const failure of [false, true]) {
      await t.test(`dispose cancels ${failure ? 'failed' : 'successful'} decode before async close completes`, async () => {
        const f = await fixture();
        try {
          f.audio.playEvent({ cue: 'select', kind: 'worker' });
          await f.entered.promise;
          f.audio.dispose();
          const before = f.starts.length;
          if (failure) f.decode.reject(new Error('Disposed decode failed'));
          else f.decode.resolve(f.buffer);
          await settle();
          assert.equal(f.starts.length, before, 'no sample or fallback starts after dispose');
          assert.deepEqual(f.cues, []);
          assert.deepEqual(f.captions, []);
          assert.equal(f.audio.play('attack'), false);
          assert.equal(f.audio.playEvent({ cue: 'move', kind: 'worker' }), false);
          f.audio.unlock(); f.audio.previewAmbience();
          await f.audio.setMapAudio(null);
          await settle();
          assert.equal(f.starts.length, before, 'public calls cannot restart disposed audio');
        } finally { f.cleanup(); }
      });
    }
    await t.test('dispose immediately stops samples, synthesized cues and previews while close is pending', async () => {
      const f = await fixture();
      try {
        f.audio.playEvent({ cue: 'select', kind: 'worker' });
        await f.entered.promise; f.decode.resolve(f.buffer); await settle();
        assert.equal(f.audio.play('attack'), true);
        assert.equal(f.audio.previewAmbience(), true);
        assert.ok(f.starts.filter((source) => source.active).length > 1);
        f.audio.dispose();
        assert.equal(f.starts.filter((source) => source.active).length, 0);
        assert.equal(f.audio.getInspector().activeSamples, 0);
      } finally { f.cleanup(); }
    });
    await t.test('hide/return stops an active selection voice without replaying its acknowledgement', async () => {
      const f = await fixture();
      try {
        f.audio.playEvent({ cue: 'select', kind: 'worker' });
        await f.entered.promise; f.decode.resolve(f.buffer); await settle();
        f.hide(); await f.show();
        assert.equal(f.samples().filter((source) => source.active).length, 0);
        assert.equal(f.samples().length, 1);
        assert.deepEqual(f.cues, ['select']);
        assert.deepEqual(f.captions, ['Current interaction']);
      } finally { f.cleanup(); }
    });
    await t.test('muting another bus leaves the current interaction eligible', async () => {
      const f = await fixture('voice');
      try {
        f.audio.playEvent({ cue: 'select', kind: 'worker' });
        await f.entered.promise;
        f.audio.setSettings({ effectsLevel: 0 });
        f.decode.resolve(f.buffer); await settle();
        assert.equal(f.samples().length, 1);
        assert.deepEqual(f.cues, ['select']);
      } finally { f.cleanup(); }
    });
  } finally { globalThis.AudioContext = previousContext; }
});
