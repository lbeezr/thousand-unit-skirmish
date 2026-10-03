import assert from 'node:assert/strict';
import test from 'node:test';
import { MAP_SIZE_TIERS, mapSizeIdentity, ordinaryMapCatalog } from '../src/map-size-policy.mjs';

test('five explicit tiers begin at 160; XL is a proposal beyond the current engine limit', () => {
  assert.deepEqual(MAP_SIZE_TIERS.map(tier => [tier.label, tier.side]),
    [['Tiny', 160], ['Small', 192], ['Medium', 224], ['Large', 256], ['XL', 320]]);
  assert.equal(MAP_SIZE_TIERS.at(-1).engineLimitAllows, false);
  for (const side of [160, 192, 224, 256]) assert.equal(mapSizeIdentity({ width: side, height: side }).ordinarySelectable, true);
  assert.equal(mapSizeIdentity({ width: 320, height: 320 }).ordinarySelectable, false);
});

test('ordinary selection requires both axes and excludes small or oversized rectangles', () => {
  for (const [width, height] of [[80, 72], [96, 72], [160, 159], [159, 256], [160, 257]])
    assert.equal(mapSizeIdentity({ width, height }).ordinarySelectable, false);
  const rectangle = mapSizeIdentity({ width: 224, height: 160 });
  assert.equal(rectangle.sizeTierId, 'tiny'); assert.equal(rectangle.width, 224);
  assert.equal(rectangle.height, 160); assert.equal(rectangle.supportedUnitCapacity, null);
  assert.throws(() => mapSizeIdentity({ width: 160.5, height: 160 }), /integer/);
});

test('current legacy maps retain honest display without becoming new choices or mutating saves', () => {
  const maps = [{ id: 'old', width: 80, height: 72 }, { id: 'tiny', width: 160, height: 160 },
    { id: 'xl-proposal', width: 320, height: 320 }];
  const before = structuredClone(maps);
  assert.deepEqual(ordinaryMapCatalog(maps).map(map => map.id), ['tiny']);
  const current = ordinaryMapCatalog(maps, 'old');
  assert.deepEqual(current.map(map => map.id), ['old', 'tiny']);
  assert.equal(current[0].selectable, false); assert.equal(current[0].legacyCurrent, true);
  assert.equal(current[1].selectable, true); assert.equal(current[1].legacyCurrent, false);
  assert.deepEqual(maps, before);
});
