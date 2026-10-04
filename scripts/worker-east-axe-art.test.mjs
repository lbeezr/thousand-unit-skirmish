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
const preservation = JSON.parse(readFileSync(new URL('wood-east-preservation.json', evidence)));
const registration = JSON.parse(readFileSync(new URL('wood-east-registration.json', evidence)));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

test('East axe keys preserve all preceding art and use three distinct whole same-heading poses', () => {
  const image = decodeRgba8(readFileSync(new URL('cast-atlas-runtime.png', directory)));
  assert.deepEqual([image.width, image.height], [5120, 4096]);
  assert.equal(hash(JSON.stringify(asset.frames.slice(0, preservation.originalFrames))), preservation.originalFrameMetadataSha256);
  const originalClips = structuredClone(asset.clips.slice(0, preservation.originalClips));
  const hammer = JSON.parse(readFileSync(new URL('hammer-east-preservation.json', evidence)));
  for (const clip of [...preservation.originalReplacedClips, ...hammer.originalReplacedClips, ...JSON.parse(readFileSync(new URL('stone-defeat-east-preservation.json', evidence))).originalReplacedClips, ...JSON.parse(readFileSync(new URL('north-actions-preservation.json', evidence))).originalReplacedClips, ...JSON.parse(readFileSync(new URL('north-east-actions-preservation.json', evidence))).originalReplacedClips, ...JSON.parse(readFileSync(new URL('../docs/qa-evidence/worker-land-art-2026-10-04/south-actions-preservation.json', import.meta.url))).originalReplacedClips, ...JSON.parse(readFileSync(new URL('../docs/qa-evidence/worker-land-art-2026-10-04/south-west-actions-preservation.json', import.meta.url))).originalReplacedClips]) {
    const index = originalClips.findIndex(c => c.stateId === clip.stateId && c.directionId === clip.directionId);
    originalClips[index] = clip;
  }
  assert.equal(hash(JSON.stringify(originalClips)), preservation.originalClipMetadataSha256);
  assert.equal(hash(readFileSync(new URL('hammer-era-team-mask.png', evidence))), preservation.originalTeamMaskSha256);
  const oldPixels = createHash('sha256');
  for (const frame of asset.frames.slice(0, preservation.originalFrames)) {
    const r = frame.fallbackRectPx.rectPx;
    for (let y = 0; y < r.height; y++) oldPixels.update(image.pixels.subarray(
      ((r.y + y) * image.width + r.x) * 4, ((r.y + y) * image.width + r.x + r.width) * 4));
  }
  assert.equal(oldPixels.digest('hex'), preservation.originalFrameRgbaSha256);
  const wood = spriteActionClip(clips, 'gather', 'east', 'wood', 'human', true);
  const attack = spriteActionClip(clips, 'attack', 'east', null, 'human', true);
  assert.equal(wood.stateId, 'gather-wood');
  assert.equal(wood.directionId, 'east');
  assert.equal(attack.directionId, 'east');
  assert.equal(wood.loop, true); assert.equal(attack.loop, false);
  assert.equal(spriteClipDuration(wood), 720); assert.equal(spriteClipDuration(attack), 840);
  assert.equal(registration.sharedScale, 232 / 307);
  const hashes = new Set();
  for (const [i, key] of wood.sequence.entries()) {
    assert.deepEqual(key, { frameId: `gather-wood-east-${i}`, durationMs: 240 });
    assert.deepEqual(attack.sequence[i], { frameId: key.frameId, durationMs: 280 });
    const frame = asset.frames.find(f => f.id === key.frameId);
    assert.deepEqual(frame.canvasPx, { width: 256, height: 320 });
    assert.deepEqual(frame.groundPivotPx, { x: 128, y: 308 });
    assertFrameUnclipped(image, frame);
    const r = frame.fallbackRectPx.rectPx, pixels = createHash('sha256');
    for (let y = 0; y < r.height; y++) pixels.update(image.pixels.subarray(
      ((r.y + y) * image.width + r.x) * 4, ((r.y + y) * image.width + r.x + r.width) * 4));
    const digest = pixels.digest('hex');
    assert.equal(digest, registration.frames[i].rgbaSha256); hashes.add(digest);
  }
  assert.equal(hashes.size, 3);
  assert.equal(asset.heightWorld / Math.max(...asset.frames.map(f => f.alphaBoundsPx.height)), preservation.worldUnitsPerPixel);
  assert.equal(spriteActionClip(clips, 'gather', 'east', 'food', 'human', true).sequence[0].frameId, 'gather-food-east-0');
  for (const heading of ['west']) {
    assert.equal(spriteActionClip(clips, 'gather', heading, 'wood', 'human', true).sequence[0].frameId, `idle-${heading}-0`);
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

test('default East wood follows positive activity, loops, turns, Stops/resumes and returns cargo on both seats', async () => {
  const { expect } = await playbackHarness();
  for (const team of [0, 1]) for (const selected of [false, true]) {
    const unit = worker(team, selected);
    expect(unit, 900, 'idle-east-0');
    unit.performingAction = 'gather-wood';
    for (let i = 0; i <= 3; i++) expect(unit, 1000 + i * 240, `gather-wood-east-${i % 3}`);
    unit.angle = Math.PI / 4;
    expect(unit, 1740, 'gather-wood-north-east-0');
    assert.equal(unit.spriteClockStartedAt, 1000);
    unit.angle = Math.PI / 2;
    expect(unit, 1750, 'gather-wood-east-0');
    unit.performingAction = null; expect(unit, 1800, 'idle-east-0');
    unit.performingAction = 'gather-wood'; expect(unit, 1900, 'gather-wood-east-0');
    expect(unit, 2140, 'gather-wood-east-1');
    unit.walking = true; unit.performingAction = null; unit.task = 'returning'; unit.cargo = 10; unit.cargoType = 'wood';
    expect(unit, 2200, 'walk-east-0'); expect(unit, 2600, 'walk-east-4');
    unit.walking = false; expect(unit, 2700, 'idle-east-0');
    unit.cargo = 0; unit.cargoType = null; unit.task = 'idle'; expect(unit, 2800, 'idle-east-0');
  }
});

test('default East attack starts, advances, clamps, exits/resumes work and restarts for a fresh event', async () => {
  const { runtime, expect } = await playbackHarness();
  assert.equal(runtime.durationMs('human', 'attack'), 840);
  for (const team of [0, 1]) for (const selected of [false, true]) {
    const unit = { ...worker(team, selected), attackStartedAt: 1000 };
    expect(unit, 1000, 'gather-wood-east-0'); expect(unit, 1280, 'gather-wood-east-1');
    expect(unit, 1560, 'gather-wood-east-2'); expect(unit, 1839, 'gather-wood-east-2');
    expect(unit, 1840, 'idle-east-0');
    unit.performingAction = 'gather-wood'; unit.attackStartedAt = 2000;
    expect(unit, 2000, 'gather-wood-east-0'); expect(unit, 2560, 'gather-wood-east-2');
    expect(unit, 2840, 'gather-wood-east-0'); expect(unit, 3080, 'gather-wood-east-1');
    unit.attackStartedAt = 3200; expect(unit, 3200, 'gather-wood-east-0');
    unit.walking = true; unit.task = 'moving'; unit.performingAction = null;
    expect(unit, 3300, 'walk-east-0');
  }
});
