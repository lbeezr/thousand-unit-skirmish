import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source=readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
const body=name=>{
  const start=source.indexOf(`function ${name}(`),end=source.indexOf('\nfunction ',start+1);
  assert.ok(start>=0&&end>start);return source.slice(start,end);
};
test('a failed turn counts partial search work and serves the next job without leaking phase state',()=>{
  const units=[0,1,2].map(id=>({id,hp:100,team:0,x:0,z:0,orderRevision:1,
    path:[],pathIndex:0,movePlanningPending:true,moveGoalCell:-1,attackMove:false}));
  const job=(id,actors)=>{
    const assignments=actors.map(unit=>({unit,revision:1,destination:100+unit.id}));
    return {orderId:id,epoch:0,player:{team:0},clientOrderToken:id,orderLabel:'MOVE ORDER',
      assignments,groups:[[1,assignments]],nextGroup:0,createdTick:0,
      reservedDestinations:new Set(assignments.map(a=>a.destination)),startedAt:0,
      diagnostics:{searchCount:0,expandedCells:0,discoveredCells:0},planningWorkMs:0,
      maxPlanningSliceMs:0,planningSliceCount:0,buildingTargetId:null};
  };
  const first=job(1,units.slice(0,2)),second=job(2,units.slice(2)),notices=[],errors=[];
  let searches=0;
  const context=vm.createContext({units,activeMovePlanningJob:first,movePlanningQueue:[second],
    movePlanningEpoch:0,movePlanningServiceTick:null,MOVE_PLANNING_TURNS_PER_TICK:2,
    MOVE_PLANNING_MAX_WORK_ITEMS_PER_SLICE:8,MOVE_PLANNING_MAX_EXPANDED_CELLS_PER_SLICE:4096,
    TICK_RATE:30,tickNumber:0,navigationRevision:1,dirty:false,pendingMoveStartBroadcasts:new Set(),
    performance:{now:()=>1},nearestOpenCell:c=>c,worldToCell:()=>1,
    findPathAStar(_start,destination,diagnostics){
      searches++;diagnostics.searchCount++;diagnostics.expandedCells+=100;
      if(searches===2)throw new Error('controlled failed search');
      return [destination];
    },sendOrderNotice:(_player,_token,message)=>notices.push(message),recordMovePlanningSample(){},
    console:{error:(...args)=>errors.push(args)}});
  vm.runInContext(['scheduleNextMovePlanning','serviceMovePlanningForTick','applyPlannedMoveAssignment',
    'completeMovePlanningJob','processMovePlanningSlice'].map(body).join('\n'),context);
  const work=context.serviceMovePlanningForTick(1);
  assert.equal(work.turns,2);assert.equal(work.workItems,3);assert.equal(work.expandedCells,300);
  assert.equal(searches,3);assert.equal(errors.length,1);
  assert.deepEqual(notices,['MOVE ORDER PARTIAL · 1 UNITS','MOVE ORDER · 1 UNITS']);
  assert.equal(units[0].moveGoalCell,100);assert.equal(units[1].movePlanningPending,false);
  assert.equal(units[2].moveGoalCell,102);
  assert.equal(context.movePlanningServiceTick,null);assert.equal(context.activeMovePlanningJob,null);
});
