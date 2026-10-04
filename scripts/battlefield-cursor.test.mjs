import { test } from 'node:test';
import assert from 'node:assert/strict';
import { battlefieldCursor as cursor } from '../src/battlefield-cursor.mjs';
const selected = { canOrder: true, count: 1, military: true };
test('modal cursor priority and spectator safety', () => {
  assert.equal(cursor({ ...selected, panning: true, building: true }), 'panning');
  assert.equal(cursor({ ...selected, panReady: true, dragging: true }), 'pan');
  assert.equal(cursor({ ...selected, dragging: true, crossing: true }), 'box-crossing');
  assert.equal(cursor({ ...selected, dragging: true }), 'box-select');
  assert.equal(cursor({ ...selected, canOrder: false, enemy: true }), 'select');
  assert.equal(cursor({ ...selected, building: true, buildValid: true }), 'build-valid');
  assert.equal(cursor({ ...selected, building: true, buildValid: false }), 'build-blocked');
});
test('context order priority and capable selections', () => {
  assert.equal(cursor({ ...selected, enemy: true, resource: 'wood', shift: true }), 'attack');
  assert.equal(cursor({ ...selected, enemyBuilding: true }), 'attack');
  assert.equal(cursor({ ...selected, military: false, workers: true, enemyBuilding: true }), 'unavailable');
  assert.equal(cursor({ ...selected, resource: 'food' }), 'unavailable');
  assert.equal(cursor({ ...selected, workers: true, resource: 'food', exhaustedFarm: true }), 'unavailable');
  assert.equal(cursor({ ...selected, workers: true, farmConstruction: true }), 'build-valid');
  assert.equal(cursor({ ...selected, farmConstruction: true }), 'unavailable');
  assert.equal(cursor({ ...selected, workers: true, resource: 'food' }), 'gather');
  assert.equal(cursor({ ...selected, workers: true, resource: 'wood' }), 'gather-wood');
  assert.equal(cursor({ ...selected, workers: true, forest: true }), 'gather-wood');
  assert.equal(cursor({ ...selected, shift: true }), 'move-queued');
  assert.equal(cursor({ ...selected, shift: true, attackMove: true }), 'attack-move-queued');
  assert.equal(cursor({ ...selected, selectedBuilding: true, rallySupported: true, enemy: true }), 'rally');
  assert.equal(cursor({ ...selected, selectedBuilding: true }), 'unavailable');
});
test('selection modifier and idle states', () => {
  assert.equal(cursor({ canOrder: true }), 'select');
  assert.equal(cursor({ canOrder: true, shift: true, friendly: true }), 'select-add');
  assert.equal(cursor({ ...selected, shift: true, friendly: true, alreadySelected: true }), 'select-remove');
  assert.equal(cursor({ ...selected, shift: true, friendly: true, armed: true }), 'move-queued');
});
