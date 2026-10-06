import assert from 'node:assert/strict';
import test from 'node:test';
import { GAMEPLAY_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { productionAction } from '../src/rules/production-actions.mjs';
import { researchAction } from '../src/rules/research-actions.mjs';
import * as actionRules from '../src/rules/gameplay-action-rules.mjs';
import * as legacyActionRules from '../src/gameplay-action-rules.mjs';
import * as productionActions from '../src/rules/production-actions.mjs';
import * as legacyProductionActions from '../src/production-actions.mjs';
import * as researchActions from '../src/rules/research-actions.mjs';
import * as legacyResearchActions from '../src/research-actions.mjs';

test('canonical production and research retain exactly the legacy named bindings', () => {
  for (const [canonical, legacy, names] of [
    [productionActions, legacyProductionActions, ['productionAction']],
    [researchActions, legacyResearchActions, ['emptyTechnologyCompletions', 'researchAction', 'researchOptions']],
  ]) {
    assert.deepEqual(Object.keys(canonical), names);
    assert.deepEqual(Object.keys(legacy), names);
    for (const name of names) assert.equal(canonical[name], legacy[name], name);
  }
});

test('canonical action rules retain exactly the three legacy export bindings', () => {
  const names = ['foodWoodShortfallReason', 'missingTechnologyPrerequisites', 'technologyRequirementReason'];
  assert.deepEqual(Object.keys(actionRules), names);
  assert.deepEqual(Object.keys(legacyActionRules), names);
  for (const name of names) assert.equal(actionRules[name], legacyActionRules[name], name);
});

function fixture(team, actionType) {
  const definitions = structuredClone(GAMEPLAY_DEFINITIONS);
  const entry = actionType === 'production' ? definitions.units.infantry : definitions.technologies['infantry-attack'];
  entry.cost = { food: 12.5, wood: 7.25 };
  const building = { id: 7, team, type: 'barracks', complete: true, queue: 0 };
  const state = { team, food: 12.5, wood: 7.25, upgrades: {}, active: null, matchOver: false,
    queueLimit: 5, populationAvailable: 10, seatUnits: 4, seatReservedUnits: 0,
    totalUnits: 8, totalReservedUnits: 0, seatLimit: 1000, totalLimit: 2000 };
  const action = (id = actionType === 'production' ? 'infantry' : 'infantry-attack') => actionType === 'production'
    ? productionAction(building, id, state, definitions) : researchAction(building, id, state, definitions);
  return { definitions, entry, building, state, action };
}

for (const team of [0, 1]) for (const actionType of ['production', 'research']) {
  const label = `${actionType}, seat ${team}`;

  test(`${label}: exact fractional balances and existing tolerance govern each resource`, () => {
    for (const [food, wood, available] of [
      [12.5, 7.25, true], [12.5 - 0.5e-9, 7.25, true], [12.5, 7.25 - 0.5e-9, true],
      [12.5 - 2e-9, 7.25, false], [12.5, 7.25 - 2e-9, false], [12.499, 7.249, false],
    ]) {
      const f = fixture(team, actionType);
      Object.assign(f.state, { food, wood });
      const before = structuredClone(f.state);
      const result = f.action();
      assert.equal(result.available, available);
      assert.equal(result.reason, available ? '' : 'NEED 12.5 FOOD + 7.25 WOOD');
      assert.deepEqual(f.state, before, 'availability never spends or reserves');
    }
  });

  test(`${label}: prerequisites use upgrade keys and retain declaration order and labels`, () => {
    const f = fixture(team, actionType);
    f.entry.requires = ['military-tier-2', 'archer-attack'];
    f.state.upgrades = { 'military-tier-2': true, 'archer-attack': true };
    let result = f.action();
    assert.deepEqual(result.missingPrerequisites, ['military-tier-2', 'archer-attack']);
    assert.equal(result.reason, 'REQUIRES MILITARY TIER II + ARCHER FLETCHING');
    f.state.upgrades.militaryTier2 = true;
    result = f.action();
    assert.deepEqual(result.missingPrerequisites, ['archer-attack']);
    assert.equal(result.reason, 'REQUIRES ARCHER FLETCHING');
    f.state.upgrades.archerAttack = true;
    assert.equal(f.action().available, true);
    assert.deepEqual(f.action().missingPrerequisites, []);
  });

  test(`${label}: omitted progress and prerequisites preserve their existing defaults`, () => {
    const f = fixture(team, actionType);
    delete f.state.upgrades;
    delete f.entry.requires;
    assert.equal(f.action().available, true);
    f.entry.requires = ['archer-attack'];
    assert.equal(f.action().reason, 'REQUIRES ARCHER FLETCHING');
    f.entry.requires = null;
    assert.equal(f.action().available, true);
    f.entry.cost = { food: 0, wood: 0 };
    f.state.food = 0; f.state.wood = 0;
    assert.equal(f.action().available, true);
  });

  test(`${label}: result arrays and costs cannot mutate definitions or caller state`, () => {
    const f = fixture(team, actionType);
    f.entry.requires = ['archer-attack'];
    const before = structuredClone({ definitions: f.definitions, building: f.building, state: f.state });
    const result = f.action();
    result.cost.food = 0;
    result.missingPrerequisites.length = 0;
    assert.deepEqual({ definitions: f.definitions, building: f.building, state: f.state }, before);
  });

  test(`${label}: unknown selections are user errors; broken prerequisite references remain programmer faults`, () => {
    const f = fixture(team, actionType);
    for (const id of ['absent', '__proto__', 'constructor']) {
      const result = f.action(id);
      assert.equal(result.reason, actionType === 'production' ? 'UNKNOWN UNIT TYPE' : 'UNKNOWN TECHNOLOGY');
      assert.equal(result.cost, null);
      assert.deepEqual(result.missingPrerequisites, []);
    }
    f.entry.requires = ['broken-reference'];
    assert.throws(() => f.action(), TypeError);
  });
}

for (const team of [0, 1]) {
  test(`production, seat ${team}: completed enemy producer is rejected without other blockers`, () => {
    const f = fixture(team, 'production');
    const friendlyBefore = structuredClone({ definitions: f.definitions, building: f.building, state: f.state });
    const friendly = f.action();
    assert.equal(friendly.available, true);
    assert.equal(friendly.reason, '');
    assert.deepEqual({ definitions: f.definitions, building: f.building, state: f.state }, friendlyBefore);
    f.building.team = 1 - team;
    const enemyBefore = structuredClone({ definitions: f.definitions, building: f.building, state: f.state });
    const enemy = f.action();
    assert.equal(enemy.available, false);
    assert.equal(enemy.reason, 'SELECT A COMPLETED BUILDING THAT PRODUCES THIS UNIT');
    assert.deepEqual({ definitions: f.definitions, building: f.building, state: f.state }, enemyBefore);
  });

  test(`production, seat ${team}: queue, reservations, prerequisites, population and spawn keep their reason precedence`, () => {
    const f = fixture(team, 'production');
    f.entry.requires = ['archer-attack'];
    Object.assign(f.building, { team: 1 - team, complete: false, queue: 5, productionBlocked: true });
    Object.assign(f.state, { matchOver: true, seatReservedUnits: 996, totalReservedUnits: 1992,
      populationAvailable: 0, food: 0, wood: 0 });
    assert.equal(f.action().reason, 'SELECT A COMPLETED BUILDING THAT PRODUCES THIS UNIT');
    Object.assign(f.building, { team, complete: true });
    assert.equal(f.action().reason, 'MATCH FINISHED');
    f.state.matchOver = false;
    assert.equal(f.action().reason, 'QUEUE FULL 5/5');
    f.building.queue = 0;
    assert.equal(f.action().reason, 'UNIT CAP REACHED');
    f.state.seatReservedUnits = 0;
    assert.equal(f.action().reason, 'UNIT CAP REACHED', 'global reservations retain the cap independently');
    f.state.totalReservedUnits = 0;
    assert.equal(f.action().reason, 'REQUIRES ARCHER FLETCHING');
    f.state.upgrades.archerAttack = true;
    assert.equal(f.action().reason, 'POPULATION FULL · BUILD A HOUSE');
    f.state.populationAvailable = 10;
    assert.equal(f.action().reason, 'NEED 12.5 FOOD + 7.25 WOOD');
    Object.assign(f.state, f.entry.cost);
    assert.equal(f.action().reason, 'NO SPAWN ROOM');
    f.building.productionBlocked = false;
    assert.equal(f.action().available, true);
  });

  test(`research, seat ${team}: ownership, completion, active work and prerequisites keep their reason precedence`, () => {
    const f = fixture(team, 'research');
    f.entry.requires = ['archer-attack'];
    Object.assign(f.building, { team: 1 - team, complete: false });
    Object.assign(f.state, { matchOver: true, active: { type: 'military-armor' }, food: 0, wood: 0 });
    f.state.upgrades.infantryAttack = true;
    assert.equal(f.action().reason, 'SELECT A FRIENDLY RESEARCH BUILDING');
    f.building.team = team;
    assert.equal(f.action().reason, 'MATCH FINISHED');
    f.state.matchOver = false;
    assert.equal(f.action().reason, 'COMPLETE BUILDING TO RESEARCH');
    f.building.complete = true;
    assert.equal(f.action().reason, 'ALREADY COMPLETED');
    f.state.upgrades.infantryAttack = false;
    assert.equal(f.action().reason, 'RESEARCH IN PROGRESS');
    f.state.active = null;
    assert.equal(f.action().reason, 'REQUIRES ARCHER FLETCHING');
    f.state.upgrades.archerAttack = true;
    assert.equal(f.action().reason, 'NEED 12.5 FOOD + 7.25 WOOD');
    Object.assign(f.state, f.entry.cost);
    assert.equal(f.action().available, true);
  });
}
