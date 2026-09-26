import assert from 'node:assert/strict';
import {
  barracksModelStage, barracksModelVisualState, buildingProductionCueState, constructionGroundStage,
} from '../src/building-visual-state.mjs';
import {
  resourceVisualScale, resourceVisualStage, resourceVisualTransitionStages,
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
assert.deepEqual(
  ['full', 'worked', 'low', 'depleted'].map(resourceVisualScale), [1, 0.84, 0.62, 0.22],
  'generic resource fallback should keep depleted props visible with a restrained stage size cue',
);
for (const [progress, complete, expected] of [
  [0, false, 'earthwork'], [0.3999, false, 'earthwork'], [0.4, false, 'foundation'],
  [0.999, false, 'foundation'], [1, false, 'clear'], [0.1, true, 'clear'],
  [Number.NaN, false, 'clear'],
]) {
  assert.equal(constructionGroundStage(progress, complete), expected,
    `building progress ${progress} (complete=${complete}) should use the ${expected} ground stage`);
}
for (const [progress, complete, expected] of [
  [0, false, 'foundation'], [0.2499, false, 'foundation'], [0.25, false, 'frame'],
  [0.4999, false, 'frame'], [0.5, false, 'walls'], [0.7499, false, 'walls'],
  [0.75, false, 'roof'], [0.9999, false, 'roof'], [1, false, 'complete'],
  [1.2, false, 'complete'], [0.1, true, 'complete'], [Number.NaN, false, null],
]) {
  assert.equal(barracksModelStage(progress, complete), expected,
    `Barracks progress ${progress} (complete=${complete}) should select ${expected}`);
}
for (const [progress, expected] of [
  [0, ['foundation', false, false, false, false]],
  [0.25, ['frame', true, false, false, false]],
  [0.5, ['walls', false, true, false, false]],
  [0.75, ['roof', false, true, true, false]],
  [0.8999, ['roof', false, true, true, false]],
  [0.9, ['roof', false, true, true, true]],
  [1, ['complete', false, true, true, true]],
]) {
  const state = barracksModelVisualState(progress, false);
  assert.deepEqual([
    state.stage, state.frameVisible, state.wallsVisible, state.roofVisible, state.finishedDetailsVisible,
  ], expected, `Barracks progress ${progress} should expose the expected model parts`);
}
assert.equal(barracksModelVisualState(0.1, true).finishedDetailsVisible, true,
  'completed Barracks should expose all finished model parts');
assert.equal(barracksModelVisualState(Number.NaN, false), null,
  'invalid Barracks progress should not select model parts');
for (const [complete, queueLength, productionBlocked, expected] of [
  [false, 1, false, 'idle'], [true, 0, false, 'idle'], [true, -1, true, 'idle'],
  [true, Number.NaN, false, 'idle'], [true, 1, false, 'active'],
  [true, 1, true, 'blocked'], [true, 1, undefined, 'active'],
]) {
  assert.equal(buildingProductionCueState(complete, queueLength, productionBlocked), expected,
    `complete=${complete}, queue=${queueLength}, blocked=${productionBlocked} should use the ${expected} cue`);
}

process.stdout.write('Resource/building visual-state scenario passed: stock, construction, Barracks model stages, and production cues follow the contract.\n');
