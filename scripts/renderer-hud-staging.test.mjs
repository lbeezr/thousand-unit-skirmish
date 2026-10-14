// CPU contracts only: these fixtures establish no rendered game frames.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { HUD_PUBLIC_FILES, HUD_CASES, hudMatrix, identifyHudSource, runHudStaging } from './renderer-hud-staging.mjs';
import { hudFixture, hudInputReady, validateHudFrame, HUD_BUILDING_SEQUENCE } from './renderer-hud-staging-scenario.mjs';
import { STAGING_ORIGIN } from './renderer-roster-audio-plan.mjs';
import { mapSizeIdentity } from '../src/map-size-policy.mjs';
import { teamPopulation } from '../src/rules/population.mjs';
import { BUILDING_DEFINITIONS, UNIT_DEFINITIONS } from '../src/gameplay-definitions.mjs';

const revision='a'.repeat(40);
test('native control readiness waits through recovery and closed sockets without blocking menu entry',()=>{
  const read=(entry,state,connection)=>vm.runInNewContext(`(${hudInputReady.toString()})()`,{
    window:{__rtsBrowserRecoverySnapshot:()=>state}, document:{documentElement:{dataset:{entry}},
      querySelector:()=>({textContent:connection})}});
  assert.equal(read('menu',undefined,undefined),true);
  assert.equal(read(undefined,undefined,undefined),false);
  assert.equal(read('game',undefined,'ROOM LIVE'),false);
  for(const socketState of [0,1,2,3]) for(const recovering of [true,false]) {
    assert.equal(read('game',{socketState,recovering},'ROOM LIVE'),socketState===1&&!recovering);
  }
  assert.equal(read('game',{socketState:1,recovering:false},'SYNCING CURRENT STATE'),false);
  assert.equal(read('game',{socketState:1,recovering:false},'WAITING FOR PLAYER 2'),true);
});
test('explicit bounded subsets and authored fixtures cannot dispatch arbitrary work',()=>{
  assert.deepEqual(hudMatrix('all'),['rollout']);
  for(const id of HUD_CASES) { assert.deepEqual(hudMatrix(id),[id]); const map=hudFixture(id);
    assert.equal(mapSizeIdentity(map).ordinarySelectable,true);
    assert.equal(map.id,`hud-${id}`); assert.equal(map.startingArmySize,24); assert.deepEqual(map.scenarioEvents,[]); }
  for(const bad of ['','../secret','all,selections','shell','buildings;echo']) { assert.throws(()=>hudMatrix(bad)); assert.throws(()=>hudFixture(bad)); }
});
test('the paid staged opening has capacity and stock for its two-entry cancellation queue',()=>{
  const map=hudFixture('buildings');
  const units=Array.from({length:map.startingArmySize/2},()=>({team:0,kind:'infantry',hp:100}));
  for(const kind of ['worker','infantry']) units.push({team:0,kind,hp:100});
  const buildings=HUD_BUILDING_SEQUENCE.map(type=>({team:0,type,complete:true,
    productionQueue:type==='barracks'?['infantry','spearman']:[]}));
  const state={units,buildings,workerProduction:[{},{}],openingArmySize:map.startingArmySize};
  const population=teamPopulation(state,0);
  assert.ok(population.used+population.reserved<=population.capacity,'paid House must admit the real mixed queue');
  const withoutHouse=teamPopulation({...state,buildings:buildings.filter(b=>b.type!=='house')},0);
  assert.ok(withoutHouse.used+withoutHouse.reserved>withoutHouse.capacity,'the original opening cannot admit both queued units');
  const purchases=[...HUD_BUILDING_SEQUENCE.map(type=>BUILDING_DEFINITIONS[type]),
    ...['worker','infantry','infantry','spearman'].map(kind=>UNIT_DEFINITIONS[kind])];
  for(const resource of ['food','wood']) assert.ok(purchases.reduce((sum,rule)=>sum+rule.cost[resource],0)<=map.startingResources[resource]);
});
test('source verification is staging-only, omits credentials and rejects drift/redirect/error',async()=>{
  const seen=[],read=async file=>Buffer.from(file);
  const fetcher=async (url,options)=>{ seen.push(options); return new Response(new URL(url).pathname.slice(1)); };
  const receipt=await identifyHudSource(STAGING_ORIGIN,revision,{fetcher,read});
  assert.equal(receipt.deployedRevision,null); assert.equal(receipt.releaseDigest,null); assert.equal(receipt.files.length,HUD_PUBLIC_FILES.length);
  assert.ok(seen.every(o=>o.credentials==='omit'&&o.redirect==='error'&&!o.headers));
  await assert.rejects(identifyHudSource('https://example.com',revision,{fetcher,read}));
  await assert.rejects(identifyHudSource(STAGING_ORIGIN,revision,{fetcher:async()=>new Response('different'),read}));
  await assert.rejects(identifyHudSource(STAGING_ORIGIN,revision,{fetcher:async()=>new Response('',{status:302}),read}));
});
test('frame contracts reject stale state, substituted map/context/origin, fonts and wrong image dimensions',()=>{
  const bytes=Buffer.alloc(12000); Buffer.from('89504e470d0a1a0a','hex').copy(bytes); bytes.writeUInt32BE(1280,16); bytes.writeUInt32BE(720,20);
  const view={origin:STAGING_ORIGIN,entry:'game',boot:'ready',mapId:'hud-selections',team:0,context:'workers',connection:'ROOM LIVE',
    tick:12,socketState:1,recovering:false,fonts:true,viewport:{width:1280,height:720,dpr:1}};
  validateHudFrame(view,'hud-selections','workers',bytes,11);
  for(const change of [{origin:'https://example.com'},{entry:'menu'},{boot:'loading'},{mapId:'wrong'},{team:2},{context:'mixed'},
    {tick:11},{socketState:3},{recovering:true},{connection:null},{fonts:false},{viewport:{width:1024,height:768,dpr:1}},{viewport:{width:1280,height:720,dpr:2}}]) {
    assert.throws(()=>validateHudFrame({...view,...change},'hud-selections','workers',bytes,11));
  }
});
test('unqualified runtime and public source failure prevent browser navigation; failures retain no private error text',async()=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'hud-staging-test-')),preflightFile=path.join(directory,'preflight.json');
  await writeFile(preflightFile,JSON.stringify({status:'ready',webglReadbackPassed:true,sandbox:'enabled',launchAttempts:1,source:{revision,dirty:false}}));
  let opens=0;
  const dependencies={platform:'linux',source:()=>({revision,dirty:false}),openBrowser:async()=>{opens++;throw Error('must not open');},identify:async()=>{throw Error('private-credential');}};
  try {
    await assert.rejects(runHudStaging({subset:'selections',revision,directory:path.join(directory,'mac'),preflightFile},{...dependencies,platform:'darwin'}));
    const result=await runHudStaging({subset:'selections',revision,directory:path.join(directory,'failed'),preflightFile},dependencies);
    assert.equal(result.status,'failed'); assert.equal(opens,0); assert.doesNotMatch(JSON.stringify(result),/private-credential/);
    assert.equal(JSON.parse(await readFile(path.join(directory,'failed','qualification.json'),'utf8')).appearanceReview,'pending');
  } finally {await rm(directory,{recursive:true,force:true});}
});
test('workflow remains manual, source-pinned, read-only, serial and bounded',async()=>{
  const text=await readFile(new URL('../.github/workflows/hud-staging-capture.yml',import.meta.url),'utf8');
  assert.match(text,/workflow_dispatch:/); assert.match(text,/contents: read/); assert.match(text,/max-parallel: 1/);
  assert.match(text,/timeout-minutes: 10/); assert.match(text,/ref: \$\{\{ github.sha \}\}/); assert.match(text,/if: always\(\)/);
  assert.doesNotMatch(text,/secrets\.|pull_request_target|--no-sandbox|RTS_ACCESS_PASSWORD/);
});
