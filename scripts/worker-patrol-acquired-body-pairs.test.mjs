import test from 'node:test';
import assert from 'node:assert/strict';
import { observeWorkerPatrolAcquiredBodyPairs } from './worker-patrol-acquired-body-pairs.mjs';

for (const team of [0, 1]) for (const cold of [false, true]) for (const ending of ['kill', 'loss']) {
  test(`seat ${team}, cold ${cold}: acquired Patrol ${ending} passes live body pairs and original policy bounds`, async () => {
    const result = await observeWorkerPatrolAcquiredBodyPairs({ team, cold, ending });
    assert.equal(result.strictStaticFailures, 0);
    assert.equal(result.pairAdmissionFailures, 0);
    assert.equal(result.newPairContacts, 0);
    assert.ok(result.acquiredSteps > 0);
    assert.equal(result.policy, 'passed original kill/loss/continuation/recovery bounds');
    // The direct same-cell writer is separately observed; these original
    // witnesses do not qualify a writer they never execute.
    assert.equal(result.reasons['same-cell-combat'] ?? 0, 0);
  });
}
