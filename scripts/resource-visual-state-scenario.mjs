import assert from 'node:assert/strict';
import { resourceVisualStage } from '../src/resource-visual-state.mjs';

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

process.stdout.write('Resource visual-state scenario passed: all four stages follow the contract stock bands.\n');
