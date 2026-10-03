import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { attackQueueMap } from './attack-queue-case.mjs';

const sourceSha256=createHash('sha256').update(await readFile(new URL('../server.mjs',import.meta.url))).digest('hex');
async function run(team){
  const fixture=await createFortifiedFixture({mapPath:'maps/open-field.json',timeoutMs:60000});
  let token=100;
  try{
    await fixture.start();let clients=[await fixture.connect(0),await fixture.connect(1)];
    const sessions=clients.map(c=>c.welcome.player.sessionToken),defender=1-team;
    const map=attackQueueMap();map.id+=`-native-${team}`;
    clients[0].send({type:'publishMap',map,persist:true});
    await Promise.all(clients.map(c=>c.wait(m=>m.type==='mapChange'&&m.map.id===map.id,'attack map')));
    const workers=t=>clients[t].latest.units.filter(u=>u[1]===t&&u[5]==='worker').map(u=>u[0]);
    const observer=workers(team)[0];
    async function order(t,command,expected){
      const notice=await clients[t].command({...command,clientOrderToken:token++},new RegExp(`${expected.source}|REJECTED|FAILED`));
      assert.ok(expected.test(notice.message),notice.message);
    }
    await Promise.all([
      order(defender,{type:'build',buildingType:'dock',ids:workers(defender),x:.5,z:8.5},/DOCK PLACED/),
      order(team,{type:'build',buildingType:'archery-range',ids:workers(team),x:team?20.5:-20.5,z:-8.5},/RANGE PLACED/)]);
    const built=await fixture.checkpoint(s=>s.mapDefinition.id===map.id&&s.state.buildings.length===2&&s.state.buildings.every(b=>b.complete));
    assert.ok(built.state.units.filter(u=>u.buildingTargetId!==null).every(u=>u.kind==='worker'));
    await Promise.all([
      order(defender,{type:'trainUnit',buildingId:built.state.buildings.find(b=>b.type==='dock').id,kind:'skiff'},/QUEUED/),
      order(team,{type:'trainUnit',buildingId:built.state.buildings.find(b=>b.type==='archery-range').id,kind:'archer'},/QUEUED/),
      order(defender,{type:'move',ids:workers(defender),x:defender?20.5:-20.5,z:-14.5},/MOVE ORDER/)]);
    const ready=await fixture.checkpoint(s=>s.state.units.some(u=>u.kind==='skiff')&&s.state.units.some(u=>u.kind==='archer'));
    const boat=ready.state.units.find(u=>u.kind==='skiff'),archer=ready.state.units.find(u=>u.kind==='archer');
    const archerId=archer.id,boatId=boat.id,queuedType=team?'attackMove':'move';
    await Promise.all([
      order(team,{type:'move',ids:[observer],x:7.5,z:14.5},/MOVE ORDER/),
      order(team,{type:'move',ids:[archerId],x:team?2.5:-1.5,z:9.5},/MOVE ORDER/)]);
    await fixture.checkpoint(s=>[observer,archerId].every(id=>{
      const u=s.state.units[id];return !u.movePlanningPending&&u.pathIndex===u.path.length;
    }));
    await clients[team].state(s=>s.units.some(u=>u[0]===boatId),'boat revealed through ordinary friendly vision');
    await order(team,{type:'attack',ids:[archerId],unitGenerations:[archer.generation],targetId:boatId,targetGeneration:boat.generation},/ATTACK ORDER/);
    const firing=await fixture.checkpoint(s=>s.state.units[boatId].hp<120&&s.state.units[archerId].attackTargetId===boatId);
    await order(team,{type:queuedType,ids:[archerId],x:team?20.5:-20.5,z:-14.5,queue:true},/WAYPOINT QUEUED/);
    await order(defender,{type:'move',ids:[boatId],x:.5,z:16.5},/SKIFF WATER ROUTE/);
    const moving=await fixture.checkpoint(s=>s.state.units[boatId].path.length>0
      &&s.state.units[archerId].attackTargetId===boatId&&s.state.units[archerId].queuedWaypoints.length===1);
    const goal=moving.state.units[archerId].queuedWaypoints[0].destination;
    await fixture.stop();const saved=JSON.parse(await readFile(fixture.checkpointPath,'utf8'));
    assert.equal(saved.state.units[archerId].queuedWaypoints[0]?.destination,goal);
    await fixture.start();clients=[await fixture.connect(0,sessions[0]),await fixture.connect(1,sessions[1])];
    assert.ok(clients.every(c=>c.welcome.recoveredFromCheckpoint));
    let snapshotsChecked=0;
    const complete=await fixture.checkpoint(s=>{
      if(s.mapDefinition.id!==map.id)return false;snapshotsChecked++;
      const u=s.state.units[archerId];
      return u.hp>0&&u.attackTargetId===-1&&u.queuedWaypoints.length===0&&!u.movePlanningPending
        &&u.pathIndex===u.path.length&&u.moveGoalCell===goal
        &&Math.hypot(u.x-(goal%map.width-map.width/2+.5),u.z-(Math.floor(goal/map.width)-map.height/2+.5))<.02;
    });
    assert.ok(complete.state.units[boatId].hp>0,'queue continues without killing or hiding the unreachable boat');
    await clients[team].state(s=>s.units.some(u=>u[0]===boatId),'shore observer still reveals the live boat');
    const target=complete.state.units[boatId];assert.equal(target.x,.5);assert.equal(target.z,16.5);
    const hp=target.hp;await fixture.stop();await fixture.start();
    clients=[await fixture.connect(0,sessions[0]),await fixture.connect(1,sessions[1])];
    const stable=await fixture.checkpoint(s=>s.sequence>complete.sequence);
    assert.equal(stable.state.units[boatId].hp,hp);assert.equal(stable.state.units[archerId].attackTargetId,-1);
    assert.deepEqual(stable.state.units[archerId].queuedWaypoints,[]);
    const record={team,queuedType,initialVisibleShot:true,initialTargetHp:firing.state.units[boatId].hp,
      arrived:true,goal,targetHp:hp,targetVisibleAtCompletion:true,attackTargetId:-1,queued:0,
      restartDuringPursuit:true,postArrivalRestartStable:true,snapshotsChecked,
      ticks:complete.state.tickNumber-moving.state.tickNumber};
    console.log(JSON.stringify(record));return record;
  }finally{await fixture.dispose();}
}
const records=await Promise.all([run(0),run(1)]);
if(process.env.ATTACK_QUEUE_NATIVE_RECORD)await writeFile(process.env.ATTACK_QUEUE_NATIVE_RECORD,JSON.stringify({
  head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceSha256,records,
  limits:['actual two-seat servers, paid natural Archer/Skiff production and ordinary commands; no actor/HP/position injection',
    'native proof covers visible unreachable retreat and queued Move/Attack Move; death/fog loss have fixed-body tests',
    'no renderer, deployment, naval balance or performance claim']},null,2)+'\n');
