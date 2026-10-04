import * as economyProfile from '../src/economy-profile.mjs';
import * as economyClient from '../src/economy-client.mjs';
import { browserRecoveryBindings } from './browser-recovery-fixture.mjs';

export function economyClientBindings() {
  return { ...economyProfile, ...economyClient, ...browserRecoveryBindings(), latestStone: [0, 0], mapDefinition: {} };
}
