import assert from 'node:assert/strict';
import test from 'node:test';
import {selectCrowdStep, canTraverseCrowdBodySegment, CROWD_PROPOSAL_LIMIT} from '../src/unit-crowd-steering.mjs';

const actor = extra => ({id:1, generation:1, orderRevision:1, kind:'infantry', hp:100,
  x:0, z:0, path:[1,2], pathIndex:0, moveGoalCell:2, queuedWaypoints:[], ...extra});
const setup = () => ({unit:actor(), target:{x:1,z:0}, progressTarget:{x:0,z:3},
  travelDirection:{x:0,z:1}, stepDistance:.08, cellCenter:{x:0,z:0},
  neighbors:[actor({id:2,x:1,z:1,target:{x:1,z:-3}})], canTraverse:()=>true});
const endpoint = (u,r) => ({x:u.x+r.x*r.stepDistance,z:u.z+r.z*r.stepDistance});

for (let quarter=0; quarter<4; quarter++) test(`perpendicular intermediate projection credits fixed-route progress, rotation ${quarter}`, () => {
  const turn = p => {let {x,z}=p; for(let n=0;n<quarter;n++) [x,z]=[-z,x]; return {x,z};};
  const cfg=setup();
  for(const key of ['target','progressTarget','travelDirection','cellCenter']) cfg[key]=turn(cfg[key]);
  Object.assign(cfg.unit,turn(cfg.unit));
  cfg.neighbors=cfg.neighbors.map(n=>({...n,...turn(n),target:turn(n.target)}));
  const before=structuredClone([cfg.unit,...cfg.neighbors]);
  const result=selectCrowdStep(cfg), to=endpoint(cfg.unit,result), raw=cfg.progressTarget;
  assert.ok(!result.waitingForCrowd && !result.yieldingForCrowd);
  assert.ok(Math.hypot(raw.x-to.x,raw.z-to.z)<Math.hypot(raw.x-cfg.unit.x,raw.z-cfg.unit.z)-.04);
  const laneAxis=Math.abs(cfg.travelDirection.x)>=Math.abs(cfg.travelDirection.z)?'z':'x';
  const laneSign=laneAxis==='z'?Math.sign(cfg.travelDirection.x):-Math.sign(cfg.travelDirection.z);
  assert.ok(to[laneAxis]*laneSign>0, 'route progress retains the opposing lane preference');
  assert.ok(canTraverseCrowdBodySegment(cfg.unit,to,.22,cfg.neighbors));
  assert.ok(result.crowdControl.proposals<=CROWD_PROPOSAL_LIMIT);
  assert.deepEqual(result.target,cfg.target, 'ranking does not replace the executor waypoint');
  assert.deepEqual([cfg.unit,...cfg.neighbors],before, 'selection never writes orders or poses');
});

for (const [name,change] of [
  ['terminal waypoint',c=>{c.unit.path=[1];}],
  ['raw route behind',c=>{c.progressTarget={x:0,z:-3};}],
  ['missing route direction',c=>{c.travelDirection=null;}],
  ['missing lane',c=>{c.cellCenter=null;}],
  ['no opposing body',c=>{c.neighbors=[];}],
]) test(`${name} retains projected-target progress`,()=>{
  const cfg=setup(); change(cfg); const r=selectCrowdStep(cfg);
  assert.equal(r.x,1); assert.equal(r.z,0); assert.ok(r.stepDistance>0);
});

test('necessary admitted retreat remains selectable and recovery remains available',()=>{
  for(const recovery of [false,true]){
    const cfg=setup(); cfg.canTraverse=p=>p.z<-.001 && (!recovery||p.x<-.001);
    const r=selectCrowdStep(cfg), to=endpoint(cfg.unit,r);
    assert.ok(!r.waitingForCrowd && to.z<0, 'raw-route ranking never vetoes an admitted retreat');
    assert.ok(cfg.canTraverse(to)); assert.ok(canTraverseCrowdBodySegment(cfg.unit,to,.22,cfg.neighbors));
    if(recovery) assert.equal(r.yieldingForCrowd,true);
    assert.ok(r.crowdControl.proposals<=CROWD_PROPOSAL_LIMIT);
  }
});

test('nonperpendicular projection retains its target score and a close endpoint remains exact',()=>{
  const a=setup(),b=setup();
  a.target=b.target={x:1,z:.2}; b.progressTarget={x:0,z:30};
  assert.deepEqual(selectCrowdStep(a),selectCrowdStep(b), 'raw distance cannot change scoring outside the projection gate');
  const cfg=setup(); cfg.target={x:.01,z:0};
  const r=selectCrowdStep(cfg);
  assert.equal(r.reachedWaypoint,true); assert.deepEqual(r.target,cfg.target); assert.equal(r.stepDistance,.01);
});

test('blocked admission waits and Hold/planning ownership remain intact',()=>{
  const blocked=setup(); blocked.canTraverse=()=>false;
  const before=structuredClone(blocked.unit), r=selectCrowdStep(blocked);
  assert.equal(r.waitingForCrowd,true); assert.equal(r.stepDistance,0);
  assert.deepEqual(blocked.unit,before);
  for(const flag of ['holdingPosition','movePlanningPending']) {
    const cfg=setup(); cfg.unit[flag]=true;
    assert.equal(selectCrowdStep(cfg),null);
  }
});
