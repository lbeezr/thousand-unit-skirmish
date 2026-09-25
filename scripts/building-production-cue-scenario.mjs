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
