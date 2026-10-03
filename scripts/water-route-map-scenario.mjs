import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createWaterRouteGraph, findWaterCellRoute, isWaterCellRouteValid } from '../src/water-route-graph.mjs';
import { waterRaster, waterContours, contourArea } from '../src/water-contours.mjs';
import { shoreFishSitePositions } from '../src/shore-fishing-placement.mjs';

const directory = new URL('../maps/', import.meta.url), records = [];
let componentsTested = 0, routesTested = 0, fishSitesTested = 0;
for (const filename of (await readdir(directory)).filter(name => name.endsWith('.json')).sort()) {
  const map = JSON.parse(await readFile(new URL(filename, directory))), before = JSON.stringify(map);
  const graph = createWaterRouteGraph(map), wet = waterRaster(map), representatives = new Map();
  const landBlocked = new Uint8Array(graph.cellCount);
  for (const rect of map.obstacles) for (let row = rect.row; row < rect.row + rect.height; row++) {
    landBlocked.fill(1, row * map.width + rect.column, row * map.width + rect.column + rect.width);
  }
  for (let cell = 0; cell < graph.cellCount; cell++) {
    if (!graph.isNavigable(cell)) continue;
    assert.equal(wet[cell], 1); assert.equal(landBlocked[cell], 1, `${map.id}: routed water is blocked for land units`);
    const p = graph.pointAt(cell); assert.equal(graph.cellAt(p.x, p.z), cell);
    const component = graph.componentAt(cell), pair = representatives.get(component);
    if (pair) pair.last = cell; else representatives.set(component, { first: cell, last: cell });
  }
  assert.equal(representatives.size, graph.componentCount);
  // Existing shipped water is flat. The contour's positive rings identify the
  // same separate basins; hole rings never create a new water component.
  assert.equal(graph.navigableCellCount, wet.reduce((sum, value) => sum + value, 0), `${map.id}: no raised water silently admitted`);
  assert.equal(graph.componentCount, waterContours(map).filter(ring => contourArea(ring.map(edge => edge.a)) > 0).length);
  for (const { first, last } of representatives.values()) {
    const route = findWaterCellRoute(graph, first, last);
    assert.equal(route.status, 'found'); assert.ok(isWaterCellRouteValid(graph, route.cells, { startCell: first, goalCell: last }));
    assert.ok(route.expandedCells <= graph.cellCount); routesTested++;
  }
  const basins = [...representatives.values()];
  for (let index = 1; index < basins.length; index++) {
    assert.equal(findWaterCellRoute(graph, basins[0].first, basins[index].first).status, 'disconnected');
  }
  for (const site of shoreFishSitePositions(map)) {
    const water = graph.cellAt(site.water.x, site.water.z), land = graph.cellAt(site.land.x, site.land.z);
    assert.ok(graph.isNavigable(water)); assert.equal(graph.isNavigable(land), false);
    assert.equal(findWaterCellRoute(graph, land, water).status, 'invalid-endpoints'); fishSitesTested++;
  }
  assert.equal(JSON.stringify(map), before, 'graph construction and routes never edit map, stocks or identity');
  componentsTested += graph.componentCount;
  records.push({ map: map.id, waterCells: graph.navigableCellCount, components: graph.componentCount });
}
console.log(JSON.stringify({ scenario: 'water-only route foundation on shipped maps', maps: records.length,
  componentsTested, routesTested, fishSitesTested, landDomainUntouched: true,
  gameplayAvailability: 'offline topology only; no boats, dock placement, production or cargo adapter', records }));
