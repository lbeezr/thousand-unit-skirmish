import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import test from 'node:test';
import * as THREE from 'three';
import { createStaticSheepRuntime, staticSheepFrame, sheepQuadPlacement } from '../src/sheep-static-preview.mjs';
import { decodeRgba8, measureFrameAlpha } from './sprite-pixel-bounds.mjs';
import { validateSpriteAtlas } from './sprite-atlas-contract.mjs';

const root = new URL('../assets/wildlife/bellweather-sheep-public-reference-v1/', import.meta.url);
const manifestBytes = await readFile(new URL('sprite-atlas-pack-v1.json', root));
const manifest = JSON.parse(manifestBytes);
const binding = JSON.parse(await readFile(new URL('static-preview-binding.json', root)));
const state = { stateId: 'idle', directionId: 'north', moving: false, visible: true };

test('the preserved public input, page hashes and runtime binding match', async () => {
  assert.deepEqual((await validateSpriteAtlas(new URL('sprite-atlas-pack-v1.json', root).pathname)).errors, []);
  assert.equal(createHash('sha256').update(manifestBytes).digest('hex'), binding.manifestSha256);
  const records = JSON.parse(await readFile(new URL('source-records.json', root)));
  for (const record of records.records) {
    const bytes = await readFile(new URL('source/' + record.filename, root));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), record.sha256);
    assert.equal(bytes.length, record.bytes);
  }
  assert.equal(records.records[0].sha256, '0ff688101304a7c10e181b3363ce767e8fb0082d0f754817edee81e04a9bf904');
});

test('only explicitly visible stationary idle with the authored direction resolves', () => {
  assert.ok(staticSheepFrame(manifest, binding, state));
  for (const patch of [
    { visible: false }, { visible: undefined }, { moving: true }, { moving: undefined },
    { stateId: 'walk' }, { stateId: 'graze' }, { stateId: 'dispatch' },
    { stateId: 'carcass' }, { stateId: 'depleted' }, { directionId: 'south' },
  ]) assert.equal(staticSheepFrame(manifest, binding, { ...state, ...patch }), null);
  assert.equal(staticSheepFrame(manifest, { ...binding, animations: ['walk'] }, state), null);
  assert.equal(staticSheepFrame(manifest, { ...binding, previewOnly: false }, state), null);
  assert.equal(staticSheepFrame(manifest, { ...binding, packId: 'other' }, state), null);
  assert.deepEqual(binding.animations, []);
  assert.equal(manifest.assets[0].clips.length, 1);
  assert.equal(manifest.assets[0].clips[0].sequence.length, 1);
  assert.equal(manifest.assets[0].clips[0].loop, false);
  assert.equal(binding.cameraCalibrated, false);
});

test('the provisional matte has transparent margins and RGB bleed preserves alpha', async () => {
  const source = decodeRgba8(await readFile(new URL('sheep-atlas-source.png', root)));
  const runtime = decodeRgba8(await readFile(new URL('sheep-atlas-runtime.png', root)));
  const frame = manifest.assets[0].frames[0];
  assert.deepEqual(measureFrameAlpha(source, frame.fallbackRectPx.rectPx), frame.alphaBoundsPx);
  let opaque = 0, transparent = 0;
  for (let offset = 3; offset < source.pixels.length; offset += 4) {
    assert.equal(source.pixels[offset], runtime.pixels[offset]);
    if (source.pixels[offset] === 0) transparent++;
    if (source.pixels[offset] === 255) opaque++;
  }
  assert.ok(opaque > 80000 && transparent > 80000);
  const box = frame.alphaBoundsPx;
  assert.ok(box.x >= 2 && box.y >= 2 && box.x + box.width <= 510 && box.y + box.height <= 510);
});

test('ground-root and common scale do not follow changing alpha bounds', () => {
  const frame = manifest.assets[0].frames[0];
  const placed = sheepQuadPlacement(frame, 512);
  assert.equal(placed.width, 1);
  assert.equal(placed.height, 1);
  const changed = { ...frame, alphaBoundsPx: { x: 200, y: 200, width: 2, height: 2 } };
  assert.deepEqual(sheepQuadPlacement(changed, 512), placed);
  // Quad origin + canvas-local pivot exactly reproduces the specified ground root.
  assert.ok(Math.abs(placed.centerX + (frame.groundPivotPx.x - 256) / 512) < 1e-12);
  assert.ok(Math.abs(placed.centerY + (256 - frame.groundPivotPx.y) / 512) < 1e-12);
  assert.throws(() => sheepQuadPlacement(frame, 0), /explicit projected world scale/);
});

test('the renderer verifies requested bytes, hides invalid states and disposes its mesh', async () => {
  const originalFetch = globalThis.fetch, OriginalImage = globalThis.Image;
  const urls = [];
  let corrupt = false;
  globalThis.fetch = async input => {
    const url = new URL(input);
    if (url.protocol === 'blob:') return originalFetch(url);
    urls.push(url.pathname);
    const bytes = await readFile(new URL(url.pathname.split('/').at(-1), root));
    return new Response(corrupt && url.pathname.endsWith('sheep-atlas-runtime.png') ? Buffer.concat([bytes, Buffer.from('x')]) : bytes);
  };
  globalThis.Image = class {
    async decode() {
      const image = decodeRgba8(Buffer.from(await (await globalThis.fetch(this.src)).arrayBuffer()));
      this.width = image.width; this.height = image.height;
    }
  };
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-2, 2, 2, -2, .1, 100);
  camera.position.set(.78, 1.12, .78).normalize().multiplyScalar(10);
  camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  try {
    const runtime = await createStaticSheepRuntime({ THREE, scene, bindingUrl: 'http://localhost/sheep/static-preview-binding.json' });
    const pose = { ...state, x: -.75, groundY: 0, z: 0 };
    assert.equal(runtime.update(pose, camera), true);
    assert.equal(runtime.mesh.visible, true);
    for (const patch of [{ moving: true }, { stateId: 'carcass' }, { visible: false }, { directionId: 'east' }, { groundY: NaN }]) {
      assert.equal(runtime.update({ ...pose, ...patch }, camera), false);
      assert.equal(runtime.mesh.visible, false);
    }
    runtime.dispose();
    assert.equal(runtime.update(pose, camera), false);
    assert.equal(scene.children.length, 0);
    assert.deepEqual(urls, ['/sheep/static-preview-binding.json', '/sheep/sprite-atlas-pack-v1.json', '/sheep/sheep-atlas-runtime.png']);
    corrupt = true;
    await assert.rejects(createStaticSheepRuntime({ THREE, scene, bindingUrl: 'http://localhost/sheep/static-preview-binding.json' }), /SHA-256 mismatch/);
    assert.equal(scene.children.length, 0, 'corrupt texture must not create a scene mesh');
  } finally {
    globalThis.fetch = originalFetch; globalThis.Image = OriginalImage;
  }
});
