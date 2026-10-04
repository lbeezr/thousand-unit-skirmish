import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { createUnitRouteResult, unitRoutePathCost, unitRouteResultIsCurrent, activeLandMovementBodyRadius } from '../src/unit-movement.mjs';
import { canTraverseFlatUnitSegment } from '../src/unit-path-line.mjs';

const source=readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
const body=name=>{
  const start=source.indexOf(`function ${name}(`),end=source.indexOf('\nfunction ',start+1);
  assert.ok(start>=0&&end>start);return source.slice(start,end);
};
function fixture({clockStep=0,expandedPerSearch=50,count=24}={}) {
  let clock=0;const searches=[],notices=[],samples=[];
  const units=Array.from({length:count},(_,id)=>({id,team:0,x:0,z:0,hp:100,orderRevision:1,
    path:[],pathIndex:0,movePlanningPending:true,moveGoalCell:-1,attackMove:false}));
  const assignments=units.map((unit,i)=>({unit,revision:1,destination:100+i}));
  const job={epoch:0,orderId:1,player:{team:0},orderLabel:'MOVE ORDER',clientOrderToken:21,
    assignments,groups:[[1,assignments]],nextGroup:0,reservedDestinations:new Set(assignments.map(a=>a.destination)),
    diagnostics:{searchCount:0,expandedCells:0,discoveredCells:0},startedAt:0,planningWorkMs:0,
    maxPlanningSliceMs:0,planningSliceCount:0,buildingTargetId:null};
  const context=vm.createContext({units,activeMovePlanningJob:job,movePlanningEpoch:0,movePlanningQueue:[],
    MOVE_PLANNING_SLICE_BUDGET_MS:5,MOVE_PLANNING_MAX_WORK_ITEMS_PER_SLICE:8,
    MOVE_PLANNING_MAX_EXPANDED_CELLS_PER_SLICE:4096,TICK_RATE:30,tickNumber:0,dirty:false,navigationRevision:1,
    pendingMoveStartBroadcasts:new Set(),movePlanningServiceTick:null,performance:{now:()=>{clock+=clockStep;return clock;}},
    nearestOpenCell:c=>c,worldToCell:()=>1,
    MAP_WIDTH:96,MAP_HALF_X:0,MAP_HALF_Z:0,WALK_SPEED:4.5,STEP_SECONDS:1/30,elevationLevelByCell:new Uint8Array(96*96),
    isWalkable:()=>true,canTraverseFlatUnitSegment,createUnitRouteResult,unitRoutePathCost,unitRouteResultIsCurrent,activeLandMovementBodyRadius,cellToWorld:c=>({x:c%96+.5,z:Math.floor(c/96)+.5}),
    findPathAStar(start,destination,diagnostics){
      searches.push(destination);diagnostics.searchCount++;diagnostics.expandedCells+=expandedPerSearch;
      return [destination];
    },recordMovePlanningSample:s=>samples.push(s),sendOrderNotice:(_p,_t,message)=>notices.push(message),
    scheduleNextMovePlanning(){context.activeMovePlanningJob=context.movePlanningQueue.shift()??null;},
    console:{error:(message,error)=>{throw new Error(message,{cause:error});}}});
  vm.runInContext([body('applyPlannedMoveAssignment'),body('completeMovePlanningJob'),body('processMovePlanningSlice')].join('\n'),context);
  return {context,job,units,searches,notices,samples,slice(){context.processMovePlanningSlice(context.activeMovePlanningJob);}};
}

test('planning makes the same bounded progress under fast or delayed clock observations',()=>{
  const fast=fixture(),delayed=fixture({clockStep:10});fast.slice();delayed.slice();
  assert.ok(delayed.searches.length>0,'a delayed timer read cannot starve route work');
  assert.deepEqual(delayed.searches,fast.searches,'elapsed milliseconds cannot select the applied assignments');
});
test('one slice processes at most eight destinations even when no clock time elapses',()=>{
  const f=fixture();f.slice();assert.equal(f.searches.length,8);
  assert.equal(f.units.filter(u=>!u.movePlanningPending).length,8);
  assert.equal(f.context.movePlanningQueue.length,0);assert.equal(f.context.activeMovePlanningJob,f.job);
});
test('expanded-cell budget yields after whole searches without discarding their results',()=>{
  const f=fixture({expandedPerSearch:2048});f.slice();assert.equal(f.searches.length,2);
  assert.equal(f.job.diagnostics.expandedCells,4096);assert.equal(f.units.filter(u=>!u.movePlanningPending).length,2);
});
test('one oversized atomic search completes then yields instead of starving or starting another',()=>{
  const f=fixture({expandedPerSearch:10000});f.slice();assert.equal(f.searches.length,1);
  assert.equal(f.job.diagnostics.expandedCells,10000);assert.equal(f.units[0].moveGoalCell,100);
});
test('zero-expansion cached work still yields and completion reports deterministic work counters',()=>{
  const f=fixture({expandedPerSearch:0});f.slice();assert.equal(f.searches.length,8);
  f.slice();f.slice();assert.equal(f.context.activeMovePlanningJob,null);
  assert.deepEqual(f.notices,['MOVE ORDER · 24 UNITS']);
  assert.equal(f.samples[0].maxPlanningSliceWorkItems,8);assert.equal(f.samples[0].maxPlanningSliceExpandedCells,0);
});
test('superseded unit generations preserve the replacement path and do not block another job',()=>{
  const f=fixture();for(const u of f.units){u.orderRevision++;u.path=[777];u.movePlanningPending=false;}
  const unit={id:24,team:1,x:0,z:0,hp:100,orderRevision:1,path:[],movePlanningPending:true};f.units.push(unit);
  const assignment={unit,revision:1,destination:444};
  const second={...f.job,orderId:2,player:{team:1},assignments:[assignment],groups:[[1,[assignment]]],
    reservedDestinations:new Set([444]),diagnostics:{searchCount:0,expandedCells:0,discoveredCells:0}};
  f.context.movePlanningQueue.push(second);f.slice();f.slice();
  assert.deepEqual(f.searches,[444]);assert.equal(unit.moveGoalCell,444);
  for(const u of f.units.slice(0,24))assert.deepEqual(u.path,[777]);
  assert.deepEqual(f.notices,['ORDER SUPERSEDED · 0 UNITS','MOVE ORDER · 1 UNITS']);
});
test('a waiting order receives a turn before a large order finishes',()=>{
  const f=fixture(),second={...f.job,orderId:2,groups:[],assignments:[],reservedDestinations:new Set(),diagnostics:{searchCount:0,expandedCells:0,discoveredCells:0}};
  f.context.movePlanningQueue.push(second);f.slice();
  assert.ok(f.job.assignments.some(a=>!a.applied),'large job remains unfinished after its bounded turn');
  assert.equal(f.context.activeMovePlanningJob,second);
});
test('later slices reject dead or recycled actors and a cancelled match epoch',()=>{
  const f=fixture();f.slice();
  f.units[8].hp=0;
  const recycled=f.units[9];f.units[9]={...recycled,orderRevision:2,path:[999]};
  f.slice();
  assert.ok(!f.searches.includes(108)&&!f.searches.includes(109));
  assert.deepEqual(f.units[9].path,[999]);
  const before=f.searches.slice();f.context.movePlanningEpoch++;
  f.slice();assert.deepEqual(f.searches,before);assert.equal(f.context.activeMovePlanningJob,null);
});
test('stale empty start groups consume bounded turns even without a route search',()=>{
  const f=fixture();for(const u of f.units)u.orderRevision++;
  f.job.groups=f.job.assignments.map((a,i)=>[i,[a]]);
  f.slice();assert.equal(f.searches.length,0);assert.equal(f.job.nextGroup,8);
  f.slice();assert.equal(f.job.nextGroup,16);
  f.slice();assert.equal(f.context.activeMovePlanningJob,null);
  assert.deepEqual(f.notices,['ORDER SUPERSEDED · 0 UNITS']);
});

test('publication rejects stale actor, generation, order, epoch and navigation results without mutation',()=>{
  for(const stale of ['actor','generation','order','epoch','navigation']) {
    const f=fixture({count:1}),unit=f.units[0],assignment=f.job.assignments[0];
    assignment.routeResult=createUnitRouteResult({unit,epoch:0,navigationRevision:1,startCell:1,path:[100]});
    unit.path=[777];
    if(stale==='actor')f.units[0]={...unit};
    if(stale==='generation')unit.generation=2;
    if(stale==='order')unit.orderRevision++;
    if(stale==='epoch')f.context.movePlanningEpoch++;
    if(stale==='navigation')f.context.navigationRevision++;
    assert.equal(f.context.applyPlannedMoveAssignment(f.job,assignment),false,stale);
    assert.deepEqual(unit.path,[777]);assert.equal(unit.movePlanningPending,true);assert.equal(assignment.applied,undefined);
  }
});

test('deferred search yields intact, serves a waiting order and resumes without claiming arrival or failure',()=>{
  const f=fixture({count:1}),search=f.context.findPathAStar;
  f.context.findPathAStar=()=>null;
  const second={...f.job,orderId:2,groups:[],assignments:[],reservedDestinations:new Set(),diagnostics:{searchCount:0,expandedCells:0,discoveredCells:0}};
  f.context.movePlanningQueue.push(second);f.slice();
  assert.equal(f.units[0].movePlanningPending,true);assert.equal(f.job.assignments[0].applied,undefined);
  assert.equal(f.context.activeMovePlanningJob,second);assert.equal(f.job.currentGoalGroup.nextGoal,0);
  f.context.findPathAStar=search;f.slice();f.slice();
  assert.equal(f.units[0].moveGoalCell,100);assert.equal(f.samples.at(-1).routeFailures,0);
});

test('a same-cell empty plan finishes its center approach before reporting actual arrival',()=>{
  for(const arrived of [false,true]) {
    const f=fixture({count:1}),unit=f.units[0],a=f.job.assignments[0];
    a.destination=1;f.context.findPathAStar=()=>[];
    if(arrived)Object.assign(unit,{x:1.5,z:.5});
    f.slice();
    assert.equal(a.routeOutcome.status,arrived?'arrived':'ready');
    assert.deepEqual(Array.from(unit.path),arrived?[]:[1]);
    assert.equal(a.routeOutcome.alreadyInDestinationCell,true);assert.equal(a.routeOutcome.routeFailure,false);
  }
});
