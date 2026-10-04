import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createNeutralWildlifeRenderer, wildlifePresentation } from '../src/neutral-wildlife-renderer.mjs';

const definition = {id:'pasture-1',type:'food',stock:100,x:2,z:-3,wildlifeSpecies:'bellweather-sheep'};
const row = (wildlifeState, stock=100) => ({id:definition.id,type:'food',stock,wildlifeSpecies:'bellweather-sheep',wildlifeState});
const camera = new THREE.OrthographicCamera(-2,2,2,-2,.1,100);
camera.position.set(.78,1.12,.78).normalize().multiplyScalar(10);
camera.lookAt(0,0,0);camera.updateMatrixWorld();
const fallback = () => Promise.reject(new Error('not available'));
const mapDefinition = Object.freeze({ width: 96, height: 64 });
const relocated = (wildlifeState = 'alive', wildlifeTeam = null) => ({
 ...row(wildlifeState, wildlifeState === 'alive' ? 100 : wildlifeState === 'carcass' ? 40 : 0),
 x: 43.5, z: -23.5, wildlifeHeading: Math.PI / 2, wildlifeTeam,
 ...(wildlifeState === 'alive' ? { wildlifeActivity: 'wandering' } : {}),
});

test('only consistent known authoritative species/lifecycle/stock is represented', () => {
 assert.equal(wildlifePresentation(definition,row('alive'),true),'alive');
 assert.equal(wildlifePresentation(definition,row('carcass',.25),true),'carcass');
 assert.equal(wildlifePresentation(definition,row('depleted',0),true),'depleted');
 for(const patch of [
  {wildlifeState:undefined},{wildlifeState:'walk'},{wildlifeState:'alive',stock:99},
  {wildlifeState:'carcass',stock:0},{wildlifeState:'depleted',stock:1},
  {stock:NaN},{stock:-1},{stock:101},{wildlifeSpecies:'deer'},{type:'wood'},{id:'other'},
 ]) assert.equal(wildlifePresentation(definition,{...row('alive'),...patch},true),'hidden');
 assert.equal(wildlifePresentation(definition,row('alive'),false),'hidden');
 assert.equal(wildlifePresentation(definition,row('alive'),undefined),'hidden');
 assert.equal(wildlifePresentation({...definition,wildlifeState:'alive'},row('alive'),true),'hidden');
 assert.equal(wildlifePresentation({...definition,id:undefined},null,true),'hidden');
});

test('alive, carcass and depleted are distinct; omitted/fogged nodes are immediately hidden', async () => {
 const scene=new THREE.Scene(),renderer=createNeutralWildlifeRenderer({THREE,scene,groundHeight:()=>.8,loadArt:fallback});
 renderer.reset([definition]);await renderer.ready();
 assert.equal(scene.children.length,1);
 assert.equal(scene.children[0].visible,false,'authoring alone supplies no live state');
 renderer.reconcile([row('alive')],()=>true);renderer.update(camera);
 assert.deepEqual(renderer.diagnostics().nodes,[{id:definition.id,state:'alive',mode:'sheep-proxy',visible:true}]);
 assert.deepEqual(scene.children[0].position.toArray(),[2,.8,-3]);
 assert.equal(renderer.isAvailable(definition.id),true);
 renderer.reconcile([row('carcass',40)],()=>true);renderer.update(camera);
 assert.equal(renderer.diagnostics().nodes[0].mode,'food-cache-marker');
 assert.equal(scene.children[0].children[0].visible,false,'live proxy cannot become carcass art');
 assert.equal(scene.children[0].children[1].visible,true);
 renderer.reconcile([row('depleted',0)],()=>true);
 assert.equal(renderer.isAvailable(definition.id),false);
 assert.equal(scene.children[0].visible,false);
 renderer.reconcile([row('alive')],()=>false);assert.equal(scene.children[0].visible,false);
 renderer.reconcile([row('alive')],()=>true);
 renderer.reconcile([],()=>true);assert.equal(scene.children[0].visible,false);
 renderer.reconcile([row('alive'),row('alive')],()=>true);assert.equal(scene.children[0].visible,false);
 renderer.reset([definition, definition]);assert.equal(scene.children.length,0,'ambiguous authored IDs cannot orphan scene objects');
 renderer.dispose();assert.equal(scene.children.length,0);
});

test('late art load cannot resurrect a carcass; authoritative rematch may restore alive', async () => {
 const waiting=Promise.withResolvers();let loads=0,disposed=0,updates=0;
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial());
 const template={mesh,supports:state=>state.directionId==='north',update: state=>{updates++;assert.equal(state.directionId,'north');assert.equal(state.moving,false);return true;},dispose:()=>{disposed++;}};
 const renderer=createNeutralWildlifeRenderer({THREE,scene:new THREE.Scene(),groundHeight:()=>0,loadArt:()=>{loads++;return waiting.promise;}});
 renderer.reset([definition]);
 renderer.reconcile([row('carcass',80)],()=>true);renderer.update(camera);
 waiting.resolve(template);await renderer.ready();renderer.update(camera);
 assert.equal(renderer.diagnostics().nodes[0].mode,'food-cache-marker');
 assert.equal(updates,0);
 renderer.reconcile([row('depleted',0)],()=>true);renderer.update(camera);assert.equal(updates,0);
 renderer.reconcile([row('alive')],()=>true);renderer.update(camera);
 assert.equal(renderer.diagnostics().nodes[0].mode,'static-illustration');
 assert.equal(updates,1);
 renderer.reset([definition]);renderer.reconcile([row('alive')],()=>true);renderer.update(camera);
 assert.equal(loads,1,'one verified template is shared across nodes and resets');
 renderer.dispose();assert.equal(disposed,1);
 mesh.geometry.dispose();mesh.material.dispose();
});

test('ordinary food never becomes wildlife and failed/late loaders preserve explicit fallbacks', async () => {
 const waiting=Promise.withResolvers();const scene=new THREE.Scene();let disposed=0;
 const renderer=createNeutralWildlifeRenderer({THREE,scene,groundHeight:()=>0,loadArt:()=>waiting.promise});
 renderer.reset([{...definition,wildlifeSpecies:undefined}]);await renderer.ready();
 assert.equal(scene.children.length,0);
 renderer.reset([definition]);renderer.dispose();
 waiting.resolve({dispose:()=>{disposed++;}});await renderer.ready();
 assert.equal(scene.children.length,0);assert.equal(disposed,1);
 const failed=createNeutralWildlifeRenderer({THREE,scene,groundHeight:()=>0,loadArt:()=>{throw new Error('decode failed');}});
 failed.reset([definition]);await failed.ready();failed.reconcile([row('alive')],()=>true);failed.update(camera);
 assert.equal(failed.diagnostics().artStatus,'fallback');assert.equal(failed.diagnostics().nodes[0].mode,'sheep-proxy');
 failed.dispose();
});


test('disclosed motion moves art, facing and click coordinates; missing/invalid rows hide immediately', async () => {
 const scene=new THREE.Scene();let pose;
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial());
 const template={mesh,supports:()=>true,update:value=>{pose=value;return true;},dispose:()=>{}};
 const renderer=createNeutralWildlifeRenderer({THREE,scene,groundHeight:(x,z)=>x+z,loadArt:()=>template});
 renderer.reset([definition]);await renderer.ready();
 const snapshot={...row('alive'),x:definition.x+.2,z:definition.z+.1,wildlifeHeading:Math.PI/2,wildlifeActivity:'wandering'};
 let fogPoint;
 renderer.reconcile([snapshot],point=>{fogPoint=point;return true;});renderer.update(camera);
 assert.equal(fogPoint.x,snapshot.x);
 assert.deepEqual(renderer.positionFor(definition.id),{x:snapshot.x,z:snapshot.z});
 assert.deepEqual(scene.children[0].position.toArray(),[snapshot.x,snapshot.x+snapshot.z,snapshot.z]);
 assert.equal(pose.directionId,'east');assert.equal(pose.moving,false,'directional idle art has no invented walk clip');
 renderer.reconcile([{...snapshot,wildlifeState:'carcass',stock:40,wildlifeActivity:undefined}],()=>true);
 renderer.update(camera);assert.deepEqual(renderer.positionFor(definition.id),{x:snapshot.x,z:snapshot.z});
 for(const patch of [{x:definition.x+1},{x:Infinity},{wildlifeHeading:NaN},{wildlifeActivity:'running'}]) {
   renderer.reconcile([{...snapshot,...patch}],()=>true);assert.equal(renderer.positionFor(definition.id),null);
   assert.equal(renderer.isAvailable(definition.id),false);
 }
 renderer.reconcile([snapshot],()=>true);renderer.reconcile([],()=>true);renderer.update(camera);
 assert.equal(renderer.positionFor(definition.id),null);assert.equal(scene.children[0].visible,false);
 renderer.dispose();mesh.geometry.dispose();mesh.material.dispose();
});

test('map context admits far authoritative positions for neutral and both owners, preserving lifecycle validity', () => {
 for (const team of [null, 0, 1]) for (const state of ['alive', 'carcass', 'depleted']) {
   const snapshot = relocated(state, team);
   assert.equal(wildlifePresentation(definition, snapshot, true, mapDefinition), state);
   assert.equal(wildlifePresentation(definition, snapshot, false, mapDefinition), 'hidden', 'ownership grants no sight');
 }
 for (const patch of [
   {x: undefined}, {z: undefined}, {x: NaN}, {z: Infinity}, {x: '43.5'}, {z: null},
   {wildlifeTeam: 2}, {wildlifeTeam: '0'}, {wildlifeHeading: -1}, {wildlifeHeading: Math.PI * 2},
   {wildlifeHeading: NaN}, {wildlifeActivity: 'running'}, {wildlifeState: 'alive', stock: 99},
   {wildlifeSpecies: 'deer'}, {wildlifeState: 'carcass', stock: 0},
   {wildlifeState: 'depleted', stock: 1}, {stock: 101}, {type: 'wood'}, {id: 'other'},
 ]) assert.equal(wildlifePresentation(definition, {...relocated(), ...patch}, true, mapDefinition), 'hidden');
 assert.equal(wildlifePresentation(definition, row('alive'), true, mapDefinition), 'hidden', 'map-aware rows never invent missing positions');
 assert.equal(wildlifePresentation({...definition,x:NaN}, relocated(), true, mapDefinition), 'hidden');
 assert.equal(wildlifePresentation(definition, {...relocated('carcass'),wildlifeHeading:Infinity}, true, mapDefinition), 'hidden');
});

test('map edges follow authoritative cell bounds; malformed context cannot fall back to authored coordinates', () => {
 for (const point of [
   {x:-48,z:0}, {x:0,z:-32}, {x:48-1e-9,z:32-1e-9}, {x:-48,z:-32},
 ]) assert.equal(wildlifePresentation(definition,{...relocated(),...point},true,mapDefinition),'alive');
 for (const point of [{x:48,z:0},{x:0,z:32},{x:-48-1e-9,z:0},{x:0,z:-32-1e-9}]) {
   assert.equal(wildlifePresentation(definition,{...relocated(),...point},true,mapDefinition),'hidden');
 }
 for (const map of [null, {}, {width:96}, {width:0,height:64}, {width:96,height:-64},
   {width:96.5,height:64}, {width:'96',height:64}, {width:Infinity,height:64},
   {width:Number.MAX_SAFE_INTEGER,height:Number.MAX_SAFE_INTEGER}]) {
   assert.equal(wildlifePresentation(definition,{...relocated(),x:definition.x,z:definition.z},true,map),'hidden');
 }
 assert.equal(wildlifePresentation(definition,row('alive'),true),'alive','omitted legacy coordinates retain the authored fallback');
 assert.equal(wildlifePresentation(definition,{...row('alive'),x:definition.x+.2,z:definition.z},true),'alive');
 assert.equal(wildlifePresentation(definition,relocated(),true),'hidden','without map context the original .35 bound still applies');
});

test('relocated live proxies and carcass markers use actual pose for all ownership values', async () => {
 const scene = new THREE.Scene(), heights = [];
 const renderer = createNeutralWildlifeRenderer({THREE,scene,groundHeight:(x,z)=>{heights.push({x,z});return (x+z)/100;},loadArt:fallback});
 renderer.reset([definition],mapDefinition);await renderer.ready();
 for (const team of [null,0,1]) for (const state of ['alive','carcass']) {
   const snapshot = Object.freeze({...relocated(state,team),wildlifeHeading:3*Math.PI/2});
   renderer.reconcile([snapshot],point=>point.x===snapshot.x && point.z===snapshot.z);
   renderer.update(camera);
   assert.equal(renderer.isAvailable(definition.id),true);
   assert.deepEqual(renderer.positionFor(definition.id),{x:snapshot.x,z:snapshot.z});
   assert.deepEqual(scene.children[0].position.toArray(),[snapshot.x,(snapshot.x+snapshot.z)/100,snapshot.z]);
   assert.deepEqual(heights.at(-1),{x:snapshot.x,z:snapshot.z});
   assert.equal(scene.children[0].children[0].visible,state==='alive');
   assert.equal(scene.children[0].children[1].visible,state==='carcass');
   assert.equal(scene.children[0].children[0].rotation.y,snapshot.wildlifeHeading);
   assert.equal(renderer.diagnostics().nodes[0].mode,state==='alive'?'sheep-proxy':'food-cache-marker');
 }
 renderer.dispose();
});

test('far static art retains admitted direction binding without new clips; lifecycle and fog hide immediately', async () => {
 const scene = new THREE.Scene();let pose,updates=0;
 const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial());
 const template = {mesh,supports:()=>true,update:value=>{pose=value;updates++;return true;},dispose:()=>{}};
 const renderer = createNeutralWildlifeRenderer({THREE,scene,groundHeight:()=>.8,loadArt:()=>template});
 renderer.reset([definition],mapDefinition);await renderer.ready();
 const snapshot = relocated('alive',1);
 renderer.reconcile([snapshot],()=>true);renderer.update(camera);
 assert.equal(renderer.diagnostics().nodes[0].mode,'static-illustration');
 assert.deepEqual(scene.children[0].position.toArray(),[snapshot.x,.8,snapshot.z]);
 assert.equal(pose.directionId,'east');assert.equal(pose.stateId,'idle');assert.equal(pose.moving,false);
 renderer.reconcile([{...relocated('carcass',1),x:-31.5,z:17.5,wildlifeHeading:Math.PI}],()=>true);renderer.update(camera);
 assert.deepEqual(renderer.positionFor(definition.id),{x:-31.5,z:17.5});
 assert.deepEqual(scene.children[0].position.toArray(),[-31.5,.8,17.5]);
 assert.equal(renderer.diagnostics().nodes[0].mode,'food-cache-marker');assert.equal(updates,1,'carcass cannot reuse live static art');
 for (const snapshots of [[relocated('depleted',1)], [], [snapshot,snapshot], [{...snapshot,x:Infinity}]]) {
   renderer.reconcile(snapshots,()=>true);
   assert.equal(scene.children[0].visible,false);assert.equal(renderer.isAvailable(definition.id),false);
   assert.equal(renderer.positionFor(definition.id),null);
 }
 const checked = [];
 renderer.reconcile([snapshot],point=>{checked.push(point);return point.x===definition.x && point.z===definition.z;});
 assert.deepEqual(checked,[snapshot],'fog receives the disclosed current point, never the authored origin');
 assert.equal(scene.children[0].visible,false,'own Sheep remains hidden when its actual cell is fogged');
 assert.equal(renderer.positionFor(definition.id),null);
 renderer.reconcile([snapshot],()=>true);renderer.reconcile([],()=>{throw new Error('omitted row must not borrow authored sight');});
 renderer.update(camera);assert.equal(scene.children[0].visible,false);
 renderer.reconcile([snapshot,snapshot],()=>{throw new Error('ambiguous row supplies no visibility point');});
 renderer.reconcile([{...snapshot,z:undefined}],()=>{throw new Error('incomplete point supplies no visibility point');});
 renderer.dispose();mesh.geometry.dispose();mesh.material.dispose();
});

test('reset replaces map bounds without retaining a prior map or mutating caller definitions and snapshots', async () => {
 const scene = new THREE.Scene(), map = {width:96,height:64};
 const renderer = createNeutralWildlifeRenderer({THREE,scene,groundHeight:()=>0,loadArt:fallback});
 renderer.reset([Object.freeze({...definition})],map);await renderer.ready();
 map.width=4;map.height=4;
 const snapshot = Object.freeze(relocated());
 renderer.reconcile([snapshot],()=>true);renderer.update(camera);
 assert.equal(renderer.isAvailable(definition.id),true,'reset captures map dimensions, rather than a mutable external object');
 renderer.reset([definition],{width:48,height:32});renderer.reconcile([snapshot],()=>true);
 assert.equal(renderer.isAvailable(definition.id),false,'a new smaller map rejects the old far coordinate');
 renderer.reset([definition]);renderer.reconcile([row('alive')],()=>true);renderer.update(camera);
 assert.equal(renderer.isAvailable(definition.id),true,'legacy reset discards previous map context');
 assert.deepEqual(renderer.positionFor(definition.id),{x:definition.x,z:definition.z});
 renderer.reset([definition,definition],mapDefinition);assert.equal(scene.children.length,0);
 renderer.dispose();
});
