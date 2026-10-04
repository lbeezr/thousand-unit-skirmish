// Fixed accepted-tick replay and observational cost comparison, never a match host.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';
import { pathingBaselineMap } from './pathing-baseline-cases.mjs';
import { canTraverseUnitStep } from '../src/unit-movement.mjs';
import { arrivedAtMoveGoal } from './pathing-arrival.mjs';

process.env.RTS_MAP='maps/open-field.json';process.env.RTS_GAME_MODE='pvp';process.env.RTS_PREGAME='0';
process.env.RTS_TICK_DIAGNOSTICS='1';delete process.env.RTS_MATCH_STATE_PATH;
const limits=(process.argv[2]??'0,1,4,8').split(',').map(Number);
assert.ok(limits.length<=4&&limits.every(n=>[0,1,4,8].includes(n)));
const repeats=Number(process.argv[3]??2);assert.ok(repeats===1||repeats===2);
const quantiles=values=>{
  const a=values.toSorted((x,y)=>x-y),at=q=>a.length?a[Math.max(0,Math.ceil(a.length*q)-1)]:null;
  return {count:a.length,p50:at(.5),p95:at(.95),max:at(1)};
};
const rows=army=>army.map(u=>[u.id,u.x,u.z,u.orderRevision,u.moveGoalCell,u.pathIndex,u.path,u.movePlanningPending]);
const cases=[{group:996,kind:'large-single-choke',team:0},
  {group:996,kind:'large-single-choke',team:1},{group:64,kind:'s-bend',team:0}];
const records=[];
for(const turnsPerTick of limits)for(const spec of cases) {
  const runs=[];
  for(let repeat=0;repeat<repeats;repeat++) {
    process.env.RTS_MOVE_PLANNING_TURNS_PER_TICK=String(turnsPerTick);
    const map=pathingBaselineMap(spec),fixture=await createPathingReplayFixture(map),r=fixture.replay;
    delete process.env.RTS_MOVE_PLANNING_TURNS_PER_TICK;
    try {
      const army=r.units.filter(u=>u.team===spec.team&&u.kind==='infantry'),sign=spec.team?-1:1;
      const notices=r.order(spec.team,{type:'move',ids:army.map(u=>u.id),
        unitGenerations:army.map(u=>u.generation),x:sign*16.5,z:.5,clientOrderToken:1});
      const acceptedAtTick=r.tick,trace=createHash('sha256'),tickCosts=[],planningCosts=[],
        movementStarted=new Map(),routeCommitted=new Map();
      const start=army.map(u=>[u.x,u.z]);let illegalSteps=0,disconnectedGoals=0;
      if(turnsPerTick===0)r.drain();
      let initialJob=r.planning.find(p=>p.team===spec.team&&p.unitCount===spec.group);
      for(let step=0;step<3500;step++) {
        for(const u of army)if(!u.movePlanningPending&&!routeCommitted.has(u.id))routeCommitted.set(u.id,r.tick);
        const previous=army.map(u=>r.cell(u.x,u.z));r.step();
        initialJob??=r.planning.find(p=>p.team===spec.team&&p.unitCount===spec.group);
        tickCosts.push(r.diagnostic.durationMs);
        if(r.diagnostic.planningTurns>0)planningCosts.push(r.diagnostic.planningMs);
        trace.update(JSON.stringify(rows(army))+'\n');
        for(const [index,u] of army.entries()) {
          if(!u.movePlanningPending&&!routeCommitted.has(u.id))routeCommitted.set(u.id,r.tick);
          if(!movementStarted.has(u.id)&&(u.x!==start[index][0]||u.z!==start[index][1]))movementStarted.set(u.id,r.tick);
          const cell=r.cell(u.x,u.z);
          if(!canTraverseUnitStep(previous[index],cell,map.width,r.levels,r.isWalkable))illegalSteps++;
          if(r.components[cell]!==r.components[u.moveGoalCell])disconnectedGoals++;
        }
        if(army.every(u=>arrivedAtMoveGoal(u,r.point(u.moveGoalCell))))break;
      }
      assert.equal(illegalSteps,0);assert.equal(disconnectedGoals,0);
      assert.ok(army.every(u=>arrivedAtMoveGoal(u,r.point(u.moveGoalCell))),
        'bounded run must finish at every assigned goal, including cleared/empty paths');
      assert.ok(notices.some(n=>n.message===`MOVE ORDER · ${spec.group} UNITS`));
      assert.equal(routeCommitted.size,spec.group);assert.equal(movementStarted.size,spec.group);
      runs.push({sourceSha256:fixture.sourceSha256,acceptedAtTick,arrivalTick:r.tick,
        firstRouteTick:Math.min(...routeCommitted.values()),lastRouteTick:Math.max(...routeCommitted.values()),
        firstMovementTick:Math.min(...movementStarted.values()),lastMovementTick:Math.max(...movementStarted.values()),
        traceSha256:trace.digest('hex'),illegalSteps,disconnectedGoals,
        tickCostMs:quantiles(tickCosts),planningTickCostMs:quantiles(planningCosts),initialJob});
    }finally{await fixture.dispose();}
  }
  assert.ok(runs.every(r=>r.traceSha256===runs[0].traceSha256),'candidate replay must repeat exactly');
  records.push({turnsPerTick,...spec,runs});
  console.error(JSON.stringify({turnsPerTick,...spec,arrival:runs[0].arrivalTick,
    lastRouteTick:runs[0].lastRouteTick,planningCost:runs[0].planningTickCostMs}));
}
const report={schemaVersion:1,head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  node:process.version,records,limits:['fixed accepted-tick real-body replay, no socket or renderer',
    'default replay drains callbacks before ticks; its planning cost is outside tick timing',
    'fresh generation tokens normalized by actor ID in movement-state hashes',
    'shared cloud host, sequential warmup/JIT effects; timings observational, no hardware capacity claim']};
if(process.env.MOVE_PLANNING_BUDGET_RECORD)await writeFile(process.env.MOVE_PLANNING_BUDGET_RECORD,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
