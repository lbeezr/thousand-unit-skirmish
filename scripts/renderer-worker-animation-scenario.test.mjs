// CPU negative controls for acceptance claims. These fixtures are not GPU,
// ordinary-game screenshots, hosted capture, staging or deployed evidence.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createContext, runInContext } from 'node:vm';
import * as THREE from 'three';
import { spriteActionClip, spriteActionProvenance, createUnitSpriteRuntime } from '../src/unit-sprite-runtime.mjs';
import { unitArtDirections } from './unit-art-production-contract.mjs';
import { validateCaptureAdapter } from './renderer-capture-context.mjs';
import { id, contextVersion, run, mapId, directories, loadUnitInputs, identifyUnitFrame,
  validateHeadingSamples, validateStoppedSamples, postRenderLine, observeRenderedUnits,
  installUnitProbe, assertUnitLoadReady, missingWalkDirections, validateHeadingCoverage } from './renderer-worker-animation-scenario.mjs';

const localFetch=async url=>{
  const bytes=await readFile(new URL(`..${new URL(url).pathname}`,import.meta.url));
  return {status:200,arrayBuffer:async()=>bytes};
};
const {inputs,assets}=await loadUnitInputs('http://127.0.0.1:1',{fetchImpl:localFetch});
function fixture(kind,heading,{state='walk',times=[0,200,400,800]}={}) {
  const role=kind==='worker'?'human':'spearman',input=inputs[role],pack=input.pack,page=pack.pages[0];
  const angle=unitArtDirections.indexOf(heading)*Math.PI/4;
  const clip=spriteActionClip(new Map(pack.assets[0].clips.map(c=>[`${c.stateId}|${c.directionId}`,c])),state,heading,null,role,true);
  const duration=clip.sequence.reduce((sum,k)=>sum+k.durationMs,0);
  const unitId=42;
  const samples=times.map((elapsed,index)=>{
    let phase=clip.loop?elapsed%duration:Math.min(elapsed,duration-1),key=0;
    while(key<clip.sequence.length-1&&phase>=clip.sequence[key].durationMs){phase-=clip.sequence[key].durationMs;key++;}
    const frame=pack.assets[0].frames.find(f=>f.id===clip.sequence[key].frameId);
    const r=frame.frameRectsPx[0].rectPx,i=page.sampling.uvInsetPx;
    const uv=Array.from(new Float32Array([(r.x+i)/page.dimensionsPx.width,(r.y+r.height-i)/page.dimensionsPx.height,
      (r.x+r.width-i)/page.dimensionsPx.width,(r.y+i)/page.dimensionsPx.height]));
    const x=state==='walk'?Math.sin(angle)*elapsed/500:0,z=state==='walk'?Math.cos(angle)*elapsed/500:0;
    const scale=pack.assets[0].heightWorld/Math.max(...pack.assets[0].frames.map(f=>f.alphaBoundsPx.height));
    const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(-.7,-.5,0));
    const crop=frame.frameRectsPx[0],o=crop.offsetPx??{x:0,y:0},p=frame.groundPivotPx;
    const center=new THREE.Vector3((o.x+r.width/2-p.x)*scale,(p.y-o.y-r.height/2)*scale,0).applyQuaternion(q);
    const up=new THREE.Vector3(0,1,0).applyQuaternion(q),toward=new THREE.Vector3(0,0,1).applyQuaternion(q);
    const below=Math.max(0,frame.alphaBoundsPx.y+frame.alphaBoundsPx.height-p.y);
    const bias=toward.y>.001?below*scale*Math.max(0,up.y)/toward.y:0;
    const position=new THREE.Vector3(x,.018,z).add(center).addScaledVector(toward,bias);
    const matrix=Array.from(new Float32Array(new THREE.Matrix4().compose(position,q,new THREE.Vector3(r.width*scale,r.height*scale,1)).elements));
    const unit={id:unitId,generation:3,team:0,kind,role,angle,x,z,serverX:x,serverZ:z,
      matrix,visibleScale:1,groundY:.018,scale:1,
      walking:state==='walk',clockState:state,clockStartedAt:1000,uv,actorDraw:true,inView:true,
      actionSelection:{role,version:directories[role].split('-').at(-1),
        ...spriteActionProvenance(new Map(pack.assets[0].clips.map(c=>[`${c.stateId}|${c.directionId}`,c])),state,heading,null,role,true)},
      atlasPath:`/assets/units/${directories[role]}/${pack.files.find(f=>f.id===page.runtimeFileId).path}`};
    return {number:index+10,time:1000+elapsed,units:[unit]};
  });
  return {samples,options:{unitId,heading,kind,...input}};
}

test('adapter imports without starting a workload and pins ordinary map/served runtime inputs',()=>{
  assert.equal(id,'worker-animations');assert.equal(mapId,'veyrholds-terraced-vale');
  assert.equal(validateCaptureAdapter({id,contextVersion,run},id).contextVersion,1);
  assert.equal(assets.length,6);assert.equal(inputs.human.pack.assets[0].id,'human');
  assert.equal(inputs.spearman.pack.assets[0].id,'spearman');
  assert.ok(assets.every(a=>/^[a-f0-9]{64}$/.test(a.sha256)&&a.bytes>0));
});
test('all eight existing Worker gaits require changing registered pixels and silhouettes',()=>{
  for(const heading of unitArtDirections){const f=fixture('worker',heading),result=validateHeadingSamples(f.samples,f.options);
    assert.equal(result.status,'animated');assert.ok(result.distinctCells>=2&&result.distinctSilhouettes>=2);
    assert.equal(result.samples[0].direction,heading);}
});
test('Spearman plays SE and new NE while preserving six explicit same-facing idle walk gaps',()=>{
  let animated=0,missing=0;
  for(const heading of unitArtDirections){const f=fixture('spearman',heading),result=validateHeadingSamples(f.samples,f.options);
    if(['south-east','north-east'].includes(heading)){assert.equal(result.status,'animated');animated++;}
    else{assert.equal(result.status,'incomplete-art-correct-facing');assert.equal(result.distinctCells,1);missing++;}}
  assert.deepEqual({animated,missing},{animated:2,missing:6});
});
test('translation with a frozen pose or clock cannot pass Worker gait',()=>{
  const f=fixture('worker','north');
  const frozen=structuredClone(f.samples);for(const s of frozen)s.units[0].uv=frozen[0].units[0].uv;
  assert.throws(()=>validateHeadingSamples(frozen,f.options),/elapsed animation clock/);
  const reset=structuredClone(f.samples);reset[1].units[0].clockStartedAt-=800;
  assert.throws(()=>validateHeadingSamples(reset,f.options),/continuous movement cannot restart/);
  const tooShort=fixture('worker','north',{times:[0,100,200]});
  assert.throws(()=>validateHeadingSamples(tooShort.samples,tooShort.options),/usable gait interval/);
});
test('final heading aggregation accepts both genuine Spearman walks and rejects stale or misplaced gaps',()=>{
  const rows=[];
  for(const kind of ['worker','spearman'])for(const heading of unitArtDirections){
    const f=fixture(kind,heading);
    rows.push({...validateHeadingSamples(f.samples,f.options),kind,heading});
  }
  const report={rows,expectedMissingWalkDirections:missingWalkDirections(inputs.spearman)};
  assert.doesNotThrow(()=>validateHeadingCoverage(report));
  assert.equal(rows.filter(r=>r.status==='animated').length,10);
  assert.throws(()=>validateHeadingCoverage({...report,expectedMissingWalkDirections:[...report.expectedMissingWalkDirections,'north-east']}));
  const misplaced=structuredClone(rows);
  misplaced.find(r=>r.kind==='spearman'&&r.heading==='north').kind='worker';
  assert.throws(()=>validateHeadingCoverage({...report,rows:misplaced}));
});
test('missing draw, offscreen target, wrong texture, clock and actual displacement are rejected',()=>{
  const f=fixture('worker','east');
  for(const [field,value,reason] of [['actorDraw',false,/active sprite draw/],['inView',false,/useful viewport/],
    ['atlasPath','/assets/units/cast-human-sprite-v2/runtime.png',/default texture binding/],['clockStartedAt',NaN,/actual animation clock/]]){
    const unit={...f.samples[0].units[0],[field]:value};assert.throws(()=>identifyUnitFrame(unit,f.options.pack,f.options.cells,1000),reason);}
  const wrong=structuredClone(f.samples);for(const s of wrong){s.units[0].z=s.units[0].x;s.units[0].x=0;}
  assert.throws(()=>validateHeadingSamples(wrong,f.options),/drawn sprite root/);
});
test('Stop requires a new, continuous idle clock, stable position and retained facing',()=>{
  const f=fixture('worker','west',{state:'idle',times:[0,100,200,400]});
  const options={...f.options,stopTime:999};assert.equal(validateStoppedSamples(f.samples,options).length,4);
  assert.throws(()=>validateStoppedSamples(f.samples,{...options,stopTime:1001}),/actual state transition/);
  const translating=structuredClone(f.samples);translating.at(-1).units[0].x=.02;
  assert.throws(()=>validateStoppedSamples(translating,options),/drawn sprite root|stop translating/);
  const facing=structuredClone(f.samples);facing[0].units[0].angle=0;
  assert.throws(()=>validateStoppedSamples(facing,options),/elapsed animation clock|actual facing/);
});
test('advancing UV and unit metadata cannot pass a stale transform, wrong scale or unplanted pivot',()=>{
  const f=fixture('worker','north'),frozen=structuredClone(f.samples);
  for(const sample of frozen)sample.units[0].matrix=frozen[0].units[0].matrix;
  assert.throws(()=>validateHeadingSamples(frozen,f.options),/calibration|drawn sprite root|ground pivot/);
  for(const change of [unit=>{unit.visibleScale=.5;},unit=>{unit.matrix[13]+=.05;}]){
    const unit=structuredClone(f.samples[0].units[0]);change(unit);
    assert.throws(()=>identifyUnitFrame(unit,f.options.pack,f.options.cells,1000),/calibration|ground pivot/);
  }
});
test('productive construction resolves actual retained work keys at their elapsed phase',()=>{
  const f=fixture('worker','south-east',{state:'build',times:[0,100,200]});
  const keys=f.samples.map(s=>identifyUnitFrame(s.units[0],f.options.pack,f.options.cells,s.time));
  assert.ok(keys.every(k=>k.frameId.startsWith('build-')));assert.ok(new Set(keys.map(k=>k.rgbaSha256)).size>=2);
});
test('changed served manifest or texture bytes fail before runtime acceptance',async()=>{
  await assert.rejects(loadUnitInputs('http://127.0.0.1:1',{fetchImpl:async url=>{
    const r=await localFetch(url),b=Buffer.from(await r.arrayBuffer());
    if(url.endsWith('.json'))b[0]=32;return {status:200,arrayBuffer:async()=>b};
  }}),/served manifest must match/);
  await assert.rejects(loadUnitInputs('http://127.0.0.1:1',{fetchImpl:async url=>{
    const r=await localFetch(url),b=Buffer.from(await r.arrayBuffer());
    if(url.endsWith('.png'))b[0]^=1;return {status:200,arrayBuffer:async()=>b};
  }}),/served texture must match/);
});
test('post-render observer pins the actual render boundary and never pauses or mutates gameplay',async()=>{
  const main=await readFile(new URL('../src/main.js',import.meta.url),'utf8');assert.ok(postRenderLine(main)>10000);
  assert.throws(()=>postRenderLine('renderer.render(scene, camera);\nnoCheckpoint();'),/site moved/);
  assert.throws(()=>postRenderLine(main+'\nrenderer.render(scene, camera);'),/unique/);
  const f=fixture('worker','north'),u={...f.samples[0].units[0],hp:35,slot:0,renderX:0,renderZ:0,
    spriteClockState:'walk',spriteClockStartedAt:1000};
  const matrix=Object.freeze([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
  const meshes=[0,1].map(()=>Object.freeze({visible:true,count:1,instanceMatrix:{array:matrix},
    geometry:{attributes:{instanceAtlasRect:{array:u.uv}}},material:{map:{image:{src:u.atlasPath}}}}));
  const game={units:[Object.freeze(u)],scene:{children:meshes},selected:new Set([42]),
    latestBuildings:[{id:9,team:0,type:'town-center',home:true,complete:true}],latestFood:[150,150],latestWood:[250,250]};
  const before=JSON.stringify(game),probe={number:0,targets:[42],samples:[],pending:null,errors:[]};
  const context=createContext({...game,window:{__rtsUnitAnimation:probe},localTeam:0,now:1000,
    mapDefinition:{id:mapId},zoom:1.5,unitSpriteReady:true,latestPopulation:[{used:12,capacity:15}],latestWorkerProduction:[],
    unitSpriteRuntime:{roleForUnit:()=> 'human',observeAction:()=>u.actionSelection,
      observeLoad:()=>({state:'ready',stage:'complete',cause:null})},URL,location:{href:'http://127.0.0.1:1/?room=opaque'},camera:{},
    innerWidth:1280,innerHeight:720,devicePixelRatio:1,
    groundHeight:()=>0,THREE:{Vector3:class {project(){this.x=0;this.y=0;this.z=0;return this;}}},
    renderer:{info:{render:{frame:10}},domElement:{getBoundingClientRect:()=>({left:0,top:0,width:1280,height:720})}}});
  assert.equal(runInContext(`(${observeRenderedUnits.toString()})()`,context),false);
  assert.equal(JSON.stringify(game),before);assert.equal(probe.errors.length,0);assert.equal(probe.last.units[0].actorDraw,true);
  assert.deepEqual(Array.from(probe.last.units[0].uv),u.uv);assert.equal(probe.samples.length,1);
});
test('adapter probe leaves normal menu and room URLs unchanged; diagnostics stay shared-owned',()=>{
  for(const suffix of ['/', '/?room=opaque']){
    let replaced=null;const context=createContext({URL,location:{href:`http://127.0.0.1:1${suffix}`},window:{},
      history:{replaceState:(_a,_b,url)=>{replaced=url;}}});
    runInContext(`(${installUnitProbe.toString()})()`,context);
    assert.equal(replaced,null);
  }
});

test('actual capture consumer retains fallback provenance and rejects false completeness or missing signals',()=>{
  const f=fixture('spearman','north'),result=validateHeadingSamples(f.samples,f.options);
  assert.ok(result.samples.every(s=>s.actionSelection.reason==='idle-placeholder'
    &&s.actionSelection.requestedDirection==='north'&&s.actionSelection.selectedDirection==='north'));
  for(const change of [unit=>{unit.actionSelection.reason='exact';},
    unit=>{unit.actionSelection.selectedDirection='south-east';},unit=>{delete unit.actionSelection;}]) {
    const changed=structuredClone(f.samples);change(changed[0].units[0]);
    assert.throws(()=>validateHeadingSamples(changed,f.options),/action selection provenance/);
  }
});

test('post-render hook consumes the real read-only runtime and bounds provenance reads to owned visible targets',async()=>{
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async url=>({ok:true,json:async()=>JSON.parse(await readFile(new URL(`..${url}`,import.meta.url)))});
  class TextureLoader { load(url,done) {
    const texture=new THREE.Texture({src:url});queueMicrotask(()=>done(texture));return texture;
  } }
  try {
    const scene=new THREE.Scene();
    const runtime=createUnitSpriteRuntime({THREE:{...THREE,TextureLoader},scene,capacity:1,
      teamHex:[0x5aa7d7,0xe67a5e],cameraQuaternion:new THREE.Quaternion(),roles:['spearman']});
    runtime.setCount(0,1);runtime.setVisible(true);assert.equal(await runtime.ready,true);
    const unit={id:42,generation:3,team:0,slot:0,kind:'spearman',hp:35,angle:0,walking:true,
      renderX:0,renderZ:0,scale:1,visible:true,attackStartedAt:0,defeatStartedAt:0};
    runtime.update(unit,1000,1);
    const before=JSON.stringify(unit),buffers=scene.children.map(m=>Array.from(m.instanceMatrix.array));
    const probe={number:0,targets:[42],samples:[],pending:null,errors:[]};
    let reads=0,loadReads=0;
    const context=createContext({units:[Object.freeze(unit),{...unit,id:43,team:1},{...unit,id:44,visible:false}],
      scene,unitSpriteRuntime:{roleForUnit:runtime.roleForUnit,observeAction(...args){reads++;return runtime.observeAction(...args);},
        observeLoad(){loadReads++;return runtime.observeLoad();}},
      window:{__rtsUnitAnimation:probe},localTeam:0,now:1200,selected:new Set(),latestBuildings:[],
      latestFood:[150,150],latestWood:[250,250],latestPopulation:[],latestWorkerProduction:[],
      mapDefinition:{id:mapId},zoom:1.5,unitSpriteReady:true,URL,location:{href:'http://127.0.0.1:1/'},camera:{},
      innerWidth:1280,innerHeight:720,devicePixelRatio:1,groundHeight:()=>0,
      THREE:{Vector3:class {project(){this.x=0;this.y=0;this.z=0;return this;}}},
      renderer:{info:{render:{frame:10}},domElement:{getBoundingClientRect:()=>({left:0,top:0,width:1280,height:720})}}});
    const observe=()=>runInContext(`(${observeRenderedUnits.toString()})()`,context);
    observe();assert.equal(probe.errors.length,0);assert.equal(reads,1);assert.equal(loadReads,1);
    assertUnitLoadReady(probe.last.unitLoad);assertUnitLoadReady(probe.samples[0].unitLoad);
    assert.equal(probe.last.units.length,1);assert.equal(probe.last.units[0].actionSelection.reason,'idle-placeholder');
    assert.equal(probe.samples[0].units[0].actionSelection.selectedDirection,'north');
    assert.equal(JSON.stringify(unit),before);assert.deepEqual(scene.children.map(m=>Array.from(m.instanceMatrix.array)),buffers);
    context.units=Array.from({length:40},(_,id)=>({...unit,id}));
    probe.targets=[];reads=0;loadReads=0;observe();assert.equal(reads,32);assert.equal(loadReads,1);
    assert.equal(probe.last.units.filter(u=>u.actionSelection).length,32);
    probe.targets=[39];reads=0;observe();assert.equal(reads,1);
    assert.equal(probe.last.units.find(u=>u.id===39).actionSelection.reason,'idle-placeholder');
    probe.targets=Array.from({length:40},(_,id)=>id);reads=0;observe();assert.equal(reads,8);
    for(let i=0;i<190;i++)observe();assert.equal(probe.samples.length,180);
    assert.equal(probe.errors.length,0);
  } finally {globalThis.fetch=originalFetch;}
});

test('load acceptance rejects pending, failed, missing and falsely completed diagnostic snapshots',()=>{
  assertUnitLoadReady({state:'ready',stage:'complete',cause:null});
  for(const [value,pattern] of [
    [{state:'pending',stage:'loading',cause:null},/Unit sprite load pending: loading\/none/],
    [{state:'failed',stage:'mask-texture',cause:'rejected'},/Unit sprite load failed: mask-texture\/rejected/],
    [null,/bounded unit sprite load diagnostic/],
    [{state:'ready',stage:'loading',cause:null},/bounded unit sprite load diagnostic/],
    [{state:'ready',stage:'complete',cause:'http'},/bounded unit sprite load diagnostic/],
    [{state:'ready',stage:'complete',cause:null,url:'private'},/bounded unit sprite load diagnostic/],
    [{state:'failed',stage:'private-url',cause:'raw-secret'},/bounded unit sprite load diagnostic/],
  ])assert.throws(()=>assertUnitLoadReady(value),pattern);
});

test('serialized post-render probe observes real pending and failed loaders without any unit census or payload',async()=>{
  const originalFetch=globalThis.fetch,originalWarn=console.warn;
  let release,reads=0;
  globalThis.fetch=()=>new Promise(resolve=>{release=resolve;});console.warn=()=>{};
  try {
    const runtime=createUnitSpriteRuntime({THREE,scene:new THREE.Scene(),capacity:1,roles:['spearman'],
      teamHex:[0x5aa7d7,0xe67a5e],cameraQuaternion:new THREE.Quaternion()});
    const probe={number:0,targets:[],samples:[],pending:null,errors:[]};
    const context=createContext({window:{__rtsUnitAnimation:probe},units:[],selected:new Set(),
      unitSpriteRuntime:{observeLoad(){reads++;return runtime.observeLoad();}},localTeam:0,now:1000,
      mapDefinition:{id:mapId},zoom:1.5,unitSpriteReady:false,latestBuildings:[],latestFood:[],latestWood:[],
      latestPopulation:[],latestWorkerProduction:[],innerWidth:1280,innerHeight:720,devicePixelRatio:1,
      renderer:{info:{render:{frame:10}}}});
    const observe=()=>runInContext(`(${observeRenderedUnits.toString()})()`,context);
    observe();assert.equal(reads,1);assert.equal(probe.last.unitLoad.state,'pending');
    release({ok:false,status:404});assert.equal(await runtime.ready,false);
    observe();assert.equal(reads,2);assert.equal(probe.errors.length,0);
    const plain=JSON.parse(JSON.stringify(probe.last.unitLoad));
    assert.deepEqual(plain,{state:'failed',stage:'manifest-request',cause:'http'});
    assert.throws(()=>assertUnitLoadReady(plain),/Unit sprite load failed: manifest-request\/http/);
    assert.equal(probe.last.units.length,0);
  } finally {globalThis.fetch=originalFetch;console.warn=originalWarn;}
});

test('actual adapter retains truthful load failure or pending timeout evidence before any screenshot (CPU mock)',async()=>{
  const originalFetch=globalThis.fetch;
  globalThis.fetch=localFetch;
  try {
    for(const state of ['failed','pending','invalid']) {
      const directory=await mkdtemp(path.join(os.tmpdir(),'rts-unit-load-consumer-'));
      const unitLoad=state==='failed'?{state,stage:'manifest-request',cause:'http'}:state==='pending'
        ?{state,stage:'loading',cause:null}:{state:'ready',stage:'complete',cause:null,url:'private-secret-do-not-retain'};
      let captures=0,sawFailureBoundary=false;
      const page={cdp:{call:async()=>{},evaluate:async expression=>{
        if(expression==="document.querySelector('#lobby-map').value")return mapId;
        if(expression==="document.querySelector('#lobby-match-mode').value")return 'skirmish@1';
        if(expression==='location.href')return 'http://127.0.0.1:1/?room=fixture';
        if(expression==='window.__rtsUnitAnimation.last')return {unitLoad};
        if(expression==='window.__rtsUnitAnimation.last?.unitLoad??null')return unitLoad;
        return null;
      }},wait:async expression=>{
        if(expression.includes("unitLoad?.state==='failed'")) {
          sawFailureBoundary=true;if(state==='pending')throw new Error('mock timeout');
        }
      }};
      try {
        const result=await run({version:1,page,openPage:async()=>page,origin:'http://127.0.0.1:1',
          evidenceDirectory:directory,source:Object.freeze({revision:'0'.repeat(40),digest:`sha256:${'0'.repeat(64)}`}),
          capture:async()=>{captures++;throw Error('load failure cannot claim a screenshot');}});
        assert.equal(result.status,'failed');assert.ok(sawFailureBoundary);assert.equal(captures,0);
        const report=JSON.parse(await readFile(path.join(directory,'unit-animation-acceptance.json'),'utf8'));
        assert.deepEqual(report.unitLoad,state==='invalid'?null:unitLoad);assert.deepEqual(report.captures,[]);
        assert.equal(JSON.stringify(report).includes('private-secret'),false);
        if(state==='failed')assert.equal(report.issues[0].message,'Unit sprite load failed: manifest-request/http');
      } finally {await rm(directory,{recursive:true,force:true});}
    }
  } finally {globalThis.fetch=originalFetch;}
});
