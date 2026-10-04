import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { assertFrameUnclipped, decodeRgba8 } from './sprite-pixel-bounds.mjs';
import { createUnitSpriteRuntime, spriteActionClip } from '../src/unit-sprite-runtime.mjs';

const directory = new URL('../assets/units/cast-human-sprite-v3/', import.meta.url);
const pack = JSON.parse(readFileSync(new URL('sprite-atlas-pack-v1.json', directory)));
const asset = pack.assets[0], page = pack.pages[0];
const clipMap = new Map(asset.clips.map(c => [`${c.stateId}|${c.directionId}`, c]));
test('North admission preserves the preceding 92 frame records/pixels and team mask', () => {
  const preservation = JSON.parse(readFileSync(new URL(
    '../docs/qa-evidence/worker-land-art-2026-10-04/north-walk-preservation.json', import.meta.url)));
  const originals = asset.frames.slice(0, preservation.originalFrames);
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  assert.equal(hash(JSON.stringify(originals)), preservation.originalFrameMetadataSha256);
  assert.equal(hash(readFileSync(new URL('team-accent-mask.png', directory))),
    preservation.originalTeamMaskSha256);
  const image = decodeRgba8(readFileSync(new URL('cast-atlas-runtime.png', directory)));
  const framesHash = createHash('sha256');
  for (const frame of originals) {
    const r = frame.fallbackRectPx.rectPx;
    for (let y = 0; y < r.height; y++) framesHash.update(image.pixels.subarray(
      ((r.y + y) * image.width + r.x) * 4,
      ((r.y + y) * image.width + r.x + r.width) * 4));
  }
  assert.equal(framesHash.digest('hex'), preservation.originalFrameRgbaSha256);
});

for (const direction of ['east', 'north']) {
const label = direction[0].toUpperCase() + direction.slice(1);
const registration = JSON.parse(readFileSync(new URL(
  `../docs/qa-evidence/worker-land-art-2026-10-04/${direction}-walk-registration.json`, import.meta.url)));

test(`${label} keys contain eight distinct complete same-scale poses above one ground root`, () => {
  const image = decodeRgba8(readFileSync(new URL('cast-atlas-runtime.png', directory)));
  const clip = spriteActionClip(clipMap, 'walk', direction, null, 'human', true);
  assert.equal(clip.directionId, direction);
  assert.equal(clip.loop, true);
  assert.equal(clip.sequence.reduce((sum, key) => sum + key.durationMs, 0), 800);
  const hashes = new Set();
  for (const [index, key] of clip.sequence.entries()) {
    assert.equal(key.frameId, `walk-${direction}-${index}`);
    const frame = asset.frames.find(f => f.id === key.frameId);
    assert.deepEqual(frame.groundPivotPx, { x: 128, y: 244 });
    assert.deepEqual(frame.canvasPx, { width: 256, height: 256 });
    assertFrameUnclipped(image, frame);
    const r = frame.fallbackRectPx.rectPx, bytes = Buffer.alloc(r.width * r.height * 4);
    for (let y = 0; y < r.height; y++) {
      bytes.set(image.pixels.subarray(((r.y + y) * image.width + r.x) * 4,
        ((r.y + y) * image.width + r.x + r.width) * 4), y * r.width * 4);
    }
    const hash = createHash('sha256').update(bytes).digest('hex');
    assert.equal(hash, registration.frames[index].rgbaSha256);
    hashes.add(hash);
  }
  assert.equal(hashes.size, 8, 'Different IDs must refer to actual different artwork');
  // Adding a taller frame would rescale every old frame through the existing loader.
  assert.equal(Math.max(...asset.frames.map(f => f.alphaBoundsPx.height)), 272);
  assert.equal(asset.heightWorld, 1.4258738550646552);
  for (const heading of ['south', 'west', 'north-west']) {
    assert.equal(spriteActionClip(clipMap, 'walk', heading, null, 'human', true)
      .sequence[0].frameId, `idle-${heading}-0`, 'Remaining gaps are explicit idle holds');
  }
});

test(`default Human ${label} walk advances, loops, turns, Stops/resumes and returns cargo on either seat`, async () => {
  const savedFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    assert.equal(url, '/assets/units/cast-human-sprite-v3/sprite-atlas-pack-v1.json');
    return { ok: true, json: async () => pack };
  };
  class TextureLoader {
    load(_url, done) { const texture = new THREE.Texture(); queueMicrotask(() => done(texture)); return texture; }
  }
  const scene = new THREE.Scene();
  let runtime;
  try {
    runtime = createUnitSpriteRuntime({ THREE: { ...THREE, TextureLoader }, scene, capacity: 1,
      teamHex: [0x5aa7d7, 0xe67a5e], cameraQuaternion: new THREE.Quaternion(), roles: ['human'],
      roleSpriteVersions: { human: 'v3' }, teamCivilizations: ['human', 'human'],
      approximateActionDirections: true });
    runtime.setCount(0, 1); runtime.setCount(1, 1); runtime.setVisible(true);
    assert.equal(await runtime.ready, true);
  } finally { globalThis.fetch = savedFetch; }
  const expect = (unit, now, frameId) => {
    runtime.update(unit, now, 1);
    const r = asset.frames.find(f => f.id === frameId).fallbackRectPx.rectPx;
    const inset = page.sampling.uvInsetPx;
    const expected = [(r.x + inset) / page.dimensionsPx.width,
      (r.y + r.height - inset) / page.dimensionsPx.height,
      (r.x + r.width - inset) / page.dimensionsPx.width,
      (r.y + inset) / page.dimensionsPx.height];
    assert.deepEqual(Array.from(scene.children[unit.team].geometry.attributes.instanceAtlasRect.array),
      Array.from(new Float32Array(expected)), frameId);
  };
  for (const team of [0, 1]) for (const selected of [false, true]) {
    const unit = { id: team, team, slot: 0, kind: 'worker', hp: 100, selected,
      task: 'moving', walking: true, angle: direction === 'east' ? Math.PI / 2 : 0, renderX: 0, renderZ: 0,
      attackStartedAt: 0, defeatStartedAt: 0, cargo: 0, cargoType: null, performingAction: null };
    for (let i = 0; i <= 8; i++) expect(unit, 1000 + i * 100, `walk-${direction}-${i % 8}`);
    unit.angle = Math.PI / 4;
    expect(unit, 1900, 'walk-north-east-1');
    unit.angle = direction === 'east' ? Math.PI / 2 : 0;
    expect(unit, 2000, `walk-${direction}-2`); // Heading changes preserve elapsed phase.
    unit.walking = false; unit.task = 'idle';
    expect(unit, 2100, `idle-${direction}-0`);
    unit.walking = true; unit.task = 'returning'; unit.cargo = 10; unit.cargoType = 'wood';
    expect(unit, 2200, `walk-${direction}-0`);
    expect(unit, 2600, `walk-${direction}-4`);
    unit.walking = false;
    expect(unit, 2700, `idle-${direction}-0`);
    unit.task = 'idle'; unit.cargo = 0; unit.cargoType = null;
    expect(unit, 2800, `idle-${direction}-0`);
  }
});
}
