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
  '../docs/qa-evidence/worker-land-art-2026-10-04/north-actions-registration.json', import.meta.url)));
const preservation = JSON.parse(readFileSync(new URL(
  '../docs/qa-evidence/worker-land-art-2026-10-04/north-actions-preservation.json', import.meta.url)));

for (const group of registration.groups) {
test(`North ${group.state} has three complete distinct poses at one scale and fixed ground pivot`, () => {
  const image = decodeRgba8(readFileSync(new URL('cast-atlas-runtime.png', directory)));
  assert.deepEqual([image.width, image.height], [5120, 4096]);
  assert.equal(registration.sharedScale, 271 / 325);
  const clip = spriteActionClip(clips, group.state, 'north', 'stone', 'human', false);
  assert.equal(clip.stateId, group.state);
  assert.equal(clip.directionId, 'north');
  assert.equal(clip.loop, group.state !== 'defeat');
  assert.equal(spriteClipDuration(clip), group.durationMs);
  const hashes = new Set();
  for (const [index, key] of clip.sequence.entries()) {
    assert.deepEqual(key, { frameId: `${group.state}-north-${index}`,
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
  assert.equal(hashes.size, group.frames.length, 'Different IDs select different articulated pixels');
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
  task: 'gathering', walking: false, angle: 0, renderX: 0, renderZ: 0,
  attackStartedAt: 0, defeatStartedAt: 0, cargo: 0, cargoType: null, performingAction: null });

for (const action of ['gather-wood', 'gather-food', 'build', 'repair', 'gather-stone']) {
  test(`North default ${action}: confirmed loop, Stop/resume, move/attack interruptions and cargo return`, async () => {
    const { expect } = await playbackHarness();
    const state = action === 'repair' ? 'build' : action;
    const count = state === 'build' ? 2 : 3;
    for (const team of [0, 1]) for (const selected of [false, true]) {
      const unit = worker(team, selected);
      unit.task = action === 'build' ? 'building' : action === 'repair' ? 'repairing' : 'gathering';
      expect(unit, 900, 'idle-north-0');
      unit.performingAction = action; assert.equal(activeState(unit, 1000), ['gather-wood', 'gather-food'].includes(action) ? 'gather' : action);
      for (let i = 0; i <= count; i++) expect(unit, 1000 + i * 240, `${state}-north-${i % count}`);
      unit.performingAction = null; expect(unit, 1800, 'idle-north-0');
      unit.performingAction = action; expect(unit, 1900, `${state}-north-0`); expect(unit, 2140, `${state}-north-1`);
      unit.walking = true; unit.performingAction = null; unit.task = 'moving'; expect(unit, 2200, 'walk-north-0');
      unit.walking = false; unit.performingAction = action; unit.task = action === 'build' ? 'building' : action === 'repair' ? 'repairing' : 'gathering'; expect(unit, 2300, `${state}-north-0`);
      unit.attackStartedAt = 2400; expect(unit, 2400, 'gather-wood-north-0'); expect(unit, 3239, 'gather-wood-north-2');
      expect(unit, 3240, `${state}-north-0`);
      unit.walking = true; unit.performingAction = null; unit.task = 'returning'; unit.cargoType = 'wood'; unit.cargo = 4;
      expect(unit, 3300, 'walk-north-0'); expect(unit, 3700, 'walk-north-4');
      unit.cargo = 0; unit.cargoType = null; unit.walking = false; unit.task = 'idle'; expect(unit, 3800, 'idle-north-0');
    }
  });
}

test('North faithful axe attack is an independent 840ms one-shot, then idle; defeat always wins and clamps', async () => {
  const attack = spriteActionClip(clips, 'attack', 'north', null, 'human', true);
  assert.equal(attack.loop, false); assert.equal(spriteClipDuration(attack), 840);
  assert.deepEqual(attack.sequence, [0, 1, 2].map(i => ({ frameId: `gather-wood-north-${i}`, durationMs: 280 })));
  const build = spriteActionClip(clips, 'build', 'north', null, 'human', true), repair = spriteActionClip(clips, 'repair', 'north', null, 'human', true);
  assert.equal(build.sequence.length, 2); assert.equal(spriteClipDuration(build), 480);
  assert.equal(repair.loop, true); assert.deepEqual(repair.sequence, build.sequence);
  assert.deepEqual(registration.groups.find(g => g.state === 'build').frames.map(f => f.sourceIndex), [6, 8], 'Malformed raw axe-shaped hammer strike is retained, not admitted');
  const { runtime, expect } = await playbackHarness();
  assert.equal(runtime.durationMs('human', 'defeat'), 840);
  for (const team of [0, 1]) for (const selected of [false, true]) {
    const unit = { ...worker(team, selected), task: 'idle', attackStartedAt: 1000 };
    for (let i = 0; i < 3; i++) expect(unit, 1000 + i * 280, `gather-wood-north-${i}`);
    expect(unit, 1839, 'gather-wood-north-2'); expect(unit, 1840, 'idle-north-0');
    unit.hp = 0; unit.defeatStartedAt = 2000; unit.walking = true; unit.performingAction = 'build'; unit.attackStartedAt = 2000;
    assert.equal(activeState(unit, 2000), 'defeat');
    for (let i = 0; i < 3; i++) expect(unit, 2000 + i * 280, `defeat-north-${i}`);
    expect(unit, 2840, 'defeat-north-2'); expect(unit, 12000, 'defeat-north-2');
  }
});

test('North strip preserves whole previous allocation, 158 frame records, 61 clips with declared idle exceptions and world scale', () => {
  const hash = b => createHash('sha256').update(b).digest('hex');
  assert.equal(hash(JSON.stringify(asset.frames.slice(0, preservation.originalFrames))), preservation.originalFrameMetadataSha256);
  const oldClips = structuredClone(asset.clips.slice(0, preservation.originalClips));
  for (const c of [...preservation.originalReplacedClips, ...JSON.parse(readFileSync(new URL('../docs/qa-evidence/worker-land-art-2026-10-04/north-east-actions-preservation.json', import.meta.url))).originalReplacedClips, ...JSON.parse(readFileSync(new URL('../docs/qa-evidence/worker-land-art-2026-10-04/south-actions-preservation.json', import.meta.url))).originalReplacedClips, ...JSON.parse(readFileSync(new URL('../docs/qa-evidence/worker-land-art-2026-10-04/south-west-actions-preservation.json', import.meta.url))).originalReplacedClips]) oldClips[oldClips.findIndex(v => v.stateId === c.stateId && v.directionId === c.directionId)] = c;
  assert.equal(hash(JSON.stringify(oldClips)), preservation.originalClipMetadataSha256);
  const image = decodeRgba8(readFileSync(new URL('cast-atlas-runtime.png', directory))), old = preservation.originalDimensionsPx, pixels = createHash('sha256');
  for (let y = 0; y < old.height; y++) pixels.update(image.pixels.subarray(y * image.width * 4, (y * image.width + old.width) * 4));
  assert.equal(pixels.digest('hex'), preservation.originalRgbaSha256);
  assert.equal(hash(readFileSync(new URL('../docs/qa-evidence/worker-land-art-2026-10-04/east-final-era-team-mask.png', import.meta.url))), preservation.originalTeamMaskSha256);
  assert.deepEqual(page.dimensionsPx, { width: 5120, height: 4096 });
  assert.equal(asset.frames.length, 217); assert.equal(asset.clips.length, 77);
  const terminal = asset.frames.find(f => f.id === 'defeat-north-2'); assert.ok(terminal.alphaBoundsPx.width > terminal.alphaBoundsPx.height * 1.5);
  for (const heading of ['west']) {
    assert.equal(spriteActionClip(clips, 'gather-stone', heading, 'stone', 'human', true).sequence[0].frameId, `idle-${heading}-0`);
  }
});
