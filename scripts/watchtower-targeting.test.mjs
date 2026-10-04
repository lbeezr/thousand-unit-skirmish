import { UNIT_DEFINITIONS, BUILDING_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { canCombatTarget } from '../src/combat-rules.mjs';
import { exploredForestFringe } from '../src/forest-fringe.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
const functions = source.slice(source.indexOf('function findStationaryCombatTarget('), source.indexOf('function simulateTick('));
for (const team of [0, 1]) test(`stationary targeting bounds visits and respects range/visibility for seat ${team}`, () => {
  const enemy = 1 - team;
  const units = Array.from({ length: 100 }, (_, id) => ({ id, team: enemy, kind: 'infantry', hp: 100, x: 6, z: 0 }));
  let visits = 0; let visible = true;
  const context = vm.createContext({ units, UNIT_DEFINITIONS, BUILDING_DEFINITIONS, canCombatTarget, spatialBucketColumns: 1,
    spatialBucketRow: () => 0, spatialBucketColumn: () => 0,
    spatialBucketTeamCounts: [[0], [0]], spatialBucketTeamHeads: [[-1], [-1]],
    spatialBucketTeamCursors: [[-1], [-1]], spatialBucketTeamNext: [[], []],
    spatialBucketOfUnit: Array(100).fill(0), mapDefinition: { fogOfWar: true },
    worldToCell: () => 0, cellVisibleToTeam: () => { visits++; return visible; },
  });
  context.spatialBucketTeamCounts[enemy][0] = 100;
  context.spatialBucketTeamHeads[enemy][0] = 0;
  context.spatialBucketTeamNext[enemy] = units.map((unit) => (unit.id + 1) % 100);
  vm.runInContext(functions, context);
  const building = { id: 1, team, type: 'watchtower', x: 0, z: 0 };
  assert.equal(context.findStationaryCombatTarget(building, 7).id, 0);
  assert.equal(visits, 64, 'one scan has a fixed visit budget');
  visits = 0; visible = false;
  assert.equal(context.findStationaryCombatTarget(building, 7), null);
  assert.equal(visits, 64, 'hidden enemies cannot become targets');
  visible = true; for (const unit of units) unit.x = 7.001;
  assert.equal(context.findStationaryCombatTarget(building, 7), null, 'enemies outside range are excluded');
  for (const unit of units) unit.x = 7;
  assert.ok(context.findStationaryCombatTarget(building, 7), 'the declared range boundary is inclusive');
});

test('tower sight expands a previously processed source and honors terrain occlusion', () => {
  const width = 32; const cells = width * width;
  const context = vm.createContext({ MAP_WIDTH: width, MAP_HEIGHT: width, MAP_HALF_X: 16, MAP_HALF_Z: 16,
    VISION_RADIUS_CELLS: 8, HIGH_GROUND_VISION_BONUS_CELLS: 1, VISION_EYE_HEIGHT: 1,
    processedVisionSourcesByTeam: [new Uint8Array(cells), new Uint8Array(cells)],
    visibleCellsByTeam: [new Uint8Array(cells), new Uint8Array(cells)], exploredCellsByTeam: [new Uint8Array(cells), new Uint8Array(cells)],
    visionCoverageBySourceCell: new Array(cells), elevationLevelByCell: new Uint8Array(cells),
    visionBlockers: new Uint8Array(cells), visionBlockHeights: new Float32Array(cells), buildingBlocked: new Uint8Array(cells),
    forestCellMask: new Uint8Array(cells), exploredForestFringe,
  });
  vm.runInContext(source.slice(source.indexOf('function buildVisionRays('), source.indexOf('const VISION_RAYS ='))
    + 'const VISION_RAYS = buildVisionRays(8); const HIGH_GROUND_VISION_RAYS = buildVisionRays(9);'
    + source.slice(source.indexOf('const visionRaysByRadius ='), source.indexOf('function updateVisionMasks(')), context);
  const distant = 16 * width + 26;
  context.markVisionFrom(0, 0.5, 0.5, 8); assert.equal(context.visibleCellsByTeam[0][distant], 0);
  context.markVisionFrom(0, 0.5, 0.5, 10); assert.equal(context.visibleCellsByTeam[0][distant], 1);
  assert.equal(context.visibleCellsByTeam[0][16 * width + 27], 0, 'ten-cell sight does not expose farther cells');
  context.visionBlockers[16 * width + 21] = 1; context.visionBlockHeights[16 * width + 21] = 2;
  context.visionCoverageBySourceCell = new Array(cells);
  context.markVisionFrom(1, 0.5, 0.5, 10); assert.equal(context.visibleCellsByTeam[1][distant], 0, 'opaque terrain blocks tower vision');
});
