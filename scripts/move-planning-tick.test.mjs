import assert from 'node:assert/strict';
import test from 'node:test';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';
import { pathingBaselineMap } from './pathing-baseline-cases.mjs';

process.env.RTS_MAP='maps/open-field.json';process.env.RTS_GAME_MODE='pvp';process.env.RTS_PREGAME='0';
process.env.RTS_TICK_DIAGNOSTICS='1';delete process.env.RTS_MATCH_STATE_PATH;
async function fixture(turns,group=64,kind='single-choke') {
  process.env.RTS_MOVE_PLANNING_TURNS_PER_TICK=String(turns);
  const map=pathingBaselineMap({group,kind});
  const f=await createPathingReplayFixture(map);
  delete process.env.RTS_MOVE_PLANNING_TURNS_PER_TICK;
  return {...f,map,r:f.replay,army:f.replay.units.filter(u=>u.team===0&&u.kind==='infantry')};
}
const move=(r,army,x=16.5,z=.5)=>r.order(0,{type:'move',ids:army.map(u=>u.id),
  unitGenerations:army.map(u=>u.generation),x,z,clientOrderToken:1});
const state=army=>army.map(u=>[u.id,u.x,u.z,u.orderRevision,u.moveGoalCell,u.pathIndex,u.path,u.movePlanningPending]);
const idle=r=>r.planningJobs.length===0;
const arrived=(r,u)=>!u.movePlanningPending&&u.pathIndex===u.path.length
  &&Math.hypot(u.x-r.point(u.moveGoalCell).x,u.z-r.point(u.moveGoalCell).z)<.02;
function drainTicks(r,max=1000) {for(let i=0;!idle(r)&&i<max;i++)r.step();assert.ok(idle(r));}

for(const turns of [1,4,8]) {
  test(`${turns} turns: routes publish only in the bounded tick phase and FIFO serves a waiting order`,async()=>{
    const {r,army,map,dispose}=await fixture(turns,256);
    try {
      move(r,army);assert.ok(army.every(u=>u.movePlanningPending));
      const other=r.units.filter(u=>u.team===1&&u.kind==='infantry').slice(0,8);
      r.order(1,{type:'move',ids:other.map(u=>u.id),x:25.5,z:24.5,clientOrderToken:2});
      assert.equal(r.tick,0);assert.ok(other.every(u=>u.movePlanningPending));
      const waiter=r.planningJobs[1];
      r.step();assert.ok(r.diagnostic.planningTurns<=turns);
      assert.ok(r.diagnostic.planningWorkItems<=turns*8);
      assert.ok(r.diagnostic.planningExpandedCells<=turns*(4095+map.width*map.height),
        'each turn permits only one atomic-search overshoot');
      if(turns===1) {assert.ok(other.every(u=>u.movePlanningPending));r.step();}
      assert.ok(waiter.firstPlanningTick<=2,'one large order cannot starve the queued small order');
      drainTicks(r);
      assert.ok(other.every(u=>!u.movePlanningPending));
      for(const job of r.planning) {
        assert.ok(job.firstAppliedTick>=1);assert.ok(job.lastAppliedTick>=job.firstAppliedTick);
        assert.ok(job.firstPlanningTick-job.createdTick<=2);
      }
    } finally {await dispose();}
  });
  test(`${turns} turns: Stop and replacement invalidate old assignments before service`,async()=>{
    const {r,army,dispose}=await fixture(turns);
    try {
      const notices=move(r,army);
      const stopped=army.slice(0,8),replaced=army.slice(8,16);
      r.order(0,{type:'stop',ids:stopped.map(u=>u.id)});
      move(r,replaced,-20.5,8.5);
      const stoppedState=JSON.stringify(state(stopped)),goals=replaced.map(u=>u.moveGoalCell);
      drainTicks(r);
      assert.equal(JSON.stringify(state(stopped)),stoppedState);
      assert.deepEqual(replaced.map(u=>u.moveGoalCell),goals);
      assert.ok(notices.some(n=>n.message==='MOVE ORDER · 48 UNITS'));
      assert.ok(replaced.every(u=>u.orderRevision===2));
    } finally {await dispose();}
  });
  test(`${turns} turns: a new footprint repairs applied and pending goals without crossing terrain`,async()=>{
    const {r,army,dispose}=await fixture(turns,64,'dynamic-goal');
    try {
      move(r,army);r.step();
      const worker=r.units.find(u=>u.team===0&&u.kind==='worker');
      const notices=r.order(0,{type:'build',ids:[worker.id],buildingType:'house',x:16.5,z:.5});
      assert.ok(!notices.some(n=>/REJECTED|FAILED/.test(n.message)));
      assert.equal(r.buildings.length,1,'paid footprint is admitted before planner service');
      drainTicks(r);
      assert.ok(notices.some(n=>n.message.startsWith('BUILD ORDER')));
      const footprint=new Set(r.buildings.at(-1).footprint);
      assert.equal(new Set(army.map(u=>u.moveGoalCell)).size,64);
      assert.ok(army.every(u=>!footprint.has(u.moveGoalCell)));
      for(let i=0;i<1000&&!army.every(u=>arrived(r,u));i++) {
        r.step();
        assert.ok(army.every(u=>r.isWalkable(r.cell(u.x,u.z))));
      }
      assert.ok(army.every(u=>arrived(r,u)));
    } finally {await dispose();}
  });
  test(`${turns} turns: epoch reset discards the old job and pending checkpoint goals recover`,async()=>{
    const {r,army,map,dispose}=await fixture(turns);
    try {
      move(r,army);r.prepare(map);
      assert.equal(r.planningJobs.length,0);r.step();
      const fresh=r.units.filter(u=>u.team===0&&u.kind==='infantry');
      assert.ok(fresh.every(u=>u.orderRevision===0&&!u.movePlanningPending));
      move(r,fresh);const goals=fresh.map(u=>u.moveGoalCell),snapshot=r.checkpoint();
      assert.ok(snapshot.state.units.some(u=>u.movePlanningPending));
      r.restore(snapshot);drainTicks(r);
      assert.deepEqual(r.units.filter(u=>u.team===0&&u.kind==='infantry').map(u=>u.moveGoalCell),goals);
    } finally {await dispose();}
  });
  test(`${turns} turns: Stop after a serviced turn preserves the stationary actor`,async()=>{
    const {r,army,dispose}=await fixture(turns);
    try {
      move(r,army);r.step();
      const stopped=army.slice(0,8);
      r.order(0,{type:'stop',ids:stopped.map(u=>u.id)});
      const before=JSON.stringify(state(stopped));
      for(let i=0;i<20;i++)r.step();
      assert.equal(JSON.stringify(state(stopped)),before);
    } finally {await dispose();}
  });
  test(`${turns} turns: queued route turns finish at their own preserved goals`,async()=>{
    const {r,army,dispose}=await fixture(turns);
    try {
      move(r,army);
      const notices=r.order(0,{type:'move',queue:true,ids:army.map(u=>u.id),x:20.5,z:-8.5});
      assert.ok(notices.some(n=>n.message==='WAYPOINT QUEUED · 64 UNITS'));
      const goals=army.map(u=>u.queuedWaypoints[0].destination);
      for(let i=0;i<1800&&!army.every((u,j)=>u.moveGoalCell===goals[j]&&arrived(r,u));i++)r.step();
      assert.ok(army.every((u,j)=>u.moveGoalCell===goals[j]&&arrived(r,u)&&u.queuedWaypoints.length===0));
    } finally {await dispose();}
  });
}
