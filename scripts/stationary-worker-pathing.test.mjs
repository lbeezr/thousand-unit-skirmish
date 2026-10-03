import assert from 'node:assert/strict';
import test from 'node:test';
import { findStationaryWorkerDetour } from '../src/unit-obstacle-detour.mjs';
import { canTraverseUnitStep } from '../src/unit-movement.mjs';
import { runQueuedGateCase } from './queued-gate-pathing.mjs';

const width=8,levels=new Uint8Array(64);
const cell=(x,z)=>Math.floor(z+4)*width+Math.floor(x+4);
const point=c=>({x:c%width-3.5,z:Math.floor(c/width)-3.5});
function detour({x=-.6,z=-.5,path=[27,28,29],blocked=[]}={}) {
  const blocker={x:-.5,z:-.5,holdingPosition:true,orderRevision:7},unit={x,z,path,pathIndex:0};
  const before=structuredClone({unit,blocker}),walkable=c=>!blocked.includes(c);
  const result=findStationaryWorkerDetour(unit,blocker,width,levels,walkable,point,cell);
  assert.deepEqual({unit,blocker},before,'helper does not mutate either command or position');
  if(result) {
    let from=cell(x,z);
    for(const to of result.path){assert.notEqual(to,27);assert.ok(canTraverseUnitStep(from,to,width,levels,walkable));from=to;}
    assert.equal(result.path.at(-1),path[result.replaceCount-1],'rejoin original route');
    assert.ok(result.path.length<=24,'bounded cardinal detour');
  }
  return result;
}
test('occupied intermediate center takes a legal detour and retains the later goal',()=>{
  const r=detour();assert.ok(r);assert.equal(r.replaceCount,2);
});
test('already inside occupied cell, movement detours instead of crossing the Worker head on',()=>{
  const r=detour({path:[28,29],blocked:[35,36]});assert.ok(r);assert.equal(r.replaceCount,1);
  const p=point(r.path[0]);assert.ok(p.x<=-.5,'first step stays on mover side of blocker');
});
test('occupied final target and a route already going away are preserved',()=>{
  assert.equal(detour({path:[27]}),null);
  assert.equal(detour({path:[26,25]}),null);
});
test('no local passage falls back, with no corner or cliff shortcut',()=>{
  const blocked=Array.from({length:64},(_,c)=>c).filter(c=>Math.floor(c/width)!==3);
  assert.equal(detour({blocked}),null);
  for(const c of [19,35,26])levels[c]=2;
  assert.equal(detour(),null);levels.fill(0);
});
test('map edges reject row wrapping during a local detour',()=>{
  const unit={x:3.4,z:-.5,path:[31,30],pathIndex:0},blocker={x:3.5,z:-.5};
  const r=findStationaryWorkerDetour(unit,blocker,width,levels,()=>true,point,cell);assert.ok(r);
  let from=cell(unit.x,unit.z);for(const to of r.path){assert.ok(canTraverseUnitStep(from,to,width,levels,()=>true));from=to;}
});
for(const team of [0,1])for(const parkOrder of [null,'stop','holdPosition'])
  test(`seat ${team}: parked ${parkOrder??'idle'} builder remains fixed while 64 queued units arrive`,async()=>{
    const r=await runQueuedGateCase({team,returnBuilder:false,parkOrder});
    assert.equal(r.arrived,64);assert.equal(r.distinctGoals,64);assert.equal(r.parkedIntentPreserved,true);
  });
