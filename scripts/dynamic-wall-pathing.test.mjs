import test from 'node:test';
import assert from 'node:assert/strict';
import {runDynamicWallCase} from './dynamic-wall-pathing.mjs';
import {runQueuedGateCase} from './queued-gate-pathing.mjs';
for(const team of [0,1])for(const mode of ['active-route','queued-target','queued-removal'])
  test(`seat ${team}: paid wall ${mode} preserves distinct reachable formation destinations`,async()=>{
    const r=await runDynamicWallCase({team,mode});
    assert.equal(r.distinctGoals,64);
  });
for(const team of [0,1])test(`seat ${team}: closing paid gate preserves distinct queued formation destinations`,async()=>{
  const r=await runQueuedGateCase({team,observePauses:true});assert.equal(r.distinctGoals,64);
  assert.equal(r.pauseObservations.length,8);
  assert.ok(r.pauseObservations.every(row=>row.id>=team*68&&row.id<(team+1)*68));
  assert.ok(r.pauseObservations.every(row=>Object.keys(row).join('|')==='id|holding|planningPending|performingAction|routeActive|decision|admission|positionChanged'));
  assert.ok(r.pauseObservations.every(row=>['vector-wait','vector-proposal','static-proposal-rejected','no-vector-proposal','unobserved'].includes(row.decision)&&!row.routeActive),'terminal route state is separate from the last vector decision');
  assert.ok(r.maxPathLength<160,'returned builder does not cause repeated local detour growth');
});
