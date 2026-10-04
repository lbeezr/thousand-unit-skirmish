import { GAMEPLAY_RULESET_REVISION, TECHNOLOGY_DEFINITIONS } from '../gameplay-definitions.mjs';
import { emptyTechnologyCompletions } from '../research-actions.mjs';
import { DEFAULT_ECONOMY_PROFILE_ID, STONE_ECONOMY_PROFILE_ID, economyRulesetRevision } from '../economy-profile.mjs';

// Exact six-technology content pins immediately preceding Food Tools. A save
// claiming the current content must already include its new completion flag.
export const PRE_FOOD_TOOLS_RULESETS = Object.freeze({
  [DEFAULT_ECONOMY_PROFILE_ID]: 'v1:c064842120271aaabdc7eb3e85e43d72824345e2c1edfdf788c29ebc6523bbd1',
  [STONE_ECONOMY_PROFILE_ID]: 'v1:021638fea0cd564c3746af1adfee5575ca74c9e9bfed03bc13d151a0a6d1f9a5',
});

/** Food Tools changes productive land Worker food labor, never trips or supply. */
export function workerFoodGatherMultiplier(unit, resourceType, upgrades) {
  if (unit.kind !== 'worker' || resourceType !== 'food') return 1;
  let multiplier = 1;
  for (const technology of Object.values(TECHNOLOGY_DEFINITIONS)) {
    if (!upgrades?.[technology.upgradeKey]) continue;
    for (const effect of technology.effects) {
      if (effect.stat === 'food-gather-multiplier') multiplier *= effect.value;
    }
  }
  return multiplier;
}

/** Preserve exact supported prior matches; add an unpurchased flag, no payment. */
export function migrateFoodToolsCheckpoint(snapshot) {
  const profile = snapshot?.economyProfileId ?? DEFAULT_ECONOMY_PROFILE_ID;
  const priorKeys = Object.keys(emptyTechnologyCompletions()).filter(key => key !== 'foodTools');
  if (!Object.hasOwn(PRE_FOOD_TOOLS_RULESETS, profile)
    || snapshot.rulesetRevision !== PRE_FOOD_TOOLS_RULESETS[profile]
    || ![22, 23, 24, 25, 26, 27, 28, 29].includes(snapshot.schemaVersion)
    || (snapshot.mapDefinition?.economyProfileId ?? DEFAULT_ECONOMY_PROFILE_ID) !== profile
    || !Array.isArray(snapshot.state?.teamUpgrades) || snapshot.state.teamUpgrades.length !== 2
    || !snapshot.state.teamUpgrades.every(upgrades => upgrades && typeof upgrades === 'object'
      && !Array.isArray(upgrades) && Object.keys(upgrades).length === priorKeys.length
      && priorKeys.every(key => typeof upgrades[key] === 'boolean'))
    || snapshot.state.teamResearch?.some(research => research?.type === 'food-tools')) return snapshot;
  snapshot.state.teamUpgrades = snapshot.state.teamUpgrades.map(upgrades => ({ ...upgrades, foodTools: false }));
  snapshot.rulesetRevision = profile === DEFAULT_ECONOMY_PROFILE_ID
    ? GAMEPLAY_RULESET_REVISION : economyRulesetRevision(profile);
  return snapshot;
}
