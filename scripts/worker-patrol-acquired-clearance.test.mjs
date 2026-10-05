import test from 'node:test';
import assert from 'node:assert/strict';
import { observeWorkerPatrolAcquired } from './worker-patrol-acquired-clearance.mjs';
// Keep out of default CI until the attributed acquired-body gap is adopted.
for (const team of [0,1]) for (const ending of ['kill','loss']) {
  test(`seat ${team}: acquired Worker Patrol ${ending} preserves policy and admits only clear substeps after fresh replay recovery`, async () => {
    const result = await observeWorkerPatrolAcquired({ team, ending, nearStone: true, cold: true });
    assert.equal(result.unsafeSteps, 0, 'actual acquired substeps must respect the Worker static body');
    assert.equal(result.newContacts, 0);
  });
}
