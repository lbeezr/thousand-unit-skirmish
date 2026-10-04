import { readFileSync } from 'node:fs';
import * as economyProfile from '../src/economy-profile.mjs';
import { creditResourceBalance } from '../src/economy-ledger.mjs';
import * as workIntent from '../src/work-intent.mjs';
import { validBuildingOrientation } from '../src/building-orientation.mjs';
import { shortcutFlatUnitPath } from '../src/unit-path-line.mjs';
import { createUnitRouteResult, unitRoutePathCost, unitRouteResultIsCurrent } from '../src/unit-movement.mjs';
import { VisionCoverageCache } from '../src/server/vision-coverage-cache.mjs';

const source = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
export const economyServerFunctions = source.slice(source.indexOf('function matchEconomyProfileId('),
  source.indexOf('function resetScenarioEventClock('));
export function economyServerBindings(profileId = economyProfile.DEFAULT_ECONOMY_PROFILE_ID) {
  return { ...economyProfile, ...workIntent, validBuildingOrientation, creditResourceBalance, teamStone: [0, 0], automaticTargetRejections: new WeakMap(),
    mapDefinition: { economyProfileId: profileId } };
}

// Geometry-mutating extracted authority bodies use the real private cache and
// production invalidation, rather than silently retaining stale seat coverage.
const visionStart = source.indexOf('function invalidateVisionCoverage(');
const visionEnd = source.indexOf('\nfunction activateMap(', visionStart);
if (visionStart < 0 || visionEnd <= visionStart) throw new Error('Missing production vision invalidation function');
export const visionServerFunctions = source.slice(visionStart, visionEnd);
export function visionServerBindings() {
  return { VisionCoverageCache, visionCoverageGeneration: 0, visionCoverageBySourceCell: null };
}

// Geometry for isolated route/deposit policy fixtures. Use the real segment
// validator; complete authority trajectories live in worker-flat-flow-routes.
export function workerFlowRouteBindings() {
  return { shortcutFlatUnitPath, createUnitRouteResult, unitRoutePathCost, unitRouteResultIsCurrent,
    movePlanningEpoch: 0, navigationRevision: 0, WORKER_INTERACTION_RANGE: 1.5,
    distanceToBuildingEdge: () => Infinity,
    cellToWorld: cell => ({ x: cell % 16 + .5, z: Math.floor(cell / 16) + .5 }),
    MAP_WIDTH: 16, MAP_HALF_X: 0, MAP_HALF_Z: 0,
    elevationLevelByCell: new Uint8Array(256), isWalkable: () => true,
    WALK_SPEED: 4, STEP_SECONDS: 1 / 30 };
}
