import assert from 'node:assert/strict';
import test from 'node:test';
import {selectCrowdStep,ordinaryCrowdBodyRadius,canTraverseCrowdBodySegment,CROWD_PROPOSAL_LIMIT} from '../src/unit-crowd-steering.mjs';
const actor=(extra)=>({id:75,generation:17,orderRevision:3,kind:'infantry',hp:100,
  x:-2.72,z:1.0001,path:[1,2],pathIndex:0,moveGoalCell:2,...extra});
function displacedRoute({opposing=false,parked=false,missing=false,rawBehind=false,mixed=false,reverse=false,team=1,axisAhead=false,onAxis=false,terminal=false,missingAxis=false}={}){
 const u=actor(terminal?{path:[1],pathIndex:0}:{}),peer=actor({id:74,x:-2.13,z:.9,target:{x:onAxis||missingAxis?-14.5:14.5,z:-3.5},
  ...(parked?{holdingPosition:true,path:[],pathIndex:0}:{})});
 const peers=[peer];if(mixed)peers.push(actor({id:73,x:-3.2,z:1.25,target:{x:12.5,z:-3.5}}));
 u.team=team;for(const body of peers)body.team=team;
 const before=structuredClone([u,...peers]),target={x:-.999,z:.999},raw={x:rawBehind?-4:-.5,z:axisAhead?1.5:.5};
 const select=tick=>selectCrowdStep({unit:u,target,progressTarget:raw,travelDirection:missingAxis?null:onAxis?{x:1,z:0}:{x:0,z:1},tick,
  stepDistance:2.6/30,neighbors:reverse?peers.toReversed():peers,cellCenter:{x:-2.5,z:1.5},canTraverse:()=>true,
  targetOf:body=>ordinaryCrowdBodyRadius(body)?body.target:null,
  directionOf:body=>missing?null:opposing||body.id===73?{x:-1,z:0}:{x:-.5-body.x,z:.5-body.z}});
 const first=select(0),move=select(40);assert.deepEqual([u,...peers],before);
 if(!move.waitingForCrowd){const to={x:u.x+move.x*move.stepDistance,z:u.z+move.z*move.stepDistance};
  assert.ok(canTraverseCrowdBodySegment(u,to,.22,peers));assert.ok(move.crowdControl.proposals<=CROWD_PROPOSAL_LIMIT);}
 return {first,move};
}
for(const team of [0,1])test(`seat${team}: a displaced route keeps admitted waypoint progress beside a peer advancing the same way`,()=>{
 // Ordinary dynamic-wall traffic can leave an actor beside its accepted route.
 // Its route-axis and a peer's distant final goal then look opposed, although
 // both current waypoints lead east and the selected eastward sweep is clear.
 const {move}=displacedRoute({team});assert.ok(!move.waitingForCrowd&&!move.yieldingForCrowd&&move.x>.9);
});
for(const [label,options]of [['opposing current direction',{opposing:true}],
 ['unknown current direction',{missing:true}],['step away from the fixed waypoint',{rawBehind:true}],
 ['waypoint ahead along the accepted axis',{axisAhead:true}],
 ['ordinary on-axis advance',{onAxis:true}],['terminal waypoint',{terminal:true}],
 ['unknown accepted route axis',{missingAxis:true}]])
 test(`${label} retains original crowd arbitration`,()=>{
  const {move}=displacedRoute(options);assert.ok(move.waitingForCrowd||move.yieldingForCrowd);
 });
test('parked bodies keep the production target contract and never acquire a parallel-route exemption',()=>{
 const {first:{crowdControl:a,noProgressTicks:b,...first},move:{crowdControl:c,noProgressTicks:d,...move}}=displacedRoute({parked:true});
 assert.deepEqual(move,first);
});
for(const reverse of [false,true])test(`a genuinely opposing claimant retains priority beside a parallel peer, reverse=${reverse}`,()=>{
 const {move}=displacedRoute({mixed:true,reverse});assert.ok(move.waitingForCrowd||move.yieldingForCrowd);
});
