import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createUnitSpriteRuntime, spriteActionClip, spriteClipDuration } from '../src/unit-sprite-runtime.mjs';
import { assertFrameUnclipped, decodeRgba8 } from './sprite-pixel-bounds.mjs';

const directory = new URL('../assets/units/cast-human-sprite-v3/', import.meta.url);
const pack = JSON.parse(readFileSync(new URL('sprite-atlas-pack-v1.json', directory)));
const asset = pack.assets[0], page = pack.pages[0];
const clips = new Map(asset.clips.map(c => [`${c.stateId}|${c.directionId}`, c]));
const evidence = new URL('../docs/qa-evidence/worker-land-art-2026-10-04/', import.meta.url);
const preservation = JSON.parse(readFileSync(new URL('hammer-east-preservation.json', evidence)));
const registration = JSON.parse(readFileSync(new URL('hammer-east-registration.json', evidence)));

test('East build/repair faithfully share three complete distinct hammer poses at the retained common scale', () => {
  const image = decodeRgba8(readFileSync(new URL('cast-atlas-runtime.png', directory)));
  assert.deepEqual([image.width, image.height], [5632, 4096]);
  assert.equal(registration.sharedScale, 232 / 307);
  const build = spriteActionClip(clips, 'build', 'east', null, 'human', true);
  const repair = spriteActionClip(clips, 'repair', 'east', null, 'human', true);
  for (const [action, clip] of [['build', build], ['repair', repair]]) {
    assert.equal(clip.stateId, action); assert.equal(clip.directionId, 'east');
    assert.equal(clip.loop, true); assert.equal(spriteClipDuration(clip), 720);
  }
  assert.deepEqual(repair.sequence, build.sequence);
  const hashes = new Set();
  for (const [i, key] of build.sequence.entries()) {
    assert.deepEqual(key, { frameId: `build-east-${i}`, durationMs: 240 });
    const frame = asset.frames.find(f => f.id === key.frameId);
    assert.deepEqual(frame.canvasPx, { width: 256, height: 256 });
    assert.deepEqual(frame.groundPivotPx, { x: 128, y: 244 });
    assertFrameUnclipped(image, frame);
    const r = frame.fallbackRectPx.rectPx, hash = createHash('sha256');
    for (let y = 0; y < r.height; y++) hash.update(image.pixels.subarray(
      ((r.y + y) * image.width + r.x) * 4, ((r.y + y) * image.width + r.x + r.width) * 4));
    const digest = hash.digest('hex'); assert.equal(digest, registration.frames[i].rgbaSha256); hashes.add(digest);
    assert.equal(registration.frames[i].sourceIndex, i + 6);
  }
  assert.equal(hashes.size, 3);
  assert.equal(asset.heightWorld / Math.max(...asset.frames.map(f => f.alphaBoundsPx.height)), preservation.worldUnitsPerPixel);
  for (const state of ['build', 'repair']) {
    assert.deepEqual(asset.clips.filter(c => c.stateId === state && c.sequence.some(k => !k.frameId.startsWith('idle-')))
      .map(c => c.directionId).sort(), ['east', 'north', 'north-east', 'north-west', 'south', 'south-east', 'south-west', 'west']);
  }
});

async function playbackHarness() {
  const savedFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => pack });
  class TextureLoader {
    load(_url, done) { const texture = new THREE.Texture(); queueMicrotask(() => done(texture)); return texture; }
  }
  const scene = new THREE.Scene(); let runtime;
  try {
    runtime = createUnitSpriteRuntime({ THREE: { ...THREE, TextureLoader }, scene, capacity: 1,
      teamHex: [0x5aa7d7, 0xe67a5e], cameraQuaternion: new THREE.Quaternion(), roles: ['human'],
      roleSpriteVersions: { human: 'v3' }, teamCivilizations: ['human', 'human'], approximateActionDirections: true });
    runtime.setCount(0, 1); runtime.setCount(1, 1); runtime.setVisible(true);
    assert.equal(await runtime.ready, true);
  } finally { globalThis.fetch = savedFetch; }
  return { runtime, expect(unit, now, frameId) {
    runtime.update(unit, now, 1);
    const r = asset.frames.find(f => f.id === frameId).fallbackRectPx.rectPx, inset = page.sampling.uvInsetPx;
    const mesh = scene.children[unit.team];
    assert.deepEqual(Array.from(mesh.geometry.attributes.instanceAtlasRect.array),
      Array.from(new Float32Array([(r.x + inset) / page.dimensionsPx.width,
        (r.y + r.height - inset) / page.dimensionsPx.height,
        (r.x + r.width - inset) / page.dimensionsPx.width, (r.y + inset) / page.dimensionsPx.height])), frameId);
    const matrix = new THREE.Matrix4(); mesh.getMatrixAt(0, matrix);
    const scale = new THREE.Vector3(); matrix.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);
    assert.ok(Math.abs(scale.x - r.width * preservation.worldUnitsPerPixel) < 1e-6);
    assert.ok(Math.abs(scale.y - r.height * preservation.worldUnitsPerPixel) < 1e-6);
  } };
}

const worker = (team, selected) => ({ id: team, team, slot: 0, kind: 'worker', hp: 100, selected,
  task: 'gathering', walking: false, angle: Math.PI / 2, renderX: 0, renderZ: 0,
  attackStartedAt: 0, defeatStartedAt: 0, cargo: 0, cargoType: null, performingAction: null });

for (const action of ['build', 'repair']) {
 test(`default East ${action} follows productive receipts, loops, Stops/resumes and handles move/attack on both seats`, async () => {
  const { expect } = await playbackHarness();
  for (const team of [0, 1]) for (const selected of [false, true]) {
    const unit = worker(team, selected); unit.task = action === 'build' ? 'building' : 'repairing';
    expect(unit, 900, 'idle-east-0');
    unit.performingAction = action;
    for (let i = 0; i <= 3; i++) expect(unit, 1000 + i * 240, `build-east-${i % 3}`);
    unit.performingAction = null; expect(unit, 1800, 'idle-east-0');
    unit.performingAction = action; expect(unit, 1900, 'build-east-0'); expect(unit, 2140, 'build-east-1');
    unit.walking = true; unit.task = 'moving'; unit.performingAction = null; expect(unit, 2200, 'walk-east-0');
    unit.walking = false; unit.task = action === 'build' ? 'building' : 'repairing'; unit.performingAction = action;
    expect(unit, 2300, 'build-east-0');
    unit.attackStartedAt = 2400; expect(unit, 2400, 'gather-wood-east-0');
    expect(unit, 3239, 'gather-wood-east-2'); expect(unit, 3240, 'build-east-0');
    const other = action === 'build' ? 'repair' : 'build'; unit.task = other === 'build' ? 'building' : 'repairing';
    unit.performingAction = other; expect(unit, 3500, 'build-east-0');
    assert.equal(unit.spriteClockStartedAt, 3500); expect(unit, 3740, 'build-east-1');
  }
 });
}
