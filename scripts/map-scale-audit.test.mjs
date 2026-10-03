import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { auditMap, runAudit, searchGrid, summaryRecords } from './map-scale-audit.mjs';
import { BUILDING_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { buildElevationGrid } from '../src/map-utils.mjs';
import { townCenterFootprintCells } from '../src/town-center-spawn.mjs';

const constants = { defaultMapId: 'bellweather-millrace', maxBuildings: 128,
  forestWoodPerCell: 6, defaultArmySize: 1000 };
const fixture = () => ({ id: 'fixture', name: 'Fixture', width: 32, height: 32,
  spawnPoints: [{ team: 0, x: -8.5, z: .5 }, { team: 1, x: 8.5, z: .5 }],
  obstacles: [], resourceNodes: [], triggers: [] });
const loadMap = async name => JSON.parse(await readFile(new URL(`../maps/${name}.json`, import.meta.url)));

test('cardinal routes cannot cross a two-level cliff, but can use a 0/1/2 ramp', () => {
  const blocked = new Uint8Array(9), levels = new Uint8Array([0, 2, 2, 0, 2, 2, 0, 2, 2]);
  assert.equal(searchGrid(3, 3, blocked, levels, 0).distance[2], Infinity);
  levels[1] = 1;
  assert.equal(searchGrid(3, 3, blocked, levels, 0).distance[2], 230);
  assert.equal(searchGrid(3, 3, blocked, levels, 2).distance[0], 200);
});

test('unique obstacle area, forest potential and the all-cleared route stay distinct', () => {
  const map = fixture();
  map.obstacles = [
    { column: 15, row: 0, width: 2, height: 32, material: 'forest' },
    { column: 15, row: 0, width: 1, height: 10, material: 'forest' },
  ];
  const result = auditMap(map, constants);
  assert.equal(result.geometry.obstacleCellsByMaterial.forest, 64);
  assert.equal(result.economy.initialForestWoodPotential, 384);
  assert.equal(result.travel.minimumElevationCostRoute, null);
  assert.equal(result.travel.allForestClearedRoute.worldLength, 17);
  assert.deepEqual(result.buildingSpace.initialHomeTownCenterFootprintCellsBySeat, [16, 16]);
});

test('resource markers and objectives reserve construction space without blocking travel', () => {
  const map = fixture();
  map.resourceNodes = [{ id: 'food', type: 'food', x: .5, z: .5, stock: 100 }];
  map.triggers = [{ id: 'center', name: 'Center', zone: { column: 15, row: 15, width: 3, height: 3 } }];
  const result = auditMap(map, constants);
  assert.equal(result.travel.minimumElevationCostRoute.worldLength, 17);
  assert.equal(result.geometry.initialWalkableCells - result.buildingSpace.eligibleGroundCells, 9);
  assert.equal(result.economy.ordinaryNodeStockTotals.food, 100);
});

test('odd rectangular grids preserve one world unit per cardinal edge and absent banks mean zero', () => {
  const map = { ...fixture(), width: 33, height: 25,
    spawnPoints: [{ team: 0, x: -8, z: 0 }, { team: 1, x: 8, z: 0 }] };
  const result = auditMap(map, constants);
  assert.equal(result.travel.minimumElevationCostRoute.worldLength, 16);
  assert.deepEqual(result.economy.startingResourcesPerSeat, { food: 0, wood: 0, stone: 0 });
  map.startingResources = { food: 20 };
  assert.deepEqual(auditMap(map, constants).economy.startingResourcesPerSeat, { food: 20, wood: 0, stone: 0 });
});

test('mixed height footprints are reported separately from recommended flat pads', () => {
  const map = fixture();
  map.elevationPatches = [{ column: 16, row: 0, width: 16, height: 32, level: 1 }];
  const result = auditMap(map, constants);
  const centers = result.buildingSpace.centersByFootprint[3];
  assert.ok(centers.legalCenters > centers.flatPadCenters);
  assert.equal(result.travel.minimumElevationCostRoute.worldLength, 17);
  assert.equal(result.travel.minimumElevationCostRoute.weightedCost, 1715);
  assert.equal(result.travel.minimumElevationCostRoute.nominalTravelSeconds.worker, 6.538);
});

test('current flagships use specific unit speeds and preserve forest-cut shortcut geometry', async () => {
  const millrace = auditMap(await loadMap('bellweather-millrace'), constants);
  const rootways = auditMap(await loadMap('underbough-rootways'), constants);
  assert.equal(millrace.travel.minimumElevationCostRoute.worldLength, 51);
  assert.deepEqual(millrace.travel.minimumElevationCostRoute.nominalTravelSeconds,
    { worker: 19.615, infantry: 19.615, scout: 11.333 });
  assert.equal(rootways.travel.minimumElevationCostRoute.worldLength, 81);
  assert.equal(rootways.travel.allForestClearedRoute.worldLength, 67);
  assert.equal(millrace.economy.startingArmyTotalUnits, 24);
});

test('reported city placements provide non-overlapping free circulation rings and flat footprints', async () => {
  const map = await loadMap('bellweather-millrace'), result = auditMap(map, constants);
  const used = new Set();
  const excluded = new Set();
  const levels = buildElevationGrid(map.width, map.height, map.elevationPatches);
  for (const team of [0, 1]) for (const cell of townCenterFootprintCells(map.spawnPoints, team, map.width, map.height)) excluded.add(cell);
  for (const rect of [...map.obstacles, ...map.triggers.map(t => t.zone)])
    for (let y = rect.row; y < rect.row + rect.height; y++)
      for (let x = rect.column; x < rect.column + rect.width; x++) excluded.add(y * map.width + x);
  for (const node of map.resourceNodes) excluded.add(Math.floor(node.z + map.height / 2) * map.width + Math.floor(node.x + map.width / 2));
  for (const fit of result.buildingSpace.cityTemplate.staticGreedyFlatPadFitsBySeat) {
    assert.equal(fit.completeTemplate, true);
    assert.equal(fit.addedHousePopulation, 96);
    for (const { kind, column, row } of fit.placements) {
      const half = Math.floor(BUILDING_DEFINITIONS[kind].footprint / 2) + 1;
      for (let y = row - half; y <= row + half; y++) for (let x = column - half; x <= column + half; x++) {
        const cell = y * map.width + x;
        assert.ok(x >= 0 && x < map.width && y >= 0 && y < map.height);
        assert.ok(!used.has(cell) && !excluded.has(cell)); used.add(cell);
        if (Math.abs(x - column) < half && Math.abs(y - row) < half)
          assert.equal(levels[cell], levels[row * map.width + column]);
      }
    }
  }
});

test('roster report covers all shipped files, records source hashes and separates Lab from solo defaults', async () => {
  const report = await runAudit();
  assert.equal(report.maps.length, 26);
  assert.equal(report.maps.filter(m => m.pool === 'regional').length, 13);
  assert.equal(report.maps.filter(m => m.purpose === 'regional-skirmish').length, 12);
  assert.equal(report.maps.find(m => m.id === 'shore-fishing').purpose, 'micro-fixture');
  assert.deepEqual(report.maps.filter(m => m.seededPve).map(m => m.id), ['bellweather-millrace', 'underbough-rootways']);
  assert.deepEqual(report.maps.filter(m => m.defaultPvp).map(m => m.id), ['bellweather-millrace']);
  assert.equal(report.maps.find(m => m.id === 'frontier-160').pool, 'lab');
  assert.equal(report.constants.ticksPerSecond, 30);
  assert.equal(report.timing.nominalGameSecondsPerWallSecond, 1);
  assert.equal(report.timing.observedGameSecondsPerWallSecond, null);
  assert.match(report.sourceInputSha256['maps/bellweather-millrace.json'], /^[0-9a-f]{64}$/);
  const records = summaryRecords(report);
  assert.equal(records.length, 27);
  assert.equal(records[0].record, 'methods');
  assert.equal(records[1].economy.resources, undefined);
  assert.equal(records[1].economy.geometricResourceClusterCount, report.maps[0].economy.geometricResourceClusters.length);
});
