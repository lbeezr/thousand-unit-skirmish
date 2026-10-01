import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { underboughForestSpecies } from '../src/forest-composition.mjs';
import { forestHabitatDepth } from '../src/forest-habitat.mjs';
const map = JSON.parse(await readFile(new URL('../maps/underbough-rootways.json',import.meta.url)));
const original=JSON.stringify(map),depth=forestHabitatDepth(map),slots=new Map(),counts={};
for(const rect of map.obstacles.filter(o=>o.material==='forest')) for(let row=rect.row;row<rect.row+rect.height;row++) for(let column=rect.column;column<rect.column+rect.width;column++) {
  const cell=row*map.width+column,family=underboughForestSpecies(column,row,map.terrainSeed,depth[cell]);
  slots.set(cell,family);counts[family]=(counts[family]||0)+1;
  assert.equal(family,underboughForestSpecies(column,row,map.terrainSeed,depth[cell]),'seed must reconstruct the same species');
}
assert.equal(slots.size,1026,'composition cannot add or remove harvest cells');
for(const family of ['underbough-root-oak','underbough-moss-hornbeam','underbough-old-plum','underbough-copperleaf','underbough-bramble'])assert(counts[family]>20,`Representative map lost ${family}`);
let agreement=0,pairs=0,changedSeed=0;
for(const [cell,family] of slots) {
  for(const adjacent of [cell+1,cell+map.width])if(slots.has(adjacent)){pairs++;agreement+=slots.get(adjacent)===family;}
  const column=cell%map.width,row=Math.floor(cell/map.width);
  changedSeed+=underboughForestSpecies(column,row,map.terrainSeed+1,depth[cell])!==family;
}
assert(agreement/pairs>.55,'groves must read as coherent groups rather than independent species noise');
assert(changedSeed>slots.size*.1,'authored terrain seed must affect species composition');
assert.equal(JSON.stringify(map),original,'composition must not mutate rules or saved map');
console.log(JSON.stringify({counts,harvestCells:slots.size,neighborAgreement:agreement/pairs,changedSeedCells:changedSeed,mapUnchanged:true}));
