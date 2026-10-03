import * as economyProfile from '../src/economy-profile.mjs';
import * as economyClient from '../src/economy-client.mjs';

export function economyClientBindings() {
  return { ...economyProfile, ...economyClient, latestStone: [0, 0], mapDefinition: {} };
}
