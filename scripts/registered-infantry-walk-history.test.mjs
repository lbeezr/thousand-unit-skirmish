import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {decodeRgba8} from './sprite-pixel-bounds.mjs';
import {inspectInfantryEastFootfall} from './infantry-east-gait.mjs';
import {inspectInfantrySourceFootfall} from './infantry-source-footfall.mjs';
const read=p=>readFileSync(new URL(`../${p}`,import.meta.url));
const sha=p=>createHash('sha256').update(p).digest('hex');
const history=JSON.parse(read('docs/art-direction/human-roster-v1/infantry-walk-increments.json')).revisions.map(r=>JSON.parse(read(r.registration)));
const pack=JSON.parse(read('assets/units/infantry-sprite-v3/sprite-atlas-pack-v1.json')),asset=pack.assets[0];
const atlas=decodeRgba8(read('assets/units/infantry-sprite-v3/infantry-atlas-runtime.png'));
const crop=r=>{
  const pixels=Buffer.alloc(r.width*r.height*4);
  for(let y=0;y<r.height;y++)pixels.set(atlas.pixels.subarray(((r.y+y)*atlas.width+r.x)*4,((r.y+y)*atlas.width+r.x+r.width)*4),y*r.width*4);
  return {width:r.width,height:r.height,pixels};
};
for(const [index,receipt] of history.entries())if(index>0)test(`reviewed own-${receipt.heading} default keeps all preceding poses/clips/pixels and exact scale`,()=>{
  assert.equal(sha(JSON.stringify(asset.frames.slice(0,receipt.priorFrameCount))),receipt.priorFramesSHA256);
  const clips=structuredClone(asset.clips);
  for(const later of history.slice(index+1).reverse())clips.splice(clips.findIndex(c=>c.stateId==='walk'&&c.directionId===later.heading),1,later.priorWalkClip);
  assert.equal(sha(JSON.stringify(clips.filter(c=>!(c.stateId==='walk'&&c.directionId===receipt.heading)))),receipt.priorOtherClipsSHA256);
  const old=crop({x:0,y:0,width:receipt.priorAtlasSizePx[0],height:receipt.priorAtlasSizePx[1]});
  for(const revision of history.slice(index))for(const r of revision.newRectsPx){
    for(let y=r.y;y<Math.min(old.height,r.y+r.height);y++)old.pixels.fill(0,(y*old.width+r.x)*4,(y*old.width+r.x+r.width)*4);
  }
  assert.equal(sha(old.pixels),receipt.priorAtlasRgbaSHA256,'every previous pixel outside newly occupied empty cells stays exact');
  const frames=Array.from({length:4},(_,i)=>asset.frames.find(f=>f.id===`walk-${receipt.heading}-${i}`));
  assert.deepEqual(frames.map(f=>sha(crop(f.frameRectsPx[0].rectPx).pixels)),receipt.reviewedRgbaSHA256);
  assert.deepEqual(frames.map(f=>f.groundPivotPx),Array(4).fill(receipt.groundPivotPx));
  assert.deepEqual(asset.clips.find(c=>c.stateId==='walk'&&c.directionId===receipt.heading).sequence,frames.map(f=>({frameId:f.id,durationMs:200})));
  assert.equal(sha(read(receipt.sourceSheet)),receipt.sourceSheetSHA256);
  assert.ok(Math.abs(asset.heightWorld/Math.max(...asset.frames.map(f=>f.alphaBoundsPx.height))-receipt.worldPerPixel)<1e-12);
});
const east=Array.from({length:4},(_,i)=>crop(asset.frames.find(f=>f.id===`walk-east-${i}`).frameRectsPx[0].rectPx));
test('actual East boot contours exchange support/passing without flattening projected leg depths',()=>{
  const gait=inspectInfantryEastFootfall(east);assert.equal(gait.anatomicalAlternation,true);assert.equal(gait.contactDepthOffset,25);assert.equal(gait.renderedFootPlanting,false);
  const idle=asset.frames.find(f=>f.id==='idle-east-0'),small=crop(idle.frameRectsPx[0].rectPx),seed=Buffer.alloc(256*256*4);
  const ox=128-idle.groundPivotPx.x,oy=246-idle.groundPivotPx.y;
  for(let y=0;y<small.height;y++)seed.set(small.pixels.subarray(y*small.width*4,(y+1)*small.width*4),((y+oy)*256+ox)*4);
  for(const p of east){
    assert.deepEqual(p.pixels.subarray(0,256*166*4),seed.subarray(0,256*166*4));
    for(let y=166;y<201;y++)for(let x=60;x<107;x++){
      const k=(y*256+x)*4;assert.deepEqual(p.pixels.subarray(k,k+4),seed.subarray(k,k+4),'whole near cuff/shaft overlap stays frozen');
    }
  }
});
test('East rejects four unique same-leading-leg keys, wrong passing order and repeated contact poses',()=>{
  const same=[0,1,0,1].map((n,i)=>{const p={...east[n],pixels:Buffer.from(east[n].pixels)};p.pixels[0]=i+1;return p;});
  assert.equal(new Set(same.map(p=>sha(p.pixels))).size,4);
  assert.throws(()=>inspectInfantryEastFootfall(same),/supporting foot|passing legs|forward reach/);
  assert.throws(()=>inspectInfantryEastFootfall([east[0],east[3],east[2],east[1]]),/supporting foot|passing legs/);
  assert.throws(()=>inspectInfantryEastFootfall([east[0],east[0],east[2],east[2]]),/passing legs/);
});
for(const receipt of history.filter(r=>r.gaitSpec))test(`actual own-${receipt.heading} footfall and frozen joins qualify ordered opposite-leg motion`,()=>{
  const poses=Array.from({length:4},(_,i)=>crop(asset.frames.find(f=>f.id===`walk-${receipt.heading}-${i}`).frameRectsPx[0].rectPx));
  assert.equal(inspectInfantrySourceFootfall(poses,receipt.gaitSpec).renderedFootPlanting,false);
  const idle=asset.frames.find(f=>f.id===receipt.sourceFrameId),small=crop(idle.frameRectsPx[0].rectPx),seed=Buffer.alloc(256*256*4);
  const ox=128-idle.groundPivotPx.x,oy=246-idle.groundPivotPx.y;
  for(let y=0;y<small.height;y++)seed.set(small.pixels.subarray(y*small.width*4,(y+1)*small.width*4),((y+oy)*256+ox)*4);
  for(const pose of poses)for(const [x0,y0,x1,y1] of receipt.frozenSourceRegions)for(let y=y0;y<y1;y++){
    assert.deepEqual(pose.pixels.subarray((y*256+x0)*4,(y*256+x1)*4),seed.subarray((y*256+x0)*4,(y*256+x1)*4));
  }
  const same=[0,1,0,1].map((n,i)=>{const p={...poses[n],pixels:Buffer.from(poses[n].pixels)};p.pixels[0]=i+1;return p;});
  assert.equal(new Set(same.map(p=>sha(p.pixels))).size,4);
  assert.throws(()=>inspectInfantrySourceFootfall(same,receipt.gaitSpec),/supporting foot|passing legs|forward reach/);
  assert.throws(()=>inspectInfantrySourceFootfall([poses[0],poses[3],poses[2],poses[1]],receipt.gaitSpec),/supporting foot|passing legs/);
  assert.throws(()=>inspectInfantrySourceFootfall([poses[0],poses[0],poses[2],poses[2]],receipt.gaitSpec),/passing legs/);
});
