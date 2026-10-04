import assert from 'node:assert/strict';
import test from 'node:test';
import { GATHER_WORK_AREA_RADIUS, woodWorkArea, nearbyWoodSources, gatherWorkArea, nearbyGatherSources } from '../src/gather-work-area.mjs';

const anchor = woodWorkArea({ x: -11.5, z: 0.5 });
const source = (id, x, stock = 6, type = 'wood') => ({ id, type, x, z: 0.5, stock });
test('a work area retains the manually chosen source anchor', () => {
  assert.deepEqual(anchor, { type: 'wood', x: -11.5, z: 0.5 });
  assert.equal(GATHER_WORK_AREA_RADIUS, 8);
});
test('continuation excludes exhausted, far, foreign-type and malformed sources', () => {
  const candidates = [source('near', -10.5), source('edge', -3.5), source('far', -3.499),
    source('empty', -11, 0), source('food', -11, 6, 'food'), source('stone', -11, 6, 'stone'),
    source('infinite', -11, Infinity), source('bad-position', NaN)];
  assert.deepEqual(nearbyWoodSources(anchor, anchor, candidates).map(s => s.id), ['near', 'edge']);
  assert.deepEqual(nearbyWoodSources({ ...anchor, type: 'food' }, anchor, candidates), []);
});
test('repeated replacement never shifts the original work area across a map', () => {
  const positions = [-10.5, -6.5, -3.5, 0.5, 4.5];
  for (const x of positions) {
    const selected = nearbyWoodSources(anchor, { x, z: 0.5 }, positions.map((n, i) => source(String(i), n)));
    assert.ok(selected.every(s => Math.abs(s.x - anchor.x) <= 8));
    assert.deepEqual(anchor, { type: 'wood', x: -11.5, z: 0.5 });
  }
});
test('candidate order is nearest first, deterministic on ties, without mutating input', () => {
  const sources = [source('z', -10.5), source('b', -12.5), source('a', -10.5)];
  const before = structuredClone(sources);
  assert.deepEqual(nearbyWoodSources(anchor, anchor, sources).map(s => s.id), ['a', 'b', 'z']);
  assert.deepEqual(sources, before);
});
test('Stone selection is an explicit exact-type fixed area; Wood helpers and Food remain separate', () => {
  const stone = gatherWorkArea(anchor, 'stone');
  const sources = [source('near-stone', -10.5, 6, 'stone'), source('edge-stone', -3.5, 6, 'stone'),
    source('far-stone', -3.499, 6, 'stone'), source('empty-stone', -11, 0, 'stone'),
    source('near-wood', -11), source('near-food', -11, 6, 'food')];
  assert.deepEqual(nearbyGatherSources(stone, anchor, sources).map(s => s.id), ['near-stone', 'edge-stone']);
  assert.deepEqual(nearbyWoodSources(stone, anchor, sources), []);
  assert.deepEqual(nearbyGatherSources(gatherWorkArea(anchor, 'food'), anchor, sources).map(s => s.id), ['near-food']);
});
test('plain Food area excludes other Food source classes and retains the inclusive original boundary with stable ties', () => {
  const food = gatherWorkArea(anchor, 'food');
  const plain = source('plain', -10.5, 6, 'food');
  const candidates = [plain, { ...plain, id: 'farm', sourceBuildingId: 1, team: 0 },
    { ...plain, id: 'sheep', wildlifeSpecies: 'bellweather-sheep', wildlifeState: 'alive' },
    { ...plain, id: 'carcass', wildlifeSpecies: 'bellweather-sheep', wildlifeState: 'carcass' },
    { ...plain, id: 'fish', resourceVariant: 'shore-fish' }, { ...plain, id: 'unknown', resourceVariant: 'future-food' },
    source('edge', -3.5, 6, 'food'), source('far', -3.499, 6, 'food'), source('empty', -11, 0, 'food'),
    { ...plain, id: 'a' }];
  const before = structuredClone(candidates);
  assert.deepEqual(nearbyGatherSources(food, anchor, candidates).map(n => n.id), ['a', 'plain', 'edge']);
  assert.deepEqual(candidates, before);
  assert.deepEqual(food, { type: 'food', x: anchor.x, z: anchor.z });
});
