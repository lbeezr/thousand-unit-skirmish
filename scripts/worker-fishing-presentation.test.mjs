import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
import { workerFishingPresentation } from '../src/worker-fishing-presentation.mjs';
import { shoreFishSitePositions } from '../src/shore-fishing-placement.mjs';
import { headingToTarget } from '../src/unit-heading.mjs';
import { activeState, normalizedDirection, spriteActionClip, spriteAnimationTime,
  createUnitSpriteRuntime } from '../src/unit-sprite-runtime.mjs';

const directions = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
const map = JSON.parse(readFileSync(new URL('../maps/shore-fishing.json', import.meta.url)));
const sites = shoreFishSitePositions(map);
const worker = (site, team = 0) => ({ id: team, team, slot: 0, hp: 100, kind: 'worker',
  x: site.land.x, z: site.land.z, renderX: site.land.x, renderZ: site.land.z,
  gatherPhase: 'gathering', gatherForestCell: -1, gatherNodeId: site.nodeId,
  task: 'gathering', cargo: 0, cargoType: 'food', attackStartedAt: 0, walking: false });
const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const server = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
const basePack = JSON.parse(readFileSync(new URL('../assets/units/cast-human-sprite-v3/sprite-atlas-pack-v1.json', import.meta.url)));

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
  const context = vm.createContext({ units: [unit], mapDefinition: { ...map, fogOfWar: true },
    resourceNodeStates: new Map(map.resourceNodes.map(n => [n.id, n])),
    headingToTarget, workerFishingPresentation, workerTaskStatus: u => u.gatherPhase === 'gathering' ? 'gathering' : 'idle',
    workerAudioExecution: () => 'food', cellToWorld: () => ({ x: 0, z: 0 }),
    cellVisibleToTeam: () => true, worldToCell: () => 0, tickNumber: 10, STATE_EVERY_TICKS: 3 });
  vm.runInContext(server.slice(server.indexOf('function snapshotUnits('), server.indexOf('function snapshotPersistentOrders(')), context);
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
  unit.task = 'repairing'; unit.workResourceVariant = 'shore-fish'; assert.equal(activeState(unit, 1500), 'repair');
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

// Optional private pilot path exercises its actual manifest without publishing
// candidate pixels in this repository. The normal CI run uses shipped art.
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
    const baseAsset = basePack.assets[0];
    assert.equal(worldPerPixel, baseAsset.heightWorld / Math.max(...baseAsset.frames.map(f => f.alphaBoundsPx.height)));
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
