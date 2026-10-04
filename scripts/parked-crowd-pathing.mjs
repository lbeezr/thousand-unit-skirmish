// Fixed-tick, actual-server-body reproduction. Actors come from the natural
// map roster; commands and a one/two-tick earlier Move create the parked stack.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createPathingReplayFixture} from './pathing-replay-fixture.mjs';
import {pathingBaselineMap} from './pathing-baseline-cases.mjs';
process.env.RTS_MAP='maps/open-field.json';process.env.RTS_PREGAME='0';process.env.RTS_GAME_MODE='pvp';
process.env.RTS_TICK_DIAGNOSTICS='1';process.env.RTS_SEPARATION_DIAGNOSTICS='1';delete process.env.RTS_MATCH_STATE_PATH;
const observe=process.argv.includes('--observe'),records=[];
for(const team of [0,1])for(const lagTicks of [1,2])for(let repeat=0;repeat<2;repeat++) {
  const map=pathingBaselineMap({group:996,kind:'large-single-choke',team});
  const fixture=await createPathingReplayFixture(map),r=fixture.replay;
  try {
    const army=r.units.filter(u=>u.team===team&&u.kind==='infantry'),direction=team?-1:1;
    const done=u=>{const p=r.point(u.moveGoalCell);return !u.movePlanningPending
      &&u.pathIndex===u.path.length&&Math.hypot(u.x-p.x,u.z-p.z)<.02;};
    r.order(team,{type:'move',ids:army.map(u=>u.id),x:direction*16.5,z:.5});r.drain();
    while(r.tick<2700&&!army.every(done))r.step();assert.ok(army.every(done));
    const arrivalTick=r.tick,selected=army.slice(0,24),untouched=r.units.filter(u=>!selected.includes(u));
    const idle=()=>JSON.stringify(untouched.map(u=>[u.id,u.x,u.z,u.hp,u.orderRevision,
      u.moveGoalCell,u.pathIndex,u.path,u.queuedWaypoints]));
    const before=idle();
    r.order(team,{type:'move',ids:selected.map(u=>u.id),x:direction*24.5,z:.5});r.drain();
    for(let i=0;i<lagTicks;i++)r.step();
    r.order(team,{type:'stop',ids:selected.slice(0,8).map(u=>u.id)});
    const stopped=selected.slice(0,8).map(u=>[u.id,u.x,u.z,u.orderRevision]);
    r.order(team,{type:'move',ids:selected.slice(8,16).map(u=>u.id),x:direction*28.5,z:8.5});r.drain();
    const moving=selected.slice(8),replacement=selected.slice(8,16).map(u=>[u.id,u.moveGoalCell,u.orderRevision]);
    const trace=createHash('sha256');let controlTicks=0;
    while(controlTicks<1500&&!moving.every(done)) {
      r.step();controlTicks++;
      trace.update(JSON.stringify(moving.map(u=>[u.id,u.x,u.z,u.moveGoalCell,u.pathIndex,u.path]))+'\n');
    }
    assert.equal(idle(),before,'unselected actors retain position, intent and queued paths');
    assert.deepEqual(selected.slice(0,8).map(u=>[u.id,u.x,u.z,u.orderRevision]),stopped);
    assert.deepEqual(selected.slice(8,16).map(u=>[u.id,u.moveGoalCell,u.orderRevision]),replacement);
    const stalled=moving.filter(u=>!done(u)).map(u=>({id:u.id,x:u.x,z:u.z,
      goal:u.moveGoalCell,pathIndex:u.pathIndex,pathLength:u.path.length,pending:u.movePlanningPending}));
    const record={team,lagTicks,repeat,sourceSha256:fixture.sourceSha256,arrivalTick,controlTicks,
      arrived:moving.length-stalled.length,stalled,stopPreserved:8,unselectedUnchanged:true,
      replacementGoalsPreserved:true,traceSha256:trace.digest('hex')};
    records.push(record);console.log(JSON.stringify(record));
    if(!observe)assert.equal(stalled.length,0);
  }finally{await fixture.dispose();}
}
for(let i=0;i<records.length;i+=2)assert.equal(records[i].traceSha256,records[i+1].traceSha256);
if(process.env.PARKED_CROWD_RECORD)await writeFile(process.env.PARKED_CROWD_RECORD,JSON.stringify({
  head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),records,
  limits:['fixed-tick planning callbacks drain between ticks; native interleaving checked separately',
    'no renderer, deployment, comparable hardware speedup or supported capacity claim']},null,2)+'\n');
