import assert from 'node:assert/strict';
import test from 'node:test';
import { UNIT_DEFINITIONS as units, BUILDING_DEFINITIONS as buildings, GAMEPLAY_DEFINITIONS, validateGameplayDefinitions } from '../src/gameplay-definitions.mjs';
import { combatDamage, canCombatTarget, technologyCombatEffects, hasGameplayCapability } from '../src/combat-rules.mjs';

test('shared damage preserves the original ground roster and structure hits', () => {
  const original = [units.worker, units.infantry, units.spearman, units.archer];
  for (const attacker of original) {
    for (const target of original) assert.equal(combatDamage(attacker, target), attacker.combat.damage);
    for (const target of Object.values(buildings)) assert.equal(combatDamage(attacker, target), attacker.id === 'worker' ? 0 : attacker.combat.structureDamage);
  }
  for (const target of original) assert.equal(combatDamage(buildings.watchtower, target), 8);
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

test('capability vocabulary cannot declare handlers the runtime does not implement', () => {
  for (const useCapability of [false, true]) {
    const definitions = structuredClone(GAMEPLAY_DEFINITIONS);
    definitions.combatRules.capabilities.push('teleport');
    if (useCapability) definitions.units.worker.capabilities.push('teleport');
    assert.throws(() => validateGameplayDefinitions(definitions), /Unsupported unit capability: teleport/);
  }
});

for (const [label, mutate, reason] of [
  ['array-shaped unit combat', d => { d.units.worker.combat = Object.assign([], d.units.worker.combat); }, /Invalid unit combat: worker/],
  ['ignored unit projectile speed', d => { d.units.archer.combat.projectileSpeed = 12; }, /Unsupported combat field projectileSpeed: archer/],
  ['ignored unit splash radius', d => { d.units['siege-engine'].combat.splashRadius = 2; }, /Unsupported combat field splashRadius: siege-engine/],
  ['immobile unit declaration', d => { d.units.infantry.capabilities = ['attack', 'attack-structures']; }, /Missing move capability: infantry/],
  ['structure permission without eligible targets', d => { d.units.infantry.combat.targetTags = ['ground']; }, /Structure attack capability has no eligible building targets: infantry/],
  ['structure targets without permission', d => { d.units.infantry.capabilities = ['move', 'attack']; }, /Structure targets require attack-structures capability: infantry/],
  ['worker structure targets without permission', d => { d.units.worker.combat.targetTags.push('structure'); }, /Structure targets require attack-structures capability: worker/],
  ['unit classified as a structure', d => { d.units.infantry.tags.push('structure'); }, /Units cannot have the structure tag: infantry/],
  ['building missing its damage classification', d => { d.buildings.house.tags = ['defense']; }, /Buildings require the structure tag: house/],
  ['stationary defense structure targets', d => { d.buildings.watchtower.combat.targetTags.push('structure'); }, /Unsupported building structure targets: watchtower/],
  ['ignored building structure damage', d => { d.buildings.watchtower.combat.structureDamage = 4; }, /Unsupported combat field structureDamage: watchtower/],
  ['ignored building movement speed', d => { d.buildings.watchtower.combat.moveSpeed = 2; }, /Unsupported combat field moveSpeed: watchtower/],
  ['building HP in the unit stat location', d => { d.buildings.watchtower.combat.maxHp = 1200; }, /Unsupported combat field maxHp: watchtower/],
  ['ignored building capability declaration', d => { d.buildings.watchtower.capabilities = ['attack-structures']; }, /Unsupported building capabilities: watchtower/],
]) test(`combat contract rejects ${label}`, () => {
  const definitions = structuredClone(GAMEPLAY_DEFINITIONS);
  mutate(definitions);
  assert.throws(() => validateGameplayDefinitions(definitions), reason);
});

test('supported combat contracts preserve shipped content and independent attack permissions', () => {
  const definitions = structuredClone(GAMEPLAY_DEFINITIONS);
  assert.equal(validateGameplayDefinitions(definitions), definitions);
  assert.deepEqual(definitions, GAMEPLAY_DEFINITIONS, 'validation must not rewrite stats or permissions');
  assert.ok(definitions.units.worker.combat.structureDamage > 0,
    'the shipped Worker retains its dormant structure damage stat without structure permission');
  definitions.units.infantry.capabilities = ['move', 'attack-structures'];
  definitions.units.infantry.combat.targetTags = ['structure'];
  definitions.units.scout.capabilities = ['move'];
  definitions.units.scout.combat.targetTags = ['ground'];
  assert.equal(validateGameplayDefinitions(definitions), definitions,
    'structure-only attacks and a mobile unit without attack permissions use existing handlers');
  assert.equal(combatDamage(definitions.units.infantry, buildings.house), units.infantry.combat.structureDamage);
  assert.equal(combatDamage(definitions.units.infantry, units.worker), 0);
});

test('a specialized structure attacker may target only defense-tagged buildings', () => {
  const definitions = structuredClone(GAMEPLAY_DEFINITIONS);
  const siege = definitions.units['siege-engine'];
  siege.combat.targetTags = ['defense'];
  assert.equal(validateGameplayDefinitions(definitions), definitions);
  assert.equal(canCombatTarget(siege, definitions.buildings.watchtower), true);
  assert.equal(combatDamage(siege, definitions.buildings.watchtower), 48);
  assert.equal(canCombatTarget(siege, definitions.buildings.house), false);
  assert.equal(combatDamage(siege, definitions.buildings.house), 0);
});

test('mounted roster has real reconnaissance, raiding and Spearman counter tradeoffs', () => {
  assert.equal(combatDamage(units.spearman, units.rider), 23);
  assert.equal(combatDamage(units.archer, units.rider), 5);
  assert.equal(combatDamage(buildings.watchtower, units.rider), 6);
  assert.equal(combatDamage(units.rider, units.worker), 11);
  assert.equal(combatDamage(units.rider, buildings.watchtower), 2.4);
  assert.equal(units.rider.population, 2);
  assert.equal(units.scout.sight, 11);
  assert.ok(units.scout.combat.moveSpeed > units.rider.combat.moveSpeed);
  assert.ok(units.scout.combat.maxHp < units.archer.combat.maxHp);
  assert.deepEqual(buildings.stable.products, ['scout', 'rider']);
});

test('completed progression applies to current definitions and leaves Workers outside military armor', () => {
  assert.equal(combatDamage(units.rider, units.worker, { mountedAttack: true }), 11 * 1.2);
  assert.equal(combatDamage(units.infantry, units.rider, {}, { militaryArmor: true }), 8);
  assert.equal(combatDamage(units.archer, units.rider, {}, { militaryArmor: true }), 4);
  assert.equal(combatDamage(units.archer, units.worker, {}, { militaryArmor: true }), 7);
  const completions = { militaryArmor: true };
  assert.equal(combatDamage(units.infantry, units.spearman, {}, completions), 9);
  completions.militaryArmor = false;
  assert.equal(combatDamage(units.infantry, units.spearman, {}, completions), 10);
});

test('siege has a dedicated defense advantage and a mobile counter', () => {
  const siege = units['siege-engine'];
  assert.equal(combatDamage(siege, buildings.watchtower), 48);
  assert.equal(combatDamage(siege, buildings.barracks), 24);
  assert.equal(combatDamage(siege, units.rider), 6);
  assert.equal(combatDamage(units.rider, siege), 11);
  assert.ok(siege.combat.range > buildings.watchtower.combat.range);
  assert.ok(siege.combat.moveSpeed < units.rider.combat.moveSpeed);
  assert.equal(siege.population, 3);
});
