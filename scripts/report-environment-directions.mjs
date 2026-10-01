import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';

const renderer=await readFile('src/environment-art.mjs','utf8');
const match=renderer.match(/forestAtlasPacks = new Map\(await Promise\.all\(\[(.*?)\]\.map/s);
assert(match,'Runtime forest pack declaration changed; update the audit parser.');
const names=[...match[1].matchAll(/'([^']+)'/g)].map(m=>m[1]);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const regional=[];
for(const name of names){
 const file=`assets/environment/frontier-v1/${name}-lifecycle-atlas.json`;
 const pack=JSON.parse(await readFile(file,'utf8')),asset=pack.assets[0];
 const runtime=pack.files.find(f=>f.id===pack.pages[0].runtimeFileId);
 assert.equal(hash(await readFile(path.join(path.dirname(file),runtime.path))),runtime.sha256);
 const states={};for(const clip of asset.clips){(states[clip.stateId]??=[]).push(clip.directionId);}
 for(const state in states)states[state]=[...new Set(states[state])];
 regional.push({pack:name,family:asset.id,manifest:file,runtimeHashVerified:true,viewsByState:states,
  intactViewCount:states.full?.length??0,measuredModelRotation:false});
}
const modelRotations=[];
for(const family of ['oak','pine','berries']){
 const file=`assets/environment/frontier-meshy-fixed-camera-v3/${family}/manifest.json`;
 const pack=JSON.parse(await readFile(file,'utf8'));
 assert.equal(pack.captureMode,'model-rotation');
 assert.equal(new Set(pack.frames.map(f=>f.sha256)).size,8);
 modelRotations.push({family,manifest:file,captureMode:pack.captureMode,sourceModelSha256:pack.sourceModelSha256,
  headingsDegrees:pack.frames.map(f=>f.modelYawDegrees),cameraAzimuthDegrees:pack.stats.fixedCameraAzimuthDegrees,
  scope:'intact generic resource family; regional replacement and worked-state directions not supplied'});
}
const podvineFile='assets/environment/vesperra-podvine-views-v1/manifest.json';
const podvine=JSON.parse(await readFile(podvineFile));
assert.equal(hash(await readFile(path.join(path.dirname(podvineFile),podvine.atlasFile))),podvine.atlasSha256);
const report={scope:'runtime-loaded regional harvest atlases, generic fixed-camera resource packs and podvine authored views; not every environment prop',
 rendererSha256:hash(renderer),regionalHarvestAtlases:regional,modelRotations,
 authoredUnderstoryViews:[{family:'vesperra-spiral-podvine',manifest:podvineFile,atlasHashVerified:true,
  viewCount:podvine.frames.length,requestedHeadingsDegrees:podvine.frames.map(f=>f.requestedTurnDegrees),measuredModelRotation:false}],
 nextProductionRequirement:'Underbough four canopy forms need consistent authored multi-view construction or reusable model sources, followed by state coverage and runtime selection. Mirroring, sprite yaw and harvest states do not count as viewpoints.'};
if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(`${regional.length} runtime regional harvest atlases audited; ${regional.filter(r=>r.intactViewCount===1).length} have one intact view. Three generic model packs supply eight headings each; podvine has ${podvine.frames.length} authored views.`);
