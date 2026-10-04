import { readFileSync } from 'node:fs';
import * as economyProfile from '../src/economy-profile.mjs';
import { creditResourceBalance } from '../src/economy-ledger.mjs';
import * as workIntent from '../src/work-intent.mjs';

const source = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
export const economyServerFunctions = source.slice(source.indexOf('function matchEconomyProfileId('),
  source.indexOf('function resetScenarioEventClock('));
export function economyServerBindings(profileId = economyProfile.DEFAULT_ECONOMY_PROFILE_ID) {
  return { ...economyProfile, ...workIntent, creditResourceBalance, teamStone: [0, 0], automaticTargetRejections: new WeakMap(),
    mapDefinition: { economyProfileId: profileId } };
}
