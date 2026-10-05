import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { createUnitRouteResult, unitRoutePathCost, unitRouteResultIsCurrent, activeLandMovementBodyRadius, rejoinSelectedUnitRoute } from '../src/unit-movement.mjs';
import { canTraverseFlatUnitSegment } from '../src/unit-path-line.mjs';
import * as movement from '../src/unit-movement.mjs';
import { XL_CHECKPOINT_ROUTE_MAX_ENTRIES } from '../src/server/checkpoint-route-budget.mjs';
import { activeWallBuildOrder } from '../src/wall-build-order.mjs';
import { createConstructionWorkIntent } from '../src/work-intent.mjs';

const source=readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
const body=name=>{
  const start=source.indexOf(`function ${name}(`),end=source.indexOf('\nfunction ',start+1);
  assert.ok(start>=0&&end>start);return source.slice(start,end);
};
function fixture({clockStep=0,expandedPerSearch=50,count=24,width=96,height=width,
  centered=false,start=1,capUnits=[],capNodes=[],actualScheduler=false,turns=1}={}) {
  let clock=0;const searches=[],notices=[],samples=[],callbacks=[];
  const halfX=centered?width/2:0,halfZ=centered?height/2:0;
  const cellToWorld=c=>({x:c%width-halfX+.5,z:Math.floor(c/width)-halfZ+.5});
  const units=Array.from({length:count},(_,id)=>({id,team:0,x:0,z:0,hp:100,orderRevision:1,
    generation:9,kind:'infantry',attackMoveResumePath:null,
    ...(centered?cellToWorld(start):{}),path:[],pathIndex:0,movePlanningPending:true,moveGoalCell:100+id,attackMove:false}));
  const assignments=units.map((unit,i)=>({unit,revision:1,destination:100+i}));
  const job={epoch:0,orderId:1,player:{team:0},orderLabel:'MOVE ORDER',clientOrderToken:21,
    assignments,groups:[[start,assignments]],nextGroup:0,reservedDestinations:new Set(assignments.map(a=>a.destination)),
    diagnostics:{searchCount:0,expandedCells:0,discoveredCells:0},startedAt:0,planningWorkMs:0,
    maxPlanningSliceMs:0,planningSliceCount:0,buildingTargetId:null};
  units.push(...capUnits);
  const context=vm.createContext({...movement,units,activeMovePlanningJob:job,movePlanningEpoch:0,movePlanningQueue:[],
    MOVE_PLANNING_SLICE_BUDGET_MS:5,MOVE_PLANNING_MAX_WORK_ITEMS_PER_SLICE:8,
    MOVE_PLANNING_MAX_EXPANDED_CELLS_PER_SLICE:4096,TICK_RATE:30,tickNumber:0,dirty:false,navigationRevision:1,
    pendingMoveStartBroadcasts:new Set(),movePlanningServiceTick:null,performance:{now:()=>{clock+=clockStep;return clock;}},
    nearestOpenCell:c=>c,worldToCell:centered?(x,z)=>Math.floor(z+halfZ)*width+Math.floor(x+halfX):()=>start,
    MAP_WIDTH:width,MAP_HEIGHT:height,MAP_HALF_X:halfX,MAP_HALF_Z:halfZ,CELL_COUNT:width*height,
    MAX_UNITS:2000,MAX_RESOURCE_NODES:128,XL_CHECKPOINT_ROUTE_MAX_ENTRIES,
    resourceNodeStates:new Map(capNodes),MOVE_PLANNING_TURNS_PER_TICK:turns,setImmediate:callback=>callbacks.push(callback),
    WALK_SPEED:4.5,STEP_SECONDS:1/30,elevationLevelByCell:new Uint8Array(width*height),
    isWalkable:c=>c>=0&&c<width*height,canTraverseFlatUnitSegment,createUnitRouteResult,unitRoutePathCost,unitRouteResultIsCurrent,activeLandMovementBodyRadius,rejoinSelectedUnitRoute,cellToWorld,
    findPathAStar(start,destination,diagnostics){
      searches.push(destination);diagnostics.searchCount++;diagnostics.expandedCells+=expandedPerSearch;
      return [destination];
    },recordMovePlanningSample:s=>samples.push(s),sendOrderNotice:(_p,_t,message)=>notices.push(message),
    scheduleNextMovePlanning(){context.activeMovePlanningJob=context.movePlanningQueue.shift()??null;},
    console:{error:(message,error)=>{throw new Error(message,{cause:error});}}});
  vm.runInContext([body('applyPlannedMoveAssignment'),body('completeMovePlanningJob'),body('processMovePlanningSlice')].join('\n'),context);
  if(actualScheduler)vm.runInContext([body('scheduleNextMovePlanning'),body('serviceMovePlanningForTick')].join('\n'),context);
  return {context,job,units,searches,notices,samples,callbacks,
    slice(){context.processMovePlanningSlice(context.activeMovePlanningJob);},
    step(){const next=context.tickNumber+1;const result=context.serviceMovePlanningForTick(next);context.tickNumber=next;return result;},
    drain(){let bound=0;while(callbacks.length){assert.ok(++bound<=8,'no busy deferred callbacks');callbacks.shift()();}}};
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

// Metadata-only pressure fixtures use actual publication/planner bodies and
// actual quota. Repeated-cell arrays are not valid matches/planner journeys;
// ordinary320 admission and complete native XL recovery remain closed.
function publicationPressure(freeEntries=0) {
  const shared=Array(65536).fill(1);
  const capUnits=Array.from({length:5},(_,i)=>({id:20+i,team:1,hp:0,kind:'worker',generation:9,
    path:shared,pathIndex:shared.length,attackMoveResumePath:shared}));
  const capNodes=Array.from({length:6},(_,i)=>[i,{wildlifeHerd:{path:i===5?shared.slice(0,65536-freeEntries):shared}}]);
  return {capUnits,capNodes};
}
function budgetFixture(options={}) {
  return fixture({count:1,width:320,height:320,centered:true,actualScheduler:true,...publicationPressure(),...options});
}
function cornerAssignment(f,{length=1,finalPoint=false}={}) {
  const unit=f.units[0],start=f.context.worldToCell(.25,.95),destination=start+4;
  Object.assign(unit,{x:.25,z:.95,kind:finalPoint?'infantry':'worker',moveGoalCell:destination,
    buildingTargetId:finalPoint?null:34,queuedWaypoints:[{cell:destination+2}],
    workIntent:finalPoint?null:createConstructionWorkIntent(unit.generation,[34],{minX:2,maxX:6,minZ:-2,maxZ:2})});
  f.job.buildingTargetId=unit.buildingTargetId;
  f.context.isWalkable=c=>c>=0&&c<f.context.CELL_COUNT&&c!==start+f.context.MAP_WIDTH+1;
  if(finalPoint)unit.moveGoalPoint=movement.createClearanceMoveGoalPoint(unit,4.5,.75,destination,
    f.context.MAP_WIDTH,f.context.MAP_HEIGHT,f.context.isWalkable);
  const raw=Array(length).fill(destination);
  Object.defineProperty(raw,Symbol.iterator,{value(){throw new Error('refused route must not be copied');}});
  const assignment=f.job.assignments[0];assignment.destination=destination;
  assignment.routeResult=createUnitRouteResult({unit,epoch:0,navigationRevision:1,startCell:start,path:raw,originalCost:900});
  return {unit,assignment,raw,start,destination};
}

test('XL publication reserves prefix/final-center together before copying or publishing a projected point',()=>{
  const f=budgetFixture({...publicationPressure(2)}),{unit,assignment,raw}=cornerAssignment(f,{finalPoint:true});
  const before=structuredClone(unit),point=unit.moveGoalPoint;
  assert.equal(f.context.applyPlannedMoveAssignment(f.job,assignment),false);
  assert.equal(assignment.routePublicationOutcome.reason,'aggregate-entry-limit');
  assert.equal(assignment.routePublicationOutcome.pathEntries,3);
  assert.deepEqual(unit,before);assert.equal(unit.moveGoalPoint,point);assert.equal(assignment.routeResult.path,raw);
  assert.equal(assignment.routeResult.originalCost,900);assert.equal(assignment.routeResult.originalPathLength,1);
  const node=f.context.resourceNodeStates.get(5);node.wildlifeHerd.path=node.wildlifeHerd.path.slice(0,-1);
  assignment.routeResult={...assignment.routeResult,path:[assignment.destination]};
  assert.equal(f.context.applyPlannedMoveAssignment(f.job,assignment),true);
  assert.equal(unit.path.length,3);assert.equal(unit.moveGoalPoint.requestedX,4.5);assert.equal(unit.moveGoalPoint.requestedZ,.75);
  assert.equal(assignment.routeOutcome.originalCost,900);assert.equal(assignment.routeOutcome.originalPathLength,1);
  assert.equal(f.job.maxRoutePublicationStagedEntries,6,'one raw, one two-entry tail copy, one three-entry prefix copy');
});

test('XL per-path rejoin refusal keeps every selected entry and accepted goal/job without an execution copy',()=>{
  const f=budgetFixture({capUnits:[],capNodes:[]}),{unit,assignment,raw}=cornerAssignment(f,{length:102400});
  const before=structuredClone(unit);
  assert.equal(f.context.applyPlannedMoveAssignment(f.job,assignment),false);
  assert.equal(assignment.routePublicationOutcome.reason,'path-entry-limit');
  assert.equal(assignment.routePublicationOutcome.pathEntries,102401);
  assert.deepEqual(unit,before);assert.equal(assignment.routeResult.path,raw);assert.equal(raw.length,102400);
});

test('base capacity refusal reads no selected payload; deferred work releases arrays and resumes after saved-field release',()=>{
  const f=budgetFixture(),a=f.job.assignments[0],u=f.units[0],before=structuredClone(u);
  const unread=Array(1);Object.defineProperty(unread,0,{get(){throw new Error('no selected endpoint read');}});
  a.routeResult={status:'ready',path:unread,originalPathLength:1,originalCost:900,
    identity:{unit:u,generation:u.generation,revision:1,epoch:0,navigationRevision:1}};
  assert.equal(f.context.applyPlannedMoveAssignment(f.job,a),false);assert.deepEqual(u,before);
  assert.equal(a.routePublicationOutcome.reason,'aggregate-entry-limit');
  f.step();assert.equal(u.movePlanningPending,true);assert.equal(f.context.activeMovePlanningJob,null);
  assert.equal(f.job.routeBudgetDeferredAssignments.length,1);assert.equal(a.routeResult,null);assert.equal(a.path.length,0);
  assert.deepEqual(f.notices,['MOVE ORDER WAITING']);assert.ok(!a.applied);
  f.context.resourceNodeStates.get(5).wildlifeHerd.path=[];
  f.step();assert.equal(u.movePlanningPending,false);assert.equal(u.moveGoalCell,100);
  assert.equal(a.routeOutcome.status,'ready');assert.equal(f.samples[0].routeFailures,0);
  assert.equal(f.samples[0].routeBudgetDeferrals,1);assert.ok(f.samples[0].maxRoutePublicationStagedEntries<=f.samples[0].routePublicationStagedEntryLimit);
  assert.deepEqual(f.notices,['MOVE ORDER WAITING','MOVE ORDER · 1 UNITS']);
});

test('actual planner skips selected-tail and weighted-cost scans when every base reservation is refused',()=>{
  const f=budgetFixture(),unread=Array(1);
  Object.defineProperty(unread,0,{get(){throw new Error('base refusal must precede tail/cost scan');}});
  f.context.findPathAStar=()=>unread;
  f.step();
  const a=f.job.assignments[0];
  assert.equal(a.routePublicationOutcome.reason,'aggregate-entry-limit');
  assert.equal(a.routeResult,null);assert.equal(a.path.length,0);
  assert.equal(f.units[0].moveGoalCell,100);assert.equal(f.units[0].movePlanningPending,true);
  assert.equal(f.job.routeBudgetDeferredAssignments.length,1);
});

test('callback-mode capacity retry sleeps until the next authoritative tick and serves ready jobs',()=>{
  const f=budgetFixture({turns:0});f.slice();
  assert.equal(f.context.activeMovePlanningJob,null);assert.equal(f.callbacks.length,0);
  const second={...f.job,orderId:2,groups:[],assignments:[],nextGroup:0,routeBudgetDeferredAssignments:[],
    publicationRetryTick:undefined,routeBudgetDeferrals:undefined,reservedDestinations:new Set(),diagnostics:{searchCount:0,expandedCells:0,discoveredCells:0}};
  f.context.movePlanningQueue.push(second);f.context.scheduleNextMovePlanning();f.drain();
  assert.ok(f.notices.includes('ORDER SUPERSEDED · 0 UNITS'));
  assert.equal(f.context.activeMovePlanningJob,null);assert.equal(f.callbacks.length,0);
  f.step();assert.equal(f.callbacks.length,1);f.drain();assert.equal(f.callbacks.length,0);
  assert.equal(f.job.publicationRetryTick,2);assert.equal(f.job.routeBudgetDeferredAssignments.length,1);
  f.context.resourceNodeStates.get(5).wildlifeHerd.path=[];
  f.step();f.drain();assert.equal(f.units[0].movePlanningPending,false);
});

test('a capacity-blocked goal rotates behind later goals and original start groups without duplicating references',()=>{
  const f=budgetFixture({count:3,...publicationPressure(1)}),search=f.context.findPathAStar;
  f.context.findPathAStar=(start,goal,diagnostics)=>goal===100?[101,100]:search(start,goal,diagnostics);
  f.job.groups=[[1,f.job.assignments.slice(0,2)],[2,f.job.assignments.slice(2)]];
  f.step();assert.deepEqual(Array.from(f.job.routeBudgetDeferredAssignments,a=>a.destination),[101,100]);
  f.step();assert.equal(f.units[2].movePlanningPending,false,'later original start receives its turn');
  f.context.resourceNodeStates.get(5).wildlifeHerd.path=f.context.resourceNodeStates.get(5).wildlifeHerd.path.slice(0,-1);
  for(let turns=0;turns<2&&f.units[1].movePlanningPending;turns++)f.step();
  assert.equal(f.units[1].movePlanningPending,false,'shorter later goal receives the released entry within two turns');
  assert.equal(f.job.routeBudgetDeferredAssignments.length,1);assert.equal(f.job.routeBudgetDeferredAssignments[0].destination,100);
  f.context.resourceNodeStates.get(5).wildlifeHerd.path=[];
  f.step();assert.equal(f.units[0].movePlanningPending,false);assert.equal(f.samples[0].unitCount,3);
});

for(const change of ['Stop/replacement','generation','actor','epoch'])test(`deferred ${change} cancels safely without publishing stale work`,()=>{
  const f=budgetFixture();f.step();const u=f.units[0];
  if(change==='Stop/replacement'){u.orderRevision++;u.path=[777];u.movePlanningPending=false;}
  if(change==='generation')u.generation++;
  if(change==='actor')f.units[0]={...u,orderRevision:2,path:[777],movePlanningPending:false};
  if(change==='epoch')f.context.movePlanningEpoch++;
  f.context.resourceNodeStates.get(5).wildlifeHerd.path=[];
  const after=structuredClone(f.units[0]);f.step();
  assert.deepEqual(f.units[0],after);assert.equal(f.job.assignments[0].applied,undefined);
  assert.equal(f.context.activeMovePlanningJob,null);
});

test('existing restore continuation rebuilds deferred work from serialized goal/job/queue without saved budget flags',()=>{
  const f=budgetFixture();Object.assign(f.units[0],{kind:'worker',buildingTargetId:34,
    workIntent:createConstructionWorkIntent(f.units[0].generation,[34],{minX:-62,maxX:-57,minZ:-160,maxZ:-156}),queuedWaypoints:[{cell:104}]});
  f.job.buildingTargetId=34;f.step();
  const saved=JSON.parse(JSON.stringify(f.units));
  assert.equal(saved[0].movePlanningPending,true);assert.equal(saved[0].moveGoalCell,100);
  assert.ok(!Object.keys(saved[0]).some(k=>/Publication|routeBudget|publicationRetry/.test(k)));
  const recovered=budgetFixture({capUnits:[],capNodes:[]});recovered.units.splice(0,recovered.units.length,...saved);
  Object.assign(recovered.context,{activeMovePlanningJob:null,movePlanningQueue:[],nextMoveOrderId:2,
    walkableComponents:new Int32Array(320*320),activeWallBuildOrder});
  vm.runInContext([body('pendingMoveAssignmentsByUnit'),body('enqueueRouteRepairs')].join('\n'),recovered.context);
  const restore=source.indexOf('function restoreMatchCheckpoint('),begin=source.indexOf('  const pendingRepairs = [];',restore),end=source.indexOf('\n  dirty = true;\n}',begin);
  assert.ok(restore>=0&&begin>restore&&end>begin);
  vm.runInContext(`function rebuildSavedPendingRoutes(){${source.slice(begin,end)}}`,recovered.context);
  recovered.context.rebuildSavedPendingRoutes();recovered.step();
  const u=recovered.units[0];assert.equal(u.movePlanningPending,false);assert.equal(u.moveGoalCell,100);
  assert.equal(u.buildingTargetId,34);assert.deepEqual(u.workIntent,saved[0].workIntent);
  assert.deepEqual(u.queuedWaypoints,saved[0].queuedWaypoints);assert.equal(u.generation,saved[0].generation);
});

test('navigation change retries from the actual start while retaining requested point and original weighted-cost semantics',()=>{
  const f=budgetFixture(),u=f.units[0],point=f.context.cellToWorld(100);
  u.moveGoalPoint=movement.createClearanceMoveGoalPoint(u,point.x,point.z,100,320,320,f.context.isWalkable);
  f.step();const requested={x:u.moveGoalPoint.requestedX,z:u.moveGoalPoint.requestedZ},revision=u.orderRevision;
  f.context.navigationRevision++;
  f.context.isWalkable=c=>c>=0&&c<102400&&c!==100;
  f.context.nearestOpenCell=c=>c===100?101:c;
  const selected=Array.from({length:98},(_,i)=>i+2).concat([419,420,421,101]);
  f.context.findPathAStar=(_start,goal,diagnostics)=>{assert.equal(goal,101);diagnostics.searchCount++;return selected;};
  f.context.resourceNodeStates.get(5).wildlifeHerd.path=[];
  f.step();assert.equal(u.movePlanningPending,false);assert.equal(u.moveGoalCell,101);assert.equal(u.orderRevision,revision);
  assert.deepEqual({x:u.moveGoalPoint.requestedX,z:u.moveGoalPoint.requestedZ},requested);
  assert.deepEqual(Array.from(u.path),selected);assert.equal(f.job.assignments[0].plannedNavigationRevision,2);
  assert.equal(f.job.assignments[0].routeOutcome.originalCost,unitRoutePathCost(1,selected,320,f.context.elevationLevelByCell));
});

test('shared selected routes charge each assignee field and reserve its own actual-position growth',()=>{
  const f=budgetFixture({count:2,...publicationPressure(2)}),corner=cornerAssignment(f,{finalPoint:true});
  const start=corner.start,goal=corner.destination,center=f.context.cellToWorld(start);
  Object.assign(f.units[0],{...center,moveGoalPoint:null,attackMove:true});
  Object.assign(f.units[1],{x:.25,z:.95,moveGoalCell:goal,attackMove:true});
  f.job.assignments[1].destination=goal;
  f.job.groups=[[start,f.job.assignments]];
  f.context.isWalkable=c=>c>=0&&c<102400&&c!==start+321;
  f.step();
  assert.equal(f.units[0].path.length,1);assert.equal(f.units[0].movePlanningPending,false);
  assert.equal(f.units[1].movePlanningPending,true);assert.equal(f.units[1].path.length,0);
  assert.equal(f.job.assignments[1].routePublicationOutcome.pathEntries,2);
  assert.equal(f.job.routeBudgetDeferredAssignments.length,1);
  assert.equal(f.job.assignments[0].routeResult,null);assert.equal(f.job.assignments[1].routeResult,null);
  const node=f.context.resourceNodeStates.get(5);node.wildlifeHerd.path=node.wildlifeHerd.path.slice(0,-1);
  f.step();assert.equal(f.units[1].movePlanningPending,false);
  assert.deepEqual(Array.from(f.units[1].path),[start,goal]);
  assert.equal(f.samples[0].unitCount,2);assert.equal(f.samples[0].routeBudgetDeferrals,1);
});

test('a retained deferred search group still rejects generation changes before retry publication',()=>{
  const f=budgetFixture();f.step();
  f.context.findPathAStar=()=>null;
  f.step();assert.ok(f.job.currentGoalGroup);
  f.units[0].generation++;
  const before=structuredClone(f.units[0]);
  f.context.resourceNodeStates.get(5).wildlifeHerd.path=[];
  f.context.findPathAStar=()=>{assert.fail('stale generation must not select a fresh route');};
  f.step();assert.deepEqual(f.units[0],before);assert.equal(f.job.assignments[0].applied,undefined);
  assert.equal(f.context.activeMovePlanningJob,null);
});

test('the scheduler bounds future-wait metadata scans and rotates toward a ready job',()=>{
  const f=budgetFixture({turns:0});f.slice();
  const waiting=Array.from({length:8},(_,i)=>({...f.job,orderId:i+10,publicationRetryTick:99}));
  const ready={...f.job,orderId:20,groups:[],assignments:[],nextGroup:0,publicationRetryTick:undefined,
    routeBudgetDeferredAssignments:[],reservedDestinations:new Set(),diagnostics:{searchCount:0,expandedCells:0,discoveredCells:0}};
  f.context.movePlanningQueue=[...waiting,ready];
  f.context.scheduleNextMovePlanning(0);
  assert.equal(f.context.activeMovePlanningJob,null);assert.equal(f.callbacks.length,0);
  assert.equal(f.context.movePlanningQueue[0],ready,'exactly eight future records rotate once');
  f.context.scheduleNextMovePlanning(0);assert.equal(f.context.activeMovePlanningJob,ready);
  f.drain();assert.equal(f.callbacks.length,0);assert.equal(f.context.movePlanningQueue.length,8);
});
