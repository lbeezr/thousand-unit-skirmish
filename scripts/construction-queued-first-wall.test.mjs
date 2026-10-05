import assert from 'node:assert/strict';
import test from 'node:test';
import { writeFile } from 'node:fs/promises';
import { LAND_CLEARANCE_PROFILE } from '../src/unit-movement.mjs';
import { runConstructionQueuedFirstWall } from './construction-queued-first-wall.mjs';

// Default registered dependency regression for the PR504 bounded queue-head
// primitive and its actual construction parking consumer.
// All costs, queues, parked-pose and exact-goal controls run in the real case.
test('queued-first Palisade completion avoids an already accepted military return slot', async () => {
  const result = await runConstructionQueuedFirstWall();
  if (process.env.CONSTRUCTION_QUEUED_FIRST_RECORD) {
    await writeFile(process.env.CONSTRUCTION_QUEUED_FIRST_RECORD, JSON.stringify(result, null, 2) + '\n');
  }
  const parking = result.events.find(event => event.kind === 'builder-parked').worker;
  const clearance = LAND_CLEARANCE_PROFILE.radiusByKind.worker + LAND_CLEARANCE_PROFILE.radiusByKind.infantry;
  assert.ok(Math.hypot(parking.x - result.returnPoint.x, parking.z - result.returnPoint.z) >= clearance - 1e-9,
    `new construction parking must clear the prior accepted return: work/park tick${result.parkingTick}, `
    + `return activation tick${result.returnActivationTick}, future query ${result.futureAvailability.status}, `
    + `current query ${result.currentAvailability.status}; preserve the existing idle pose and exact military goal`);
});
