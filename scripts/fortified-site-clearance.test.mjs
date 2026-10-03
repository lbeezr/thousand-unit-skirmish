import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {clearAndBuildFortifiedSite, fortifiedSiteOccupants} from './fortified-site-clearance.mjs';

const row=(id,team=0,generation=1)=>[id,team,team?18.5:-18.5,-3.5,100,'infantry',0,null,generation];
function fixture(states,notices=['BUILD ORDER · 2 WORKERS']){
  let elapsed=0,index=0;const moves=[],builds=[];
  return {moves,builds,options:{team:0,now:()=>elapsed,sleep:async ms=>{elapsed+=ms;index++;},
    state:async()=>({units:states[Math.min(index,states.length-1)]}),
    move:async units=>moves.push(units.map(u=>`${u[0]}:${u[8]}`)),
    build:async()=>{builds.push(elapsed);return {message:notices.shift()};}}};
}

test('late arrivals are redirected once each instead of refilling the site indefinitely',async()=>{
  const f=fixture([[row(1)],[row(1),row(2)],[row(2)],[]]);
  const result=await clearAndBuildFortifiedSite(f.options);
  assert.deepEqual(f.moves,[['1:1'],['2:1']]);assert.equal(f.builds.length,1);
  assert.equal(result.redirected,2);assert.equal(result.moveOrders,2);
});

test('placement retries a raced arrival and preserves other errors',async()=>{
  const f=fixture([[],[row(2)],[]],['BUILD REJECTED · UNITS IN FOOTPRINT','BUILD ORDER · 2 WORKERS']);
  const result=await clearAndBuildFortifiedSite(f.options);
  assert.equal(result.occupancyRetries,1);assert.deepEqual(f.moves,[['2:1']]);
  const rejected=fixture([[]],['BUILD REJECTED · WOULD BLOCK A ROUTE']);
  await assert.rejects(clearAndBuildFortifiedSite(rejected.options),/WOULD BLOCK A ROUTE/);
});

test('a blocked evacuation remains bounded and reused generations are distinct',async()=>{
  const stalled=fixture([[row(1)]]);stalled.options.timeoutMs=1500;
  await assert.rejects(clearAndBuildFortifiedSite(stalled.options),/timed out: 1 occupants/);
  assert.equal(stalled.moves.length,1,'pending movement is not continually replaced');
  const reused=fixture([[row(1,0,1)],[row(1,0,2)],[]]);
  await clearAndBuildFortifiedSite(reused.options);
  assert.deepEqual(reused.moves,[['1:1'],['1:2']]);
});

test('site selection respects both seats and conservatively covers rounded footprint edges',()=>{
  const worker=row(2);worker[5]='worker';const dead=row(3);dead[4]=0;
  const edge=row(4);edge[2]=-20;
  const state={units:[row(1),worker,dead,edge,row(5,1)]};
  assert.deepEqual(fortifiedSiteOccupants(state,0).map(u=>u[0]),[1,4]);
  assert.deepEqual(fortifiedSiteOccupants(state,1).map(u=>u[0]),[5]);
});

test('the real 2000-unit destination box overlaps the future site; the 1000 box does not',()=>{
  const server=readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
  const context=vm.createContext({MAP_WIDTH:80,MAP_HEIGHT:64,cellIndex:(x,z)=>z*80+x});
  vm.runInContext(server.slice(server.indexOf('function buildFormationSlots('),
    server.indexOf('function nearestBuilderAccessCell(')),context);
  for(const size of [1000,2000]){
    for(const team of [0,1]){
      const centerColumn=team?52:27,centerRow=42;
      const selected=new Array((size-4)/2-4).fill(null);
      const layout=context.buildFormationSlots(selected,centerRow*80+centerColumn,'box');
      const rows=Array.from(layout.slots,c=>[c,team,c%80-40+.5,Math.floor(c/80)-32+.5,100,'infantry']);
      assert.equal(fortifiedSiteOccupants({units:rows},team).length,size===2000?9:0);
    }
  }
});
