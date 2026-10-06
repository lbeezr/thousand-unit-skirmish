import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { MovingEntitlementModel, entitlementBudget, movementStart, finalizedProgress } from './crowd-entitlement-model.mjs';
import { canTraverseCrowdBodySegment } from '../src/unit-crowd-steering.mjs';
import { canTraverseStaticBodySegment, canTraverseUnitStep, LAND_CLEARANCE_PROFILE, pointSegmentDistanceSquared } from '../src/unit-movement.mjs';

const actor = (id,x,z,index=0) => ({id,x,z,generation:17,orderRevision:1,kind:'infantry',hp:100,
  path:[7,8,9,10],pathIndex:index,moveGoalCell:10,attackTargetId:-1,attackBuildingTargetId:-1});
const p = u => ({x:u.x,z:u.z});
const move = (u,to,c) => { c.consumeBudget(u,Math.hypot(to.x-u.x,to.z-u.z));return Object.assign(u,to); };
function scene(count=1) {
  const model=new MovingEntitlementModel(),peer=actor(1,.51,.18,1),units=[peer,actor(2,0,-.6)];
  if(count===2) units.push(actor(3,-.55,-.5));
  const goals=new Map([[7,{x:.5,z:.5}],[8,{x:-.5,z:.5}],[9,{x:-1.5,z:.5}],[10,{x:-2.5,z:.5}]]),spent=new WeakMap();
  const c={tick:0,nav:0,epoch:1,neighbors:units,overflow:false,pointOf:u=>goals.get(u.path[u.pathIndex]),
    nextBudgetOf:()=>2.6/30,remainingBudgetOf:u=>c.nextBudgetOf(u)-(spent.get(u)?.tick===c.tick?spent.get(u).distance:0),
    consumeBudget:(u,length)=>{assert.ok(length<=c.remainingBudgetOf(u)+1e-9,'host write stays within current fixed-tick budget');
      spent.set(u,{tick:c.tick,distance:(spent.get(u)?.tick===c.tick?spent.get(u).distance:0)+length});},
    maneuver:()=>false,claims:u=>u===peer?[]:[peer],
    admit:(u,from,to)=>canTraverseStaticBodySegment(from,to,LAND_CLEARANCE_PROFILE.radiusByKind[u.kind],8,8,()=>true)
      && canTraverseCrowdBodySegment(from,to,LAND_CLEARANCE_PROFILE.radiusByKind[u.kind],units.filter(o=>o!==u))};
  const request=u=>model.request(u,peer,{x:u.x+.04,z:u.z+.05},{x:0,z:1},c,entitlementBudget());
  const publish=(tick=c.tick+1)=>{c.tick=tick;const start=movementStart(peer,c),budget=entitlementBudget();
    const to={x:peer.x-.06,z:peer.z+.02};assert.ok(model.admit(peer,peer,to,c,budget));move(peer,to,c);
    return model.publish(peer,{x:peer.x-.06,z:peer.z+.02},finalizedProgress(peer,start,c),c,budget);};
  const ingress=u=>{const budget=entitlementBudget(),to=model.prepareIngress(u,peer,c,budget);assert.ok(to);
    const start=movementStart(u,c);assert.ok(model.admit(u,u,to,c,budget));move(u,to,c);
    assert.ok(model.finishIngress(u,finalizedProgress(u,start,c),c));};
  return {model,peer,units,c,request,publish,ingress};
}

test('one ingress consumes one named peer quantum; real progress clocks, routes and queues stay separate',()=>{
  const s=scene(),u=s.units[1];u.queuedWaypoints=[{destination:11}];
  Object.assign(s.model.state(u),{lastProgressTick:-36,bestDistance:.54});
  assert.ok(s.request(u));const offer=s.publish();assert.equal(offer.winner,u);s.ingress(u);
  assert.equal(s.model.prepareIngress(u,s.peer,s.c,entitlementBudget()),null,'same offer cannot grant a second step');
  assert.equal(s.model.state(u).lastGrantTick,1);assert.equal(s.model.state(u).lastProgressTick,-36);
  assert.equal(s.model.state(u).bestDistance,.54);assert.deepEqual(u.queuedWaypoints,[{destination:11}]);
  assert.equal(s.request(u),false,'lane entry restores queue-following priority');
  s.c.tick=2;const to=s.model.take(s.peer,s.c,entitlementBudget());assert.deepEqual(to,offer.to);
  const start=movementStart(s.peer,s.c);move(s.peer,to,s.c);assert.ok(s.model.finish(s.peer,finalizedProgress(s.peer,start,s.c),s.c));
  assert.equal(s.model.obligation(u,s.c),null);assert.equal(s.model.take(s.peer,s.c,entitlementBudget()),null);
});

test('obligation survives recipient route/index/command/profile changes until service, cancellation or expiry',()=>{
  const s=scene(),u=s.units[1];s.request(u);s.publish();s.ingress(u);
  u.path=[...u.path];u.pathIndex=1;u.orderRevision++;u.holdingPosition=true;s.model.resetRouting(u);
  assert.ok(s.model.obligation(u,s.c),'profile-independent birth binding preserves safety');
  s.c.tick=2;assert.ok(s.model.take(s.peer,s.c,entitlementBudget()),'changed recipient route does not erase acknowledgement');
  assert.equal(s.model.finish(s.peer,null,s.c),false,'failed execution is not progress');
  assert.equal(s.model.obligation(u,s.c),null);
});

test('a short crossing can have clear endpoints/current-body clearance but violate the reserved capsule',()=>{
  const s=scene();s.request(s.units[1]);const r=s.publish();s.ingress(s.units[1]);
  const u=actor(4,r.to.x-.439,r.to.z-.04),to={x:u.x,z:u.z+.08};s.units.push(u);
  for(const v of [u,to]) assert.ok(Math.sqrt(pointSegmentDistanceSquared(v,r.from,r.to))>.44);
  assert.ok(s.c.admit(u,u,to),'actual peer body is clear');
  assert.equal(s.model.admit(u,u,to,s.c,entitlementBudget()),false);
});

test('publication and consumption respect an actor serving both roles in a reservation chain',()=>{
  const s=scene(),u=s.units[1],raw={x:.5,z:.5};s.c.pointOf=()=>raw;
  s.request(u);s.publish();s.ingress(u);
  // Give the recipient another requester and a later ordinary progress receipt.
  // Controlled physical admission isolates the reservation oracle in this chain test.
  const follower=actor(3,-.55,-.9);s.units.push(follower);s.c.admit=()=>true;
  s.c.claims=a=>a===follower?[u]:[];s.c.nextBudgetOf=()=>.5; // Controlled oracle with enough current budget for both probes.
  s.c.tick=1;assert.ok(s.model.request(follower,u,{x:-.50,z:-.85},{x:0,z:1},s.c,entitlementBudget()));
  s.c.tick=2;
  const start=movementStart(u,s.c);move(u,{x:.12,z:-.38},s.c);
  const to={x:.29,z:-.20},budget=entitlementBudget();
  s.c.neighbors=[u,follower]; // The captured obligation also guards outside the current query.
  assert.ok(Math.hypot(to.x-u.x,to.z-u.z)<=.25);
  assert.ok(Math.hypot(raw.x-to.x,raw.z-to.z)<Math.hypot(raw.x-u.x,raw.z-u.z));
  assert.equal(s.model.publish(u,to,finalizedProgress(u,start,s.c),s.c,budget),null);
  assert.ok(budget.reservationVisits>0,'publication reached and failed the inherited capsule guard');
  // An already published second promise must also pass inherited obligation at take.
  const next={owner:u,from:p(u),to,radius:.22,stamp:movementStart(u,s.c).stamp,tick:1,
    winner:follower,request:null,attempted:false};
  s.model.state(u).offer.reservation=next;
  s.model.state(follower).lease={generation:follower.generation,reservation:next,pending:false};
  const takeBudget=entitlementBudget();assert.equal(s.model.take(u,s.c,takeBudget),null);
  assert.ok(takeBudget.reservationVisits>0,'consumption reached and failed the inherited capsule guard');
  assert.ok(s.model.obligation(u,s.c));
});

test('a legal three-actor chain services both named steps without a circular wait',()=>{
  const s=scene(),u=s.units[1],follower=actor(3,-.55,-.9);s.units.push(follower);
  s.c.claims=(a,to)=>a===follower?[u]:a===u&&Math.abs(to.x-.04)<1e-9&&Math.abs(to.z+.55)<1e-9?[s.peer]:[];
  assert.ok(s.request(u));
  assert.ok(s.model.request(follower,u,{x:-.50,z:-.85},{x:0,z:1},s.c,entitlementBudget()));
  const first=s.publish();s.ingress(u);
  const start=movementStart(u,s.c);move(u,{x:.05,z:-.54},s.c);
  const second=s.model.publish(u,{x:.10,z:-.48},finalizedProgress(u,start,s.c),s.c,entitlementBudget());
  assert.equal(second.winner,follower);
  const to=s.model.prepareIngress(follower,u,s.c,entitlementBudget());assert.ok(to);
  const followerStart=movementStart(follower,s.c);move(follower,to,s.c);
  assert.ok(s.model.finishIngress(follower,finalizedProgress(follower,followerStart,s.c),s.c));
  s.c.tick=2;
  const budget=entitlementBudget(),middleTo=s.model.take(u,s.c,budget);assert.deepEqual(middleTo,second.to);
  assert.ok(budget.reservationVisits>0,'middle actor preserves its older obligation while serving its follower');
  const middleStart=movementStart(u,s.c);move(u,middleTo,s.c);
  assert.ok(s.model.finish(u,finalizedProgress(u,middleStart,s.c),s.c));
  const aheadTo=s.model.take(s.peer,s.c,entitlementBudget());assert.deepEqual(aheadTo,first.to);
  const aheadStart=movementStart(s.peer,s.c);move(s.peer,aheadTo,s.c);
  assert.ok(s.model.finish(s.peer,finalizedProgress(s.peer,aheadStart,s.c),s.c));
});

test('publication needs unchanged pre/post waypoint identity and no current peer priority veto',()=>{
  for(const change of ['route','index','priority','maneuver']) {
    const s=scene();s.request(s.units[1]);s.c.tick=1;
    const start=movementStart(s.peer,s.c);move(s.peer,{x:.45,z:.2},s.c);
    if(change==='route')s.peer.path=[...s.peer.path];
    if(change==='index')s.peer.pathIndex=2;
    if(change==='priority')s.c.claims=a=>a===s.peer?[actor(0,2,2)]:[s.peer];
    if(change==='maneuver')s.c.maneuver=a=>a===s.peer;
    assert.equal(s.model.publish(s.peer,{x:.39,z:.22},finalizedProgress(s.peer,start,s.c),s.c,entitlementBudget()),null,change);
  }
});

test('failed recipient fallback keeps safety but earns no grant credit; birth/death retire its acknowledgement',()=>{
  for(const change of ['none','generation','dead']) {
    const s=scene(),u=s.units[1];s.request(u);s.publish();
    assert.ok(s.model.prepareIngress(u,s.peer,s.c,entitlementBudget()));
    const from=p(u),to={x:u.x+.01,z:u.z+.01};
    assert.ok(s.model.admit(u,from,to,s.c,entitlementBudget()));move(u,to,s.c);
    assert.equal(s.model.finishIngress(u,null,s.c),false);
    assert.equal(s.model.state(u).lastGrantTick,-Infinity);
    if(change==='generation')u.generation++;
    if(change==='dead')u.hp=0;
    s.c.tick=2;
    const service=s.model.take(s.peer,s.c,entitlementBudget());
    assert.equal(Boolean(service),change==='none',change);
  }
});

test('same-pose new promise cannot inherit the exact-object acknowledgement of an old promise',()=>{
  const s=scene(),u=s.units[1];s.request(u);const first=s.publish();s.ingress(u);
  // Isolate the identity rule with a different promise at the same owner pose.
  const next={...first,tick:2,to:{x:first.to.x-.01,z:first.to.z+.01}};
  s.model.state(s.peer).offer.reservation=next;s.c.tick=3;
  assert.equal(s.model.obligation(u,s.c),null);
  assert.equal(s.model.take(s.peer,s.c,entitlementBudget()),null);
});

test('finalized ingress and service receipts cannot delay permission across its fixed-tick boundary',()=>{
  const s=scene(),u=s.units[1];s.request(u);s.publish();
  const ingress=s.model.prepareIngress(u,s.peer,s.c,entitlementBudget());assert.ok(ingress);
  s.c.tick=2;const start=movementStart(u,s.c);move(u,ingress,s.c);
  assert.equal(s.model.finishIngress(u,finalizedProgress(u,start,s.c),s.c),false,
    'a later-tick actual write earns no same-tick ingress authority or credit');
  assert.equal(s.model.state(u).lastGrantTick,-Infinity);
  const a=scene();a.request(a.units[1]);const promised=a.publish();a.ingress(a.units[1]);
  a.c.tick=2;assert.deepEqual(a.model.take(a.peer,a.c,entitlementBudget()),promised.to);
  a.c.tick=3;const delayed=movementStart(a.peer,a.c);move(a.peer,promised.to,a.c);
  assert.equal(a.model.finish(a.peer,finalizedProgress(a.peer,delayed,a.c),a.c),false,
    'take admission cannot carry claimed service past expiry');
  assert.equal(a.model.state(a.peer).offer.reservation,null);
  assert.equal(a.model.obligation(a.units[1],a.c),null);
});

test('a missing service finalizer rejects duplicate selection but expires or invalidates without perpetual throws',()=>{
  for(const change of ['expiry','route','epoch']) {
    const s=scene();s.request(s.units[1]);s.publish();s.ingress(s.units[1]);s.c.tick=2;
    assert.ok(s.model.take(s.peer,s.c,entitlementBudget()));
    assert.throws(()=>s.model.take(s.peer,s.c,entitlementBudget()),/finish the reserved admission/);
    if(change==='expiry')s.c.tick=3;
    if(change==='route')s.peer.path=[...s.peer.path];
    if(change==='epoch')s.c.epoch++;
    assert.equal(s.model.take(s.peer,s.c,entitlementBudget()),null,change);
    assert.equal(s.model.state(s.peer).offer.reservation,null);
    assert.equal(s.model.take(s.peer,s.c,entitlementBudget()),null);
  }
});

test('bounded queries fail closed and all physical admissions share the remaining 128 proposals',()=>{
  const s=scene(),u=s.units[1];s.request(u);s.c.tick=1;
  const start=movementStart(s.peer,s.c);move(s.peer,{x:.45,z:.2},s.c);
  const budget=entitlementBudget(127);
  assert.equal(s.model.publish(s.peer,{x:.39,z:.22},finalizedProgress(s.peer,start,s.c),s.c,budget),null);
  assert.equal(budget.proposals,128,'no requester gets a fresh budget after the peer proposal');
  const a=scene();a.c.neighbors=Array.from({length:65},(_,id)=>actor(id+10,3,3));
  assert.equal(a.request(a.units[1]),false);
  const b=scene(),actors=structuredClone(b.units);b.request(b.units[1]);const r=b.publish();b.ingress(b.units[1]);
  b.c.tick=2;b.c.maneuver=v=>v===b.peer;
  assert.equal(b.model.take(b.peer,b.c,entitlementBudget()),null);
  assert.equal(b.model.obligation(b.units[1],b.c),null);
  for(let i=0;i<actors.length;i++)assert.deepEqual(b.units[i].path,actors[i].path);
  assert.ok(r);
});

test('malformed authoritative movement and shared work budgets fail closed before physical admission',()=>{
  for(const movement of [NaN,Infinity,-.1,0]) {
    const s=scene();s.c.nextBudgetOf=()=>movement;
    s.c.admit=()=>assert.fail('invalid movement budget reached physical admission');
    assert.equal(s.request(s.units[1]),false);
  }
  for(const counter of [NaN,Infinity,-1,.5,129]) {
    const s=scene();s.c.admit=()=>assert.fail('invalid work counter reached physical admission');
    assert.equal(s.model.admit(s.peer,s.peer,{x:.45,z:.2},s.c,entitlementBudget(counter)),false);
  }
  const s=scene(2);s.request(s.units[1]);s.request(s.units[2]);
  s.c.tick=1;const start=movementStart(s.peer,s.c);move(s.peer,{x:.45,z:.2},s.c);
  const b=entitlementBudget();assert.ok(s.model.publish(s.peer,{x:.39,z:.22},finalizedProgress(s.peer,start,s.c),s.c,b));
  assert.equal(b.pairingVisits,1,'new-capsule pairing has its own explicit work receipt');
  assert.ok(b.reservationVisits<=b.proposals*65);assert.ok(b.pairingVisits<=64);
});

test('finalized publication previews the next tick while every current write checks actual remaining travel',()=>{
  const s=scene(),u=s.units[1];s.request(u);s.c.tick=1;
  const delta={x:-.06,z:.02};
  const start=movementStart(s.peer,s.c),to={x:s.peer.x+delta.x,z:s.peer.z+delta.z},budget=entitlementBudget();
  assert.ok(s.model.admit(s.peer,s.peer,to,s.c,budget));move(s.peer,to,s.c);
  const rest={x:s.peer.x,z:s.peer.z+s.c.remainingBudgetOf(s.peer)};
  assert.ok(s.model.admit(s.peer,s.peer,rest,s.c,budget));move(s.peer,rest,s.c);
  assert.ok(Math.abs(s.c.remainingBudgetOf(s.peer))<1e-9);
  const future={x:s.peer.x+delta.x,z:s.peer.z+delta.z};
  assert.equal(s.model.admit(s.peer,s.peer,future,s.c,budget),false,'full next allowance cannot pay a current write');
  const offer=s.model.publish(s.peer,future,finalizedProgress(s.peer,start,s.c),s.c,budget);assert.ok(offer);
  s.ingress(u);const remainder=s.c.remainingBudgetOf(u);assert.ok(remainder>0&&remainder<.023);
  assert.equal(s.model.admit(u,u,{x:u.x+.03,z:u.z},s.c,entitlementBudget()),false,'remaining current budget prevents a second overspend');
  s.c.tick=2;assert.deepEqual(s.model.take(s.peer,s.c,entitlementBudget()),offer.to);
  const nextStart=movementStart(s.peer,s.c);move(s.peer,offer.to,s.c);
  assert.ok(s.model.finish(s.peer,finalizedProgress(s.peer,nextStart,s.c),s.c));
});

for(const change of ['new-priority','route','generation','footprint','pose','navigation','epoch','stationary','overflow','budget'])
  test(`protected peer ${change} invalidates its promise without forcing movement`,()=>{
    const s=scene(),u=s.units[1];s.request(u);s.publish();s.ingress(u);s.c.tick=2;
    let budget=entitlementBudget();
    if(change==='new-priority')s.c.claims=a=>a===s.peer?[actor(0,2,2)]:[s.peer];
    if(change==='route')s.peer.path=[...s.peer.path];
    if(change==='generation')s.peer.generation++;
    if(change==='footprint')s.peer.kind='scout';
    if(change==='pose')s.peer.x+=.01;
    if(change==='navigation')s.c.nav++;
    if(change==='epoch')s.c.epoch++;
    if(change==='stationary')s.peer.holdingPosition=true;
    if(change==='overflow')s.c.overflow=true;
    if(change==='budget')budget=entitlementBudget(128);
    const before=p(s.peer);assert.equal(s.model.take(s.peer,s.c,budget),null);assert.deepEqual(p(s.peer),before);
    assert.equal(s.model.obligation(u,s.c),null);assert.equal(s.model.state(s.peer).offer.reservation,null);
  });

test('reciprocal requests cannot form a grant cycle; an unrelated claimant keeps its veto',()=>{
  const s=scene(),u=s.units[1];assert.ok(s.request(u));
  s.c.claims=()=>[u];assert.equal(s.model.request(s.peer,u,{x:.5,z:.2},{x:0,z:1},s.c,entitlementBudget()),false);
  s.c.claims=a=>a===s.peer?[]:[s.peer,actor(0,2,2)];assert.equal(s.publish(),null);
});

test('rotating probes skip failed admission and allocations without successful acknowledgements',()=>{
  const s=scene(2),a=s.units[1],b=s.units[2];s.request(a);s.request(b);const r=s.publish();assert.equal(r.winner,a);
  const to=s.model.prepareIngress(a,s.peer,s.c,entitlementBudget());assert.ok(to);
  assert.equal(s.model.finishIngress(a,null,s.c),false); // No write, no grant credit.
  assert.equal(s.model.state(a).lastGrantTick,-Infinity);s.request(a);s.request(b);
  s.c.tick=2;assert.equal(s.model.take(s.peer,s.c,entitlementBudget()),null);
  const next=s.publish(2);assert.equal(next.winner,b,'failed allocation cannot monopolize the next opportunity');
  const q=scene(2),x=q.units[1],y=q.units[2];q.request(x);q.request(y);
  const original=q.c.admit;q.c.admit=(unit,...args)=>unit!==x&&original(unit,...args);
  assert.equal(q.publish().winner,y,'failed candidate is skipped within the same bounded scan');
});

test('offers cannot renew at an unchanged pose or attach stale acknowledgements after restore',()=>{
  const s=scene(),u=s.units[1];s.request(u);const r=s.publish();s.ingress(u);
  assert.equal(s.model.publish(s.peer,r.to,finalizedProgress(s.peer,movementStart(s.peer,s.c),s.c),s.c,entitlementBudget()),null);
  s.c.tick=2;
  assert.equal(s.model.publish(s.peer,r.to,finalizedProgress(s.peer,movementStart(s.peer,s.c),s.c),s.c,entitlementBudget()),null,
    'a new tick alone is not a finalized progress receipt');
  s.model.restore();assert.equal(s.model.obligation(u,s.c),null);s.c.tick=2;
  assert.equal(s.model.take(s.peer,s.c,entitlementBudget()),null);
});

test('expired promises, partial receipts and exhausted shared planning budgets issue no authority',()=>{
  const s=scene(),u=s.units[1];s.request(u);const r=s.publish();s.ingress(u);s.c.tick=3;
  assert.equal(s.model.obligation(u,s.c),null);assert.equal(s.model.take(s.peer,s.c,entitlementBudget()),null);
  const a=scene();a.request(a.units[1]);a.c.tick=1;const start=movementStart(a.peer,a.c);move(a.peer,{x:.45,z:.2},a.c);
  const receipt=finalizedProgress(a.peer,start,a.c),budget=entitlementBudget(128);
  assert.equal(a.model.publish(a.peer,{x:.39,z:.22},receipt,a.c,budget),null);assert.equal(budget.proposals,128);
  const b=scene();b.request(b.units[1]);b.c.tick=1;const before=movementStart(b.peer,b.c);move(b.peer,{x:.45,z:.2},b.c);
  assert.equal(b.model.publish(b.peer,{x:.39,z:.22},{...finalizedProgress(b.peer,before,b.c),finalized:false},b.c,entitlementBudget()),null);
});

function receipt(file,hash) {
  const packed=readFileSync(new URL('../docs/qa-evidence/'+file,import.meta.url));
  assert.equal(createHash('sha256').update(packed).digest('hex'),hash);
  return JSON.parse(gunzipSync(packed));
}
function decode(value) {
  if(!value || typeof value!=='object')return value;
  if(value.$undefined)return undefined;
  if(value.$path!==undefined)return [...value.cells];
  if(Array.isArray(value))return value.map(decode);
  return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,decode(v)]));
}
for(const name of ['forest142','wall594']) test(`${name}: retained production inputs grant no invented peer step`,()=>{
  const forest=name==='forest142';
  const data=forest?receipt('crowd-first-decision-2026-10-06/first-decision.json.gz','74ede1895682f64b9f1d512f9fe9fb200e542c77ad1568165aaf8ea38e18b11a')
    :receipt('construction-temporal-2026-10-06/actor75-temporal.json.gz','0ac8d06e7d5c9ed95214c70c9c9cb8fdde2a9372bdb7b30d89ae752683f3f38d');
  const row=!forest&&data.history.find(r=>r.tick===594),f=forest?data.firstDivergence.baseline:row.frames[0];
  const units=f.bodies.map(b=>decode(b.actor)),u=units[0],peer=units.find(u=>u.id===(forest?24:73)),model=new MovingEntitlementModel();
  const blocked=new Set(row?.blockedCells??[]),width=data.map.width,height=data.map.height;
  if(!forest)for(const o of data.map.obstacles)for(let z=o.row;z<o.row+o.height;z++)for(let x=o.column;x<o.column+o.width;x++)blocked.add(z*width+x);
  const walkable=cell=>cell>=0&&cell<width*height&&(forest?data.navigationMask[cell]:!blocked.has(cell));
  const pointOf=a=>({x:a.path[a.pathIndex]%width-width/2+.5,z:Math.floor(a.path[a.pathIndex]/width)-height/2+.5});
  const cell=p=>Math.floor(p.z+height/2)*width+Math.floor(p.x+width/2),elevation=new Uint8Array(width*height);
  const c={tick:f.tick,nav:f.navigationRevision,epoch:f.epoch,neighbors:units,overflow:false,pointOf,remainingBudgetOf:()=>2.6/30,nextBudgetOf:()=>2.6/30,
    maneuver:()=>false,claims:a=>a===u?[peer]:[],admit:(a,from,to)=>canTraverseUnitStep(cell(from),cell(to),width,elevation,walkable)
      &&canTraverseStaticBodySegment(from,to,.22,width,height,walkable)
      &&canTraverseCrowdBodySegment(from,to,.22,units.filter(b=>b!==a))};
  const best=f.events.find(e=>e.type==='priority').best,to={x:u.x+best.x*best.stepDistance,z:u.z+best.z*best.stepDistance};
  const before=structuredClone(units);assert.equal(model.request(u,peer,to,{x:0,z:1},c,entitlementBudget()),!forest);
  assert.equal(model.prepareIngress(u,peer,c,entitlementBudget()),null,'a timestamp is not an offer');
  if(!forest){const goal=pointOf(peer),length=Math.hypot(goal.x-peer.x,goal.z-peer.z);
    const direct={x:peer.x+(goal.x-peer.x)/length*2.6/30,z:peer.z+(goal.z-peer.z)/length*2.6/30};
    assert.equal(c.admit(peer,peer,direct),false);
    assert.equal(canTraverseCrowdBodySegment(peer,direct,.22,[units.find(a=>a.id===110)]),false);
  }
  assert.deepEqual(units,before);assert.equal(f.result.waitingForCrowd,true);
});
