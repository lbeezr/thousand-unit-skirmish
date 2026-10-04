import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';

const map={id:'direct-move-cold-recovery',name:'DIRECT MOVE COLD RECOVERY',width:96,height:96,
  terrainSeed:881,fogOfWar:true,startingArmySize:16,
  spawnPoints:[{team:0,x:-32,z:-24},{team:1,x:32,z:24}],
  resourceNodes:[],obstacles:[],triggers:[],scenarioEvents:[]};
const f=await createFortifiedFixture({mapPath:'maps/open-field.json',timeoutMs:45000});
const orders=[],selected=[];let token=400;
try{
  await f.start();let clients=[await f.connect(0),await f.connect(1)];
  clients[0].send({type:'publishMap',map});
  await Promise.all(clients.map(c=>c.wait(m=>m.type==='mapChange'&&m.map.id===map.id,'direct Move map')));
  for(const team of [0,1]){
    const c=clients[team],u=c.latest.units.find(u=>u[1]===team&&u[5]==='infantry'),sign=team?1:-1;
    selected.push(u[0]);
    for(const command of [
      {type:'move',ids:[u[0]],unitGenerations:[u[8]],x:sign*24.3,z:sign*9.6},
      {type:'move',ids:[u[0]],unitGenerations:[u[8]],x:sign*16.2,z:sign*3.8,queue:true},
    ]){
      command.clientOrderToken=token++;
      const notice=await c.command(command,/MOVE ORDER|WAYPOINT QUEUED|REJECTED|FAILED/);
      assert.ok(/MOVE ORDER|WAYPOINT QUEUED/.test(notice.message),notice.message);
      orders.push({team,command,notice:notice.message});
    }
  }
  const before=await f.checkpoint(s=>s.mapDefinition.id===map.id
    &&selected.every(id=>s.state.units[id].path.length===1&&s.state.units[id].queuedWaypoints.length===1));
  const tokens=clients.map(c=>c.welcome.player.sessionToken);
  assert.ok(tokens.every(t=>typeof t==='string'&&t.length>0));
  await f.stop();const shutdown=JSON.parse(await readFile(f.checkpointPath,'utf8'));
  await f.start();clients=[await f.connect(0,tokens[0]),await f.connect(1,tokens[1])];
  assert.ok(f.logs.includes('Restored match'));
  assert.ok(clients.every(c=>c.welcome.player.resumed&&c.welcome.state.tick>=shutdown.state.tickNumber));
  const restored=await f.checkpoint(s=>s.mapDefinition.id===map.id&&s.state.tickNumber>shutdown.state.tickNumber);
  for(const id of selected){
    assert.equal(restored.state.units[id].generation,before.state.units[id].generation);
    assert.equal(restored.state.units[id].orderRevision,before.state.units[id].orderRevision);
    assert.deepEqual(restored.state.units[id].queuedWaypoints,before.state.units[id].queuedWaypoints);
  }
  // Idle defensive stance takes ownership immediately after Move completion.
  // Check the accepted final command's point, rather than requiring its retired
  // ordinary-Move metadata to survive that existing combat transition.
  const done=u=>!u.movePlanningPending&&!u.queuedWaypoints.length&&u.pathIndex===u.path.length
    &&Math.hypot(u.x-(u.team?1:-1)*16.2,u.z-(u.team?1:-1)*3.8)<.02;
  const completed=await f.checkpoint(s=>s.mapDefinition.id===map.id&&selected.every(id=>done(s.state.units[id])));
  for(const id of selected)assert.equal(completed.state.units[id].moveGoalCell,before.state.units[id].queuedWaypoints[0].destination);
  for(const [index,id] of selected.entries()) {
    const sign=index?1:-1,unit=completed.state.units[id];
    assert.deepEqual([unit.x,unit.z],[sign*16.2,sign*3.8],'native queued endpoint keeps the requested fractional point');
    assert.equal(unit.hp,before.state.units[id].hp,'combat cannot masquerade as a movement timeout');
  }
  const report={head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
    serverSha256:createHash('sha256').update(await readFile(new URL('../server.mjs',import.meta.url))).digest('hex'),
    pathLineSha256:createHash('sha256').update(await readFile(new URL('../src/unit-path-line.mjs',import.meta.url))).digest('hex'),
    node:process.version,orders,beforeTick:before.state.tickNumber,restoredTick:restored.state.tickNumber,
    completedTick:completed.state.tickNumber,
    units:selected.map(id=>({id,team:completed.state.units[id].team,generation:completed.state.units[id].generation,
      revision:completed.state.units[id].orderRevision,goal:completed.state.units[id].moveGoalCell,
      x:completed.state.units[id].x,z:completed.state.units[id].z,arrived:done(completed.state.units[id])})),
    coldRestart:true,limits:['actual two-seat WebSocket commands and checkpoint-driven process restart; no renderer or hosted deployment claim']};
  if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
}catch(error){
  const snapshot=await f.checkpoint().catch(()=>null);
  console.error(JSON.stringify({failure:error.message,tick:snapshot?.state.tickNumber,
    units:snapshot?.state.units.filter(u=>selected.includes(u.id)).map(u=>({id:u.id,hp:u.hp,
      x:u.x,z:u.z,goal:u.moveGoalCell,point:u.moveGoalPoint,path:u.path,pathIndex:u.pathIndex,
      queued:u.queuedWaypoints,pending:u.movePlanningPending,revision:u.orderRevision,
      attackTarget:u.attackTargetId,stanceCombat:u.stanceCombat,stanceReturning:u.stanceReturning}))}));
  throw error;
}finally{await f.dispose();}
