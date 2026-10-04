// CPU source slices, not a browser/rendered-game fixture.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { VisionCoverageCache } from '../src/server/vision-coverage-cache.mjs';
import { exploredForestFringe } from '../src/forest-fringe.mjs';
import { UNIT_DEFINITIONS, BUILDING_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { buildElevationGrid } from '../src/map-utils.mjs';

const server = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
const client = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const baseline = await readFile(new URL('./fixtures/forest-vision-53a47ee.txt', import.meta.url), 'utf8');
function slice(source, start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `source seam changed: ${start}`);
  return source.slice(a, b);
}
export function visionFixture(map, { original = false, cacheOptions = {} } = {}) {
  const count = map.width * map.height;
  const context = vm.createContext({
    MAP_WIDTH: map.width, MAP_HEIGHT: map.height, MAP_HALF_X: map.width / 2, MAP_HALF_Z: map.height / 2,
    VisionCoverageCache, visionCoverageGeneration: 0, visionMasksUpdatedTick: -1, visionMasksUpdatedCoverage: null,
    tickNumber: 1, mapDefinition: { fogOfWar: true }, units: [], UNIT_DEFINITIONS, BUILDING_DEFINITIONS,
    allMatchBuildings: () => [],
    VISION_RADIUS_CELLS: 8, HIGH_GROUND_VISION_BONUS_CELLS: 1, VISION_EYE_HEIGHT: 1,
    visibleCellsByTeam: [new Uint8Array(count), new Uint8Array(count)],
    exploredCellsByTeam: [new Uint8Array(count), new Uint8Array(count)],
    processedVisionSourcesByTeam: [new Uint8Array(count), new Uint8Array(count)],
    visionCoverageBySourceCell: original ? new Array(count) : new VisionCoverageCache({ width: map.width, height: map.height, ...cacheOptions }),
    forestCellMask: new Uint8Array(count), visionBlockers: new Uint8Array(count),
    visionBlockHeights: new Float32Array(count), buildingBlocked: new Uint8Array(count),
    elevationLevelByCell: buildElevationGrid(map.width, map.height, map.elevationPatches), exploredForestFringe,
  });
  for (const obstacle of map.obstacles) for (let row = obstacle.row; row < obstacle.row + obstacle.height; row++) {
    for (let col = obstacle.column; col < obstacle.column + obstacle.width; col++) {
      const cell = row * map.width + col;
      if (obstacle.material === 'forest') context.forestCellMask[cell] = 1;
      if (['forest', 'stone'].includes(obstacle.material)) {
        context.visionBlockers[cell] = 1;
        context.visionBlockHeights[cell] = obstacle.elevation ?? 1.12;
      }
    }
  }
  vm.runInContext(slice(server, 'function buildVisionRays(', 'const WORKER_SPAWN_OFFSETS'), context);
  vm.runInContext(slice(server, 'const visionRaysByRadius =', 'function markVisionFrom('), context);
  vm.runInContext(original ? baseline : slice(server, 'function markVisionFrom(', 'function updateVisionMasks('), context);
  if (!original) {
    vm.runInContext(slice(server, 'function invalidateVisionCoverage(', 'function activateMap('), context);
    vm.runInContext(slice(server, 'function updateVisionMasks(', 'function cellVisibleToTeam('), context);
  }
  return { context, mark(team, col, row, sight = 8) {
    context.markVisionFrom(team, col - map.width / 2 + .5, row - map.height / 2 + .5, sight);
  }, clearCurrent() {
    for (const team of [0, 1]) {
      context.visibleCellsByTeam[team].fill(0);
      context.processedVisionSourcesByTeam[team].fill(0);
    }
  } };
}

export function fogClientFixture(map, team = 0) {
  const count = map.width * map.height, stockWrites = [];
  const context = vm.createContext({
    localTeam: team, MAP_WIDTH: map.width, MAP_HEIGHT: map.height,
    mapDefinition: map, fogMesh: { visible: true }, latestFogCells: null,
    fogTexture: { image: { data: new Uint8Array(count * 4) } },
    minimapFogImage: { data: new Uint8Array(count * 4) },
    minimapFogContext: { putImageData() {} }, performance: { now: () => 1000 }, drawMinimap() {},
    atob: data => Buffer.from(data, 'base64').toString('binary'),
    latestForestEpoch: null, latestForestStocks: new Map(), latestResourceStocks: new Map(),
    forestTreeSlots: new Map(Array.from({ length: count }, (_, cell) => [cell, { cell }])),
    forestStumpSlots: new Map(), forestStumpMesh: null,
    setForestSpriteStock: (slot, stock) => stockWrites.push([slot.cell, stock]),
    resourceVisualStage: stock => stock <= 0 ? 'depleted' : stock < 2 ? 'low' : stock < 4 ? 'worked' : 'full',
  });
  vm.runInContext(slice(client, 'function updateFogFromState(', 'let terrainSurface ='), context);
  return { context, stockWrites, apply(state, initial = false) {
    context.applyForestState(state, initial);
    context.updateFogFromState(state);
  } };
}

export function fogCode(state, cell) {
  return (Buffer.from(state.visibility.data, 'base64')[cell >> 2] >> ((cell & 3) * 2)) & 3;
}
