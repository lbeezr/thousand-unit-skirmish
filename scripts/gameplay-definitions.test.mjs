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

test('unimplemented mineral costs are rejected for units, buildings and research instead of being ignored', () => {
  for (const [category, id] of [['units', 'worker'], ['buildings', 'storehouse'], ['technologies', 'infantry-attack']]) {
    for (const resource of ['stone', 'gold', 'copper', 'foood']) for (const amount of [0, 100]) {
      const definitions = structuredClone(GAMEPLAY_DEFINITIONS);
      definitions[category][id].cost = { food: 0, wood: 0, [resource]: amount };
      const before = JSON.stringify(definitions);
      assert.throws(() => validateGameplayDefinitions(definitions),
        new RegExp(`Unsupported cost resource ${resource}: ${id}`));
      assert.equal(JSON.stringify(definitions), before, 'rejection cannot normalize away the unsupported charge');
    }
    const definitions = structuredClone(GAMEPLAY_DEFINITIONS);
    definitions[category][id].cost = Object.assign([], { food: 0, wood: 0 });
    assert.throws(() => validateGameplayDefinitions(definitions), new RegExp(`Invalid cost object: ${id}`));
  }
  const valid = structuredClone(GAMEPLAY_DEFINITIONS);
  valid.units.worker.cost = { food: 0, wood: 0 };
  assert.equal(validateGameplayDefinitions(valid), valid, 'explicit supported zero-cost content remains valid');
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

for (const unitId of GAMEPLAY_DEFINITIONS.factions.frontier.units) {
  test(`faction roster rejects ${unitId} when no faction building can train it`, () => {
    const definitions = structuredClone(GAMEPLAY_DEFINITIONS);
    for (const building of Object.values(definitions.buildings)) {
      building.products = building.products.filter(id => id !== unitId);
    }
    assert.throws(() => validateGameplayDefinitions(definitions),
      new RegExp(`Faction frontier unit ${unitId} requires a producer in its building roster`));
  });
}

test('a producer outside the faction cannot satisfy its unit roster', () => {
  const definitions = structuredClone(GAMEPLAY_DEFINITIONS);
  definitions.factions['test-roster'] = {
    id: 'test-roster', label: 'Test roster', units: ['archer'], buildings: ['house'], technologies: [],
  };
  assert.throws(() => validateGameplayDefinitions(definitions),
    /Faction test-roster unit archer requires a producer in its building roster/);
});

test('unit coverage permits alternate and shared producers with an independent faction subset', () => {
  const definitions = structuredClone(GAMEPLAY_DEFINITIONS);
  definitions.buildings.barracks.products.push('archer');
  definitions.factions['test-roster'] = {
    id: 'test-roster', label: 'Test roster', units: ['infantry', 'spearman', 'archer'],
    buildings: ['house', 'barracks'], technologies: [],
  };
  assert.equal(validateGameplayDefinitions(definitions), definitions,
    'the subset can train archers from its Barracks without the globally registered Archery Range');
  definitions.buildings['archery-range'].products = [];
  assert.equal(validateGameplayDefinitions(definitions), definitions,
    'moving a product between registered buildings preserves coverage');
});
