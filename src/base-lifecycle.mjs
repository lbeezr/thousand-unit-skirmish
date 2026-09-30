import { GAMEPLAY_DEFINITIONS } from './gameplay-definitions.mjs';

export function unfinishedRefund(cost, remaining, duration) {
  const fraction = Math.max(0, Math.min(1, remaining / duration));
  return Object.fromEntries(['food', 'wood'].map((resource) => [resource,
    Math.round(cost[resource] * fraction * 1e6) / 1e6]));
}

export function buildingRepairStep(building, availableWood, seconds, definitions = GAMEPLAY_DEFINITIONS) {
  const rule = definitions.buildings[building.type];
  const policy = definitions.baseLifecycle;
  const woodPerHp = Math.max(policy.minimumRepairWood, rule.cost.wood * policy.fullRepairWoodFraction) / rule.maxHp;
  const hp = Math.max(0, Math.min(rule.maxHp - building.hp, policy.repairHpPerSecond * seconds,
    Math.max(0, availableWood) / woodPerHp));
  return { hp, wood: hp * woodPerHp };
}
