import { economyClientBindings } from './economy-client-fixture.mjs';
import { researchAction, researchOptions } from '../src/research-actions.mjs';
import { UNIT_DEFINITIONS, BUILDING_DEFINITIONS, TECHNOLOGY_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { formatResourceStock, formatResourceRequirement } from '../src/client/hud/resource-format.mjs';
import { ownedPopulationReadout } from '../src/client/hud/population-readout.mjs';

test('resource formatter compatibility preserves only the existing named bindings', async () => {
  const legacy = await import('../src/resource-format.mjs');
  const current = await import('../src/client/hud/resource-format.mjs');
  const names = ['formatResourceRequirement', 'formatResourceStock'];
  assert.deepEqual(Object.keys(legacy), names);
  assert.deepEqual(Object.keys(current), names);
  for (const name of names) assert.equal(legacy[name], current[name], name);
});

const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const declaration = (name, next) => source.slice(source.indexOf(`function ${name}(`), source.indexOf(`\nfunction ${next}(`));
function fixture(team) {
  const element = () => ({ textContent: '', disabled: false, dataset: {}, attributes: {},
    classList: { toggle() {} }, setAttribute(name, value) { this.attributes[name] = value; },
    getAttribute(name) { return this.attributes[name] ?? null; }, querySelector: () => ({ textContent: '' }) });
  const ui = new Proxy({}, { get(target, key) { return target[key] ||= element(); } });
  const context = vm.createContext({ ...economyClientBindings(), ui, localTeam: team, matchWinner: -1,
    formatResourceStock, formatResourceRequirement, ownedPopulationReadout,
    UNIT_DEFINITIONS, BUILDING_DEFINITIONS, TECHNOLOGY_DEFINITIONS, researchAction, researchOptions,
    latestFood: [0, 0], latestWood: [0, 0], latestWorkerProduction: [null, null], latestPopulation: [null, null],
    latestTeamResearch: [{}, {}], latestRosterSize: 4,
    latestBuildings: [{ id: 1, team, type: 'barracks', complete: true, queue: [] },
      { id: 2, team, type: 'archery-range', complete: true, queue: [] },
      { id: 1_000_000_000 + team, team, type: 'town-center', home: true, complete: true, queue: [] }],
    selectedBuildingId: 1, teamUnits: [0, 1].map(t => [{ hp: 100, team: t, kind: 'worker', cargoType: 'food', cargo: 9.999 }]),
    selected: new Set([0]), units: [{ id: 0, team, hp: 100, kind: 'worker', serverX: 0, serverZ: 0 }],
    MAX_PER_TEAM: 1000, MAX_UNITS: 2000, buildPlacementPending: false, buildPlacementActive: false,
    buildPlacementType: 'barracks', livingIdleWorkerIds: () => [],
    document: { querySelector: element }, mapDefinition: { resourceNodes: [{}] },
    updateRosterProductionOptions() {}, updateRosterBuildingOptions() {}, updateBuildingLifecycleActions() {},
    window: { matchMedia: () => ({ matches: false }) }, updateCommandUI() {},
  });
  vm.runInContext(source.slice(source.indexOf('const INFANTRY_FOOD_COST'), source.indexOf('const TEAM_NAMES'))
    + declaration('getBuildingQueueLength', 'findTrainableArcheryRange')
    + declaration('findTrainableArcheryRange', 'findTrainableBarracks')
    + declaration('findTrainableBarracks', 'buildingLabel')
    + declaration('buildingLabel', 'updateBuildingResearchControls')
    + declaration('updateBuildingResearchControls', 'buildingWoodCost')
    + declaration('selectedIds', 'issueStationaryOrder')
    + declaration('updateEconomyUI', 'updateRoomUI'), context);
  return { context, ui, stocks(food, wood) {
    const foods = [0, 0]; const woods = [0, 0]; foods[team] = food; woods[team] = wood;
    context.updateEconomyUI({ food: foods, wood: woods });
    context.updateBuildingResearchControls(context.latestBuildings[0]);
  } };
}

test('whole resource display preserves conservative stock and requirement boundaries', () => {
  assert.equal(formatResourceStock(190.033), '190');
  assert.equal(formatResourceRequirement(100 - 90.033333), '10');
  assert.equal(formatResourceStock(1234.99), (1234).toLocaleString());
  assert.equal(formatResourceRequirement(0), '0');
});

for (const team of [0, 1]) test(`seat ${team}: House, Barracks and Range require selected eligible workers`, () => {
  const f = fixture(team);
  f.context.units.push({ id: 1, team, hp: 100, kind: 'infantry' },
    { id: 2, team, hp: 0, kind: 'worker' }, { id: 3, team: 1 - team, hp: 100, kind: 'worker' });
  for (const selection of [[], [1], [2], [3], [0]]) {
    f.context.selected.clear();
    for (const id of selection) f.context.selected.add(id);
    f.stocks(1000, 1000);
    for (const name of ['buildHouse', 'buildBarracks', 'buildRange']) {
      assert.equal(f.ui[name].disabled, !selection.includes(0), `${name} with selection ${selection}`);
    }
  }
});

for (const team of [0, 1]) test(`actual economy and research controls keep exact affordability for team ${team}`, () => {
  const f = fixture(team);
  f.stocks(49.9999, 44.9999);
  assert.equal(f.ui.foodStock.textContent, '49');
  assert.equal(f.ui.woodStock.textContent, '44');
  assert.equal(f.ui.workerLoad.textContent, 'WORKER CARGO · 9 FOOD · 0 WOOD');
  for (const name of ['trainWorker', 'trainInfantry', 'trainArcher']) {
    assert.equal(f.ui[name].disabled, true);
    assert.match(f.ui[name].dataset.disabledReason, /Need (1|0) food \/ (1|0) wood/);
  }
  f.stocks(50, 45);
  for (const name of ['trainWorker', 'trainInfantry', 'trainArcher']) assert.equal(f.ui[name].disabled, false);
  f.stocks(24.9999, 45);
  assert.equal(f.ui.trainArcher.disabled, true);
  assert.equal(f.ui.trainArcher.dataset.disabledReason, 'Need 1 food / 0 wood');
  f.stocks(99.9999, 74.9999);
  assert.equal(f.ui.researchAttackUpgrade.disabled, true);
  assert.match(f.ui.buildingResearchReadout.textContent, /NEED 1 FOOD \+ 1 WOOD$/);
  assert.equal(f.context.latestFood[team], 99.9999, 'formatting never mutates authoritative stocks');
  f.stocks(100, 75);
  assert.equal(f.ui.researchAttackUpgrade.disabled, false);
  assert.doesNotMatch(f.ui.buildingResearchReadout.textContent, /NEED/);
  f.context.selectedBuildingId = 2;
  f.stocks(124.9999, 124.9999);
  f.context.updateBuildingResearchControls(f.context.latestBuildings[1]);
  assert.equal(f.ui.researchAttackUpgrade.disabled, true);
  assert.match(f.ui.buildingResearchReadout.textContent, /NEED 1 FOOD \+ 1 WOOD$/);
  f.stocks(125, 125);
  f.context.updateBuildingResearchControls(f.context.latestBuildings[1]);
  assert.equal(f.ui.researchAttackUpgrade.disabled, false);
  f.stocks(150, 149.9999);
  assert.equal(f.ui.buildRange.disabled, true);
  f.stocks(150, 150);
  assert.equal(f.ui.buildRange.disabled, false);
  f.stocks(150, 174.9999);
  assert.equal(f.ui.buildBarracks.disabled, true);
  assert.equal(f.ui.woodStock.textContent, '174');
  f.stocks(150, 175);
  assert.equal(f.ui.buildBarracks.disabled, false);
});

for (const team of [0, 1]) test(`actual economy UI keeps both population readouts synchronized for seat ${team}`, () => {
  const { context, ui } = fixture(team);
  for (const record of [
    { used: 12, reserved: 0, capacity: 15, available: 3 },
    { used: 12, reserved: 3, capacity: 15, available: 0 },
    { used: 12, reserved: 3, capacity: 23, available: 8 },
    { used: 14, reserved: 1, capacity: 23, available: 8 },
    { used: 14, reserved: 0, capacity: 15, available: 1 },
    null,
  ]) {
    const population = [{ used: 99, reserved: 9, capacity: 100, available: 0 },
      { used: 99, reserved: 9, capacity: 100, available: 0 }];
    population[team] = record;
    context.updateEconomyUI({ population });
    const expected = ownedPopulationReadout(population, team);
    assert.equal(ui.populationStock.textContent, expected.compact);
    assert.equal(ui.populationStatus.textContent, expected.detail);
    assert.equal(ui.populationReadout.getAttribute('aria-label'), expected.description);
    assert.equal(ui.populationReadout.title, expected.description);
  }
  context.localTeam = null;
  context.updateEconomyUI({ population: [{ used: 12, reserved: 0, capacity: 15, available: 3 },
    { used: 22, reserved: 0, capacity: 23, available: 1 }] });
  assert.equal(ui.populationStock.textContent, '—');
  assert.equal(ui.populationStatus.textContent, 'POPULATION · JOIN A TEAM');
  assert.equal(ui.populationReadout.getAttribute('aria-label'), 'Population: join a team.');
});

for (const team of [0, 1]) test(`seat ${team}: typed Stone bank and cargo survive UI updates without food credit or opponent disclosure`, () => {
  const { context, ui } = fixture(team);
  context.mapDefinition.economyProfileId = 'stone-defense-v1';
  context.teamUnits[team] = [{ hp: 35, team, kind: 'worker', cargoType: 'stone', cargo: 3.125 }];
  const stone = [null, null]; stone[team] = 7.25;
  context.updateEconomyUI({ stone });
  assert.equal(ui.stoneStock.textContent, '7'); assert.equal(ui.stoneStockGroup.hidden, false);
  assert.equal(context.latestStone[team], 7.25); assert.equal(context.latestStone[1 - team], null);
  assert.equal(context.latestFood[team], 0);
  assert.equal(ui.workerLoad.textContent, 'WORKER CARGO · 0 FOOD · 0 WOOD · 3 STONE');
  context.updateEconomyUI(); assert.equal(context.latestStone[team], 7.25);
  context.localTeam = null; context.updateEconomyUI(); assert.equal(ui.stoneStock.textContent, '—');
  context.localTeam = team; delete context.mapDefinition.economyProfileId; context.updateEconomyUI();
  assert.equal(ui.stoneStockGroup.hidden, true); assert.deepEqual([...context.latestStone], [0, 0]);
  assert.equal(ui.workerLoad.textContent, 'WORKER CARGO · 0 FOOD · 0 WOOD');
});
