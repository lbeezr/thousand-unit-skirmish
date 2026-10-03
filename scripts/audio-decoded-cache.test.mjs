import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDecodedAudioCache } from '../src/audio-decoded-cache.mjs';

const MiB = 1024 * 1024;
const pcm = (bytes, channels = 1) => ({ length: bytes / (4 * channels), numberOfChannels: channels });
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const settle = () => new Promise((resolve) => setImmediate(resolve));
const empty = { decodedBytes: 0, decodedSources: 0, pendingSources: 0, decodeConsumers: 0 };

test('same-source consumers share one decode and release pending references on success', async () => {
  const cache = createDecodedAudioCache(), job = deferred();
  let calls = 0;
  const load = () => { calls++; return job.promise; };
  const consumers = Array.from({ length: 6 }, () => cache.resolve('shared', load));
  assert.deepEqual(cache.getStats(), { ...empty, pendingSources: 1, decodeConsumers: 6 });
  await settle(); assert.equal(calls, 1);
  const buffer = pcm(1024, 2); job.resolve(buffer);
  assert.ok((await Promise.all(consumers)).every((result) => result === buffer));
  assert.deepEqual(cache.getStats(), { ...empty, decodedBytes: 1024, decodedSources: 1 });
  assert.equal(await cache.resolve('shared', () => assert.fail('cached source reloaded')), buffer);
});

test('failure releases every consumer, retains other PCM and allows one shared retry', async () => {
  const cache = createDecodedAudioCache(), job = deferred();
  const kept = pcm(1024); await cache.resolve('kept', () => kept);
  const outcomes = Promise.allSettled([cache.resolve('bad', () => job.promise), cache.resolve('bad', () => assert.fail('duplicate'))]);
  await settle(); job.reject(new Error('Unsupported codec'));
  assert.ok((await outcomes).every((result) => result.status === 'rejected' && /Unsupported codec/.test(result.reason.message)));
  assert.deepEqual(cache.getStats(), { ...empty, decodedBytes: 1024, decodedSources: 1 });
  let retries = 0;
  const retry = () => { retries++; return pcm(2048); };
  const buffers = await Promise.all([cache.resolve('bad', retry), cache.resolve('bad', retry)]);
  assert.equal(retries, 1); assert.equal(buffers[0], buffers[1]);
  assert.deepEqual(cache.getStats(), { ...empty, decodedBytes: 3072, decodedSources: 2 });
});

test('independent source completions keep exact bytes within 24 MiB', async () => {
  const cache = createDecodedAudioCache(), jobs = [deferred(), deferred(), deferred()];
  const consumers = jobs.map((job, index) => cache.resolve(String(index), () => job.promise));
  assert.equal(cache.getStats().pendingSources, 3);
  jobs[2].resolve(pcm(12 * MiB)); await consumers[2];
  jobs[0].resolve(pcm(12 * MiB)); await consumers[0];
  assert.equal(cache.getStats().decodedBytes, 24 * MiB);
  jobs[1].resolve(pcm(12 * MiB)); await consumers[1];
  assert.deepEqual(cache.getStats(), { ...empty, decodedBytes: 24 * MiB, decodedSources: 2 });
  let reloads = 0;
  await cache.resolve('2', () => { reloads++; return pcm(12 * MiB); });
  assert.equal(reloads, 1, 'first completed source is evicted when the next one exceeds the budget');
  assert.equal(cache.getStats().decodedBytes, 24 * MiB);
});

test('cache hits refresh LRU without charging consumers or bytes twice', async () => {
  const cache = createDecodedAudioCache();
  const a = pcm(12 * MiB), b = pcm(12 * MiB), c = pcm(12 * MiB);
  await cache.resolve('a', () => a); await cache.resolve('b', () => b);
  await cache.resolve('a', () => assert.fail('hit reloaded'));
  await cache.resolve('c', () => c);
  assert.equal(await cache.resolve('a', () => assert.fail('recent source evicted')), a);
  assert.equal(await cache.resolve('c', () => assert.fail('new source evicted')), c);
  let calls = 0; await cache.resolve('b', () => { calls++; return b; });
  assert.equal(calls, 1);
  assert.deepEqual(cache.getStats(), { ...empty, decodedBytes: 24 * MiB, decodedSources: 2 });
});

test('exact-budget PCM is retained; oversized or invalid PCM leaves it intact and can retry', async () => {
  const cache = createDecodedAudioCache(), full = pcm(24 * MiB);
  await cache.resolve('full', () => full);
  for (const bad of [pcm(24 * MiB + 4), pcm(-4), { length: NaN, numberOfChannels: 1 },
    { length: Number.MAX_SAFE_INTEGER, numberOfChannels: 2 }]) {
    await assert.rejects(cache.resolve('bad', () => bad), /exceeds memory limit/);
    assert.deepEqual(cache.getStats(), { ...empty, decodedBytes: 24 * MiB, decodedSources: 1 });
    assert.equal(await cache.resolve('full', () => assert.fail('valid entry lost')), full);
  }
  const retry = pcm(4);
  assert.equal(await cache.resolve('bad', () => retry), retry);
  assert.deepEqual(cache.getStats(), { ...empty, decodedBytes: 4, decodedSources: 1 });
});

test('clear before decode begins avoids obsolete source work', async () => {
  const cache = createDecodedAudioCache();
  const outcome = assert.rejects(cache.resolve('old', () => assert.fail('cleared load started')), /pack changed/);
  cache.clear(); await outcome;
  assert.deepEqual(cache.getStats(), empty);
});

for (const failure of [false, true]) {
  test(`clear isolates a new same-ID job from old ${failure ? 'failure' : 'completion'}`, async () => {
    const cache = createDecodedAudioCache(), old = deferred(), current = deferred();
    const obsolete = assert.rejects(cache.resolve('shared', () => old.promise), failure ? /Old codec failure/ : /pack changed/);
    await settle(); cache.clear();
    const fresh = cache.resolve('shared', () => current.promise);
    await settle();
    if (failure) old.reject(new Error('Old codec failure'));
    else old.resolve(pcm(1024));
    await obsolete;
    assert.deepEqual(cache.getStats(), { ...empty, pendingSources: 1, decodeConsumers: 1 });
    const peer = cache.resolve('shared', () => assert.fail('old cleanup removed new pending job'));
    const buffer = pcm(2048); current.resolve(buffer);
    assert.deepEqual(await Promise.all([fresh, peer]), [buffer, buffer]);
    assert.deepEqual(cache.getStats(), { ...empty, decodedBytes: 2048, decodedSources: 1 });
    cache.clear(); assert.deepEqual(cache.getStats(), empty);
  });
}
