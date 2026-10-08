import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { constructionCostForProfile } from '../src/economy-profile.mjs';
import { formatResourceRequirement } from '../src/resource-format.mjs';
import { setHudActionAvailability, isHudActionUnavailable } from '../src/hud-layout.mjs';
const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const fn = source.slice(source.indexOf('function updateBuildingLifecycleActions('), source.indexOf('function updateRosterBuildingOptions('));
for (const team of [0, 1]) test(`contextual lifecycle choices follow owned building state for seat ${team}`, () => {
  const commands = [];
  const container = { dataset: {}, children: [], replaceChildren() { this.children = []; }, append(button) { this.children.push(button); } };
  const building = { id: 7, team, complete: false, queue: 0, hp: 1800, maxHp: 1800 };
  const context = vm.createContext({ ui: { buildingLifecycleActions: container, cancelWorkerTraining: {} },
    document: { createElement() { return { dataset: {}, addEventListener(_, callback) { this.click = callback; } }; } },
    localTeam: team, latestBuildings: [building], selectedBuildingId: 7, matchWinner: -1,
    latestTeamResearch: [{}, {}], latestWorkerProduction: [{ queue: 1 }, { queue: 1 }],
    teamUnits: [[{ id: 1, hp: 100, kind: 'worker' }], [{ id: 2, hp: 100, kind: 'worker' }]],
    getBuildingQueueLength: (row) => row.queue, sendCommand: (command) => commands.push(command),
    sendTrackedOrder: (command, label, count, unitName) => { assert.equal(label, 'REPAIR'); assert.equal(count, 1); assert.equal(unitName, 'WORKERS'); commands.push(command); },
  });
  vm.runInContext(fn, context); context.updateBuildingLifecycleActions();
  assert.deepEqual(container.children.map((button) => button.dataset.action), ['cancelConstruction']); container.children[0].click();
  assert.deepEqual(JSON.parse(JSON.stringify(commands[0])), { type: 'cancelConstruction', buildingId: 7 });
  building.complete = true; building.queue = 2; building.hp = 900;
  context.latestTeamResearch[team].active = { buildingId: 7 };
  context.updateBuildingLifecycleActions();
  assert.deepEqual(container.children.map((button) => button.dataset.action), ['cancelTraining', 'cancelResearch', 'repairBuilding']);
  const repair = container.children.at(-1); repair.click();
  assert.deepEqual(JSON.parse(JSON.stringify(commands.at(-1))), { type: 'repairBuilding', buildingId: 7, ids: [team + 1] });
  context.updateBuildingLifecycleActions(); assert.equal(container.children.at(-1), repair, 'state refresh preserves focused action');
  building.team = 1 - team; context.updateBuildingLifecycleActions(); assert.equal(container.children.length, 0);
  context.localTeam = null; context.updateBuildingLifecycleActions(); assert.equal(context.ui.cancelWorkerTraining.disabled, true);
});

for (const team of [0, 1]) test(`seat ${team}: exhausted Farm Replant discloses eligibility and rechecks retained actions`, t => {
  const dom = new JSDOM(readFileSync(new URL('../index.html', import.meta.url), 'utf8'), { runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  const w = dom.window, container = w.document.querySelector('#building-lifecycle-actions'), commands = [];
  const farm = { id: 10, team, type: 'farm', complete: true, hp: 600, maxHp: 600, harvestStock: 0 };
  Object.assign(w, { ui: { buildingLifecycleActions: container }, localTeam: team, matchWinner: -1,
    selectedBuildingId: farm.id, latestBuildings: [farm], latestTeamResearch: [{}, {}],
    latestWood: [500, 500], mapDefinition: {}, constructionCostForProfile, formatResourceRequirement,
    setHudActionAvailability, isHudActionUnavailable, getBuildingQueueLength: () => 0,
    units: [{ id: 0, team: 0, kind: 'worker', hp: 100 }, { id: 1, team: 0, kind: 'infantry', hp: 100 },
      { id: 2, team: 1, kind: 'worker', hp: 100 }, { id: 3, team: 1, kind: 'infantry', hp: 100 }],
    selected: new w.Set(), sendCommand: command => commands.push(command),
    sendTrackedOrder: command => commands.push(command), showToast() {}, teamUnits: [[], []] });
  for (const name of ['selectedIds', 'selectedWorkerIds']) {
    const start = source.indexOf(`function ${name}(`), end = source.indexOf('\nfunction ', start + 1);
    w.eval(source.slice(start, end));
  }
  w.eval(fn); w.updateBuildingLifecycleActions();
  let action = container.querySelector('[data-action="replantFarm"]'); action.focus();
  assert.equal(w.document.activeElement, action); assert.equal(action.disabled, false);
  assert.equal(action.getAttribute('aria-disabled'), 'true'); assert.match(action.textContent, /Select living Workers/);
  action.click(); assert.equal(commands.length, 0);
  w.selected = new w.Set([team * 2, team * 2 + 1]); w.latestWood[team] = 59.99; w.updateBuildingLifecycleActions();
  assert.equal(container.querySelector('[data-action="replantFarm"]'), action);
  assert.equal(w.document.activeElement, action); assert.match(action.textContent, /Need 1 wood/);
  assert.equal(action.title, action.textContent);
  for (const detail of [0, 1]) action.dispatchEvent(new w.MouseEvent('click', { bubbles: true, detail }));
  assert.equal(commands.length, 0);
  w.latestWood[team] = 60; w.updateBuildingLifecycleActions();
  assert.equal(action.getAttribute('aria-disabled'), 'false'); assert.equal(action.textContent, 'Replant · 60 wood');
  action.click(); assert.deepEqual(JSON.parse(JSON.stringify(commands)), [{ type: 'replantFarm', buildingId: 10, ids: [team * 2] }]);
  assert.deepEqual([...w.selected], [team * 2, team * 2 + 1]);
  const retained = action; farm.hp = 599; w.latestWood[team] = 0;
  retained.click(); assert.equal(commands.length, 1, 'adding Repair must not leave the detached Replant action enabled');
  action = container.querySelector('[data-action="replantFarm"]');
  assert.notEqual(action, retained); assert.equal(w.document.activeElement, action);
  assert.equal(action.getAttribute('aria-disabled'), 'true');
  // Removing Repair while Workers disappear must also inspect the new node.
  w.latestWood[team] = 60; w.updateBuildingLifecycleActions();
  farm.hp = 600; w.selected.clear(); action.click(); assert.equal(commands.length, 1);
  action = container.querySelector('[data-action="replantFarm"]');
  w.selected = new w.Set([team * 2, team * 2 + 1]);
  // No UI refresh: eligibility must be checked at activation time.
  w.latestWood[team] = 0; action.click(); assert.equal(commands.length, 1); assert.match(action.title, /Need 60 wood/);
  w.latestWood[team] = 60;
  for (const ids of [[], [(1 - team) * 2], [team * 2 + 1], [900]]) {
    w.selected = new w.Set(ids); action.click(); assert.equal(commands.length, 1);
    assert.match(action.title, /Select living Workers/);
  }
  w.selected = new w.Set([team * 2]); w.units[team * 2].hp = 0; action.click(); assert.equal(commands.length, 1);
  w.units[team * 2].hp = 100; w.matchWinner = team; action.click(); assert.equal(commands.length, 1); assert.match(action.title, /Match finished/);
  w.matchWinner = -1; w.updateBuildingLifecycleActions();
  for (const patch of [{ harvestStock: 1 }, { complete: false }, { hp: 0 }, { team: 1 - team }]) {
    Object.assign(farm, patch); action.click(); assert.equal(commands.length, 1);
    Object.assign(farm, { harvestStock: 0, complete: true, hp: 600, team });
  }
  w.selectedBuildingId = 11; action.click(); assert.equal(commands.length, 1);
  w.selectedBuildingId = farm.id; w.latestBuildings = []; action.click(); assert.equal(commands.length, 1);
  w.latestBuildings = [farm]; w.localTeam = null; action.click(); assert.equal(commands.length, 1);
});
