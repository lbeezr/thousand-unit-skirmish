import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { pathingBaselineMap } from './pathing-baseline-cases.mjs';

const fixture=await createFortifiedFixture({mapPath:'maps/open-field.json',timeoutMs:60000});
const sourceSha256=createHash('sha256').update(await readFile(new URL('../server.mjs',import.meta.url))).digest('hex');
let token=200;const records=[];
try {
  await fixture.start();const clients=[await fixture.connect(0),await fixture.connect(1)];
  for(const team of [0,1]) {
    const map={...pathingBaselineMap({group:64}),id:`stationary-worker-native-${team}`},c=clients[team];
    clients[0].send({type:'publishMap',map});
    await Promise.all(clients.map(c=>c.wait(m=>m.type==='mapChange'&&m.map.id===map.id,'parked Worker map')));
    const army=c.latest.units.filter(u=>u[1]===team&&u[5]==='infantry'),ids=army.map(u=>u[0]);
    const worker=c.latest.units.find(u=>u[1]===team&&u[5]==='worker');
    async function order(command,expected) {
      command.clientOrderToken=token++;
      const notice=await c.command(command,new RegExp(`(?:${expected.source})|REJECTED|FAILED`));
      assert.ok(expected.test(notice.message),notice.message);
    }
    await order({type:'build',buildingType:'palisade-gate',ids:[worker[0]],unitGenerations:[worker[8]],x:16.5,z:.5},/PALISADE GATE PLACED/);
    const admitted=await fixture.checkpoint(s=>s.mapDefinition.id===map.id&&s.state.buildings.length===1);
    assert.deepEqual(admitted.state.units.filter(u=>u.buildingTargetId!==null).map(u=>u.id),[worker[0]]);
    const complete=await fixture.checkpoint(s=>s.mapDefinition.id===map.id&&s.state.buildings[0].complete),gate=complete.state.buildings[0];
    const parkOrder=team?'holdPosition':'stop';
    await order({type:parkOrder,ids:[worker[0]],unitGenerations:[worker[8]]},team?/HOLD POSITION ORDER/:/STOP ORDER/);
    await order({type:'setGateOpen',buildingId:gate.id,open:true},/GATE OPEN/);
    const parked=await fixture.checkpoint(s=>s.mapDefinition.id===map.id&&s.state.buildings[0].gateOpen&&s.state.units[worker[0]].moveGoalCell===-1);
    const intent=u=>({x:u.x,z:u.z,holdingPosition:u.holdingPosition,orderRevision:u.orderRevision,
      moveGoalCell:u.moveGoalCell,path:u.path,queuedWaypoints:u.queuedWaypoints,buildingTargetId:u.buildingTargetId});
    const parkedIntent=intent(parked.state.units[worker[0]]);
    await order({type:'move',ids,unitGenerations:army.map(u=>u[8]),x:-8.5,z:.5},/MOVE ORDER/);
    await order({type:'move',ids,unitGenerations:army.map(u=>u[8]),x:16.5,z:.5,queue:true},/WAYPOINT QUEUED/);
    const before=await fixture.checkpoint(s=>s.mapDefinition.id===map.id&&ids.every(id=>s.state.units[id].queuedWaypoints.length===1));
    const requested=ids.map(id=>before.state.units[id].queuedWaypoints[0].destination);
    assert.equal(new Set(requested).size,64);assert.ok(requested.some(c=>gate.footprint.includes(c)));
    await order({type:'setGateOpen',buildingId:gate.id,open:false},/GATE CLOSED/);
    const closed=await fixture.checkpoint(s=>s.mapDefinition.id===map.id&&!s.state.buildings[0].gateOpen);
    assert.equal(closed.state.navigationRevision,before.state.navigationRevision+1);
    assert.deepEqual(ids.map(id=>closed.state.units[id].queuedWaypoints[0].destination),requested);
    const done=u=>!u.queuedWaypoints.length&&!u.movePlanningPending&&u.pathIndex===u.path.length
      &&Math.hypot(u.x-(u.moveGoalCell%map.width-map.width/2+.5),u.z-(Math.floor(u.moveGoalCell/map.width)-map.height/2+.5))<.02;
    let snapshotsChecked=0;
    const completed=await fixture.checkpoint(s=>{
      if(s.mapDefinition.id!==map.id)return false;
      assert.deepEqual(intent(s.state.units[worker[0]]),parkedIntent,'Stop/Hold Worker remains fixed');snapshotsChecked++;
      return ids.every(id=>done(s.state.units[id]));
    });
    const goals=ids.map(id=>completed.state.units[id].moveGoalCell);
    assert.equal(new Set(goals).size,64);
    assert.ok(goals.every((c,i)=>gate.footprint.includes(requested[i])||c===requested[i]));
    records.push({team,group:64,parkOrder,arrived:64,distinctGoals:64,onlyNamedBuilder:true,
      parkedIntent,parkedIntentPreserved:true,snapshotsChecked,unblockedDestinationsPreserved:true,
      ticks:completed.state.tickNumber-before.state.tickNumber});
    console.log(JSON.stringify(records.at(-1)));
  }
  if(process.env.STATIONARY_WORKER_NATIVE_RECORD)await writeFile(process.env.STATIONARY_WORKER_NATIVE_RECORD,JSON.stringify({
    head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceSha256,records,
    limits:['actual two-seat asynchronous WebSocket server, paid natural gate and explicit Stop/Hold; no renderer, deployed or performance claim']},null,2)+'\n');
}finally{await fixture.dispose();}
