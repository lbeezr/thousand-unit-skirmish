import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { UNIT_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { canTraverseUnitStep } from '../src/unit-movement.mjs';
import { runAttackQueueCase } from './attack-queue-case.mjs';
import './focused-attack-journeys.mjs';

const source=readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
const start=source.indexOf('function getUnitAttackPath('),end=source.indexOf('\nfunction ',start+1);
const width=16,cell=(x,z)=>Math.floor(z+8)*width+Math.floor(x+8),point=c=>({x:c%width-7.5,z:Math.floor(c/width)-7.5});
function fixture(){
  const components=new Int32Array(width*width);components.fill(0);
  for(let row=0;row<width;row++)for(let col=8;col<width;col++)components[row*width+col]=-1;
  const context=vm.createContext({UNIT_DEFINITIONS,MAP_WIDTH:width,MAP_HEIGHT:width,worldToCell:cell,
    canTraverseUnitStep,elevationLevelByCell:new Uint8Array(width*width),isWalkable:c=>components[c]>=0,
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
test('continued pursuit finishes a legal waypoint; a new attack immediately replaces the old route',()=>{
  const c=fixture(),waypoint=cell(-1.5,.5),unit={kind:'infantry',x:-2.2,z:.2,path:[waypoint],pathIndex:0};
  const target={id:9,x:-6.5,z:.5};
  assert.equal(c.getUnitAttackPath(unit,target,null,true).path[0],waypoint);
  assert.notEqual(c.getUnitAttackPath(unit,target).path[0],waypoint);
  assert.deepEqual(unit.path,[waypoint],'computing the continuation does not mutate the existing route');
});
test('continued pursuit discards a blocked or cliff waypoint and still rejects unreachable water targets',()=>{
  const c=fixture(),blocked=cell(.5,.5),unit={kind:'infantry',x:-.5,z:.5,path:[blocked],pathIndex:0};
  assert.notEqual(c.getUnitAttackPath(unit,{id:9,x:-6.5,z:.5},null,true).path[0],blocked);
  const cliff=cell(-1.5,.5);unit.path=[cliff];c.elevationLevelByCell[cliff]=2;
  assert.notEqual(c.getUnitAttackPath(unit,{id:9,x:-6.5,z:.5},null,true).path[0],cliff);
  c.elevationLevelByCell[cliff]=0;
  const unreachable=c.getUnitAttackPath(unit,{id:9,x:3.5,z:.5},null,true);
  assert.equal(unreachable.reachable,false);assert.equal(unreachable.path.length,0);
});
test('continuous in-range attacks stop immediately even while continuing a previous waypoint',()=>{
  const c=fixture(),unit={kind:'infantry',x:-.5,z:.5,path:[cell(-1.5,.5)],pathIndex:0};
  const approach=c.getUnitAttackPath(unit,{id:9,x:-.5,z:1},null,true);
  assert.equal(approach.reachable,true);assert.equal(approach.path.length,0);
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
