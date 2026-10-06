import assert from 'node:assert/strict';
import test from 'node:test';
import { isDeepStrictEqual } from 'node:util';
import { ordinaryCrowdBodyRadius, canTraverseCrowdBodySegment, CROWD_PROPOSAL_LIMIT } from '../src/unit-crowd-steering.mjs';
import { createTemporalObserver } from './construction-temporal-observer.mjs';
import { record, frameContext, capturedCrowdSource } from './construction-temporal-replay-input.mjs';

const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
const endpoint = (unit,result) => ({x:unit.x+result.x*result.stepDistance,z:unit.z+result.z*result.stepDistance});
const priority = frame => frame.events.find(e=>e.type==='priority');
let current, historical;
test.before(async()=>{
  current=await createTemporalObserver(null,{prepareOnly:true});
  historical=await createTemporalObserver(null,{prepareOnly:true,crowdSource:capturedCrowdSource});
});
test.after(async()=>{await current?.dispose();await historical?.dispose();});

test('an archived selector cannot replace production source in a fresh capture',async()=>{
  await assert.rejects(createTemporalObserver(null,{crowdSource:capturedCrowdSource}),/replay-only/);
});

// Controlled decision negatives retain the recorded tick594 poses and physical
// oracles. They alter one caller/route/controller input, not the captured run.
function decision(observer, change=()=>{}) {
  const row=record.history.find(r=>r.tick===594),frame=row.frames[0],observed=observer.observed;
  const {context,unit,decode}=frameContext(frame,row,observed),query=context.crowdNeighborsNear(unit);
  const states=new Map(frame.bodies.map(b=>[context.units[b.actor.id],decode(b.state)]));
  const directions=new Map(frame.bodies.map(b=>[b.actor.id,decode(b.direction)]));
  const goals=new Map(frame.bodies.map(b=>[b.actor.id,decode(b.target)]));
  const currentCell=context.worldToCell(unit.x,unit.z),width=record.map.width,height=record.map.height;
  const inBounds=to=>to.x>=-width/2+.5&&to.x<=width/2-.5&&to.z>=-height/2+.5&&to.z<=height/2-.5;
  const staticAllowed=to=>inBounds(to)&&context.canTraverseStaticBodySegment(unit,to,.22,width,height,
    context.isWalkable,{allowEscape:true});
  const args={...decode(frame.input),unit,neighbors:query.neighbors,
    canTraverse:to=>inBounds(to)&&context.canTraverseUnitStep(currentCell,context.worldToCell(to.x,to.z),
      width,context.elevationLevelByCell,context.isWalkable)&&staticAllowed(to),
    pointAllowed:to=>inBounds(to)&&context.canTraverseStaticBodySegment(to,to,.22,width,height,context.isWalkable),
    escapeAllowed:staticAllowed,detourAllowed:()=>true,
    targetOf:other=>ordinaryCrowdBodyRadius(other)?goals.get(other.id):null,
    directionOf:other=>ordinaryCrowdBodyRadius(other)?directions.get(other.id):null};
  const setup={unit,peer:context.units[73],args,states,directions,goals,context,observed};
  change(setup);observed.seedReplayStates(states);
  const before=structuredClone([unit,...args.neighbors]);
  observed.replayHostStart(unit,args.tick,args.navigationRevision,args.epoch);
  let result;
  try { result=observed.selectCrowdStep(args); }
  finally { observed.replayHostEnd(unit,result); }
  const [receipt]=observed.drainReplayFrames();
  assert.deepEqual([unit,...args.neighbors],before,'selection preserves poses, routes, goals, queues and orders');
  assert.ok(!result||result.crowdControl.proposals<=CROWD_PROPOSAL_LIMIT);
  return {...setup,result,receipt};
}

test('all185 captured inputs retain exact queries/controllers and only nine admitted directed-join decisions change',()=>{
  let calls=0;const changed=[];
  for(const row of record.history)for(const frame of row.frames) {
    const {context,unit,decode}=frameContext(frame,row,current.observed);
    if(frame.query) {
      const q=context.crowdNeighborsNear(unit);
      assert.equal(q.visits,frame.query.visits);assert.equal(q.overflow,frame.query.overflow);
      assert.deepEqual(Array.from(q.neighbors,b=>b.id),frame.query.ids);
    }
    current.observed.replayHostStart(unit,frame.tick,frame.navigationRevision,frame.epoch);
    const result=context.getMoveVector(unit,frame.input?.stepDistance);
    current.observed.replayHostEnd(unit,result);
    const [receipt]=current.observed.drainReplayFrames();calls++;
    if(frame.selection)assert.deepEqual(receipt.afterState,frame.afterState,'no controller mutation or artificial credit');
    const events=frame.events.filter(e=>e.type!=='host-oracle');
    if(isDeepStrictEqual(structuredClone(result),decode(frame.result))) {
      if(frame.selection)assert.deepEqual(receipt.events,events);
      continue;
    }
    changed.push(row.tick);
    const before=priority(frame),after=priority(receipt);
    assert.equal(before.yieldingToPeer,true);assert.equal(after.yieldingToPeer,false);
    assert.deepEqual({...after,yieldingToPeer:true},before,'only claimant veto changes at arbitration');
    const boundary=events.findIndex(e=>e.type==='priority');
    assert.deepEqual(receipt.events.slice(0,boundary),events.slice(0,boundary),'all physical proposals/scores before priority are identical');
    assert.equal(receipt.events.length,boundary+1,'no recovery proposal or new manoeuvre is introduced');
    const {x,z,stepDistance,target}=before.best;
    assert.deepEqual([result.x,result.z,result.stepDistance,result.target],[x,z,stepDistance,decode(target)]);
    assert.ok(!result.waitingForCrowd&&!result.yieldingForCrowd);
    assert.equal(result.noProgressTicks,frame.result.noProgressTicks);
    assert.ok(x*before.routeX+z*before.routeZ>0);
    const to=endpoint(unit,result),query=context.crowdNeighborsNear(unit),raw=decode(frame.input.progressTarget);
    assert.ok(distance(to,raw)<distance(unit,raw));
    assert.ok(canTraverseCrowdBodySegment(unit,to,.22,query.neighbors,{allowEscape:true}));
    assert.ok(context.canTraverseStaticBodySegment(unit,to,.22,record.map.width,record.map.height,
      context.isWalkable,{allowEscape:true}));
    assert.equal(result.crowdControl.proposals,frame.result.crowdControl.proposals-10);
    assert.ok(result.crowdControl.proposals<=CROWD_PROPOSAL_LIMIT);
  }
  assert.equal(calls,185);
  assert.deepEqual(changed,[594,595,596,597,598,667,692,693,695]);
});

for(const sameWaypoint of [false,true])for(const reverse of [false,true])
  test(`a live directed join preserves the admitted forward step, sameWaypoint=${sameWaypoint}, reverse=${reverse}`,()=>{
    const cfg=decision(current,({unit,peer,args,states})=>{
      if(sameWaypoint){peer.pathIndex--;states.get(peer).pathIndex--;}
      if(reverse)args.neighbors=args.neighbors.toReversed();
      assert.deepEqual(unit.path.slice(0,3),peer.path.slice(sameWaypoint?peer.pathIndex:peer.pathIndex-1,
        (sameWaypoint?peer.pathIndex:peer.pathIndex-1)+3));
    });
    assert.equal(priority(cfg.receipt).yieldingToPeer,false);
    assert.ok(!cfg.result.waitingForCrowd&&!cfg.result.yieldingForCrowd);
    assert.deepEqual([cfg.result.x,cfg.result.z,cfg.result.stepDistance],
      [.9659258262890683,.2588190451025204,.043333333333333314]);
    const gain=distance(cfg.unit,cfg.args.progressTarget)-distance(endpoint(cfg.unit,cfg.result),cfg.args.progressTarget);
    assert.ok(Math.abs(gain-.023663475770982045)<1e-12);
    const state=cfg.receipt.afterState;
    assert.equal(state.lastProgressTick,558);assert.equal(state.bestDistance,.5404107272139641);
    assert.ok(distance(endpoint(cfg.unit,cfg.result),cfg.args.progressTarget)>state.bestDistance-.02,
      'this admitted improvement alone does not earn progress credit');
  });

const controls=[
  ['unknown current direction',c=>c.directions.set(73,null)],
  ['opposing current direction',c=>c.directions.set(73,{x:0,z:-1})],
  ['perpendicular current direction',c=>c.directions.set(73,{x:-1,z:0})],
  ['unknown accepted direction',c=>{c.args.travelDirection=null;}],
  ['missing lane context',c=>{c.args.cellCenter=null;}],
  ['unrelated previous join',c=>{c.peer.path[c.peer.pathIndex-1]=999;}],
  ['unrelated next edge',c=>{c.peer.path[c.peer.pathIndex+1]=999;}],
  ['reversed directed join',c=>{
    c.peer.path.splice(c.peer.pathIndex-1,3,...c.unit.path.slice(0,3).toReversed());
  }],
  ['a claimant two waypoints ahead',c=>{c.peer.pathIndex++;c.states.get(c.peer).pathIndex++;}],
  ['unknown route cell',c=>{c.unit.path[2]=NaN;}],
  ['repeated route cell',c=>{c.unit.path[2]=c.unit.path[0];}],
  ['terminal actor route',c=>{c.unit.path.length=1;}],
  ['actor with only one remaining edge',c=>{c.unit.path.length=2;}],
  ['no admitted proposal',c=>{c.args.canTraverse=()=>false;}],
  ['no fixed-waypoint improvement',c=>{c.args.progressTarget={x:-3,z:-3};}],
  ['unknown peer controller',c=>c.states.set(c.peer,null)],
  ['stale peer controller',c=>{c.states.get(c.peer).lastTick-=2;}],
  ['wrong peer generation',c=>{c.states.get(c.peer).generation++;}],
  ['wrong peer order revision',c=>{c.states.get(c.peer).revision++;}],
  ['wrong peer navigation revision',c=>{c.states.get(c.peer).navigationRevision++;}],
  ['wrong peer epoch',c=>{c.states.get(c.peer).epoch++;}],
  ['wrong peer path identity',c=>{c.states.get(c.peer).path=[...c.peer.path];}],
  ['wrong peer path index',c=>{c.states.get(c.peer).pathIndex--;}],
  ['peer detour',c=>{c.states.get(c.peer).detour={x:3,z:3};}],
  ['peer lease',c=>{c.states.get(c.peer).lease={};}],
  ['peer contour',c=>{c.states.get(c.peer).contour={};}],
  ['actor detour',c=>{c.states.get(c.unit).detour={x:3,z:3,alternatives:[],distance:0,
    bestDistance:Infinity,lastProgressTick:c.args.tick};}],
  ['actor lease handoff',c=>{c.states.get(c.unit).lease={};}],
  ['actor expired contour handoff',c=>{c.states.get(c.unit).contour={until:c.args.tick-1,bodies:[]};}],
  ['actor live contour',c=>{c.states.get(c.unit).contour={point:{x:2,z:2},bodies:[],
    since:c.args.tick-1,until:c.args.tick+30,turns:0,corner:0,increment:1,corners:[{x:3,z:2}]};}],
  ['query overflow',c=>{c.args.overflow=true;}],
  ['exhausted shared proposal cap',c=>{c.args.diagnostics.proposals=CROWD_PROPOSAL_LIMIT;}],
  ['one remaining shared proposal',c=>{c.args.diagnostics.proposals=CROWD_PROPOSAL_LIMIT-1;}],
  ['earlier progress age',c=>{c.states.get(c.unit).lastProgressTick=c.args.tick-29;}],
  ['explicit different radius',c=>{c.args.radius=.21;}],
];
for(const [name,change]of controls)test(`${name} retains the complete historical decision and controller result`,()=>{
  const a=decision(historical,change),b=decision(current,change);
  assert.deepEqual(b.result,a.result);assert.deepEqual(b.receipt.afterState,a.receipt.afterState);
  assert.deepEqual(b.receipt.events,a.receipt.events);
});

for(const [name,fields]of [
  ['Worker',{kind:'worker'}],['water',{movementDomain:'water'}],['Hold',{holdingPosition:true}],
  ['pending',{movePlanningPending:true}],['dead',{hp:0}],['AttackMove',{attackMove:true}],
  ['unit pursuit',{attackTargetId:10}],['building pursuit',{attackBuildingTargetId:10}],
  ['automatic pursuit',{stanceCombat:true}],['automatic return',{stanceReturning:true}],
  ['Patrol/Follow',{persistentOrder:{type:'patrol'}}],['gather',{gatherPhase:'gathering'}],
  ['construction',{buildingTargetId:10}],
])test(`${name} explicit-radius caller cannot acquire the new exemption`,()=>{
  const change=c=>Object.assign(c.unit,fields);
  const a=decision(historical,change),b=decision(current,change);
  assert.equal(ordinaryCrowdBodyRadius(b.unit),0);
  assert.deepEqual(b.result,a.result);assert.deepEqual(b.receipt.afterState,a.receipt.afterState);
  assert.deepEqual(b.receipt.events,a.receipt.events);
});

for(const reverse of [false,true])test(`another genuinely opposing claimant retains its veto, reverse=${reverse}`,()=>{
  const change=({peer,goals,directions,args,context})=>{
    const opponent=context.units[95];opponent.id=72;
    goals.set(72,{x:opponent.x,z:opponent.z-10});directions.set(72,{x:0,z:-1});
    assert.ok(peer.id<75&&opponent.id<75);
    if(reverse)args.neighbors=args.neighbors.toReversed();
  };
  const a=decision(historical,change),b=decision(current,change);
  assert.equal(priority(a.receipt).yieldingToPeer,true);assert.equal(priority(b.receipt).yieldingToPeer,true);
  assert.deepEqual(b.result,a.result);assert.deepEqual(b.receipt.events,a.receipt.events);
});
