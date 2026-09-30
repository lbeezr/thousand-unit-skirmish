import test from 'node:test';
import assert from 'node:assert/strict';
import { GAMEPLAY_DEFINITIONS, validateGameplayDefinitions } from '../src/gameplay-definitions.mjs';

test('production registry retains the shipped opening economy', () => {
  const { units, buildings, technologies } = GAMEPLAY_DEFINITIONS;
  const opening = { food: 150, wood: 250 };
  const afterBarracksAndInfantry = {
    food: opening.food - buildings.barracks.cost.food - units.infantry.cost.food,
    wood: opening.wood - buildings.barracks.cost.wood - units.infantry.cost.wood,
  };
  assert.deepEqual(afterBarracksAndInfantry, { food: 100, wood: 75 });
  assert.equal(units.infantry.trainSeconds, 12);
  assert.equal(technologies['infantry-attack'].building, 'barracks');
  assert.ok(Object.isFrozen(units.infantry.cost));
});

test('invalid content cannot silently create free production or unknown products', () => {
  for (const [mutate, reason] of [
    [d => { d.baseLifecycle.repairHpPerSecond = 0; }, /Invalid base lifecycle/],
    [d => { d.units.worker.cost.food = -1; }, /Invalid food cost/],
    [d => { d.units.worker.trainSeconds = 0; }, /Invalid trainSeconds/],
    [d => { d.units.archer.combat.range = NaN; }, /Invalid combat range/],
    [d => { d.buildings.barracks.products.push('unknown-unit'); }, /Unknown product/],
    [d => { d.technologies['infantry-attack'].building = 'unknown-building'; }, /Unknown research building/],
    [d => { d.buildings.barracks.footprint = 2.5; }, /Invalid footprint/],
    [d => { d.buildings.storehouse.dropoff = ['gold']; }, /Invalid dropoff resources/],
    [d => { d.units.worker.id = 'different-id'; }, /Invalid units ID/],
  ]) {
    const definitions = structuredClone(GAMEPLAY_DEFINITIONS);
    mutate(definitions);
    assert.throws(() => validateGameplayDefinitions(definitions), reason);
  }
});

test('registry rejects duplicate identities, broken faction rosters and prerequisite cycles', () => {
  for (const [mutate, reason] of [
    [d => { d.units.spearman.wireId = d.units.infantry.wireId; }, /duplicate unit wire ID/],
    [d => { d.buildings.barracks.products.push('infantry'); }, /duplicate products/],
    [d => { d.buildings.barracks.products.push('__proto__'); }, /Unknown product/],
    [d => { d.units.spearman.requires = ['missing']; }, /Unknown prerequisite missing: spearman/],
    [d => { d.technologies['infantry-attack'].requires = ['archer-attack']; d.technologies['archer-attack'].requires = ['infantry-attack']; }, /Cyclic prerequisites/],
    [d => { d.buildings.barracks.requires = ['infantry-attack']; }, /Cyclic prerequisites.*building:barracks/],
    [d => { d.technologies['archer-attack'].upgradeKey = 'infantryAttack'; }, /duplicate upgrade key/],
    [d => { d.factions.frontier.units.push('missing'); }, /Unknown faction units missing/],
    [d => { d.factions.frontier.units.push('worker'); }, /duplicate faction units/],
    [d => { d.factions.frontier.units = d.factions.frontier.units.filter(id => id !== 'spearman'); }, /producer barracks requires unit spearman/],
    [d => { d.defaultFaction = 'missing'; }, /Unknown default faction/],
  ]) {
    const definitions = structuredClone(GAMEPLAY_DEFINITIONS); mutate(definitions);
    assert.throws(() => validateGameplayDefinitions(definitions), reason);
  }
});
