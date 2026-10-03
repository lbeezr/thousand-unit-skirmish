import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { canTraverseUnitStep } from '../src/unit-movement.mjs';
import { UNIT_DEFINITIONS } from '../src/gameplay-definitions.mjs';

const server = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
const width = 8, half = width / 2, bucketSize = 1.2, bucketColumns = 7;
const cell = (x,z) => Math.floor(z+half)*width+Math.floor(x+half);
const point = c => ({x:c%width-half+.5,z:Math.floor(c/width)-half+.5});
function fixture({kind='infantry',x=-.5,z=-.01,cliff=true,blocked=[]} = {}) {
  const mover = {id:0,team:0,hp:100,kind,x,z,path:[28],pathIndex:0,
    attackTargetId:-1,attackBuildingTargetId:-1,holdingPosition:false,
    gatherForestCell:-1,gatherNodeId:'berries',gatherPhase:'gathering'};
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
  const context = vm.createContext({units,UNIT_DEFINITIONS,MAP_WIDTH:width,MAP_HALF_X:half,MAP_HALF_Z:half,
    STEP_SECONDS:1/30,MIN_SEPARATION:.56,SPATIAL_BUCKET_SIZE:bucketSize,WALK_SPEED:2.6,
    WORKER_INTERACTION_RANGE:1.4,BUILDER_INTERACTION_RANGE:1.4,
    spatialBucketColumns:bucketColumns,spatialBucketRows:bucketColumns,spatialBucketHeads:heads,
    spatialBucketNext:next,spatialBucketTeamHeads:teamHeads,spatialBucketTeamCounts:teamCounts,
    spatialBucketTeamNext:teamNext,spatialBucketOfUnit:bucketOf,
    spatialBucketColumn:x=>Math.max(0,Math.min(bucketColumns-1,Math.floor((x+half)/bucketSize))),
    spatialBucketRow:z=>Math.max(0,Math.min(bucketColumns-1,Math.floor((z+half)/bucketSize))),
    elevationLevelByCell:levels,canTraverseUnitStep,SEPARATION_DIAGNOSTICS_ENABLED:false,
    tickNumber:1,dirty:false,worldToCell:cell,cellToWorld:point,isWalkable:walkable,
    resourceNodeStates:new Map([['berries',{x,z:-1,hp:1}]]),buildingsById:new Map(),
    enqueueRouteRepairs:list=>repairs.push(...list),spreadInteractingUnits(){},advanceQueuedWaypoints(){}});
  vm.runInContext(server.slice(server.indexOf('function getMoveVector('),server.indexOf('// Units stop following paths')),context);
  const movement=server.slice(server.indexOf('  const blockedRouteRepairs = [];'),
    server.indexOf('\n}\n\nfunction encodeWebSocketFrame'));
  vm.runInContext(`function moveOneTick(){${movement}}`,context);
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
