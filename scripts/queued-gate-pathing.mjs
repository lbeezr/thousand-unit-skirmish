import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';
import { pathingBaselineMap } from './pathing-baseline-cases.mjs';
import { canTraverseUnitStep } from '../src/unit-movement.mjs';
import { BUILDING_DEFINITIONS } from '../src/gameplay-definitions.mjs';

process.env.RTS_MAP='maps/open-field.json';process.env.RTS_GAME_MODE='pvp';process.env.RTS_PREGAME='0';
delete process.env.RTS_MATCH_STATE_PATH;
export async function runQueuedGateCase({team=0,observe=false,returnBuilder=true,parkOrder=null}={}) {
  const map=pathingBaselineMap({group:64}),fixture=await createPathingReplayFixture(map),r=fixture.replay;
  try {
    for(const seat of [0,1]) {
      const passive=r.units.filter(u=>u.team===seat&&u.kind==='infantry');
      assert.ok(r.order(seat,{type:'setStance',ids:passive.map(u=>u.id),
        unitGenerations:passive.map(u=>u.generation),stance:'noAttack'})
        .some(n=>n.message.startsWith('STANCE ORDER')));
    }
    const army=r.units.filter(u=>u.team===team&&u.kind==='infantry'),ids=army.map(u=>u.id);
    const worker=r.units.find(u=>u.team===team&&u.kind==='worker'),wood=r.wood[team];
    const placed=r.order(team,{type:'build',buildingType:'palisade-gate',ids:[worker.id],unitGenerations:[worker.generation],x:16.5,z:.5});r.drain();
    assert.ok(placed.some(n=>n.message.startsWith('PALISADE GATE PLACED')),JSON.stringify(placed));
    assert.equal(r.wood[team],wood-BUILDING_DEFINITIONS['palisade-gate'].cost.wood);
    assert.deepEqual(r.units.filter(u=>u.buildingTargetId!==null).map(u=>u.id),[worker.id]);
    const gate=r.buildings[0];
    while(!gate.complete&&r.tick<2700)r.step();
    assert.equal(gate.complete,true,'selected Worker completes the paid gate naturally');
    assert.equal(gate.gateOpen,false);
    const beforeOpen=r.navigationRevision;
    assert.ok(r.order(team,{type:'setGateOpen',buildingId:gate.id,open:true}).some(n=>n.message.startsWith('GATE OPEN')));
    assert.equal(r.navigationRevision,beforeOpen+1);assert.ok(gate.footprint.every(r.isWalkable));
    // Give the builder an ordinary return order so the case isolates topology
    // changes from an idle Worker physically occupying a formation destination.
    if(returnBuilder) {
      const spawn=map.spawnPoints[team];
      r.order(team,{type:'move',ids:[worker.id],x:spawn.x,z:spawn.z});r.drain();
      const workerReturnStart=r.tick;
      while((worker.movePlanningPending||worker.pathIndex<worker.path.length)&&r.tick-workerReturnStart<2700)r.step();
      assert.equal(worker.pathIndex,worker.path.length);
    }
    if(parkOrder) {
      assert.ok(!returnBuilder&&['stop','holdPosition'].includes(parkOrder));
      const label=parkOrder==='stop'?'STOP':'HOLD POSITION';
      assert.ok(r.order(team,{type:parkOrder,ids:[worker.id],unitGenerations:[worker.generation]})
        .some(n=>n.message.startsWith(label+' ORDER')));
    }
    const workerIntent=()=>({x:worker.x,z:worker.z,holdingPosition:worker.holdingPosition,
      orderRevision:worker.orderRevision,moveGoalCell:worker.moveGoalCell,path:worker.path.slice(),
      queuedWaypoints:worker.queuedWaypoints.slice(),buildingTargetId:worker.buildingTargetId,
      gatherPhase:worker.gatherPhase,gatherNodeId:worker.gatherNodeId});
    const parkedIntent=workerIntent();
    r.order(team,{type:'move',ids,x:-8.5,z:.5});r.drain();
    r.order(team,{type:'move',ids,x:16.5,z:.5,queue:true});r.drain();
    const requested=army.map(u=>u.queuedWaypoints[0].destination),current=army.map(u=>u.moveGoalCell);
    assert.equal(new Set(requested).size,64);assert.ok(requested.some(c=>gate.footprint.includes(c)));
    for(let i=0;i<15;i++)r.step();
    const beforeClose=r.navigationRevision,startTick=r.tick;
    assert.ok(r.order(team,{type:'setGateOpen',buildingId:gate.id,open:false}).some(n=>n.message.startsWith('GATE CLOSED')));
    r.drain();assert.equal(r.navigationRevision,beforeClose+1);assert.equal(gate.gateOpen,false);
    assert.deepEqual(army.map(u=>u.moveGoalCell),current);
    assert.deepEqual(army.map(u=>u.queuedWaypoints[0].destination),requested,'close preserves future queue intent');
    const trace=createHash('sha256');let invalidSteps=0,unreachableGoals=0,maxPathLength=0;
    const progress=new Map(army.map(u=>[u.id,{goal:u.moveGoalCell,remaining:Infinity,tick:r.tick,max:0}]));
    const done=u=>!u.queuedWaypoints.length&&!u.movePlanningPending&&u.pathIndex===u.path.length
      &&Math.hypot(u.x-r.point(u.moveGoalCell).x,u.z-r.point(u.moveGoalCell).z)<.02;
    while(r.tick-startTick<2700&&!army.every(done)) {
      const previous=army.map(u=>r.cell(u.x,u.z));r.step();
      if(!returnBuilder)assert.deepEqual(workerIntent(),parkedIntent,'parked Worker keeps position and command intent');
      for(let i=0;i<army.length;i++) {
        const u=army[i],cell=r.cell(u.x,u.z);
        maxPathLength=Math.max(maxPathLength,u.path.length);
        if(!canTraverseUnitStep(previous[i],cell,map.width,r.levels,r.isWalkable))invalidSteps++;
        if(r.components[cell]!==r.components[u.moveGoalCell])unreachableGoals++;
        const p=progress.get(u.id);let x=u.x,z=u.z,remaining=0;
        for(const c of u.path.slice(u.pathIndex)){const q=r.point(c);remaining+=Math.hypot(q.x-x,q.z-z);x=q.x;z=q.z;}
        if(p.goal!==u.moveGoalCell||remaining<p.remaining-.05){p.goal=u.moveGoalCell;p.remaining=remaining;p.tick=r.tick;}
        if(!done(u))p.max=Math.max(p.max,r.tick-p.tick);
      }
      trace.update(JSON.stringify(army.map(u=>[u.id,u.x,u.z,u.moveGoalCell,u.pathIndex,u.path,u.orderRevision,u.movePlanningPending,u.queuedWaypoints]))+'\n');
    }
    const goals=army.map(u=>u.moveGoalCell),arrived=army.filter(done).length;
    assert.ok(army.every(u=>u.hp===100),'formation arrival excludes incidental combat');
    assert.equal(invalidSteps,0);assert.equal(unreachableGoals,0);
    if(!observe)assert.equal(arrived,64);
    const unblockedDestinationsPreserved=army.every((u,i)=>u.queuedWaypoints.length
      ?u.queuedWaypoints[0].destination===requested[i]
      :gate.footprint.includes(requested[i])||u.moveGoalCell===requested[i]);
    assert.equal(unblockedDestinationsPreserved,true);
    assert.ok(goals.every(c=>!gate.footprint.includes(c)));
    return {team,group:64,sourceSha256:fixture.sourceSha256,ticks:r.tick-startTick,arrived,
      distinctGoals:new Set(goals).size,requested,goals,invalidSteps,unreachableGoals,maxPathLength,
      onlyNamedBuilder:true,builderReturned:returnBuilder,parkOrder,parkedIntentPreserved:!returnBuilder,
      maxNoProgressTicks:Math.max(...[...progress.values()].map(p=>p.max)),unblockedDestinationsPreserved,
      unfinished:army.filter(u=>!done(u)).map(u=>({id:u.id,x:u.x,z:u.z,goal:r.point(u.moveGoalCell),pathIndex:u.pathIndex,pathLength:u.path.length})),
      builderPosition:{x:worker.x,z:worker.z},traceSha256:trace.digest('hex')};
  } finally {await fixture.dispose();}
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const records=[];
  for(const team of [0,1]) {
    const runs=[];for(let i=0;i<2;i++)runs.push(await runQueuedGateCase({team,
      observe:process.argv.includes('--observe'),returnBuilder:!process.argv.includes('--park-builder'),
      parkOrder:process.argv.includes('--hold-builder')?'holdPosition':process.argv.includes('--stop-builder')?'stop':null}));
    assert.equal(runs[0].traceSha256,runs[1].traceSha256);
    records.push({team,runs});console.log(JSON.stringify({team,ticks:runs[0].ticks,arrived:runs[0].arrived,distinctGoals:runs[0].distinctGoals,repeatExact:true}));
  }
  if(process.env.QUEUED_GATE_RECORD)await writeFile(process.env.QUEUED_GATE_RECORD,JSON.stringify({
    head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),records,
    limits:['production gate handler and paid natural completion, canonical fixed ticks; no renderer or native scheduling claim']},null,2)+'\n');
}
