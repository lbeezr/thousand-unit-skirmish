import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash, webcrypto } from 'node:crypto';
import { loadShippedAudio, shippedAudioCacheState } from '../src/audio-shipped-loader.mjs';
import { SHIPPED_AUDIO_REFERENCES } from '../src/audio-shipped-catalog.mjs';
import { validateMapAudioReference } from '../src/audio-event-profile.mjs';
const root = new URL('../', import.meta.url);
const ref = SHIPPED_AUDIO_REFERENCES[0];
const manifestBytes = await readFile(new URL(`assets/audio/runtime/${ref.packId}/${ref.version}/manifest.json`, root));
const manifest = JSON.parse(manifestBytes);
const hash = (data) => createHash('sha256').update(data).digest('hex');
let sequence = 0;
function fixture(mutator = () => {}, responseMutator = (value) => value) {
  const record = structuredClone(manifest); record.pack.id = `test-pack-${++sequence}`;
  mutator(record);
  const bytes = Buffer.from(JSON.stringify(record));
  const reference = { ...ref, packId: record.pack.id, sha256: hash(bytes) };
  let calls = 0;
  const fetch = async (url, options) => {
    calls++;
    assert.equal(options.redirect, 'error');
    const body = url.endsWith('manifest.json') ? bytes : await readFile(new URL(url.slice(1), root));
    const mime = url.endsWith('manifest.json') ? 'application/json' : 'audio/mpeg';
    return responseMutator(new Response(body, { headers: { 'content-type': mime } }), url);
  };
  return { reference, fetch, calls: () => calls,
    retainedBytes: bytes.length + Object.values(record.downloads).reduce((sum, item) => sum + item.bytes, 0) };
}
// Each race gets a fresh module cache without a production reset API.
const freshLoader = (name) => import(new URL(`../src/audio-shipped-loader.mjs?cache-test=${name}`, import.meta.url));
function barrier() {
  let release;
  const promise = new Promise(resolve => { release = resolve; });
  return { promise, release };
}
test('canonical shipped manifest and originals match hashes and load without local import', async () => {
  assert.equal(hash(manifestBytes), ref.sha256);
  const f = fixture();
  const loaded = await loadShippedAudio(f.reference, { fetch: f.fetch, crypto: webcrypto });
  assert.equal(loaded.pack.profiles[0].id, ref.profileId);
  assert.equal(Object.keys(loaded.sourceBlobs).length, 4);
  assert.equal(f.calls(), 5);
  assert.equal(await loadShippedAudio(f.reference, { fetch: f.fetch, crypto: webcrypto }), loaded);
  assert.equal(f.calls(), 5, 'verified cache avoids repeated transfers');
});
test('rejects manifest hash, profile, source size/hash/MIME, redirects and unsafe source paths', async () => {
  const badHash = fixture();
  await assert.rejects(loadShippedAudio({ ...badHash.reference, sha256: '0'.repeat(64) }, { fetch: badHash.fetch, crypto: webcrypto }), /SHA-256/);
  const badProfile = fixture();
  await assert.rejects(loadShippedAudio({ ...badProfile.reference, profileId: 'absent' }, { fetch: badProfile.fetch, crypto: webcrypto }), /profile mismatch/);
  for (const mutate of [
    (m) => m.downloads['horn-note'].bytes++,
    (m) => m.downloads['horn-note'].sha256 = '0'.repeat(64),
    (m) => m.downloads['horn-note'].path = 'https://example.com/audio.mp3',
    (m) => m.downloads['horn-note'].bytes = 17 * 1024 * 1024,
    (m) => m.downloads['horn-note'].mimeType = 'text/html',
  ]) {
    const f = fixture(mutate);
    await assert.rejects(loadShippedAudio(f.reference, { fetch: f.fetch, crypto: webcrypto }), /size|SHA-256|reference/i);
  }
  const mime = fixture(() => {}, () => new Response('oops', { headers: { 'content-type': 'text/html' } }));
  await assert.rejects(loadShippedAudio(mime.reference, { fetch: mime.fetch, crypto: webcrypto }), /MIME/);
});
test('cache remains capped and legacy references stay compatible', async () => {
  for (let i = 0; i < 4; i++) { const f = fixture(); await loadShippedAudio(f.reference, { fetch: f.fetch, crypto: webcrypto }); }
  assert.equal(shippedAudioCacheState().packs, 2);
  assert.ok(shippedAudioCacheState().bytes < 64 * 1024 * 1024);
  assert.deepEqual(validateMapAudioReference({ packId: 'local', profileId: 'field' }), { packId: 'local', profileId: 'field' });
  assert.throws(() => validateMapAudioReference({ ...ref, sha256: undefined }), /version.*hash/);
});

test('stream cleanup failure retains the download failure and leaves cache empty for a retry', async () => {
  const { loadShippedAudio: load, shippedAudioCacheState: state } = await freshLoader('stream-cleanup');
  const cleanupError = new Error('cancel failed');
  let rejectStream = true;
  const failed = fixture(() => {}, response => rejectStream ? new Response(new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(2 * 1024 * 1024 + 1)); },
    cancel() { throw cleanupError; },
  }), { headers: { 'content-type': 'application/json' } }) : response);
  await assert.rejects(load(failed.reference, { fetch: failed.fetch, crypto: webcrypto }), error => {
    assert.ok(error instanceof AggregateError);
    assert.match(error.cause.message, /exceeds size limit/);
    assert.equal(error.errors[1], cleanupError);
    return true;
  });
  assert.equal(failed.calls(), 1, 'rejected metadata prevents all source transfers');
  assert.deepEqual(state(), { packs: 0, bytes: 0 });
  rejectStream = false;
  const loaded = await load(failed.reference, { fetch: failed.fetch, crypto: webcrypto });
  assert.equal(Object.keys(loaded.sourceBlobs).length, 4);
  assert.equal(failed.calls(), 6);
  assert.deepEqual(state(), { packs: 1, bytes: failed.retainedBytes });
});

test('concurrent successful loads charge a retained same-key pack once', async () => {
  const { loadShippedAudio: load, shippedAudioCacheState: state } = await freshLoader('success');
  const f = fixture(), options = { fetch: f.fetch, crypto: webcrypto };
  await Promise.all([load(f.reference, options), load(f.reference, options)]);
  assert.deepEqual(state(), { packs: 1, bytes: f.retainedBytes });
  assert.equal(f.calls(), 10, 'independent transfers retain their existing behavior');
  await load(f.reference, options);
  assert.equal(f.calls(), 10, 'the verified retained entry is reused');
  assert.deepEqual(state(), { packs: 1, bytes: f.retainedBytes });
});

test('concurrent failures charge nothing; successful retries charge once', async () => {
  const { loadShippedAudio: load, shippedAudioCacheState: state } = await freshLoader('retry');
  const f = fixture();
  const badFetch = async (url, options) => {
    const response = await f.fetch(url, options);
    return url.endsWith('manifest.json') ? response : new Response('invalid', { headers: { 'content-type': 'text/html' } });
  };
  const failed = await Promise.allSettled([0, 1].map(() => load(f.reference, { fetch: badFetch, crypto: webcrypto })));
  for (const result of failed) { assert.equal(result.status, 'rejected'); assert.match(result.reason.message, /MIME/); }
  assert.deepEqual(state(), { packs: 0, bytes: 0 }, 'partially fetched packs never enter the cache');
  await Promise.all([0, 1].map(() => load(f.reference, { fetch: f.fetch, crypto: webcrypto })));
  assert.deepEqual(state(), { packs: 1, bytes: f.retainedBytes });
});

test('a late failed peer load leaves the verified entry and retry intact', async () => {
  const { loadShippedAudio: load, shippedAudioCacheState: state } = await freshLoader('late-failure');
  const f = fixture(), gate = barrier();
  const badFetch = async (url, options) => {
    const response = await f.fetch(url, options);
    if (url.endsWith('manifest.json')) return response;
    await gate.promise;
    return new Response('invalid', { headers: { 'content-type': 'text/html' } });
  };
  const good = load(f.reference, { fetch: f.fetch, crypto: webcrypto });
  const failure = assert.rejects(load(f.reference, { fetch: badFetch, crypto: webcrypto }), /MIME/);
  const verified = await good;
  assert.deepEqual(state(), { packs: 1, bytes: f.retainedBytes });
  gate.release(); await failure;
  const calls = f.calls();
  assert.equal(await load(f.reference, { fetch: f.fetch, crypto: webcrypto }), verified);
  assert.equal(f.calls(), calls, 'retry uses the verified peer result');
  assert.deepEqual(state(), { packs: 1, bytes: f.retainedBytes });
});

test('concurrent completion preserves the retained LRU entry and later eviction accounting', async () => {
  const { loadShippedAudio: load, shippedAudioCacheState: state } = await freshLoader('eviction');
  const f = fixture(), first = fixture(), recent = fixture(), gate = barrier();
  const slowFetch = async (url, options) => {
    if (url.endsWith('manifest.json')) await gate.promise;
    return f.fetch(url, options);
  };
  const pending = Promise.all([0, 1].map(() => load(f.reference, { fetch: slowFetch, crypto: webcrypto })));
  await load(first.reference, { fetch: first.fetch, crypto: webcrypto });
  const retained = await load(recent.reference, { fetch: recent.fetch, crypto: webcrypto });
  assert.deepEqual(state(), { packs: 2, bytes: first.retainedBytes + recent.retainedBytes });
  gate.release(); await pending;
  assert.deepEqual(state(), { packs: 2, bytes: recent.retainedBytes + f.retainedBytes },
    'replacing the concurrent result must not evict a second unrelated pack');
  assert.equal(await load(recent.reference, { fetch: recent.fetch, crypto: webcrypto }), retained);
  assert.equal(recent.calls(), 5);
  await load(first.reference, { fetch: first.fetch, crypto: webcrypto });
  assert.equal(first.calls(), 10, 'the original LRU pack was evicted and is fetched again');
  assert.deepEqual(state(), { packs: 2, bytes: recent.retainedBytes + first.retainedBytes }, 'no orphan byte charge remains after eviction');
});
