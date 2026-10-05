// CPU controls use the actual no-option Infantry runtime and its real UV/matrix
// buffers. These are source/runtime tests, never rendered-game acceptance.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile, mkdtemp, rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createContext, runInContext} from 'node:vm';
import * as THREE from 'three';
import {normalRoster} from './audit-asset-adoption.mjs';
import {unitArtDirections} from './unit-art-production-contract.mjs';
import {createUnitSpriteRuntime} from '../src/unit-sprite-runtime.mjs';
import {loadCaptureCases, validateCaseResult} from './renderer-feature-capture.mjs';
import {id, contextVersion, run} from './renderer-infantry-animation-scenario.mjs';
import {loadUnitInputs, missingWalkDirections, validateHeadingSamples, validateHeadingCoverage,
  validateStoppedSamples, observeRenderedUnits} from './renderer-worker-animation-scenario.mjs';

const localFetch=async url=>{
  const bytes=await readFile(new URL(`..${new URL(url,'http://127.0.0.1:4321').pathname}`,import.meta.url));
  return {ok:true,status:200,arrayBuffer:async()=>bytes,json:async()=>JSON.parse(bytes)};
};
const {inputs,assets}=await loadUnitInputs('http://127.0.0.1:4321',{fetchImpl:localFetch,roles:['human','infantry']});
const roster=normalRoster(await readFile(new URL('../src/main.js',import.meta.url),'utf8'));
const missing=['north','north-east','east','south','south-west','west','north-west'];

async function runtimeSamples(heading,{kind='infantry',team=0}={}) {
  const saved=globalThis.fetch;
  globalThis.fetch=localFetch;
  class TextureLoader {load(url,done){const t=new THREE.Texture({src:url});queueMicrotask(()=>done(t));return t;}}
  try {
    const role=kind==='worker'?'human':kind,scene=new THREE.Scene();
    const runtime=createUnitSpriteRuntime({THREE:{...THREE,TextureLoader},scene,capacity:1,
      roles:[role],roleSpriteVersions:roster.unitSpritePreviewVersions,
      humanAppearancePreview:roster.humanRosterPreview,approximateActionDirections:true,
      teamHex:[0x5aa7d7,0xe67a5e],cameraQuaternion:new THREE.Quaternion().setFromEuler(new THREE.Euler(-.7,-.5,0))});
    runtime.setCount(team,1);runtime.setVisible(true);assert.equal(await runtime.ready,true);
    const angle=unitArtDirections.indexOf(heading)*Math.PI/4;
    const unit={id:42,generation:3,kind,team,slot:0,hp:100,walking:true,angle,renderX:0,renderZ:0,
      attackStartedAt:0,defeatStartedAt:0,scale:1,visible:true};
    const mesh=scene.children[team];
    const observe=(time,walking)=>{
      unit.walking=walking;runtime.update(unit,time,1);
      const copy={id:unit.id,generation:unit.generation,kind,role,team,angle,x:unit.renderX,z:unit.renderZ,
        serverX:unit.renderX,serverZ:unit.renderZ,walking:unit.walking,clockState:unit.spriteClockState,
        clockStartedAt:unit.spriteClockStartedAt,uv:Array.from(mesh.geometry.attributes.instanceAtlasRect.array),
        matrix:Array.from(mesh.instanceMatrix.array),atlasPath:mesh.material.map.image.src,
        actionSelection:runtime.observeAction(unit,time,team),actorDraw:mesh.visible&&mesh.count===1,
        inView:true,groundY:.018,visibleScale:1};
      return {number:time,time,units:[copy]};
    };
    const samples=[0,200,400,800].map(elapsed=>{
      unit.renderX=Math.sin(angle)*elapsed/500;unit.renderZ=Math.cos(angle)*elapsed/500;
      return observe(1000+elapsed,true);
    });
    const stopped=[2000,2100,2300].map(time=>observe(time,false));
    const resumed=[0,200,400,800].map(elapsed=>{
      unit.renderX+=Math.sin(angle)*(elapsed===0?0:.4);unit.renderZ+=Math.cos(angle)*(elapsed===0?0:.4);
      return observe(2400+elapsed,true);
    });
    return {samples,stopped,resumed,options:{unitId:42,heading,kind,...inputs[role]},scene,runtime,unit};
  } finally {globalThis.fetch=saved;}
}

test('registered ordinary Infantry case pins actual restored no-option v3 and seven decoded art gaps',async()=>{
  assert.equal(id,'infantry-animations');assert.equal(contextVersion,1);
  const loaded=await loadCaptureCases(id);assert.deepEqual(loaded.issues,[]);assert.equal(loaded.adapters[0].id,id);
  assert.equal(roster.unitSpritePreviewVersions.infantry,'v3');assert.equal(inputs.infantry.pack.packVersion,'0.5.0');
  assert.equal(assets.length,6);assert.deepEqual(missingWalkDirections(inputs.infantry),missing);
});

test('real Infantry UV/time/matrix playback, Stop and resume keep seven static holds out of animated coverage',async()=>{
  for(const team of [0,1])for(const heading of unitArtDirections) {
    const f=await runtimeSamples(heading,{team}),result=validateHeadingSamples(f.samples,f.options);
    assert.equal(result.status,heading==='south-east'?'animated':'incomplete-art-correct-facing');
    assert.equal(result.distinctCells,heading==='south-east'?3:1);
    assert.ok(result.samples.every(s=>s.clipDirection===heading&&s.drawnRoot.visibleScale===1));
    validateStoppedSamples(f.stopped,{...f.options,stopTime:1999});
    const resume=validateHeadingSamples(f.resumed,f.options);
    assert.equal(resume.samples[0].elapsedMs,0);assert.equal(f.resumed[0].units[0].clockStartedAt,2400);
  }
});

test('coverage requires every real Infantry heading once, and false idle completion cannot pass',async()=>{
  const rows=[];
  for(const kind of ['worker','infantry'])for(const heading of unitArtDirections) {
    const f=await runtimeSamples(heading,{kind});rows.push(validateHeadingSamples(f.samples,f.options));
  }
  const report={rows,militaryKind:'infantry',expectedMissingWalkDirections:missing};
  validateHeadingCoverage(report);assert.equal(rows.filter(r=>r.status==='animated').length,9);
  const falseWalk=structuredClone(rows);falseWalk.find(r=>r.kind==='infantry'&&r.heading==='west').status='animated';
  assert.throws(()=>validateHeadingCoverage({...report,rows:falseWalk}),/idle placeholders/);
  const duplicate=structuredClone(rows);duplicate.find(r=>r.kind==='infantry'&&r.heading==='north').heading='south-east';
  assert.throws(()=>validateHeadingCoverage({...report,rows:duplicate}),/exactly once/);
  assert.throws(()=>validateCaseResult({status:'passed',checks:[{id:'infantry-west-gait',passed:false}]},[{}]));
});

test('Infantry playback rejects frozen UVs, reset clocks, duplicate gait pixels and stale transforms',async()=>{
  const f=await runtimeSamples('south-east');
  for(const [change,reason] of [
    [s=>{s[1].units[0].uv=s[0].units[0].uv;},/elapsed animation clock/],
    [s=>{s[1].units[0].clockStartedAt-=800;},/restart its clock/],
    [s=>{s[1].units[0].matrix=s[0].units[0].matrix;},/calibration|drawn sprite root/],
    [s=>{s[1].units[0].actionSelection.selectedDirection='west';},/selection provenance/],
  ]){const copy=structuredClone(f.samples);change(copy);assert.throws(()=>validateHeadingSamples(copy,f.options),reason);}
  const cells=Object.fromEntries(Object.entries(f.options.cells).map(([key])=>[key,{rgba:'same',alpha:'same'}]));
  // The source decoder sees a static/fallback action; it cannot be promoted by
  // advancing UV keys or by translating its whole sprite instance.
  assert.throws(()=>validateHeadingSamples(f.samples,{...f.options,cells}),/idle|distinct registered/);
});

test('actual post-render observer includes the default Infantry and reads its real buffers without mutation',async()=>{
  const f=await runtimeSamples('west'),probe={number:0,targets:[42],samples:[],pending:null,errors:[]};
  const unit={...f.unit,serverX:f.unit.renderX,serverZ:f.unit.renderZ};
  const before=JSON.stringify(unit),buffers=f.scene.children.map(m=>Array.from(m.instanceMatrix.array));
  const context=createContext({window:{__rtsUnitAnimation:probe},units:[Object.freeze(unit)],scene:f.scene,
    unitSpriteRuntime:f.runtime,selected:new Set(),localTeam:0,now:3200,mapDefinition:{id:'veyrholds-terraced-vale'},
    zoom:1.5,unitSpriteReady:true,latestBuildings:[],latestFood:[],latestWood:[],latestPopulation:[],latestWorkerProduction:[],
    URL,location:{href:'http://127.0.0.1:4321/?room=fixture'},camera:{},innerWidth:1280,innerHeight:720,devicePixelRatio:1,
    groundHeight:()=>0,THREE:{Vector3:class {project(){this.x=0;this.y=0;this.z=0;return this;}}},
    renderer:{info:{render:{frame:10}},domElement:{getBoundingClientRect:()=>({left:0,top:0,width:1280,height:720})}}});
  runInContext(`(${observeRenderedUnits.toString()})()`,context);
  assert.deepEqual(probe.errors,[]);assert.equal(probe.samples[0].units[0].kind,'infantry');
  assert.equal(probe.samples[0].units[0].actionSelection.reason,'idle-placeholder');
  assert.deepEqual(Array.from(probe.samples[0].units[0].uv),Array.from(f.scene.children[0].geometry.attributes.instanceAtlasRect.array));
  assert.equal(JSON.stringify(unit),before);assert.deepEqual(f.scene.children.map(m=>Array.from(m.instanceMatrix.array)),buffers);
});

test('Infantry adapter retains source gaps and precise default binding on a load failure, with no captures',async()=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'rts-infantry-adapter-')),saved=globalThis.fetch;
  globalThis.fetch=localFetch;
  const unitLoad={state:'failed',stage:'manifest-request',cause:'http'};
  const page={cdp:{call:async()=>{},evaluate:async expression=>{
    if(expression==="document.querySelector('#lobby-map').value")return 'veyrholds-terraced-vale';
    if(expression==="document.querySelector('#lobby-match-mode').value")return 'skirmish@1';
    if(expression==='location.href')return 'http://127.0.0.1:4321/?room=fixture';
    if(expression==='window.__rtsUnitAnimation.last')return {unitLoad};
    if(expression==='window.__rtsUnitAnimation.last?.unitLoad??null')return unitLoad;
  }},wait:async()=>{}};
  try {
    const result=await run({version:1,page,openPage:async()=>page,origin:'http://127.0.0.1:4321',evidenceDirectory:directory,
      source:Object.freeze({revision:'a'.repeat(40),digest:`sha256:${'b'.repeat(64)}`}),
      capture:async()=>assert.fail('failed Infantry loading cannot produce a screenshot')});
    assert.equal(result.status,'failed');
    const report=JSON.parse(await readFile(path.join(directory,'unit-animation-acceptance.json'),'utf8'));
    assert.deepEqual(report.defaultHumanRoles,{worker:'human/v3',infantry:'infantry/v3'});
    assert.equal(report.adapterId,id);assert.deepEqual(report.expectedMissingWalkDirections,missing);
    assert.deepEqual(report.captures,[]);assert.equal(report.stagingAcceptance,false);
  } finally {globalThis.fetch=saved;await rm(directory,{recursive:true,force:true});}
});
