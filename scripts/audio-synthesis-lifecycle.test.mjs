import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGameAudio } from '../src/audio.mjs';

const parameter = () => ({ value: 0, setTargetAtTime() {}, setValueAtTime() {},
  linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
const node = () => ({ connect() {}, disconnect() {} });
const settle = () => new Promise(resolve => setImmediate(resolve));

test('synthesized cues and music previews cannot return after interruption', async (t) => {
  const previousContext = globalThis.AudioContext;
  let clock = 1000;
  t.mock.method(performance, 'now', () => clock);
  function fixture() {
    const sources = [];
    const source = (kind) => {
      const value = { ...node(), kind, active: false, stops: [], disconnected: false,
        start() { this.active = true; },
        stop(at) {
          this.stops.push(at);
          if (at === undefined) { this.active = false; this.onended?.(); }
        },
        finish() { this.active = false; this.onended?.(); },
        disconnect() { this.disconnected = true; } };
      sources.push(value); return value;
    };
    globalThis.AudioContext = class {
      state = 'running'; currentTime = 10; sampleRate = 100; destination = node();
      createGain() { return { ...node(), gain: parameter() }; }
      createBiquadFilter() { return { ...node(), frequency: parameter(), Q: parameter() }; }
      createBuffer(_channels, length) { return { getChannelData: () => new Float32Array(length) }; }
      createBufferSource() { return source('noise'); }
      createOscillator() { return Object.assign(source('tone'), { frequency: parameter() }); }
      async suspend() { this.state = 'suspended'; }
      async resume() { this.state = 'running'; }
      async close() { this.state = 'closed'; }
    };
    let visibility;
    const doc = { hidden: false, addEventListener(_event, callback) { visibility = callback; }, removeEventListener() {} };
    const audio = createGameAudio({ doc, storage: null }); audio.unlock();
    return { audio, sources, hide() { doc.hidden = true; visibility(); }, show() { doc.hidden = false; visibility(); } };
  }
  const transitions = [
    ['Effects zero/restore', f => f.audio.setSettings({ effectsLevel: 0 }), f => f.audio.setSettings({ effectsLevel: 1 }), 'effects'],
    ['Music zero/restore', f => f.audio.setSettings({ musicLevel: 0 }), f => f.audio.setSettings({ musicLevel: 1 }), 'music'],
    ['master mute/restore', f => f.audio.setSettings({ enabled: false }), f => f.audio.setSettings({ enabled: true }), 'all'],
    ['Overall zero/restore', f => f.audio.setSettings({ volume: 0 }), f => f.audio.setSettings({ volume: 0.5 }), 'all'],
    ['hidden/return', f => f.hide(), f => f.show(), 'all'],
    ['map replacement', f => f.audio.setMapAudio(null), () => {}, 'all'],
  ];
  try {
    for (const [name, interrupt, restore, scope] of transitions) {
      await t.test(name, async () => {
        const f = fixture();
        try {
          const start = f.sources.length;
          assert.equal(f.audio.play('attack'), true);
          const cues = f.sources.slice(start);
          assert.equal(cues.filter(source => source.kind === 'noise').length, 2);
          assert.equal(cues.filter(source => source.kind === 'tone').length, 2);
          const beforePreview = f.sources.length;
          assert.equal(f.audio.previewAmbience(), true);
          const music = f.sources.slice(beforePreview);
          assert.equal(music.length, 3, 'preview contains notes scheduled in the future');
          await interrupt(f); await restore(f); await settle();
          for (const source of [...cues, ...music]) {
            const cancelled = scope === 'all' || (scope === 'effects' ? cues : music).includes(source);
            assert.equal(source.active, !cancelled, 'old notes stay cancelled; an independent bus keeps playing');
            if (cancelled) assert.equal(source.disconnected, true, 'cancelled nodes release their graph');
          }
          // This fixture does not advance the audio clock: naturally finish
          // the independent bus before checking fresh voice availability.
          for (const source of [...cues, ...music]) if (source.active) source.finish();
          const beforeFresh = f.sources.length; clock += 1000;
          assert.equal(f.audio.play('attack'), true);
          assert.equal(f.sources.length - beforeFresh, 4, 'one fresh cue has its two tones and two transients');
        } finally { f.audio.dispose(); }
      });
    }
    await t.test('repeated interruptions release voice budgets and end handlers exactly once', async () => {
      const f = fixture();
      try {
        for (let i = 0; i < 24; i++) {
          const before = f.sources.length; clock += 1000;
          assert.equal(f.audio.play('attack'), true);
          const current = f.sources.slice(before);
          assert.equal(current.length, 4, 'cancelled voices do not exhaust either tone or transient budget');
          f.audio.setSettings({ effectsLevel: 0 }); f.audio.setSettings({ effectsLevel: 1 });
          await settle();
          assert.ok(current.every(source => !source.active && source.onended === null));
        }
        for (let i = 0; i < 12; i++) assert.equal(f.audio.preview('select'), true);
        assert.equal(f.audio.preview('select'), false, 'cancellation cannot undercount and bypass the twelve-tone limit');
      } finally { f.audio.dispose(); }
    });
    await t.test('nonzero mix edits preserve current notes', async () => {
      const f = fixture();
      try {
        const before = f.sources.length; f.audio.play('attack'); f.audio.previewAmbience();
        const current = f.sources.slice(before);
        f.audio.setSettings({ effectsLevel: 0.25, musicLevel: 0.25, volume: 0.25, voiceLevel: 0, ambience: false });
        assert.ok(current.every(source => source.active));
      } finally { f.audio.dispose(); }
    });
  } finally { globalThis.AudioContext = previousContext; }
});
