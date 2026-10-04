import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import * as THREE from 'three';
import { decodeRgba8, measureFrameAlpha } from './sprite-pixel-bounds.mjs';
import { validateSpriteAtlas } from './sprite-atlas-contract.mjs';
import { workerFishingPresentation } from '../src/worker-fishing-presentation.mjs';
import { shoreFishSitePositions } from '../src/shore-fishing-placement.mjs';
import { headingToTarget } from '../src/unit-heading.mjs';
import { farmBuildingId, farmHarvestNode } from '../src/farm-harvest.mjs';
import { activeState, normalizedDirection, spriteActionClip, spriteAnimationTime,
  createUnitSpriteRuntime } from '../src/unit-sprite-runtime.mjs';

const directions = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
const map = JSON.parse(readFileSync(new URL('../maps/shore-fishing.json', import.meta.url)));
const sites = shoreFishSitePositions(map);
const worker = (site, team = 0) => ({ id: team, team, slot: 0, hp: 100, kind: 'worker',
  x: site.land.x, z: site.land.z, renderX: site.land.x, renderZ: site.land.z,
  gatherPhase: 'gathering', gatherForestCell: -1, gatherNodeId: site.nodeId,
  task: 'gathering', performingAction: 'gather-food', cargo: 0, cargoType: 'food', attackStartedAt: 0, walking: false });
const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const server = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
const basePack = JSON.parse(readFileSync(new URL('../assets/units/cast-human-sprite-v3/sprite-atlas-pack-v1.json', import.meta.url)));
const sourceRoot = new URL('../docs/art-direction/human-roster-v1/fishing-SE-v1/', import.meta.url);
const preservation = JSON.parse(readFileSync(new URL('runtime-preservation.json', sourceRoot)));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

test('ordinary play loads the approved Human v3 fishing pack without a pilot flag', () => {
  const start = main.indexOf('const humanRosterPreview =');
  const end = main.indexOf('const unitSpritePreviewRoleSet =', start);
  const binding = vm.runInNewContext(main.slice(start, end) + '\n({humanRosterPreview, castPreview, unitSpritePreviewRoles, unitSpritePreviewVersions})',
    { roomPageUrl: new URL('http://localhost/?play=1') });
  assert.equal(binding.humanRosterPreview, true);
  assert.equal(binding.castPreview, true);
  assert.ok(binding.unitSpritePreviewRoles.includes('human'));
  assert.equal(binding.unitSpritePreviewVersions.human, 'v3');
  assert.deepEqual(basePack.assets[0].clips.filter(c => c.stateId === 'gather-fish').map(c => c.directionId), ['south-east']);
});

test('published atlas preserves prior action pixels/metadata and all four approved SE keys', async () => {
  const manifest = new URL('../assets/units/cast-human-sprite-v3/sprite-atlas-pack-v1.json', import.meta.url);
  assert.deepEqual((await validateSpriteAtlas(fileURLToPath(manifest))).errors, []);
  const asset = basePack.assets[0];
  assert.equal(sha256(JSON.stringify(asset.frames.slice(0, preservation.originalFrames))), preservation.originalFrameMetadataSha256);
  // Explicitly admitted land walk clips replace their former idle holds.
  // Reconstruct those historical clips for the frozen fishing-era hash;
  // all other original metadata and original/fishing pixels remain protected.
  const originalClips = structuredClone(asset.clips.slice(0, preservation.originalClips));
  for (const direction of ['east', 'north', 'south', 'west', 'north-west']) {
    const walk = originalClips.find(c => c.stateId === 'walk' && c.directionId === direction);
    assert.deepEqual(walk.sequence, Array.from({ length: 8 }, (_, i) =>
      ({ frameId: `walk-${direction}-${i}`, durationMs: 100 })));
    walk.sequence = [{ frameId: `idle-${direction}-0`, durationMs: 1000 }];
  }
  const attack = originalClips.find(c => c.stateId === 'attack' && c.directionId === 'north-west');
  assert.equal(attack.loop, false);
  assert.deepEqual(attack.sequence, [0, 1, 2].map(i =>
    ({ frameId: `gather-wood-north-west-${i}`, durationMs: 280 })));
  attack.loop = true;
  attack.sequence = [{ frameId: 'idle-north-west-0', durationMs: 1000 }];
  for (const state of ['build', 'defeat']) {
    const clip = originalClips.find(c => c.stateId === state && c.directionId === 'north-west');
    assert.equal(clip.loop, state === 'build');
    assert.deepEqual(clip.sequence, [0, 1, 2].map(i =>
      ({ frameId: `${state}-north-west-${i}`, durationMs: state === 'build' ? 240 : 280 })));
    clip.sequence = [{ frameId: 'idle-north-west-0', durationMs: 1000 }];
  }
  const eastAttack = originalClips.find(c => c.stateId === 'attack' && c.directionId === 'east');
  assert.equal(eastAttack.loop, false);
  assert.deepEqual(eastAttack.sequence, [0, 1, 2].map(i =>
    ({ frameId: `gather-wood-east-${i}`, durationMs: 280 })));
  eastAttack.loop = true;
  eastAttack.sequence = [{ frameId: 'idle-east-0', durationMs: 1000 }];
  const eastBuild = originalClips.find(c => c.stateId === 'build' && c.directionId === 'east');
  assert.equal(eastBuild.loop, true);
  assert.deepEqual(eastBuild.sequence, [0, 1, 2].map(i => ({ frameId: `build-east-${i}`, durationMs: 240 })));
  eastBuild.sequence = [{ frameId: 'idle-east-0', durationMs: 1000 }];
  const eastDefeat = originalClips.find(c => c.stateId === 'defeat' && c.directionId === 'east');
  assert.equal(eastDefeat.loop, false);
  assert.deepEqual(eastDefeat.sequence, [0, 1, 2].map(i => ({ frameId: `defeat-east-${i}`, durationMs: 280 })));
  eastDefeat.sequence = [{ frameId: 'idle-east-0', durationMs: 1000 }];
  const northHistory = JSON.parse(readFileSync(new URL('../docs/qa-evidence/worker-land-art-2026-10-04/north-actions-preservation.json', import.meta.url)));
  for (const clip of northHistory.originalReplacedClips) originalClips[originalClips.findIndex(c => c.stateId === clip.stateId && c.directionId === clip.directionId)] = clip;
  assert.equal(sha256(JSON.stringify(originalClips)), preservation.originalClipMetadataSha256);
  assert.equal(asset.frames.length, preservation.originalFrames + 4 + 40 + 4 + 3 + 3 + 9 + 3 + 3 + 3 + 6 + 14);
  assert.equal(asset.clips.length, preservation.originalClips + 14);
  assert.equal(asset.heightWorld / Math.max(...asset.frames.map(f => f.alphaBoundsPx.height)), preservation.worldUnitsPerPixel);
  const image = decodeRgba8(readFileSync(new URL('cast-atlas-runtime.png', manifest)));
  assert.deepEqual([image.width, image.height], [3584, 4096]);
  // The land pack appends a side strip; hash the historical ROI row by row.
  const originalPixels = createHash('sha256');
  for (let y = 0; y < preservation.originalDimensionsPx.height; y++) originalPixels.update(
    image.pixels.subarray(y * image.width * 4, (y * image.width + preservation.originalDimensionsPx.width) * 4));
  assert.equal(originalPixels.digest('hex'), preservation.originalRgbaSha256);
  const clip = asset.clips.find(c => c.stateId === 'gather-fish');
  assert.equal(clip.directionId, 'south-east');
  assert.equal(clip.loop, true);
  assert.deepEqual(clip.sequence.map(k => k.durationMs), [350, 300, 350, 300]);
  for (const [index, key] of clip.sequence.entries()) {
    const frame = asset.frames.find(f => f.id === key.frameId);
    assert.deepEqual(frame.canvasPx, { width: 512, height: 512 });
    assert.deepEqual(frame.groundPivotPx, { x: 256, y: 480 });
    const rect = frame.frameRectsPx[0].rectPx;
    assert.deepEqual(measureFrameAlpha(image, rect, 1), frame.alphaBoundsPx);
    assert.ok(frame.alphaBoundsPx.x > 1 && frame.alphaBoundsPx.y > 1);
    assert.ok(frame.alphaBoundsPx.x + frame.alphaBoundsPx.width < 511);
    assert.ok(frame.alphaBoundsPx.y + frame.alphaBoundsPx.height < 511);
    const approved = decodeRgba8(readFileSync(new URL(`fishing-SE-0${index}.png`, sourceRoot)));
    for (let row = 0; row < rect.height; row++) {
      const offset = ((rect.y + row) * image.width + rect.x) * 4;
      assert.deepEqual(image.pixels.subarray(offset, offset + rect.width * 4),
        approved.pixels.subarray(row * rect.width * 4, (row + 1) * rect.width * 4), `approved key ${index}, row ${row}`);
    }
  }
});

test('both actual Lab banks face the canonical water spot while retaining food and land authority', () => {
  for (const [team, site] of sites.entries()) {
    const unit = worker(site, team), node = map.resourceNodes.find(n => n.id === site.nodeId);
    const before = structuredClone(unit), result = workerFishingPresentation(unit, node, map);
    assert.equal(result.resourceVariant, 'shore-fish');
    assert.equal(result.heading, headingToTarget(unit.x, unit.z, site.water.x, site.water.z));
    assert.equal(normalizedDirection(result.heading), team === 0 ? 'east' : 'west');
    assert.equal(headingToTarget(unit.x, unit.z, node.x, node.z), null, 'coincident bank cannot supply water facing');
    assert.deepEqual(unit, before, 'cosmetic derivation never changes simulation state');
    assert.equal(unit.cargoType, 'food');
  }
  const nextMap = structuredClone(map);
  assert.deepEqual(workerFishingPresentation(worker(sites[0]), nextMap.resourceNodes[0], nextMap),
    workerFishingPresentation(worker(sites[0]), map.resourceNodes[0], map), 'fresh map identity reconstructs after recovery');
});

test('travel, returning cargo, dead units, other resources and forest work cannot become fishing', () => {
  const site = sites[0], node = map.resourceNodes.find(n => n.id === site.nodeId);
  for (const change of [{ gatherPhase: 'to-node' }, { gatherPhase: 'to-base' }, { gatherPhase: '' },
    { hp: 0 }, { kind: 'infantry' }, { gatherForestCell: 2 }]) {
    assert.equal(workerFishingPresentation({ ...worker(site), ...change }, node, map), null);
  }
  assert.equal(workerFishingPresentation(worker(site), { ...node, resourceVariant: undefined }, map), null);
  assert.equal(workerFishingPresentation(worker(site), null, map), null);
  assert.equal(workerFishingPresentation(worker(site), { ...node, id: 'missing' }, map), null);
});

test('wire identity and water heading are seat-private and leave existing attack/audio offsets intact', () => {
  const unit = { ...worker(sites[0]), lastAttackTick: 10, lastAttackX: 7, lastAttackZ: 8, attackTargetId: -1 };
  const context = vm.createContext({ workerPerformingAction: () => null, units: [unit], mapDefinition: { ...map, fogOfWar: true },
    resourceNodeStates: new Map(map.resourceNodes.map(n => [n.id, n])), farmBuildingId, farmHarvestNode, buildingsById: new Map(),
    headingToTarget, workerFishingPresentation, workerTaskStatus: u => u.gatherPhase === 'gathering' ? 'gathering' : 'idle',
    workerAudioExecution: () => 'food', cellToWorld: () => ({ x: 0, z: 0 }),
    cellVisibleToTeam: () => true, worldToCell: () => 0, tickNumber: 10, STATE_EVERY_TICKS: 3 });
  const lookup = server.slice(server.indexOf('function harvestNodeById('), server.indexOf('\nfunction routeWorker('));
  vm.runInContext(lookup + server.slice(server.indexOf('function snapshotUnits('), server.indexOf('function snapshotPersistentOrders(')), context);
  for (const team of [0, 1]) {
    unit.team = team;
    const row = context.snapshotUnits(team)[0];
    assert.deepEqual(Array.from(row.slice(11, 15)), [10, 7, 8, 'food']);
    assert.equal(row[15], Math.PI / 2); assert.equal(row[16], 'shore-fish');
    const enemy = context.snapshotUnits(1 - team)[0];
    assert.equal(enemy[9], null); assert.equal(enemy[15], undefined); assert.equal(enemy[16], undefined);
    for (const phase of ['to-node', 'to-base', '']) {
      unit.gatherPhase = phase;
      const cleared = context.snapshotUnits(team)[0];
      assert.equal(cleared[15], undefined); assert.equal(cleared[16], undefined);
    }
    unit.gatherPhase = 'gathering';
  }
});

test('client clears fishing identity on Stop, legacy rows, wrong role and unknown variants', () => {
  const start = main.indexOf('    unit.workResourceVariant = kind');
  const readVariant = main.slice(start, main.indexOf('\n    if (kind', start));
  const unit = { workResourceVariant: 'shore-fish' };
  for (const [kind, taskStatus, workResourceVariant, expected] of [
    ['worker', 'gathering', 'shore-fish', 'shore-fish'], ['worker', 'idle', 'shore-fish', null],
    ['worker', 'gathering', undefined, null], ['worker', 'gathering', 'unknown', null],
    ['infantry', 'gathering', 'shore-fish', null], ['worker', 'moving', 'shore-fish', null],
  ]) {
    vm.runInNewContext(readVariant, { unit, kind, taskStatus, workResourceVariant });
    assert.equal(unit.workResourceVariant, expected);
  }
});

test('fishing owns a cosmetic clock while movement, attack, repair and defeat retain precedence', () => {
  const unit = { ...worker(sites[0]), workResourceVariant: 'shore-fish' };
  assert.equal(activeState(unit, 1000), 'gather-fish');
  assert.equal(spriteAnimationTime(unit, activeState(unit, 1000), 1000), 0);
  assert.equal(spriteAnimationTime(unit, activeState(unit, 1200), 1200), 200);
  unit.walking = true; assert.equal(activeState(unit, 1200), 'walk');
  unit.walking = false; unit.attackStartedAt = 1150; assert.equal(activeState(unit, 1200), 'attack');
  spriteAnimationTime(unit, 'attack', 1200); unit.attackStartedAt = 0;
  assert.equal(spriteAnimationTime(unit, activeState(unit, 1300), 1300), 0, 'resumed work starts its loop');
  unit.workResourceVariant = null; assert.equal(activeState(unit, 1400), 'gather');
  assert.equal(spriteAnimationTime(unit, activeState(unit, 1400), 1400), 0, 'berry task cannot inherit fish phase');
  unit.task = 'repairing'; unit.performingAction = 'repair'; unit.workResourceVariant = 'shore-fish'; assert.equal(activeState(unit, 1500), 'repair');
  unit.hp = 0; unit.defeatStartedAt = 1600; assert.equal(activeState(unit, 1700), 'defeat');
  assert.equal(unit.cargoType, 'food'); assert.equal(unit.cargo, 0, 'frames never award food');
});

test('one authored fishing heading never invents or mirrors seven others in any renderer lane', () => {
  for (const role of ['human', 'worker', 'boughward-worker']) {
    const clips = new Map(basePack.assets[0].clips.map(c => [`${c.stateId}|${c.directionId}`, c]));
    const fish = { stateId: 'gather-fish', directionId: 'south-east', loop: true,
      sequence: [{ frameId: 'gather-fish-south-east-0', durationMs: 350 }] };
    clips.set('gather-fish|south-east', fish);
    for (const approximate of [false, true]) for (const direction of directions) {
      const selected = spriteActionClip(clips, 'gather-fish', direction, 'food', role, approximate);
      assert.equal(selected.directionId, direction);
      assert.equal(selected === fish, direction === 'south-east');
    }
    clips.delete('gather-fish|south-east');
    for (const direction of directions) assert.equal(spriteActionClip(clips, 'gather-fish', direction, 'food', role, true).directionId, direction);
  }
});

// The normal CI run exercises the shipped fishing keys. An optional manifest
// override remains useful for private production iterations before admission.
test('real renderer selects registered fishing keys and safe fallbacks with unchanged scale and UV handedness', async () => {
  const pack = process.env.FISHING_PILOT_MANIFEST
    ? JSON.parse(readFileSync(process.env.FISHING_PILOT_MANIFEST)) : basePack;
  const asset = pack.assets[0], clips = new Map(asset.clips.map(c => [`${c.stateId}|${c.directionId}`, c]));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => pack });
  class TextureLoader {
    load(url, onLoad) { const texture = new THREE.Texture(); queueMicrotask(() => onLoad(texture)); return texture; }
  }
  try {
    const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-4, 4, 4, -4, 0.1, 100);
    camera.position.set(7.8, 11.2, 7.8); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true);
    const runtime = createUnitSpriteRuntime({ THREE: { ...THREE, TextureLoader }, scene, capacity: 1,
      teamHex: [0x5aa7d7, 0xe67a5e], cameraQuaternion: camera.quaternion,
      roles: ['human'], roleSpriteVersions: { human: 'v3' }, humanAppearancePreview: true,
      approximateActionDirections: true });
    assert.equal(await runtime.ready, true);
    const worldPerPixel = asset.heightWorld / Math.max(...asset.frames.map(f => f.alphaBoundsPx.height));
    assert.equal(worldPerPixel, preservation.worldUnitsPerPixel);
    for (const team of [0, 1]) for (const [index, direction] of directions.entries()) {
      const unit = { ...worker(sites[team], team), angle: index * Math.PI / 4, workResourceVariant: 'shore-fish' };
      const clip = spriteActionClip(clips, 'gather-fish', direction, 'food', 'human', true);
      let now = 1000;
      for (const key of clip.sequence) {
        runtime.update(unit, now, 1);
        const mesh = scene.children[team], uv = mesh.geometry.getAttribute('instanceAtlasRect');
        const frame = asset.frames.find(f => f.id === key.frameId), rect = frame.frameRectsPx[0].rectPx;
        assert.ok(Math.abs(uv.getX(0) - (rect.x + 0.5) / pack.pages[0].dimensionsPx.width) < 1e-7);
        assert.ok(uv.getX(0) < uv.getZ(0)); assert.ok(uv.getY(0) > uv.getW(0));
        const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3();
        mesh.getMatrixAt(0, matrix); matrix.decompose(position, rotation, scale);
        assert.ok(Math.abs(scale.x - rect.width * worldPerPixel) < 1e-6);
        assert.ok(Math.abs(scale.y - rect.height * worldPerPixel) < 1e-6);
        now += key.durationMs;
      }
    }
  } finally { globalThis.fetch = originalFetch; }
});
