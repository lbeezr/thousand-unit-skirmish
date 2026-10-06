import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {decodeRgba8} from './sprite-pixel-bounds.mjs';
import {decodeRegisteredUnitFrames} from './unit-art-production-contract.mjs';
import {inspectInfantryNEFootfall} from './infantry-ne-gait.mjs';
import {normalRoster} from './audit-asset-adoption.mjs';
const read=p=>readFileSync(new URL(`../${p}`,import.meta.url));
const sha=p=>createHash('sha256').update(p).digest('hex');
const pack=JSON.parse(read('assets/units/infantry-sprite-v3/sprite-atlas-pack-v1.json'));
const receipt=JSON.parse(read('docs/art-direction/human-roster-v1/infantry-ne-walk-registration.json'));
const asset=pack.assets[0],page=pack.pages[0],atlas=decodeRgba8(read('assets/units/infantry-sprite-v3/infantry-atlas-runtime.png'));
function crop(frame){
  const r=frame.frameRectsPx[0].rectPx,pixels=Buffer.alloc(r.width*r.height*4);
  for(let y=0;y<r.height;y++)pixels.set(atlas.pixels.subarray(((r.y+y)*atlas.width+r.x)*4,((r.y+y)*atlas.width+r.x+r.width)*4),y*r.width*4);
  return {width:r.width,height:r.height,pixels};
}
const poses=Array.from({length:4},(_,i)=>crop(asset.frames.find(f=>f.id===`walk-north-east-${i}`)));
test('default Infantry admits exactly reviewed NE keys and preserves all32 original poses/31 clips and body scale',()=>{
  assert.equal(normalRoster(read('src/main.js').toString()).unitSpritePreviewVersions.infantry,'v3');
  assert.equal(pack.packVersion,'0.6.0');assert.equal(asset.frames.length,36);
  assert.deepEqual(page.dimensionsPx,{width:2048,height:1280});
  assert.equal(sha(atlas.pixels.subarray(0,2048*1024*4)),receipt.priorAtlasRgbaSHA256);
  assert.equal(sha(JSON.stringify(asset.frames.slice(0,32))),receipt.priorFramesSHA256);
  assert.equal(sha(JSON.stringify(asset.clips.filter(c=>!(c.stateId==='walk'&&c.directionId==='north-east')))),receipt.priorOtherClipsSHA256);
  const oldCells=decodeRegisteredUnitFrames({...asset,frames:asset.frames.slice(0,32)},page,atlas);
  assert.equal(sha(JSON.stringify(asset.frames.slice(0,32).map(f=>({id:f.id,...oldCells[f.id]})))),receipt.priorRegisteredFramesSHA256);
  assert.equal(sha(read(receipt.sourceSheet)),receipt.sourceSheetSHA256);
  assert.ok(Math.abs(asset.heightWorld/Math.max(...asset.frames.map(f=>f.alphaBoundsPx.height))-receipt.worldPerPixel)<1e-12);
  assert.deepEqual(poses.map(p=>sha(p.pixels)),receipt.reviewedRgbaSHA256);
  const clip=asset.clips.find(c=>c.stateId==='walk'&&c.directionId==='north-east');
  assert.equal(clip.loop,true);assert.deepEqual(clip.sequence,Array.from({length:4},(_,i)=>({frameId:`walk-north-east-${i}`,durationMs:200})));
  assert.deepEqual(asset.frames.slice(32).map(f=>f.groundPivotPx),Array(4).fill(receipt.groundPivotPx));
});
test('actual NE pixels alternate support/passing boots and retain frozen body, spear and shield',()=>{
  const idle=asset.frames.find(f=>f.id==='idle-north-east-0'),small=crop(idle),seed=Buffer.alloc(256*256*4);
  const ox=128-idle.groundPivotPx.x,oy=246-idle.groundPivotPx.y;
  for(let y=0;y<small.height;y++)seed.set(small.pixels.subarray(y*small.width*4,(y+1)*small.width*4),((y+oy)*256+ox)*4);
  for(const p of poses){
    assert.deepEqual(p.pixels.subarray(0,256*166*4),seed.subarray(0,256*166*4));
    for(let y=166;y<=188;y++)for(let x=0;x<=93;x++){
      const k=(y*256+x)*4;if(seed[k+3]===255)assert.deepEqual(p.pixels.subarray(k,k+4),seed.subarray(k,k+4),'actual lower-shaft samples stay frozen');
    }
  }
  const gait=inspectInfantryNEFootfall(poses);assert.equal(gait.anatomicalAlternation,true);assert.equal(gait.renderedFootPlanting,false);
});
test('unique images with the same leading leg cannot masquerade as a full NE gait',()=>{
  const sameLead=[0,1,0,1].map((index,i)=>({...poses[index],pixels:Buffer.from(poses[index].pixels)}));
  sameLead.forEach((p,i)=>{p.pixels[0]=i+1;});
  assert.equal(new Set(sameLead.map(p=>sha(p.pixels))).size,4);
  assert.throws(()=>inspectInfantryNEFootfall(sameLead),/exchange anatomical/);
  assert.throws(()=>inspectInfantryNEFootfall([poses[0],poses[0],poses[2],poses[2]]),/passing boot/);
});
