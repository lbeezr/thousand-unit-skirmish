import { DEFAULT_ECONOMY_PROFILE_ID, STONE_ECONOMY_PROFILE_ID, resolveEconomyProfileId,
  economyResources, economyRulesetRevision, acceptsProfileDropoff } from './economy-profile.mjs';

/** Old baseline snapshots remain readable; the Stone profile requires its explicit pin and banks. */
export function matchesEconomySnapshot(state, mapProfileId) {
  try {
    const profile = resolveEconomyProfileId(state?.economyProfileId);
    if (profile !== resolveEconomyProfileId(mapProfileId)) return false;
    if (state?.rulesetRevision && state.rulesetRevision !== economyRulesetRevision(profile)) return false;
    return profile === DEFAULT_ECONOMY_PROFILE_ID
      || (state.rulesetRevision === economyRulesetRevision(STONE_ECONOMY_PROFILE_ID)
        && Array.isArray(state.stone) && state.stone.length === 2
        && state.stone.every(value => value === null || Number.isFinite(value) && value >= 0));
  } catch { return false; }
}

export function profileDropoffResources(type, profileId) {
  return economyResources(profileId).filter(resource => acceptsProfileDropoff(type, resource, profileId));
}

/** Unknown positive cargo cannot become a food label or a spendable balance. */
export function sumTypedCargo(units, profileId) {
  const totals = Object.fromEntries(economyResources(profileId).map(resource => [resource, 0]));
  for (const unit of units) if (Object.hasOwn(totals, unit.cargoType)
    && Number.isFinite(unit.cargo) && unit.cargo > 0) totals[unit.cargoType] += unit.cargo;
  return totals;
}
