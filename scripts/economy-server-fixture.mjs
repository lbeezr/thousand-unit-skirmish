import { readFileSync } from 'node:fs';
import * as economyProfile from '../src/economy-profile.mjs';
import { creditResourceBalance } from '../src/economy-ledger.mjs';
import * as workIntent from '../src/work-intent.mjs';
import { shortcutFlatUnitPath } from '../src/unit-path-line.mjs';

const source = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
export const economyServerFunctions = source.slice(source.indexOf('function matchEconomyProfileId('),
  source.indexOf('function resetScenarioEventClock('));
export function economyServerBindings(profileId = economyProfile.DEFAULT_ECONOMY_PROFILE_ID) {
  return { ...economyProfile, ...workIntent, creditResourceBalance, teamStone: [0, 0], automaticTargetRejections: new WeakMap(),
    mapDefinition: { economyProfileId: profileId } };
}

// Geometry for isolated route/deposit policy fixtures. Use the real segment
// validator; complete authority trajectories live in worker-flat-flow-routes.
export function workerFlowRouteBindings() {
  return { shortcutFlatUnitPath, MAP_WIDTH: 16, MAP_HALF_X: 0, MAP_HALF_Z: 0,
    elevationLevelByCell: new Uint8Array(256), isWalkable: () => true,
    WALK_SPEED: 4, STEP_SECONDS: 1 / 30 };
}
