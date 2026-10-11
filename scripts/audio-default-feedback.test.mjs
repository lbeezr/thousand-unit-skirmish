import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createGameAudio } from '../src/audio.mjs';
import { loadShippedAudio } from '../src/audio-shipped-loader.mjs';
import { DEFAULT_GAME_AUDIO_REFERENCE } from '../src/audio-shipped-catalog.mjs';
import { isClientStaticAsset } from '../src/server/client-static-assets.mjs';
import { resolveEventBinding } from '../src/audio-event-profile.mjs';
import { UNIT_DEFINITIONS, BUILDING_DEFINITIONS } from '../src/gameplay-definitions.mjs';

const settle = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
const parameter = () => ({ value: 0, setTargetAtTime() {}, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
const node = () => ({ connect() {}, disconnect() {}, start() {}, stop() {} });
const binding = (sourceId, bus = 'voice', priority = 0) => ({ bus, priority, cooldownMs: 450, variants: [{ sourceId }] });
const source = value => new Blob([Uint8Array.of(value)]);
function loaded(bindings, blobs = { select: source(1), wood: source(2) }) {
  return { pack: { id: 'fixture', name: 'Fixture', compositions: [], profiles: [{ id: 'field', bindings, music: {} }] }, sourceBlobs: blobs };
}
const defaults = () => loaded({ 'unit.worker.select': binding('select'), 'unit.worker.gather.wood': binding('wood', 'voice', 1) });
const reference = { packId: 'fixture', profileId: 'field' };
function fixture(t, loader = async () => defaults()) {
  const previous = globalThis.AudioContext;
  const f = { clock: 1000, scheduled: [], deferredDecodes: new Map(), doc: { hidden: false, addEventListener() {}, removeEventListener() {} } };
  t.mock.method(performance, 'now', () => f.clock);
  globalThis.AudioContext = class {
    state = 'running'; currentTime = 10; sampleRate = 100; destination = node();
    createGain() { return { ...node(), gain: parameter() }; }
    createBiquadFilter() { return { ...node(), frequency: parameter(), Q: parameter() }; }
    createBuffer(_channels, length) { return { getChannelData: () => new Float32Array(length) }; }
    createBufferSource() { return { ...node(), start() { if (this.buffer?.id) f.scheduled.push(this); }, stop() { this.stopped = true; this.onended?.(); } }; }
    createOscillator() { return { ...node(), frequency: parameter() }; }
    async decodeAudioData(bytes) { const id = new Uint8Array(bytes)[0]; return f.deferredDecodes.get(id)?.promise || { id, duration: 1, length: 100, numberOfChannels: 1 }; }
    async resume() { this.state = 'running'; }
    async suspend() { this.state = 'suspended'; }
    async close() { this.state = 'closed'; }
  };
  f.audio = createGameAudio({ storage: null, doc: f.doc, defaultReference: reference, loadShippedPack: loader });
  t.after(() => { f.audio.dispose(); globalThis.AudioContext = previous; });
  f.audio.unlock();
  return f;
}

test('normal gameplay ships a hash-verified default interaction pack with real recordings', async () => {
  const requested = [];
  const pack = await loadShippedAudio(DEFAULT_GAME_AUDIO_REFERENCE, { fetch: async path => {
    requested.push(path);
    const bytes = await readFile(new URL(`..${path}`, import.meta.url));
    return new Response(bytes, { headers: { 'content-type': path.endsWith('.json') ? 'application/json' : 'audio/mpeg' } });
  } });
  const profile = pack.pack.profiles.find(p => p.id === DEFAULT_GAME_AUDIO_REFERENCE.profileId);
  for (const [key, count] of [['unit.worker.select', 4], ['unit.worker.gather.wood', 4], ['building.barracks.select', 1], ['building.town-center.select', 2]]) {
    assert.equal(profile.bindings[key].variants.length, count, key);
    for (const variant of profile.bindings[key].variants) assert.ok(pack.sourceBlobs[variant.sourceId].size > 1000);
  }
  assert.equal(requested.length, 120);
  const catalog = JSON.parse(await readFile(new URL('../assets/audio/frontier-feedback-v1/catalog.json', import.meta.url)));
  for (const item of catalog.recordings) {
    const bytes = await readFile(new URL(`../assets/audio/frontier-feedback-v1/sources/${item.fileName}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), item.sha256);
    assert.equal(isClientStaticAsset(`assets/audio/frontier-feedback-v1/sources/${item.fileName}`), item.runtime);
  }
  assert.equal(isClientStaticAsset('assets/audio/runtime/frontier-feedback/v1/manifest.json'), true);
  assert.equal(isClientStaticAsset('assets/audio/runtime/frontier-feedback/v2/manifest.json'), true);
  assert.equal(isClientStaticAsset('assets/audio/runtime/frontier-feedback/v3/manifest.json'), true);
  for (const path of ['catalog.json', 'build-manifest.mjs', 'sources/worker-select-5.mp3', 'sources/private.mp3']) {
    assert.equal(isClientStaticAsset(`assets/audio/frontier-feedback-v1/${path}`), false);
  }
  const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /createGameAudio\(\{\s*defaultReference: DEFAULT_GAME_AUDIO_REFERENCE,/);
});

test('default Worker orders resolve distinct spoken meanings with preserved originals and exact admission', async () => {
  const reference = DEFAULT_GAME_AUDIO_REFERENCE;
  const manifest = JSON.parse(await readFile(new URL(`../assets/audio/runtime/${reference.packId}/${reference.version}/manifest.json`, import.meta.url)));
  const profile = manifest.pack.profiles.find(p => p.id === reference.profileId);
  const expected = [
    [{ cue: 'move' }, 'On my way.'], [{ cue: 'patrol' }, "I'll keep watch."],
    [{ cue: 'follow' }, 'Right behind you.'], [{ cue: 'stop' }, 'Stopping here.'],
    [{ cue: 'hold' }, "I'll stay here."], [{ cue: 'attack' }, "I'll fight."],
    [{ cue: 'gather', resource: 'food' }, "I'll gather food."],
    [{ cue: 'gather', resource: 'food', gatherJob: 'farm' }, "I'll tend the crops."],
    [{ cue: 'gather', resource: 'food', gatherJob: 'sheep-carcass' }, "I'll collect the meat."],
    [{ cue: 'gather', resource: 'food', gatherJob: 'fish' }, "I'll catch fish."],
    [{ cue: 'gather', resource: 'stone' }, "I'll quarry stone."],
    [{ cue: 'build' }, "I'll build it."], [{ cue: 'repair' }, "I'll mend it."],
    [{ cue: 'ready' }, 'Ready to work.'],
  ];
  const keys = new Set();
  for (const [event, caption] of expected) {
    const choice = resolveEventBinding(profile, { ...event, kind: 'worker' });
    assert.ok(choice); keys.add(choice.key);
    assert.equal(choice.binding.bus, 'voice'); assert.equal(choice.binding.priority, 1);
    assert.equal(choice.binding.variants.length, 2);
    assert.ok(choice.binding.variants.every(v => v.caption === caption && manifest.downloads[v.sourceId]));
  }
  assert.equal(keys.size, expected.length, 'different work contexts must not collapse onto generic food or movement');
  const catalog = JSON.parse(await readFile(new URL('../assets/audio/frontier-worker-actions-v1/catalog.json', import.meta.url)));
  assert.equal(catalog.recordings.length, 56);
  for (const item of catalog.recordings) {
    const pathname = `assets/audio/frontier-worker-actions-v1/sources/${item.fileName}`;
    const bytes = await readFile(new URL(`../${pathname}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), item.sha256);
    assert.equal(isClientStaticAsset(pathname), item.runtime);
    if (item.runtime) assert.equal(manifest.downloads[item.id].sha256, item.sha256);
    else assert.equal(manifest.downloads[item.id], undefined);
  }
  for (const file of ['catalog.json', 'production-plan.json', 'build-manifest.mjs', 'sources/worker-move-5.mp3']) {
    assert.equal(isClientStaticAsset(`assets/audio/frontier-worker-actions-v1/${file}`), false);
  }
});

test('the default covers every registered unit and building with role-specific recordings', async () => {
  const reference = DEFAULT_GAME_AUDIO_REFERENCE;
  const manifest = JSON.parse(await readFile(new URL(`../assets/audio/runtime/${reference.packId}/${reference.version}/manifest.json`, import.meta.url)));
  const profile = manifest.pack.profiles.find(p => p.id === reference.profileId);
  assert.equal(manifest.pack.sources.length, 119);
  const roleVoices = new Set();
  for (const unit of Object.values(UNIT_DEFINITIONS)) {
    const actions = ['select', 'move', 'stop', 'hold', 'ready'];
    if (unit.movementDomain !== 'water') actions.push('patrol', 'follow', 'attack');
    if (unit.capabilities.includes('gather')) actions.push('return-cargo');
    for (const cue of actions) {
      const choice = resolveEventBinding(profile, { kind: unit.id, cue });
      assert.equal(choice?.key, `unit.${unit.id}.${cue}`);
      assert.equal(choice.binding.bus, 'voice');
      assert.equal(choice.binding.priority, cue === 'select' ? 0 : 1);
      for (const variant of choice.binding.variants) {
        const source = manifest.pack.sources.find(s => s.id === variant.sourceId);
        assert.ok(manifest.downloads[source.id]);
        assert.equal(source.provenance.prompt, variant.caption);
        assert.match(source.provenance.attribution, /^Voice /);
        if (cue === 'select') roleVoices.add(source.provenance.attribution);
      }
    }
  }
  assert.equal(roleVoices.size, Object.keys(UNIT_DEFINITIONS).length, 'every current role has a distinct performer');
  const fish = resolveEventBinding(profile, { kind: 'skiff', cue: 'gather', resource: 'food' });
  assert.equal(fish?.key, 'unit.skiff.gather.food');
  assert.equal(fish.binding.variants[0].caption, "I'll bring in fish.");
  for (const cue of ['attack', 'patrol', 'follow', 'build', 'repair']) {
    assert.equal(resolveEventBinding(profile, { kind: 'skiff', cue }), null, 'unsupported water orders must not pretend to have recordings');
  }
  const buildingSources = new Set();
  for (const type of Object.keys(BUILDING_DEFINITIONS)) {
    const choice = resolveEventBinding(profile, { buildingType: type, cue: 'select' });
    assert.equal(choice?.key, `building.${type}.select`);
    assert.equal(choice.binding.bus, 'effects');
    for (const variant of choice.binding.variants) {
      assert.ok(!buildingSources.has(variant.sourceId), 'buildings have distinct recordings');
      buildingSources.add(variant.sourceId);
      assert.ok(manifest.downloads[variant.sourceId]);
    }
  }
  assert.equal(resolveEventBinding(profile, { buildingType: 'marketplace', cue: 'select' }), null);
  assert.equal(resolveEventBinding(profile, { buildingType: 'castle', cue: 'select' }), null);
});

test('current-roster originals retain their hashes and only selected takes have public admission', async () => {
  const catalog = JSON.parse(await readFile(new URL('../assets/audio/frontier-roster-feedback-v1/catalog.json', import.meta.url)));
  const reference = DEFAULT_GAME_AUDIO_REFERENCE;
  const manifest = JSON.parse(await readFile(new URL(`../assets/audio/runtime/${reference.packId}/${reference.version}/manifest.json`, import.meta.url)));
  assert.equal(new Set(catalog.recordings.map(r => r.eventKey)).size, 67);
  assert.equal(catalog.recordings.filter(r => r.runtime).length, 80);
  for (const item of catalog.recordings) {
    const pathname = `assets/audio/frontier-roster-feedback-v1/sources/${item.fileName}`;
    const bytes = await readFile(new URL(`../${pathname}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), item.sha256);
    assert.equal(isClientStaticAsset(pathname), item.runtime);
    if (item.runtime) {
      assert.equal(manifest.downloads[item.id].sha256, item.sha256);
      assert.equal(item.signalCheck.clippedSamples, 0);
      assert.ok(item.gain > 0 && item.gain <= 2);
    } else assert.equal(manifest.downloads[item.id], undefined);
  }
  for (const file of ['catalog.json', 'production-plan.json', 'build-manifest.mjs', 'sources/infantry-select-5.mp3', 'sources/private.mp3']) {
    assert.equal(isClientStaticAsset(`assets/audio/frontier-roster-feedback-v1/${file}`), false);
  }
});

test('an unassigned map gets character speech and an immediate wood order replaces selection', async t => {
  const f = fixture(t);
  await f.audio.setMapAudio(null);
  assert.equal(f.audio.playEvent({ cue: 'select', kind: 'worker' }), true);
  await settle();
  assert.equal(f.scheduled[0].buffer.id, 1);
  f.clock += 20;
  assert.equal(f.audio.playEvent({ cue: 'gather', kind: 'worker', resource: 'wood' }), true);
  await settle();
  assert.equal(f.scheduled[0].stopped, true);
  assert.equal(f.scheduled[1].buffer.id, 2);
  assert.equal(f.audio.getInspector().activeVoices, 1);
  f.clock += 500;
  assert.equal(f.audio.playEvent({ cue: 'gather', kind: 'worker', resource: 'wood' }), false, 'rapid repeated orders retain the speech limit');
});

test('a late selection decode cannot speak over a newer accepted work order', async t => {
  const f = fixture(t), pending = deferred(); f.deferredDecodes.set(1, pending);
  await f.audio.setMapAudio(null);
  f.audio.playEvent({ cue: 'select', kind: 'worker' }); await settle();
  f.clock += 10; f.audio.playEvent({ cue: 'gather', kind: 'worker', resource: 'wood' }); await settle();
  pending.resolve({ id: 1, duration: 1, length: 100, numberOfChannels: 1 }); await settle();
  assert.deepEqual(f.scheduled.map(item => item.buffer.id), [2]);
});

test('regional generic cues retain exact defaults, exact map overrides win, and source IDs cannot collide', async t => {
  const f = fixture(t);
  const map = loaded({ 'cue.select': binding('default:select', 'effects') }, { select: source(3), 'default:select': source(4) });
  await f.audio.setMapAudio(reference, { loadPack: async () => map });
  f.audio.playEvent({ cue: 'select', kind: 'worker' }); await settle();
  assert.equal(f.scheduled.at(-1).buffer.id, 1);
  map.pack.profiles[0].bindings['unit.worker.select'] = binding('select');
  await f.audio.setMapAudio(reference, { loadPack: async () => map });
  f.audio.playEvent({ cue: 'select', kind: 'worker' }); await settle();
  assert.equal(f.scheduled.at(-1).buffer.id, 3);
});

test('missing regional packs keep defaults', async t => {
  const f = fixture(t);
  await f.audio.setMapAudio(reference, { loadPack: async () => null });
  f.audio.playEvent({ cue: 'select', kind: 'worker' }); await settle();
  assert.equal(f.scheduled.at(-1).buffer.id, 1);
});

test('failed defaults do not block map audio', async t => {
  const g = fixture(t, async () => { throw new Error('Unavailable'); });
  await g.audio.setMapAudio(reference, { loadPack: async () => loaded({ 'unit.worker.select': binding('select') }, { select: source(4) }) });
  g.audio.playEvent({ cue: 'select', kind: 'worker' }); await settle();
  assert.equal(g.scheduled.at(-1).buffer.id, 4);
});

test('mute and map changes cancel default speech without replay on return', async t => {
  const f = fixture(t);
  await f.audio.setMapAudio(null);
  f.audio.playEvent({ cue: 'select', kind: 'worker' }); await settle();
  f.audio.setSettings({ voiceLevel: 0 });
  assert.equal(f.scheduled[0].stopped, true);
  f.audio.setSettings({ voiceLevel: 1 }); await settle();
  assert.equal(f.scheduled.length, 1);
  f.clock += 2000;
  f.audio.playEvent({ cue: 'select', kind: 'worker' }); await settle();
  await f.audio.setMapAudio(null);
  assert.equal(f.scheduled[1].stopped, true);
  assert.equal(f.audio.getInspector().activeVoices, 0);
});

test('a superseded default load cannot overwrite the current map', async t => {
  const pending = deferred(); let calls = 0;
  const f = fixture(t, async () => ++calls === 1 ? pending.promise : defaults());
  const old = f.audio.setMapAudio(null);
  await f.audio.setMapAudio(reference, { loadPack: async () => loaded({ 'unit.worker.select': binding('select') }, { select: source(5) }) });
  pending.resolve(defaults()); await old;
  f.audio.playEvent({ cue: 'select', kind: 'worker' }); await settle();
  assert.equal(f.scheduled.at(-1).buffer.id, 5);
});

test('disposing while default content loads leaves no playable profile', async t => {
  const pending = deferred();
  const f = fixture(t, () => pending.promise);
  const loading = f.audio.setMapAudio(null);
  f.audio.dispose(); pending.resolve(defaults()); await loading;
  assert.equal(f.audio.getInspector().profileId, null);
  assert.equal(f.audio.playEvent({ cue: 'select', kind: 'worker' }), false);
});
