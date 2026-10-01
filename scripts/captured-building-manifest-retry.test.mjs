import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import * as art from '../src/captured-building-art.mjs';

const tick = () => new Promise(setImmediate);
const bytes = Buffer.from('verified-manifest-retry-test-image');
const manifest = (width = 640, path = 'complete.webp') => ({
  schema: 'thousand-unit-skirmish.building-lifecycle-reference.v1', asset: 'house',
  camera: { azimuthDegrees: [0], framePixels: [width, 640], pixelsPerWorldUnit: 128,
    anchorPixelFromTopLeft: [width / 2, 376] },
  stateOrder: ['complete'], completeState: { views: [{ index: 0, path,
    sha256: createHash('sha256').update(bytes).digest('hex') }] },
});

async function fixture(name, run) {
  const previous = { fetch: globalThis.fetch, Image: globalThis.Image,
    document: globalThis.document, warn: console.warn, now: Date.now };
  const sprites = [], requests = [], warnings = [];
  let now = 1000, handler = () => new Response('missing', { status: 404 });
  let drawn = Promise.withResolvers(), decode = () => Promise.resolve();
  globalThis.fetch = async (url, options) => {
    if (!String(url).endsWith('.json')) return new Response(bytes);
    requests.push({ url: String(url), options });
    return handler(String(url));
  };
  globalThis.Image = class { width = 640; height = 640; decode() { return decode(); } };
  globalThis.document = { createElement: () => ({ getContext: () => ({ drawImage() { drawn.resolve(); } }) }) };
  console.warn = (...args) => warnings.push(args);
  Date.now = () => now;
  const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 10, 10);
  const create = (id = 'a') => {
    const sprite = art.createCapturedBuildingSprite({ manifestUrl: `https://retry-test.invalid/${name}/${id}.json` });
    sprites.push(sprite); return sprite;
  };
  const update = sprite => art.updateCapturedBuildingSprite(sprite, camera, 'complete');
  const show = async sprite => { await drawn.promise; await tick(); assert.equal(sprite.visible, true); };
  try {
    await run({ create, update, show, requests, warnings,
      respond: fn => { handler = fn; }, advance: ms => { now += ms; },
      decodeWith: fn => { decode = fn; },
      nextFrame: () => { drawn = Promise.withResolvers(); },
      invalidate: sprite => art.invalidateCapturedBuildingManifest(sprite.userData.capturedBuildingArt.manifestUrl) });
  } finally {
    for (const sprite of sprites) {
      art.disposeCapturedBuildingSprite(sprite); sprite.material.map?.dispose(); sprite.material.dispose();
    }
    globalThis.fetch = previous.fetch; globalThis.Image = previous.Image;
    globalThis.document = previous.document; console.warn = previous.warn; Date.now = previous.now;
  }
}

test('missing manifests share one failed attempt across sprites and repeated updates', { timeout: 3000 }, async () => {
  await fixture('missing', async f => {
    const sprites = [f.create(), f.create()];
    for (let i = 0; i < 5; i++) { sprites.forEach(f.update); await tick(); f.advance(10000); }
    assert.equal(f.requests.length, 1, '404 must wait for explicit invalidation');
    assert.ok(sprites.every(sprite => !sprite.visible && sprite.material.map === null));
    assert.equal(f.warnings.length, 2, 'each sprite warns once');
    f.respond(() => new Response(JSON.stringify(manifest())));
    f.invalidate(sprites[0]); sprites.forEach(f.update); await f.show(sprites[0]);
    assert.ok(sprites.every(sprite => sprite.visible));
    assert.equal(f.requests.length, 2, 'all consumers share the explicit retry');
    assert.equal(f.requests[1].options.cache, 'reload');
  });
});

test('transient manifest failures retry only after five seconds and eventually recover', { timeout: 3000 }, async t => {
  for (const failure of ['http', 'network', 'schema']) await t.test(failure, async () => {
    await fixture(`transient-${failure}`, async f => {
      f.respond(() => {
        if (failure === 'network') throw new TypeError('offline');
        return failure === 'http' ? new Response('busy', { status: 503 }) : new Response('{}');
      });
      const sprites = [f.create(), f.create()]; sprites.forEach(f.update); await tick();
      for (let i = 0; i < 5; i++) { f.advance(999); sprites.forEach(f.update); await tick(); }
      assert.equal(f.requests.length, 1, 'no retry inside the shared cooldown');
      f.advance(5); sprites.forEach(f.update); await tick();
      assert.equal(f.requests.length, 2, 'one shared retry at the boundary');
      f.respond(() => new Response(JSON.stringify(manifest())));
      f.advance(4999); sprites.forEach(f.update); await tick(); assert.equal(f.requests.length, 2);
      f.advance(1); sprites.forEach(f.update); await f.show(sprites[0]);
      assert.equal(f.requests.length, 3); assert.ok(sprites.every(sprite => sprite.visible));
    });
  });
});

test('distinct manifests remain independent and successful content refreshes only on invalidation', { timeout: 3000 }, async () => {
  await fixture('distinct', async f => {
    const bad = f.create('bad'), good = f.create('good');
    f.respond(url => url.endsWith('/bad.json') ? new Response('missing', { status: 404 }) : new Response(JSON.stringify(manifest())));
    f.update(bad); f.update(good); await f.show(good);
    const original = good.material.map;
    for (let i = 0; i < 5; i++) { f.update(bad); f.update(good); await tick(); }
    assert.equal(f.requests.length, 2); assert.equal(good.material.map, original);
    f.respond(() => new Response(JSON.stringify(manifest(1024, 'changed.webp'))));
    f.nextFrame(); f.invalidate(good); f.update(good); assert.equal(good.visible, false);
    await f.show(good);
    assert.equal(good.scale.x, 8); assert.notEqual(good.material.map, original);
    assert.equal(f.requests.length, 3); assert.equal(bad.visible, false);
    assert.equal(f.requests.filter(r => r.url.endsWith('/bad.json')).length, 1);
  });
});

test('invalidation ignores stale manifest success/failure even before the next update', { timeout: 3000 }, async t => {
  for (const failure of [false, true]) await t.test(failure ? 'late failure' : 'late success', async () => {
    await fixture(`stale-${failure}`, async f => {
      const old = Promise.withResolvers(); f.respond(() => old.promise);
      const sprite = f.create(); f.update(sprite); f.invalidate(sprite);
      old.resolve(failure ? new Response('busy', { status: 503 }) : new Response(JSON.stringify(manifest(1024))));
      await tick();
      assert.equal(sprite.userData.capturedBuildingArt.manifest, null);
      assert.equal(sprite.visible, false); assert.deepEqual(f.warnings, []);
      f.respond(() => new Response(JSON.stringify(manifest()))); f.update(sprite); await f.show(sprite);
      assert.equal(sprite.scale.x, 5); assert.equal(f.requests.length, 2);
      f.advance(5000); f.update(sprite); await tick(); assert.equal(f.requests.length, 2);
    });
  });
});

test('disposed sprites ignore pending manifest success/failure and do not retry', { timeout: 3000 }, async t => {
  for (const failure of [false, true]) await t.test(failure ? 'failure' : 'success', async () => {
    await fixture(`disposed-${failure}`, async f => {
      const pending = Promise.withResolvers(); f.respond(() => pending.promise);
      const sprite = f.create(); f.update(sprite); art.disposeCapturedBuildingSprite(sprite);
      pending.resolve(failure ? new Response('busy', { status: 503 }) : new Response(JSON.stringify(manifest())));
      await tick(); f.advance(10000); f.update(sprite);
      assert.equal(sprite.userData.capturedBuildingArt.manifest, null);
      assert.equal(sprite.visible, false); assert.equal(sprite.material.map, null);
      assert.deepEqual(f.warnings, []); assert.equal(f.requests.length, 1);
    });
  });
});

test('invalidation also prevents a pending old frame from appearing before the next update', { timeout: 3000 }, async () => {
  await fixture('stale-frame', async f => {
    const started = Promise.withResolvers(), finish = Promise.withResolvers();
    f.respond(() => new Response(JSON.stringify(manifest())));
    f.decodeWith(() => { started.resolve(); return finish.promise; });
    const sprite = f.create(); f.update(sprite); await started.promise;
    f.invalidate(sprite); finish.resolve(); await tick();
    assert.equal(sprite.visible, false); assert.equal(sprite.material.map, null);
    f.nextFrame(); f.decodeWith(() => Promise.resolve()); f.update(sprite); await f.show(sprite);
    assert.equal(f.requests.length, 2); assert.deepEqual(f.warnings, []);
  });
});
