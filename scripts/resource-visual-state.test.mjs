import assert from 'node:assert/strict';
import test from 'node:test';
import { resourceVisualScale, resourceVisualStage,
  resourceVisualTransitionStages } from '../src/resource-visual-state.mjs';

test('legacy transition values are filtered without coercion or dirtying an unrelated batch', () => {
  const disguised = { [Symbol.toPrimitive]() { throw new Error('Stage membership must not coerce objects'); } };
  for (const unknown of [undefined, null, NaN, 0, false, 'unknown', 'toString', Symbol('full'), disguised, ['full']]) {
    assert.deepEqual(resourceVisualTransitionStages(unknown, 'worked'), ['worked']);
    assert.deepEqual(resourceVisualTransitionStages('low', unknown), ['low']);
    assert.deepEqual(resourceVisualTransitionStages(unknown, unknown), []);
  }
  assert.deepEqual(resourceVisualTransitionStages('worked', 'full'), ['worked', 'full']);
  assert.deepEqual(resourceVisualTransitionStages('depleted', 'depleted'), []);
});

test('numeric stock feeds canonical dirty stages and fallback scales through depletion', () => {
  const full = resourceVisualStage(100, 100), worked = resourceVisualStage(66, 100);
  const depleted = resourceVisualStage(0, 100);
  assert.deepEqual(resourceVisualTransitionStages(full, worked), ['full', 'worked']);
  assert.equal(resourceVisualScale(worked), 0.84);
  assert.deepEqual(resourceVisualTransitionStages(worked, depleted), ['worked', 'depleted']);
  assert.equal(resourceVisualScale(depleted), 0.22);
});
