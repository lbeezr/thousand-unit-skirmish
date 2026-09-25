import assert from 'node:assert/strict';
import {
  buildingProductionCueState, constructionGroundStage,
} from '../src/building-visual-state.mjs';
import {
  resourceVisualStage, resourceVisualTransitionStages,
} from '../src/resource-visual-state.mjs';

for (const [stock, startingStock, expected] of [
  [100, 100, 'full'], [67, 100, 'full'], [66, 100, 'worked'], [34, 100, 'worked'],
  [33, 100, 'low'], [1, 100, 'low'], [0, 100, 'depleted'], [-1, 100, 'depleted'],
  [268, 400, 'full'], [264, 400, 'worked'], [132, 400, 'low'], [800, 400, 'full'],
]) {
  assert.equal(resourceVisualStage(stock, startingStock), expected,
    `stock ${stock}/${startingStock} should use the ${expected} sprite`);
}
assert.equal(resourceVisualStage(Number.NaN, 100), 'depleted', 'invalid stock should fail closed to the depleted sprite');
assert.equal(resourceVisualStage(100, 0), 'depleted', 'invalid starting stock should fail closed to the depleted sprite');
assert.deepEqual(resourceVisualTransitionStages('full', 'worked'), ['full', 'worked'],
  'a resource state swap should dirty only its previous and current state batches');
assert.deepEqual(resourceVisualTransitionStages('low', 'low'), [],
  'a stable resource state should not dirty any state batch');
assert.deepEqual(resourceVisualTransitionStages('unknown', 'depleted'), ['depleted'],
  'an unknown previous state should not dirty an unrelated batch');
for (const [progress, complete, expected] of [
  [0, false, 'earthwork'], [0.3999, false, 'earthwork'], [0.4, false, 'foundation'],
  [0.999, false, 'foundation'], [1, false, 'clear'], [0.1, true, 'clear'],
  [Number.NaN, false, 'clear'],
]) {
  assert.equal(constructionGroundStage(progress, complete), expected,
    `building progress ${progress} (complete=${complete}) should use the ${expected} ground stage`);
}
for (const [complete, queueLength, productionBlocked, expected] of [
  [false, 1, false, 'idle'], [true, 0, false, 'idle'], [true, -1, true, 'idle'],
  [true, Number.NaN, false, 'idle'], [true, 1, false, 'active'],
  [true, 1, true, 'blocked'], [true, 1, undefined, 'active'],
]) {
  assert.equal(buildingProductionCueState(complete, queueLength, productionBlocked), expected,
    `complete=${complete}, queue=${queueLength}, blocked=${productionBlocked} should use the ${expected} cue`);
}

process.stdout.write('Resource/building visual-state scenario passed: stock, construction, and production cue states follow the contract.\n');
