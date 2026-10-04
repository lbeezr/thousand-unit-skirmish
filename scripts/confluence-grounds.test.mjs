import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { generateConfluenceGrounds, CONFLUENCE_LAYOUT as layout } from './generate-confluence-grounds.mjs';
import { auditMap, searchGrid } from './map-scale-audit.mjs';
import { buildElevationGrid } from '../src/map-utils.mjs';
import { townCenterFootprintCells } from '../src/town-center-spawn.mjs';
import { createDockPlacementContext } from '../src/dock-placement.mjs';
import { createWaterRouteGraph, findWaterCellRoute } from '../src/water-route-graph.mjs';
import { shoreFishSitePositions } from '../src/shore-fishing-placement.mjs';
import { BUILDING_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { constructionCostForProfile } from '../src/economy-profile.mjs';
import { mapSizeIdentity } from '../src/map-size-policy.mjs';
import { matchModeCatalog } from '../src/match-modes.mjs';

const map = JSON.parse(await readFile(new URL('../maps/siltmouths-confluence-grounds.json', import.meta.url)));
const levels = buildElevationGrid(160, 160, map.elevationPatches), scenery = new Uint8Array(25600);
for (const o of map.obstacles) for (let y = o.row; y < o.row + o.height; y++) for (let x = o.column; x < o.column + o.width; x++) {
  assert.equal(scenery[y * 160 + x], 0); scenery[y * 160 + x] = 1;
}
const blocked = scenery.slice();
for (const team of [0, 1]) for (const cell of townCenterFootprintCells(map.spawnPoints, team, 160, 160)) blocked[cell] = 1;
const cell = p => Math.floor(p.z + 80) * 160 + Math.floor(p.x + 80);
const audit = auditMap(map, { forestWoodPerCell: 6, defaultArmySize: 24, maxBuildings: 128 });

test('one deterministic admitted 160 arena uses finite ordinary banks and the existing Stone profile', async () => {
  assert.deepEqual(await generateConfluenceGrounds(), map);
  assert.deepEqual([map.width, map.height, map.startingArmySize], [160, 160, 24]);
  assert.deepEqual(map.startingResources, { food: 150, wood: 250 });
  assert.equal(map.economyProfileId, 'stone-defense-v1'); assert.equal(map.fogOfWar, true);
  assert.equal(map.triggers.length, 0); assert.equal(map.scenarioEvents.length, 0);
  assert.equal(mapSizeIdentity(map).ordinarySelectable, true);
  assert.ok(matchModeCatalog(map, { practice: true }).some(m => m.id === 'authored'));
  assert.deepEqual(constructionCostForProfile('watchtower', map.economyProfileId), { food: 50, wood: 150, stone: 50 });
  assert.deepEqual(audit.economy.ordinaryNodeStockTotals, { food: 3420, wood: 3300, stone: 600 });
});
test('all usable land is connected, with meaningful base pacing and two distinct fords plus rim alternatives', () => {
  assert.ok(audit.geometry.initialWalkableFraction >= .65);
  assert.deepEqual(audit.geometry.reachableCellsBySeat, [audit.geometry.initialWalkableCells, audit.geometry.initialWalkableCells]);
  assert.equal(audit.travel.minimumElevationCostRoute.worldLength, 135);
  assert.equal(audit.travel.allForestClearedRoute.worldLength, 131);
  for (const [first, last] of [...layout.crossings, [0, 9], [144, 159]]) {
    const mask = blocked.slice();
    for (let y = 0; y < 160; y++) if (y < first || y > last) mask[y * 160 + 79] = 1;
    assert.ok(Number.isFinite(searchGrid(160, 160, mask, levels, cell(map.spawnPoints[0]), false).distance[cell(map.spawnPoints[1])]),
      `complete route through rows ${first}–${last}`);
  }
});
test('home and expansion campuses are flat, developable, and admit the actual Farm/Mill/Watchtower plots', () => {
  for (const [cx, cy] of layout.homes) for (let y = cy - 20; y <= cy + 20; y++) for (let x = cx - 20; x <= cx + 20; x++) {
    assert.equal(scenery[y * 160 + x], 0); assert.equal(levels[y * 160 + x], 1);
  }
  assert.deepEqual(audit.buildingSpace.cityTemplate.staticGreedyFlatPadFitsBySeat.map(s => s.placedBuildings), [30, 30]);
  const nodes = new Set(map.resourceNodes.map(cell));
  for (const [cx, cy] of [...layout.expansions, ...Object.values(layout.plots), ...Object.values(layout.plots).map(([x, y]) => [159 - x, y])]) {
    const radius = layout.expansions.some(([x, y]) => x === cx && y === cy) ? 4 : 1;
    for (let y = cy - radius; y <= cy + radius; y++) for (let x = cx - radius; x <= cx + radius; x++) {
      assert.equal(blocked[y * 160 + x], 0); assert.equal(nodes.has(y * 160 + x), false); assert.equal(levels[y * 160 + x], 1);
    }
  }
});
test('both zero-level Dock banks provide clear berths, shared navigable bays and fish reachable by land and water', () => {
  const docks = createDockPlacementContext(map, BUILDING_DEFINITIONS.dock), graph = createWaterRouteGraph(map, { clearanceCells: 1 });
  const access = layout.docks.map(([c, r]) => docks.accessAt(r * 160 + c));
  assert.ok(access.every(a => a.valid)); assert.equal(access[0].waterComponent, access[1].waterComponent);
  assert.ok(findWaterCellRoute(graph, access[0].exitCell, access[1].exitCell));
  assert.ok(graph.navigableCellCount > 3500);
  const sites = shoreFishSitePositions(map); assert.equal(sites.length, 2);
  for (const site of sites) {
    const c = site.water.column, r = site.water.row;
    const candidates = [-1, 0, 1].flatMap(dz => [-1, 0, 1].map(dx => (r + dz) * 160 + c + dx)).filter(x => graph.isNavigable(x));
    assert.ok(candidates.length > 0); assert.ok(findWaterCellRoute(graph, access[0].exitCell, candidates[0]));
    assert.ok(audit.economy.resources.find(n => n.id === site.nodeId).shortestCostRouteWorldLengths.every(Number.isFinite));
  }
});
test('mirrored resource stock and neutral Sheep are useful near both openings without changing the old fixture identities', () => {
  for (let y = 0; y < 160; y++) for (let x = 0; x < 80; x++) {
    assert.equal(scenery[y * 160 + x], scenery[y * 160 + 159 - x]); assert.equal(levels[y * 160 + x], levels[y * 160 + 159 - x]);
  }
  for (const node of map.resourceNodes.filter(n => n.id.startsWith('s0-'))) {
    const twin = map.resourceNodes.find(n => n.id === node.id.replace('s0-', 's1-'));
    assert.equal(node.x, -twin.x); assert.equal(node.z, twin.z); assert.equal(node.stock, twin.stock);
  }
  for (const team of [0, 1]) {
    for (const type of ['food', 'wood']) assert.ok(map.resourceNodes.some(node => node.type === type
      && Math.hypot(node.x - map.spawnPoints[team].x, node.z - map.spawnPoints[team].z) <= 9),
    `visible home ${type} for seat ${team}`);
    const sheep = map.resourceNodes.filter(n => n.id.startsWith(`s${team}-sheep-`)); assert.equal(sheep.length, 3);
    assert.ok(sheep.every(n => n.wildlifeSpecies === 'bellweather-sheep' && n.wildlifeTeam === undefined));
    assert.ok(sheep.every(n => Math.hypot(n.x - map.spawnPoints[team].x, n.z - map.spawnPoints[team].z) < 13));
    assert.equal(map.resourceNodes.filter(n => n.id.startsWith(`s${team}-stone-`)).reduce((s, n) => s + n.stock, 0), 200);
  }
});
