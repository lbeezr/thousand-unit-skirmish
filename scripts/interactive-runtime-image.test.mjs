import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash, webcrypto } from 'node:crypto';
import * as THREE from 'three';
import * as runtimeImage from '../src/presentation/assets/interactive-runtime-image.mjs';

const { fetchVerifiedRuntimeImage } = runtimeImage;
const path = 'berries-worked.webp';
const assetRoot = './assets/environment/frontier-interactive-v1/';
const bytes = Uint8Array.of(1, 2, 3, 4).buffer;
const sha256 = createHash('sha256').update(new Uint8Array(bytes)).digest('hex');
const entry = { role: 'runtime-image', dimensionsPx: { width: 640, height: 480 }, sha256 };

async function withHost(options, verify) {
  const previousFetch = globalThis.fetch;
  const previousCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  const events = [], requests = [];
  const texture = new THREE.Texture(options.image ?? { naturalWidth: 640, naturalHeight: 480 });
  let disposals = 0;
  texture.dispose = () => { disposals++; events.push('dispose'); if (options.disposeError) throw options.disposeError; };
  const textureLoader = {
    load(url, resolve, progress, reject) {
      events.push('load'); requests.push({ url, progress });
      if (options.loaderThrow) throw options.loaderThrow;
      if (options.loaderError) reject(options.loaderError);
      else resolve(texture);
    },
  };
  globalThis.fetch = async (url, requestOptions) => {
    events.push('fetch'); requests.push({ url, options: requestOptions });
    if (options.fetchError) throw options.fetchError;
    return { ok: options.ok ?? true, status: options.status ?? 200,
      async arrayBuffer() { events.push('read'); if (options.readError) throw options.readError; return bytes; } };
  };
  Object.defineProperty(globalThis, 'crypto', { configurable: true,
    value: Object.hasOwn(options, 'crypto') ? options.crypto : webcrypto });
  try {
    await verify({ run: (...candidates) => fetchVerifiedRuntimeImage(path, candidates.length ? candidates[0] : entry,
      { assetRoot, textureLoader, THREE }),
      texture, events, requests, disposals: () => disposals });
  } finally {
    globalThis.fetch = previousFetch;
    if (previousCrypto) Object.defineProperty(globalThis, 'crypto', previousCrypto);
    else delete globalThis.crypto;
  }
}

test('the verified image leaf exports only its explicit loading contract', () => {
  assert.deepEqual(Object.keys(runtimeImage), ['fetchVerifiedRuntimeImage']);
});

test('verified bytes precede decoding and retain exact root, cache, object and sampling', async () => {
  await withHost({}, async ({ run, texture, events, requests, disposals }) => {
    const result = await run({ ...entry, sha256: sha256.toUpperCase() });
    assert.deepEqual(events, ['fetch', 'read', 'load']);
    assert.deepEqual(requests, [{ url: assetRoot + path, options: { cache: 'force-cache' } },
      { url: assetRoot + path, progress: undefined }]);
    assert.equal(result.texture, texture);
    assert.deepEqual(result.dimensions, { width: 640, height: 480 });
    assert.equal(result.sha256, sha256);
    assert.equal(texture.colorSpace, THREE.SRGBColorSpace);
    assert.equal(texture.minFilter, THREE.LinearMipmapLinearFilter);
    assert.equal(texture.magFilter, THREE.LinearFilter);
    assert.equal(texture.generateMipmaps, true);
    assert.equal(disposals(), 0);
  });
});

test('invalid runtime declarations fail before fetching or allocating a texture', async () => {
  for (const invalid of [undefined, null, { ...entry, role: 'source-image' },
    { ...entry, dimensionsPx: undefined }, { ...entry, dimensionsPx: { width: 0, height: 480 } },
    { ...entry, dimensionsPx: { width: 640, height: -1 } },
    { ...entry, dimensionsPx: { width: 640.5, height: 480 } },
    { ...entry, dimensionsPx: { width: 640, height: Number.NaN } },
    { ...entry, sha256: 'a'.repeat(63) }, { ...entry, sha256: 'g'.repeat(64) }]) {
    await withHost({}, async ({ run, events, disposals }) => {
      await assert.rejects(run(invalid), { message: `Interactive environment manifest has an invalid runtime entry for ${path}` });
      assert.deepEqual(events, []);
      assert.equal(disposals(), 0);
    });
  }
});

test('HTTP failure keeps its exact reason and does not read or decode the response', async () => {
  await withHost({ ok: false, status: 503 }, async ({ run, events, disposals }) => {
    await assert.rejects(run(), { message: `${path} returned HTTP 503` });
    assert.deepEqual(events, ['fetch']);
    assert.equal(disposals(), 0);
  });
});

for (const fault of ['fetchError', 'readError']) {
  test(`${fault} preserves the original failure and never starts decoding`, async () => {
    const failure = new Error(fault);
    await withHost({ [fault]: failure }, async ({ run, events, disposals }) => {
      await assert.rejects(run(), error => error === failure);
      assert.deepEqual(events, fault === 'fetchError' ? ['fetch'] : ['fetch', 'read']);
      assert.equal(disposals(), 0);
    });
  });
}

for (const crypto of [undefined, {}, { subtle: undefined }]) {
  test(`missing Web Crypto (${JSON.stringify(crypto)}) fails after reading and before decoding`, async () => {
    await withHost({ crypto }, async ({ run, events, disposals }) => {
      await assert.rejects(run(), { message: 'Web Crypto is unavailable for runtime asset verification' });
      assert.deepEqual(events, ['fetch', 'read']);
      assert.equal(disposals(), 0);
    });
  });
}

test('digest rejection retains failure identity without decoding', async () => {
  const failure = new Error('digest failure');
  await withHost({ crypto: { subtle: { async digest(algorithm, input) {
    assert.equal(algorithm, 'SHA-256'); assert.equal(input, bytes); throw failure;
  } } } }, async ({ run, events, disposals }) => {
    await assert.rejects(run(), error => error === failure);
    assert.deepEqual(events, ['fetch', 'read']);
    assert.equal(disposals(), 0);
  });
});

test('mismatched bytes retain the exact SHA rejection and never allocate a decoded texture', async () => {
  await withHost({}, async ({ run, events, disposals }) => {
    await assert.rejects(run({ ...entry, sha256: '0'.repeat(64) }),
      { message: `${path} SHA-256 differs from its manifest entry` });
    assert.deepEqual(events, ['fetch', 'read']);
    assert.equal(disposals(), 0);
  });
});

for (const fault of ['loaderError', 'loaderThrow']) {
  test(`${fault} retains decode failure identity after verified bytes`, async () => {
    const failure = new Error(fault);
    await withHost({ [fault]: failure }, async ({ run, events, disposals }) => {
      await assert.rejects(run(), error => error === failure);
      assert.deepEqual(events, ['fetch', 'read', 'load']);
      assert.equal(disposals(), 0);
    });
  });
}

test('natural dimensions take precedence and zero natural dimensions retain width/height fallback', async () => {
  for (const image of [{ naturalWidth: 640, naturalHeight: 480, width: 1, height: 1 },
    { naturalWidth: 0, naturalHeight: 0, width: 640, height: 480 }, { width: 640, height: 480 }]) {
    await withHost({ image }, async ({ run, disposals }) => {
      assert.deepEqual((await run()).dimensions, { width: 640, height: 480 });
      assert.equal(disposals(), 0);
    });
  }
});

test('decoded dimension mismatch disposes the rejected texture exactly once with the existing reason', async () => {
  for (const image of [{ width: 639, height: 480 }, { width: 640, height: 479 }, {}]) {
    await withHost({ image }, async ({ run, events, disposals }) => {
      await assert.rejects(run(), { message: `${path} decoded as ${image.width || 0}x${image.height || 0}; manifest declares 640x480` });
      assert.deepEqual(events, ['fetch', 'read', 'load', 'dispose']);
      assert.equal(disposals(), 1);
    });
  }
});

test('a dimension-failure disposal exception retains its existing failure identity', async () => {
  const failure = new Error('dispose failure');
  await withHost({ image: {}, disposeError: failure }, async ({ run, disposals }) => {
    await assert.rejects(run(), error => error === failure);
    assert.equal(disposals(), 1);
  });
});
