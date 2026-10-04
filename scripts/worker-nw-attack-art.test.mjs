import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createUnitSpriteRuntime, spriteActionClip, spriteClipDuration } from '../src/unit-sprite-runtime.mjs';
import { decodeRgba8 } from './sprite-pixel-bounds.mjs';

const directory = new URL('../assets/units/cast-human-sprite-v3/', import.meta.url);
const pack = JSON.parse(readFileSync(new URL('sprite-atlas-pack-v1.json', directory)));
const asset = pack.assets[0], page = pack.pages[0];
const clips = new Map(asset.clips.map(c => [`${c.stateId}|${c.directionId}`, c]));
const receipt = JSON.parse(readFileSync(new URL(
  '../docs/qa-evidence/worker-land-art-2026-10-04/attack-north-west-reuse.json', import.meta.url)));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

test('NW attack faithfully reuses the actual public NW axe pixels with its own one-shot timing', () => {
  const clip = spriteActionClip(clips, 'attack', 'north-west', null, 'human', true);
  assert.equal(clip.directionId, 'north-west');
  assert.equal(clip.loop, false);
  assert.equal(spriteClipDuration(clip), 840);
  assert.deepEqual(clip.sequence, [0, 1, 2].map(i => ({ frameId: `gather-wood-north-west-${i}`, durationMs: 280 })));
  assert.equal(hash(JSON.stringify(asset.frames.slice(0, receipt.originalFrames))), receipt.originalFrameMetadataSha256);
  const originalClips = structuredClone(asset.clips.slice(0, receipt.originalClips));
  const index = originalClips.findIndex(c => c.stateId === 'attack' && c.directionId === 'north-west');
  originalClips[index] = receipt.originalAttackClip;
  const family = JSON.parse(readFileSync(new URL(
    '../docs/qa-evidence/worker-land-art-2026-10-04/north-west-actions-preservation.json', import.meta.url)));
  for (const clip of family.originalReplacedClips) {
    const replaced = originalClips.findIndex(c => c.stateId === clip.stateId && c.directionId === clip.directionId);
    originalClips[replaced] = clip;
  }
  assert.equal(hash(JSON.stringify(originalClips)), receipt.originalClipMetadataSha256);
  const image = decodeRgba8(readFileSync(new URL('cast-atlas-runtime.png', directory)));
  const pixelHash = createHash('sha256');
  for (const frame of asset.frames.slice(0, receipt.originalFrames)) {
    const r = frame.fallbackRectPx.rectPx;
    for (let y = 0; y < r.height; y++) pixelHash.update(image.pixels.subarray(
      ((r.y + y) * image.width + r.x) * 4, ((r.y + y) * image.width + r.x + r.width) * 4));
  }
  assert.equal(pixelHash.digest('hex'), receipt.originalFrameRgbaSha256);
  assert.equal(asset.heightWorld / Math.max(...asset.frames.map(f => f.alphaBoundsPx.height)), receipt.worldUnitsPerPixel);
  assert.deepEqual(asset.clips.filter(c => c.stateId === 'attack' &&
    c.sequence.some(k => !k.frameId.startsWith('idle-'))).map(c => c.directionId), ['north-west', 'south-east']);
});

test('default NW attack starts, advances, clamps and exits on the authored lifetime for either Human seat', async () => {
  const savedFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => pack });
  class TextureLoader {
    load(_url, done) { const texture = new THREE.Texture(); queueMicrotask(() => done(texture)); return texture; }
  }
  const scene = new THREE.Scene();
  let runtime;
  try {
    runtime = createUnitSpriteRuntime({ THREE: { ...THREE, TextureLoader }, scene, capacity: 1,
      teamHex: [0x5aa7d7, 0xe67a5e], cameraQuaternion: new THREE.Quaternion(), roles: ['human'],
      roleSpriteVersions: { human: 'v3' }, teamCivilizations: ['human', 'human'], approximateActionDirections: true });
    runtime.setCount(0, 1); runtime.setCount(1, 1); runtime.setVisible(true);
    assert.equal(await runtime.ready, true);
  } finally { globalThis.fetch = savedFetch; }
  const expect = (unit, now, frameId) => {
    runtime.update(unit, now, 1);
    const r = asset.frames.find(f => f.id === frameId).fallbackRectPx.rectPx;
    const inset = page.sampling.uvInsetPx;
    assert.deepEqual(Array.from(scene.children[unit.team].geometry.attributes.instanceAtlasRect.array),
      Array.from(new Float32Array([(r.x + inset) / page.dimensionsPx.width,
        (r.y + r.height - inset) / page.dimensionsPx.height,
        (r.x + r.width - inset) / page.dimensionsPx.width, (r.y + inset) / page.dimensionsPx.height])), frameId);
  };
  assert.equal(runtime.durationMs('human', 'attack'), 840);
  for (const team of [0, 1]) for (const selected of [false, true]) {
    const unit = { id: team, team, slot: 0, kind: 'worker', hp: 100, selected,
      task: 'idle', walking: false, angle: -Math.PI / 4, renderX: 0, renderZ: 0,
      attackStartedAt: 1000, defeatStartedAt: 0, cargo: 0, cargoType: null, performingAction: null };
    expect(unit, 1000, 'gather-wood-north-west-0');
    expect(unit, 1280, 'gather-wood-north-west-1');
    expect(unit, 1560, 'gather-wood-north-west-2');
    expect(unit, 1839, 'gather-wood-north-west-2');
    expect(unit, 1840, 'idle-north-west-0');
    expect(unit, 2500, 'idle-north-west-0');
    unit.task = 'gathering'; unit.performingAction = 'gather-wood'; unit.attackStartedAt = 3000;
    expect(unit, 3000, 'gather-wood-north-west-0');
    expect(unit, 3280, 'gather-wood-north-west-1');
    expect(unit, 3839, 'gather-wood-north-west-2');
    expect(unit, 3840, 'gather-wood-north-west-0'); // Confirmed work resumes with its own clock.
    expect(unit, 4080, 'gather-wood-north-west-1');
    unit.performingAction = null; unit.task = 'moving'; unit.walking = true;
    expect(unit, 4100, 'walk-north-west-0');
  }
});
