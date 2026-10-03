import { GAMEPLAY_DEFINITIONS, GAMEPLAY_RULESET_REVISION, gameplayRulesetRevision } from './gameplay-definitions.mjs';
import { creditResourceBalance } from './economy-ledger.mjs';

export const DEFAULT_ECONOMY_PROFILE_ID = 'food-wood-v1';
export const STONE_ECONOMY_PROFILE_ID = 'stone-defense-v1';
export const STONE_TUNING_PROPOSAL = Object.freeze({ watchtowerStone: 50, stockPerSeat: 200, startingStone: 0 });
const baselineResources = Object.freeze(['food', 'wood']);
const stoneResources = Object.freeze(['food', 'wood', 'stone']);

/** An omitted map selector preserves the existing food/wood rules. */
export function resolveEconomyProfileId(value = undefined) {
  if (value === undefined) return DEFAULT_ECONOMY_PROFILE_ID;
  if (![DEFAULT_ECONOMY_PROFILE_ID, STONE_ECONOMY_PROFILE_ID].includes(value)) {
    throw new Error(`Unsupported economy profile: ${String(value)}`);
  }
  return value;
}

export function economyResources(profileId = DEFAULT_ECONOMY_PROFILE_ID) {
  return resolveEconomyProfileId(profileId) === STONE_ECONOMY_PROFILE_ID ? stoneResources : baselineResources;
}

/** Costs retain explicit food/wood entries; no omitted required key becomes zero. */
export function validateEconomyCost(cost, profileId = DEFAULT_ECONOMY_PROFILE_ID) {
  const resources = economyResources(profileId);
  if (!cost || typeof cost !== 'object' || Array.isArray(cost)
    || !['food', 'wood'].every(resource => Object.hasOwn(cost, resource))
    || Object.keys(cost).some(resource => !resources.includes(resource))
    || Object.values(cost).some(value => !Number.isFinite(value) || value < 0)) {
    throw new Error('Invalid economy cost or unsupported resource key');
  }
  return cost;
}

export function constructionCostForProfile(type, profileId = DEFAULT_ECONOMY_PROFILE_ID,
  definitions = GAMEPLAY_DEFINITIONS) {
  const profile = resolveEconomyProfileId(profileId);
  const cost = definitions.buildings[type]?.cost;
  // The shared base registry remains two-resource and cannot hide an ore price.
  validateEconomyCost(cost, DEFAULT_ECONOMY_PROFILE_ID);
  return type === 'watchtower' && profile === STONE_ECONOMY_PROFILE_ID
    ? { ...cost, stone: STONE_TUNING_PROPOSAL.watchtowerStone } : { ...cost };
}

export function acceptsProfileDropoff(type, resource, profileId = DEFAULT_ECONOMY_PROFILE_ID,
  definitions = GAMEPLAY_DEFINITIONS) {
  const profile = resolveEconomyProfileId(profileId);
  if (!economyResources(profile).includes(resource)) return false;
  return resource === 'stone'
    ? profile === STONE_ECONOMY_PROFILE_ID && ['town-center', 'storehouse'].includes(type)
    : definitions.buildings[type]?.dropoff?.includes(resource) === true;
}

export function validateEconomyBalance(balance, profileId = DEFAULT_ECONOMY_PROFILE_ID) {
  const resources = economyResources(profileId);
  if (!balance || typeof balance !== 'object' || Array.isArray(balance)
    || Object.keys(balance).length !== resources.length
    || !resources.every(resource => Object.hasOwn(balance, resource)
      && Number.isFinite(balance[resource]) && balance[resource] >= 0)) {
    throw new Error('Invalid economy balance or missing resource bank');
  }
  return balance;
}

/** All validation and affordability precede a single immutable result. */
export function debitEconomyCost(balance, cost, profileId = DEFAULT_ECONOMY_PROFILE_ID) {
  validateEconomyBalance(balance, profileId);
  validateEconomyCost(cost, profileId);
  if (Object.keys(cost).some(resource => balance[resource] + 1e-9 < cost[resource])) return null;
  return validateEconomyBalance(Object.fromEntries(economyResources(profileId).map(resource =>
    [resource, Math.max(0, balance[resource] - (cost[resource] ?? 0))])), profileId);
}

export function proportionalEconomyRefund(cost, remaining, duration, profileId = DEFAULT_ECONOMY_PROFILE_ID) {
  validateEconomyCost(cost, profileId);
  if (!Number.isFinite(remaining) || !Number.isFinite(duration) || duration <= 0) {
    throw new Error('Invalid paid-work refund interval');
  }
  const fraction = Math.max(0, Math.min(1, remaining / duration));
  return validateEconomyCost(Object.fromEntries(Object.entries(cost).map(([resource, amount]) =>
    [resource, Math.round(amount * fraction * 1e6) / 1e6])), profileId);
}

export function creditEconomyRefund(balance, refund, profileId = DEFAULT_ECONOMY_PROFILE_ID) {
  validateEconomyBalance(balance, profileId);
  validateEconomyCost(refund, profileId);
  return validateEconomyBalance(Object.fromEntries(economyResources(profileId).map(resource =>
    [resource, creditResourceBalance(balance[resource], refund[resource] ?? 0)])), profileId);
}

// Baseline saves/wire retain their exact existing canonical gameplay pin.
export const STONE_ECONOMY_RULESET_REVISION = await gameplayRulesetRevision({
  version: 1,
  baseRulesetRevision: GAMEPLAY_RULESET_REVISION,
  economyProfileId: STONE_ECONOMY_PROFILE_ID,
  construction: { watchtower: constructionCostForProfile('watchtower', STONE_ECONOMY_PROFILE_ID) },
  stoneDropoffs: ['town-center', 'storehouse'], startingStone: STONE_TUNING_PROPOSAL.startingStone,
});

export function economyRulesetRevision(profileId = DEFAULT_ECONOMY_PROFILE_ID) {
  return resolveEconomyProfileId(profileId) === STONE_ECONOMY_PROFILE_ID
    ? STONE_ECONOMY_RULESET_REVISION : GAMEPLAY_RULESET_REVISION;
}
