import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGameAudio, readAudioSettings } from '../src/audio.mjs';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parse } from 'acorn';
import { CombatAudioGate } from '../src/audio-policy.mjs';
import { createUnitPresentationClientFixture, workerSnapshotRow } from './unit-presentation-client-fixture.mjs';

const key = 'tus-audio-v1';
const defaults = { enabled: true, captions: false, volume: 0.5, effectsLevel: 1,
  voiceLevel: 1, musicLevel: 1, ambience: true, ambienceLevel: 1 };
const doc = { hidden: true, addEventListener() {}, removeEventListener() {} };
function memoryStorage(initial) {
  const values = new Map(initial === undefined ? [] : [[key, initial]]);
  return { values, writes: [], getItem: (name) => values.get(name) ?? null,
    setItem(name, value) { this.writes.push(name); values.set(name, value); } };
}
function freshSettings(storage) {
  const audio = createGameAudio({ storage, doc });
  try { return audio.getSettings(); } finally { audio.dispose(); }
}

test('a fresh audio instance restores the complete independent mix and mute preferences', () => {
  const storage = memoryStorage();
  const audio = createGameAudio({ storage, doc });
  const chosen = { enabled: false, captions: true, volume: 0.37, effectsLevel: 0.64,
    voiceLevel: 0, musicLevel: 1.4, ambience: false, ambienceLevel: 0.22 };
  try {
    assert.deepEqual(audio.setSettings(chosen), chosen);
    assert.deepEqual(freshSettings(storage), chosen);
    assert.deepEqual(storage.writes, [key]);
    assert.deepEqual(JSON.parse(storage.values.get(key)), chosen);
    assert.deepEqual([...storage.values.keys()], [key]);
    audio.setSettings({ enabled: true });
    assert.deepEqual(freshSettings(storage), { ...chosen, enabled: true }, 'unmute preserves bus choices');
  } finally { audio.dispose(); }
});

test('zero master and zero bus levels survive reload without migration restoring their defaults', () => {
  const storage = memoryStorage();
  const audio = createGameAudio({ storage, doc });
  try {
    audio.setSettings({ volume: 0, effectsLevel: 0, voiceLevel: 0, musicLevel: 0, ambienceLevel: 0 });
    assert.deepEqual(freshSettings(storage), { ...defaults, volume: 0,
      effectsLevel: 0, voiceLevel: 0, musicLevel: 0, ambienceLevel: 0 });
    audio.setSettings({ volume: 0.5 });
    assert.deepEqual(freshSettings(storage), { ...defaults,
      effectsLevel: 0, voiceLevel: 0, musicLevel: 0, ambienceLevel: 0 });
  } finally { audio.dispose(); }
});

test('legacy ambience mix migrates once in memory and persists on an intentional edit', () => {
  const legacy = JSON.stringify({ enabled: false, volume: 0.4, effectsLevel: 0.7, ambienceLevel: 0.8 });
  const storage = memoryStorage(legacy);
  const expected = { ...defaults, enabled: false, volume: 0.4, effectsLevel: 0.7,
    musicLevel: 0.8, ambienceLevel: 0.8 };
  assert.deepEqual(freshSettings(storage), expected);
  assert.deepEqual(storage.writes, [], 'opening audio does not overwrite stored preferences');
  assert.equal(storage.values.get(key), legacy);
  const audio = createGameAudio({ storage, doc });
  try {
    audio.setSettings({ captions: true });
    assert.deepEqual(freshSettings(storage), { ...expected, captions: true });
  } finally { audio.dispose(); }
});

test('legacy ambience mute silences migrated music, while explicit music preferences take precedence', () => {
  assert.equal(freshSettings(memoryStorage(JSON.stringify({ ambience: false, ambienceLevel: 0.8 }))).musicLevel, 0);
  assert.equal(freshSettings(memoryStorage(JSON.stringify({ ambienceLevel: 0 }))).musicLevel, 0);
  assert.equal(freshSettings(memoryStorage(JSON.stringify({ ambience: false, musicLevel: 1.2 }))).musicLevel, 1.2);
  assert.equal(freshSettings(memoryStorage(JSON.stringify({ musicLevel: 0, ambienceLevel: 0.8 }))).musicLevel, 0);
});

test('missing, malformed and non-record JSON starts with defaults and can save a fresh preference', () => {
  for (const stored of [undefined, '', '{bad json', 'null', 'false', '42', '"text"', '[]']) {
    const storage = memoryStorage(stored);
    assert.deepEqual(freshSettings(storage), defaults, `defaults for ${stored}`);
    assert.deepEqual(storage.writes, []);
    const audio = createGameAudio({ storage, doc });
    try {
      audio.setSettings({ volume: 0.24 });
      assert.deepEqual(freshSettings(storage), { ...defaults, volume: 0.24 });
    } finally { audio.dispose(); }
  }
});

test('stored wrong types default and out-of-range numbers are bounded after reload', () => {
  const storage = memoryStorage(JSON.stringify({ enabled: 'false', captions: 1, volume: -2,
    effectsLevel: 9, voiceLevel: '0', musicLevel: null, ambience: 0, ambienceLevel: 3 }));
  assert.deepEqual(freshSettings(storage), { ...defaults, volume: 0, effectsLevel: 2,
    musicLevel: 2, ambienceLevel: 2 });
  const audio = createGameAudio({ storage, doc });
  try {
    audio.setSettings({ volume: Infinity, enabled: 'true', voiceLevel: NaN, musicLevel: -1, effectsLevel: -1 });
    assert.deepEqual(freshSettings(storage), { ...defaults, volume: 0,
      effectsLevel: 0, musicLevel: 0, ambienceLevel: 2 });
  } finally { audio.dispose(); }
});

test('unavailable reads fall back to defaults without throwing during construction or editing', () => {
  const storage = { getItem() { throw new Error('Storage denied'); }, setItem() { throw new Error('Storage denied'); } };
  const audio = createGameAudio({ storage, doc });
  try {
    assert.deepEqual(audio.getSettings(), defaults);
    assert.deepEqual(audio.setSettings({ enabled: false, volume: 0.2 }), { ...defaults, enabled: false, volume: 0.2 });
    assert.deepEqual(freshSettings(storage), defaults, 'unreadable preferences cannot establish durability');
  } finally { audio.dispose(); }
  assert.deepEqual(freshSettings(null), defaults);
});

test('write failure keeps the live mix and prior durable preferences; a later edit retries', () => {
  const storage = memoryStorage(JSON.stringify({ volume: 0.4 }));
  const write = storage.setItem.bind(storage);
  storage.setItem = () => { throw new Error('Quota exceeded'); };
  const audio = createGameAudio({ storage, doc });
  try {
    const live = { ...defaults, volume: 0.2, enabled: false, captions: true };
    assert.deepEqual(audio.setSettings({ volume: 0.2, enabled: false, captions: true }), live);
    assert.deepEqual(audio.getSettings(), live);
    assert.deepEqual(freshSettings(storage), { ...defaults, volume: 0.4 }, 'failed save does not claim durable settings');
    storage.setItem = write;
    audio.setSettings({ voiceLevel: 0.3 });
    assert.deepEqual(freshSettings(storage), { ...live, voiceLevel: 0.3 });
  } finally { audio.dispose(); }
});

test('denied browser storage getter uses a live mix without requiring storage', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('Storage denied'); } });
  let audio;
  try {
    assert.deepEqual(readAudioSettings(), defaults);
    audio = createGameAudio({ doc });
    assert.deepEqual(audio.setSettings({ captions: true }), { ...defaults, captions: true });
  } finally {
    audio?.dispose();
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
});

test('returned settings snapshots and disposed instances cannot mutate durable preferences', () => {
  const storage = memoryStorage();
  const audio = createGameAudio({ storage, doc });
  const updated = audio.setSettings({ captions: true });
  updated.volume = 0;
  const snapshot = audio.getSettings(); snapshot.enabled = false;
  assert.deepEqual(audio.getSettings(), { ...defaults, captions: true });
  audio.dispose();
  audio.setSettings({ volume: 0, enabled: false });
  assert.deepEqual(freshSettings(storage), { ...defaults, captions: true });
  assert.deepEqual(storage.writes, [key]);
});

// Actual Main HP aggregation, warning policy, audio eligibility and caption
// consumer. Web Audio nodes and DOM are modeled; no hearing/rendering is inferred.
const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const declarations = parse(main, { ecmaVersion: 'latest', sourceType: 'module' }).body;
const captionDeclaration = declarations.find(node => node.type === 'VariableDeclaration'
  && node.declarations.some(declaration => declaration.id.name === 'AUDIO_CAPTIONS'));
const captionFunction = declarations.find(node => node.type === 'FunctionDeclaration' && node.id.name === 'showAudioCaption');
const settle = () => new Promise(resolve => setImmediate(resolve));
const parameter = () => ({ value: 0, setTargetAtTime() {}, setValueAtTime() {},
  linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
const audioNode = () => ({ connect() {}, disconnect() {}, start() {}, stop() {} });

test('fresh disclosed damage warns after presentation returns, without replaying unavailable first contact', async t => {
  const originalContext = globalThis.AudioContext;
  globalThis.AudioContext = class {
    state = 'running'; currentTime = 0; sampleRate = 100; destination = audioNode();
    createGain() { return { ...audioNode(), gain: parameter() }; }
    createBiquadFilter() { return { ...audioNode(), frequency: parameter(), Q: parameter() }; }
    createBuffer(_channels, length) { return { getChannelData: () => new Float32Array(length) }; }
    createBufferSource() { return audioNode(); }
    createOscillator() { return { ...audioNode(), frequency: parameter() }; }
    async decodeAudioData() { return { duration: 1, numberOfChannels: 1, length: 100 }; }
    async suspend() { this.state = 'suspended'; }
    async resume() { this.state = 'running'; }
    async close() { this.state = 'closed'; }
  };
  async function fixture(settings = {}, { team = 0, x = 30, z = -20 } = {}) {
    const f = await createUnitPresentationClientFixture({ localTeam: team });
    const listeners = new Map(), scheduled = [], events = [];
    const visibleDoc = { hidden: false, addEventListener: (event, fn) => listeners.set(event, fn), removeEventListener() {} };
    const audio = createGameAudio({ storage: memoryStorage(JSON.stringify({ ...defaults, musicLevel: 0, ambience: false, ...settings })), doc: visibleDoc, onCue: cue => scheduled.push(cue),
      onCueDecision: cue => f.context.showAudioCaption(cue) });
    f.context.audio = audio; f.context.combatAudioGate = new CombatAudioGate();
    f.context.recovering = false;
    f.context.canPresentLiveFeedback = () => !visibleDoc.hidden && !f.context.recovering;
    f.context.ui.audioCaption = { hidden: true, textContent: '' };
    f.context.window = { setTimeout: () => 1, clearTimeout() {} };
    vm.runInContext(`let audioCaptionTimer = null; function clearAudioCaption() {}
      ${main.slice(captionDeclaration.start, captionDeclaration.end)}
      ${main.slice(captionFunction.start, captionFunction.end)}`, f.context);
    const playEvent = audio.playEvent;
    audio.playEvent = event => { events.push(event); return playEvent(event); };
    let hp = 100, now = 0;
    const row = () => workerSnapshotRow({ team, x, z, hp });
    f.apply([row()], { initial: true, now });
    return { ...f, audio, scheduled, events, visibleDoc,
      damage() { hp--; now += 1000; f.apply([row()], { now }); },
      unchanged() { now += 1000; f.apply([row()], { now }); },
      hide() { visibleDoc.hidden = true; listeners.get('visibilitychange')?.(); },
      async show() { visibleDoc.hidden = false; listeners.get('visibilitychange')?.(); await settle(); },
      dispose() { audio.dispose(); f.dispose(); } };
  }
  try {
    for (const [name, settings, restore] of [
      ['pre-unlock', {}, f => f.audio.unlock()],
      ['master mute', { enabled: false }, f => f.audio.setSettings({ enabled: true })],
      ['zero master volume', { volume: 0 }, f => f.audio.setSettings({ volume: 0.5 })],
      ['effects bus mute', { effectsLevel: 0 }, f => f.audio.setSettings({ effectsLevel: 1 })],
    ]) await t.test(`${name}: unselected off-camera Worker warns on fresh damage after restore`, async () => {
      const f = await fixture(settings);
      try {
        if (name !== 'pre-unlock') f.audio.unlock();
        assert.equal(f.context.selected.size, 0);
        assert.deepEqual([f.context.cameraTarget.x, f.context.cameraTarget.z], [0, 0]);
        for (let i = 0; i < 10; i++) f.damage();
        assert.deepEqual(f.events, []); assert.deepEqual(f.scheduled, []);
        restore(f); await settle(); f.unchanged();
        assert.deepEqual(f.events, [], 'restoring settings does not replay old damage');
        f.damage();
        assert.deepEqual(f.events.map(event => event.cue), ['battle-alert']);
        assert.deepEqual(Object.keys(f.events[0]), ['cue'], 'no attacker, kind, count or position inference');
        assert.deepEqual(f.scheduled, ['battle-alert']);
        for (let i = 0; i < 10; i++) f.damage();
        assert.equal(f.events.length, 1, 'existing engagement aggregation/cadence remains unchanged');
      } finally { f.dispose(); }
    });
    await t.test('enabled captions present a muted first warning and retain aggregation through the actual consumer', async () => {
      const f = await fixture({ enabled: false, captions: true });
      try {
        f.damage(); assert.deepEqual(f.events.map(event => event.cue), ['battle-alert']);
        assert.deepEqual(f.scheduled, []);
        assert.equal(f.context.ui.audioCaption.hidden, false);
        assert.equal(f.context.ui.audioCaption.textContent, 'SOUND · YOUR UNITS TOOK DAMAGE');
        for (let i = 0; i < 10; i++) f.damage();
        assert.equal(f.events.length, 1);
      } finally { f.dispose(); }
    });
    for (const team of [0, 1]) for (const [position, x, z] of [['near', 1, 1], ['far', 30, -20]]) {
      await t.test(`seat ${team}: ${position} owned damage uses the accurate caption without inferring proximity or attacker`, async () => {
        const f = await fixture({ enabled: false, captions: true }, { team, x, z });
        try {
          assert.equal(f.context.localTeam, team);
          assert.equal(f.context.selected.size, 0);
          assert.deepEqual([f.context.cameraTarget.x, f.context.cameraTarget.z], [0, 0]);
          const ownRow = workerSnapshotRow({ team, x, z });
          f.apply([ownRow, workerSnapshotRow({ id: 1, team: 1 - team, x, z })], { now: 100 });
          f.apply([ownRow, workerSnapshotRow({ id: 1, team: 1 - team, x, z, hp: 99 })], { now: 200 });
          assert.deepEqual(f.events, [], 'opponent HP loss does not describe your units');
          assert.equal(f.context.ui.audioCaption.hidden, true);
          f.unchanged();
          assert.deepEqual(f.events, [], 'unchanged owned HP stays silent');
          f.damage();
          assert.deepEqual(f.events.map(event => event.cue), ['battle-alert']);
          assert.deepEqual(Object.keys(f.events[0]), ['cue'], 'no proximity, attacker or allied-unit metadata');
          assert.equal(f.context.ui.audioCaption.hidden, false);
          assert.equal(f.context.ui.audioCaption.textContent, 'SOUND · YOUR UNITS TOOK DAMAGE');
          assert.deepEqual(f.scheduled, [], 'caption-enabled master mute retains silence');
          for (let i = 0; i < 10; i++) f.damage();
          assert.equal(f.events.length, 1, 'existing warning aggregation remains unchanged');
          assert.deepEqual([f.context.cameraTarget.x, f.context.cameraTarget.z], [0, 0], 'warning does not move the camera');
        } finally { f.dispose(); }
      });
    }
    await t.test('hidden or recovering observations stay unpresented; return needs fresh damage', async () => {
      for (const mode of ['hidden', 'recovering']) {
        const f = await fixture(); f.audio.unlock();
        try {
          if (mode === 'hidden') f.hide(); else f.context.recovering = true;
          for (let i = 0; i < 10; i++) f.damage();
          assert.deepEqual(f.events, []);
          if (mode === 'hidden') await f.show(); else f.context.recovering = false;
          f.unchanged(); assert.deepEqual(f.events, []);
          f.context.selected.add(0); f.damage();
          assert.deepEqual(f.scheduled, ['selected-alert']);
        } finally { f.dispose(); }
      }
    });
    await t.test('readiness follows the selected civilization binding bus and never schedules or consumes cooldowns', async () => {
      const f = await fixture({ effectsLevel: 0 }); f.audio.unlock();
      const voice = { bus: 'voice', cooldownMs: 12000, variants: [{ sourceId: 'existing-fixture' }] };
      try {
        const pack = { id: 'warning-fixture', name: 'Warning fixture', profiles: [{ id: 'field', bindings: {},
          civilizationBindings: { frontier: { 'cue.battle-alert': voice } } }] };
        await f.audio.setMapAudio({ packId: pack.id, profileId: 'field' }, { async loadPack() {
          return { pack, sourceBlobs: { 'existing-fixture': new Blob([Uint8Array.of(1)]) } };
        } });
        for (let i = 0; i < 100; i++) assert.equal(f.audio.canPresentEvent({ cue: 'battle-alert' }), true);
        assert.deepEqual(f.audio.getInspector().decisions, []); assert.deepEqual(f.scheduled, []);
        assert.equal(f.audio.canPresentEvent({ cue: 'battle-alert', civilizationId: 'unknown' }), false, 'synthesis uses effects');
        f.audio.setSettings({ voiceLevel: 0, effectsLevel: 1 });
        assert.equal(f.audio.canPresentEvent({ cue: 'battle-alert' }), false, 'a selected muted voice binding stays muted');
        f.audio.setSettings({ captions: true });
        assert.equal(f.audio.canPresentEvent({ cue: 'battle-alert' }), true);
        f.hide(); assert.equal(f.audio.canPresentEvent({ cue: 'battle-alert' }), false);
        f.audio.dispose(); assert.equal(f.audio.canPresentEvent({ cue: 'battle-alert' }), false);
      } finally { f.dispose(); }
    });
    await t.test('all three existing alert gates preserve priority, reset and cooldown when presentation is available', async () => {
      const f = await fixture({ enabled: false });
      try {
        const gate = new CombatAudioGate(), damage = { friendlyDamage: 1, selectedDamage: 1, buildingDamage: 1,
          canPresent: cue => f.audio.canPresentEvent({ cue }) };
        assert.equal(gate.observe(damage, 1000), null);
        f.audio.setSettings({ enabled: true }); await settle();
        assert.equal(gate.observe(damage, 1001), 'base-alert');
        assert.equal(gate.observe(damage, 1002), 'selected-alert');
        assert.equal(gate.observe(damage, 1003), null);
        gate.reset(); assert.equal(gate.observe({ ...damage, buildingDamage: 0, selectedDamage: 0 }, 1004), 'battle-alert');
        assert.equal(gate.observe({ ...damage, buildingDamage: 0, selectedDamage: 0 }, 1005), null);
      } finally { f.dispose(); }
    });
  } finally { globalThis.AudioContext = originalContext; }
});
