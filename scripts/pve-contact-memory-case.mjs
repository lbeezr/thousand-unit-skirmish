import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createPveHeadlessFixture,assertRecoveredWorkerObservation} from './pve-headless-fixture.mjs';
import {createSkirmishTargetPolicy} from '../src/simulation/ai/policies/skirmish-targets.mjs';
import {toOpponentObservation} from '../src/pve-opponent.mjs';

const identity={matchModeId:'skirmish',matchModeVersion:1};
const accepted=notices=>!notices.some(n=>/REJECTED|FAILED|UNREACHABLE|NO REACHABLE|BLOCKED/.test(n.message||''));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const wire=value=>JSON.parse(JSON.stringify(value)); // Persisted arrays use JSON nulls for holes.

/** Current rules, ordinary owned setup orders; no grants, unit/state edits or hidden policy inputs. */
export async function createContactMemoryCase(){
 const map=JSON.parse(await readFile(new URL('../maps/veyrholds-terraced-vale.json',import.meta.url)));
 const fixture=await createPveHeadlessFixture(map,identity),r=fixture.replay,orders=[];
 const view=team=>toOpponentObservation(r.observe(team),team,map);
 const guard=view(1).units.friendly.find(u=>u.kind==='infantry'&&u.hp>0);
 const enemy=view(0).units.friendly.find(u=>u.kind==='worker'&&u.hp>0);
 const guardPoint={x:-38.5,z:-17.5},enemyPoint={x:-32.5,z:-17.5};
 const order=async(team,command)=>{const notices=await r.order(team,command);r.drain();assert(accepted(notices),JSON.stringify({command,notices}));orders.push({tick:r.observe(team).tick,team,command,notices});};
 const actor=(team,id)=>view(team).units.friendly.find(u=>u.id===id&&u.hp>0);
 try{
  const opening=r.checkpoint();assert.deepEqual(opening.state.teamFood,[150,150]);assert.deepEqual(opening.state.teamWood,[250,250]);
  await order(1,{type:'move',ids:[guard.id],unitGenerations:[guard.generation],...guardPoint});
  await order(0,{type:'move',ids:[enemy.id],unitGenerations:[enemy.generation],...enemyPoint});
  let positioned=false;
  for(let step=1;step<=3600;step++){
   r.step();if(step%3===0)r.checkpoint();if(step%30)continue;
   const a=actor(1,guard.id),b=actor(0,enemy.id);assert(a&&b&&a.hp===guard.hp&&b.hp===enemy.hp,'setup actors stay alive and undamaged');
   if(distance(a,guardPoint)<.6&&distance(b,enemyPoint)<.6){positioned=true;break;}
  }
  assert(positioned,'owned positioning completes within120seconds');
  await order(1,{type:'hold',ids:[guard.id],unitGenerations:[guard.generation]});
  await order(0,{type:'hold',ids:[enemy.id],unitGenerations:[enemy.generation]});
  let lastDisclosed=view(1);assert(lastDisclosed.units.visibleEnemies.some(u=>u.id===enemy.id),'real native sight discloses setup Worker');
  await order(0,{type:'move',ids:[enemy.id],unitGenerations:[enemy.generation],x:-15.5,z:-17.5});
  let lost=false;
  for(let step=1;step<=600;step++){
   r.step();if(step%3===0)r.checkpoint();if(step%30)continue;
   const o=view(1);if(o.units.visibleEnemies.some(u=>u.id===enemy.id))lastDisclosed=o;
   else{lost=true;break;}
  }
  assert(lost,'owned Worker movement loses current sight');
  const disclosed=lastDisclosed.units.visibleEnemies.find(u=>u.id===enemy.id);
  const checkpoint=r.checkpoint();assert.deepEqual(checkpoint.state.teamFood,[150,150]);assert.deepEqual(checkpoint.state.teamWood,[250,250]);
  assert.equal(checkpoint.state.units.filter(u=>u.hp>0).length,24);
  return {map,source:'current ordinary setup, not PR371 replay',checkpoint,views:[r.observe(0),r.observe(1)],priming:lastDisclosed,
   contact:{x:disclosed.x,z:disclosed.z},tick:checkpoint.state.tickNumber,enemyId:enemy.id,cohortIds:[guard.id],orders,
   openingSHARelevant:{food:opening.state.teamFood,wood:opening.state.teamWood,living:24}};
 }finally{await fixture.dispose();}
}

/** Controlled contact-loss inspection; the fresh-policy arm is the no-disclosure causal control. */
export async function replayContactMemory(data,{factory=createSkirmishTargetPolicy,disclosed=true,cold=false,seconds=30}={}){
 let fixture=await createPveHeadlessFixture(data.map,identity),r=fixture.replay,policy=factory(0);
 const ids=new Set(data.cohortIds),trace=[],metrics={firstWithin2:null,nearest:Infinity,firstGlobal:null,redisclosed:null,rejected:0},stages={};
 const view=()=>toOpponentObservation(r.observe(1),1,data.map);
 const soldiers=o=>o.units.friendly.filter(u=>u.hp>0&&ids.has(u.id));
 try{
  r.restore(data.checkpoint);for(const team of [0,1])assertRecoveredWorkerObservation(wire(r.observe(team)),wire(data.views[team]));
  if(disclosed){const o=structuredClone(data.priming);policy.next(o,soldiers(o));}
  const initial=r.checkpoint();
  for(let step=0;step<=seconds*30;step++){
   if(step%3===0){const state=r.checkpoint().state;const own=state.units.filter(u=>u.team===1&&u.hp>0&&ids.has(u.id));
    const nearest=Math.min(...own.map(u=>distance(u,data.contact)));metrics.nearest=Math.min(metrics.nearest,nearest);
    if(nearest<=2)metrics.firstWithin2??=state.tickNumber;
   }
   if(step%30===0){
    if(cold&&step===30){const before=[r.observe(0),r.observe(1)],saved=r.checkpoint(),next=await createPveHeadlessFixture(data.map,identity);
     next.replay.restore(saved);for(const team of [0,1])assertRecoveredWorkerObservation(next.replay.observe(team),before[team]);
     await fixture.dispose();fixture=next;r=fixture.replay;policy=factory(0);stages.restart=r.observe(1).tick;
    }
    const o=view();if(o.units.visibleEnemies.some(u=>u.id===data.enemyId))metrics.redisclosed??=o.tick;
    if(step===seconds*30)break;
    for(const command of policy.next(o,soldiers(o))){
     if(command.type==='attack')assert(o.units.visibleEnemies.some(u=>u.id===command.targetId&&u.generation===command.targetGeneration));
     if(command.type==='attackMove'){assert(!('targetId'in command)&&!('targetGeneration'in command));
      if(command.x!==data.contact.x||command.z!==data.contact.z)metrics.firstGlobal??=o.tick;
     }
     const notices=await r.order(1,command);r.drain();metrics.rejected+=Number(!accepted(notices));assert(accepted(notices),JSON.stringify({command,notices}));
     trace.push({tick:o.tick,command,notices});
    }
   }
   r.step();
  }
  return {disclosed,cold,seconds,initial,metrics,stages,trace,final:r.checkpoint()};
 }finally{await fixture.dispose();}
}
