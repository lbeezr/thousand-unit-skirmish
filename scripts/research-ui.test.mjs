import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { BUILDING_DEFINITIONS, TECHNOLOGY_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { JSDOM } from 'jsdom';
import { researchAction, researchOptions } from '../src/research-actions.mjs';
import { setHudActionAvailability, isHudActionUnavailable } from '../src/hud-layout.mjs';
const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const fn = source.slice(source.indexOf('function updateResearchOptions('), source.indexOf('function buildingWoodCost('));
for (const team of [0, 1]) test(`research buttons follow registered choices, prerequisites and focused state for seat ${team}`, () => {
  const commands = [];
  const container = { dataset: {}, children: [], replaceChildren() { this.children = []; }, append(button) { this.children.push(button); } };
  const building = { id: 4, team, type: 'barracks', complete: true };
  const context = vm.createContext({ BUILDING_DEFINITIONS, TECHNOLOGY_DEFINITIONS, researchAction, researchOptions,
    setHudActionAvailability, isHudActionUnavailable,
    localTeam: team, latestFood: [1000, 1000], latestWood: [1000, 1000], latestTeamResearch: [{}, {}], matchWinner: -1,
    document: { createElement() { return { dataset: {}, getAttribute() { return null; }, removeAttribute() {}, addEventListener(_, fn) { this.click = fn; } }; } },
    sendCommand: command => commands.push(command) });
  vm.runInContext(fn, context); context.updateResearchOptions(container, building);
  const armor = container.children.find(button => button.dataset.technology === 'military-armor');
  assert.ok(armor); assert.equal(armor.disabled, true); assert.match(armor.textContent, /REQUIRES MILITARY TIER II/);
  armor.click(); assert.equal(commands.length, 0, 'unavailable drawer research sends no request');
  context.latestTeamResearch[team].militaryTier2 = true; context.updateResearchOptions(container, building);
  assert.equal(container.children.find(button => button.dataset.technology === 'military-armor'), armor);
  assert.equal(armor.disabled, false); armor.click();
  assert.deepEqual(JSON.parse(JSON.stringify(commands)), [{ type: 'researchUpgrade', buildingId: 4, upgrade: 'military-armor' }]);
  context.latestTeamResearch[team].active = { type: 'infantry-attack' }; context.updateResearchOptions(container, building);
  assert.equal(armor.disabled, true); assert.match(armor.textContent, /RESEARCH IN PROGRESS/);
  armor.click(); assert.equal(commands.length, 1, 'researching drawer choice remains blocked');
  building.team = 1 - team; context.updateResearchOptions(container, building); assert.equal(container.children.length, 0);
});

for (const team of [0, 1]) for (const contextual of [false, true]) test(`seat ${team}: ${contextual ? 'contextual' : 'drawer'} research names prerequisite location without changing state or focus`, t => {
  const dom = new JSDOM(readFileSync(new URL('../index.html', import.meta.url), 'utf8'), { runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  const w = dom.window, commands = [];
  const container = w.document.querySelector(contextual ? '[data-context-research-options]' : '#research-options');
  Object.assign(w, { BUILDING_DEFINITIONS, TECHNOLOGY_DEFINITIONS, researchOptions,
    setHudActionAvailability, isHudActionUnavailable, localTeam: team,
    latestFood: [1000, 1000], latestWood: [1000, 1000], latestTeamResearch: [{}, {}], matchWinner: -1,
    sendCommand: command => commands.push(command) });
  w.eval(fn);
  for (const [type, upgrade] of [['barracks', 'military-armor'], ['stable', 'mounted-attack'], ['workshop', 'siege-engineering']]) {
    const building = { id: 4, team, type, complete: true }, key = TECHNOLOGY_DEFINITIONS[upgrade].upgradeKey;
    w.latestTeamResearch[team] = {}; w.updateResearchOptions(container, building);
    const button = container.querySelector(`[data-technology="${upgrade}"]`);
    const hint = 'Research MILITARY TIER II at Town Center';
    assert.match(button.textContent, /REQUIRES MILITARY TIER II/); assert.ok(button.textContent.includes(hint));
    assert.equal(isHudActionUnavailable(button), true); assert.equal(button.disabled, !contextual);
    if (contextual) { button.focus(); assert.equal(w.document.activeElement, button); }
    const before = commands.length;
    for (const detail of [0, 1]) button.dispatchEvent(new w.MouseEvent('click', { bubbles: true, detail }));
    assert.equal(commands.length, before);
    for (let i = 0; i < 3; i++) w.updateResearchOptions(container, building);
    assert.equal(container.querySelector(`[data-technology="${upgrade}"]`), button);
    assert.equal(button.textContent.split(hint).length - 1, 1, 'repeated updates never accumulate hints');
    if (contextual) assert.equal(w.document.activeElement, button);
    building.researchOptions = [{ upgrade, available: false, reason: 'WAIT FOR AUTHORITATIVE STATE' }];
    w.updateResearchOptions(container, building);
    assert.match(button.textContent, /WAIT FOR AUTHORITATIVE STATE/); assert.doesNotMatch(button.textContent, /Research MILITARY TIER II at/);
    button.click(); assert.equal(commands.length, before);
    building.researchOptions[0].reason = 'REQUIRES MILITARY TIER II'; w.updateResearchOptions(container, building);
    assert.ok(button.textContent.includes(hint));
    building.researchOptions = []; w.latestTeamResearch[team].militaryTier2 = true;
    w.updateResearchOptions(container, building); assert.equal(isHudActionUnavailable(button), false);
    assert.doesNotMatch(button.textContent, /REQUIRES|Research MILITARY TIER II at/);
    button.focus(); for (let i = 0; i < 3; i++) w.updateResearchOptions(container, building);
    assert.equal(w.document.activeElement, button); button.click();
    assert.deepEqual(JSON.parse(JSON.stringify(commands.at(-1))), { type: 'researchUpgrade', buildingId: 4, upgrade });
    w.latestTeamResearch[team] = { active: { type: upgrade, buildingId: 4 } };
    w.updateResearchOptions(container, building); assert.match(button.textContent, /RESEARCH IN PROGRESS/);
    assert.doesNotMatch(button.textContent, /Research MILITARY TIER II at/); assert.equal(isHudActionUnavailable(button), true);
    if (contextual) assert.equal(w.document.activeElement, button);
    w.latestTeamResearch[team] = { [key]: true }; w.updateResearchOptions(container, building);
    assert.match(button.textContent, /ALREADY COMPLETED/); assert.doesNotMatch(button.textContent, /Research MILITARY TIER II at/);
    button.click(); assert.equal(commands.length, before + 1);
    w.latestTeamResearch[team] = {}; building.complete = false; w.updateResearchOptions(container, building);
    assert.match(button.textContent, /COMPLETE BUILDING TO RESEARCH/); assert.doesNotMatch(button.textContent, /Research MILITARY TIER II at/);
    building.complete = true; w.matchWinner = team; w.updateResearchOptions(container, building);
    assert.match(button.textContent, /MATCH FINISHED/); assert.doesNotMatch(button.textContent, /Research MILITARY TIER II at/);
    w.matchWinner = -1; building.team = 1 - team; w.updateResearchOptions(container, building);
    assert.equal(container.children.length, 0, 'enemy buildings expose no own research controls');
  }
});
