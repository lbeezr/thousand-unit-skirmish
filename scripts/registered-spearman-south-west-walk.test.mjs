import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {decodeRgba8,assertFrameUnclipped} from './sprite-pixel-bounds.mjs';
import {analyzeUnitArtCoverage,decodeRegisteredUnitFrames} from './unit-art-production-contract.mjs';
import {createUnitSpriteRuntime,spriteGroundDepthBias} from '../src/unit-sprite-runtime.mjs';
import {missingWalkDirections} from './renderer-worker-animation-scenario.mjs';

const read=p=>readFileSync(new URL(`../${p}`,import.meta.url));
const sha=x=>createHash('sha256').update(x).digest('hex');
const source='docs/art-direction/human-roster-v1/extracted/spearman/walk/south-west-local-v1';
const receipt=JSON.parse(read(`${source}/registration.json`));
const directory='assets/units/spearman-sprite-v1';
const pack=JSON.parse(read(`${directory}/sprite-atlas-pack-v1.json`)),asset=pack.assets[0],page=pack.pages[0];
const pixels=decodeRgba8(read(`${directory}/spearman-atlas-runtime.png`));
const cells=decodeRegisteredUnitFrames(asset,page,pixels);
// Remove only the later North attack's three independently pinned former empty cells.
const historicalPixels=Buffer.alloc(2048*pixels.height*4);
for(let row=0;row<pixels.height;row++)historicalPixels.set(pixels.pixels.subarray(row*pixels.width*4,(row*pixels.width+2048)*4),row*2048*4);
for(const [x,y] of [[1316,2772],[1316,3204],[1316,3588]])for(let row=y;row<y+352;row++)historicalPixels.fill(0,(row*2048+x)*4,(row*2048+x+416)*4);

test('Spearman Southwest preserves all 48 prior registered poses, clips and body calibration',()=>{
  const laterIds=new Set(["walk-south-west-0","walk-south-west-1","walk-south-west-2","walk-south-west-3","walk-west-0","walk-west-1","walk-west-2","walk-west-3","walk-north-west-0","walk-north-west-1","walk-north-west-2","walk-north-west-3"]);
  const legacy=asset.frames.filter(f=>!laterIds.has(f.id)&&!/^attack-(?:north-east|east|north|south|south-west)-\d+$/.test(f.id));
  assert.equal(legacy.length,48);assert.equal(asset.frames.length,75);
  assert.equal(sha(JSON.stringify(legacy.map(f=>({frame:f,rgba:cells[f.id].rgba,alpha:cells[f.id].alpha})))),receipt.baselineRegisteredPoseSHA256);
  // Pin actual retained clips; later own-view replacements are separately checked.
  const unchanged=asset.clips.filter(c=>!(c.stateId==='attack'&&['north-east','east','north','south','south-west'].includes(c.directionId))&&!(c.stateId==='walk'&&["south-west","west","north-west"].includes(c.directionId)));
  assert.equal(asset.clips.length,32);assert.equal(unchanged.length,24);assert.equal(sha(JSON.stringify(unchanged)),'fad51d3b89098b90a908a5b0c1870b9830ec37ab13fcae7daf29480cdbd2c3b0');
  assert.equal(asset.heightWorld/Math.max(...asset.frames.map(f=>f.alphaBoundsPx.height)),receipt.worldPerPixel);
  assert.equal(asset.heightWorld,receipt.heightWorld);
  assert.equal(sha(read(receipt.identitySource.path)),receipt.identitySource.sha256);
  assert.equal(receipt.newlyAuthoredPoses,4);assert.equal(receipt.reusedPriorRegisteredPoses,48);
  for(const key of ['mirroredPoses','borrowedDirectionPoses','generationProviderCalls','paidJobs'])assert.equal(receipt[key],0);
});

test('Spearman Southwest contains four exact source poses and leaves the other 9 cells incomplete',()=>{
  const clip=asset.clips.find(c=>c.stateId==='walk'&&c.directionId==='south-west');
  assert.equal(clip.loop,true);assert.equal(clip.sequence.reduce((n,k)=>n+k.durationMs,0),800);
  for(let index=0;index<4;index++){
    const key=clip.sequence[index],frame=asset.frames.find(f=>f.id===key.frameId),input=receipt.poses[index];
    assert.equal(key.frameId,`walk-south-west-${index}`);assert.equal(key.durationMs,200);
    assert.equal(sha(read(`${source}/${input.file}`)),input.sha256);
    assert.deepEqual(frame.canvasPx,receipt.canvasPx);assert.deepEqual(frame.groundPivotPx,receipt.groundPivotPx);
    // Retain the original provisional Southwest pivot. Existing depth correction
    // handles below-pivot artwork; anatomical support-foot review stays open.
    assertFrameUnclipped(pixels,frame,4,true);
    const original=decodeRgba8(read(`${source}/${input.file}`)),r=frame.frameRectsPx[0].rectPx;
    for(let y=0;y<352;y++)assert.deepEqual(pixels.pixels.subarray(((r.y+y)*pixels.width+r.x)*4,((r.y+y)*pixels.width+r.x+320)*4),original.pixels.subarray(y*320*4,(y+1)*320*4));
  }
  const report=analyzeUnitArtCoverage(asset,cells);
  assert.deepEqual(report.errors,[]);assert.equal(report.missingCells.length,9);
  const ne=report.rows.find(r=>r.key==='walk|south-west');assert.equal(ne.status,'authored');assert.equal(ne.distinctFrames,4);assert.equal(ne.distinctSilhouettes,4);
  assert.deepEqual(missingWalkDirections({pack,cells}),[]);
  assert.equal(report.rows.find(r=>r.key==='attack|south-west').status,'authored');assert.ok(report.missingCells.includes('defeat|south-west'));
  const frozen=structuredClone(asset),walk=frozen.clips.find(c=>c.stateId==='walk'&&c.directionId==='south-west');
  walk.sequence.forEach(k=>{k.frameId=walk.sequence[0].frameId;});
  assert.equal(analyzeUnitArtCoverage(frozen,cells).rows.find(r=>r.key==='walk|south-west').status,'static-action');
});

test('Southwest padded pivot keeps the inherited root and existing real-camera depth correction',()=>{
  const idle=asset.frames.find(f=>f.id==='idle-south-west-0');
  assert.deepEqual(receipt.groundPivotPx,{x:idle.groundPivotPx.x+44,y:idle.groundPivotPx.y+24});
  const camera=new THREE.PerspectiveCamera();camera.position.set(.78,1.12,.78);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
  const right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion),up=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion),toward=new THREE.Vector3(0,0,1).applyQuaternion(camera.quaternion);
  for(const f of asset.frames.filter(f=>/^walk-south-west-\d+$/.test(f.id))){
    const b=f.alphaBoundsPx,p=f.groundPivotPx,scale=receipt.worldPerPixel;
    const bias=spriteGroundDepthBias(b,p,scale,up.y,toward.y);
    for(const x of [b.x,b.x+b.width])for(const y of [b.y,b.y+b.height]){
      const point=new THREE.Vector3(0,.018,0).addScaledVector(right,(x-p.x)*scale).addScaledVector(up,(p.y-y)*scale).addScaledVector(toward,bias);
      assert.ok(point.y>=.018-1e-10,'registered artwork uses the existing correction above terrain');
    }
  }
});

test('real Spearman runtime advances Southwest keys, loops, stops and resumes for both teams and selection states',async()=>{
  const previousFetch=globalThis.fetch;
  globalThis.fetch=async url=>({ok:true,json:async()=>JSON.parse(read(url.slice(1)))});
  class TextureLoader{load(_url,done){const texture=new THREE.Texture();queueMicrotask(()=>done(texture));return texture;}}
  try{
    const scene=new THREE.Scene(),runtime=createUnitSpriteRuntime({THREE:{...THREE,TextureLoader},scene,capacity:1,teamHex:[0x5aa7d7,0xe67a5e],cameraQuaternion:new THREE.Quaternion(),roles:['spearman'],roleSpriteVersions:{spearman:'v1'},approximateActionDirections:true});
    assert.equal(await runtime.ready,true);runtime.setCount(0,1);runtime.setCount(1,1);runtime.setVisible(true);
    const uv=(u,id)=>{const f=asset.frames.find(f=>f.id===id),r=f.frameRectsPx[0].rectPx,i=page.sampling.uvInsetPx;
      assert.deepEqual(Array.from(scene.children[u.team].geometry.attributes.instanceAtlasRect.array),Array.from(new Float32Array([(r.x+i)/page.dimensionsPx.width,(r.y+r.height-i)/page.dimensionsPx.height,(r.x+r.width-i)/page.dimensionsPx.width,(r.y+i)/page.dimensionsPx.height])));};
    for(const team of [0,1])for(const selected of [false,true]){
      const u={id:team,team,slot:0,kind:'spearman',hp:100,task:'idle',angle:5*Math.PI/4,renderX:0,renderZ:0,selected};
      runtime.update(u,1000,1);uv(u,'idle-south-west-0');u.walking=true;
      for(let index=0;index<5;index++){runtime.update(u,1100+200*index,1);uv(u,`walk-south-west-${index%4}`);}
      u.walking=false;runtime.update(u,2000,1);uv(u,'idle-south-west-0');
      u.walking=true;runtime.update(u,2100,1);uv(u,'walk-south-west-0');
    }
  }finally{globalThis.fetch=previousFetch;}
});

// Restore only the four previously empty slots to check every old page byte.
test('Southwest preserves prior page RGBA outside declared empty slots and the encoded mask',()=>{
  assert.deepEqual(page.dimensionsPx,{width:2560,height:3968});
  const restored=Buffer.from(historicalPixels.subarray(0,2048*3200*4));
  for(const [x,y] of [...receipt.atlasSlotsPx,...[[660,2412],[988,2412],[1316,2412],[1644,2412]],...[[4,2772],[332,2772],[660,2772],[988,2772]]])for(let row=y;row<y+352;row++)
    restored.fill(0,(row*2048+x)*4,(row*2048+x+320)*4);
  assert.equal(sha(restored),receipt.baselineDecodedAtlasSHA256);
  assert.equal(sha(read(`${directory}/team-accent-mask.png`)),'45d8a78af8c0d9ad3bda7626a7e6dc76a83ff9c87b5499f96efb915b6540c001');
  assert.equal(receipt.registeredMaskSHA256,receipt.baselineMaskSHA256);
  assert.equal(sha(read(`${directory}/spearman-atlas-source.png`)),sha(read(`${directory}/spearman-atlas-runtime.png`)));
});
