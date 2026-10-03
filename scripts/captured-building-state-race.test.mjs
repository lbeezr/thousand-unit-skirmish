import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createCapturedBuildingSprite,updateCapturedBuildingSprite,disposeCapturedBuildingSprite} from '../src/captured-building-art.mjs';

test('a late Complete image cannot cover construction fallback, and repair can restore it', async()=>{
 const previous={fetch:globalThis.fetch,Image:globalThis.Image,document:globalThis.document,warn:console.warn};
 const bytes=Buffer.from('controlled-renderer-test-image');
 const manifest={schema:'thousand-unit-skirmish.building-lifecycle-reference.v1',asset:'house',
  camera:{azimuthDegrees:[0],framePixels:[1024,1024],pixelsPerWorldUnit:128,anchorPixelFromTopLeft:[512,647]},
  stateOrder:['complete'],completeState:{views:[{index:0,path:'complete.png',sha256:createHash('sha256').update(bytes).digest('hex')}]}};
 let startDecode,finishDecode;
 const decoding=new Promise(resolve=>{startDecode=resolve;});
 const decoded=new Promise(resolve=>{finishDecode=resolve;});
 globalThis.fetch=async url=>new Response(String(url).endsWith('.json')?JSON.stringify(manifest):bytes);
 globalThis.Image=class {constructor(){this.width=this.naturalWidth=1024;this.height=this.naturalHeight=1024;}decode(){startDecode();return decoded;}};
 globalThis.document={createElement(){return {width:0,height:0,getContext(){return {drawImage(){}};}};}};
 console.warn=()=>{};
 const sprite=createCapturedBuildingSprite({manifestUrl:'https://capture-test.invalid/house-race.json'});
 const camera=new THREE.PerspectiveCamera();camera.position.set(0,10,10);
 try{
  updateCapturedBuildingSprite(sprite,camera,{complete:true,hp:100,maxHp:100});
  await decoding;
  updateCapturedBuildingSprite(sprite,camera,{complete:false,progress:0.5});
  assert.equal(sprite.visible,false);
  finishDecode();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(sprite.visible,false,'late Complete result must not replace construction');
  assert.equal(sprite.material.map,null);
  updateCapturedBuildingSprite(sprite,camera,{complete:true,hp:100,maxHp:100});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(sprite.visible,true,'completed repair can reuse the verified image');
  assert.ok(sprite.material.map);
  updateCapturedBuildingSprite(sprite,camera,{complete:true,hp:20,maxHp:100});
  assert.equal(sprite.visible,false,'Critical with no authored frame yields to fallback');
 }finally{
  disposeCapturedBuildingSprite(sprite);
  globalThis.fetch=previous.fetch;globalThis.Image=previous.Image;globalThis.document=previous.document;console.warn=previous.warn;
 }
});

async function withFailedLifecycleFrame(name, run) {
 const previous={fetch:globalThis.fetch,Image:globalThis.Image,document:globalThis.document,warn:console.warn};
 const bytes=Buffer.from('verified-lifecycle-image');
 const hash=createHash('sha256').update(bytes).digest('hex');
 const view=state=>({index:0,path:`${state}.webp`,sha256:hash});
 const manifest={schema:'thousand-unit-skirmish.building-lifecycle-reference.v1',asset:'town-center',
  camera:{azimuthDegrees:[0],framePixels:[640,640],pixelsPerWorldUnit:128,anchorPixelFromTopLeft:[320,376]},
  stateOrder:['complete','damaged','critical'],completeState:{views:[view('complete')]},
  states:['damaged','critical'].map(state=>({state,views:[view(state)]}))};
 const damaged=Promise.withResolvers(),failed=Promise.withResolvers(),requested=Promise.withResolvers();
 let decoded=Promise.withResolvers();
 globalThis.fetch=async url=>{
  if(String(url).endsWith('.json'))return new Response(JSON.stringify(manifest));
  if(String(url).endsWith('damaged.webp')){requested.resolve();return damaged.promise;}
  return new Response(bytes);
 };
 globalThis.Image=class {width=640;height=640;decode(){decoded.resolve();return Promise.resolve();}};
 globalThis.document={createElement(){return {getContext(){return {drawImage(){}};}};}};
 const warnings=[];
 console.warn=(...args)=>{warnings.push(args);failed.resolve();};
 const sprite=createCapturedBuildingSprite({manifestUrl:`https://capture-test.invalid/${name}/lifecycle.json`});
 const camera=new THREE.PerspectiveCamera();camera.position.set(0,10,10);
 const update=hp=>updateCapturedBuildingSprite(sprite,camera,{complete:true,hp,maxHp:100});
 const show=async hp=>{decoded=Promise.withResolvers();update(hp);await decoded.promise;await new Promise(setImmediate);assert.equal(sprite.visible,true);};
 try {
  await show(100);
  await run({sprite,update,show,damaged,failed,requested,warnings});
 } finally {
  disposeCapturedBuildingSprite(sprite);sprite.material.map?.dispose();sprite.material.dispose();
  globalThis.fetch=previous.fetch;globalThis.Image=previous.Image;globalThis.document=previous.document;console.warn=previous.warn;
 }
}

test('failed lifecycle frames expose fallback instead of the previous Complete artwork', {timeout:3000}, async t=>{
 for(const failure of ['http','hash']) await t.test(failure,async()=>{
  await withFailedLifecycleFrame(`failed-${failure}`,async({sprite,update,damaged,failed,warnings})=>{
   const completeTexture=sprite.material.map;
   update(50);
   damaged.resolve(failure==='http'?new Response('unavailable',{status:503}):new Response('wrong-pixels'));
   await failed.promise;
   assert.equal(sprite.visible,false,'failed Damaged artwork must expose lifecycle fallback');
   assert.equal(sprite.material.map,completeTexture,'hidden texture is retained until a verified replacement');
   assert.match(warnings[0][1].message,failure==='http'?/HTTP 503|returned HTTP 503/:/SHA-256 differs/);
   update(100);await new Promise(setImmediate);
   assert.equal(sprite.visible,true,'repair can restore cached verified Complete artwork');
   assert.equal(sprite.material.map,completeTexture,'repair reuses the immutable verified Complete frame');
  });
 });
});

test('a late failed Damaged request cannot hide a newer verified Critical frame',{timeout:3000},async()=>{
 await withFailedLifecycleFrame('superseded-failure',async({sprite,update,show,damaged,requested,warnings})=>{
  update(50);
  await requested.promise;
  await show(20);
  const criticalTexture=sprite.material.map;
  damaged.resolve(new Response('unavailable',{status:503}));await new Promise(setImmediate);
  assert.equal(sprite.visible,true,'late failure must leave the newest successful frame visible');
  assert.equal(sprite.material.map,criticalTexture);
  assert.deepEqual(warnings,[],'a superseded failure must not report the newer frame as unavailable');
 });
});

test('disposed captured buildings ignore a late failed frame',{timeout:3000},async()=>{
 await withFailedLifecycleFrame('disposed-failure',async({sprite,update,damaged,requested,warnings})=>{
  update(50);await requested.promise;
  disposeCapturedBuildingSprite(sprite);
  damaged.resolve(new Response('unavailable',{status:503}));await new Promise(setImmediate);
  assert.equal(sprite.visible,false);
  assert.equal(sprite.material.map,null);
  assert.equal(sprite.userData.capturedBuildingArt.bodyDepth.visible,false);
  assert.equal(sprite.userData.capturedBuildingArt.bodyDepth.material.map,null);
  assert.deepEqual(warnings,[]);
 });
});
