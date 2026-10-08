import * as economyProfile from '../src/economy-profile.mjs';
import * as economyClient from '../src/economy-client.mjs';
import { browserRecoveryBindings } from './browser-recovery-fixture.mjs';
import { setHudActionAvailability, isHudActionUnavailable } from '../src/hud-layout.mjs';

export function economyClientBindings() {
  return { ...economyProfile, ...economyClient, ...browserRecoveryBindings(), setHudActionAvailability, isHudActionUnavailable, latestStone: [0, 0], mapDefinition: {} };
}
