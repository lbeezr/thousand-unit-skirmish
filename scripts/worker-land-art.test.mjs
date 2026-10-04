import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import * as THREE from 'three';
import { assertFrameUnclipped, decodeRgba8 } from './sprite-pixel-bounds.mjs';
import { activeState, createUnitSpriteRuntime, spriteActionClip, spriteClipDuration } from '../src/unit-sprite-runtime.mjs';

const directory = new URL('../assets/units/cast-human-sprite-v3/', import.meta.url);
const pack = JSON.parse(readFileSync(new URL('sprite-atlas-pack-v1.json', directory)));
const asset = pack.assets[0], page = pack.pages[0];
const clipMap = new Map(asset.clips.map(c => [`${c.stateId}|${c.directionId}`, c]));
const extension = JSON.parse(readFileSync(new URL(
  '../docs/qa-evidence/worker-land-art-2026-10-04/wood-north-west-preservation.json', import.meta.url)));
const originalMask = readFileSync(new URL(
  '../docs/qa-evidence/worker-land-art-2026-10-04/stone-era-team-mask.png', import.meta.url));
const attackReuse = JSON.parse(readFileSync(new URL(
  '../docs/qa-evidence/worker-land-art-2026-10-04/attack-north-west-reuse.json', import.meta.url)));
const nwActions = JSON.parse(readFileSync(new URL(
  '../docs/qa-evidence/worker-land-art-2026-10-04/north-west-actions-preservation.json', import.meta.url)));
const eastAxes = JSON.parse(readFileSync(new URL(
  '../docs/qa-evidence/worker-land-art-2026-10-04/wood-east-preservation.json', import.meta.url)));
const eastHammer = JSON.parse(readFileSync(new URL(
  '../docs/qa-evidence/worker-land-art-2026-10-04/hammer-east-preservation.json', import.meta.url)));

const eastFinal = JSON.parse(readFileSync(new URL('../docs/qa-evidence/worker-land-art-2026-10-04/stone-defeat-east-preservation.json', import.meta.url)));
const hammerMask = readFileSync(new URL('../docs/qa-evidence/worker-land-art-2026-10-04/hammer-era-team-mask.png', import.meta.url));

const northActions = JSON.parse(readFileSync(new URL('../docs/qa-evidence/worker-land-art-2026-10-04/north-actions-preservation.json', import.meta.url)));
const eastFinalMask = readFileSync(new URL('../docs/qa-evidence/worker-land-art-2026-10-04/east-final-era-team-mask.png', import.meta.url));

// The old mask is entirely zero. Verify decoded zero pixels after the explicit
// page extension, while retaining the original encoded file for historical hashes.
function assertExtendedZeroMask() {
  const bytes = readFileSync(new URL('team-accent-mask.png', directory));
  const chunks = [];
  let header;
  for (let offset = 8; offset < bytes.length;) {
    const size = bytes.readUInt32BE(offset), type = bytes.toString('ascii', offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + size);
    if (type === 'IHDR') header = data;
    if (type === 'IDAT') chunks.push(data);
    offset += size + 12;
  }
  assert.ok(header);
  const width = header.readUInt32BE(0), height = header.readUInt32BE(4);
  assert.deepEqual([width, height, header[8], header[9], header[12]], [3584, 4096, 8, 0, 0]);
  const rows = inflateSync(Buffer.concat(chunks));
  assert.equal(rows.length, height * (width + 1));
  for (let y = 0; y < height; y++) {
    assert.ok(rows[y * (width + 1)] <= 4, 'valid PNG filter');
    // Zero residuals plus zero prior/left samples decode to zero for every filter.
    assert.ok(rows.subarray(y * (width + 1) + 1, (y + 1) * (width + 1)).every(v => v === 0));
  }
  const old = extension.originalDimensionsPx;
  assert.equal(createHash('sha256').update(Buffer.alloc(old.width * old.height)).digest('hex'),
    extension.originalTeamMaskPixelsSha256);
}

for (const preservationHeading of ['north-walk', 'south-walk', 'west-walks', 'stone-se', 'wood-north-west', 'food-north-west', 'north-west-actions', 'wood-east', 'food-east', 'hammer-east', 'stone-defeat-east', 'north-actions']) {
test(`${preservationHeading} admission preserves preceding frame records/pixels and team mask`, () => {
  const preservation = JSON.parse(readFileSync(new URL(
    `../docs/qa-evidence/worker-land-art-2026-10-04/${preservationHeading}-preservation.json`, import.meta.url)));
  const originals = asset.frames.slice(0, preservation.originalFrames);
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  assert.equal(hash(JSON.stringify(originals)), preservation.originalFrameMetadataSha256);
  assert.equal(hash(preservationHeading === 'north-actions' ? eastFinalMask : ['food-north-west', 'north-west-actions', 'wood-east', 'food-east', 'hammer-east', 'stone-defeat-east', 'north-actions'].includes(preservationHeading)
    ? hammerMask : originalMask),
    preservation.originalTeamMaskSha256);
  assertExtendedZeroMask();
  const image = decodeRgba8(readFileSync(new URL('cast-atlas-runtime.png', directory)));
  const framesHash = createHash('sha256');
  for (const frame of originals) {
    const r = frame.fallbackRectPx.rectPx;
    for (let y = 0; y < r.height; y++) framesHash.update(image.pixels.subarray(
      ((r.y + y) * image.width + r.x) * 4,
      ((r.y + y) * image.width + r.x + r.width) * 4));
  }
  assert.equal(framesHash.digest('hex'), preservation.originalFrameRgbaSha256);
  if (preservation.originalClips) {
    const originalClips = structuredClone(asset.clips.slice(0, preservation.originalClips));
    // Historical hashes predate these explicit, separately tested placeholder
    // replacements. The family receipt already includes the real NW attack.
    if (!['north-west-actions', 'wood-east', 'food-east', 'hammer-east', 'stone-defeat-east', 'north-actions'].includes(preservationHeading)) {
      const index = originalClips.findIndex(c => c.stateId === 'attack' && c.directionId === 'north-west');
      originalClips[index] = attackReuse.originalAttackClip;
    }
    const replacements = [...(['wood-east', 'food-east', 'hammer-east', 'stone-defeat-east', 'north-actions'].includes(preservationHeading) ? [] : nwActions.originalReplacedClips),
      ...(['food-east', 'hammer-east', 'stone-defeat-east', 'north-actions'].includes(preservationHeading) ? [] : eastAxes.originalReplacedClips),
      ...(['stone-defeat-east', 'north-actions'].includes(preservationHeading) ? [] : eastHammer.originalReplacedClips),
      ...(['north-actions'].includes(preservationHeading) ? [] : eastFinal.originalReplacedClips),
      ...northActions.originalReplacedClips];
    for (const clip of replacements) {
      const index = originalClips.findIndex(c => c.stateId === clip.stateId && c.directionId === clip.directionId);
      if (index >= 0) originalClips[index] = clip;
    }
    assert.equal(hash(JSON.stringify(originalClips)), preservation.originalClipMetadataSha256);
  }
});

}

for (const direction of ['east', 'north', 'south', 'west', 'north-west']) {
const label = direction[0].toUpperCase() + direction.slice(1);
const angle = { east: Math.PI / 2, north: 0, south: Math.PI, west: -Math.PI / 2, 'north-west': -Math.PI / 4 }[direction];
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
  for (const heading of ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west']) {
    const walk = spriteActionClip(clipMap, 'walk', heading, null, 'human', true);
    assert.equal(walk.directionId, heading);
    assert.equal(walk.sequence.length, 8);
    assert.ok(walk.sequence.every(key => key.frameId.startsWith(`walk-${heading}-`)),
      'Every heading must select authored walk instead of an idle hold');
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
      task: 'moving', walking: true, angle: angle, renderX: 0, renderZ: 0,
      attackStartedAt: 0, defeatStartedAt: 0, cargo: 0, cargoType: null, performingAction: null };
    for (let i = 0; i <= 8; i++) expect(unit, 1000 + i * 100, `walk-${direction}-${i % 8}`);
    unit.angle = Math.PI / 4;
    expect(unit, 1900, 'walk-north-east-1');
    unit.angle = angle;
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

test('Stone SE is a complete four-pose dedicated pick clip with its own shared root/scale', () => {
  const registration = JSON.parse(readFileSync(new URL(
    '../docs/qa-evidence/worker-land-art-2026-10-04/stone-se-registration.json', import.meta.url)));
  const image = decodeRgba8(readFileSync(new URL('cast-atlas-runtime.png', directory)));
  const clip = spriteActionClip(clipMap, 'gather-stone', 'south-east', 'stone', 'human', false);
  assert.equal(clip.stateId, 'gather-stone');
  assert.equal(clip.directionId, 'south-east');
  assert.equal(clip.loop, true);
  assert.equal(spriteClipDuration(clip), 840);
  const hashes = new Set();
  for (const [index, key] of clip.sequence.entries()) {
    assert.deepEqual(key, { frameId: `gather-stone-south-east-${index}`, durationMs: 210 });
    const frame = asset.frames.find(f => f.id === key.frameId);
    assert.deepEqual(frame.canvasPx, { width: 320, height: 256 });
    assert.deepEqual(frame.groundPivotPx, { x: 160, y: 244 });
    assertFrameUnclipped(image, frame);
    const r = frame.fallbackRectPx.rectPx, hash = createHash('sha256');
    for (let y = 0; y < r.height; y++) hash.update(image.pixels.subarray(
      ((r.y + y) * image.width + r.x) * 4,
      ((r.y + y) * image.width + r.x + r.width) * 4));
    const digest = hash.digest('hex');
    assert.equal(digest, registration.frames[index].rgbaSha256);
    hashes.add(digest);
  }
  assert.equal(hashes.size, 4);
  assert.deepEqual(asset.clips.filter(c => c.stateId === 'gather-stone').map(c => c.directionId), ['south-east', 'north-west', 'east', 'north']);
  for (const heading of ['north-east', 'south', 'south-west', 'west']) {
    assert.equal(spriteActionClip(clipMap, 'gather-stone', heading, 'stone', 'human', false)
      .sequence[0].frameId, `idle-${heading}-0`);
  }
});

for (const resource of ['wood', 'food']) {
test(`NW ${resource} adds three distinct complete work poses with unchanged world units per pixel`, () => {
  const registration = JSON.parse(readFileSync(new URL(
    `../docs/qa-evidence/worker-land-art-2026-10-04/${resource}-north-west-registration.json`, import.meta.url)));
  const image = decodeRgba8(readFileSync(new URL('cast-atlas-runtime.png', directory)));
  assert.deepEqual([image.width, image.height], [3584, 4096]);
  const clip = spriteActionClip(clipMap, 'gather', 'north-west', resource, 'human', true);
  assert.equal(clip.stateId, `gather-${resource}`);
  assert.equal(clip.directionId, 'north-west');
  assert.equal(clip.loop, true);
  assert.equal(spriteClipDuration(clip), 720);
  const hashes = new Set();
  for (const [index, key] of clip.sequence.entries()) {
    assert.deepEqual(key, { frameId: `gather-${resource}-north-west-${index}`, durationMs: 240 });
    const frame = asset.frames.find(f => f.id === key.frameId);
    assert.deepEqual(frame.canvasPx, resource === 'wood' ? { width: 320, height: 320 } : { width: 256, height: 256 });
    assert.deepEqual(frame.groundPivotPx, resource === 'wood' ? { x: 160, y: 308 } : { x: 128, y: 244 });
    assertFrameUnclipped(image, frame);
    const r = frame.fallbackRectPx.rectPx, hash = createHash('sha256');
    for (let y = 0; y < r.height; y++) hash.update(image.pixels.subarray(
      ((r.y + y) * image.width + r.x) * 4, ((r.y + y) * image.width + r.x + r.width) * 4));
    const digest = hash.digest('hex');
    assert.equal(digest, registration.frames[index].rgbaSha256);
    hashes.add(digest);
  }
  assert.equal(hashes.size, 3);
  assert.equal(asset.heightWorld / Math.max(...asset.frames.map(f => f.alphaBoundsPx.height)),
    extension.worldUnitsPerPixel);
  for (const heading of ['north-east', 'south', 'south-west', 'west']) {
    if (heading === 'east') continue; // Separately admitted/tested true East wood and food keys.
    assert.equal(spriteActionClip(clipMap, 'gather', heading, resource, 'human', true)
      .sequence[0].frameId, `idle-${heading}-0`, 'One new heading must not turn missing headings');
  }
  assert.equal(spriteActionClip(clipMap, 'gather', 'north-west', resource === 'food' ? 'wood' : 'food', 'human', true)
    .sequence[0].frameId, `gather-${resource === 'food' ? 'wood' : 'food'}-north-west-0`, 'Resource selectors use their own artwork');
});

test(`default NW ${resource} advances and stops/resumes on productive activity, with movement/attack interruptions`, async () => {
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
      task: 'gathering', walking: false, angle: -Math.PI / 4, renderX: 0, renderZ: 0,
      attackStartedAt: 0, defeatStartedAt: 0, cargo: 0, cargoType: null, performingAction: null };
    expect(unit, 900, 'idle-north-west-0'); // Travel/intent does not invent productive work.
    unit.performingAction = `gather-${resource}`;
    assert.equal(activeState(unit, 1000), 'gather');
    for (let i = 0; i <= 3; i++) expect(unit, 1000 + i * 240, `gather-${resource}-north-west-${i % 3}`);
    unit.angle = 0;
    expect(unit, 1740, `gather-${resource}-north-0`);
    assert.equal(unit.spriteClockStartedAt, 1000);
    unit.angle = -Math.PI / 4;
    expect(unit, 1750, `gather-${resource}-north-west-0`);
    unit.performingAction = null;
    expect(unit, 1800, 'idle-north-west-0');
    unit.performingAction = `gather-${resource}`;
    expect(unit, 1900, `gather-${resource}-north-west-0`);
    expect(unit, 2140, `gather-${resource}-north-west-1`);
    unit.walking = true; unit.task = 'moving'; unit.performingAction = null;
    expect(unit, 2200, 'walk-north-west-0');
    unit.walking = false; unit.task = 'gathering'; unit.performingAction = `gather-${resource}`;
    expect(unit, 2300, `gather-${resource}-north-west-0`);
    unit.attackStartedAt = 2400;
    expect(unit, 2400, 'gather-wood-north-west-0'); // Actual NW axe swing is also the authored attack.
    unit.attackStartedAt = 0;
    expect(unit, 2500, `gather-${resource}-north-west-0`);
    unit.task = 'returning'; unit.performingAction = null; unit.walking = true;
    unit.cargo = 10; unit.cargoType = resource;
    expect(unit, 2600, 'walk-north-west-0');
    unit.walking = false;
    expect(unit, 2700, 'idle-north-west-0');
  }
});
}
