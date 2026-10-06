// Source/VM observer controls only: no replay fixture, match, journey or server.
import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {instrumentReplayMovementAdmissions} from './pathing-replay-fixture.mjs';

const server=readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
const adapter=readFileSync(new URL('./pathing-replay-fixture.mjs',import.meta.url),'utf8');
const points=[['{ x: nextX, z: nextZ }','          '],['{ x: fallbackX, z: fallbackZ }','            ']];
const standalone=p=>`if (!workerBodyStepAllowed(unit, ${p})) break;`;
const combined=(p,indent)=>`if (!workerBodyStepAllowed(unit, ${p})\n${indent}|| !admitCrowdLandWrite(unit, ${p}, true)) break;`;
function shape(source,kind) {
  for(const [p,indent] of points) {
    const old=standalone(p),next=combined(p,indent);
    const matches=[old,next].filter(v=>source.includes(v));assert.equal(matches.length,1);
    source=source.replace(matches[0],kind==='combined'?next:old);
  }
  return source;
}
const observerFunctions=adapter.slice(adapter.indexOf('function observeReplayMovementDecision('),adapter.indexOf('function recordReplayRouteRejoin('));
const observerMethods=adapter.slice(adapter.indexOf('  observeMovement(team, ids) {'),adapter.indexOf('  buildingDistance(')).replaceAll('${observeMovement}','true');
function actor(team,id=0) {
  return {id,team,generation:17,orderRevision:8,hp:100,kind:'worker',movementDomain:'land',x:0,z:0,
    path:[6],pathIndex:0,moveGoalCell:6,queuedWaypoints:[{destination:7}],attackTargetId:-1,attackBuildingTargetId:-1};
}
function run(kind,team,branch,outcome,on) {
  const unit=actor(team),enemy={...actor(1-team,1),holdingPosition:true};
  const calls=[],repairs=[],context=vm.createContext({unit,units:[unit,enemy],calls,repairs,assert,
    tickNumber:40,navigationRevision:9,dirty:false,STEP_SECONDS:.1,
    UNIT_DEFINITIONS:{worker:{combat:{moveSpeed:1,range:0}}},MAP_HALF_X:4,MAP_HALF_Z:4,MAP_WIDTH:8,
    elevationLevelByCell:new Uint8Array(64),worldToCell:(x,z)=>x>0?1:z>0?2:0,isWalkable:()=>true,
    activeLandMovementBodyRadius:()=>0,workerLocalBodyRadius:()=>0,
    automaticPositionAllowed:(u,x,z)=>{assert.equal(u,unit);calls.push(['automatic',x,z]);return true;},
    canTraverseUnitStep:(from,to)=>{calls.push(['cell',from,to]);return !(branch==='fallback'&&to===1);},
    canTraverseStaticBodySegment:()=>{throw Error('no static profile in this isolated admission control');},
    workerBodyStepAllowed:(u,to)=>{assert.equal(u,unit);calls.push(['worker',{...to}]);return outcome!=='worker-reject';},
    admitCrowdLandWrite:(u,to,clamp)=>{assert.equal(u,unit);calls.push(['capsule',{...to},clamp]);return outcome!=='capsule-reject';},
    enqueueRouteRepairs:r=>repairs.push(...r),workerPerformingAction:()=>null,
    replayMovementTeam:null,replayMovementActors:new Map(),replayMovementDecisions:new Map()});
  const proposal=branch==='terminal'?{target:{x:.1,z:0},reachedWaypoint:true,stepDistance:.1}
    :{x:1,z:0,target:{x:0,z:1},stepDistance:.1};
  context.getMoveVector=u=>{assert.equal(u,unit);calls.push(['vector']);
    if(on)context.observeReplayMovementDecision(u,proposal);return proposal;};
  vm.runInContext(observerFunctions+'\nconst observation={'+observerMethods+'};',context);
  if(on)vm.runInContext(`observation.observeMovement(${team},[0,1]);`,context);
  const source=on?instrumentReplayMovementAdmissions(shape(server,kind)):shape(server,kind);
  const comment=source.indexOf('    // A target can move within its current cell after the flow path ends.');
  const start=source.lastIndexOf('  for (const unit of units) {',comment);
  const end=source.indexOf('  enqueueRouteRepairs(blockedRouteRepairs);',start);
  assert.ok(start>=0&&end>start);
  vm.runInContext('function execute(){const blockedRouteRepairs=[];const detourRouteLedger=null;let landRouteRetentionTick=null;\n'
    +source.slice(start,end)+'\n enqueueRouteRepairs(blockedRouteRepairs);}\nexecute();',context);
  const rows=JSON.parse(vm.runInContext('JSON.stringify(observation.movementObservations())',context));
  return {state:structuredClone([unit,enemy]),calls,repairs:structuredClone(repairs),rows,context,unit};
}
for(const kind of ['standalone','combined'])for(const team of [0,1])for(const branch of ['steering','fallback'])
  for(const outcome of ['worker-reject','capsule-reject','admit'])test(`${kind} seat${team} ${branch} ${outcome}: observer preserves executor calls and state`,()=>{
    const off=run(kind,team,branch,outcome,false),on=run(kind,team,branch,outcome,true);
    assert.deepEqual(on.state,off.state);assert.deepEqual(on.calls,off.calls);assert.deepEqual(on.repairs,off.repairs);
    assert.deepEqual(off.rows,[]);assert.equal(on.rows.length,1);assert.equal(on.rows[0].id,0);
    const checks=on.calls.filter(row=>['worker','capsule'].includes(row[0]));
    const capsuleExpected=kind==='combined'&&outcome!=='worker-reject';
    assert.deepEqual(checks.map(row=>row[0]),capsuleExpected?['worker','capsule']:['worker']);
    const expectedPoint=branch==='steering'?{x:.1,z:0}:{x:0,z:.1};
    assert.deepEqual(checks[0][1],expectedPoint);
    if(capsuleExpected){assert.deepEqual(checks[1][1],expectedPoint);assert.equal(checks[1][2],true);}
    const rejected=outcome==='worker-reject'||(kind==='combined'&&outcome==='capsule-reject');
    assert.equal(on.rows[0].admission,rejected?(kind==='combined'?'body-or-capsule-wait':'body-wait'):`${branch}-admitted`);
    assert.equal(on.rows[0].positionChanged,!rejected);assert.equal(on.state[0].pathIndex,0);
    assert.deepEqual(on.state[0].path,[6]);assert.deepEqual(on.state[0].queuedWaypoints,[{destination:7}]);
    assert.equal(on.repairs.length,0);
  });
for(const kind of ['standalone','combined'])for(const team of [0,1])test(`${kind} seat${team}: terminal rejection remains body-wait`,()=>{
  const off=run(kind,team,'terminal','worker-reject',false),on=run(kind,team,'terminal','worker-reject',true);
  assert.deepEqual(on.state,off.state);assert.deepEqual(on.calls,off.calls);assert.deepEqual(on.repairs,off.repairs);
  assert.equal(on.rows[0].admission,'body-wait');assert.equal(on.rows[0].positionChanged,false);
  assert.deepEqual(on.calls.filter(row=>['worker','capsule'].includes(row[0])).map(row=>row[0]),['worker']);
});
for(const [p,indent] of points)for(const fault of ['missing','duplicated','ambiguous'])test(`${p}: ${fault} observation boundary is refused`,()=>{
  let source=shape(server,'standalone');const plain=standalone(p),joint=combined(p,indent);
  source=source.replace(plain,fault==='missing'?'break;':fault==='duplicated'?plain+'\n'+plain:plain+'\n'+joint);
  assert.throws(()=>instrumentReplayMovementAdmissions(source),/exactly one known shape/);
});
for(const team of [0,1])test(`seat${team}: observation rejects foreign/replaced identities before private reads`,()=>{
  const h=run('combined',team,'steering','admit',true),c=h.context;
  const enemy={id:1,team:1-team};for(const field of ['hp','generation','orderRevision','x','z','path','pathIndex'])
    Object.defineProperty(enemy,field,{get(){throw Error('enemy private read '+field);}});
  c.units[1]=enemy;c.enemy=enemy;
  vm.runInContext(`observation.observeMovement(${team},[0,1]);observeReplayMovementDecision(enemy,null);observeReplayMovementAdmission(enemy,'body-wait');`,c);
  assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(observation.movementObservations())',c)).map(row=>row.id),[0]);
  const original=h.unit;c.units[0]={...original};c.replaced=c.units[0];
  vm.runInContext("observeReplayMovementDecision(replaced,null);observeReplayMovementAdmission(replaced,'body-wait');",c);
  assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(observation.movementObservations())',c)),[]);
  c.units[0]=original;original.generation++;
  vm.runInContext("observeReplayMovementDecision(unit,null);observeReplayMovementAdmission(unit,'body-wait');",c);
  assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(observation.movementObservations())',c)),[]);
});
