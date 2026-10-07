import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { parse } from 'acorn';
import { BUILDING_DEFINITIONS, GAMEPLAY_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { validateAudioPack } from '../src/audio-assets.mjs';
import { createGameAudio } from '../src/audio.mjs';
import { createProfileDecisionGate, resolveEventBinding } from '../src/audio-event-profile.mjs';
import { CombatAudioGate } from '../src/audio-policy.mjs';

const manifest = JSON.parse(await readFile(new URL('../assets/audio/runtime/rts-feedback-test/v1/manifest.json', import.meta.url)));
const binding = (sourceId, bus = 'effects') => ({ bus, variants: [{ sourceId }], cooldownMs: 450 });
const settle = () => new Promise(resolve => setImmediate(resolve));
const parameter = () => ({ value: 0, values: [], setValueAtTime(value) { this.values.push(value); },
  exponentialRampToValueAtTime(value) { this.values.push(value); }, linearRampToValueAtTime() {}, setTargetAtTime() {} });
const node = () => ({ connect() {}, disconnect() {} });

// Execute the committed selection caller with its existing presentation boundary
// injected. No renderer, HUD changes, browser or hearing are inferred from this.
const mainSource = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const selectionNode = parse(mainSource, { ecmaVersion: 'latest', sourceType: 'module' }).body
  .find(node => node.type === 'FunctionDeclaration' && node.id.name === 'selectBuilding');
assert.ok(selectionNode, 'actual selection consumer remains discoverable');
const selectionSource = mainSource.slice(selectionNode.start, selectionNode.end);
function actualSelectionConsumer(audio) {
  return Function('audio', 'BUILDING_DEFINITIONS', `
    const localTeam = 0, selected = new Set(), buildingVisuals = new Map();
    let selectedBuildingId, lastFriendlyUnitClick, lastUnitPickState, selectionDirty;
    const clearWildlifeSelection = () => {}, selectedWorkerIds = () => [];
    const clearActiveControlGroup = () => {}, syncSelectionMesh = () => {};
    const updateSelectionUI = () => {}, updateBuildingSelectionVisual = () => {};
    const showToast = () => {}, buildingLabel = type => type;
    const window = { matchMedia: () => ({ matches: false }) };
    ${selectionSource}
    return selectBuilding;
  `)(audio, BUILDING_DEFINITIONS);
}

test('civilization bindings extend the existing pack without changing common metadata', () => {
  const common = validateAudioPack(manifest.pack);
  assert.ok(!Object.hasOwn(common.profiles[0], 'civilizationBindings'));
  const input = structuredClone(manifest.pack);
  input.profiles[0].civilizationBindings = {
    frontier: { 'building.barracks.select': binding('horn-note', 'voice') },
    boughward: { 'cue.select': binding('wood-token') },
  };
  const normalized = validateAudioPack(input);
  assert.deepEqual(normalized.profiles[0].civilizationBindings, input.profiles[0].civilizationBindings);
  const restored = structuredClone(normalized); delete restored.profiles[0].civilizationBindings;
  assert.deepEqual(restored, common, 'all legacy normalized keys and values remain identical');
  assert.deepEqual(Object.keys(GAMEPLAY_DEFINITIONS.factions), ['frontier'], 'art-only civilizations are not gameplay registrations');
  for (const invalid of [null, [], 'frontier']) {
    const bad = structuredClone(input); bad.profiles[0].civilizationBindings = invalid;
    assert.throws(() => validateAudioPack(bad), /civilizationBindings: must be an object/);
  }
  for (const [id, overrides, pattern] of [
    ['../escape', {}, /civilizationBindings/],
    [' frontier ', {}, /civilizationBindings/],
    ['frontier', [], /civilizationBindings.frontier/],
    ['frontier', { 'building.barracks.select': binding('absent') }, /unknown source absent/],
    ['frontier', { 'enemy.position': binding('horn-note') }, /invalid event key/],
  ]) {
    const bad = structuredClone(manifest.pack); bad.profiles[0].civilizationBindings = { [id]: overrides };
    assert.throws(() => validateAudioPack(bad), pattern);
  }
  const oversized = structuredClone(manifest.pack);
  oversized.profiles[0].civilizationBindings = Object.fromEntries(Array.from({ length: 33 }, (_, i) => [`civilization-${i}`, {}]));
  assert.throws(() => validateAudioPack(oversized), /at most 32/);
});

test('sparse civilization overrides use the common exact/role/cue chain for missing or unknown identities', () => {
  const common = binding('muted-pluck');
  const exact = binding('horn-note', 'voice');
  const regional = binding('wood-token');
  const profile = { bindings: { 'building.barracks.select': common, 'cue.select': common },
    civilizationBindings: { frontier: { 'building.barracks.select': exact }, boughward: { 'cue.select': regional } } };
  assert.equal(resolveEventBinding(profile, { cue: 'select', buildingType: 'barracks' }).binding, exact);
  assert.equal(resolveEventBinding(profile, { cue: 'select', buildingType: 'barracks', civilizationId: 'boughward' }).binding, regional);
  for (const civilizationId of ['unknown-civilization', 'constructor', 'toString', null]) {
    assert.equal(resolveEventBinding(profile, { cue: 'select', buildingType: 'barracks', civilizationId }).binding,
      civilizationId === null ? exact : common);
  }
  assert.equal(resolveEventBinding(profile, { cue: 'select', buildingType: 'watchtower' }).binding, common,
    'an absent override keeps the common generic recorded choice');
  assert.equal(resolveEventBinding(profile, { cue: 'gather', kind: 'worker', resource: 'wood' }), null);
});

test('civilization selection retains shared cooldown, random nonrepeat and urgent speech priority', () => {
  let now = 1000;
  const gate = createProfileDecisionGate({ now: () => now });
  const profile = { bindings: { 'cue.base-alert': binding('horn-note', 'voice') }, civilizationBindings: {
    frontier: { 'building.barracks.select': { bus: 'voice', variants: [{ sourceId: 'one' }, { sourceId: 'two' }] } },
  } };
  const event = { cue: 'select', buildingType: 'barracks', civilizationId: 'frontier' };
  const first = gate.choose(profile, event);
  assert.ok(first); assert.equal(gate.choose(profile, event), null);
  assert.ok(gate.choose(profile, { cue: 'base-alert' }), 'existing urgent warning interrupts routine speech');
  now += 1300; const second = gate.choose(profile, event);
  assert.notEqual(second.variant.sourceId, first.variant.sourceId);
});

test('actual building selection uses distinct default synthesis and the existing lifetime rules', async t => {
  const originalContext = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext');
  let clock = 1000; t.mock.method(performance, 'now', () => clock);
  function fixture(civilizationId) {
    const sources = []; let context;
    const source = kind => {
      const value = { ...node(), kind, active: false,
        start() { this.active = true; }, stop(at) { if (at === undefined) this.finish(); },
        finish() { if (!this.active) return; this.active = false; this.onended?.(); } };
      sources.push(value); return value;
    };
    globalThis.AudioContext = class {
      constructor() { context = this; }
      state = 'running'; currentTime = 10; sampleRate = 100; destination = node();
      createGain() { return { ...node(), gain: parameter() }; }
      createBiquadFilter() { return { ...node(), frequency: parameter(), Q: parameter() }; }
      createBuffer(_channels, length) { return { getChannelData: () => new Float32Array(length) }; }
      createBufferSource() { return source('sample'); }
      createOscillator() { return Object.assign(source('tone'), { frequency: parameter() }); }
      async decodeAudioData() { return { duration: 1, length: 100, numberOfChannels: 1 }; }
      async suspend() { this.state = 'suspended'; }
      async resume() { this.state = 'running'; }
      async close() { this.state = 'closed'; }
    };
    const listeners = new Map(), cues = [], decisionCallbacks = [];
    const doc = { hidden: false, addEventListener: (event, fn) => listeners.set(event, fn),
      removeEventListener: event => listeners.delete(event) };
    const audio = createGameAudio({ storage: null, doc, civilizationId, onCue: cue => cues.push(cue), onCueDecision: cue => decisionCallbacks.push(cue) });
    audio.setSettings({ ambience: false, musicLevel: 0 }); audio.unlock();
    return { audio, sources, cues, decisionCallbacks, doc, select: actualSelectionConsumer(audio), context: () => context,
      finish() { for (const source of sources) source.finish(); },
      hide() { doc.hidden = true; listeners.get('visibilitychange')?.(); },
      async show() { doc.hidden = false; listeners.get('visibilitychange')?.(); await settle(); } };
  }
  try {
    await t.test('all registered authoritative building types, including town hall, emit one distinct selection', () => {
      const f = fixture(); const signatures = new Set();
      try {
        for (const [i, type] of Object.keys(BUILDING_DEFINITIONS).entries()) {
          clock += 1000; const before = f.sources.length;
          f.select({ id: i, team: 0, type, complete: true, hp: 100 });
          const tones = f.sources.slice(before).filter(source => source.kind === 'tone');
          assert.equal(tones.length, 1, `${type}: one group/building decision, no per-unit loop`);
          assert.notDeepEqual(tones[0].frequency.values, [620, 780], `${type}: registered types cannot silently use the generic signature`);
          signatures.add(JSON.stringify(tones[0].frequency.values)); f.finish();
        }
        assert.equal(signatures.size, Object.keys(BUILDING_DEFINITIONS).length);
        assert.equal(f.cues.length, Object.keys(BUILDING_DEFINITIONS).length);
      } finally { f.audio.dispose(); }
    });
    await t.test('rapid repeated selections share the existing 90 ms cue cooldown', () => {
      const f = fixture();
      try { clock += 1000; f.select({ id: 1, team: 0, type: 'barracks' }); const count = f.sources.length;
        for (let i = 0; i < 100; i++) f.select({ id: i, team: 0, type: 'watchtower' });
        assert.equal(f.sources.length, count);
        clock += 90; f.select({ id: 2, team: 0, type: 'watchtower' }); assert.equal(f.sources.length, count + 1);
      } finally { f.audio.dispose(); }
    });
    for (const [name, interrupt, restore] of [
      ['master mute', f => f.audio.setSettings({ enabled: false }), f => f.audio.setSettings({ enabled: true })],
      ['effects mute', f => f.audio.setSettings({ effectsLevel: 0 }), f => f.audio.setSettings({ effectsLevel: 1 })],
      ['hidden/focus return', f => f.hide(), f => f.show()],
    ]) await t.test(`${name}: no stale building selection returns; a fresh interaction works`, async () => {
      const f = fixture();
      try { clock += 1000; f.select({ id: 1, team: 0, type: 'barracks' });
        const old = f.sources.filter(source => source.kind === 'tone' && source.active); assert.equal(old.length, 1);
        await interrupt(f); assert.ok(old.every(source => !source.active));
        clock += 1000; const before = f.sources.length; f.select({ id: 2, team: 0, type: 'watchtower' });
        assert.equal(f.sources.length, before);
        await restore(f); assert.equal(f.sources.length, before, 'return cannot replay old selection');
        clock += 1000; f.select({ id: 3, team: 0, type: 'watchtower' }); assert.equal(f.sources.length, before + 1);
      } finally { f.audio.dispose(); }
    });
    await t.test('unknown civilization uses the same default building tone; unknown building preserves generic selection', () => {
      const f = fixture('not-a-registered-civilization');
      try { clock += 1000; f.select({ id: 1, team: 0, type: 'barracks' }); const unknownCivilization = f.sources.at(-1).frequency.values;
        f.finish(); clock += 1000; f.audio.playEvent({ cue: 'select', buildingType: 'barracks', civilizationId: 'frontier' });
        assert.deepEqual(f.sources.at(-1).frequency.values, unknownCivilization);
        f.finish(); clock += 1000; f.audio.playEvent({ cue: 'select', buildingType: 'unregistered-building' });
        assert.deepEqual(f.sources.at(-1).frequency.values, [620, 780]);
      } finally { f.audio.dispose(); }
    });
    await t.test('a validated civilization sample override wins, then unknown civilization keeps common/default fallback', async () => {
      const f = fixture();
      try { const input = structuredClone(manifest.pack); input.profiles[0].bindings = {};
        input.profiles[0].civilizationBindings = { frontier: { 'building.barracks.select': binding('horn-note', 'voice') } };
        const pack = validateAudioPack(input);
        await f.audio.setMapAudio({ packId: pack.id, profileId: pack.profiles[0].id }, { async loadPack() {
          return { pack, sourceBlobs: { 'horn-note': new Blob([Uint8Array.of(1)]) } }; } });
        clock += 2000; const before = f.sources.length; f.select({ id: 1, team: 0, type: 'barracks' }); await settle();
        assert.equal(f.sources.slice(before).filter(source => source.kind === 'sample').length, 1);
        assert.equal(f.sources.slice(before).filter(source => source.kind === 'tone').length, 0);
        f.finish(); clock += 2000; const next = f.sources.length;
        f.audio.playEvent({ cue: 'select', buildingType: 'barracks', civilizationId: 'unknown' });
        assert.equal(f.sources.slice(next).filter(source => source.kind === 'tone').length, 1);
      } finally { f.audio.dispose(); }
    });
    await t.test('an omitted or nullish event identity inherits the audio instance civilization', async () => {
      const f = fixture('preview-civilization');
      try { const input = structuredClone(manifest.pack); input.profiles[0].bindings = {};
        input.profiles[0].civilizationBindings = { 'preview-civilization': { 'building.barracks.select': binding('horn-note', 'voice') } };
        const pack = validateAudioPack(input);
        await f.audio.setMapAudio({ packId: pack.id, profileId: pack.profiles[0].id }, { async loadPack() {
          return { pack, sourceBlobs: { 'horn-note': new Blob([Uint8Array.of(1)]) } }; } });
        for (const civilizationId of [undefined, null]) {
          clock += 2000; const before = f.sources.length;
          f.audio.playEvent({ cue: 'select', buildingType: 'barracks', civilizationId }); await settle();
          assert.equal(f.sources.slice(before).filter(source => source.kind === 'sample').length, 1);
          assert.equal(f.sources.slice(before).filter(source => source.kind === 'tone').length, 0);
          f.finish();
        }
      } finally { f.audio.dispose(); }
    });
    await t.test('a failed civilization sample decode retains the selected building type in synthesis', async () => {
      const f = fixture();
      try { const input = structuredClone(manifest.pack); input.profiles[0].bindings = {};
        input.profiles[0].civilizationBindings = { frontier: { 'building.watchtower.select': binding('horn-note', 'voice') } };
        const pack = validateAudioPack(input);
        await f.audio.setMapAudio({ packId: pack.id, profileId: pack.profiles[0].id }, { async loadPack() {
          return { pack, sourceBlobs: { 'horn-note': new Blob([Uint8Array.of(1)]) } }; } });
        f.context().decodeAudioData = async () => { throw new Error('Fixture codec failure'); };
        clock += 2000; const before = f.sources.length; f.select({ id: 1, team: 0, type: 'watchtower' }); await settle();
        const tones = f.sources.slice(before).filter(source => source.kind === 'tone');
        assert.equal(tones.length, 1); assert.equal(tones[0].frequency.values[0], 880);
      } finally { f.audio.dispose(); }
    });
    await t.test('existing attack aggregation and muted warning decision callbacks remain available for multiple units', () => {
      const f = fixture(); const gate = new CombatAudioGate();
      try { clock += 1000; const cue = gate.observe({ friendlyDamage: 1000 }, clock); assert.equal(cue, 'battle-alert');
        assert.equal(f.audio.playEvent({ cue }), true);
        for (let i = 1; i < 50; i++) assert.equal(gate.observe({ friendlyDamage: 1000 }, clock + i), null);
        clock += 10000; assert.equal(gate.observe({ friendlyDamage: 1 }, clock), 'battle-alert');
        assert.equal(gate.observe({ friendlyDamage: 2, selectedDamage: 2, buildingDamage: 3 }, clock + 1), 'base-alert');
        f.audio.setSettings({ enabled: false }); const before = f.sources.length;
        assert.equal(f.audio.playEvent({ cue: 'selected-alert' }), false);
        assert.equal(f.sources.length, before);
        assert.ok(f.decisionCallbacks.includes('selected-alert'), 'decision callback observed; no caption UI is instantiated');
      } finally { f.audio.dispose(); }
    });
  } finally {
    if (originalContext) Object.defineProperty(globalThis, 'AudioContext', originalContext);
    else delete globalThis.AudioContext;
  }
});
