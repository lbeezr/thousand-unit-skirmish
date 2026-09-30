import assert from 'node:assert/strict';
import test from 'node:test';
import { UNIT_DEFINITIONS as units, BUILDING_DEFINITIONS as buildings, GAMEPLAY_DEFINITIONS, validateGameplayDefinitions } from '../src/gameplay-definitions.mjs';
import { combatDamage, canCombatTarget, technologyCombatEffects, hasGameplayCapability } from '../src/combat-rules.mjs';

test('shared damage preserves every shipped ground matchup and structure hit', () => {
  for (const attacker of Object.values(units)) {
    for (const target of Object.values(units)) assert.equal(combatDamage(attacker, target), attacker.combat.damage);
    for (const target of Object.values(buildings)) assert.equal(combatDamage(attacker, target), attacker.id === 'worker' ? 0 : attacker.combat.structureDamage);
  }
  for (const target of Object.values(units)) assert.equal(combatDamage(buildings.watchtower, target), 8);
  assert.equal(canCombatTarget(buildings.watchtower, buildings.house), false);
});
test('matching tags, attack-class armor and minimum damage define actual counters', () => {
  const mounted = { ...units.infantry, tags: ['ground', 'mounted'], armor: { melee: 2, pierce: 4, siege: 0 } };
  assert.equal(combatDamage(units.spearman, mounted), 22, 'threefold mounted bonus precedes melee armor');
  assert.equal(combatDamage(units.archer, mounted), 3, 'pierce damage uses its own armor class');
  assert.equal(combatDamage(units.infantry, { ...mounted, armor: { melee: 100 } }), 0.5);
  assert.equal(combatDamage(units.infantry, { ...mounted, tags: ['scout'] }), 0, 'ineligible targets cannot take the minimum hit');
});
test('completed technology effects update existing definitions, stack and invalidate cached state', () => {
  const upgrades = { infantryAttack: false, archerAttack: false };
  assert.equal(combatDamage(units.infantry, units.worker, upgrades), 10);
  upgrades.infantryAttack = true;
  assert.equal(combatDamage(units.infantry, units.worker, upgrades), 12);
  assert.equal(combatDamage(units.infantry, buildings.house, upgrades), units.infantry.combat.structureDamage * 1.2);
  assert.equal(combatDamage(units.spearman, units.worker, upgrades), 8, 'old Infantry research keeps its declared role scope');
  upgrades.archerAttack = true;
  const combined = { ...units.infantry, tags: ['ground', 'infantry', 'archer'] };
  assert.equal(technologyCombatEffects(combined, upgrades).damageMultiplier, 1.44);
  upgrades.infantryAttack = false;
  assert.equal(combatDamage(units.infantry, units.worker, upgrades), 10, 'rematch state cannot retain cached bonuses');
});
test('capabilities and validated combat references reject unsupported content', () => {
  assert.equal(hasGameplayCapability(units.worker, 'gather'), true);
  assert.equal(hasGameplayCapability(units.infantry, 'repair'), false);
  assert.equal(hasGameplayCapability(units.worker, 'attack-structures'), false);
  for (const [mutate, reason] of [
    [d => { d.units.infantry.armor.melee = -1; }, /Invalid armor/],
    [d => { d.units.infantry.combat.attackClass = 'magic'; }, /Invalid attack class/],
    [d => { d.units.infantry.combat.targetTags = ['flying']; }, /Invalid target tags/],
    [d => { d.units.spearman.combat.tagMultipliers.mounted = 0; }, /Invalid tag multiplier/],
    [d => { d.units.worker.capabilities.push('teleport'); }, /Invalid capabilities/],
    [d => { d.technologies['infantry-attack'].effects[0].stat = 'unimplemented'; }, /Invalid technology effect/],
  ]) {
    const definitions = structuredClone(GAMEPLAY_DEFINITIONS); mutate(definitions);
    assert.throws(() => validateGameplayDefinitions(definitions), reason);
  }
});
