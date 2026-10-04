import assert from 'node:assert/strict';
import test from 'node:test';
import { createGatherWorkIntent, createConstructionWorkIntent, validWorkIntent,
  clearWorkIntent, clearGatherWorkIntent, activeWorkIntent, isPlainNeutralFoodSource } from '../src/work-intent.mjs';
import { STONE_ECONOMY_PROFILE_ID } from '../src/economy-profile.mjs';

const map = { width: 160, height: 160 }, worker = { kind: 'worker', team: 0, hp: 50, generation: 3, orderRevision: 7 };
const area = { minX: -10, maxX: 10, minZ: -2, maxZ: 2 };
test('gather intent binds original source and generation independently of internal orderRevision', () => {
  const unit = { ...worker, workIntent: createGatherWorkIntent(3, { x: -5.5, z: 1.5 }) };
  assert.ok(validWorkIntent(unit.workIntent, unit, map));
  unit.orderRevision += 20;
  assert.deepEqual(activeWorkIntent(unit).anchor, { x: -5.5, z: 1.5 });
  assert.ok(validWorkIntent(unit.workIntent, unit, map));
  assert.equal(activeWorkIntent({ ...unit, generation: 4 }), null);
  assert.equal(activeWorkIntent({ ...unit, hp: 0 }), null);
});
test('Stone area intent requires its explicit profile and never admits Food or another ore', () => {
  const intent = createGatherWorkIntent(3, { x: -5.5, z: 1.5 }, 'stone');
  assert.equal(validWorkIntent(intent, worker, map), false);
  assert.ok(validWorkIntent(intent, worker, { ...map, economyProfileId: STONE_ECONOMY_PROFILE_ID }));
  for (const resource of ['food', 'gold', 'copper']) {
    assert.throws(() => createGatherWorkIntent(3, { x: 0, z: 0 }, resource), /Unsupported gather area/);
    assert.equal(validWorkIntent({ ...intent, resource }, worker, { ...map, economyProfileId: STONE_ECONOMY_PROFILE_ID }), false);
  }
});
test('resource cancellation preserves a construction intent; external cancellation clears either', () => {
  const unit = { ...worker, workIntent: createConstructionWorkIntent(3, [2, 1], area) };
  const intent = unit.workIntent;
  clearGatherWorkIntent(unit); assert.equal(unit.workIntent, intent);
  clearWorkIntent(unit); assert.equal(unit.workIntent, null);
  unit.workIntent = createGatherWorkIntent(3, { x: 0.5, z: 0.5 });
  clearGatherWorkIntent(unit); assert.equal(unit.workIntent, null);
});
test('Food intent carries an exact plain-neutral source class without admitting Farms, wildlife, fishing or future variants', () => {
  const source = { id: 'plain', type: 'food', x: 0.5, z: 0.5, stock: 6 };
  const intent = createGatherWorkIntent(3, source, 'food');
  assert.ok(isPlainNeutralFoodSource(source));
  assert.deepEqual(intent, { version: 1, kind: 'gather', generation: 3, resource: 'food',
    sourceKind: 'neutral-land-food', anchor: { x: .5, z: .5 } });
  assert.ok(validWorkIntent(JSON.parse(JSON.stringify(intent)), worker, map));
  const missing = { ...intent }; delete missing.sourceKind;
  for (const bad of [missing, { ...intent, sourceKind: 'farm' }, { ...intent, sourceKind: 'shore-fish' },
    { ...intent, sourceKind: 'future-food' }, { ...intent, resource: 'wood' }]) assert.equal(validWorkIntent(bad, worker, map), false);
  for (const metadata of [{ sourceBuildingId: 2 }, { team: 0 }, { wildlifeSpecies: 'bellweather-sheep' },
    { wildlifeState: 'carcass' }, { wildlifeTeam: null }, { resourceVariant: 'shore-fish' }, { resourceVariant: 'future-food' }]) {
    const other = { ...source, ...metadata };
    assert.equal(isPlainNeutralFoodSource(other), false);
    assert.throws(() => createGatherWorkIntent(3, other, 'food'), /Unsupported gather area/);
  }
  assert.equal(validWorkIntent(intent, { ...worker, movementDomain: 'water' }, map), false);
});
test('owned gate priority and remembered walls survive serialization; removed/completed sites can be pruned later', () => {
  const intent = createConstructionWorkIntent(3, [2, 1, 3], area);
  const options = { maxSites: 8, nextBuildingId: 4, buildings: [{ id: 2, type: 'palisade-gate', team: 0 },
    { id: 1, type: 'palisade-wall', team: 0, complete: true }] };
  const restored = JSON.parse(JSON.stringify(intent));
  assert.ok(validWorkIntent(restored, worker, map, options));
  assert.deepEqual(restored.siteIds, [2, 1, 3]);
  assert.deepEqual(restored.area, area);
  assert.equal(validWorkIntent(restored, worker, map, { ...options, buildings: [{ id: 2, team: 1 }] }), false);
  assert.equal(validWorkIntent(restored, worker, map, { ...options, nextBuildingId: 3 }), false);
});
test('legacy omission is legal while malformed/new-version/cross-generation records fail closed', () => {
  assert.ok(validWorkIntent(null, worker, map)); assert.ok(validWorkIntent(undefined, worker, map));
  const intent = createGatherWorkIntent(3, { x: 0.5, z: 0.5 });
  for (const bad of [{ ...intent, version: 2 }, { ...intent, generation: 4 }, { ...intent, resource: 'food' },
    { ...intent, orderRevision: 7 }, { ...intent, anchor: { x: Infinity, z: 0 } },
    { ...intent, anchor: { x: 80, z: 0 } }, { ...intent, kind: 'unknown' }]) assert.equal(validWorkIntent(bad, worker, map), false);
  for (const ids of [[], [1, 1], [1.5], [-1], [4]]) assert.equal(validWorkIntent(createConstructionWorkIntent(3, ids, area), worker, map,
    { maxSites: 3, nextBuildingId: 4 }), false);
});
