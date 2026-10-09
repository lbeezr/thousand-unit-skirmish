import assert from 'node:assert/strict';
import { validateAudioPack } from '../src/audio-assets.mjs';
import { createAudioLibraryStore, exportAudioPack, parseAudioPackArchive } from '../src/client/audio/library-store.mjs';
import * as libraryApi from '../src/audio-library-store.mjs';
import * as canonicalLibraryApi from '../src/client/audio/library-store.mjs';
import { mountAudioLibrary } from '../src/client/audio/library-ui.mjs';
import * as libraryUiApi from '../src/audio-library-ui.mjs';
import * as canonicalLibraryUiApi from '../src/client/audio/library-ui.mjs';
import { verifyAudioLibraryUiConsumers } from './fixtures/audio-library-ui-consumer.mjs';

assert.deepEqual(Object.keys(libraryApi), ['createAudioLibraryStore', 'exportAudioPack', 'parseAudioPackArchive']);
assert.deepEqual(Object.keys(canonicalLibraryApi), Object.keys(libraryApi));
assert.equal(libraryApi.createAudioLibraryStore, createAudioLibraryStore);
assert.equal(libraryApi.exportAudioPack, exportAudioPack);
assert.equal(libraryApi.parseAudioPackArchive, parseAudioPackArchive);
assert.deepEqual(Object.keys(libraryUiApi), ['mountAudioLibrary']);
assert.deepEqual(Object.keys(canonicalLibraryUiApi), Object.keys(libraryUiApi));
assert.equal(libraryUiApi.mountAudioLibrary, mountAudioLibrary);

const pack = {
  schemaVersion: 1, id: 'pack-test', name: 'Fixture',
  sources: [{ id: 'wood', name: 'Worker wood', fileName: 'wood.wav', mimeType: 'audio/wav',
    tags: ['worker', 'wood'], provenance: { provider: 'local synth', prompt: 'wood order', createdAt: '2026-09-27' } }],
  profiles: [{ id: 'profile-test', name: 'Default', bindings: {
    'unit.worker.gather.wood': { variants: [{ sourceId: 'wood', gain: 0.8, caption: 'Gathering wood' }], bus: 'voice', cooldownMs: 500 },
  }, music: {} }],
  compositions: [],
};

const original = new Blob([Uint8Array.from([0, 1, 2, 127, 128, 255, 0, 42])], { type: 'audio/wav' });
const normalized = validateAudioPack(pack);
assert.deepEqual(normalized, pack);
const completionPack = structuredClone(pack);
const completionBinding = { bus: 'effects', variants: [{ sourceId: 'wood' }] };
completionPack.profiles[0].bindings['building.barracks.complete'] = completionBinding;
completionPack.profiles[0].bindings['building.barracks.select'] = completionBinding;
completionPack.profiles[0].civilizationBindings = { frontier: {
  'building.watchtower.complete': completionBinding,
} };
assert.deepEqual(validateAudioPack(completionPack), completionPack, 'common and civilization completion keys are admitted without changing schema version');
const completionArchive = await exportAudioPack(completionPack, { wood: original });
const completionImported = await parseAudioPackArchive(completionArchive);
assert.deepEqual(completionImported.pack, completionPack);
assert.deepEqual(new Uint8Array(await completionImported.sourceBlobs.wood.arrayBuffer()), new Uint8Array(await original.arrayBuffer()),
  'typed completion admission preserves existing source bytes');
for (const key of ['building.barracks.ready', 'building.barracks.building-complete', 'building.barracks.destroy', 'building.barracks.complete.extra']) {
  for (const layer of ['bindings', 'civilizationBindings']) {
    const invalid = structuredClone(completionPack);
    const target = layer === 'bindings' ? invalid.profiles[0].bindings : invalid.profiles[0].civilizationBindings.frontier;
    target[key] = completionBinding;
    assert.throws(() => validateAudioPack(invalid), /invalid event key/, `${layer}: ${key}`);
  }
}
const unknownCompletionSource = structuredClone(completionPack);
unknownCompletionSource.profiles[0].bindings['building.barracks.complete'].variants[0].sourceId = 'missing';
assert.throws(() => validateAudioPack(unknownCompletionSource), /unknown source missing/);
const archive = await exportAudioPack(pack, { wood: original });
const imported = await parseAudioPackArchive(archive);
assert.deepEqual(imported.pack, pack);
assert.deepEqual(new Uint8Array(await imported.sourceBlobs.wood.arrayBuffer()), new Uint8Array(await original.arrayBuffer()));
assert.equal(imported.pack.sources[0].provenance.prompt, 'wood order');

assert.throws(() => validateAudioPack({ ...pack, schemaVersion: 2 }), /unsupported version/);
assert.throws(() => validateAudioPack({ ...pack, sources: [...pack.sources, pack.sources[0]] }), /duplicate ID/);
assert.throws(() => validateAudioPack({ ...pack, profiles: [{ ...pack.profiles[0], bindings: {
  'unit.worker.gather.wood': { variants: [{ sourceId: 'missing' }], bus: 'voice' },
} }] }), /unknown source missing/);
assert.throws(() => validateAudioPack({ ...pack, sources: [{ ...pack.sources[0], provenance: { apiKey: 'secret' } }] }), /unsupported field/);
assert.throws(() => validateAudioPack({ ...pack, compositions: [{
  schemaVersion: 1, id: 'music', name: 'Music', bpm: Infinity, beatsPerBar: 4, lengthBars: 8, tracks: [],
}] }), /bpm/);
const withComposition = validateAudioPack({ ...pack, compositions: [{
  schemaVersion: 1, id: 'music', name: 'Music', tracks: [{ id: 'track', name: 'Track', clips: [
    { id: 'clip', sourceId: 'wood' },
  ] }],
}] });
assert.equal(withComposition.compositions[0].tracks[0].clips[0].durationBeats, 4);
assert.equal(withComposition.compositions[0].tracks[0].gain, 1);
assert.throws(() => validateAudioPack({ ...pack, compositions: [{ ...withComposition.compositions[0],
  tracks: [{ ...withComposition.compositions[0].tracks[0], clips: [{ id: 'track', sourceId: 'wood' }] }],
}] }), /[Dd]uplicate.*ID/);
await assert.rejects(exportAudioPack(pack, {}), /no original bytes/);
await assert.rejects(exportAudioPack(pack, { wood: new Blob([new Uint8Array(16 * 1024 * 1024 + 1)]) }), /16 MiB source limit/);
await assert.rejects(parseAudioPackArchive(new Blob(['private-token=secret'])), error => {
  assert.match(error.message, /not valid JSON/);
  assert.ok(error.cause instanceof SyntaxError);
  assert.doesNotMatch(error.message + JSON.stringify(error), /private|secret/);
  return true;
});

{
  const readFailure = new DOMException('private file detail: token=secret', 'NotReadableError');
  const file = new Blob(['fixture']); let reads = 0;
  file.text = async () => { if (++reads === 1) throw readFailure; return archive.text(); };
  const store = createAudioLibraryStore({indexedDB: {open() { assert.fail('unreadable archive must not open storage'); }}});
  await assert.rejects(store.importPack(file), error => {
    assert.equal(error.cause, readFailure);
    assert.match(error.message, /could not be read.*retry/);
    assert.doesNotMatch(error.message, /JSON/);
    assert.doesNotMatch(error.message + JSON.stringify(error), /private|secret/);
    return true;
  });
  const retry = await parseAudioPackArchive(file);
  assert.equal(reads, 2);
  assert.deepEqual(retry.pack, pack);
  assert.deepEqual(new Uint8Array(await retry.sourceBlobs.wood.arrayBuffer()), new Uint8Array(await original.arrayBuffer()));
}

{
  const fault = new TypeError('archive reader returned an unexpected value');
  const file = new Blob(['fixture']);
  file.text = async () => ({toString() { throw fault; }});
  await assert.rejects(parseAudioPackArchive(file), error => error === fault,
    'parser programmer faults must not become invalid author JSON');
}
const broken = JSON.parse(await archive.text());
broken.sources.wood.byteLength++;
await assert.rejects(parseAudioPackArchive(new Blob([JSON.stringify(broken)])), /declared byte length/);
await assert.rejects(parseAudioPackArchive(new Blob([new Uint8Array(90 * 1024 * 1024 + 1)])), /90 MiB import limit/);
console.log('Audio library validation and byte-preserving archive checks passed');

const invalidComposition = structuredClone(withComposition);
invalidComposition.compositions[0].tracks[0].clips[0].startBeat = 28;
invalidComposition.compositions[0].tracks[0].clips[0].durationBeats = 4 + 1e-7;
assert.throws(() => validateAudioPack(invalidComposition), /extends past/,
  'storage uses the same timeline boundary as playback');

// Deferred IndexedDB events exercise the real store without browser storage or timers.
function emptyDatabase() {
  return {
    closes: 0,
    close() { this.closes++; },
    transaction(name, mode) {
      assert.equal(name, 'packs'); assert.equal(mode, 'readonly');
      const transaction = {};
      transaction.objectStore = () => ({getAll() {
        const request = {result: []};
        queueMicrotask(() => { request.onsuccess(); transaction.oncomplete(); });
        return request;
      }});
      return transaction;
    },
  };
}

for (const failure of ['blocked', 'error', 'programmer-fault']) {
  const requests = [];
  const original = failure === 'programmer-fault'
    ? new TypeError('test adapter fault') : new DOMException('private storage detail: token=secret', 'UnknownError');
  let opens = 0;
  const store = createAudioLibraryStore({indexedDB: {open(name, version) {
    assert.equal(name, 'tus-audio-library-v1'); assert.equal(version, 1);
    if (++opens === 1 && failure === 'programmer-fault') throw original;
    const request = {}; requests.push(request); return request;
  }}});
  const failed = assert.rejects(store.listPacks(), error => {
    if (failure === 'programmer-fault') assert.equal(error, original);
    else {
      assert.match(error.message, /retry/);
      assert.doesNotMatch(error.message + JSON.stringify(error), /private|secret/);
      if (failure === 'error') assert.equal(error.cause, original);
    }
    return true;
  });
  if (failure === 'blocked') requests[0].onblocked();
  if (failure === 'error') { requests[0].error = original; requests[0].onerror(); }
  await failed;
  const retry = Promise.all([store.listPacks(), store.listPacks()]);
  retry.catch(() => {}); // Observe failures even if the regression assertion below fails.
  assert.equal(opens, 2, 'a failed open must release the cache; concurrent retries share one fresh open');
  const database = emptyDatabase();
  const request = requests.at(-1); request.result = database; request.onsuccess();
  assert.deepEqual(await retry, [[], []]);
  assert.deepEqual(await store.listPacks(), []);
  assert.equal(opens, 2, 'successful connections remain cached');
  assert.equal(database.closes, 0, 'keep the current connection available');
}

{
  const requests = [];
  const store = createAudioLibraryStore({indexedDB: {open() { const request = {}; requests.push(request); return request; }}});
  const failed = assert.rejects(store.listPacks(), /Close it and retry/);
  requests[0].onblocked(); await failed;
  const retry = store.listPacks(); retry.catch(() => {});
  assert.equal(requests.length, 2);
  const abandoned = emptyDatabase(), current = emptyDatabase();
  requests[0].result = abandoned; requests[0].onsuccess();
  assert.equal(abandoned.closes, 1, 'a blocked request can later succeed and must close its unused connection');
  requests[1].result = current; requests[1].onsuccess();
  assert.deepEqual(await retry, []);
  assert.deepEqual(await store.listPacks(), []);
  assert.equal(current.closes, 0, 'late completion must not replace or close the retry connection');
  assert.equal(requests.length, 2);
}
console.log('Audio library database-open failure, shared retry and abandoned-connection cleanup checks passed');

const consumerCases = await verifyAudioLibraryUiConsumers(mountAudioLibrary);
console.log(`Audio library DOM/store consumer controls passed: ${consumerCases.length} cases (no browser CRUD/listening/rendered claim).`);
