import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
import { CAMERA_VIEW_DIRECTION } from '../src/camera-controls.mjs';
import { headingToTarget } from '../src/unit-heading.mjs';
import { workerFishingPresentation } from '../src/worker-fishing-presentation.mjs';
import { farmHarvestNode, farmBuildingId } from '../src/farm-harvest.mjs';
import { activeState, normalizedDirection, spriteActionClip, spriteAnimationTime,
  createUnitSpriteRuntime } from '../src/unit-sprite-runtime.mjs';

const directions = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
const pack = JSON.parse(readFileSync(new URL('../assets/units/cast-human-sprite-v3/sprite-atlas-pack-v1.json', import.meta.url)));
const asset = pack.assets[0];
const clips = new Map(asset.clips.map(c => [`${c.stateId}|${c.directionId}`, c]));
const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const server = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
const frameMotion = main.slice(main.indexOf('    const dx = unit.serverX - unit.renderX;'),
  main.indexOf('    const workAction = workerWorkAction(unit);', main.indexOf('    const dx = unit.serverX - unit.renderX;')));
function animate(unit, frameDelta = 1 / 60) {
  vm.runInNewContext(frameMotion, { unit, frameDelta, alpha: 1 - Math.exp(-frameDelta * 16),
    THREE, moved: false });
}
function villager() {
  return { kind: 'worker', hp: 100, task: 'idle', renderX: 0, renderZ: 0,
    serverX: 0, serverZ: 0, angle: 0, targetAngle: 0, workHeading: null,
    motionPhase: 0, walking: false, attackStartedAt: 0, performingAction: null };
}
const camera = new THREE.OrthographicCamera(-4, 4, 4, -4, 0.1, 100);
camera.position.set(...CAMERA_VIEW_DIRECTION).multiplyScalar(10);
camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true);

test('all eight world headings project to the intended fixed-camera screen directions', () => {
  const expectedSigns = [[-1,-1], [0,-1], [1,-1], [1,0], [1,1], [0,1], [-1,1], [-1,0]];
  const sign = x => Math.abs(x) < 1e-10 ? 0 : Math.sign(x);
  for (const [index, direction] of directions.entries()) {
    const angle = index * Math.PI / 4;
    const point = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle)).project(camera);
    assert.deepEqual([sign(point.x), sign(point.y)], expectedSigns[index], direction);
    for (const wrap of [-4, -2, 0, 2, 4]) assert.equal(normalizedDirection(angle + wrap * Math.PI), direction);
    const unit = villager(); unit.serverX = Math.sin(angle); unit.serverZ = Math.cos(angle);
    for (let frame = 0; frame < 20; frame++) animate(unit);
    assert.equal(normalizedDirection(unit.angle), direction, `interpolated ${direction}`);
  }
  assert.equal(normalizedDirection(-Math.PI / 4), 'north-west', 'screen-left');
  assert.equal(normalizedDirection(3 * Math.PI / 4), 'south-east', 'screen-right');
  assert.equal(normalizedDirection(5 * Math.PI / 4), 'south-west', 'screen-up');
  assert.equal(normalizedDirection(Math.PI / 4), 'north-east', 'screen-down');
  assert.equal(normalizedDirection(Math.PI / 8 - 1e-8), 'north');
  assert.equal(normalizedDirection(Math.PI / 8 + 1e-8), 'north-east');
});

test('actual Human walk and berry clips keep every heading, with honest idle holds', () => {
  for (const [state, authored] of [['walk', ['north','north-east','east','south-east','south','south-west','west','north-west']], ['gather', ['south-east', 'north-west', 'east', 'north']]]) {
    for (const direction of directions) {
      const clip = spriteActionClip(clips, state, direction, 'food', 'human', true);
      assert.equal(clip.directionId, direction);
      assert.ok(clip.sequence.every(f => f.frameId.startsWith(
        `${authored.includes(direction) ? state === 'gather' ? 'gather-food' : state : 'idle'}-${direction}-`)));
      if (authored.includes(direction)) assert.equal(clip.sequence.length, state === 'gather' && direction !== 'south-east' ? 3 : 8);
      else assert.equal(clip.sequence.length, 1);
    }
  }
});

test('arrival turns toward left/right berries, Stop retains heading, and jitter cannot reset it', () => {
  for (const target of [[-1,1], [1,-1]]) {
    const unit = villager(); unit.task = 'gathering'; unit.cargoType = 'food'; unit.performingAction = 'gather-food';
    unit.serverX = 0.6; unit.workHeading = headingToTarget(0.6, 0, ...target);
    animate(unit);
    assert.equal(activeState(unit, 1000), 'walk', 'travel suppresses work');
    assert.equal(unit.targetAngle, Math.PI / 2, 'movement uses interpolation displacement');
    spriteAnimationTime(unit, 'walk', 1000);
    unit.renderX = unit.serverX;
    for (let frame = 0; frame < 30; frame++) animate(unit);
    assert.equal(unit.walking, false);
    assert.equal(unit.angle, unit.workHeading, 'arrival faces actual resource instead of last path segment');
    assert.equal(activeState(unit, 1500), 'gather');
    assert.equal(spriteAnimationTime(unit, 'gather', 1500), 0);
    assert.equal(spriteAnimationTime(unit, 'gather', 1600), 100, 'default elapsed clock preserved');
    const heading = unit.angle;
    unit.workHeading = null; unit.task = 'idle';
    unit.serverX += 0.0005; unit.serverZ += 0.0005;
    animate(unit);
    assert.equal(unit.walking, false); assert.equal(unit.angle, heading);
    assert.equal(headingToTarget(0, 0, 0.0005, -0.0005), null);
  }
});

test('queued path turns use current displacement and attack heading wins over retained work', () => {
  const unit = villager(); unit.task = 'gathering'; unit.workHeading = -Math.PI / 4;
  for (const [x,z,direction] of [[1,-1,'south-east'], [-1,-1,'south-west'], [-1,1,'north-west']]) {
    unit.serverX = unit.renderX + x; unit.serverZ = unit.renderZ + z;
    for (let frame = 0; frame < 24; frame++) animate(unit);
    assert.equal(normalizedDirection(unit.angle), direction);
  }
  unit.renderX = unit.serverX; unit.renderZ = unit.serverZ;
  unit.attackStartedAt = 1000; unit.targetAngle = Math.PI / 2;
  for (let frame = 0; frame < 30; frame++) animate(unit);
  assert.equal(unit.angle, Math.PI / 2);
  unit.attackStartedAt = 0;
  for (let frame = 0; frame < 30; frame++) animate(unit);
  assert.equal(unit.angle, unit.workHeading);
});

test('snapshot work heading comes from actual gathering target and preserves fog and row offsets', () => {
  const worker = {...villager(), id:0, team:0, x:0, z:0, cargo:0, generation:1,
    gatherPhase:'gathering', gatherForestCell:-1, gatherNodeId:'berries', attackTargetId:-1};
  const node = {id:'berries',type:'food',x:-1,z:1};
  const context = vm.createContext({ workerPerformingAction: () => null, units:[worker], mapDefinition:{fogOfWar:true,resourceNodes:[node]},
    resourceNodeStates:new Map([['berries',node]]),buildingsById:new Map(),farmHarvestNode,farmBuildingId,headingToTarget,workerFishingPresentation,
    workerTaskStatus:()=> 'gathering', cellToWorld:()=>({x:1,z:-1}), cellVisibleToTeam:()=>true,
    worldToCell:()=>0, tickNumber:10, STATE_EVERY_TICKS:3 });
  vm.runInContext(server.slice(server.indexOf('function harvestNodeById('),server.indexOf('function routeWorker(')),context);
  vm.runInContext(server.slice(server.indexOf('function snapshotUnits('), server.indexOf('function snapshotPersistentOrders(')), context);
  for (const team of [0,1]) {
    worker.team = team;
    for (let index = 0; index < 8; index++) {
      node.x = Math.sin(index * Math.PI / 4); node.z = Math.cos(index * Math.PI / 4);
      const row = context.snapshotUnits(team)[0];
      assert.equal(normalizedDirection(row[15]), directions[index]);
      assert.equal(row[14], 'food');
      assert.equal(context.snapshotUnits(1-team)[0][15], undefined, 'enemy work stays private under fog');
    }
    worker.lastAttackTick = 10; worker.lastAttackX = 7; worker.lastAttackZ = 8;
    const row = context.snapshotUnits(team)[0];
    assert.deepEqual(Array.from(row.slice(11,15)), [10,7,8,'food']);
    worker.gatherForestCell = 7;
    assert.equal(context.snapshotUnits(team)[0][15], 3 * Math.PI / 4, 'forest uses its authoritative cell');
    worker.gatherForestCell = -1;
    for (const phase of ['to-node','to-base','']) {
      worker.gatherPhase = phase;
      assert.equal(context.snapshotUnits(team)[0][15], undefined, phase);
    }
    worker.gatherPhase = 'gathering'; node.x = 0.0005; node.z = 0.0005;
    assert.equal(context.snapshotUnits(team)[0][15], undefined, 'coincident target retains heading');
    node.x = -1; node.z = 1;
    worker.hp = 0; assert.equal(context.snapshotUnits(team)[0][15], undefined);
    worker.hp = 100;
    context.mapDefinition.fogOfWar = false;
    assert.equal(context.snapshotUnits(null)[0][15], -Math.PI / 4, 'shared no-fog roster');
    context.mapDefinition.fogOfWar = true;
    context.cellVisibleToTeam = () => false;
    assert.equal(context.snapshotUnits(1-team).length, 0, 'hidden enemies remain omitted');
    context.cellVisibleToTeam = () => true;
  }
});

test('client snapshots replace and clear work headings, including zero and legacy rows', () => {
  const readHeading = main.slice(main.indexOf('    unit.workHeading ='), main.indexOf('\n', main.indexOf('    unit.workHeading =')));
  const unit = villager();
  for (const [workHeading,expected] of [[-Math.PI/4,-Math.PI/4],[0,0],[undefined,null],[null,null],[NaN,null]]) {
    vm.runInNewContext(readHeading, {unit,workHeading});
    assert.equal(unit.workHeading,expected);
  }
});

test('runtime samples exact atlas rectangles without horizontal mirroring or timing changes', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ok:true,json:async()=>pack});
  class TextureLoader {
    load(url,onLoad) { const texture = new THREE.Texture(); queueMicrotask(()=>onLoad(texture)); return texture; }
  }
  try {
    const scene = new THREE.Scene();
    const runtime = createUnitSpriteRuntime({THREE:{...THREE,TextureLoader},scene,capacity:1,
      teamHex:[0x5aa7d7,0xe67a5e],cameraQuaternion:camera.quaternion,roles:['human'],
      roleSpriteVersions:{human:'v3'},humanAppearancePreview:true,approximateActionDirections:true});
    assert.equal(await runtime.ready,true);
    for (const team of [0,1]) for (const state of ['walk','gather']) for (const [index,direction] of directions.entries()) {
      const unit = {...villager(),team,slot:0,angle:index*Math.PI/4,walking:state==='walk',task:'gathering',cargoType:'food',
        performingAction:'gather-food'};
      runtime.update(unit,1000,1);
      const mesh = scene.children[team];
      const rect = mesh.geometry.getAttribute('instanceAtlasRect');
      const clip = spriteActionClip(clips,state,direction,'food','human',true);
      const frame = asset.frames.find(f=>f.id===clip.sequence[0].frameId);
      const r = frame.fallbackRectPx.rectPx; const page = pack.pages[0];
      assert.ok(Math.abs(rect.getX(0)-(r.x+0.5)/page.dimensionsPx.width)<1e-7);
      assert.ok(Math.abs(rect.getZ(0)-(r.x+r.width-0.5)/page.dimensionsPx.width)<1e-7);
      assert.ok(rect.getX(0)<rect.getZ(0), 'horizontal sampling order remains unmirrored');
      assert.ok(rect.getY(0)>rect.getW(0), 'top-down atlas Y handled once');
      const matrix = new THREE.Matrix4(); mesh.getMatrixAt(0,matrix);
      const rotation = new THREE.Quaternion(); matrix.decompose(new THREE.Vector3(),rotation,new THREE.Vector3());
      assert.ok(Math.abs(rotation.dot(camera.quaternion))>0.999999, 'quad faces the actual camera');
      runtime.update(unit,1150,1);
      assert.equal(spriteAnimationTime(unit,state,1150),150);
    }
  } finally { globalThis.fetch = originalFetch; }
});
