import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {createCapturedBuildingSprite,disposeCapturedBuildingSprite} from '../src/captured-building-art.mjs';
const main=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
const start=main.indexOf('function pickBuildingAt(');
const source=main.slice(start,main.indexOf('\n}',start)+2);
function image(alpha){const data=new Uint8Array(8*8*4);for(let y=0;y<8;y++)for(let x=0;x<8;x++)data[(y*8+x)*4+3]=alpha(x,y);return {data,width:8,height:8};}
function fixture(alpha){
 const camera=new THREE.OrthographicCamera(-2,2,2,-2,.1,20);camera.position.set(0,0,5);camera.lookAt(0,0,0);camera.updateMatrixWorld();
 const visuals=new Map(),sprites=[];
 for(const [id,z,pixels] of [[1,0,image(()=>255)],[2,1,image(alpha)]]){
  const group=new THREE.Group();group.position.z=z;
  const sprite=createCapturedBuildingSprite();sprites.push(sprite);sprite.material.map=new THREE.Texture(pixels);sprite.material.map.flipY=true;sprite.visible=true;sprite.scale.set(2,2,1);group.add(sprite);
  const fallback=new THREE.Mesh(new THREE.BoxGeometry(2,2,.2),new THREE.MeshBasicMaterial());fallback.position.z=.5;fallback.visible=false;group.add(fallback);
  visuals.set(id,{group});group.updateMatrixWorld(true);
 }
 const context=vm.createContext({THREE,camera,localTeam:0,latestBuildings:[{id:1,type:'farm',team:0},{id:2,type:'dock',team:0}],buildingVisuals:visuals,
  pointerNdc:new THREE.Vector2(),raycaster:new THREE.Raycaster(),renderer:{domElement:{getBoundingClientRect:()=>({width:400,height:400})}}});
 vm.runInContext(source,context);
 return {sprites,pick:(x,y=0)=>context.pickBuildingAt((x/2*.5+.5)*400,(-y/2*.5+.5)*400),dispose(){for(const sprite of sprites){sprite.material.map.dispose();disposeCapturedBuildingSprite(sprite);}for(const visual of visuals.values())visual.group.traverse(o=>{if(!o.isSprite){o.geometry?.dispose();o.material?.dispose();}});}};
}
test('real building picker exposes the Farm through transparent foreground Dock padding and hidden fallback geometry',()=>{
 const f=fixture(x=>x<4?0:255);try{assert.equal(f.pick(-.5).id,1);assert.equal(f.pick(.5).id,2);f.sprites[1].visible=false;assert.equal(f.pick(.5).id,1);}finally{f.dispose();}
});
test('captured picker samples the actual texture flip and excludes transparent preview bodies',()=>{
 const f=fixture((x,y)=>y<4?255:0);try{assert.equal(f.pick(0,.5).id,2);f.sprites[1].material.map.flipY=false;assert.equal(f.pick(0,.5).id,1);const preview=createCapturedBuildingSprite({preview:true});const hits=[];preview.raycast({},hits);assert.deepEqual(hits,[]);disposeCapturedBuildingSprite(preview);}finally{f.dispose();}
});
