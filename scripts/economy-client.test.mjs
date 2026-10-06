import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { economyClientBindings } from './economy-client-fixture.mjs';
import { constructionClientFixture } from './construction-client-fixture.mjs';
import { BUILDING_DEFINITIONS, TECHNOLOGY_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { DEFAULT_ECONOMY_PROFILE_ID as BASE, STONE_ECONOMY_PROFILE_ID as STONE, economyRulesetRevision } from '../src/economy-profile.mjs';
import { matchesEconomySnapshot, profileDropoffResources, sumTypedCargo } from '../src/economy-client.mjs';
import { selectionContext } from '../src/selection-context.mjs';
import { unitCargoVisualState } from '../src/unit-visual-state.mjs';
const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
function fn(name) {
  const start = source.indexOf(`function ${name}(`), end = source.indexOf('\nfunction ', start + 1);
  assert.ok(start >= 0 && end > start); return source.slice(start, end);
}

test('Stone snapshots require matching explicit profile, current pin and finite private bank shape', () => {
  assert.equal(matchesEconomySnapshot({ rulesetRevision: economyRulesetRevision(BASE) }), true);
  const state = { economyProfileId: STONE, rulesetRevision: economyRulesetRevision(STONE), stone: [7.25, null] };
  assert.equal(matchesEconomySnapshot(state, STONE), true); assert.equal(matchesEconomySnapshot(state), false);
  for (const change of [s => delete s.economyProfileId, s => s.economyProfileId = null,
    s => delete s.rulesetRevision, s => s.rulesetRevision = economyRulesetRevision(BASE),
    s => delete s.stone, s => s.stone = [1], s => s.stone = [NaN, 0], s => s.stone = [-1, 0]]) {
    const invalid = structuredClone(state); change(invalid); assert.equal(matchesEconomySnapshot(invalid, STONE), false);
  }
});

test('Stone cargo remains distinct from food, wood and unknown cargo without granting any bank', () => {
  const units = [{ cargoType: 'food', cargo: 0.5 }, { cargoType: 'wood', cargo: 7.25 },
    { cargoType: 'stone', cargo: 3.125 }, { cargoType: 'gold', cargo: 10 }, { cargoType: null, cargo: 10 }];
  const before = structuredClone(units);
  assert.deepEqual(sumTypedCargo(units, STONE), { food: 0.5, wood: 7.25, stone: 3.125 });
  assert.deepEqual(sumTypedCargo(units, BASE), { food: 0.5, wood: 7.25 }); assert.deepEqual(units, before);
  assert.equal(unitCargoVisualState('worker', 35, true, 3.125, 'stone'), 'stone');
  assert.equal(unitCargoVisualState('worker', 35, true, 3.125, 'gold'), 'unknown');
  assert.equal(unitCargoVisualState('worker', 0, true, 3.125, 'stone'), 'none');
  assert.equal(unitCargoVisualState('worker', 35, false, 3.125, 'stone'), 'none');
  assert.deepEqual(profileDropoffResources('mill', STONE), ['food']);
  for (const type of ['town-center', 'storehouse']) {
    assert.deepEqual(profileDropoffResources(type, STONE), ['food', 'wood', 'stone']);
    assert.deepEqual(profileDropoffResources(type, BASE), ['food', 'wood']);
  }
});

for (const profile of [BASE, STONE]) test(`${profile}: cargo totals reject invalid amounts and unknown types without coercion`, () => {
  const units = [
    { cargoType: 'food', cargo: 0.625 }, { cargoType: 'food', cargo: 0.625 },
    { cargoType: 'wood', cargo: 7.25 }, { cargoType: 'stone', cargo: 3.125 },
    ...['food', 'wood', 'stone'].flatMap(cargoType =>
      [0, -0, -1, NaN, Infinity, -Infinity, undefined, null, '100', new Number(100)]
        .map(cargo => ({ cargoType, cargo }))),
    ...['gold', '__proto__', 'constructor', 'toString', '', null, undefined]
      .map(cargoType => ({ cargoType, cargo: 100 })),
  ].map(unit => Object.freeze(unit));
  const before = structuredClone(units);
  const expected = profile === STONE ? { food: 1.25, wood: 7.25, stone: 3.125 } : { food: 1.25, wood: 7.25 };
  assert.deepEqual(sumTypedCargo(Object.freeze(units), profile), expected);
  assert.deepEqual(units, before, 'aggregation does not normalize or mutate source cargo');
  assert.deepEqual(sumTypedCargo([], profile), Object.fromEntries(Object.keys(expected).map(resource => [resource, 0])));

  for (const team of [0, 1]) {
    const selected = units.map(unit => Object.freeze({ team, kind: 'worker', hp: 35, ...unit }));
    selected.push(
      { team: 1 - team, kind: 'worker', hp: 35, cargoType: 'food', cargo: 999 },
      { team, kind: 'worker', hp: 0, cargoType: 'food', cargo: 999 },
      { team, kind: 'infantry', hp: 100, cargoType: 'food', cargo: 999 },
    );
    const selection = Object.freeze(selected);
    const model = selectionContext(selection, [...selection.keys(), selection.length + 1], team, null, profile);
    assert.deepEqual(model.cargo, expected, `seat ${team}: only living friendly gatherers contribute`);
  }
});

for (const team of [0, 1]) {
  test(`seat ${team}: roster Watchtower shows all three costs and preserves fractional affordability and focus`, () => {
    const container = { children: [], replaceChildren() { this.children = []; }, append(button) { this.children.push(button); } };
    const c = vm.createContext({ ...economyClientBindings(), BUILDING_DEFINITIONS, TECHNOLOGY_DEFINITIONS,
      mapDefinition: { economyProfileId: STONE }, localTeam: team, latestFood: [500, 500], latestWood: [500, 500],
      latestStone: [49.9999, 49.9999], latestTeamResearch: [{}, {}], selectedWorkerIds: () => [team],
      matchWinner: -1, buildPlacementPending: false, buildPlacementActive: false, buildPlacementType: 'house',
      document: { createElement: () => ({ dataset: {}, classList: { toggle() {} }, setAttribute() {}, addEventListener() {} }) },
    });
    vm.runInContext(fn('updateRosterBuildingOptions'), c); c.updateRosterBuildingOptions(container);
    const tower = container.children.find(button => button.dataset.building === 'watchtower');
    assert.equal(tower.disabled, true); assert.match(tower.textContent, /150 WOOD \+ 50 FOOD \+ 50 STONE/);
    c.latestStone[team] = 50; c.updateRosterBuildingOptions(container);
    assert.equal(tower.disabled, false); assert.equal(container.children.find(button => button.dataset.building === 'watchtower'), tower);
    assert.equal(c.latestStone[team], 50, 'UI never debits bank balances');
    c.mapDefinition = {}; c.latestStone[team] = 0; c.updateRosterBuildingOptions(container);
    assert.equal(tower.disabled, false); assert.doesNotMatch(tower.textContent, /STONE/);
  });
  test(`seat ${team}: normal placement rejects Stone shortfall before entering a paid intent`, () => {
    const worker = { id: 0, team, generation: 1, kind: 'worker', hp: 35 };
    const f = constructionClientFixture({ team, units: [worker], selection: [0] });
    f.context.mapDefinition = { economyProfileId: STONE }; f.context.latestStone = [49.9999, 49.9999];
    f.context.beginBuildPlacement('watchtower');
    assert.equal(f.context.buildPlacementActive, false); assert.deepEqual(f.payloads, []);
    assert.match(f.toasts.at(-1), /NEEDS 50 STONE/);
    f.context.latestStone[team] = 50; f.context.beginBuildPlacement('watchtower');
    assert.equal(f.context.buildPlacementActive, true); assert.equal(f.context.buildPlacementType, 'watchtower');
    assert.equal(f.context.latestStone[team], 50);
  });
}
