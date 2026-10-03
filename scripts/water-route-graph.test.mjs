import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createWaterRouteGraph, canTraverseWaterEdge, findWaterCellRoute, isWaterCellRouteValid } from '../src/water-route-graph.mjs';
import { waterRaster, waterContours, contourArea } from '../src/water-contours.mjs';
import { shoreFishSitePositions } from '../src/shore-fishing-placement.mjs';

const rect = (column, row, width, height, material = 'water') => ({ column, row, width, height, material });
const map = obstacles => ({ width: 8, height: 6, terrainBase: 'meadow', obstacles });
const graph = (definition, options) => createWaterRouteGraph(definition, options);

test('water routes take deterministic shortest cardinal paths around a dry island', () => {
  const definition = map([rect(1, 1, 6, 1), rect(1, 4, 6, 1), rect(1, 2, 1, 2), rect(6, 2, 1, 2)]);
  const nav = graph(definition), start = 17, goal = 22;
  const route = findWaterCellRoute(nav, start, goal);
  assert.equal(route.status, 'found');
  assert.deepEqual(route.cells, [17, 9, 10, 11, 12, 13, 14, 22]);
  assert.equal(route.cells.length - 1, 7, 'five horizontal steps and two island-avoidance steps');
  assert.deepEqual(findWaterCellRoute(nav, start, goal), route);
  assert.equal(isWaterCellRouteValid(nav, route.cells, { startCell: start, goalCell: goal }), true);
  assert.equal(isWaterCellRouteValid(nav, [...route.cells, start]), false, 'no jump over the island');
  assert.equal(nav.componentCount, 1); assert.equal(nav.navigableCellCount, 16);
});

test('ponds, diagonal touches and row boundaries cannot invent connections or endpoint snapping', () => {
  const nav = graph(map([rect(1, 1, 2, 1), rect(3, 2, 1, 1), rect(7, 3, 1, 1), rect(0, 4, 1, 1)]));
  assert.equal(nav.componentCount, 4);
  for (const [a, b] of [[10, 19], [31, 32]]) {
    assert.equal(canTraverseWaterEdge(nav, a, b), false);
    assert.deepEqual(findWaterCellRoute(nav, a, b), { status: 'disconnected', expandedCells: 0, cells: [] });
  }
  for (const cell of [-1, 48, .5, NaN, null, 0]) {
    assert.equal(nav.isNavigable(cell), false);
    assert.equal(findWaterCellRoute(nav, 9, cell).status, 'invalid-endpoints');
    assert.equal(findWaterCellRoute(nav, cell, 9).status, 'invalid-endpoints');
  }
  assert.equal(canTraverseWaterEdge(nav, 9, 9), false);
  assert.deepEqual(findWaterCellRoute(nav, 9, 9), { status: 'found', expandedCells: 0, cells: [9] });
  assert.equal(isWaterCellRouteValid(nav, []), false);
  assert.equal(isWaterCellRouteValid(nav, Array(1)), false, 'sparse arrays contain no navigable cells');
  assert.equal(isWaterCellRouteValid(nav, [9], { goalCell: 10 }), false);
});

test('painted water, non-water obstacles and raised water are excluded; land and water masks remain disjoint', () => {
  const definition = map([rect(1, 1, 5, 1), rect(1, 3, 1, 1, 'forest'), rect(3, 3, 1, 1, 'stone')]);
  definition.terrainPatches = [rect(0, 0, 8, 6, 'water')];
  definition.elevationPatches = [{ column: 3, row: 1, width: 1, height: 1, level: 1 }];
  const nav = graph(definition);
  assert.equal(nav.navigableCellCount, 4); assert.equal(nav.componentCount, 2);
  assert.equal(findWaterCellRoute(nav, 9, 13).status, 'disconnected');
  for (const cell of [0, 11, 25, 27]) assert.equal(nav.isNavigable(cell), false);
  const landBlocked = new Uint8Array(48);
  for (const obstacle of definition.obstacles) for (let row = obstacle.row; row < obstacle.row + obstacle.height; row++) {
    landBlocked.fill(1, row * 8 + obstacle.column, row * 8 + obstacle.column + obstacle.width);
  }
  for (let cell = 0; cell < 48; cell++) if (nav.isNavigable(cell)) assert.equal(landBlocked[cell], 1);
});

test('reservations invalidate old routes and clearance excludes narrow channels and off-map space', () => {
  const definition = map([rect(1, 2, 6, 1)]), nav = graph(definition);
  const route = findWaterCellRoute(nav, 17, 22);
  const reserved = graph(definition, { reservedCells: [19] });
  assert.equal(findWaterCellRoute(reserved, 17, 22).status, 'disconnected');
  assert.equal(isWaterCellRouteValid(reserved, route.cells), false);
  assert.equal(isWaterCellRouteValid(nav, route.cells), true, 'earlier snapshot remains independent');
  assert.equal(graph(definition, { clearanceCells: 1 }).navigableCellCount, 0, 'one-cell channel has no 3x3 clearance');
  const wide = graph(map([rect(0, 0, 8, 6)]), { clearanceCells: 1 });
  assert.equal(wide.navigableCellCount, 24);
  assert.equal(wide.isNavigable(0), false); assert.equal(wide.isNavigable(9), true);
  const obstacle = graph(map([rect(0, 0, 8, 6)]), { clearanceCells: 1, reservedCells: [19] });
  for (const cell of [10, 11, 12, 18, 19, 20, 26, 27, 28]) assert.equal(obstacle.isNavigable(cell), false);
});

test('search budgets report exhaustion separately from disconnected topology; masks and returned routes are private snapshots', () => {
  const definition = map([rect(0, 0, 8, 6)]), reservations = [];
  const nav = graph(definition, { reservedCells: reservations });
  Object.freeze(definition.obstacles[0]); Object.freeze(definition.obstacles); Object.freeze(definition);
  const limited = findWaterCellRoute(nav, 0, 47, { maxExpandedCells: 2 });
  assert.deepEqual(limited, { status: 'budget-exhausted', expandedCells: 2, cells: [] });
  const complete = findWaterCellRoute(nav, 0, 47);
  assert.equal(complete.status, 'found'); assert.equal(complete.cells.length, 13);
  reservations.push(0, 47);
  assert.equal(nav.isNavigable(0), true);
  complete.cells[0] = 47;
  assert.equal(findWaterCellRoute(nav, 0, 47).cells[0], 0);
  assert.equal(Object.isFrozen(nav), true);
  assert.throws(() => findWaterCellRoute({ ...nav }, 0, 47), /Expected a water route graph/);
  assert.throws(() => findWaterCellRoute(JSON.parse(JSON.stringify(nav)), 0, 47), /Expected a water route graph/);
  for (const budget of [0, -1, 49, .5, Infinity]) assert.throws(() => findWaterCellRoute(nav, 0, 47, { maxExpandedCells: budget }), /budget/);
});

test('world/cell conversion keeps half-open map bounds and never clamps outside positions', () => {
  const nav = graph(map([rect(0, 0, 8, 6)]));
  for (let cell = 0; cell < nav.cellCount; cell++) {
    const p = nav.pointAt(cell); assert.equal(nav.cellAt(p.x, p.z), cell);
  }
  assert.equal(nav.cellAt(-4, -3), 0); assert.equal(nav.cellAt(3.999, 2.999), 47);
  for (const [x, z] of [[-4.001, 0], [4, 0], [0, -3.001], [0, 3], [NaN, 0], [0, Infinity]]) assert.equal(nav.cellAt(x, z), -1);
  assert.equal(nav.pointAt(48), null); assert.equal(nav.pointAt(.5), null);
});

test('the largest supported grid obeys its declared search and clearance bounds', () => {
  const definition = { width: 256, height: 256, obstacles: [rect(0, 0, 256, 256)] };
  const nav = graph(definition), last = 256 * 256 - 1;
  assert.equal(nav.componentCount, 1); assert.equal(nav.navigableCellCount, 65_536);
  const route = findWaterCellRoute(nav, 0, last);
  assert.equal(route.status, 'found'); assert.equal(route.cells.length, 511);
  assert.ok(route.expandedCells <= nav.cellCount);
  assert.ok(isWaterCellRouteValid(nav, route.cells, { startCell: 0, goalCell: last }));
  assert.equal(findWaterCellRoute(nav, 0, last, { maxExpandedCells: 4096 }).status, 'budget-exhausted');
  assert.equal(graph(definition, { clearanceCells: 4 }).navigableCellCount, 248 ** 2);
});

test('geometry validation rejects malformed, overlapping or unbounded inputs without editing them', () => {
  const bad = [null, { ...map([]), width: 0 }, { ...map([]), height: 257 }, { ...map([]), obstacles: null },
    map([rect(-1, 0, 2, 2)]), map([rect(7, 0, 2, 2)]), map([rect(0, 0, 0, 2)]),
    map([rect(.5, 0, 1, 1)]), map([rect(0, 0, 1, 1, 'ice')]),
    map([rect(0, 0, 2, 2), rect(1, 1, 1, 1, 'stone')]),
    { ...map([]), elevationPatches: [{ column: 0, row: 0, width: 1, height: 1, level: 3 }] }];
  for (const definition of bad) {
    const before = JSON.stringify(definition); assert.throws(() => graph(definition)); assert.equal(JSON.stringify(definition), before);
  }
  for (const options of [{ clearanceCells: -1 }, { clearanceCells: 5 }, { clearanceCells: .5 },
    { reservedCells: [-1] }, { reservedCells: [48] }, { reservedCells: [NaN] }, { reservedCells: Array(1) }, { reservedCells: new Set() }]) assert.throws(() => graph(map([]), options));
  const empty = graph(map([])); assert.equal(empty.componentCount, 0); assert.equal(empty.navigableCellCount, 0);
});

test('all 512 local wet/dry patterns agree with existing water contour component boundaries', () => {
  for (let pattern = 0; pattern < 512; pattern++) {
    const definition = { width: 3, height: 3, obstacles: [] };
    for (let cell = 0; cell < 9; cell++) if (pattern & 1 << cell) definition.obstacles.push(rect(cell % 3, Math.floor(cell / 3), 1, 1));
    const nav = graph(definition), wet = waterRaster(definition);
    const outerRings = waterContours(definition).filter(ring => contourArea(ring.map(edge => edge.a)) > 0);
    assert.equal(nav.componentCount, outerRings.length, `pattern ${pattern}`);
    assert.equal(nav.navigableCellCount, wet.reduce((sum, value) => sum + value, 0));
    for (let cell = 0; cell < 9; cell++) assert.equal(nav.isNavigable(cell), wet[cell] === 1);
  }
});

test('shipped fish pilot keeps its land approaches separate from two isolated water components and its food unchanged', async () => {
  const definition = JSON.parse(await readFile(new URL('../maps/shore-fishing.json', import.meta.url)));
  const before = JSON.stringify(definition), nav = graph(definition), sites = shoreFishSitePositions(definition);
  const cells = sites.map(site => nav.cellAt(site.water.x, site.water.z));
  assert.equal(nav.componentCount, 2); assert.equal(nav.navigableCellCount, 32);
  assert.equal(findWaterCellRoute(nav, ...cells).status, 'disconnected');
  for (const site of sites) {
    assert.equal(nav.isNavigable(nav.cellAt(site.water.x, site.water.z)), true);
    const bank = nav.cellAt(site.land.x, site.land.z);
    assert.equal(nav.isNavigable(bank), false);
    assert.equal(findWaterCellRoute(nav, bank, cells[0]).status, 'invalid-endpoints');
  }
  assert.equal(JSON.stringify(definition), before);
});
