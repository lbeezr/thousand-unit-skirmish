import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { assertCargoConserved, runQueuedCargoReturn } from './queued-cargo-return-case.mjs';

for (const team of [0, 1]) test(`seat ${team}: exhausted food is delivered before its accepted queued move completes`, async () => {
  await runQueuedCargoReturn({ team });
});
for(const team of [0,1]) {
  test(`seat ${team}: fractional final food and queued attack-move conserve cargo`,async()=>{
    await runQueuedCargoReturn({team,stock:.004,queuedType:'attackMove'});
  });
  test(`seat ${team}: final wood is banked once before the queued leg`,async()=>{
    await runQueuedCargoReturn({team,type:'wood',stock:7.25});
  });
  for(const interrupt of ['stop','holdPosition'])test(`seat ${team}: ${interrupt} cancels queued delivery without losing cargo`,async()=>{
    await runQueuedCargoReturn({team,interrupt});
  });
}
test('conservation detects both lost cargo and duplicate deposit',()=>{
  assertCargoConserved({stock:.5,bank:.004,cargo:0},.504);
  assert.throws(()=>assertCargoConserved({stock:.5,bank:0,cargo:0},.504));
  assert.throws(()=>assertCargoConserved({stock:.5,bank:.008,cargo:0},.504));
});

test('a source-free cargo delivery cannot advance queued movement before deposit', () => {
  const source = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
  const start = source.indexOf('function advanceQueuedWaypoints('), end = source.indexOf('\nfunction ', start + 1);
  const unit = { id: 0, team: 0, kind: 'worker', hp: 35, x: 1, z: 0, cargo: .5, cargoType: 'food',
    gatherNodeId: null, gatherForestCell: -1, gatherPhase: 'to-base', buildingTargetId: null,
    attackTargetId: -1, attackBuildingTargetId: -1, holdingPosition: false, orderRevision: 3,
    path: [], pathIndex: 0, moveGoalCell: 1, movePlanningPending: false,
    attackMoveResumePath: null, queuedWaypoints: [{ destination: 2, attackMove: false }] };
  const context = vm.createContext({ units: [unit], dirty: false, nearestOpenCell: c => c,
    worldToCell: x => x, tickNumber: 20, ATTACK_MOVE_SCAN_INTERVAL_TICKS: 6, nextMoveOrderId: 1,
    movePlanningEpoch: 0, performance: { now: () => 0 }, SHARED_MOVE_PATHS: true,
    movePlanningQueue: [], scheduleNextMovePlanning() {} });
  vm.runInContext(source.slice(start, end), context);
  const before = structuredClone(unit); context.advanceQueuedWaypoints();
  assert.deepEqual(unit, before, 'the delivery owns its route until cargo has been banked');
  assert.equal(context.movePlanningQueue.length, 0);
});
