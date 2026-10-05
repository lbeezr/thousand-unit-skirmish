import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {decodeRgba8,assertFrameUnclipped} from './sprite-pixel-bounds.mjs';
import {analyzeUnitArtCoverage,decodeRegisteredUnitFrames} from './unit-art-production-contract.mjs';
import {createUnitSpriteRuntime,spriteActionProvenance,spriteGroundDepthBias} from '../src/unit-sprite-runtime.mjs';

const read=p=>readFileSync(new URL(`../${p}`,import.meta.url));
const sha=x=>createHash('sha256').update(x).digest('hex');
const source='docs/art-direction/human-roster-v1/extracted/spearman/attack/south-local-v1';
const receipt=JSON.parse(read(`${source}/registration.json`));
const dir='assets/units/spearman-sprite-v1';
const pack=JSON.parse(read(`${dir}/sprite-atlas-pack-v1.json`)),asset=pack.assets[0],page=pack.pages[0];
const pixels=decodeRgba8(read(`${dir}/spearman-atlas-runtime.png`));
const cells=decodeRegisteredUnitFrames(asset,page,pixels);
const ownIds=new Set(['attack-south-0','attack-south-1','attack-south-2']);

test('South attack preserves all 69 prior complete frame records, pixels, 31 other clips and calibration',()=>{
  const prior=asset.frames.filter(f=>!ownIds.has(f.id)&&!/^attack-south-west-\d+$/.test(f.id));
  assert.equal(prior.length,69);assert.equal(asset.frames.length,75);
  assert.equal(sha(JSON.stringify(prior.map(f=>({frame:f,rgba:cells[f.id].rgba,alpha:cells[f.id].alpha})))),receipt.baselineRegisteredPoseSHA256);
  const unchanged=asset.clips.filter(c=>!(c.stateId==='attack'&&['south','south-west'].includes(c.directionId)));
  assert.equal(unchanged.length,30);assert.equal(sha(JSON.stringify(unchanged)),'97f0a62368dd0bec67e86ea24ffa9ba84e34d1b600b779302e70c1a02ade3688');
  const {frames,clips,...metadata}=asset;
  assert.equal(sha(JSON.stringify(metadata)),receipt.registeredAssetMetadataSHA256);
  const baseline={...metadata,artBoundsWorld:receipt.baselineBounds.artBoundsWorld,cullingBoundsWorld:receipt.baselineBounds.cullingBoundsWorld};
  assert.equal(sha(JSON.stringify(baseline)),receipt.baselineAssetMetadataSHA256);
  assert.equal(asset.heightWorld/Math.max(...frames.map(f=>f.alphaBoundsPx.height)),receipt.worldPerPixel);
  assert.equal(sha(read(receipt.identitySource.path)),receipt.identitySource.sha256);
  assert.equal(receipt.reusedPriorRegisteredPoses,69);assert.equal(receipt.reusedOpeningPoses,1);assert.equal(receipt.newlyAuthoredPoses,3);
  for(const key of ['mirroredPoses','borrowedDirectionPoses','generationProviderCalls','paidJobs'])assert.equal(receipt[key],0);
});

test('South attack reuses its exact idle key then plays three own-view keys with an explicit 880 ms cadence',()=>{
  const clip=asset.clips.find(c=>c.stateId==='attack'&&c.directionId==='south');
  assert.equal(clip.loop,false);assert.deepEqual(clip.sequence,receipt.sequence);
  assert.deepEqual(clip.sequence.map(k=>k.durationMs),[120,200,160,400]);
  assert.equal(clip.sequence[0].frameId,'idle-south-0');
  for(let index=0;index<3;index++){
    const input=receipt.poses[index],frame=asset.frames.find(f=>f.id===`attack-south-${index}`);
    assert.equal(sha(read(`${source}/${input.file}`)),input.sha256);
    assert.deepEqual(frame.canvasPx,{width:416,height:352});assert.deepEqual(frame.groundPivotPx,{x:212,y:309});
    assertFrameUnclipped(pixels,frame,4,true);
    const original=decodeRgba8(read(`${source}/${input.file}`)),r=frame.frameRectsPx[0].rectPx;
    for(let y=0;y<352;y++)assert.deepEqual(pixels.pixels.subarray(((r.y+y)*pixels.width+r.x)*4,((r.y+y)*pixels.width+r.x+416)*4),original.pixels.subarray(y*416*4,(y+1)*416*4));
  }
  const report=analyzeUnitArtCoverage(asset,cells),row=report.rows.find(r=>r.key==='attack|south');
  assert.deepEqual(report.errors,[]);assert.equal(report.missingCells.length,9);
  assert.equal(row.status,'authored');assert.equal(row.distinctFrames,4);assert.equal(row.distinctSilhouettes,4);
  assert.ok(!report.missingCells.some(c=>c.startsWith('walk|')));assert.ok(report.missingCells.includes('defeat|south'));
  const frozen=structuredClone(asset);frozen.clips.find(c=>c.stateId==='attack'&&c.directionId==='south').sequence.forEach(k=>{k.frameId='idle-south-0';});
  assert.equal(analyzeUnitArtCoverage(frozen,cells).rows.find(r=>r.key==='attack|south').status,'idle-fallback');
  const selection=spriteActionProvenance(new Map(asset.clips.map(c=>[`${c.stateId}|${c.directionId}`,c])),'attack','south',null,'spearman',true);
  assert.equal(selection.reason,'exact');assert.equal(selection.selectedDirection,'south');
});

test('South attack preserves the complete old page and extends only reviewed right-column cells',()=>{
  assert.deepEqual(page.dimensionsPx,{width:2560,height:3968});
  assert.deepEqual(receipt.atlasSlotsPx,[[2052,4],[2052,364],[2052,724]]);
  assert.deepEqual(receipt.baselineDimensionsPx,{width:2048,height:3968});
  assert.deepEqual(receipt.registeredDimensionsPx,page.dimensionsPx);
  const prefix=Buffer.alloc(2048*3968*4),extension=Buffer.alloc(512*3968*4);
  for(let row=0;row<3968;row++){
    prefix.set(pixels.pixels.subarray(row*2560*4,(row*2560+2048)*4),row*2048*4);
    extension.set(pixels.pixels.subarray((row*2560+2048)*4,(row+1)*2560*4),row*512*4);
  }
  assert.equal(sha(prefix),receipt.baselineDecodedAtlasSHA256,'every old page byte, including unused space, stays exact');
  for(const [x,y] of receipt.atlasSlotsPx)for(let row=y;row<y+352;row++)extension.fill(0,(row*512+x-2048)*4,(row*512+x-2048+416)*4);
  for(const [x,y] of [[2052,1084],[2052,1516],[2052,1948]])for(let row=y;row<y+416;row++)extension.fill(0,(row*512+x-2048)*4,(row*512+x-2048+416)*4);
  assert.equal(sha(extension),sha(Buffer.alloc(512*3968*4)),'all other new-column pixels are zero');
  assert.equal(sha(read(`${dir}/team-accent-mask.png`)),receipt.registeredMaskSHA256);
  assert.notEqual(receipt.registeredMaskSHA256,receipt.baselineMaskSHA256);
  assert.equal(sha(JSON.stringify(page)),receipt.registeredPageMetadataSHA256);
  assert.equal(sha(read(`${dir}/spearman-atlas-source.png`)),sha(read(`${dir}/spearman-atlas-runtime.png`)));
});

test('South attack preserves inherited pivot and camera depth correction for its rooted billboard',()=>{
  const idle=asset.frames.find(f=>f.id==='idle-south-0');
  assert.deepEqual(receipt.groundPivotPx,{x:idle.groundPivotPx.x+80,y:idle.groundPivotPx.y+24});
  const camera=new THREE.PerspectiveCamera();camera.position.set(.78,1.12,.78);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
  const right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion),up=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion),toward=new THREE.Vector3(0,0,1).applyQuaternion(camera.quaternion);
  for(const f of asset.frames){
    const b=f.alphaBoundsPx,p=f.groundPivotPx,scale=receipt.worldPerPixel,bias=spriteGroundDepthBias(b,p,scale,up.y,toward.y);
    for(const x of [b.x,b.x+b.width])for(const y of [b.y,b.y+b.height]){
      const point=new THREE.Vector3(0,.018,0).addScaledVector(right,(x-p.x)*scale).addScaledVector(up,(p.y-y)*scale).addScaledVector(toward,bias);
      assert.ok(point.y>=.018-1e-10);
      for(const bounds of [asset.artBoundsWorld,asset.cullingBoundsWorld])for(let axis=0;axis<3;axis++)
        assert.ok(point.getComponent(axis)>=bounds.min[axis]-1e-10&&point.getComponent(axis)<=bounds.max[axis]+1e-10,'extended thrust stays in the exported bounds');
    }
  }
});

test('default runtime advances South ready/thrust/recovery once, returns to idle/walk and resets a fresh hit for both teams',async()=>{
  const previousFetch=globalThis.fetch,urls=[];
  globalThis.fetch=async url=>{urls.push(url);return{ok:true,json:async()=>JSON.parse(read(url.slice(1)))}};
  class TextureLoader{load(_url,done){const texture=new THREE.Texture();queueMicrotask(()=>done(texture));return texture;}}
  try{
    const scene=new THREE.Scene(),runtime=createUnitSpriteRuntime({THREE:{...THREE,TextureLoader},scene,capacity:1,teamHex:[0x5aa7d7,0xe67a5e],cameraQuaternion:new THREE.Quaternion(),roles:['spearman'],approximateActionDirections:true});
    assert.equal(await runtime.ready,true);assert.deepEqual(urls,['/assets/units/spearman-sprite-v1/sprite-atlas-pack-v1.json']);
    assert.equal(runtime.durationMs('spearman','attack'),880);runtime.setCount(0,1);runtime.setCount(1,1);runtime.setVisible(true);
    const uv=(u,id)=>{const f=asset.frames.find(f=>f.id===id),r=f.frameRectsPx[0].rectPx,i=page.sampling.uvInsetPx;
      assert.deepEqual(Array.from(scene.children[u.team].geometry.attributes.instanceAtlasRect.array),Array.from(new Float32Array([(r.x+i)/page.dimensionsPx.width,(r.y+r.height-i)/page.dimensionsPx.height,(r.x+r.width-i)/page.dimensionsPx.width,(r.y+i)/page.dimensionsPx.height])));};
    for(const team of [0,1])for(const selected of [false,true]){
      const u={id:team,team,slot:0,kind:'spearman',hp:100,task:'idle',angle:Math.PI,renderX:0,renderZ:0,selected,attackStartedAt:1000};
      for(const [at,id] of [[1000,'idle-south-0'],[1120,'attack-south-0'],[1320,'attack-south-1'],[1480,'attack-south-2'],[1879,'attack-south-2'],[1880,'idle-south-0']]){runtime.update(u,at,1);uv(u,id);}
      u.attackStartedAt=3000;runtime.update(u,3000,1);uv(u,'idle-south-0');runtime.update(u,3320,1);uv(u,'attack-south-1');
      u.attackStartedAt=3340;runtime.update(u,3340,1);uv(u,'idle-south-0');runtime.update(u,3460,1);uv(u,'attack-south-0');
      u.walking=true;runtime.update(u,4220,1);uv(u,'walk-south-0');u.walking=false;runtime.update(u,4300,1);uv(u,'idle-south-0');
    }
  }finally{globalThis.fetch=previousFetch;}
});
