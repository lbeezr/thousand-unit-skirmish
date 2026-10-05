import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';
import { activeLandMovementBodyRadius,canTraverseStaticBodySegment } from '../src/unit-movement.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
process.env.RTS_MAP='maps/open-field.json';process.env.RTS_GAME_MODE='pvp';process.env.RTS_PREGAME='0';delete process.env.RTS_MATCH_STATE_PATH;
const map={id:'worker-persistent-audit',name:'Worker persistent caller audit',width:64,height:48,terrainSeed:881,fogOfWar:true,startingArmySize:16,spawnPoints:[{team:0,x:-20,z:-16},{team:1,x:20,z:16}],resourceNodes:[],triggers:[],scenarioEvents:[],obstacles:[{column:33,row:25,width:1,height:1,material:'stone'}]};
const records=[];
for(const team of [0,1])for(const type of ['patrol','follow'])for(const turns of [0,1])for(const continuation of ['live','cold','queuedCold']){
 process.env.RTS_MOVE_PLANNING_TURNS_PER_TICK=String(turns);
 const f=await createPathingReplayFixture(map,{traceLandSteps:true,traceRouteRejoins:true});let r=f.replay,cold;
 try{
  const command=(id,type,fields={})=>r.order(r.units[id].team,{type,ids:[id],unitGenerations:[r.units[id].generation],...fields});
  for(const seat of [0,1])r.order(seat,{type:'stop',ids:r.units.filter(u=>u.team===seat).map(u=>u.id)});
  const workerIds=r.units.filter(u=>u.team===team&&u.kind==='worker').map(u=>u.id),id=workerIds[0],leaderId=workerIds[1];
  command(id,'move',{x:.79,z:.95});if(type==='follow')command(leaderId,'move',{x:6.5,z:.5});r.drain();
  for(let t=0;t<1000&&[id,...(type==='follow'?[leaderId]:[])].some(i=>r.units[i].movePlanningPending||r.units[i].pathIndex<r.units[i].path.length);t++)r.step();
  assert.deepEqual([r.units[id].x,r.units[id].z],[.79,.95]);assert.ok(canTraverseStaticBodySegment(r.units[id],r.units[id],.18,64,48,r.isWalkable));
  const notices=command(id,type,type==='patrol'?{x:6.5,z:.5}:{targetId:leaderId,targetGeneration:r.units[leaderId].generation});assert.ok(notices.some(n=>n.message.includes(type.toUpperCase())));
  for(let t=0;t<60&&!r.units[id].movePlanningPending;t++)r.step();
  assert.ok(r.units[id].movePlanningPending);
  const accepted=structuredClone(r.units[id]);
  if(continuation==='queuedCold')command(id,'move',{x:-3.5,z:-3.5,queue:true});
  if(continuation!=='live'){
   const saved=JSON.parse(JSON.stringify(r.checkpoint()));assert.ok(r.validate(structuredClone(saved)));
   cold=await createPathingReplayFixture(map,{traceLandSteps:true,traceRouteRejoins:true});r=cold.replay;r.restore(saved);
  }
  let contacts=0,newContacts=0,steps=0,first,cycles=0,lastLeg=r.units[id].persistentOrder?.leg;const joins=[];
  for(let t=0;t<650;t++){
   r.step();const u=r.units[id];
   if(u.persistentOrder?.leg!==lastLeg){cycles++;lastLeg=u.persistentOrder?.leg;}
   for(const j of r.routeRejoins.filter(j=>j.id===id))if(joins.length<3)joins.push(j);
   for(const s of r.landSteps.filter(s=>s.id===id)){
    steps++;if(!canTraverseStaticBodySegment(s.from,s.to,.18,64,48,r.isWalkable)){contacts++;if(canTraverseStaticBodySegment(s.from,s.from,.18,64,48,r.isWalkable)){newContacts++;first??=s;}}
   }
  }
  const u=r.units[id];records.push({team,type,turns,continuation,id,leaderId:type==='follow'?leaderId:undefined,notices,accepted:{goal:accepted.moveGoalCell,point:accepted.moveGoalPoint,revision:accepted.orderRevision,persistent:accepted.persistentOrder,radius:activeLandMovementBodyRadius(accepted)},steps,contacts,newContacts,first,cycles,joins,final:{x:u.x,z:u.z,goal:u.moveGoalCell,revision:u.orderRevision,radius:activeLandMovementBodyRadius(u),persistent:u.persistentOrder,hp:u.hp,cargo:u.cargo,queue:u.queuedWaypoints,queuedComplete:continuation==='queuedCold'&&Math.hypot(u.x+3.5,u.z+3.5)<.001}});
 }finally{await cold?.dispose();await f.dispose();}
}
const runtimeHashes={};for(const p of ['server.mjs','src/unit-movement.mjs','src/combat-movement.mjs'])runtimeHashes[p]=createHash('sha256').update(await readFile(root+'/'+p)).digest('hex');
const report={source:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),dirty:execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim()!=='',runtimeHashes,limits:['Actual commands/full valid checkpoints/separate production modules; no runtime/pose/HP/route patch','Static Worker circle probe only; no body-pair or rendered acceptance','Collector completion does not imply geometry acceptance'],records};
if(process.env.WORKER_PERSISTENT_AUDIT_RECORD)await writeFile(process.env.WORKER_PERSISTENT_AUDIT_RECORD,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
