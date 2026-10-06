import assert from 'node:assert/strict';
import test from 'node:test';
import {selectCrowdStep, crowdPassagePoint, canTraverseCrowdBodySegment, CROWD_PROPOSAL_LIMIT} from '../src/unit-crowd-steering.mjs';
import {canTraverseStaticBodySegment, canTraverseUnitStep} from '../src/unit-movement.mjs';

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

// Public synthetic geometry: both circles fit a cardinal corridor while the
// accepted raw waypoint stays fixed
// while its closest passage projection clamps at the longitudinal tile edge.
function clampSetup({quarter=0,inside=false,team=0}={}) {
  const turn=p=>{let {x,z}=p;for(let n=0;n<quarter;n++)[x,z]=[-z,x];return{x,z};};
  const unturn=p=>{let {x,z}=p;for(let n=0;n<quarter;n++)[x,z]=[z,-x];return{x,z};};
  const width=64,cell=p=>Math.floor(p.z+32)*width+Math.floor(p.x+32);
  const center=c=>({x:c%width-32+.5,z:Math.floor(c/width)-32+.5});
  const walk=c=>c>=0&&c<width*width&&unturn(center(c)).x===-.5;
  const levels=new Uint8Array(width*width);
  const path=Array.from({length:15},(_,i)=>cell(turn({x:-.5,z:11.5-i})));
  const unit=actor({id:52,team,...turn({x:-.77,z:inside?.985:1.015}),
    path,pathIndex:11,moveGoalCell:path.at(-1),queuedWaypoints:[{destination:cell(turn({x:-.5,z:-3.5})),attackMove:false}]});
  const peerPath=Array.from({length:15},(_,i)=>cell(turn({x:-.5,z:-9.5+i})));
  const peer=actor({id:51,team,...turn({x:-.3,z:.85}),path:peerPath,pathIndex:11,
    moveGoalCell:peerPath.at(-1),target:turn({x:-.5,z:4.5})});
  const raw=turn({x:-.5,z:.5}),direction=turn({x:0,z:-1});
  const pointAllowed=p=>canTraverseStaticBodySegment(p,p,.22,width,width,walk);
  const canTraverse=p=>canTraverseUnitStep(cell(unit),cell(p),width,levels,walk)
    &&canTraverseStaticBodySegment(unit,p,.22,width,width,walk,{allowEscape:true});
  assert.ok(pointAllowed(unit)&&pointAllowed(peer));
  return {unit,neighbors:[peer],progressTarget:raw,travelDirection:direction,
    target:crowdPassagePoint(raw,direction,unit,[peer],pointAllowed),
    passageProjection:true,stepDistance:2.6/30,cellCenter:center(cell(unit)),
    pointAllowed,canTraverse,directionOf:()=>turn({x:0,z:1})};
}

for(const team of [0,1])for(let quarter=0;quarter<4;quarter++)for(const inside of [false,true])
  test(`seat${team}, rotation${quarter}, ${inside?'inside':'outside'} tile: cardinal clamp retains route scoring`,()=>{
    const cfg=clampSetup({team,quarter,inside}),before=structuredClone([cfg.unit,...cfg.neighbors]);
    const result=selectCrowdStep(cfg),to=endpoint(cfg.unit,result),raw=cfg.progressTarget;
    assert.ok(!result.waitingForCrowd&&!result.yieldingForCrowd&&!result.reachedWaypoint);
    assert.ok(Math.hypot(raw.x-to.x,raw.z-to.z)<Math.hypot(raw.x-cfg.unit.x,raw.z-cfg.unit.z)-.04);
    assert.ok(cfg.canTraverse(to)&&canTraverseCrowdBodySegment(cfg.unit,to,.22,cfg.neighbors));
    assert.ok(result.crowdControl.proposals<=CROWD_PROPOSAL_LIMIT);
    assert.deepEqual(result.target,cfg.target,'the executor keeps its exact passage target');
    assert.deepEqual([cfg.unit,...cfg.neighbors],before,'no movement, intent or waypoint consumption in selection');
  });

test('the same outside-clamp geometry requires host passage provenance',()=>{
  const cfg=clampSetup();cfg.passageProjection=false;
  const move=selectCrowdStep(cfg),to=endpoint(cfg.unit,move),raw=cfg.progressTarget;
  assert.ok(Math.hypot(raw.x-to.x,raw.z-to.z)>Math.hypot(raw.x-cfg.unit.x,raw.z-cfg.unit.z));
});

for(const [name,change]of[
  ['unrelated target inside raw tile',c=>{c.target={x:-.22,z:.8};}],
  ['target outside raw tile',c=>{c.target={x:-.22,z:-.01};}],
  ['preferred target instead of closest clamp',c=>{c.target={x:-.22,z:.5};}],
  ['terminal waypoint',c=>{c.unit.path=[c.unit.path.at(-1)];c.unit.pathIndex=0;}],
  ['raw waypoint behind',c=>{c.progressTarget={x:-.5,z:2.5};}],
  ['missing direction',c=>{c.travelDirection=null;}],
  ['diagonal direction',c=>{c.travelDirection={x:1,z:-1};}],
  ['no opposing claimant',c=>{c.neighbors[0].target={x:-.5,z:-4.5};}],
  ['query overflow',c=>{c.overflow=true;}],
])test(`${name} preserves selection outside the new clamp arm`,()=>{
  const flagged=clampSetup(),original=clampSetup();change(flagged);change(original);original.passageProjection=false;
  assert.deepEqual(selectCrowdStep(flagged),selectCrowdStep(original));
});

test('a physically admitted backward retreat remains selectable at a verified clamp',()=>{
  const cfg=clampSetup();cfg.canTraverse=p=>p.z>cfg.unit.z+.001;
  const move=selectCrowdStep(cfg),to=endpoint(cfg.unit,move);
  assert.ok(!move.waitingForCrowd&&to.z>cfg.unit.z);
  assert.ok(canTraverseCrowdBodySegment(cfg.unit,to,.22,cfg.neighbors));
});

test('an active parked-body detour excludes clamp ranking',()=>{
  const flagged=clampSetup(),original=clampSetup();
  for(const cfg of [flagged,original])cfg.neighbors.push(actor({id:53,kind:'worker',x:-.67,z:1.410,path:[],pathIndex:0}));
  original.passageProjection=false;
  const a=selectCrowdStep(flagged),b=selectCrowdStep(original);
  assert.ok(a.crowdControl.pointProposals>0&&a.crowdControl.detourTerrainProbes>0,'actual selection constructs a detour');
  assert.deepEqual(a,b);
});

for(const team of [0,1])for(const relabel of [false,true])
  test(`seat${team}, relabel=${relabel}: an opposing claimant retains its original priority`,()=>{
    const cfg=clampSetup({team});if(relabel){cfg.unit.id=152;cfg.neighbors[0].id=151;}
    const before=structuredClone([cfg.unit,...cfg.neighbors]);
    selectCrowdStep({...cfg,tick:0});
    const move=selectCrowdStep({...cfg,tick:40});
    assert.ok(move.waitingForCrowd||move.yieldingForCrowd,'no new exemption from the lower-ID opposing claim');
    if(!move.waitingForCrowd){const to=endpoint(cfg.unit,move);
      assert.ok(cfg.canTraverse(to)&&canTraverseCrowdBodySegment(cfg.unit,to,.22,cfg.neighbors));}
    assert.deepEqual([cfg.unit,...cfg.neighbors],before);
  });

test('the actual host executes fixed-route progress across a cardinal passage clamp',async()=>{
  const {createPathingReplayFixture}=await import('./pathing-replay-fixture.mjs');
  const {pathingBaselineMap}=await import('./pathing-baseline-cases.mjs');
  const map={...pathingBaselineMap({group:2}),width:64,height:64,
    spawnPoints:[{team:0,x:-20,z:-20},{team:1,x:20,z:20}],obstacles:[
      {id:'left-bank',column:0,row:25,width:31,height:15,material:'stone'},
      {id:'right-bank',column:32,row:25,width:32,height:15,material:'stone'},
    ]};
  const f=await createPathingReplayFixture(map,{traceLandSteps:true,traceCrowdSteps:true}),r=f.replay;
  try{
    const [unit,peer]=r.units.filter(u=>u.team===0&&u.kind==='infantry');
    for(const other of r.units)if(other!==unit&&other!==peer)other.hp=0;
    for(const [body,z,goal]of[[unit,1.015,-2.5],[peer,.85,4.5]]){
      Object.assign(body,{x:body===unit?-.77:-.3,z});
      r.order(0,{type:'setStance',ids:[body.id],stance:'noAttack'});
      r.order(0,{type:'move',ids:[body.id],x:-.5,z:goal});r.drain();
    }
    r.order(0,{type:'move',queue:true,ids:[unit.id],x:-.5,z:-3.5});r.drain();
    // A controlled accepted-route input with real Move and queued Move intent.
    unit.path=Array.from({length:15},(_,i)=>r.cell(-.5,11.5-i));unit.pathIndex=11;
    peer.path=Array.from({length:15},(_,i)=>r.cell(-.5,-9.5+i));peer.pathIndex=11;
    const intent={revision:unit.orderRevision,goal:unit.moveGoalCell,path:unit.path,
      index:unit.pathIndex,queue:structuredClone(unit.queuedWaypoints)};
    const from={x:unit.x,z:unit.z},raw=r.point(unit.path[unit.pathIndex]);
    r.step();
    const writes=r.landSteps.filter(s=>s.id===unit.id);
    assert.equal(writes.length,1);assert.equal(writes[0].reason,'steering');
    assert.ok(Math.hypot(raw.x-unit.x,raw.z-unit.z)<Math.hypot(raw.x-from.x,raw.z-from.z)-.04);
    const walk=c=>r.isWalkable(c);
    assert.ok(canTraverseStaticBodySegment(from,unit,.22,64,64,walk));
    assert.ok(canTraverseCrowdBodySegment(from,unit,.22,writes[0].neighbours));
    assert.equal(unit.path,intent.path);assert.equal(unit.pathIndex,intent.index);
    assert.equal(unit.orderRevision,intent.revision);assert.equal(unit.moveGoalCell,intent.goal);
    assert.deepEqual(unit.queuedWaypoints,intent.queue);
    const control=r.crowdSteps.find(s=>s.id===unit.id);
    assert.ok(control.complete&&control.proposals<=CROWD_PROPOSAL_LIMIT);
    assert.equal(control.leaseAge,0);assert.equal(control.contourAge,0);
  }finally{await f.dispose();}
});

test('a live finite passage lease retains its retreat under clamp provenance',()=>{
  const run=flag=>{
    const unit=actor({x:0,z:.5,path:[1,2,3]}),peer=actor({id:2,x:.44,z:.5,path:[1,2,3]});
    const worker=actor({id:3,kind:'worker',x:0,z:1.5,path:[],pathIndex:0});
    const before=structuredClone([unit,peer,worker]);
    const move=(body,tick,extra={})=>selectCrowdStep({unit:body,tick,
      target:{x:body===unit?2:-2,z:.5},neighbors:[body===unit?peer:unit,worker],
      stepDistance:.09,canTraverse:()=>true,...extra});
    for(let tick=0;tick<120;tick++){move(peer,tick);move(unit,tick);}
    assert.ok(move(unit,120).yieldingForCrowd);move(peer,120);
    const target=crowdPassagePoint({x:2,z:.5},{x:1,z:0},unit,[peer,worker],()=>true);
    const result=move(unit,121,{target,progressTarget:{x:2,z:.5},travelDirection:{x:1,z:0},
      cellCenter:{x:0,z:.5},passageProjection:flag,
      targetOf:other=>other===peer?{x:-2,z:.5}:null});
    assert.equal(result.crowdControl.leaseAge,1);assert.ok(result.yieldingForCrowd&&result.x<0);
    assert.ok(canTraverseCrowdBodySegment(unit,endpoint(unit,result),.22,[peer,worker]));
    assert.ok(result.crowdControl.proposals<=CROWD_PROPOSAL_LIMIT);
    assert.deepEqual([unit,peer,worker],before);return result;
  };
  assert.deepEqual(run(true),run(false));
});

test('a live parked contour keeps its admitted step under clamp provenance',()=>{
  const run=flag=>{
    const unit=actor({x:0,z:.5,path:[1,2,3]});
    const neighbors=[actor({id:3,kind:'worker',x:.5,z:.5,path:[],pathIndex:0}),
      actor({id:4,x:-.8,z:.5,target:{x:-2,z:.5}}),actor({id:5,x:-.8,z:1.2,target:{x:-2,z:1.2}})];
    const before=structuredClone([unit,...neighbors]);
    const cfg={unit,neighbors,target:{x:1.501,z:.5},progressTarget:{x:2,z:.5},
      travelDirection:{x:1,z:0},cellCenter:{x:0,z:.5},stepDistance:.09,canTraverse:()=>true};
    for(let tick=0;tick<=90;tick++)selectCrowdStep({...cfg,tick});
    const result=selectCrowdStep({...cfg,tick:91,passageProjection:flag});
    assert.equal(result.crowdControl.contourAge,1);assert.ok(!result.waitingForCrowd);
    assert.ok(canTraverseCrowdBodySegment(unit,endpoint(unit,result),.22,neighbors));
    assert.ok(result.crowdControl.proposals<=CROWD_PROPOSAL_LIMIT);
    assert.deepEqual([unit,...neighbors],before);return result;
  };
  assert.deepEqual(run(true),run(false));
});
