import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { activeWallBuildOrder } from '../src/wall-build-order.mjs';
import { canTraverseUnitStep } from '../src/unit-movement.mjs';
import { findStationaryWorkerDetour } from '../src/unit-obstacle-detour.mjs';
import { UNIT_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { farmHarvestNode, farmBuildingId } from '../src/farm-harvest.mjs';

const server = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
const width = 8, half = width / 2, bucketSize = 1.2, bucketColumns = 7;
const cell = (x,z) => Math.floor(z+half)*width+Math.floor(x+half);
const point = c => ({x:c%width-half+.5,z:Math.floor(c/width)-half+.5});
function fixture({kind='infantry',x=-.5,z=-.01,cliff=true,blocked=[],realRepairs=false} = {}) {
  const mover = {id:0,team:0,hp:100,kind,x,z,path:[28],pathIndex:0,
    attackTargetId:-1,attackBuildingTargetId:-1,holdingPosition:false,
    gatherForestCell:-1,gatherNodeId:'berries',gatherPhase:'gathering',
    orderRevision:0,movePlanningPending:false,moveGoalCell:28,buildingTargetId:null,
    queuedWaypoints:[],attackMove:false,lastMoveTick:0};
  const units = [mover,...[-.05,-.12,-.19].map((offset,i)=>({id:i+1,team:0,hp:100,kind,
    x,z:z+offset,path:[],pathIndex:0,attackTargetId:-1,attackBuildingTargetId:-1,
    gatherForestCell:-1,gatherNodeId:null,gatherPhase:''}))];
  const levels = new Uint8Array(width*width); if(cliff) levels.fill(2,width*4);
  const blockedCells = new Set(blocked);
  const walkable = c => c>=0&&c<width*width&&!blockedCells.has(c);
  const bucket = (x,z)=>Math.floor((z+half)/bucketSize)*bucketColumns+Math.floor((x+half)/bucketSize);
  const heads = new Int32Array(bucketColumns*bucketColumns).fill(-1);
  const next = new Int32Array(units.length).fill(-1);
  const teamHeads = [new Int32Array(heads.length).fill(-1),new Int32Array(heads.length).fill(-1)];
  const teamCounts = [new Int32Array(heads.length),new Int32Array(heads.length)];
  const teamNext = [new Int32Array(units.length).fill(-1),new Int32Array(units.length).fill(-1)];
  const bucketOf = new Int32Array(units.length);
  const grouped = new Map();
  for(const u of units){const b=bucket(u.x,u.z);next[u.id]=heads[b];heads[b]=u.id;bucketOf[u.id]=b;
    const list=grouped.get(b)||[];list.push(u.id);grouped.set(b,list);}
  for(const [b,ids] of grouped){teamHeads[0][b]=ids[0];teamCounts[0][b]=ids.length;
    for(let i=0;i<ids.length;i++)teamNext[0][ids[i]]=ids[(i+1)%ids.length];}
  const repairs = [];
  const context = vm.createContext({units,UNIT_DEFINITIONS,activeWallBuildOrder,MAP_WIDTH:width,MAP_HALF_X:half,MAP_HALF_Z:half,
    militaryCombatant: unit => unit.kind !== 'worker', automaticPositionAllowed: () => true,
    STEP_SECONDS:1/30,MIN_SEPARATION:.56,SPATIAL_BUCKET_SIZE:bucketSize,WALK_SPEED:2.6,
    WORKER_INTERACTION_RANGE:1.4,BUILDER_INTERACTION_RANGE:1.4,
    spatialBucketColumns:bucketColumns,spatialBucketRows:bucketColumns,spatialBucketHeads:heads,
    spatialBucketNext:next,spatialBucketTeamHeads:teamHeads,spatialBucketTeamCounts:teamCounts,
    spatialBucketTeamNext:teamNext,spatialBucketOfUnit:bucketOf,
    spatialBucketColumn:x=>Math.max(0,Math.min(bucketColumns-1,Math.floor((x+half)/bucketSize))),
    spatialBucketRow:z=>Math.max(0,Math.min(bucketColumns-1,Math.floor((z+half)/bucketSize))),
    elevationLevelByCell:levels,canTraverseUnitStep,findStationaryWorkerDetour,SEPARATION_DIAGNOSTICS_ENABLED:false,
    tickNumber:1,dirty:false,worldToCell:cell,cellToWorld:point,isWalkable:walkable,
    resourceNodeStates:new Map([['berries',{x,z:-1,hp:1}]]),buildingsById:new Map(),farmHarvestNode,farmBuildingId,
    enqueueRouteRepairs:list=>repairs.push(...list),spreadInteractingUnits(){},advanceQueuedWaypoints(){}});
  vm.runInContext(server.slice(server.indexOf('function harvestNodeById('),server.indexOf('function routeWorker(')),context);
  vm.runInContext(server.slice(server.indexOf('function getMoveVector('),server.indexOf('// Units stop following paths')),context);
  const movement=server.slice(server.indexOf('  const blockedRouteRepairs = [];'),
    server.indexOf('\n}\n\nfunction encodeWebSocketFrame'));
  vm.runInContext(`function moveOneTick(){${movement}}`,context);
  if(realRepairs){
    Object.assign(context,{nearestOpenCell:c=>walkable(c)?c:-1,performance,TICK_RATE:30,
      nextMoveOrderId:1,movePlanningEpoch:0,movePlanningQueue:[],activeMovePlanningJob:null,
      pendingMoveStartBroadcasts:new Set(),scheduleNextMovePlanning(){}});
    vm.runInContext(server.slice(server.indexOf('function pendingMoveAssignmentsByUnit('),
      server.indexOf('function routesShareWalkableComponent(')),context);
    vm.runInContext(server.slice(server.indexOf('function enqueueRouteRepairs('),
      server.indexOf('function isResourceCell(')),context);
    vm.runInContext(server.slice(server.indexOf('function applyPlannedMoveAssignment('),
      server.indexOf('function takeMoveStartBroadcastRequest(')),context);
  }
  const spread=server.slice(server.indexOf('function spreadInteractingUnits('),
    server.indexOf('// Bounded, rotating enemy-bucket scans'));
  return {mover,units,levels,blockedCells,walkable,context,repairs,
    move:()=>context.moveOneTick(),spread:()=>{vm.runInContext(spread,context);context.spreadInteractingUnits();}};
}

test('crowd separation cannot push a moving unit across an impassable elevation edge', () => {
  const f=fixture();const before=cell(f.mover.x,f.mover.z);f.move();
  assert.ok(Math.abs(f.levels[cell(f.mover.x,f.mover.z)]-f.levels[before])<=1,
    'real simulation movement must obey the same cliff rule as its planned route');
  assert.ok(f.mover.x>-.5,'fallback follows the valid level-0 route');
});

test('stationary gather separation cannot push a working unit over a cliff', () => {
  for (const side of [-1, 1]) {
    const f=fixture({kind:'worker'});f.mover.path=[];
    f.context.resourceNodeStates.set('berries',{x:f.mover.x+side,z:f.mover.z,hp:1});
    const before=cell(f.mover.x,f.mover.z);f.spread();
    assert.ok(Math.abs(f.levels[cell(f.mover.x,f.mover.z)]-f.levels[before])<=1,
      `working beside berries on ${side<0?'left':'right'}`);
  }
});

test('stationary melee separation obeys the same terrain boundaries', () => {
  const f=fixture();f.mover.path=[];f.mover.attackTargetId=1;
  const before=cell(f.mover.x,f.mover.z);f.spread();
  assert.ok(Math.abs(f.levels[cell(f.mover.x,f.mover.z)]-f.levels[before])<=1);
});

test('crowd deflection cannot cut the blocked corner beside its legal route', () => {
  const f=fixture({x:-.01,z:-.01,cliff:false,blocked:[35]});f.move();
  assert.notEqual(cell(f.mover.x,f.mover.z),36,'diagonal destination is open, but its side corner is blocked');
  assert.ok(f.mover.x>-.01,'valid route fallback still makes progress');
});

test('open-ground motion and legal one-level elevation steps remain allowed', () => {
  const f=fixture({cliff:false});f.move();assert.ok(f.mover.z>0,'open separation remains unchanged');
  const levels=new Uint8Array(64);levels[28]=1;
  assert.equal(canTraverseUnitStep(27,28,width,levels,()=>true),true);
  assert.equal(canTraverseUnitStep(28,27,width,levels,()=>true),true);
  assert.equal(canTraverseUnitStep(27,27,width,levels,()=>true),true);
});

test('diagonal checks both walkability and every intervening elevation boundary', () => {
  const levels=new Uint8Array(64);const blocked=new Set();const walkable=c=>!blocked.has(c);
  assert.equal(canTraverseUnitStep(27,36,width,levels,walkable),true);
  for(const c of [28,35,36]){blocked.add(c);assert.equal(canTraverseUnitStep(27,36,width,levels,walkable),false);blocked.delete(c);}
  for(const c of [28,35]){levels[c]=2;assert.equal(canTraverseUnitStep(27,36,width,levels,walkable),false);levels[c]=0;}
  levels[28]=1;levels[35]=1;levels[36]=2;
  assert.equal(canTraverseUnitStep(27,36,width,levels,walkable),false,'a diagonal cannot skip two elevation levels');
  levels[36]=1;
  assert.equal(canTraverseUnitStep(27,36,width,levels,walkable),true,'one-level slopes remain traversable');
});

test('movement guards bounds, row wrapping and jumps across multiple cells', () => {
  const levels=new Uint8Array(64);
  for(const [from,to] of [[-1,0],[0,64],[7,8],[27,29],[27,43],[27,NaN]]){
    assert.equal(canTraverseUnitStep(from,to,width,levels,()=>true),false,`${from} -> ${to}`);
  }
});

test('all eight adjacent directions reject cliffs in both directions', () => {
  const from=27;
  for(const [dx,dz] of [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]]){
    const to=from+dx+dz*width;const levels=new Uint8Array(64);levels[to]=2;
    assert.equal(canTraverseUnitStep(from,to,width,levels,()=>true),false,`${dx},${dz} uphill`);
    assert.equal(canTraverseUnitStep(to,from,width,levels,()=>true),false,`${dx},${dz} downhill`);
    levels[to]=1;
    assert.equal(canTraverseUnitStep(from,to,width,levels,()=>true),true,`${dx},${dz} slope`);
    assert.equal(canTraverseUnitStep(to,from,width,levels,()=>true),true,`${dx},${dz} descent`);
  }
});

test('a newly blocked waypoint still schedules the existing route repair', () => {
  const f=fixture({cliff:false});const before={x:f.mover.x,z:f.mover.z};
  f.blockedCells.add(28);f.move();
  assert.deepEqual({x:f.mover.x,z:f.mover.z},before);
  assert.equal(f.repairs.length,1);assert.equal(f.repairs[0].unit,f.mover);
  assert.equal(f.repairs[0].destination,28);
});

test('no local detour in a one-cell passage retains soft separation and the stationary Worker',()=>{
  const f=fixture({x:-.6,z:-.5,cliff:false});f.mover.path=[27,28,29];f.mover.moveGoalCell=29;
  const blocker=f.units[1];Object.assign(blocker,{kind:'worker',x:-.5,z:-.5,holdingPosition:true,orderRevision:7});
  for(const u of f.units.slice(2))u.hp=0;
  for(let c=0;c<64;c++)if(Math.floor(c/width)!==3)f.blockedCells.add(c);
  const before={x:blocker.x,z:blocker.z,holdingPosition:blocker.holdingPosition,orderRevision:blocker.orderRevision};
  for(let i=0;i<200&&f.mover.pathIndex<f.mover.path.length;i++)f.move();
  assert.equal(f.mover.pathIndex,f.mover.path.length);assert.equal(f.mover.moveGoalCell,29);
  assert.deepEqual({x:f.mover.x,z:f.mover.z},point(29));assert.equal(f.repairs.length,0);
  assert.deepEqual({x:blocker.x,z:blocker.z,holdingPosition:blocker.holdingPosition,orderRevision:blocker.orderRevision},before);
});

test('a local detour copies a shared planned path and leaves the other assignee intact',()=>{
  const f=fixture({x:-.6,z:-.5,cliff:false}),shared=[27,28,29];f.mover.path=shared;
  Object.assign(f.units[1],{kind:'worker',x:-.5,z:-.5});
  f.units[2].hp=0;f.units[2].path=shared;f.units[3].hp=0;
  f.move();assert.notEqual(f.mover.path,shared);assert.deepEqual(shared,[27,28,29]);
  assert.equal(f.units[2].path,shared);assert.equal(f.units[2].pathIndex,0);
  assert.equal(f.mover.path.at(-1),29);
});

test('legal crowd deflection repairs once, preserves the queued route and rejoins', () => {
  for(const terrain of ['slope','corner']){
    const f=fixture({x:-.01,z:.001,cliff:false,realRepairs:true});
    for(const other of f.units.slice(1))other.hp=0;
    if(terrain==='slope'){f.levels[27]=1;f.levels[35]=2;}else f.blockedCells.add(36);
    assert.equal(canTraverseUnitStep(27,28,width,f.levels,f.walkable),true,'original route legal');
    assert.equal(canTraverseUnitStep(27,35,width,f.levels,f.walkable),true,'prior crowd deflection legal');
    f.mover.gatherNodeId=null;f.mover.gatherPhase='';
    f.mover.attackMove=true;f.mover.queuedWaypoints=[{destination:29,attackMove:false}];
    const queued=f.mover.queuedWaypoints;
    f.move();
    assert.equal(f.context.movePlanningQueue.length,1,`${terrain} requests repair`);
    assert.equal(f.mover.movePlanningPending,true);
    assert.equal(f.mover.lastMoveTick,0,'rejected movement is not marked as motion');
    assert.equal(f.mover.queuedWaypoints,queued);
    for(let tick=0;tick<300;tick++)f.move();
    assert.equal(f.context.movePlanningQueue.length,1,'pending repair is not requeued each tick');
    const job=f.context.movePlanningQueue[0];const assignment=job.assignments[0];
    assert.equal(assignment.destination,28);
    assignment.path=[27,28]; // Known legal cardinal return, delivered through real assignment application.
    assert.equal(f.context.applyPlannedMoveAssignment(job,assignment),true);
    assert.equal(f.mover.attackMoveRouteReady,true);assert.equal(f.mover.movePlanningPending,false);
    for(let tick=0;tick<100&&f.mover.pathIndex<f.mover.path.length;tick++)f.move();
    assert.equal(f.mover.pathIndex,2);assert.deepEqual({x:f.mover.x,z:f.mover.z},point(28));
    assert.equal(f.mover.queuedWaypoints,queued);assert.equal(queued.length,1);
  }
});

test('a terrain-rejected combat step invalidates its pursuit route for normal replanning', () => {
  for(const targetKey of ['attackTargetId','attackBuildingTargetId']){
    const f=fixture({x:-.01,z:.001,cliff:false});f.levels[27]=1;f.levels[35]=2;
    for(const other of f.units.slice(1))other.hp=0;
    f.mover[targetKey]=1;f.mover.lastAttackCell=28;f.mover.repathTimer=2;
    f.move();
    assert.equal(f.mover.path.length,0);assert.equal(f.mover.pathIndex,0);
    assert.equal(f.mover.lastAttackCell,-1);assert.equal(f.mover.repathTimer,0);
    assert.equal(f.mover[targetKey],1,'target intent is retained for the existing combat planner');
    assert.equal(f.repairs.length,0,'combat replanning owns pursuit, rather than a move job');
    assert.equal(f.mover.lastMoveTick,0);
  }
});

test('internal route repair preserves an active palisade sequence revision', () => {
  const f=fixture({cliff:false,realRepairs:true});
  f.mover.generation=3;
  f.mover.wallBuildOrder={ids:[4,5],generation:3,revision:f.mover.orderRevision};
  const order=f.mover.wallBuildOrder;
  f.context.enqueueRouteRepairs([{unit:f.mover,destination:28}]);
  assert.equal(f.mover.orderRevision,1);
  assert.equal(order.revision,1);
  assert.equal(activeWallBuildOrder(f.mover),order);
  f.mover.orderRevision++;
  assert.equal(activeWallBuildOrder(f.mover),null,'a later player revision still invalidates the sequence');
});
