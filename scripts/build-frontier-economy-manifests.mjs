// Admit reproducible economy captures without copying private GLBs or authoring scenes.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,copyFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {validateBuildingLifecycle} from './validate-building-lifecycle.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
const relative='assets/buildings/frontier-economy-models-v1', pack=path.join(root,relative);
const baseStates=['foundation','frame','complete','damaged','critical'];
const provenance=JSON.parse(await readFile(path.join(root,'docs/art-direction/frontier-economy-meshy-v1/provenance.json'),'utf8'));
const admitted=[];
await mkdir(path.join(pack,'runtime'),{recursive:true});
for(const asset of ['mill','farm','dock']){
 const receiptPath=path.join(pack,`captures/${asset==='dock'?'runtime-v1':'state-fix-v1'}/${asset}-capture-receipt.json`);
 const receipt=JSON.parse(await readFile(receiptPath,'utf8'));
 await copyFile(receiptPath,path.join(pack,`source/${asset}-capture-receipt.json`));
 const source=provenance.jobs.find(j=>j.role===asset);
 assert.equal(receipt.sourceSHA256,source.model.sha256);
 const states=asset==='farm'?[...baseStates,'exhausted','exhausted-damaged','exhausted-critical']:baseStates;
 assert.equal(receipt.records.length,states.length*8);
 const entries=[];
 for(const state of states){
  const views=[];
  for(let index=0;index<8;index++){
   const rows=receipt.records.filter(r=>r.state===state&&r.viewIndex===index);assert.equal(rows.length,1);
   const row=rows[0],camera=row.camera;
   assert.equal(row.asset,asset);assert.equal(row.sourceSHA256,source.model.sha256);
   assert.equal(row.targetBaseWidthWorldUnits,2.8);assert.ok(Math.abs(row.uniformScale*row.measuredNativeBaseWidth-2.8)<1e-10);
   assert.equal(camera.projection,'orthographic');assert.equal(camera.elevationDegrees,46);
   assert.equal(camera.azimuthDegrees,index*45);assert.deepEqual(camera.canvasPixels,[1024,1024]);
   assert.equal(camera.canvasWorldUnits,8);assert.equal(camera.pixelsPerWorldUnit,128);
   assert.ok(Math.abs(camera.groundOriginPixelFromTopLeft[0]-512)<.001);
   assert.ok(Math.abs(camera.groundOriginPixelFromTopLeft[1]-647.1527325565025)<.001);
   const expected=`${asset}-${state}-view-${String(index).padStart(2,'0')}.png`;
   assert.ok([`captures/runtime-v1/${expected}`,`captures/state-fix-v1/${expected}`].includes(row.file));
   const bytes=await readFile(path.join(pack,row.file));
   assert.equal(bytes.length,row.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),row.sha256);
   assert.equal(bytes.readUInt32BE(16),1024);assert.equal(bytes.readUInt32BE(20),1024);
   const runtime=`runtime/${path.basename(expected)}`;
   await copyFile(path.join(pack,row.file),path.join(pack,runtime));admitted.push(runtime);
   views.push({index,azimuthDegrees:index*45,path:runtime,sha256:row.sha256,bytes:row.bytes});
  }
  entries.push({state,views});
 }
 const manifest={schema:'thousand-unit-skirmish.building-lifecycle-reference.v1',asset,
  status:'default registered lifecycle captures; live team standards',
  camera:{projection:'orthographic',framePixels:[1024,1024],pixelsPerWorldUnit:128,elevationDegrees:46,
   azimuthDegrees:Array.from({length:8},(_,i)=>i*45),anchorPixelFromTopLeft:[512,647.1527325565025],background:'transparent'},
  stateOrder:states,completeState:entries.find(e=>e.state==='complete'),states:entries.filter(e=>e.state!=='complete'),
  stateMapping:{construction:{foundationAtOrBelow:.275},health:{damagedAtOrBelow:.6,criticalAtOrBelow:.3},
   ...(asset==='farm'?{harvest:{exhaustedStates:{complete:'exhausted',damaged:'exhausted-damaged',critical:'exhausted-critical'}}}:{})},
  source:{taskId:source.task_id??source.taskId,sha256:source.model.sha256,recipeSHA256:receipt.scriptSHA256,
   recipePath:asset==='dock'?'source/capture_economy_runtime_v1.py':'source/capture_economy.py',
   reference:'../../../docs/art-direction/frontier-economy-meshy-v1/README.md'},
  limitations:['Static captures; Mill sails do not animate','Damage geometry is an initial cut-based treatment','Ownership uses live team-colored and shaped standards outside the captured artwork']};
 validateBuildingLifecycle(manifest,{requireLifecycle:true});
 await writeFile(path.join(pack,`${asset}-complete-renderer.json`),JSON.stringify(manifest,null,2)+'\n');
}
assert.deepEqual((await readdir(path.join(pack,'runtime'))).sort(),admitted.map(p=>path.basename(p)).sort(),'runtime must contain only admitted frames');
console.log(JSON.stringify({families:3,states:18,frames:admitted.length,privateModelsPacked:false}));
