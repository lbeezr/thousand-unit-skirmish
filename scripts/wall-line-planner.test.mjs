import assert from 'node:assert/strict';
import test from 'node:test';
import { planWallLine } from '../src/wall-line-planner.mjs';
import { BUILDING_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { townCenterFootprintCells } from '../src/town-center-spawn.mjs';

// Deliberately arbitrary fixture price; no runtime wall price is established here.
const segmentCost = { food: 2, wood: 3 };
const point = (column, row) => ({ column, row });
const line = (points, options = {}) => planWallLine({ width: 16, height: 16,
  points, segmentCost, ...options });
const at = (result, column, row) => result.preview.pieces.find(p => p.cell === row * 16 + column);

test('straight lines include both endpoints and reciprocal cardinal connections', () => {
  for (const [start, end, directions] of [
    [point(2, 3), point(5, 3), ['east', 'west']],
    [point(3, 2), point(3, 5), ['north', 'south']],
  ]) {
    const result = line([start, end]);
    assert.equal(result.status, 'ready');
    assert.equal(result.plan.added.length, 4);
    assert.equal(result.preview.pieces.filter(p => p.kind === 'end').length, 2);
    assert.equal(result.preview.pieces.filter(p => p.kind === 'straight').length, 2);
    assert.deepEqual(result.preview.pieces.find(p => p.kind === 'straight').connections, directions);
    assert.deepEqual(result, line([end, start]), 'cardinal reversal has identical canonical output');
  }
});

test('axis order makes diagonal drags connected and their elbow explicit', () => {
  const points = [point(2, 3), point(5, 6)];
  const columnFirst = line(points), rowFirst = line(points, { axisOrder: 'row-first' });
  assert.equal(columnFirst.preview.newCount, 7);
  assert.equal(rowFirst.preview.newCount, 7);
  assert.deepEqual(at(columnFirst, 5, 3).connections, ['south', 'west']);
  assert.equal(at(columnFirst, 5, 3).kind, 'corner');
  assert.deepEqual(at(rowFirst, 2, 6).connections, ['north', 'east']);
  assert.equal(at(rowFirst, 2, 6).kind, 'corner');
  assert.notDeepEqual(columnFirst.preview.cells, rowFirst.preview.cells);
});

test('all four corner orientations are derived from cells', () => {
  for (const [a, b, directions] of [
    [point(4, 2), point(6, 4), ['north', 'east']],
    [point(6, 4), point(4, 6), ['east', 'south']],
    [point(4, 6), point(2, 4), ['south', 'west']],
    [point(2, 4), point(4, 2), ['north', 'west']],
  ]) {
    const result = line([a, point(4, 4), b]);
    assert.equal(at(result, 4, 4).kind, 'corner');
    assert.deepEqual(at(result, 4, 4).connections, directions);
  }
});

test('a singleton is a post; retracing and closed lines never charge duplicate cells', () => {
  const singleton = line([point(2, 2)]);
  assert.equal(singleton.plan.added[0].kind, 'post');
  assert.deepEqual(singleton.preview.cost, segmentCost);
  assert.deepEqual(line([point(2, 2), point(4, 2), point(4, 2), point(2, 2)]),
    line([point(2, 2), point(4, 2)]));
  const loop = line([point(2, 2), point(4, 2), point(4, 4), point(2, 4), point(2, 2)]);
  assert.equal(loop.preview.newCount, 8);
  assert.equal(loop.preview.pieces.filter(p => p.kind === 'corner').length, 4);
  assert.deepEqual(loop.preview.cost, { food: 16, wood: 24 });
});

test('reuses existing wall cells and updates both sides of a join without charging them', () => {
  const result = line([point(3, 4), point(5, 4)], { existingWallCells: [4 * 16 + 2, 4 * 16 + 3] });
  assert.equal(result.preview.newCount, 2);
  assert.equal(result.preview.reusedCount, 1);
  assert.deepEqual(result.preview.cost, { food: 4, wood: 6 });
  assert.deepEqual(result.plan.updated.map(p => p.cell), [4 * 16 + 3]);
  assert.equal(result.plan.updated[0].kind, 'straight');
  const extended = line([point(4, 4), point(5, 4)], { existingWallCells: [4 * 16 + 2, 4 * 16 + 3] });
  assert.deepEqual(extended.plan.updated, result.plan.updated, 'adjacent existing cell outside drag is updated');
  const repeat = line([point(3, 4), point(5, 4)], {
    existingWallCells: [4 * 16 + 2, 4 * 16 + 3, 4 * 16 + 4, 4 * 16 + 5], balance: { food: 0, wood: 0 },
  });
  assert.deepEqual(repeat.plan, { added: [], updated: [], cost: { food: 0, wood: 0 } });
});

test('existing corners, T joins and four-way joins use the same connection contract', () => {
  const center = 4 * 16 + 4;
  for (const [existingWallCells, kind, directions] of [
    [[center, center - 16], 'corner', ['north', 'east']],
    [[center, center - 16, center + 16], 'junction', ['north', 'east', 'south']],
    [[center, center - 16, center + 16, center - 1], 'junction', ['north', 'east', 'south', 'west']],
  ]) {
    const result = line([point(5, 4)], { existingWallCells });
    assert.equal(result.plan.updated[0].cell, center);
    assert.equal(result.plan.updated[0].kind, kind);
    assert.deepEqual(result.plan.updated[0].connections, directions);
    assert.deepEqual(result.preview.cost, segmentCost);
  }
});

test('connections never wrap between the east and west edges of a rectangular map', () => {
  const result = planWallLine({ width: 5, height: 3, points: [point(4, 0)],
    existingWallCells: [5], segmentCost });
  assert.equal(result.plan.added[0].kind, 'post');
  assert.deepEqual(result.plan.updated, []);
  const border = planWallLine({ width: 5, height: 3, points: [point(0, 0), point(4, 0)], segmentCost });
  assert.equal(border.preview.newCount, 5);
});

test('blocked and occupied cells reject the whole line, retaining its full cost preview', () => {
  const result = line([point(2, 3), point(5, 3)], {
    blockedCells: new Set([3 * 16 + 3]), occupiedCells: [3 * 16 + 4],
  });
  assert.equal(result.status, 'invalid');
  assert.equal(result.plan, null);
  assert.deepEqual(result.errors, [
    { code: 'blocked-cell', cell: 3 * 16 + 3 }, { code: 'occupied-cell', cell: 3 * 16 + 4 },
  ]);
  assert.equal(result.preview.newCount, 4);
  assert.deepEqual(result.preview.cost, { food: 8, wood: 12 });
});

test('a compatible existing wall cannot bypass occupancy or terrain validation', () => {
  for (const cell of [4 * 16 + 3, 4 * 16 + 4]) for (const field of ['blockedCells', 'occupiedCells']) {
    const result = line([point(4, 4), point(5, 4)], {
      existingWallCells: [4 * 16 + 2, 4 * 16 + 3], [field]: [cell],
    });
    assert.equal(result.status, 'invalid');
    assert.equal(result.plan, null);
    assert.equal(result.errors[0].cell, cell);
  }
});

test('off-map endpoints reject without clamping or creating an alias cell', () => {
  for (const p of [point(-1, 3), point(16, 0), point(2, -1), point(2, 16)]) {
    const result = line([point(2, 3), p]);
    assert.equal(result.status, 'invalid');
    assert.equal(result.plan, null);
    assert.equal(result.preview, null);
    assert.deepEqual(result.errors, [{ code: 'outside-map', waypoint: 1, ...p }]);
  }
});

test('no wall price is invented; explicit configured food/wood costs use registry conventions', () => {
  assert.equal(BUILDING_DEFINITIONS.wall, undefined);
  const pending = line([point(2, 3), point(5, 3)], { segmentCost: null });
  assert.equal(pending.status, 'cost-required');
  assert.equal(pending.plan, null);
  assert.equal(pending.preview.cost, null);
  assert.equal(pending.preview.newCount, 4);
  // A known building price is just an input-shape example, never a default wall price.
  const configured = line([point(2, 3), point(5, 3)], { segmentCost: BUILDING_DEFINITIONS.house.cost });
  assert.deepEqual(configured.preview.cost, { food: 0, wood: 300 });
  const free = line([point(2, 3)], { segmentCost: { food: 0, wood: 0 }, balance: { food: 0, wood: 0 } });
  assert.equal(free.status, 'ready');
});

test('affordability is atomic for either currency, with exact and fractional balances', () => {
  for (const balance of [{ food: 7.999, wood: 12 }, { food: 8, wood: 11.999 }]) {
    const result = line([point(2, 3), point(5, 3)], { balance });
    assert.equal(result.status, 'insufficient-resources');
    assert.equal(result.preview.affordable, false);
    assert.equal(result.plan, null);
  }
  const result = line([point(2, 3), point(5, 3)], { balance: { food: 8, wood: 12 } });
  assert.equal(result.status, 'ready');
  assert.equal(result.preview.affordable, true);
  assert.equal(result.plan.added.length, 4);
  assert.equal(line([point(2, 3)]).preview.affordable, null, 'absent balance is explicitly unknown');
});

test('current House and home Town Center footprint cells act as ordinary occupancy', () => {
  const half = Math.floor(BUILDING_DEFINITIONS.house.footprint / 2);
  const house = [];
  for (let row = 8 - half; row <= 8 + half; row++) for (let column = 8 - half; column <= 8 + half; column++) {
    house.push(row * 16 + column);
  }
  const home = townCenterFootprintCells([{ team: 0, x: -4, z: -4 }, { team: 1, x: 4, z: 4 }], 0, 16, 16);
  const occupiedCells = [...house, ...home];
  const result = line([point(0, 8), point(15, 8)], { occupiedCells });
  assert.equal(result.plan, null);
  assert.deepEqual(result.errors.map(e => e.cell), [8 * 16 + 7, 8 * 16 + 8, 8 * 16 + 9]);
  assert.equal(line([point(home[0] % 16, Math.floor(home[0] / 16))], { occupiedCells }).plan, null);
});

test('inputs remain unchanged on success, rejection and decision results', () => {
  const points = Object.freeze([Object.freeze(point(2, 3)), Object.freeze(point(5, 3))]);
  const existingWallCells = new Set([3 * 16 + 1]);
  const occupiedCells = new Set([3 * 16 + 4]);
  const balance = Object.freeze({ food: 8, wood: 12 });
  for (const options of [{}, { occupiedCells }, { segmentCost: null }]) {
    const result = line(points, { existingWallCells, balance, ...options });
    if (result.plan) result.plan.added[0].connections.push('modified-output');
    assert.deepEqual([...existingWallCells], [3 * 16 + 1]);
    assert.deepEqual([...occupiedCells], [3 * 16 + 4]);
    assert.deepEqual(balance, { food: 8, wood: 12 });
    assert.deepEqual(points, [point(2, 3), point(5, 3)]);
  }
});

test('malformed inputs and currency extensions fail before returning a usable plan', () => {
  for (const options of [
    { width: 0 }, { height: 257 }, { width: 1.5 }, { points: [] }, { points: Array(257).fill(point(1, 1)) },
    { points: [point(2.5, 3)] }, { points: [point(NaN, 3)] }, { axisOrder: 'diagonal' },
    { blockedCells: [-1] }, { occupiedCells: [256] }, { existingWallCells: [0.5] },
    { occupiedCells: new Uint8Array(256) }, { segmentCost: {} }, { segmentCost: { wood: 3 } },
    { segmentCost: { food: -1, wood: 0 } }, { segmentCost: { food: 0, wood: Infinity } },
    { segmentCost: { food: 0, wood: 1, stone: 5 } }, { balance: { food: 0, wood: NaN } },
    { segmentCost: { food: Number.MAX_VALUE, wood: 1 } },
  ]) assert.throws(() => line([point(2, 3), point(5, 3)], options), TypeError);
});

test('occupancy facts are bounded before cloning or deduplicating input', () => {
  for (const field of ['blockedCells', 'occupiedCells', 'existingWallCells']) {
    assert.throws(() => line([point(2, 3)], { [field]: Array(257).fill(0) }), /cell count/);
    assert.throws(() => line([point(2, 3)], { [field]: new Set(Array.from({ length: 257 }, (_, i) => i)) }), /cell count/);
  }
  const result = line([point(2, 3)], { occupiedCells: Array(256).fill(0) });
  assert.equal(result.status, 'ready', 'duplicates within the explicit fact budget are legal');
});

test('bounded generated lines preserve reciprocal connections and complete rejection', () => {
  for (let start = 0; start < 25; start++) for (let end = 0; end < 25; end++) {
    const options = { width: 5, height: 5, segmentCost,
      points: [point(start % 5, Math.floor(start / 5)), point(end % 5, Math.floor(end / 5))] };
    const result = planWallLine(options);
    const pieces = new Map(result.plan.added.map(p => [p.cell, p]));
    assert.equal(pieces.size, Math.abs(start % 5 - end % 5) + Math.abs(Math.floor(start / 5) - Math.floor(end / 5)) + 1);
    for (const p of pieces.values()) for (const direction of p.connections) {
      const [delta, opposite] = { north: [-5, 'south'], east: [1, 'west'], south: [5, 'north'], west: [-1, 'east'] }[direction];
      assert.ok(pieces.get(p.cell + delta).connections.includes(opposite));
    }
    assert.equal(planWallLine({ ...options, occupiedCells: [start] }).plan, null);
  }
});
