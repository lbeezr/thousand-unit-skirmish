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
