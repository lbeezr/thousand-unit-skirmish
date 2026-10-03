import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';
import { PATHING_BASELINE_CASES, pathingBaselineMap } from './pathing-baseline-cases.mjs';
import { canTraverseUnitStep } from '../src/unit-movement.mjs';

// This process is a disposable diagnostic, never a match/checkpoint host.
process.env.RTS_MAP = 'maps/open-field.json';
process.env.RTS_GAME_MODE = 'pvp'; process.env.RTS_PREGAME = '0';
process.env.RTS_TICK_DIAGNOSTICS = '1'; process.env.RTS_SEPARATION_DIAGNOSTICS = '1';
delete process.env.RTS_MATCH_STATE_PATH;
const selection = process.argv[2] ?? 'all', repeats = Number(process.argv[3] ?? 2);
const maxTicks = Number(process.argv[4] ?? 2700);
assert.ok(Number.isInteger(repeats) && repeats >= 1 && repeats <= 3);
assert.ok(Number.isInteger(maxTicks) && maxTicks >= 300 && maxTicks <= 5400);
const cases = selection === 'all' ? PATHING_BASELINE_CASES
  : PATHING_BASELINE_CASES.filter(c => `${c.kind}-${c.group}` === selection);
assert.ok(cases.length, 'unknown pathing case');
const quantiles = values => {
  const sorted = values.toSorted((a,b) => a-b);
  return Object.fromEntries([['p50',.5],['p95',.95],['max',1]].map(([key,q]) =>
    [key,Number(sorted[Math.max(0,Math.ceil(sorted.length*q)-1)].toFixed(3))]));
};
const canonical = units => units.map(u => [u.id,u.team,u.kind,u.x,u.z,u.hp,u.moveGoalCell,
  u.pathIndex,u.path,u.orderRevision,u.movePlanningPending]);
function remainingDistance(r,u) {
  let x=u.x,z=u.z,distance=0;
  for(let i=u.pathIndex;i<u.path.length;i++) {
    const p=r.point(u.path[i]);distance+=Math.hypot(p.x-x,p.z-z);x=p.x;z=p.z;
  }
  return distance;
}
const records=[];
for(const spec of cases) {
  const runs=[];
  for(let repeat=0;repeat<repeats;repeat++) {
    const map=pathingBaselineMap(spec),fixture=await createPathingReplayFixture(map),r=fixture.replay;
    try {
      const team=spec.team??0;
      const selected=r.units.filter(u=>u.team===team&&u.kind==='infantry');
      assert.equal(selected.length,spec.group);
      const notices=r.order(team,{type:'move',ids:selected.map(u=>u.id),
        unitGenerations:selected.map(u=>u.generation),x:team?-16.5:16.5,z:.5,clientOrderToken:1});
      r.drain();assert.ok(notices.some(n=>n.message.startsWith('MOVE ORDER')));
      // Later repairs can evict the initial order from the server's 32-sample
      // diagnostic window. Retain its operation counts before ticking.
      const initialPlanning={...r.planning.at(-1)};
      const initialPaths=selected.map(u=>({id:u.id,goal:u.moveGoalCell,path:u.path.slice()}));
      const progress=new Map(selected.map(u=>[u.id,{best:remainingDistance(r,u),tick:0,
        revision:u.orderRevision,maxStall:0,flagged:false,episodes:0,recovered:0}]));
      const trace=createHash('sha256'),timings=[],simulation=[],samples=[],events=[];
      let invalidSteps=0,unreachableGoals=0,arrived=0,firstArrival=null,obstruction=null;
      for(let tick=0;tick<maxTicks;tick++) {
        if(tick===15&&spec.kind.startsWith('dynamic-')) {
          const worker=r.units.find(u=>u.team===0&&u.kind==='worker');
          const before=r.navigationRevision;
          const response=r.order(0,{type:'build',ids:[worker.id],unitGenerations:[worker.generation],
            buildingType:'house',x:spec.kind==='dynamic-goal'?16.5:-10.5,z:.5,clientOrderToken:2});
          r.drain();
          assert.ok(response.some(n=>n.message.startsWith('BUILD ORDER')),JSON.stringify(response));
          obstruction=r.buildings.at(-1);
          events.push({tick:r.tick,type:'paid-house',footprint:obstruction.footprint.slice(),
            navigationRevision:r.navigationRevision,revisionChanged:r.navigationRevision>before,
            repairedUnits:selected.filter(u=>u.orderRevision>1).length});
        }
        if(tick===15&&spec.kind==='disconnect-rejection') {
          const worker=r.units.find(u=>u.team===0&&u.kind==='worker');
          const response=r.order(0,{type:'build',ids:[worker.id],buildingType:'palisade-wall',
            x:.5,z:.5,clientOrderToken:2});
          assert.ok(response.some(n=>n.message==='BUILD REJECTED · WOULD BLOCK A ROUTE'),JSON.stringify(response));
          events.push({tick:r.tick,type:'disconnect-rejected',navigationRevision:r.navigationRevision});
        }
        const previous=selected.map(u=>r.cell(u.x,u.z));
        r.step();timings.push(r.diagnostic.durationMs);simulation.push(r.diagnostic.simulationMs);
        trace.update(JSON.stringify(canonical(selected))+'\n');
        arrived=0;
        for(let i=0;i<selected.length;i++) {
          const u=selected[i],cell=r.cell(u.x,u.z),goal=r.point(u.moveGoalCell),p=progress.get(u.id);
          if(!canTraverseUnitStep(previous[i],cell,map.width,r.levels,r.isWalkable))invalidSteps++;
          if(r.components[cell]!==r.components[u.moveGoalCell]||r.components[cell]<0)unreachableGoals++;
          const remaining=remainingDistance(r,u);
          if(u.orderRevision!==p.revision||remaining<p.best-.05) {
            if(p.flagged){p.recovered++;p.flagged=false;}
            p.best=remaining;p.tick=r.tick;p.revision=u.orderRevision;
          }
          const done=!u.movePlanningPending&&u.pathIndex===u.path.length&&Math.hypot(u.x-goal.x,u.z-goal.z)<.02;
          if(done) {arrived++;if(p.flagged){p.recovered++;p.flagged=false;}}
          else {
            const stalled=r.tick-p.tick;p.maxStall=Math.max(p.maxStall,stalled);
            if(stalled>=150&&!p.flagged){p.episodes++;p.flagged=true;}
          }
        }
        if(arrived&&firstArrival===null)firstArrival=r.tick;
        if(r.tick%150===0)samples.push({tick:r.tick,arrived,
          noProgress150Ticks:[...progress.values()].filter(p=>p.flagged).length});
        if(arrived===selected.length)break;
      }
      const stalled=selected.filter(u=>{
        const goal=r.point(u.moveGoalCell);return u.movePlanningPending||u.pathIndex<u.path.length||Math.hypot(u.x-goal.x,u.z-goal.z)>=.02;
      }).map(u=>({id:u.id,x:u.x,z:u.z,goal:u.moveGoalCell,pathIndex:u.pathIndex,pathLength:u.path.length,
        pending:u.movePlanningPending,reachable:r.components[r.cell(u.x,u.z)]===r.components[u.moveGoalCell],
        remainingDistance:remainingDistance(r,u),progress:progress.get(u.id)}));
      assert.equal(invalidSteps,0);assert.equal(unreachableGoals,0);
      runs.push({sourceSha256:fixture.sourceSha256,traceSha256:trace.digest('hex'),
        initialRouteSha256:createHash('sha256').update(JSON.stringify(initialPaths)).digest('hex'),
        ticks:r.tick,arrived,firstArrival,stalled,events,samples,
        tickMs:quantiles(timings),simulationMs:quantiles(simulation),initialPlanning,
        planning:r.planning.map(p=>({mode:p.mode,unitCount:p.unitCount,searchCount:p.searchCount,
          expandedCells:p.expandedCells,maxPlanningSliceMs:p.maxPlanningSliceMs,
          planningSliceCount:p.planningSliceCount,maxPlanningSliceWorkItems:p.maxPlanningSliceWorkItems,
          maxPlanningSliceExpandedCells:p.maxPlanningSliceExpandedCells})),
        separation:r.separation,invalidSteps,unreachableGoals,
        maxNoProgressTicks:Math.max(...[...progress.values()].map(p=>p.maxStall)),
        noProgressEpisodes:[...progress.values()].reduce((n,p)=>n+p.episodes,0),
        recoveredEpisodes:[...progress.values()].reduce((n,p)=>n+p.recovered,0)});
    } finally {await fixture.dispose();}
  }
  assert.ok(runs.every(r=>r.traceSha256===runs[0].traceSha256),'fixed-tick replay differs');
  records.push({...spec,deterministicReplay:repeats>1,runs});
  console.log(JSON.stringify({...spec,ticks:runs.map(r=>r.ticks),arrived:runs.map(r=>r.arrived),
    maxNoProgressTicks:runs[0].maxNoProgressTicks,deterministicReplay:repeats>1}));
}
const report={head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  node:process.version,cpu:os.cpus()[0].model,platform:process.platform,maxTicks,records,
  limits:['canonical replay drains real planning callbacks between ticks; excludes asynchronous planning/movement interleaving',
    'real server tick bodies, no peers or checkpoint writes; transport/rendering and wall-clock scheduler capacity excluded',
    'cloud host not isolated; timings observational, no comparable hardware speedup or supported-capacity claim']};
if(process.env.PATHING_BASELINE_RECORD)await writeFile(process.env.PATHING_BASELINE_RECORD,JSON.stringify(report,null,2)+'\n');
