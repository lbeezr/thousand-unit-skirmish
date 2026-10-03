import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGameAudio, readAudioSettings } from '../src/audio.mjs';

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
