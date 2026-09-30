import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { BUILDING_DEFINITIONS, TECHNOLOGY_DEFINITIONS } from '../src/gameplay-definitions.mjs';
const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const fn = source.slice(source.indexOf('function updateRosterBuildingOptions('), source.indexOf('function updateEconomyUI('));
for (const team of [0, 1]) test(`registry building menu preserves focus and exact costs for seat ${team}`, () => {
  const placements = [];
  const container = { children: [], replaceChildren() { this.children = []; }, append(button) { this.children.push(button); } };
  const context = vm.createContext({ BUILDING_DEFINITIONS, TECHNOLOGY_DEFINITIONS,
    document: { createElement() { return { dataset: {}, classList: { toggle() {} }, setAttribute() {}, addEventListener(_, callback) { this.click = callback; } }; } },
    localTeam: team, teamUnits: [[{ kind: 'worker', hp: 100 }], [{ kind: 'worker', hp: 100 }]],
    latestFood: [500, 500], latestWood: [100, 100], latestTeamResearch: [{}, {}],
    matchWinner: -1, buildPlacementPending: false, buildPlacementActive: false, buildPlacementType: 'house',
    beginBuildPlacement: (id) => placements.push(id), cancelBuildPlacement: () => placements.push('cancel'),
  });
  vm.runInContext(fn, context); context.updateRosterBuildingOptions(container);
  const button = container.children.find((button) => button.dataset.building === 'storehouse');
  assert.ok(button); assert.equal(button.disabled, false); button.click();
  assert.deepEqual(placements, ['storehouse']);
  const center = container.children.find((row) => row.dataset.building === 'town-center');
  assert.ok(center); assert.equal(center.disabled, true);
  context.latestWood[team] = 400; context.latestFood[team] = 99; context.updateRosterBuildingOptions(container);
  assert.equal(center.disabled, true, 'food is required as well as wood');
  context.latestFood[team] = 100; context.updateRosterBuildingOptions(container);
  assert.equal(center.disabled, false); assert.match(center.textContent, /400 WOOD.*100 FOOD/);
  assert.equal(container.children.find((row) => row === center), center);
  context.latestFood[team] = 500;
  context.latestWood[team] = 99.99; context.updateRosterBuildingOptions(container);
  assert.equal(container.children.find((row) => row === button), button); assert.equal(button.disabled, true);
  context.latestWood[team] = 100; context.buildPlacementActive = true; context.buildPlacementType = 'storehouse';
  context.updateRosterBuildingOptions(container); button.click(); assert.equal(placements.at(-1), 'cancel');
});
