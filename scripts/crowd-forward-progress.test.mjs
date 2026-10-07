import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import {UNIT_DEFINITIONS} from '../src/gameplay-definitions.mjs';
import {ordinaryCrowdBodyRadius} from '../src/unit-crowd-steering.mjs';
import {constructionServerBindings} from './construction-server-fixture.mjs';
import {workerPatrolAcquiredMovementActive} from '../src/combat-movement.mjs';
import {workerEconomyBodyRadius} from '../src/unit-movement.mjs';

const source=readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
const start=source.indexOf('function getMoveVector('),end=source.indexOf('\nfunction ',start+1);
assert.ok(start>=0&&end>start);
const workerRadiusStart=source.indexOf('function workerLocalBodyRadius(');
const workerRadiusEnd=source.indexOf('\nfunction ',workerRadiusStart+1);
assert.ok(workerRadiusStart>=0&&workerRadiusEnd>workerRadiusStart);
const width=64,half=32,bucketSize=1.2,columns=Math.ceil(width/bucketSize);
const point=c=>({x:c%width-half+.5,z:Math.floor(c/width)-half+.5});
const cell=(x,z)=>Math.floor(z+half)*width+Math.floor(x+half);
function fixture({heading=[0,1],team=0,count=2,offset=.095}={}) {
  const [x,z]=heading,length=Math.hypot(x,z),dx=x/length,dz=z/length;
  const first=cell(.5,.5),last=cell(.5+x,.5+z);
  const units=[{id:0,team,hp:100,kind:'infantry',x:.5-dx*offset,z:.5-dz*offset,
    path:[first,last],pathIndex:0,attackTargetId:-1,attackBuildingTargetId:-1},
    ...Array.from({length:count},(_,i)=>({id:i+1,team,hp:100,kind:'infantry',x:.5,z:.5,
      path:[],pathIndex:0,movePlanningPending:false,attackTargetId:-1,attackBuildingTargetId:-1}))];
  const heads=new Int32Array(columns*columns),next=new Int32Array(units.length);
  function rebuild() {
    heads.fill(-1);next.fill(-1);
    for(const u of units){const b=Math.floor((u.z+half)/bucketSize)*columns+Math.floor((u.x+half)/bucketSize);
      next[u.id]=heads[b];heads[b]=u.id;}
  }
  const context=vm.createContext({...constructionServerBindings(),workerPatrolAcquiredMovementActive,workerEconomyBodyRadius,units,UNIT_DEFINITIONS,ordinaryCrowdBodyRadius,STEP_SECONDS:1/30,MAP_WIDTH:width,
    MAP_HALF_X:half,MAP_HALF_Z:half,MIN_SEPARATION:.56,SPATIAL_BUCKET_SIZE:bucketSize,
    spatialBucketColumns:columns,spatialBucketRows:columns,spatialBucketHeads:heads,spatialBucketNext:next,
    SEPARATION_DIAGNOSTICS_ENABLED:false,cellToWorld:point,worldToCell:cell});
  vm.runInContext(source.slice(workerRadiusStart,workerRadiusEnd),context);
  vm.runInContext(source.slice(start,end),context);rebuild();
  return {units,bodyRadius:unit=>context.workerLocalBodyRadius(unit),vector:()=>context.getMoveVector(units[0]),step(){
    const u=units[0],move=context.getMoveVector(u);if(!move)return;
    if(move.reachedWaypoint){u.x=move.target.x;u.z=move.target.z;u.pathIndex++;}
    else {u.x+=move.x*move.stepDistance;u.z+=move.z*move.stepDistance;}
    rebuild();
  }};
}
test('the extracted local-body seam retains the real economy Worker footprint',()=>{
  const f=fixture(),worker={...f.units[0],kind:'worker',gatherPhase:'to-base',cargo:1};
  assert.equal(f.bodyRadius(worker),constructionServerBindings().LAND_CLEARANCE_PROFILE.radiusByKind.worker);
  assert.equal(f.bodyRadius({...worker,cargo:0}),0,'node-free empty Return has no economy body');
  assert.equal(f.bodyRadius({...worker,kind:'infantry'}),0,'Infantry does not adopt the economy Worker body');
});
for(const team of [0,1])for(const heading of [[0,1],[1,1],[1,0],[1,-1],[0,-1],[-1,-1],[-1,0],[-1,1]]) {
  test(`seat ${team}, heading ${heading}: stacked parked Infantry cannot reverse or trap a route`,()=>{
    const f=fixture({team,heading}),u=f.units[0],parked=structuredClone(f.units.slice(1));
    const move=f.vector(),target=point(u.path[0]);
    assert.ok(move.x*(target.x-u.x)+move.z*(target.z-u.z)>0,'crowd steering retains forward progress');
    for(let i=0;i<90&&u.pathIndex<u.path.length;i++)f.step();
    assert.equal(u.pathIndex,u.path.length,'cross both waypoints instead of oscillating before the first');
    assert.deepEqual(f.units.slice(1),parked,'parked actors keep position and intent');
  });
}
test('a single parked neighbor retains the existing soft separation vector',()=>{
  const f=fixture({heading:[1,0],count:1,offset:.2}),u=f.units[0];
  f.units[1].z+=.1;
  const vector=f.vector(),sx=u.x-f.units[1].x,sz=u.z-f.units[1].z,distance=Math.sqrt(sx*sx+sz*sz);
  const force=(.56-distance)/.56,x=1+sx/distance*force*.62,z=sz/distance*force*.62;
  assert.equal(vector.x,x/Math.hypot(x,z));assert.equal(vector.z,z/Math.hypot(x,z));
  assert.equal(vector.stepDistance,UNIT_DEFINITIONS.infantry.combat.moveSpeed/30);
});
test('crowd steering still deflects laterally while preserving forward progress',()=>{
  const f=fixture({heading:[0,1],count:3,offset:.18});
  for(const u of f.units.slice(1))u.x+=.1;
  const move=f.vector();assert.ok(move.x<0,'repulsion still steers away from neighboring actors');
  assert.ok(move.z>0,'accumulated repulsion cannot reverse the route');
});
