import assert from 'node:assert/strict';
import { guardFor, projectOrdinaryStep } from './crowd-executor-projection.mjs';
import { ordinaryCrowdBodyRadius } from '../src/unit-crowd-steering.mjs';
import { LAND_CLEARANCE_PROFILE, pointSegmentDistanceSquared, canTraverseUnitStep, canTraverseStaticBodySegment } from '../src/unit-movement.mjs';
const E = 1e-9;
// This finite maneuver is a diagnostic intervention, not a game recovery policy.
// No peer receives movement, priority or reserved space. Only the owner spends its own budget.
export function createFiniteRoomProbe(config){
 assert.ok(Number.isInteger(config.ownerId) && config.peerIds.length <= 4);
 assert.ok([90,-90,105,-105,135,-135,180].includes(config.angle));
 const events=[];const stats={calls:0,targetMismatches:0,maxStaticCells:0,maxBodies:0,maxQueryVisits:0,maxPassageProposals:0,maxPassageBodyVisits:0};let maneuver=null,attempted=false;
 const write=o=>events.push(o);
 const cancelAttempt=(tick,reason)=>{const wasAttempted=attempted;attempted=true;if(maneuver&&!maneuver.done){maneuver.done=true;write({type:'abort',tick,reason,distance:maneuver.distance,steps:maneuver.steps});}else if(!maneuver&&!wasAttempted)write({type:'abort',tick,reason,distance:0,steps:0});};
 function guard(u,initial,context){return u===initial.actor&&u.generation===initial.generation&&u.orderRevision===initial.orderRevision&&u.path===initial.path&&u.pathIndex===initial.pathIndex&&context.navigationRevision===initial.navigationRevision&&context.epoch===initial.epoch;}
 return {get report(){return {stats,events};},cancel:cancelAttempt,select(ctx){const {unit:u,tick,remainingStep,query,map,navigationRevision,epoch,normal,hasGrant}=ctx;
  const cancel=reason=>{if(u.id===config.ownerId)cancelAttempt(tick,reason);};
  if(u.id===config.ownerId&&maneuver&&!maneuver.done){if(tick>maneuver.lastObservedTick+1)cancel('observation-gap');maneuver.lastObservedTick=tick;}
  if(!ordinaryCrowdBodyRadius(u)){cancel('eligibility-loss');return normal;}
  const projection=projectOrdinaryStep({unit:u,budget:{actor:u,tick,remainingStep,kind:'own-call'},expected:guardFor(u,tick,navigationRevision,epoch),tick,navigationRevision,epoch,query,map});
  if(projection.status!=='projected')cancel(projection.status);
  const peers=config.peerIds;stats.calls++;for(const[k,key]of Object.entries({maxStaticCells:'staticCells',maxBodies:'bodyVisits',maxQueryVisits:'queryVisits',maxPassageProposals:'passageProposals',maxPassageBodyVisits:'passageBodyVisits'}))stats[k]=Math.max(stats[k],projection.stats[key]??0);
  if(projection.status==='projected'&&normal?.target&&Math.hypot(projection.target.x-normal.target.x,projection.target.z-normal.target.z)>E)stats.targetMismatches++;
  if(config.mode!=='retreat'||u.id!==config.ownerId||tick<config.startTick||projection.status!=='projected')return normal;
  if(!attempted){attempted=true;if(query.neighbors.some(o=>!ordinaryCrowdBodyRadius(o)&&Math.hypot(o.x-projection.target.x,o.z-projection.target.z)<projection.radius+LAND_CLEARANCE_PROFILE.radiusByKind[o.kind]-E)){write({type:'refused',tick,reason:'parked-target-wait'});return normal;}if(hasGrant){write({type:'refused',tick,reason:'existing-grant'});return normal;}
   const dx=projection.target.x-u.x,dz=projection.target.z-u.z,d=Math.hypot(dx,dz),a=config.angle*Math.PI/180;
   if(!d){write({type:'refused',tick,reason:'no-heading'});return normal;}
   const direction={x:dx/d*Math.cos(a)-dz/d*Math.sin(a),z:dz/d*Math.cos(a)+dx/d*Math.sin(a)},far={x:u.x+direction.x*.75,z:u.z+direction.z*.75};
   const terrain=inBounds(far,map)&&canTraverseUnitStep(map.cell(u.x,u.z),map.cell(far.x,far.z),map.width,map.levels,map.isWalkable)&&canTraverseStaticBodySegment(u,far,projection.radius,map.width,map.height,map.isWalkable);
   const contacts=query.neighbors.map(o=>({id:o.id,generation:o.generation,margin:Math.sqrt(pointSegmentDistanceSquared(o,u,far))-projection.radius-LAND_CLEARANCE_PROFILE.radiusByKind[o.kind]}));
   const margin=Math.min(...contacts.map(c=>c.margin));
   if(!terrain||margin<-E){write({type:'refused',tick,reason:!terrain?'corridor-terrain':'corridor-body',margin,blockers:contacts.filter(c=>c.margin<-E)});return normal;}
   maneuver={initial:guardFor(u,tick,navigationRevision,epoch),start:{x:u.x,z:u.z},direction,distance:0,steps:0,until:tick+12,lastObservedTick:tick,done:false,nextPose:{x:u.x,z:u.z}};
   write({type:'start',tick,id:u.id,direction,far,margin,peerPreviews:peers.map(id=>{const p=ctx.units[id],pq=ctx.queryFor(p);return {id,projection:clean(projectOrdinaryStep({unit:p,budget:{actor:p,tick,remainingStep:2.6/30,kind:'future-turn-bound'},expected:guardFor(p,tick,navigationRevision,epoch),tick,navigationRevision,epoch,query:pq,map}))};})});
  }
  if(!maneuver||maneuver.done)return normal;
  if(!guard(u,maneuver.initial,ctx)||hasGrant||tick>=maneuver.until||Math.hypot(u.x-maneuver.nextPose.x,u.z-maneuver.nextPose.z)>E){maneuver.done=true;write({type:'abort',tick,reason:'guard-or-duration-or-pose',distance:maneuver.distance,steps:maneuver.steps});return normal;}
  const length=Math.min(remainingStep,.25,.75-maneuver.distance);if(length<=E){maneuver.done=true;write({type:'finish',tick,distance:maneuver.distance,steps:maneuver.steps});return normal;}
  const to={x:u.x+maneuver.direction.x*length,z:u.z+maneuver.direction.z*length};
  const terrain=inBounds(to,map)&&canTraverseUnitStep(map.cell(u.x,u.z),map.cell(to.x,to.z),map.width,map.levels,map.isWalkable)&&canTraverseStaticBodySegment(u,to,projection.radius,map.width,map.height,map.isWalkable);
  const contacts=query.neighbors.map(o=>({id:o.id,generation:o.generation,margin:Math.sqrt(pointSegmentDistanceSquared(o,u,to))-projection.radius-LAND_CLEARANCE_PROFILE.radiusByKind[o.kind]}));
  const margin=Math.min(...contacts.map(c=>c.margin));
  if(!terrain||margin<-E){maneuver.done=true;write({type:'abort',tick,reason:!terrain?'step-terrain':'step-body',margin,blockers:contacts.filter(c=>c.margin<-E),distance:maneuver.distance,steps:maneuver.steps});return normal;}
  maneuver.distance+=length;maneuver.steps++;maneuver.nextPose=to;
  write({type:'retreat-step',tick,id:u.id,from:{x:u.x,z:u.z},to,length,margin,distance:maneuver.distance,steps:maneuver.steps,availableBudget:remainingStep});
  if(maneuver.distance>=.75-E){maneuver.done=true;write({type:'finish',tick,distance:maneuver.distance,steps:maneuver.steps});}
  return {x:maneuver.direction.x,z:maneuver.direction.z,target:projection.target,stepDistance:length,yieldingForCrowd:true,crowd:normal?.crowd,crowdControl:normal?.crowdControl};
 }};
}
function clean(p){return {...p,bodyBlockers:p.bodyBlockers?.map(({actor,...rest})=>rest)};}

const inBounds=(p,map)=>p.x>=-map.width/2+.5&&p.x<=map.width/2-.5&&p.z>=-map.height/2+.5&&p.z<=map.height/2-.5;
