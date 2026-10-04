import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { normalRoster } from './audit-asset-adoption.mjs';
import { decodeRgba8, assertFrameUnclipped } from './sprite-pixel-bounds.mjs';
import { createUnitSpriteRuntime, spriteActionClip, spriteClipDuration, spriteGroundDepthBias } from '../src/unit-sprite-runtime.mjs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url));
const directions = ['north','north-east','east','south-east','south','south-west','west','north-west'];
const roster = normalRoster(read('src/main.js').toString());
const roles = ['infantry', 'archer', 'spearman'];

for (const role of roles) {
  const directory = `assets/units/${role}-sprite-${roster.unitSpritePreviewVersions[role]}`;
  const pack = JSON.parse(read(`${directory}/sprite-atlas-pack-v1.json`));
  const asset = pack.assets[0], page = pack.pages[0];
  const image = decodeRgba8(read(`${directory}/${role}-atlas-runtime.png`));
  const clips = new Map(asset.clips.map(c => [`${c.stateId}|${c.directionId}`, c]));
  test(`${role}: real unclipped directional artwork, one pivot, retained public provenance`, () => {
    const registration = JSON.parse(read(`${directory}/${role==='spearman'?'capture':'registration'}.json`));
    assert.equal(createHash('sha256').update(read(registration.sourcePath)).digest('hex'), registration.sourceSha256);
    if(role==='spearman') {
      assert.equal(registration.reusedSpriteFrames,0);assert.equal(registration.newlyRenderedFrames,96);
      assert.equal(registration.newlyAuthoredPoseSamples,12);assert.equal(registration.mirroredFrames,0);
      assert.equal(registration.providerJobs,0);assert.equal(registration.charges,0);
      assert.equal(new Set(registration.samples.map(s=>s.yawRadians)).size,8);
      assert.equal(asset.frames.length,96);
      for(const count of Object.values(registration.limbVertexCounts)) assert.ok(count>0,'actual separate leg/arm articulation');
      for(const m of registration.measurements) assert.equal(createHash('sha256').update(read(`${directory}/${m.file}`)).digest('hex'),m.sha256);
      const half=registration.orthographicScale/2;
      const camera=new THREE.OrthographicCamera(-half,half,half,-half,.1,100);
      const target=new THREE.Vector3(0,.4,0);
      camera.position.copy(target).add(new THREE.Vector3(.78,1.12,.78).normalize().multiplyScalar(8));
      camera.lookAt(target);camera.updateMatrixWorld(true);
      const origin=new THREE.Vector3().project(camera);
      assert.ok(Math.abs((origin.x+1)*128-registration.rootPx[0])<.001);
      assert.ok(Math.abs((1-origin.y)*128-registration.rootPx[1])<.001,'actual fixed-camera root projection');
      const up=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion);
      const toward=new THREE.Vector3(0,0,1).applyQuaternion(camera.quaternion);
      for(const frame of asset.frames) {
        const box=frame.alphaBoundsPx,pivot=frame.groundPivotPx,scale=registration.sharedWorldPerPixel;
        const bias=spriteGroundDepthBias(box,pivot,scale,up.y,toward.y);
        const bottom=.018+(pivot.y-box.y-box.height)*scale*up.y+bias*toward.y;
        assert.ok(bottom>=.018-1e-10,`${frame.id}: geometric depth correction clears terrain`);
      }
    } else {
      assert.equal(registration.reusedUniquePoses, 48);
      for (const key of ['newlyAuthoredPoses','interpolatedPoses','mirroredPoses']) assert.equal(registration[key],0);
      assert.equal(new Set(registration.sourceColumnsInRuntimeOrder).size,8);
      assert.equal(asset.frames.length,48);
    }
    for (const frame of asset.frames) {
      assertFrameUnclipped(image,frame,4,role==='spearman');
      const pivot=role==='spearman'?{x:registration.rootPx[0],y:registration.rootPx[1]}:{x:160,y:308};
      assert.deepEqual(frame.groundPivotPx,pivot);
    }
    for (const state of ['idle','walk','attack','defeat']) {
      const firstPoses = new Set();
      for (const direction of directions) {
        const clip = spriteActionClip(clips,state,direction,null,role,true);
        assert.equal(clip.directionId,direction,'default approximation must resolve this actual heading');
        assert.equal(clip.loop,['walk','idle'].includes(state));
        assert.equal(clip.sequence.length,role==='spearman'?{idle:1,walk:4,attack:3,defeat:4}[state]:state==='idle'?1:2);
        const keyHashes=new Set(clip.sequence.map(({frameId})=>{
          const r=asset.frames.find(f=>f.id===frameId).fallbackRectPx.rectPx;
          const pixels=[];
          for(let y=r.y;y<r.y+r.height;y++)pixels.push(Buffer.from(image.pixels.subarray((y*image.width+r.x)*4,(y*image.width+r.x+r.width)*4)));
          return createHash('sha256').update(Buffer.concat(pixels)).digest('hex');
        }));
        assert.equal(keyHashes.size,clip.sequence.length,`${state}/${direction}: actual motion keys must differ`);
        const frameId = clip.sequence[state==='defeat'?clip.sequence.length-1:0].frameId;
        const frame = asset.frames.find(f=>f.id===frameId), r = frame.fallbackRectPx.rectPx;
        const pixels = [];
        for(let y=r.y;y<r.y+r.height;y++) pixels.push(Buffer.from(image.pixels.subarray((y*image.width+r.x)*4,(y*image.width+r.x+r.width)*4)));
        firstPoses.add(createHash('sha256').update(Buffer.concat(pixels)).digest('hex'));
        assert.equal(spriteClipDuration(clip),{idle:1000,walk:800,attack:role==='infantry'?850:role==='spearman'?880:1000,defeat:role==='spearman'?1080:850}[state]);
      }
      assert.equal(firstPoses.size,8,`${state}: no copy-labelled facings`);
    }
  });

  test(`${role}: both teams advance exact-heading keys, loop walks, clamp defeat and resume`, async () => {
    const previousFetch = globalThis.fetch;
    globalThis.fetch = async url => ({ok:true,json:async()=>JSON.parse(read(url.slice(1)))});
    class TextureLoader { load(_url,done) {const texture=new THREE.Texture(); queueMicrotask(()=>done(texture)); return texture;} }
    try {
      const scene = new THREE.Scene();
      const runtime = createUnitSpriteRuntime({THREE:{...THREE,TextureLoader},scene,capacity:1,
        teamHex:[0x5aa7d7,0xe67a5e],cameraQuaternion:new THREE.Quaternion(),roles:[role],
        roleSpriteVersions:{[role]:roster.unitSpritePreviewVersions[role]},approximateActionDirections:true});
      assert.equal(await runtime.ready,true); runtime.setCount(0,1);runtime.setCount(1,1);runtime.setVisible(true);
      const assertUv = (unit,frameId) => {
        const frame = asset.frames.find(f=>f.id===frameId); const r = frame.frameRectsPx[0].rectPx;
        assert.deepEqual(Array.from(scene.children[unit.team].geometry.attributes.instanceAtlasRect.array),
          Array.from(new Float32Array([(r.x+.5)/page.dimensionsPx.width,(r.y+r.height-.5)/page.dimensionsPx.height,
            (r.x+r.width-.5)/page.dimensionsPx.width,(r.y+.5)/page.dimensionsPx.height])),frameId);
      };
      for(const team of [0,1]) for(const selected of [false,true]) for(const [index,direction] of directions.entries()) {
        const unit={id:team,team,slot:0,kind:role,hp:100,task:'idle',angle:index*Math.PI/4,renderX:0,renderZ:0,selected};
        runtime.update(unit,1000,1);assertUv(unit,`idle-${direction}-0`);
        unit.walking=true;runtime.update(unit,1100,1);assertUv(unit,`walk-${direction}-0`);
        const walk=clips.get(`walk|${direction}`),attack=clips.get(`attack|${direction}`),defeat=clips.get(`defeat|${direction}`);
        runtime.update(unit,1100+walk.sequence[0].durationMs,1);assertUv(unit,`walk-${direction}-1`);
        runtime.update(unit,1900,1);assertUv(unit,`walk-${direction}-0`);
        unit.walking=false;unit.attackStartedAt=2000;
        runtime.update(unit,2000,1);assertUv(unit,`attack-${direction}-0`);
        runtime.update(unit,2000+attack.sequence[0].durationMs,1);assertUv(unit,`attack-${direction}-1`);
        runtime.update(unit,2000+runtime.durationMs(role,'attack'),1);assertUv(unit,`idle-${direction}-0`);
        unit.attackStartedAt=4000;runtime.update(unit,4000,1);assertUv(unit,`attack-${direction}-0`);
        unit.hp=0;unit.defeatStartedAt=5000;runtime.update(unit,5000,1);assertUv(unit,defeat.sequence[0].frameId);
        const terminalAt=5000+defeat.sequence.slice(0,-1).reduce((sum,key)=>sum+key.durationMs,0);
        runtime.update(unit,terminalAt,1);assertUv(unit,defeat.sequence.at(-1).frameId);
        runtime.update(unit,8000,1);assertUv(unit,defeat.sequence.at(-1).frameId);
        unit.hp=100;unit.defeatStartedAt=0;unit.attackStartedAt=0;unit.walking=true;
        runtime.update(unit,9000,1);assertUv(unit,`walk-${direction}-0`);
      }
    } finally {globalThis.fetch=previousFetch;}
  });
}
