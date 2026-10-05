import test from 'node:test';
import assert from 'node:assert/strict';
import './route-publication-map-journeys.mjs';
import './local-detour-route-budget-journeys.mjs';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { activeWallBuildOrder } from '../src/wall-build-order.mjs';
import { canTraverseUnitStep, createUnitRouteResult, unitRoutePathCost, unitRouteResultIsCurrent,
  activeLandMovementBodyRadius, workerEconomyBodyRadius, LAND_CLEARANCE_PROFILE,
  canTraverseStaticBodySegment, createClearanceMoveGoalPoint, rejoinSelectedUnitRoute,
  unitRouteRejoinDecision, createUnitRoutePublicationLedger } from '../src/unit-movement.mjs';
import { XL_CHECKPOINT_ROUTE_MAX_ENTRIES } from '../src/server/checkpoint-route-budget.mjs';
import { canTraverseFlatUnitSegment, shortcutFlatUnitPath } from '../src/unit-path-line.mjs';
import { findStationaryWorkerDetour } from '../src/unit-obstacle-detour.mjs';
import { UNIT_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { farmHarvestNode, farmBuildingId } from '../src/farm-harvest.mjs';
import { workerFlowRouteBindings } from './economy-server-fixture.mjs';

const server = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');

const routeBudgetLimits = { maxUnits: 2000, maxResourceNodes: 128, maxEntries: XL_CHECKPOINT_ROUTE_MAX_ENTRIES };
const routeActor = (path=[],resume=null) => ({path,attackMoveResumePath:resume,pathIndex:path.length});
function savedRouteEnvelope(extra=0) {
  const shared=Array(65536);Object.defineProperty(shared,0,{get(){throw new Error('no route payload scan');}});
  const units=Array.from({length:5},()=>routeActor(shared,shared));
  const nodes=new Map(Array.from({length:6},(_,id)=>[id,{wildlifeHerd:{path:shared}}]));
  if(extra)nodes.set(5,{wildlifeHerd:{path:Array(65536+extra)}});
  return {units,nodes,shared};
}

test('publication ledger counts full saved fields including aliases/exhausted paths at the actual XL quota',()=>{
  for(const extra of [-1,0,1]){
    const {units,nodes}=savedRouteEnvelope(extra),unit=routeActor();units.push(unit);
    const ledger=createUnitRoutePublicationLedger(320,320,units,nodes,routeBudgetLimits);
    const report=ledger.check(unit,0);
    assert.equal(report.routeEntries,XL_CHECKPOINT_ROUTE_MAX_ENTRIES+extra);
    assert.equal(report.fieldVisits,units.length+5+nodes.size);
    assert.equal(report.status,extra>0?'deferred':'ready');
    assert.equal(ledger.check(unit,1).status,extra<0?'ready':'deferred');
    assert.deepEqual(unit,routeActor(),'census/reservation never mutates an actor');
  }
});

test('replacement reservation releases only the replaced saved field, without deduplicating its other aliases',()=>{
  const {units,nodes,shared}=savedRouteEnvelope(),unit=units[0];
  const ledger=createUnitRoutePublicationLedger(320,320,units,nodes,routeBudgetLimits);
  assert.equal(ledger.check(unit,1).prospectiveEntries,XL_CHECKPOINT_ROUTE_MAX_ENTRIES-65536+1);
  ledger.commit(unit,1);unit.path=[9];
  assert.equal(unit.attackMoveResumePath,shared);assert.equal(units[1].path,shared);
  assert.equal(ledger.check(unit,1).routeEntries,XL_CHECKPOINT_ROUTE_MAX_ENTRIES-65536+1);
  assert.equal(ledger.check(unit,65536).status,'ready');
  assert.equal(ledger.check(unit,65537).status,'deferred');
});

test('per-array limits include final-center/rejoin growth and refuse before reading any stored route cells',()=>{
  for(const [width,height] of [[320,160],[160,320],[320,320]]){
    const actor=routeActor(),ledger=createUnitRoutePublicationLedger(width,height,[actor],[],routeBudgetLimits),cells=width*height;
    for(const entries of [cells-1,cells,cells+1]){
      const result=ledger.check(actor,entries);
      assert.equal(result.status,entries>cells?'deferred':'ready');
      assert.equal(result.reason,entries>cells?'path-entry-limit':null);
    }
    assert.throws(()=>ledger.commit(actor,cells+1),/unreserved route publication/);
    assert.deepEqual(actor,routeActor());
  }
});

test('legacy publication bypasses the census without reading any state or quota configuration',()=>{
  const unread=new Proxy({}, {get(){throw new Error('legacy state must not be read');}});
  for(const [width,height] of [[16,17],[160,160],[256,256]])
    assert.equal(createUnitRoutePublicationLedger(width,height,unread,unread,unread),null);
});

test('metadata envelope visits are bounded by actor/node limits and malformed XL routes fail closed',()=>{
  const units=Array.from({length:2000},()=>routeActor([],[])),nodes=Array.from({length:128},()=>({wildlifeHerd:{path:[]}}));
  const ledger=createUnitRoutePublicationLedger(320,320,units,nodes,routeBudgetLimits);
  assert.equal(ledger.check(units[0],1).fieldVisits,4128);
  for(const [actors,resources] of [[units.concat(routeActor()),nodes],[units,nodes.concat({})],
    [[{path:[],attackMoveResumePath:undefined}],[]],[[routeActor(new Uint32Array(1))],[]],[[routeActor(Array(102401))],[]],
    [[routeActor()], [{wildlifeHerd:{path:null}}]]]){
    const invalid=createUnitRoutePublicationLedger(320,320,actors,resources,routeBudgetLimits);
    assert.equal(invalid.check(routeActor(),1).reason,'invalid-live-route-envelope');
  }
});

test('rejoin decision previews the existing immutable route without allocating/iterating its selected payload',()=>{
  const {route,options}=selectedRouteFixture();
  const path=route.path.slice();Object.defineProperty(path,Symbol.iterator,{value(){throw new Error('no execution copy');}});
  assert.equal(unitRouteRejoinDecision({...route,path},options),'prefixed');
  assert.equal(path.length,route.path.length);assert.deepEqual(path.slice(),route.path);
});

function selectedRouteFixture() {
  const width=64,height=48,startCell=1568,path=Object.freeze([1572,1508,1507,1506,1505,1569]);
  const position=Object.freeze({x:.25,z:.95}),identity=Object.freeze({unit:position,generation:9,revision:7,epoch:3,navigationRevision:4});
  const route=Object.freeze({status:'ready',path,selectedGoalCell:path.at(-1),goal:path.at(-1),
    originalPathLength:path.length,originalCost:900,identity,policy: 'retained-approach'});
  const cellToWorld=c=>({x:c%width-width/2+.5,z:Math.floor(c/width)-height/2+.5});
  return {route,options:{position,startCell,firstPoint:cellToWorld(path[0]),radius:.22,width,height,
    isWalkable:c=>c>=0&&c<width*height&&c!==1633,cellToWorld}};
}

test('selected-route rejoin retains anti-reversal waypoints, selected tail and every opaque metadata value for explicit kind radii',()=>{
  for(const radius of new Set(Object.values(LAND_CLEARANCE_PROFILE.radiusByKind))){
    const {route,options}=selectedRouteFixture();
    assert.ok(canTraverseStaticBodySegment(options.position,options.position,radius,options.width,options.height,options.isWalkable));
    assert.equal(canTraverseStaticBodySegment(options.position,options.firstPoint,radius,options.width,options.height,options.isWalkable),false);
    const result=rejoinSelectedUnitRoute(route,{...options,radius});
    assert.equal(result.rejoin,'prefixed');assert.notEqual(result.route,route);
    assert.deepEqual(result.route.path,[options.startCell,...route.path]);
    assert.deepEqual(result.route.path.slice(1),route.path,'no retained leading or reversal waypoint is reduced');
    assert.equal(result.route.path.at(-1),route.selectedGoalCell);
    for(const key of Object.keys(route))if(key!=='path')assert.equal(result.route[key],route[key],key);
    assert.deepEqual(route.path,[1572,1508,1507,1506,1505,1569]);
    assert.deepEqual(Object.keys(result.route),Object.keys(route),'no target/order/objective fields are introduced');
  }
});

test('selected-route rejoin preserves a safe fractional first approach and lets caller policy reject only a proposed prefix',()=>{
  const {route,options}=selectedRouteFixture();let policyCalls=0;
  const safe=rejoinSelectedUnitRoute(route,{...options,position:{x:.25,z:.5},acceptPrefix(){policyCalls++;return false;}});
  assert.equal(safe.rejoin,'unchanged');assert.equal(safe.route,route);assert.equal(policyCalls,0);
  const rejected=rejoinSelectedUnitRoute(route,{...options,acceptPrefix(point,cell){
    policyCalls++;assert.deepEqual(point,options.cellToWorld(options.startCell));assert.equal(cell,options.startCell);
    return false; // The caller retains its range/stance admissibility decision.
  }});
  assert.equal(rejected.rejoin,'rejected');assert.equal(rejected.route,route);assert.equal(policyCalls,1);
  assert.equal(rejected.route.path,route.path,'rejection is distinct from an empty or failed selected path');
});

test('caller-requested terrain rejoin works without a body policy and preserves an existing leading start cell',()=>{
  const {route,options}=selectedRouteFixture();
  const result=rejoinSelectedUnitRoute(route,{...options,radius:0,position:{x:.25,z:.5},requiresRejoin:true});
  assert.equal(result.rejoin,'prefixed');assert.deepEqual(result.route.path,[options.startCell,...route.path]);
  const retained={...route,path:[options.startCell,...route.path]};
  const again=rejoinSelectedUnitRoute(retained,{...options,radius:0,requiresRejoin:true});
  assert.deepEqual(again.route.path,[options.startCell,...retained.path],'existing leading waypoints are not filtered');
});

test('rejoin keeps null, empty, deferred, unreachable and arrived outcomes distinct without querying geometry or policy',()=>{
  const options={cellToWorld(){throw new Error('no synthesized center');},isWalkable(){throw new Error('no geometry');},
    acceptPrefix(){throw new Error('no prefix policy');},requiresRejoin:true};
  for(const route of [null,undefined,{path:null,originalPathLength:null},{path:undefined},{path:[]},
    {status:'ready',path:[]},{status:'deferred',path:[1],originalCost:null},
    {status:'unreachable',path:[],selectedGoalCell:-1},{status:'arrived',path:[],selectedGoalCell:7}]){
    const result=rejoinSelectedUnitRoute(route,options);assert.equal(result.rejoin,'unchanged');assert.equal(result.route,route);
  }
});

test('malformed rejoin geometry rejects without altering the selected route or querying occupancy',()=>{
  const {route,options}=selectedRouteFixture();
  for(const change of [{radius:NaN},{radius:-1},{radius:.51},{width:0},{height:1.5},{height:undefined},
    {startCell:-1},{startCell:3072},{position:{x:NaN,z:0}},{firstPoint:{x:0,z:Infinity}}]){
    const result=rejoinSelectedUnitRoute(route,{...options,...change,isWalkable(){throw new Error('invalid geometry');}});
    assert.equal(result.rejoin,'rejected');assert.equal(result.route,route);
  }
});

test('shared economy route fixture binds real clearance with centered geometry and rejects a body-unsafe shortcut',()=>{
  const bindings=workerFlowRouteBindings();
  assert.equal(bindings.LAND_CLEARANCE_PROFILE,LAND_CLEARANCE_PROFILE);
  assert.equal(bindings.canTraverseStaticBodySegment,canTraverseStaticBodySegment);
  assert.equal(bindings.activeLandMovementBodyRadius,activeLandMovementBodyRadius);
  assert.equal(bindings.MAP_HALF_X,bindings.MAP_WIDTH/2);
  assert.equal(bindings.MAP_HALF_Z,bindings.MAP_HEIGHT/2);
  for(let cell=0;cell<bindings.elevationLevelByCell.length;cell++){
    const point=bindings.cellToWorld(cell);
    assert.equal(bindings.worldToCell(point.x,point.z),cell);
    assert.ok(bindings.canTraverseStaticBodySegment(point,point,.18,bindings.MAP_WIDTH,bindings.MAP_HEIGHT,bindings.isWalkable));
  }
  const start=136,raw=[137,138,139,140],unit={x:.79,z:.95};
  const context=vm.createContext({...bindings,isWalkable:c=>bindings.isWalkable(c)&&c!==153});
  vm.runInContext(server.slice(server.indexOf('function workerFlowPath('),server.indexOf('function applyWorkerFlowRoute(')),context);
  assert.equal(bindings.canTraverseStaticBodySegment(unit,bindings.cellToWorld(raw.at(-1)),.18,16,16,context.isWalkable),false);
  assert.deepEqual([...context.workerFlowPath(unit,raw)],[start,...raw]);
  assert.deepEqual([...context.workerFlowPath({...unit,z:.5},raw)],[raw.at(-1)],'the open control still reduces the chosen route');
  assert.deepEqual(raw,[137,138,139,140]);
});

test('Worker economy clearance follows the live job, including node-free Return, and retires on interruption',()=>{
  const base={kind:'worker',hp:40,generation:9,orderRevision:2,gatherNodeId:'food',gatherForestCell:-1,
    gatherPhase:'to-node',buildingTargetId:null,attackTargetId:-1,attackBuildingTargetId:-1};
  for(const gatherPhase of ['to-node','gathering','to-base'])assert.equal(workerEconomyBodyRadius({...base,gatherPhase}),.18);
  assert.equal(workerEconomyBodyRadius({...base,gatherNodeId:null,gatherPhase:'to-base',cargo:.004}),.18);
  for(const change of [{kind:'infantry'},{hp:0},{movementDomain:'water'},{gatherPhase:''},{gatherPhase:'unknown'},
    {gatherNodeId:null},{holdingPosition:true},{attackMove:true},{stanceCombat:true},{stanceReturning:true},
    {persistentOrder:{type:'follow'}},{attackTargetId:0},{attackBuildingTargetId:0},{buildingTargetId:1}])
    assert.equal(workerEconomyBodyRadius({...base,...change}),0,JSON.stringify(change));
  assert.equal(activeLandMovementBodyRadius(base),.18);
});

test('Worker body-safe reduction and adjacent rejoin preserve the selected raw tail, cost, length and input arrays',()=>{
  const width=64,height=48,start=1568,raw=[1569,1570,1571,1572],levels=new Uint8Array(width*height);
  const unit={id:0,kind:'worker',generation:9,orderRevision:2,hp:40,x:.79,z:.95};
  const context=vm.createContext({LAND_CLEARANCE_PROFILE,MAP_WIDTH:width,MAP_HEIGHT:height,MAP_HALF_X:32,MAP_HALF_Z:24,
    elevationLevelByCell:levels,isWalkable:c=>c>=0&&c<width*height&&c!==1633,WALK_SPEED:2.6,STEP_SECONDS:1/30,
    shortcutFlatUnitPath,canTraverseStaticBodySegment,createUnitRouteResult,unitRouteResultIsCurrent,unitRoutePathCost,
    movePlanningEpoch:3,navigationRevision:4,
    worldToCell:(x,z)=>Math.floor(z+24)*width+Math.floor(x+32),
    cellToWorld:c=>({x:c%width-32+.5,z:Math.floor(c/width)-24+.5})});
  vm.runInContext(server.slice(server.indexOf('function workerFlowPath('),server.indexOf('function routeWorkerToDropoff(')),context);
  const result=context.applyWorkerFlowRoute(unit,start,{goal:999,goals:new Set([999,1572])},raw,false);
  assert.equal(result.status,'ready');assert.equal(result.selectedGoalCell,1572);assert.equal(unit.moveGoalCell,1572);
  assert.equal(result.originalPathLength,4);assert.equal(result.originalCost,unitRoutePathCost(start,raw,width,levels));
  assert.deepEqual([...result.path],[start,...raw]);assert.deepEqual(raw,[1569,1570,1571,1572]);
});

test('static circle sweeps reject a legal center grazing a tile, allow tangency and fail closed before malformed-grid queries', () => {
  const open = c => c !== 35;
  assert.equal(canTraverseStaticBodySegment({ x: .08, z: .12 }, { x: .001, z: .001 }, .22, 8, 8, open), false);
  assert.equal(canTraverseStaticBodySegment({ x: .22, z: .4 }, { x: .22, z: .6 }, .22, 8, 8, open), true);
  for (const [radius, w, h] of [[NaN, 8, 8], [-1, 8, 8], [.51, 8, 8], [.22, 0, 8], [.22, 8, 1.1]])
    assert.equal(canTraverseStaticBodySegment({ x: 0, z: 0 }, { x: .1, z: .1 }, radius, w, h,
      () => { throw new Error('malformed bounds must not query occupancy'); }), false);
});
test('an old overlapping pose may only escape monotonically in a bounded substep without introducing another penetration', () => {
  const a = { x: .05, z: .5 }, open = c => c !== 35;
  assert.equal(canTraverseStaticBodySegment(a, { x: .12, z: .5 }, .22, 8, 8, open), false);
  assert.equal(canTraverseStaticBodySegment(a, { x: .12, z: .5 }, .22, 8, 8, open, { allowEscape: true }), true);
  for (const b of [{ x: .01, z: .5 }, { x: .05, z: .6 }, { x: .4, z: .5 }])
    assert.equal(canTraverseStaticBodySegment(a, b, .22, 8, 8, open, { allowEscape: true }), false);
  assert.equal(canTraverseStaticBodySegment({ x: .4, z: .5 }, { x: .6, z: .5 }, .5, 8, 8,
    c => c !== 35 && c !== 37, { allowEscape: true }), false);
});
test('long planned320 rectangular sweeps query the route neighborhood instead of its bounding rectangle', () => {
  let queries = 0;
  assert.equal(canTraverseStaticBodySegment({ x: -159.5, z: -127.5 }, { x: 159.5, z: 127.5 }, .35,
    320, 256, () => { queries++; return true; }), true);
  assert.ok(queries < 16000 && queries < 320 * 256, `bounded route-neighborhood queries: ${queries}`);
});

test('route results preserve a selected multi-goal tail and weighted original cost', () => {
  const unit={generation:2,orderRevision:3}, levels=new Uint8Array(16);
  levels[1]=1;levels[2]=1;
  const path=[1,2,6], cost=unitRoutePathCost(0,path,4,levels);
  const result=createUnitRouteResult({unit,epoch:4,navigationRevision:5,startCell:0,path,originalCost:cost});
  assert.equal(result.selectedGoalCell,6);assert.equal(result.originalPathLength,3);
  assert.equal(result.originalCost,315);assert.equal(result.status,'ready');
  assert.equal(unitRoutePathCost(0,[15],4,new Uint8Array(16)),600,'flat direct representation retains cardinal graph cost');
  result.path=[6];assert.equal(result.originalPathLength,3);assert.equal(result.originalCost,315);
  assert.deepEqual(path,[1,2,6],'normalization cannot mutate the original field path');
});

test('empty routes distinguish physical arrival, final approach, failure and deferred work', () => {
  const common={unit:{orderRevision:1},epoch:0,navigationRevision:1,startCell:7,originalCost:0};
  const arrived=createUnitRouteResult({...common,path:[],startIsGoal:true,arrived:true});
  assert.equal(arrived.status,'arrived');assert.deepEqual(arrived.path,[]);assert.equal(arrived.selectedGoalCell,7);
  const approach=createUnitRouteResult({...common,path:[],startIsGoal:true,arrived:false});
  assert.equal(approach.status,'ready');assert.deepEqual(approach.path,[7]);assert.equal(approach.originalPathLength,0);
  const failure=createUnitRouteResult({...common,path:[]});
  assert.equal(failure.status,'unreachable');assert.equal(failure.selectedGoalCell,-1);assert.equal(failure.originalCost,null);
  const deferred=createUnitRouteResult({...common,path:null,startIsGoal:true,arrived:true});
  assert.equal(deferred.status,'deferred');assert.equal(deferred.selectedGoalCell,-1);assert.equal(deferred.originalPathLength,null);
});
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
  const context = vm.createContext({units,UNIT_DEFINITIONS,activeWallBuildOrder,MAP_WIDTH:width,MAP_HEIGHT:width,MAP_HALF_X:half,MAP_HALF_Z:half,
    militaryCombatant: unit => unit.kind !== 'worker', automaticPositionAllowed: () => true,
    STEP_SECONDS:1/30,MIN_SEPARATION:.56,SPATIAL_BUCKET_SIZE:bucketSize,WALK_SPEED:2.6,
    WORKER_INTERACTION_RANGE:1.4,BUILDER_INTERACTION_RANGE:1.4,
    spatialBucketColumns:bucketColumns,spatialBucketRows:bucketColumns,spatialBucketHeads:heads,
    spatialBucketNext:next,spatialBucketTeamHeads:teamHeads,spatialBucketTeamCounts:teamCounts,
    spatialBucketTeamNext:teamNext,spatialBucketOfUnit:bucketOf,
    spatialBucketColumn:x=>Math.max(0,Math.min(bucketColumns-1,Math.floor((x+half)/bucketSize))),
    spatialBucketRow:z=>Math.max(0,Math.min(bucketColumns-1,Math.floor((z+half)/bucketSize))),
    elevationLevelByCell:levels,canTraverseUnitStep,activeLandMovementBodyRadius,workerEconomyBodyRadius,LAND_CLEARANCE_PROFILE,canTraverseStaticBodySegment,createClearanceMoveGoalPoint,rejoinSelectedUnitRoute,
    canTraverseFlatUnitSegment,findStationaryWorkerDetour,SEPARATION_DIAGNOSTICS_ENABLED:false,
    createUnitRoutePublicationLedger, MAX_UNITS:2000, MAX_RESOURCE_NODES:128, XL_CHECKPOINT_ROUTE_MAX_ENTRIES,
    tickDiagnosticSamples:null, landRouteRetentionTick:null,
    tickNumber:1,dirty:false,worldToCell:cell,cellToWorld:point,isWalkable:walkable,
    resourceNodeStates:new Map([['berries',{x,z:-1,hp:1}]]),buildingsById:new Map(),farmHarvestNode,farmBuildingId,
    enqueueRouteRepairs:list=>repairs.push(...list),spreadInteractingUnits(){},advanceQueuedWaypoints(){},updateWildlifeMotion(){}});
  vm.runInContext(server.slice(server.indexOf('function harvestNodeById('),server.indexOf('function routeWorker(')),context);
  vm.runInContext(server.slice(server.indexOf('function getMoveVector('),server.indexOf('// Units stop following paths')),context);
  const movementStart=server.indexOf('  const blockedRouteRepairs = [];');
  const movementEndMarker='  advanceQueuedWaypoints();';
  const movementEnd=server.indexOf(movementEndMarker,movementStart);
  assert.ok(movementStart>=0&&movementEnd>movementStart,'real simulation movement source boundaries');
  const movement=server.slice(movementStart,movementEnd+movementEndMarker.length);
  vm.runInContext(`function moveOneTick(){${movement}}`,context);
  if(realRepairs){
    Object.assign(context,{nearestOpenCell:c=>walkable(c)?c:-1,performance,TICK_RATE:30,
      createUnitRouteResult,unitRouteResultIsCurrent,navigationRevision:0,nextMoveOrderId:1,movePlanningEpoch:0,movePlanningQueue:[],activeMovePlanningJob:null,
      movePlanningServiceTick:null,
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
    assignment.path=[27,28];
    assignment.routeResult=createUnitRouteResult({unit:f.mover,revision:assignment.revision,epoch:0,navigationRevision:0,startCell:26,path:assignment.path}); // Known legal cardinal return, delivered through real assignment application.
    assert.equal(f.context.applyPlannedMoveAssignment(job,assignment),true);
    assert.equal(f.mover.attackMoveRouteReady,true);assert.equal(f.mover.movePlanningPending,false);
    for(let tick=0;tick<100&&f.mover.pathIndex<f.mover.path.length;tick++)f.move();
    assert.equal(f.mover.pathIndex,f.mover.path.length);assert.deepEqual({x:f.mover.x,z:f.mover.z},point(28));
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

test('cell-only route repair records its accepted destination before any route publishes', () => {
  for (const previousGoal of [-1, 27]) {
    const f = fixture({ cliff: false, realRepairs: true });
    f.mover.moveGoalCell = previousGoal;
    f.context.enqueueRouteRepairs([{ unit: f.mover, destination: 29 }]);
    const assignment = f.context.movePlanningQueue[0].assignments[0];
    assert.equal(f.mover.moveGoalCell, assignment.destination);
    assert.equal(f.mover.moveGoalCell, 29);
    assert.equal(f.mover.movePlanningPending, true);
    assert.equal(f.mover.path.length, 0);
    assert.equal(f.mover.moveGoalPoint, undefined);
    assert.equal(f.mover.buildingTargetId, null);
    assert.equal(f.mover.orderRevision, 1);
  }
});

test('the shared land step contract rejects malformed grids before querying occupancy', () => {
  for (const [width, count] of [[Infinity, 8], [-8, 8], [1.5, 8], [3, 8], [0, 8], [8, 0]]) {
    assert.equal(canTraverseUnitStep(0, 0, width, new Uint8Array(count), () => {
      assert.fail('invalid dimensions must not query occupancy');
    }), false, `${width} columns / ${count} cells`);
  }
});

test('rectangular and planned320 grids retain corner, slope and row-wrap legality', () => {
  // The 320 case exercises index arithmetic only; it does not admit an XL map.
  for (const [width, height] of [[16, 17], [160, 160], [256, 256], [320, 320]]) {
    const levels = new Uint8Array(width * height), start = width * 2 + 2;
    const blocked = new Set(), walkable = cell => !blocked.has(cell);
    for (const offset of [-width-1, -width, -width+1, -1, 0, 1, width-1, width, width+1]) {
      assert.equal(canTraverseUnitStep(start, start+offset, width, levels, walkable), true);
      levels[start+offset] = 1;
      assert.equal(canTraverseUnitStep(start, start+offset, width, levels, walkable), true);
      levels[start+offset] = 0;
    }
    levels[start+width+1] = 2;
    assert.equal(canTraverseUnitStep(start, start+width+1, width, levels, walkable), false);
    levels[start+width+1] = 0; blocked.add(start+1);
    assert.equal(canTraverseUnitStep(start, start+width+1, width, levels, walkable), false);
    assert.equal(canTraverseUnitStep(width-1, width, width, levels, walkable), false);
  }
});

const landExecutionPolicies = [
  ['manual Move', 'infantry', {}],
  ['queued Move', 'scout', { queuedWaypoints: [{ destination: 29, attackMove: false }] }],
  ['building approach', 'worker', { buildingTargetId: 7 }],
  ['repair approach', 'worker', { buildingTargetId: 7, repairing: true }],
  ['gather approach', 'worker', { gatherNodeId: 'berries', gatherPhase: 'gathering' }],
  ['drop-off approach', 'worker', { gatherNodeId: 'berries', gatherPhase: 'returning', carriedFood: 10 }],
  ['return to resource', 'worker', { gatherNodeId: 'berries', gatherPhase: 'gathering', carriedFood: 0 }],
  ['Patrol continuation', 'infantry', { persistentOrder: { type: 'patrol' } }],
  ['Follow continuation', 'rider', { persistentOrder: { type: 'follow' } }],
  ['Attack-move route', 'archer', { attackMove: true, attackMoveRouteReady: true }],
  ['unit pursuit', 'spearman', { attackTargetId: 1, lastAttackCell: 28, repathTimer: 2 }],
  ['building firing approach', 'siege-engine', { attackBuildingTargetId: 7, lastAttackCell: 28, repathTimer: 2 }],
  ['stance return', 'infantry', { stanceReturning: true }],
];
for (const [label, kind, policy] of landExecutionPolicies) {
  test(`${label}: the production land executor retains intent after an illegal deflected step`, () => {
    // Inject accepted route state into the real executor. Command admission,
    // target selection, full journeys and naval execution require other tests.
    for (const team of [0, 1]) for (const terrain of ['cliff', 'corner']) {
      const f = fixture({ kind, x: -.01, z: .001, cliff: false });
      Object.assign(f.mover, { team, gatherNodeId: null, gatherPhase: '', ...structuredClone(policy) });
      for (const other of f.units.slice(1)) other.hp = 0;
      if (terrain === 'cliff') { f.levels[27] = 1; f.levels[35] = 2; }
      else f.blockedCells.add(36);
      const before = structuredClone(f.mover), queue = f.mover.queuedWaypoints;
      f.move();
      assert.deepEqual({ x: f.mover.x, z: f.mover.z }, { x: before.x, z: before.z });
      assert.equal(f.mover.lastMoveTick, before.lastMoveTick);
      assert.equal(f.mover.orderRevision, before.orderRevision);
      assert.equal(f.mover.queuedWaypoints, queue);
      for (const key of Object.keys(policy).filter(key => !['lastAttackCell', 'repathTimer', 'queuedWaypoints'].includes(key))) {
        assert.deepEqual(f.mover[key], before[key], `${terrain} retains ${key}`);
      }
      if (before.attackTargetId >= 0 || before.attackBuildingTargetId >= 0) {
        assert.equal(f.mover.path.length, 0);
        assert.equal(f.mover.lastAttackCell, -1); assert.equal(f.mover.repathTimer, 0);
        assert.equal(f.repairs.length, 0, 'pursuit retains its own replanning policy');
      } else {
        assert.equal(f.repairs.length, 1); assert.equal(f.repairs[0].destination, before.moveGoalCell);
      }
    }
  });
}
