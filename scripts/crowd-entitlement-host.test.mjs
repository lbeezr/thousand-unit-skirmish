// Bounded adapter execution only: no server, native match, journey or renderer.
import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import * as movement from '../src/unit-movement.mjs';
import * as crowd from '../src/unit-crowd-steering.mjs';
import * as protocol from '../src/crowd-moving-entitlement.mjs';
import {UNIT_DEFINITIONS} from '../src/gameplay-definitions.mjs';

const source=readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
const helpers=source.slice(source.indexOf('function getMoveVector('),source.indexOf('function stationaryWorkerCellsNear('));
const loopStart=source.indexOf('  for (const unit of units) {',source.indexOf('function simulateTick('));
// There are earlier simulation loops. Anchor the executor by its combat-closure comment.
const comment=source.indexOf('    // A target can move within its current cell after the flow path ends.');
const executorStart=source.lastIndexOf('  for (const unit of units) {',comment);
const executor=source.slice(executorStart,source.indexOf('  enqueueRouteRepairs(blockedRouteRepairs);',executorStart));
assert.ok(loopStart>=0 && executorStart>loopStart && executor.includes('finalizeCrowdMovement'));
const actor=(id,x,z,index=0)=>({id,x,z,generation:900+id,orderRevision:1,kind:'infantry',hp:100,
  path:[12,11,10,2],pathIndex:index,moveGoalCell:2,attackTargetId:-1,attackBuildingTargetId:-1,
  gatherNodeId:null,gatherForestCell:-1,buildingTargetId:null,queuedWaypoints:[{destination:1}]});
function host() {
  const peer=actor(1,.62,-3.47,0),unit=actor(2,0,-3.49),units=[peer,unit];
  const cell=(x,z)=>Math.floor(z+4)*8+Math.floor(x+4);
  const point=c=>({x:c%8-3.5,z:Math.floor(c/8)-3.5});
  const c=vm.createContext({...movement,...crowd,...protocol,UNIT_DEFINITIONS,units,
    STEP_SECONDS:1/30,MAP_WIDTH:8,MAP_HEIGHT:8,MAP_HALF_X:4,MAP_HALF_Z:4,
    worldToCell:cell,cellToWorld:point,isWalkable:i=>i>=0&&i<64,
    elevationLevelByCell:new Uint8Array(64),tickNumber:40,navigationRevision:0,movePlanningEpoch:1,
    spatialBucketRosterCurrent:true,SEPARATION_DIAGNOSTICS_ENABLED:false,
    constructionMovementActive:()=>false,workerPatrolAcquiredMovementActive:()=>false,
    automaticPositionAllowed:()=>true,blockedRouteRepairs:[],dirty:false,
    detourRouteLedger:null,landRouteRetentionTick:null});
  vm.runInContext(helpers,c);
  // The production bounded broad phase is covered by the frozen replay. This
  // tiny host isolates live selector/write/finalizer semantics with exact poses.
  c.crowdNeighborsNear=u=>({neighbors:units.filter(other=>other!==u&&other.hp>0&&other.movementDomain!=='water'),overflow:false,visits:units.length});
  c.run=()=>vm.runInContext(executor,c);
  c.getMoveVector(unit);c.getMoveVector(peer);
  for (const u of units) Object.assign(crowd.crowdSteeringRecord(u),{lastProgressTick:0,bestDistance:0});
  return {c,peer,unit,units};
}
function issue() {
  const h=host();crowd.crowdExecutionState(h.peer,h.c.tickNumber).spent=h.c.crowdNextBudget(h.peer);h.c.run();
  const q=crowd.crowdSteeringRecord(h.unit).offer?.moving?.request;
  assert.ok(q,'the real ordinary selector recorded its sole-claim lateral request');
  assert.deepEqual({x:h.unit.x,z:h.unit.z},q.from,'failed recovery leaves request pose intact');
  h.c.tickNumber++;h.c.run();
  const r=crowd.crowdMovingEntitlement.reservation(h.peer);
  assert.ok(r,'finalized peer progress published a named next-tick step');
  assert.equal(r.winner,h.unit);assert.equal(crowd.crowdSteeringRecord(h.unit).lastGrantTick,h.c.tickNumber);
  assert.deepEqual({x:h.unit.x,z:h.unit.z},r.request.to);
  return {...h,r};
}

test('default production selector and actual executor publish, admit and consume the exact named quantum',()=>{
  const h=issue(),to={...h.r.to},routes=h.units.map(u=>u.path),queue=h.unit.queuedWaypoints;
  h.c.tickNumber++;h.c.run();
  assert.deepEqual({x:h.peer.x,z:h.peer.z},to,'service runs before ordinary tangent ranking');
  assert.equal(crowd.crowdMovingEntitlement.reservation(h.peer),null);
  assert.equal(crowd.crowdMovingEntitlement.obligation(h.unit,h.c.crowdEntitlementContext(h.unit)),null);
  assert.equal(h.unit.queuedWaypoints,queue);h.units.forEach((u,i)=>assert.equal(u.path,routes[i]));
  for(const u of h.units){const e=crowd.crowdSteeringRecord(u).execution;
    assert.ok(e.spent<=h.c.crowdNextBudget(u)+1e-9);assert.ok(e.work.proposals<=128);}
});

test('every land writer is bound; zero arrival is free and a recipient command retains its safety-only lease',()=>{
  const h=issue();
  assert.equal((source.match(/admitCrowdLandWrite\(unit,/g)??[]).length,6,'one declaration and all five live writers');
  assert.ok(source.includes('admitCrowdLandWrite(unit, { x: nextX, z: nextZ }, true)'));
  assert.ok(source.includes('admitCrowdLandWrite(unit, { x: fallbackX, z: fallbackZ }, true)'));
  h.unit.orderRevision++;h.unit.path=[...h.unit.path];h.unit.pathIndex++;h.unit.holdingPosition=true;
  // A selector policy reset may observe this profile; birth-bound safety persists.
  crowd.selectCrowdStep({unit:h.unit,target:{x:1,z:1},stepDistance:0,neighbors:[],canTraverse:()=>true});
  const c=h.c.crowdEntitlementContext(h.unit);
  assert.ok(crowd.crowdMovingEntitlement.obligation(h.unit,c));
  const before=crowd.crowdSteeringRecord(h.unit).execution.spent;
  assert.ok(h.c.admitCrowdLandWrite(h.unit,{x:h.unit.x,z:h.unit.z}));
  assert.equal(crowd.crowdSteeringRecord(h.unit).execution.spent,before);
  const crossing=actor(4,h.r.to.x-.439,h.r.to.z-.04);h.units.push(crossing);
  assert.equal(h.c.admitCrowdLandWrite(crossing,{x:crossing.x,z:crossing.z+.08}),false,'clear endpoints do not admit a capsule crossing');
  h.c.tickNumber++;h.c.run();assert.deepEqual({x:h.peer.x,z:h.peer.z},h.r.to,'Hold acknowledgement still binds this actor birth');
});

test('fresh priority, invalidation, overflow, current budget and missing receipt cancel safely',()=>{
  for(const change of ['route','navigation','epoch','budget','overflow','ack']) {
    const h=issue();h.c.tickNumber++;
    if(change==='route')h.peer.orderRevision++;
    if(change==='navigation')h.c.navigationRevision++;
    if(change==='epoch')h.c.movePlanningEpoch++;
    if(change==='budget')crowd.crowdExecutionState(h.peer,h.c.tickNumber).spent=h.c.crowdNextBudget(h.peer);
    if(change==='overflow')h.c.crowdNeighborsNear=u=>({neighbors:h.units.filter(other=>other!==u),overflow:true,visits:128});
    if(change==='ack')crowd.crowdSteeringRecord(h.unit).lease.pending=true;
    const c=h.c.crowdEntitlementContext(h.peer);
    assert.equal(crowd.crowdMovingEntitlement.take(h.peer,c,crowd.crowdExecutionState(h.peer,h.c.tickNumber).work),null,change);
    assert.equal(crowd.crowdMovingEntitlement.reservation(h.peer),null,change);
  }
});

test('passive context probes do not allocate a neighbor record; restore epochs retire authority',()=>{
  const h=host(),other=actor(9,1.5,-1.5);h.units.push(other);
  assert.equal(crowd.crowdSteeringRecord(other),undefined);
  const c=h.c.crowdEntitlementContext(h.peer);c.remainingBudgetOf(other);c.claims(other,{x:1.4,z:-1.5});
  assert.equal(crowd.crowdSteeringRecord(other),undefined);
  const live=issue();live.c.movePlanningEpoch++;
  assert.equal(crowd.crowdMovingEntitlement.hasReservations(live.c.crowdEntitlementContext(live.peer)),false);
  assert.equal(crowd.crowdMovingEntitlement.obligation(live.unit,live.c.crowdEntitlementContext(live.unit)),null);
});

test('real zero-position terminal admission advances one waypoint without spending or clearing safety',()=>{
  const h=issue(),lease=crowd.crowdSteeringRecord(h.unit).lease,grant=crowd.crowdSteeringRecord(h.unit).lastGrantTick;
  h.unit.orderRevision++;h.unit.path=[h.c.worldToCell(h.unit.x,h.unit.z)];h.unit.pathIndex=0;
  h.unit.moveGoalCell=h.unit.path[0];h.unit.moveGoalPoint={version:1,generation:h.unit.generation,
    revision:h.unit.orderRevision,cell:h.unit.moveGoalCell,x:h.unit.x,z:h.unit.z};
  // Already admitted ingress used this tick's budget; a zero arrival still runs.
  const execution=crowd.crowdSteeringRecord(h.unit).execution;
  const spent=execution.spent;h.c.units=[h.unit];
  h.c.run();assert.equal(h.unit.pathIndex,1);
  assert.equal(crowd.crowdSteeringRecord(h.unit).execution.spent,spent);
  assert.equal(crowd.crowdSteeringRecord(h.unit).lease,lease);
  assert.equal(crowd.crowdSteeringRecord(h.unit).lastGrantTick,grant);
});

test('a fresh original claimant cancels service and controller projection cannot skip arrival or a parked dependency',()=>{
  const h=issue();h.c.tickNumber++;
  const lower=actor(0,h.peer.x+.49,h.peer.z+.05);h.units.push(lower);
  const c=h.c.crowdEntitlementContext(h.peer);
  assert.ok(c.claims(h.peer,h.r.to).includes(lower),'the original lower-ID far-goal claim is re-evaluated');
  assert.equal(crowd.crowdMovingEntitlement.take(h.peer,c,crowd.crowdExecutionState(h.peer,h.c.tickNumber).work),null);
  const fresh=host();fresh.peer.x=.5;fresh.peer.z=-2.5;
  assert.equal(fresh.c.crowdPromiseControllerAllowed(fresh.peer,[],{}),false,'projected zero arrival retains waypoint consumption');
  fresh.peer.z=-3.2;
  const parked=actor(7,.5,-2.75);parked.path=[];parked.pathIndex=0;parked.moveGoalCell=-1;
  assert.equal(fresh.c.crowdPromiseControllerAllowed(fresh.peer,[parked],{}),false,'new parked dependency retains ordinary controller creation/wait');
});

test('nonordinary writes keep their caller travel policy while each short write protects capsules',()=>{
  const h=issue(),combat=actor(8,2.5,2.5);combat.attackTargetId=999;combat.path=[];h.units.push(combat);
  assert.ok(h.c.admitCrowdLandWrite(combat,{x:2.5,z:2.58}));combat.z=2.58;
  assert.ok(h.c.admitCrowdLandWrite(combat,{x:2.5,z:2.66}),'a distant promise does not cap separate existing combat/interaction writes together');
  assert.ok(crowd.crowdSteeringRecord(combat).execution.spent>h.c.crowdNextBudget(combat));
  assert.equal(h.c.admitCrowdLandWrite(combat,{x:2.5,z:3}),false,'long unqueried travel fails closed during a protected tick');
});
