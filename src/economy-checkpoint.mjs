import { GAMEPLAY_RULESET_REVISION } from './gameplay-definitions.mjs';
import { DEFAULT_ECONOMY_PROFILE_ID, STONE_ECONOMY_PROFILE_ID, resolveEconomyProfileId, economyRulesetRevision, economyResources } from './economy-profile.mjs';

/** Run after exact supported legacy content migration. Never alter authored map bytes. */
export function migrateEconomyCheckpoint(snapshot) {
  if (snapshot?.schemaVersion !== 22 || snapshot.rulesetRevision !== GAMEPLAY_RULESET_REVISION
    || !snapshot.state || typeof snapshot.state !== 'object' || Array.isArray(snapshot.state)
    || (snapshot.economyProfileId !== undefined && snapshot.economyProfileId !== DEFAULT_ECONOMY_PROFILE_ID)
    || (snapshot.mapDefinition?.economyProfileId !== undefined && snapshot.mapDefinition.economyProfileId !== DEFAULT_ECONOMY_PROFILE_ID)
    || Object.hasOwn(snapshot.state, 'teamStone')
    || snapshot.mapDefinition?.resourceNodes?.some(node => node.type === 'stone')
    || snapshot.state.resourceNodes?.some(node => node.type === 'stone')
    || snapshot.state.units?.some(unit => unit.cargoType === 'stone')) return snapshot;
  snapshot.schemaVersion = 23;
  snapshot.economyProfileId = DEFAULT_ECONOMY_PROFILE_ID;
  snapshot.state.teamStone = [0, 0];
  return snapshot;
}

/** Profile and all typed banks validate before any simulation restoration. */
export function validateEconomyCheckpoint(snapshot) {
  const profile = resolveEconomyProfileId(snapshot.economyProfileId);
  if (snapshot.economyProfileId === undefined
    || resolveEconomyProfileId(snapshot.mapDefinition?.economyProfileId) !== profile
    || snapshot.rulesetRevision !== economyRulesetRevision(profile)) {
    throw new Error('Invalid match checkpoint: economy profile or gameplay ruleset revision mismatch');
  }
  for (const resource of ['food', 'wood', 'stone']) {
    const bank = snapshot.state?.[`team${resource[0].toUpperCase()}${resource.slice(1)}`];
    if (!Array.isArray(bank) || bank.length !== 2
      || bank.some(value => !Number.isFinite(value) || value < 0)
      || (resource === 'stone' && profile !== STONE_ECONOMY_PROFILE_ID && bank.some(value => value !== 0))) {
      throw new Error(`Invalid match checkpoint: invalid ${resource} bank`);
    }
  }
  const resources = economyResources(profile);
  if (snapshot.state?.units?.some(unit => unit.cargoType !== null && !resources.includes(unit.cargoType))
    || snapshot.state?.resourceNodes?.some(node => !resources.includes(node.type))) {
    throw new Error('Invalid match checkpoint: unsupported resource state');
  }
  return profile;
}
