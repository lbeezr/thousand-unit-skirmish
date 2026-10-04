import assert from 'node:assert/strict';
import test from 'node:test';
import { GATHER_WORK_AREA_RADIUS, woodWorkArea, nearbyWoodSources } from '../src/gather-work-area.mjs';

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
