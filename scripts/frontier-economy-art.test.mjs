import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {validateBuildingLifecycle} from './validate-building-lifecycle.mjs';
import {decodeRgba8,measureFrameAlpha} from './sprite-pixel-bounds.mjs';
const root=new URL('../assets/buildings/frontier-economy-models-v1/',import.meta.url);
test('economy runtime covers registered lifecycle/depletion with intact alpha envelopes and exact source bytes',async()=>{
 const files=[];
 for(const asset of ['mill','farm','dock']){
  const manifest=JSON.parse(await readFile(new URL(`${asset}-complete-renderer.json`,root)));
  const receipt=JSON.parse(await readFile(new URL(`source/${asset}-capture-receipt.json`,root)));
  const validation=validateBuildingLifecycle(manifest,{requireLifecycle:true});
  assert.equal(validation.viewsPerState,8);assert.equal(validation.states.length,asset==='farm'?8:5);
  assert.deepEqual(manifest.camera.anchorPixelFromTopLeft,[512,647.1527325565025]);
  assert.equal(manifest.camera.pixelsPerWorldUnit,128);
  assert.equal(manifest.source.sha256,receipt.sourceSHA256);
  assert.equal(manifest.source.recipeSHA256,createHash('sha256').update(await readFile(new URL(manifest.source.recipePath,root))).digest('hex'));
  const entries=[manifest.completeState,...manifest.states],hashes=new Set();
  for(const entry of entries)for(const view of entry.views){
   const bytes=await readFile(new URL(view.path,root));files.push(view.path.slice(8));
   assert.equal(createHash('sha256').update(bytes).digest('hex'),view.sha256);assert.equal(bytes.length,view.bytes);
   const captured=receipt.records.find(r=>r.state===entry.state&&r.viewIndex===view.index);
   assert.equal(view.sha256,captured.sha256);assert.equal(captured.sourceSHA256,manifest.source.sha256);
   assert.equal(captured.targetBaseWidthWorldUnits,2.8);
   assert.ok(Math.abs(captured.uniformScale*captured.measuredNativeBaseWidth-2.8)<1e-10);
   const image=decodeRgba8(bytes);assert.equal(image.width,1024);assert.equal(image.height,1024);
   const box=measureFrameAlpha(image,{x:0,y:0,width:1024,height:1024});assert.ok(box);
   assert.ok(box.x>=4&&box.y>=4&&box.x+box.width<=1020&&box.y+box.height<=1020,'authored silhouette has padding');
   hashes.add(view.sha256);
  }
  assert.equal(hashes.size,entries.length*8,'each heading and state must use its own authored capture');
 }
 assert.equal(files.length,144);assert.deepEqual((await readdir(new URL('runtime/',root))).sort(),files.sort(),'no sources or comparison frames enter runtime');
});
