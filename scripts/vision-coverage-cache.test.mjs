import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { VisionCoverageCache, VISION_CACHE_MAX_BYTES, VISION_CACHE_MAX_ENTRIES } from '../src/server/vision-coverage-cache.mjs';
import { visionFixture } from './forest-fringe-fixture.mjs';

const entry = (visible = [], fringe = []) => ({ visible, fringe });
const cache = options => new VisionCoverageCache({ width: 320, height: 320, ...options });

test('32-bit visible and fringe indices retain exact 320-square/rectangle boundaries before conversion', () => {
  const c = cache();
  const e = c.set(102399, 16, entry([65535, 65536, 102399], [65536, 102399]));
  assert.deepEqual([...e.visible], [65535, 65536, 102399]);
  assert.deepEqual([...e.fringe], [65536, 102399]);
  for (const indices of Object.values(e)) {
    assert.ok(indices instanceof Uint32Array);
    assert.equal(indices.byteOffset, 0);
    assert.equal(indices.byteLength, indices.buffer.byteLength);
  }
  assert.equal(c.metrics().payloadBytes, 20);
  const rectangle = cache({ height: 160 });
  assert.equal(rectangle.set(51199, 16, entry([51199])).visible[0], 51199);
  for (const bad of [-1, .5, NaN, Infinity, 102400, 2 ** 32]) {
    assert.throws(() => c.set(0, 8, entry([bad])), RangeError);
    assert.throws(() => c.set(0, 8, entry([], [bad])), RangeError);
    assert.throws(() => c.get(bad, 8), RangeError);
  }
  assert.throws(() => rectangle.set(0, 8, entry([51200])), RangeError);
  for (const sight of [0, 17, .5, NaN]) assert.throws(() => c.get(0, sight), RangeError);
  for (const options of [{ width: 321 }, { height: 0 }, { maxBytes: VISION_CACHE_MAX_BYTES + 1 },
    { maxEntries: VISION_CACHE_MAX_ENTRIES + 1 }, { generation: -1 }]) assert.throws(() => cache(options), RangeError);
});

test('all registry sights 1–16 have collision-free keys and inspection does not promote or count a hit', () => {
  const c = cache({ maxEntries: 2 });
  c.set(0, 16, entry([65536])); c.set(1, 1, entry([102399]));
  assert.equal(c.has(0, 16), true);
  assert.equal(c.metrics().hits, 0);
  assert.equal(c.get(1, 1).visible[0], 102399);
  c.set(2, 8, entry([2]));
  assert.equal(c.has(0, 16), false, 'inspection leaves oldest entry eligible for eviction');
  assert.equal(c.has(1, 1), true);
  const all = cache();
  for (let sight = 1; sight <= 16; sight++) all.set(102399, sight, entry([sight]));
  for (let sight = 1; sight <= 16; sight++) assert.equal(all.get(102399, sight).visible[0], sight);
});

test('both retained buffers own exact payload even for overlapping views into an oversized foreign buffer', () => {
  const c = cache(), foreign = new Uint32Array(10000);
  foreign.set([65535, 65536, 102399]);
  const e = c.set(0, 8, entry(foreign.subarray(0, 2), foreign.subarray(1, 3)));
  foreign.fill(0);
  assert.deepEqual([...e.visible], [65535, 65536]); assert.deepEqual([...e.fringe], [65536, 102399]);
  assert.notEqual(e.visible.buffer, foreign.buffer); assert.notEqual(e.visible.buffer, e.fringe.buffer);
  assert.equal(c.metrics().payloadBytes, 16);
  assert.equal(e.visible.buffer.byteLength + e.fringe.buffer.byteLength, 16);
});

test('deterministic LRU enforces both caps, exact replacement/delete/clear and atomic rejection', () => {
  const run = () => {
    const c = cache({ maxBytes: 24, maxEntries: 3, generation: 4, reason: 'gate-transition' });
    c.set(0, 8, entry([0], [1])); c.set(1, 8, entry([2], [3])); c.set(2, 8, entry([4], [5]));
    c.get(0, 8); c.set(3, 8, entry([6], [7]));
    assert.equal(c.has(1, 8), false); assert.equal(c.metrics().payloadBytes, 24);
    const before = c.metrics();
    assert.throws(() => c.set(0, 8, entry([8], [102400])), RangeError);
    assert.deepEqual(c.metrics(), before, 'failed insertion preserves accounting and order');
    c.set(0, 8, entry([9])); assert.equal(c.metrics().payloadBytes, 20);
    c.set(4, 8, entry([10], [11])); assert.equal(c.has(2, 8), false);
    assert.equal(c.delete(3, 8), true); assert.equal(c.delete(3, 8), false);
    assert.equal(c.metrics().payloadBytes, 12);
    c.clear(); assert.equal(c.metrics().payloadBytes, 0); assert.equal(c.metrics().entries, 0);
    assert.equal(c.metrics().generation, 4); assert.equal(c.metrics().clears, 1);
    return c.metrics();
  };
  assert.deepEqual(run(), run());
});

test('zero/one entry and oversized entries return usable uncached geometry without exceeding budgets', () => {
  const zero = cache({ maxBytes: 0, maxEntries: 0 });
  assert.deepEqual([...zero.set(0, 8, entry([65536], [102399])).visible], [65536]);
  assert.equal(zero.metrics().payloadBytes, 0); assert.equal(zero.metrics().entries, 0);
  const one = cache({ maxEntries: 1, maxBytes: 8 });
  one.set(0, 8, entry([0])); one.set(1, 8, entry([65536], [102399]));
  assert.equal(one.has(0, 8), false); assert.equal(one.metrics().payloadBytes, 8);
  const oversized = one.set(1, 8, entry([0, 1], [102399]));
  assert.deepEqual([...oversized.fringe], [102399]);
  assert.equal(one.has(1, 8), false); assert.equal(one.metrics().payloadBytes, 0);
  assert.equal(one.metrics().uncached, 1);
});

test('long default-budget sweeps independently reach the 8 MiB payload and 8,192 entry bounds', () => {
  const byBytes = cache(), byEntries = cache();
  const disk = Array.from({ length: 441 }, (_, i) => i);
  for (let source = 0; source < 12000; source++) {
    byBytes.set(source, 11, entry(disk)); byEntries.set(source, 8, entry());
    assert.ok(byBytes.metrics().payloadBytes <= VISION_CACHE_MAX_BYTES);
    assert.ok(byBytes.metrics().entries <= VISION_CACHE_MAX_ENTRIES);
  }
  assert.equal(byBytes.metrics().entries, Math.floor(VISION_CACHE_MAX_BYTES / (441 * 4)));
  assert.equal(byEntries.metrics().entries, VISION_CACHE_MAX_ENTRIES);
  assert.ok(byBytes.metrics().evictions > 0); assert.ok(byEntries.metrics().evictions > 0);
  assert.equal(byBytes.has(0, 11), false); assert.equal(byBytes.get(11999, 11).visible.length, 441);
});

test('actual markVisionFrom retains high absolute indices on 320 geometry without wrapping private masks', () => {
  for (const [width, height, source] of [[320, 320, 65535], [320, 320, 65536],
    [320, 320, 102399], [320, 160, 51199]]) {
    const f = visionFixture({ width, height, obstacles: [] });
    const col = source % width, row = Math.floor(source / width);
    f.mark(0, col, row, 16);
    assert.equal(f.context.visibleCellsByTeam[0][source], 1);
    for (let cell = 0; cell < width * height; cell++) {
      const expected = Number((cell % width - col) ** 2 + (Math.floor(cell / width) - row) ** 2 <= 16 ** 2);
      assert.equal(f.context.visibleCellsByTeam[0][cell], expected, `cell ${cell}, source ${source}`);
      assert.equal(f.context.exploredCellsByTeam[0][cell], expected);
      assert.equal(f.context.exploredCellsByTeam[1][cell], 0, 'cache geometry does not share exploration');
    }
  }
  const f = visionFixture({ width: 320, height: 320, obstacles: [
    { column: 315, row: 306, width: 4, height: 10, material: 'forest' },
  ] });
  f.mark(0, 312, 310, 11);
  const fringe = f.context.visionCoverageBySourceCell.get(310 * 320 + 312, 11).fringe;
  assert.ok(fringe.length > 0);
  for (const cell of fringe) {
    assert.ok(cell >= 65536); assert.equal(f.context.exploredCellsByTeam[0][cell], 1);
    assert.equal(f.context.visibleCellsByTeam[0][cell], 0);
    assert.equal(f.context.exploredCellsByTeam[0][cell % 65536], 0);
  }
});

test('current runtime coverage is identical after forced eviction or disabled caching across ordinary geometry', () => {
  for (const side of [16, 160, 192, 224, 256]) {
    const terrain = { width: side, height: side, obstacles: [
      { column: side - 7, row: side - 9, width: 4, height: 6, material: 'forest' },
      { column: 4, row: 4, width: 2, height: 2, material: 'stone' },
    ], elevationPatches: [{ column: 0, row: 0, width: side, height: side, level: 1 }] };
    const ordinary = visionFixture(terrain), evicted = visionFixture(terrain, { cacheOptions: { maxEntries: 1 } }),
      uncached = visionFixture(terrain, { cacheOptions: { maxEntries: 0 } }),
      original = visionFixture(terrain, { original: true });
    // Include paid-building occlusion geometry without changing the LOS algorithm.
    for (const f of [ordinary, evicted, uncached, original]) f.context.buildingBlocked[7 * side + 8] = 1;
    for (const [col, row] of [[0, 0], [side - 1, side - 1], [side - 8, side - 6], [7, 7], [0, 0]]) {
      for (const sight of [1, 7, 8, 10, 11, 16]) for (const team of [0, 1]) {
        for (const f of [ordinary, evicted, uncached, original]) { f.clearCurrent(); f.mark(team, col, row, sight); }
        assert.deepEqual(ordinary.context.visibleCellsByTeam, original.context.visibleCellsByTeam);
        for (const f of [evicted, uncached]) {
          assert.deepEqual(f.context.visibleCellsByTeam, ordinary.context.visibleCellsByTeam);
          assert.deepEqual(f.context.exploredCellsByTeam, ordinary.context.exploredCellsByTeam);
        }
      }
    }
    assert.ok(evicted.context.visionCoverageBySourceCell.metrics().evictions > 0);
    assert.equal(uncached.context.visionCoverageBySourceCell.metrics().entries, 0);
  }
});

test('actual same-tick identity refresh survives geometry replacement; hits/evictions never replace geometry', async () => {
  const f = visionFixture({ width: 32, height: 32, obstacles: [] });
  const c = f.context, source = 16 * 32 + 16, target = source + 6;
  c.units.push({ team: 0, hp: 35, kind: 'worker', x: .5, z: .5 });
  c.ensureVisionMasks(); assert.equal(c.visibleCellsByTeam[0][target], 1);
  const old = c.visionCoverageBySourceCell;
  old.get(source, 8); old.set(0, 8, entry([0]));
  c.ensureVisionMasks(); assert.equal(c.visionMasksUpdatedCoverage, old);
  c.buildingBlocked[source + 3] = 1;
  old.clear(); c.ensureVisionMasks();
  assert.equal(c.visibleCellsByTeam[0][target], 1, 'negative control: same-object clear cannot refresh same-tick masks');
  c.invalidateVisionCoverage('building-addition'); c.ensureVisionMasks();
  assert.notEqual(c.visionCoverageBySourceCell, old);
  assert.equal(c.visionCoverageBySourceCell.metrics().generation, 1);
  assert.equal(c.visionCoverageBySourceCell.metrics().reason, 'building-addition');
  assert.equal(c.visibleCellsByTeam[0][target], 0);
  assert.equal(c.exploredCellsByTeam[0][target], 1, 'remembered terrain survives geometry changes');
  assert.equal(c.exploredCellsByTeam[1][target], 0);
  c.buildingBlocked[source + 3] = 0;
  c.invalidateVisionCoverage('gate-transition'); c.ensureVisionMasks();
  assert.equal(c.visibleCellsByTeam[0][target], 1);
  assert.equal(c.visionCoverageBySourceCell.metrics().generation, 2);
  const server = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
  const reasons = [...server.matchAll(/invalidateVisionCoverage\('([^']+)'\)/g)].map(match => match[1]);
  assert.deepEqual(reasons, ['map-activation', 'forest-reset', 'forest-clear', 'building-removal',
    'wall-addition', 'building-addition', 'gate-transition']);
  assert.ok(!server.includes('visionCoverageBySourceCell.clear('), 'geometry must always replace the object');
});
