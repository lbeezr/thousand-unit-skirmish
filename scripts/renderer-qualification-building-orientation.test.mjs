// Rejection contracts only; actual WebGL evidence comes from the qualified run.
import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePlacementMatch, BUILDING_ORIENTATION_CAPTURE_MAP, BUILDING_ORIENTATION_CAPTURE_FAMILIES } from './renderer-qualification-building-orientation.mjs';
import { mapSizeIdentity } from '../src/map-size-policy.mjs';
const art = { visible: true, key: 'house:view03', scale: [8, 8, 1], center: [.5, .632], position: [0, 0, 0] };
const ghost = { active: true, valid: true, visible: true, orientation: 0, type: 'house', position: [1.5, 0, 4.5], art: { ...art, key: 'house:view01' } };
const rotated = { ...ghost, orientation: 1, art };
const placed = { type: 'house', orientation: 1, x: 1.5, z: 4.5, complete: true, art };
test('building capture publishes an ordinary-admitted map with native paid resources', () => {
  assert.equal(mapSizeIdentity(BUILDING_ORIENTATION_CAPTURE_MAP).ordinarySelectable, true);
  assert.equal(mapSizeIdentity({ width: 64, height: 64 }).ordinarySelectable, false);
  assert.equal(BUILDING_ORIENTATION_CAPTURE_MAP.startingArmySize, 24);
  assert.ok(BUILDING_ORIENTATION_CAPTURE_MAP.startingResources.wood >= 1000);
  assert.deepEqual(BUILDING_ORIENTATION_CAPTURE_FAMILIES, ['house', 'mill', 'farm', 'dock']);
});
test('qualified placement requires actual view, site, scale and anchor parity', () => {
  validatePlacementMatch(ghost, rotated, placed);
  for (const change of [{ active: false }, { valid: false }, { visible: false }, { orientation: 0 },
    { type: 'barracks' }, { position: [2.5, 0, 4.5] }, { art: ghost.art }]) {
    assert.throws(() => validatePlacementMatch(ghost, { ...rotated, ...change }, placed));
  }
  for (const change of [{ type: 'barracks' }, { orientation: 0 }, { x: 2.5 }, { z: 5.5 }, { complete: false },
    { art: { ...art, visible: false } }, ...['key', 'scale', 'center', 'position'].map(field => ({ art: { ...art, [field]: 'wrong' } }))]) {
    assert.throws(() => validatePlacementMatch(ghost, rotated, { ...placed, ...change }));
  }
});
