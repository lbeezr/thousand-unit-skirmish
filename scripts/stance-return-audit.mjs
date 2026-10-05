// Bounded read-only characterization, not universal return-clearance acceptance.
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';
import { canTraverseStaticBodySegment } from '../src/unit-movement.mjs';
process.env.RTS_MAP='maps/open-field.json';process.env.RTS_PREGAME='0';process.env.RTS_GAME_MODE='pvp';process.env.RTS_MOVE_PLANNING_TURNS_PER_TICK='0';delete process.env.RTS_MATCH_STATE_PATH;
const cases=[
 [[3.5,.5],[1.1,.5],[.5,1.5]], [[3.5,.5],[1.1,.5],[-5.5,2.5]],
 [[2.5,.5],[.75,.95],[-5.5,2.5]], [[2.5,.5],[.75,.95],[.5,8.5]],
 [[2.5,.5],[.75,.95],[-5.5,.5]], [[2.5,.5],[.75,.95],[6.5,3.5]],
 [[2.5,2.5],[.75,1.5],[-5.5,.5]], [[.5,2.5],[2.5,2.5],[4.5,-5.5]],
 [[2.5,.5],[.5,2.5],[-5.5,2.5]], [[.75,.95],[2.5,.5],[7.5,.5]],
 [[.5,3.5],[.5,1.5],[3.5,.5]], [[3.5,.5],[1.5,.75],[-4.5,3.5]],
];
const records=[];
for(const team of [0,1]) for(const [anchor,target,flee] of cases){
 const map={id:'stance-return-audit',name:'Stance Return Audit',width:64,height:48,terrainSeed:881,fogOfWar:false,startingArmySize:16,spawnPoints:[{team:0,x:-20,z:-16},{team:1,x:20,z:16}],resourceNodes:[],triggers:[],scenarioEvents:[],obstacles:[{column:33,row:25,width:1,height:1,material:'stone'}]};
 const f=await createPathingReplayFixture(map,{traceLandSteps:true,traceRouteRejoins:true}),r=f.replay;
 try{
  for(const seat of [0,1])r.order(seat,{type:'stop',ids:r.units.filter(u=>u.team===seat).map(u=>u.id)});
  const u=r.units.find(u=>u.team===team&&u.kind==='infantry'),e=r.units.find(u=>u.team!==team&&u.kind==='worker');
  const order=(a,type,p={})=>r.order(a.team,{type,ids:[a.id],unitGenerations:[a.generation],...p});
  order(u,'move',{x:anchor[0],z:anchor[1]});order(e,'move',{x:target[0],z:target[1]});r.drain();
  for(let t=0;t<800&&[u,e].some(a=>a.movePlanningPending||a.pathIndex<a.path.length);t++)r.step();
  order(u,'setStance',{stance:'defensive'});let acquired=false,firstReturn,contacts=0,newContacts=0,steps=0,maxTravel=0,damage=[];
  for(let t=0;t<900;t++){
   if(u.attackTargetId===e.id&&!acquired){acquired=true;order(e,'move',{x:flee[0],z:flee[1]});}
   const returning=u.stanceReturning, hp=e.hp;r.step();maxTravel=Math.max(maxTravel,Math.hypot(u.x-anchor[0],u.z-anchor[1]));
   if(e.hp!==hp)damage.push({t,hp:e.hp});
   if(u.stanceReturning&&!firstReturn)firstReturn={t,x:u.x,z:u.z,goal:u.moveGoalCell,anchor:[u.stanceAnchorX,u.stanceAnchorZ],target:e.hp,path:[...u.path]};
   if(returning||u.stanceReturning)for(const s of r.landSteps.filter(s=>s.id===u.id)){
    steps++;const safe=p=>canTraverseStaticBodySegment(p,p,.22,64,48,r.isWalkable);
    if(!canTraverseStaticBodySegment(s.from,s.to,.22,64,48,r.isWalkable)){contacts++;if(safe(s.from)){newContacts++;firstReturn.firstUnsafe??=s;}}
   }
  }
  records.push({team,anchor,target,flee,acquired,firstReturn,contacts,newContacts,steps,maxTravel,damage,final:{x:u.x,z:u.z,returning:u.stanceReturning,hp:u.hp,enemyHp:e.hp}});
 }finally{await f.dispose();}
}
const sha256 = async name => createHash('sha256').update(await readFile(new URL('../'+name,import.meta.url))).digest('hex');
console.log(JSON.stringify({source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim()!=='',runtimeHashes:{server:await sha256('server.mjs'),combatMovement:await sha256('src/combat-movement.mjs'),unitMovement:await sha256('src/unit-movement.mjs')},records}));
