import { GAMEPLAY_DEFINITIONS, TECHNOLOGY_DEFINITIONS } from './gameplay-definitions.mjs';

const orderedTechnologies = Object.values(TECHNOLOGY_DEFINITIONS).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const emptyUpgrades = Object.freeze({});
const effectCache = new WeakMap();

export function hasGameplayCapability(definition, capability) {
  return definition?.capabilities?.includes(capability) === true;
}
export function canCombatTarget(attacker, target) {
  return Boolean(attacker?.combat && target?.tags?.some((tag) => attacker.combat.targetTags.includes(tag)));
}
export function technologyCombatEffects(definition, upgrades = emptyUpgrades) {
  const signature = orderedTechnologies.map((technology) => upgrades[technology.upgradeKey] ? '1' : '0').join('');
  let cached = effectCache.get(upgrades);
  if (!cached || cached.signature !== signature) { cached = { signature, definitions: new Map() }; effectCache.set(upgrades, cached); }
  if (cached.definitions.has(definition)) return cached.definitions.get(definition);
  const effects = { damageMultiplier: 1, armor: Object.fromEntries(GAMEPLAY_DEFINITIONS.combatRules.attackClasses.map((attackClass) => [attackClass, 0])) };
  for (const technology of orderedTechnologies) {
    if (!upgrades[technology.upgradeKey]) continue;
    for (const effect of technology.effects) {
      if (!effect.targetTags.some((tag) => definition.tags.includes(tag))) continue;
      if (effect.stat === 'damage-multiplier') effects.damageMultiplier *= effect.value;
      else effects.armor[effect.attackClass] += effect.value;
    }
  }
  Object.freeze(effects.armor); Object.freeze(effects);
  cached.definitions.set(definition, effects);
  return effects;
}
/** (base × technology multipliers × matching tag multipliers) − armor, with a minimum hit. */
export function combatDamage(attacker, target, attackerUpgrades = emptyUpgrades, targetUpgrades = emptyUpgrades) {
  if (!canCombatTarget(attacker, target)) return 0;
  const combat = attacker.combat;
  const structure = target.tags.includes('structure');
  const base = structure ? combat.structureDamage ?? 0 : combat.damage;
  if (base <= 0) return 0;
  const attackEffects = technologyCombatEffects(attacker, attackerUpgrades);
  const defenseEffects = technologyCombatEffects(target, targetUpgrades);
  let multiplier = attackEffects.damageMultiplier;
  for (const [tag, value] of Object.entries(combat.tagMultipliers)) if (target.tags.includes(tag)) multiplier *= value;
  const armor = (target.armor[combat.attackClass] || 0) + (defenseEffects.armor[combat.attackClass] || 0);
  return Math.max(GAMEPLAY_DEFINITIONS.combatRules.minimumDamage, base * multiplier - armor);
}
