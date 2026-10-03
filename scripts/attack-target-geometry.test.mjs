import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { UNIT_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { runAttackQueueCase } from './attack-queue-case.mjs';

const source=readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
const start=source.indexOf('function getUnitAttackPath('),end=source.indexOf('\nfunction ',start+1);
const width=16,cell=(x,z)=>Math.floor(z+8)*width+Math.floor(x+8),point=c=>({x:c%width-7.5,z:Math.floor(c/width)-7.5});
function fixture(){
  const components=new Int32Array(width*width);components.fill(0);
  for(let row=0;row<width;row++)for(let col=8;col<width;col++)components[row*width+col]=-1;
  const context=vm.createContext({UNIT_DEFINITIONS,MAP_WIDTH:width,MAP_HEIGHT:width,worldToCell:cell,
    nearestOpenCell:c=>components[c]<0?Math.floor(c/width)*width+7:c,walkableComponents:components,
    cellIndex:(x,z)=>z*width+x,cellToWorld:point,attackFlowFields:new Map(),
    getAttackFlowField:goal=>({goal}),getAttackFlowFieldForGoals:goals=>({goal:goals[0],goals:new Set(goals)}),
    pathFromAttackFlow:(from,field)=>from===field.goal?[]:[field.goal]});
  vm.runInContext(source.slice(start,end),context);return context;
}
test('a visible water target outside all reachable firing positions is unreachable',()=>{
  const context=fixture(),unit={kind:'infantry',x:-.5,z:.5},target={id:9,x:3.5,z:.5};
  assert.equal(context.getUnitAttackPath(unit,target).reachable,false,
    'snapping the enemy to a land cell cannot create an in-range approach');
});
for(const team of [0,1])test(`seat ${team}: queued move continues when an initially shootable Skiff retreats beyond all land firing positions`,async()=>{
  await runAttackQueueCase({team});
});
test('existing in-range shots and legal ranged shore approaches remain available',()=>{
  const c=fixture();
  assert.equal(c.getUnitAttackPath({kind:'infantry',x:-.5,z:.5},{id:9,x:.5,z:.5}).reachable,true);
  const approach=c.getUnitAttackPath({kind:'archer',x:-3.5,z:.5},{id:9,x:3.5,z:.5});
  assert.equal(approach.reachable,true);
  for(const goal of approach.path){const p=point(goal);assert.ok(Math.hypot(p.x-3.5,p.z-.5)<=UNIT_DEFINITIONS.archer.combat.range);}
  assert.equal(c.getUnitAttackPath({kind:'archer',x:-.5,z:.5},{id:9,x:7.5,z:.5}).reachable,false);
});
for(const team of [0,1])for(const orderType of ['attack','attackMove'])for(const mode of ['dead','hidden','unreachable']) {
  if(orderType==='attack'&&mode==='unreachable')continue;
  test(`seat ${team}: ${orderType} releases queued attack-move after target ${mode}`,async()=>{
    await runAttackQueueCase({team,mode,orderType,queuedType:'attackMove'});
  });
}
for(const team of [0,1])for(const interrupt of ['stop','holdPosition'])test(`seat ${team}: ${interrupt} cancels pursuit and queue without chasing retreat`,async()=>{
  await runAttackQueueCase({team,interrupt});
});
