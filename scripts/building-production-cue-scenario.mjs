import assert from 'node:assert/strict';
import { getBuildingProductionCueState } from '../src/building-production-cue.mjs';

assert.equal(getBuildingProductionCueState(null), 'hidden');
assert.equal(getBuildingProductionCueState({ complete: false, queue: [1] }), 'hidden');
assert.equal(getBuildingProductionCueState({ complete: true, queue: [] }), 'hidden');
assert.equal(getBuildingProductionCueState({ complete: true, queue: 0 }), 'hidden');
assert.equal(getBuildingProductionCueState({ complete: true, queue: [1] }), 'active');
assert.equal(getBuildingProductionCueState({ complete: true, queue: 2 }), 'active');
assert.equal(getBuildingProductionCueState({
  complete: true,
  queue: [1],
  productionBlocked: true,
}), 'blocked');

const firstBlocked = getBuildingProductionCueState({
  complete: true,
  queue: 1,
  productionBlocked: true,
});
const resumed = getBuildingProductionCueState({
  complete: true,
  queue: 1,
  productionBlocked: false,
});
assert.equal(firstBlocked, 'blocked', 'initial snapshots show blocked production');
assert.equal(resumed, 'active', 'the cue resumes when the block clears');

console.log('Building production cue scenario passed: hidden, active, and blocked states follow the authoritative snapshot, including initial blocked snapshots and recovery.');

// The current renderer has the same cue states, with idle naming hidden cues.
const { buildingProductionCueState } = await import('../src/building-visual-state.mjs');
for (const complete of [false, true]) {
  for (const queue of [0, 1, 2]) {
    for (const productionBlocked of [false, true]) {
      const current = buildingProductionCueState(complete, queue, productionBlocked);
      assert.equal(current === 'idle' ? 'hidden' : current,
        getBuildingProductionCueState({ complete, queue, productionBlocked }));
    }
  }
}
