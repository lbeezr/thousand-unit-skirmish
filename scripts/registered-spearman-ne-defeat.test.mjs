import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {decodeRgba8,assertFrameUnclipped} from './sprite-pixel-bounds.mjs';
import {analyzeUnitArtCoverage,decodeRegisteredUnitFrames} from './unit-art-production-contract.mjs';
import {createUnitSpriteRuntime,spriteActionProvenance,spriteGroundDepthBias} from '../src/unit-sprite-runtime.mjs';
const read=p=>readFileSync(new URL(`../${p}`,import.meta.url)),sha=x=>createHash('sha256').update(x).digest('hex');
const source='docs/art-direction/human-roster-v1/extracted/spearman/defeat/north-east-local-v1',receipt=JSON.parse(read(`${source}/registration.json`));
const dir='assets/units/spearman-sprite-v1',pack=JSON.parse(read(`${dir}/sprite-atlas-pack-v1.json`)),asset=pack.assets[0],page=pack.pages[0];
const pixels=decodeRgba8(read(`${dir}/spearman-atlas-runtime.png`)),cells=decodeRegisteredUnitFrames(asset,page,pixels),ownIds=new Set(['defeat-north-east-0','defeat-north-east-1']);

test('Northeast defeat preserves all83 prior complete records/crops and31 other clips with unchanged body calibration',()=>{
  const prior=asset.frames.filter(f=>!ownIds.has(f.id));assert.equal(prior.length,83);assert.equal(asset.frames.length,85);
  assert.equal(sha(JSON.stringify(prior.map(f=>({frame:f,rgba:cells[f.id].rgba,alpha:cells[f.id].alpha})))),receipt.baselineRegisteredPoseSHA256);
  const clips=asset.clips.filter(c=>!(c.stateId==='defeat'&&c.directionId==='north-east'));assert.equal(clips.length,31);assert.equal(sha(JSON.stringify(clips)),receipt.baselineUnchangedClipsSHA256);
  const {frames,clips:ignored,...metadata}=asset;assert.equal(sha(JSON.stringify(metadata)),receipt.registeredAssetMetadataSHA256);
  assert.equal(sha(JSON.stringify({...metadata,...receipt.baselineBounds})),receipt.baselineAssetMetadataSHA256);
  assert.equal(asset.heightWorld/Math.max(...frames.map(f=>f.alphaBoundsPx.height)),receipt.worldPerPixel);
  for(const key of ['artBoundsWorld','cullingBoundsWorld']){
    assert.deepEqual(asset[key],receipt.registeredBounds[key]);assert.deepEqual(asset[key].min,receipt.baselineBounds[key].min);
    assert.deepEqual(asset[key],receipt.baselineBounds[key]);
  }
  assert.equal(sha(read(receipt.identitySource.path)),receipt.identitySource.sha256);assert.equal(receipt.reusedOpeningPoses,1);assert.equal(receipt.newlyAuthoredPoses,2);
  assert.equal(receipt.retainedFoundation.totalRetainedDonors,2322);assert.equal(receipt.retainedFoundation.retainedExplicitAuthoredFarSleeveUnderlapDonors,337);assert.equal(receipt.retainedFoundation.nearElbowExactOriginalOverlapSamples,375);assert.equal(receipt.retainedFoundation.farPartAlphaPositiveIntersectionSamples,95);assert.equal(receipt.retainedFoundation.farPartIntersectionExactlyOriginalSourceSamples,38);assert.equal(receipt.retainedFoundation.originalMovingSamples,7266);assert.equal(receipt.additionalDonors,0);
  for(const key of ['mirroredPoses','borrowedDirectionPoses','generationProviderCalls','paidJobs'])assert.equal(receipt[key],0);
});

test('Northeast defeat reuses its exact idle then plays2 complete same-view source keys and a stable1080ms terminal',()=>{
  const clip=asset.clips.find(c=>c.stateId==='defeat'&&c.directionId==='north-east');assert.equal(clip.loop,false);assert.deepEqual(clip.sequence,receipt.sequence);assert.deepEqual(clip.sequence.map(k=>k.durationMs),[120,300,660]);assert.equal(clip.sequence[0].frameId,'idle-north-east-0');
  for(let index=0;index<2;index++){
    const input=receipt.poses[index],f=asset.frames.find(f=>f.id===`defeat-north-east-${index}`);assert.equal(sha(read(`${source}/${input.file}`)),input.sha256);
    assert.deepEqual(f.canvasPx,{width:416,height:416});assert.deepEqual(f.groundPivotPx,{x:208,y:353});assertFrameUnclipped(pixels,f,4,true);
    const original=decodeRgba8(read(`${source}/${input.file}`)),r=f.frameRectsPx[0].rectPx;
    for(let y=0;y<416;y++)assert.deepEqual(pixels.pixels.subarray(((r.y+y)*pixels.width+r.x)*4,((r.y+y)*pixels.width+r.x+416)*4),original.pixels.subarray(y*416*4,(y+1)*416*4));
  }
  const report=analyzeUnitArtCoverage(asset,cells),row=report.rows.find(r=>r.key==='defeat|north-east');assert.deepEqual(report.errors,[]);assert.equal(report.missingCells.length,5);assert.equal(row.status,'authored');assert.equal(row.distinctFrames,3);assert.equal(row.distinctSilhouettes,3);assert.ok(report.missingCells.every(c=>c.startsWith('defeat|')));
  const frozen=structuredClone(asset);frozen.clips.find(c=>c.stateId==='defeat'&&c.directionId==='north-east').sequence.forEach(k=>{k.frameId='idle-north-east-0';});assert.equal(analyzeUnitArtCoverage(frozen,cells).rows.find(r=>r.key==='defeat|north-east').status,'idle-fallback');
  const selected=spriteActionProvenance(new Map(asset.clips.map(c=>[`${c.stateId}|${c.directionId}`,c])),'defeat','north-east',null,'spearman',true);assert.equal(selected.reason,'exact');assert.equal(selected.selectedDirection,'north-east');
});

test('Northeast defeat changes only2 reviewed empty cells and preserves the whole3072page and encoded mask',()=>{
  assert.deepEqual(page.dimensionsPx,{width:3072,height:3968});assert.deepEqual(receipt.atlasSlotsPx,[[2564,1948],[2564,2380]]);assert.deepEqual(receipt.baselineDimensionsPx,page.dimensionsPx);assert.deepEqual(receipt.registeredDimensionsPx,page.dimensionsPx);
  const restored=Buffer.from(pixels.pixels);for(const [x,y] of receipt.atlasSlotsPx)for(let row=y;row<y+416;row++)restored.fill(0,(row*pixels.width+x)*4,(row*pixels.width+x+416)*4);
  assert.equal(sha(restored),receipt.baselineDecodedAtlasSHA256,'every prior page byte outside2 empty cells is exact');assert.equal(sha(read(`${dir}/team-accent-mask.png`)),receipt.baselineMaskSHA256);assert.equal(receipt.registeredMaskSHA256,receipt.baselineMaskSHA256);assert.equal(sha(JSON.stringify(page)),receipt.baselinePageMetadataSHA256);assert.equal(sha(read(`${dir}/spearman-atlas-source.png`)),sha(read(`${dir}/spearman-atlas-runtime.png`)));
});

test('Northeast defeat preserves the fixed logical root and conservative real-camera coverage without scaling by equipment',()=>{
  const idle=asset.frames.find(f=>f.id==='idle-north-east-0');assert.deepEqual(receipt.groundPivotPx,{x:idle.groundPivotPx.x+120,y:idle.groundPivotPx.y+80});
  const camera=new THREE.PerspectiveCamera();camera.position.set(.78,1.12,.78);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
  const right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion),up=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion),toward=new THREE.Vector3(0,0,1).applyQuaternion(camera.quaternion);
  for(const f of asset.frames){const b=f.alphaBoundsPx,p=f.groundPivotPx,s=receipt.worldPerPixel,bias=spriteGroundDepthBias(b,p,s,up.y,toward.y);
    for(const x of [b.x,b.x+b.width])for(const y of [b.y,b.y+b.height]){
      const point=new THREE.Vector3(0,.018,0).addScaledVector(right,(x-p.x)*s).addScaledVector(up,(p.y-y)*s).addScaledVector(toward,bias);assert.ok(point.y>=.018-1e-10);
      for(const bounds of [asset.artBoundsWorld,asset.cullingBoundsWorld])for(let axis=0;axis<3;axis++)assert.ok(point.getComponent(axis)>=bounds.min[axis]-1e-10&&point.getComponent(axis)<=bounds.max[axis]+1e-10);
    }
  }
});

test('default runtime prioritizes Northeast defeat, clamps its terminal through fade and resets reused slots for both teams',async()=>{
  const previousFetch=globalThis.fetch,urls=[];globalThis.fetch=async url=>{urls.push(url);return{ok:true,json:async()=>JSON.parse(read(url.slice(1)))}};
  class TextureLoader{load(_url,done){const t=new THREE.Texture();queueMicrotask(()=>done(t));return t;}}
  try{
    const scene=new THREE.Scene(),runtime=createUnitSpriteRuntime({THREE:{...THREE,TextureLoader},scene,capacity:1,teamHex:[0x5aa7d7,0xe67a5e],cameraQuaternion:new THREE.Quaternion(),roles:['spearman'],approximateActionDirections:true});assert.equal(await runtime.ready,true);assert.deepEqual(urls,['/assets/units/spearman-sprite-v1/sprite-atlas-pack-v1.json']);assert.equal(runtime.durationMs('spearman','defeat'),1080);assert.equal(runtime.durationMs('spearman','attack'),880);runtime.setCount(0,1);runtime.setCount(1,1);runtime.setVisible(true);
    const uv=(u,id)=>{const f=asset.frames.find(f=>f.id===id),r=f.frameRectsPx[0].rectPx,i=page.sampling.uvInsetPx;assert.deepEqual(Array.from(scene.children[u.team].geometry.attributes.instanceAtlasRect.array),Array.from(new Float32Array([(r.x+i)/page.dimensionsPx.width,(r.y+r.height-i)/page.dimensionsPx.height,(r.x+r.width-i)/page.dimensionsPx.width,(r.y+i)/page.dimensionsPx.height])));};
    for(const team of [0,1])for(const selected of [false,true]){
      const u={id:team,team,slot:0,kind:'spearman',hp:0,task:'idle',angle:Math.PI/4,renderX:0,renderZ:0,selected,walking:true,attackStartedAt:1000,defeatStartedAt:1000};
      for(const [at,id] of [[1000,'idle-north-east-0'],[1119,'idle-north-east-0'],[1120,'defeat-north-east-0'],[1419,'defeat-north-east-0'],[1420,'defeat-north-east-1'],[2079,'defeat-north-east-1'],[2080,'defeat-north-east-1'],[2229,'defeat-north-east-1']]){runtime.update(u,at,1);uv(u,id);}
      const full=Array.from(scene.children[team].instanceMatrix.array);runtime.update(u,2155,.5);uv(u,'defeat-north-east-1');const half=Array.from(scene.children[team].instanceMatrix.array);for(const i of [0,1,2,4,5,6])assert.ok(Math.abs(half[i]-full[i]*.5)<1e-6);for(const i of [8,9,10])assert.equal(half[i],full[i]);
      u.hp=100;u.defeatStartedAt=0;u.attackStartedAt=0;u.walking=false;runtime.update(u,2300,1);uv(u,'idle-north-east-0');u.walking=true;runtime.update(u,2400,1);uv(u,'walk-north-east-0');
      u.hp=0;u.defeatStartedAt=3000;u.attackStartedAt=2960;runtime.update(u,3000,1);uv(u,'idle-north-east-0');runtime.update(u,3120,1);uv(u,'defeat-north-east-0');runtime.update(u,3420,1);uv(u,'defeat-north-east-1');
    }
  }finally{globalThis.fetch=previousFetch;}
});
