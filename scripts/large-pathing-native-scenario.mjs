import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { pathingBaselineMap } from './pathing-baseline-cases.mjs';

const team=Number(process.argv[2]??0);
assert.ok(team===0||team===1);
const map=pathingBaselineMap({group:996,kind:'large-single-choke',team});
const fixture=await createFortifiedFixture({mapPath:'maps/open-field.json',diagnostics:true,timeoutMs:120000});
const sourceSha256=createHash('sha256').update(await readFile(new URL('../server.mjs',import.meta.url))).digest('hex');
const orders=[];let token=1;
try {
  await fixture.start();let clients=[await fixture.connect(0),await fixture.connect(1)];
  const sessions=clients.map(c=>c.welcome.player.sessionToken);
  clients[0].send({type:'publishMap',map,persist:true});
  await Promise.all(clients.map(c=>c.wait(m=>m.type==='mapChange'&&m.map.id===map.id,'large pathing map')));
  const army=clients[team].latest.units.filter(u=>u[1]===team&&u[5]==='infantry');
  assert.equal(army.length,996);
  const ids=army.map(u=>u[0]),selected=new Set(ids),direction=team?-1:1;
  async function order(command,expected) {
    command.clientOrderToken=token++;
    const notice=await clients[team].command(command,new RegExp(`${expected.source}|REJECTED|FAILED`));
    assert.ok(expected.test(notice.message),notice.message);
    orders.push({tick:clients[team].latest.tick,command,notice:notice.message});
  }
  const initial=await fixture.checkpoint(s=>s.mapDefinition.id===map.id);
  const done=u=>!u.movePlanningPending&&u.pathIndex===u.path.length&&u.moveGoalCell>=0
    &&Math.hypot(u.x-(u.moveGoalCell%map.width-map.width/2+.5),
      u.z-(Math.floor(u.moveGoalCell/map.width)-map.height/2+.5))<.02;
  await order({type:'move',ids,unitGenerations:army.map(u=>u[8]),x:direction*16.5,z:.5},/MOVE ORDER/);
  const initialPlanning=(await fixture.health()).movePlanning;
  const mid=await fixture.checkpoint(s=>s.mapDefinition.id===map.id&&s.state.tickNumber>=initial.state.tickNumber+150
    &&s.state.units.filter(u=>selected.has(u.id)&&u.pathIndex<u.path.length
      &&Math.hypot(u.x-initial.state.units[u.id].x,u.z-initial.state.units[u.id].z)>.2).length>=100);
  const originalGoals=ids.map(id=>mid.state.units[id].moveGoalCell);
  await fixture.stop();await fixture.start();
  clients=[await fixture.connect(0,sessions[0]),await fixture.connect(1,sessions[1])];
  assert.ok(clients.every(c=>c.welcome.recoveredFromCheckpoint));
  const arrived=await fixture.checkpoint(s=>s.mapDefinition.id===map.id&&ids.every((id,i)=>
    done(s.state.units[id])&&s.state.units[id].moveGoalCell===originalGoals[i]));
  const stoppedIds=ids.slice(0,8),replacementIds=ids.slice(8,16),remainingIds=ids.slice(16,24);
  // Overlap three ordinary commands before the first planner's notice. The
  // generation guards must preserve Stop and the newer destination regardless
  // of whether the older order applied zero, some or all of its routes first.
  const older=order({type:'move',ids:ids.slice(0,24),x:direction*44.5,z:-24.5},/MOVE ORDER|ORDER SUPERSEDED/);
  const stop=order({type:'stop',ids:stoppedIds},/STOP ORDER/);
  const replacement=order({type:'move',ids:replacementIds,x:direction*44.5,z:-28.5},/MOVE ORDER/);
  await Promise.all([older,stop,replacement]);
  const stopped=await fixture.checkpoint(s=>s.mapDefinition.id===map.id&&stoppedIds.every(id=>{
    const u=s.state.units[id];return !u.movePlanningPending&&u.path.length===0&&!u.attackMove;
  })&&replacementIds.every(id=>!s.state.units[id].movePlanningPending));
  const replacementResults=replacementIds.map(id=>{
    const u=stopped.state.units[id],goal=u.moveGoalCell;
    const x=goal%map.width-map.width/2+.5,z=Math.floor(goal/map.width)-map.height/2+.5;
    assert.ok(Math.abs(x-direction*44.5)<=1&&z<=-27.5&&z>=-29.5,
      'newer command assigns goals in its own area, outside the older command formation');
    assert.equal(u.orderRevision,arrived.state.units[id].orderRevision+2);
    return {id,goal,revision:u.orderRevision};
  });
  const overlappingPlanning=(await fixture.health()).movePlanning;
  const completed=await fixture.checkpoint(s=>s.mapDefinition.id===map.id
    &&s.state.tickNumber>=stopped.state.tickNumber+30&&remainingIds.every(id=>done(s.state.units[id]))
    &&replacementResults.every(({id,goal,revision})=>{
      const u=s.state.units[id];return done(u)&&u.moveGoalCell===goal&&u.orderRevision===revision;
    }));
  for(const id of stoppedIds) {
    const a=stopped.state.units[id],b=completed.state.units[id];
    assert.deepEqual([b.x,b.z,b.orderRevision,b.path,b.movePlanningPending],[a.x,a.z,a.orderRevision,[],false]);
  }
  await fixture.stop();await fixture.start();
  clients=[await fixture.connect(0,sessions[0]),await fixture.connect(1,sessions[1])];
  const stable=await fixture.checkpoint(s=>s.mapDefinition.id===map.id&&s.state.tickNumber>=completed.state.tickNumber+30);
  for(const id of [...stoppedIds,...replacementIds,...remainingIds]) {
    const a=completed.state.units[id],b=stable.state.units[id];
    assert.deepEqual([b.x,b.z,b.orderRevision,b.moveGoalCell,b.path,b.movePlanningPending],
      [a.x,a.z,a.orderRevision,a.moveGoalCell,a.path,a.movePlanningPending]);
  }
  const report={head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceSha256,team,map,
    roster:initial.state.units.length,selected:ids.length,arrived:ids.length,
    midTick:mid.state.tickNumber,arrivalTicks:arrived.state.tickNumber-initial.state.tickNumber,
    orders,activeRouteRestart:true,stopPreserved:stoppedIds.length,replacementPreserved:replacementIds.length,
    idleRestart:true,replacementResults,initialPlanning,overlappingPlanning,
    limits:['actual asynchronous two-seat loopback server; natural roster and ordinary commands, no actor injection',
      'no renderer, deployment, comparable hardware speedup or supported capacity claim']};
  if(process.env.LARGE_PATHING_NATIVE_RECORD)await writeFile(process.env.LARGE_PATHING_NATIVE_RECORD,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({team,arrived:report.arrived,arrivalTicks:report.arrivalTicks,
    activeRouteRestart:true,stopPreserved:8,replacementPreserved:8,idleRestart:true}));
}finally{await fixture.dispose();}
