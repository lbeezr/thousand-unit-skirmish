import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { activeState, createUnitSpriteRuntime, spriteActionClip, spriteClipDuration } from '../src/unit-sprite-runtime.mjs';
import { assertFrameUnclipped, decodeRgba8 } from './sprite-pixel-bounds.mjs';

const directory = new URL('../assets/units/cast-human-sprite-v3/', import.meta.url);
const pack = JSON.parse(readFileSync(new URL('sprite-atlas-pack-v1.json', directory)));
const asset = pack.assets[0], page = pack.pages[0];
const clips = new Map(asset.clips.map(c => [`${c.stateId}|${c.directionId}`, c]));
const registration = JSON.parse(readFileSync(new URL(
  '../docs/qa-evidence/worker-land-art-2026-10-04/stone-defeat-east-registration.json', import.meta.url)));
const preservation = JSON.parse(readFileSync(new URL(
  '../docs/qa-evidence/worker-land-art-2026-10-04/stone-defeat-east-preservation.json', import.meta.url)));

for (const group of registration.groups) {
test(`East ${group.state} has three complete distinct poses at one scale and fixed ground pivot`, () => {
  const image = decodeRgba8(readFileSync(new URL('cast-atlas-runtime.png', directory)));
  assert.deepEqual([image.width, image.height], [3584, 4096]);
  assert.equal(registration.sharedScale, 232 / 427);
  const clip = spriteActionClip(clips, group.state, 'east', 'stone', 'human', false);
  assert.equal(clip.stateId, group.state);
  assert.equal(clip.directionId, 'east');
  assert.equal(clip.loop, group.state !== 'defeat');
  assert.equal(spriteClipDuration(clip), group.state === 'defeat' ? 840 : 720);
  const hashes = new Set();
  for (const [index, key] of clip.sequence.entries()) {
    assert.deepEqual(key, { frameId: `${group.state}-east-${index}`,
      durationMs: group.state === 'defeat' ? 280 : 240 });
    const frame = asset.frames.find(f => f.id === key.frameId);
    assert.deepEqual(frame.canvasPx, group.canvasPx);
    assert.deepEqual(frame.groundPivotPx, group.groundPivotPx);
    assertFrameUnclipped(image, frame);
    const r = frame.fallbackRectPx.rectPx, hash = createHash('sha256');
    for (let y = 0; y < r.height; y++) hash.update(image.pixels.subarray(
      ((r.y + y) * image.width + r.x) * 4, ((r.y + y) * image.width + r.x + r.width) * 4));
    const digest = hash.digest('hex');
    assert.equal(digest, group.frames[index].rgbaSha256);
    hashes.add(digest);
  }
  assert.equal(hashes.size, 3, 'Different IDs select different articulated pixels');
  assert.equal(asset.heightWorld / Math.max(...asset.frames.map(f => f.alphaBoundsPx.height)), preservation.worldUnitsPerPixel);

});
}

async function playbackHarness() {
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
  return { runtime, expect(unit, now, frameId) {
    runtime.update(unit, now, 1);
    const frame = asset.frames.find(f => f.id === frameId), r = frame.fallbackRectPx.rectPx;
    const inset = page.sampling.uvInsetPx;
    const mesh = scene.children[unit.team];
    assert.deepEqual(Array.from(mesh.geometry.attributes.instanceAtlasRect.array),
      Array.from(new Float32Array([(r.x + inset) / page.dimensionsPx.width,
        (r.y + r.height - inset) / page.dimensionsPx.height,
        (r.x + r.width - inset) / page.dimensionsPx.width, (r.y + inset) / page.dimensionsPx.height])), frameId);
    const matrix = new THREE.Matrix4(); mesh.getMatrixAt(0, matrix);
    const position = new THREE.Vector3(), scale = new THREE.Vector3();
    matrix.decompose(position, new THREE.Quaternion(), scale);
    assert.ok(Math.abs(scale.x - r.width * preservation.worldUnitsPerPixel) < 1e-6);
    assert.ok(Math.abs(scale.y - r.height * preservation.worldUnitsPerPixel) < 1e-6);
    assert.ok(Math.abs(position.x - (r.width / 2 - frame.groundPivotPx.x) * preservation.worldUnitsPerPixel) < 1e-6,
      'The loader honors the asymmetric root instead of centering each pose');
  } };
}

const worker = (team, selected) => ({ id: team, team, slot: 0, kind: 'worker', hp: 100, selected,
  task: 'building', walking: false, angle: Math.PI / 2, renderX: 0, renderZ: 0,
  attackStartedAt: 0, defeatStartedAt: 0, cargo: 0, cargoType: null, performingAction: null });

test('default East defeat overrides action/movement and holds its prone terminal key beyond 840ms', async () => {
  const { runtime, expect } = await playbackHarness();
  assert.equal(runtime.durationMs('human', 'defeat'), 840);
  for (const team of [0, 1]) for (const selected of [false, true]) {
    const unit = { ...worker(team, selected), hp: 0, defeatStartedAt: 1000,
      walking: true, performingAction: 'build', attackStartedAt: 1000 };
    assert.equal(activeState(unit, 1000), 'defeat');
    expect(unit, 1000, 'defeat-east-0');
    expect(unit, 1280, 'defeat-east-1');
    expect(unit, 1560, 'defeat-east-2');
    expect(unit, 1839, 'defeat-east-2');
    expect(unit, 1840, 'defeat-east-2');
    expect(unit, 11000, 'defeat-east-2');
  }
});

test('dedicated East Stone follows productive receipts, loops and Stops/resumes on both Human seats', async () => {
  const { expect } = await playbackHarness();
  for (const team of [0, 1]) for (const selected of [false, true]) {
    const unit = { ...worker(team, selected), task: 'gathering', performingAction: 'gather-stone' };
    assert.equal(activeState(unit, 1000), 'gather-stone');
    for (let i = 0; i <= 3; i++) expect(unit, 1000 + i * 240, `gather-stone-east-${i % 3}`);
    unit.performingAction = null;
    expect(unit, 1800, 'idle-east-0');
    unit.performingAction = 'gather-stone';
    expect(unit, 1900, 'gather-stone-east-0');
    expect(unit, 2140, 'gather-stone-east-1');
    unit.walking = true; unit.performingAction = null; unit.task = 'moving';
    expect(unit, 2200, 'walk-east-0');
    unit.walking = false; unit.performingAction = 'gather-stone'; unit.task = 'gathering';
    expect(unit, 2300, 'gather-stone-east-0');
    unit.attackStartedAt = 2400;
    expect(unit, 2400, 'gather-wood-east-0'); expect(unit, 3239, 'gather-wood-east-2');
    expect(unit, 3240, 'gather-stone-east-0');
    unit.performingAction = 'gather-food'; expect(unit, 3300, 'gather-food-east-0');
    unit.performingAction = 'gather-stone'; expect(unit, 3400, 'gather-stone-east-0');
    unit.angle = -Math.PI / 4; expect(unit, 3500, 'gather-stone-north-west-0');
    unit.angle = Math.PI / 2; expect(unit, 3600, 'gather-stone-east-0');

  }
  for (const approximate of [false, true]) for (const heading of ['north-east', 'south', 'south-west', 'west']) {
    assert.equal(spriteActionClip(clips, 'gather-stone', heading, 'stone', 'human', approximate)
      .sequence[0].frameId, `idle-${heading}-0`);
  }
});


test('East final strip preserves every preceding RGBA pixel, frame record, clip and decoded mask', () => {
  const image = decodeRgba8(readFileSync(new URL('cast-atlas-runtime.png', directory)));
  const hash = b => createHash('sha256').update(b).digest('hex');
  assert.equal(hash(JSON.stringify(asset.frames.slice(0, preservation.originalFrames))), preservation.originalFrameMetadataSha256);
  const originalClips = structuredClone(asset.clips.slice(0, preservation.originalClips));
  for (const clip of [...preservation.originalReplacedClips, ...JSON.parse(readFileSync(new URL('../docs/qa-evidence/worker-land-art-2026-10-04/north-actions-preservation.json', import.meta.url))).originalReplacedClips]) {
    originalClips[originalClips.findIndex(c => c.stateId === clip.stateId && c.directionId === clip.directionId)] = clip;
  }
  assert.equal(hash(JSON.stringify(originalClips)), preservation.originalClipMetadataSha256);
  const old = preservation.originalDimensionsPx, pixels = createHash('sha256');
  for (let y = 0; y < old.height; y++) pixels.update(image.pixels.subarray(y * image.width * 4, (y * image.width + old.width) * 4));
  assert.equal(pixels.digest('hex'), preservation.originalRgbaSha256, 'Whole previous allocation is untouched');
  assert.equal(hash(readFileSync(new URL('../docs/qa-evidence/worker-land-art-2026-10-04/hammer-era-team-mask.png', import.meta.url))), preservation.originalTeamMaskSha256);
  assert.deepEqual(page.dimensionsPx, { width: 3584, height: 4096 });
  assert.equal(asset.frames.length, 172); assert.equal(asset.clips.length, 65);
  assert.equal(registration.groups[1].state, 'defeat');
  const terminal = asset.frames.find(f => f.id === 'defeat-east-2');
  assert.ok(terminal.alphaBoundsPx.width > terminal.alphaBoundsPx.height * 2, 'Actual prone terminal silhouette');
});
