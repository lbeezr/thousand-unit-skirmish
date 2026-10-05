// Collection success is not clearance acceptance. Production bodies and game policy stay intact.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createPathingReplayFixture} from './pathing-replay-fixture.mjs';
import {canTraverseStaticBodySegment} from '../src/unit-movement.mjs';
process.env.RTS_MAP='maps/open-field.json';process.env.RTS_PREGAME='0';process.env.RTS_GAME_MODE='pvp';process.env.RTS_MOVE_PLANNING_TURNS_PER_TICK='0';delete process.env.RTS_MATCH_STATE_PATH;
const records=[];
for(const team of [0,1])for(const stance of ['aggressive','defensive','standGround','noAttack']){
 const map={id:'automatic-stance-pursuit-probe',name:'Automatic Stance Pursuit',width:64,height:48,terrainSeed:881,fogOfWar:false,startingArmySize:16,spawnPoints:[{team:0,x:-20,z:-16},{team:1,x:20,z:16}],resourceNodes:[],triggers:[],scenarioEvents:[],obstacles:[{column:33,row:25,width:1,height:1,material:'stone'}]};
 const f=await createPathingReplayFixture(map,{traceLandSteps:true,traceRouteRejoins:true}),r=f.replay;
 try{
  for(const seat of [0,1])r.order(seat,{type:'stop',ids:r.units.filter(u=>u.team===seat).map(u=>u.id)});
  const u=r.units.find(u=>u.team===team&&u.kind==='infantry'),e=r.units.find(u=>u.team!==team&&u.kind==='worker');
  const order=(a,type,p={})=>r.order(a.team,{type,ids:[a.id],unitGenerations:[a.generation],...p});
  order(u,'move',{x:.75,z:.95});order(e,'move',{x:2.5,z:.5});r.drain();
  for(let t=0;t<800&&[u,e].some(a=>a.movePlanningPending||a.pathIndex<a.path.length);t++)r.step();
  assert.deepEqual([u.x,u.z],[.75,.95]);assert.ok(canTraverseStaticBodySegment(u,u,.22,64,48,r.isWalkable));
  const notices=order(u,'setStance',{stance});let acquired,first,contacts=0,newContacts=0,steps=0,damage=[];
  for(let t=0;t<600;t++){
   const pursuit=u.stanceCombat&&!u.stanceReturning&&u.attackTargetId>=0, hp=e.hp;r.step();
   if(!acquired&&u.attackTargetId===e.id)acquired={t,path:[...u.path],targetId:e.id,anchor:[u.stanceAnchorX,u.stanceAnchorZ],attackAnchor:[u.attackMoveAnchorX,u.attackMoveAnchorZ]};
   if(e.hp!==hp)damage.push({t,hp:e.hp,attackTick:u.lastAttackTick,distance:Math.hypot(u.x-e.x,u.z-e.z)});
   if(pursuit||(u.stanceCombat&&!u.stanceReturning&&u.attackTargetId>=0))for(const s of r.landSteps.filter(s=>s.id===u.id)){
    steps++;if(!canTraverseStaticBodySegment(s.from,s.to,.22,64,48,r.isWalkable)){contacts++;if(canTraverseStaticBodySegment(s.from,s.from,.22,64,48,r.isWalkable)){newContacts++;first??=s;}}
   }
  }
  records.push({team,stance,id:u.id,enemyId:e.id,notices,acquired,contacts,newContacts,steps,first,damage,final:{x:u.x,z:u.z,goal:u.moveGoalCell,revision:u.orderRevision,hp:u.hp,enemyHp:e.hp,returning:u.stanceReturning,stanceCombat:u.stanceCombat}});
 }finally{await f.dispose();}
}
const sha256 = async name => createHash('sha256').update(await readFile(new URL('../'+name,import.meta.url))).digest('hex');
console.log(JSON.stringify({runtimeHashes:{server:await sha256('server.mjs'),combatMovement:await sha256('src/combat-movement.mjs'),unitMovement:await sha256('src/unit-movement.mjs')},source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim()!=='',records}));
