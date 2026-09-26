import assert from 'node:assert/strict';
import test from 'node:test';
import { selectionContext } from '../src/selection-context.mjs';
const units = [
  { team: 0, kind: 'worker', hp: 10, cargoType: 'wood', cargo: 7 },
  { team: 0, kind: 'infantry', hp: 10 },
  { team: 1, kind: 'worker', hp: 10, cargoType: 'food', cargo: 99 },
  { team: 0, kind: 'worker', hp: 0, cargoType: 'food', cargo: 55 },
  { team: 0, kind: 'worker', hp: 10, cargoType: 'food', cargo: 12 },
];
test('empty, enemy, dead and stale selections expose no commands or cargo', () => {
  const model = selectionContext(units, new Set([2, 3, 100]), 0);
  assert.equal(model.kind, 'none'); assert.equal(model.total, 0);
  assert.deepEqual(model.cargo, {food: 0, wood: 0});
});
test('worker cargo reflects only selected living friendlies', () => {
  const model = selectionContext(units, new Set([0, 2, 3]), 0);
  assert.equal(model.kind, 'workers'); assert.deepEqual(model.cargo, {food: 0, wood: 7});
});
test('mixed and military selection retain appropriate role contexts', () => {
  assert.equal(selectionContext(units, [0, 1], 0).kind, 'mixed');
  assert.equal(selectionContext(units, [1], 0).kind, 'military');
});
test('only friendly building context exposes building actions', () => {
  assert.equal(selectionContext(units, [], 0, {team: 1}).kind, 'none');
  assert.equal(selectionContext(units, [], 0, {team: 0, type:'barracks'}).kind, 'building');
});
