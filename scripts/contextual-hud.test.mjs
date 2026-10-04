import { economyClientBindings } from './economy-client-fixture.mjs';
import { wildlifeClientBindings, wildlifeClientFunctionSource } from './wildlife-client-fixture-bindings.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { selectionContext } from '../src/selection-context.mjs';
import { applyUnitStances, updateCombatStanceControls, bindCombatStanceControls } from '../src/combat-stance-ui.mjs';
import { updateSelectionPortrait, updateProductionPortrait, farmSelectionFacts, workerRoleFacts, WORKER_PORTRAITS, INFANTRY_PORTRAITS, ARCHER_PORTRAITS } from '../src/selection-portrait.mjs';
import { civilizationSpriteRole } from '../src/unit-sprite-runtime.mjs';
import { UNIT_DEFINITIONS, BUILDING_DEFINITIONS, TECHNOLOGY_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { researchAction, researchOptions } from '../src/research-actions.mjs';
import { setHudActionAvailability, isHudActionUnavailable, bindContextualCommandStrip } from '../src/hud-layout.mjs';
import { livingIdleWorkerIds, livingUnitIdsOfKinds } from '../src/unit-selection.mjs';
import { formatResourceStock, formatResourceRequirement } from '../src/resource-format.mjs';
import { ownedPopulationReadout } from '../src/population-readout.mjs';
import { objectiveSummary } from '../src/client/hud/objective-summary.mjs';

const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
const minimapProof = readFileSync(new URL('./minimap-orders-browser.mjs', import.meta.url), 'utf8');
const between = (start, end) => {
  const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `client source bounds: ${start}`);
  return source.slice(a, b);
};
const fn = (name, next) => between(`function ${name}(`, `function ${next}(`);

function fixture(team = 0) {
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost/' });
  const w = dom.window, d = w.document;
  const style = d.createElement('style'); style.textContent = css; d.head.append(style);
  const bar = d.querySelector('.contextual-command-bar'), quick = d.querySelector('.hud-quick-access');
  // jsdom supplies DOM, focus and event propagation, but has no layout engine.
  const visible = element => !element.closest('[hidden]');
  w.HTMLElement.prototype.getClientRects = function () { return visible(this) ? [{}] : []; };
  for (const [element, height] of [[bar, 86], [quick, 52]]) {
    element.getBoundingClientRect = () => ({ height: visible(element) ? height : 0 });
  }
  const observers = [];
  w.ResizeObserver = class {
    constructor(callback) { this.callback = callback; this.targets = []; observers.push(this); }
    observe(target) { this.targets.push(target); }
    unobserve(target) { this.targets = this.targets.filter(element => element !== target); }
    disconnect() { this.targets = []; }
  };
  w.ui = {};
  for (const [, name, selector] of source.matchAll(/^\s*(\w+): document\.querySelector\('([^']+)'\)/gm)) w.ui[name] = d.querySelector(selector);
  Object.assign(w, { ...economyClientBindings(), ...wildlifeClientBindings(),
    selectionContext, updateSelectionPortrait, updateProductionPortrait, farmSelectionFacts, UNIT_DEFINITIONS, BUILDING_DEFINITIONS, TECHNOLOGY_DEFINITIONS,
    applyUnitStances, updateCombatStanceControls, bindCombatStanceControls, socket: { readyState: 1 },
    castPreview: true, humanRosterPreview: true, roomPageUrl: new URL('http://localhost/'),
    matchMedia: () => ({ matches: false }),
    unitSpriteRuntime: { roleForUnit: unit => civilizationSpriteRole(unit.kind, unit.team === 0 ? 'human' : 'boughward') },
    researchAction, researchOptions, setHudActionAvailability, isHudActionUnavailable, bindContextualCommandStrip,
    formatResourceStock, formatResourceRequirement,
    livingIdleWorkerIds, livingUnitIdsOfKinds, localTeam: team, matchWinner: -1,
    units: [
      { id: 0, team: 0, kind: 'worker', hp: 100, task: 'idle' },
      { id: 1, team: 0, kind: 'infantry', hp: 100 },
      { id: 2, team: 1, kind: 'worker', hp: 100, task: 'idle' },
      { id: 3, team: 1, kind: 'infantry', hp: 100 },
    ],
    selected: new w.Set(), selectedBuildingId: null, latestBuildings: [],
    controlGroups: Array.from({ length: 10 }, () => new w.Set()),
    buildingVisuals: new w.Map(), activeControlGroup: null, lastControlGroupRecall: null,
    tapOrderArmed: false, persistentTargetMode: null, buildPlacementActive: false,
    commandDock: d.querySelector('#command-deck'), dockToggle: d.querySelector('#dock-toggle'),
    dockTabs: [...d.querySelectorAll('[data-dock-tab]')], appShell: d.querySelector('.app-shell'),
    matchMenu: d.querySelector('#match-menu'), helpPanel: d.querySelector('#help-panel'),
    scenarioBriefPanel: d.querySelector('#scenario-brief-panel'),
    latestFood: [500, 500], latestWood: [500, 500], latestPopulation: [null, null],
    latestWorkerProduction: [null, null], latestRosterSize: 4,
    latestTeamResearch: [{}, {}],
    BARRACKS_QUEUE_LIMIT: 5, MAX_PER_TEAM: 1000, MAX_UNITS: 2000,
    sentCommands: [], sendCommand(command) { w.sentCommands.push(command); },
    updateBuildingLifecycleActions() {},
    updateCommandUI() {}, updateEconomyUI() {}, updateBuildingSelectionVisual() {}, updateBuildPlacementHint() {},
    syncSelectionMesh() {}, clearHeldCameraKeys() {}, showToast() {},
    keyboardTargetIsEditing: event => event.target?.matches('input, select, textarea'),
    cameraNavigationKeydown: () => false, audio: { playEvent() {} },
    wallPlacementKeydown: () => false,
    getBuildingQueueLength: building => building.productionQueue?.length || 0,
    buildingLabel: type => BUILDING_DEFINITIONS[type].label,
    closeScenarioBrief() { w.scenarioBriefPanel.hidden = true; },
    closeHudPanels() { w.matchMenu.hidden = w.helpPanel.hidden = true; },
    setTapOrderArmed(value) { w.tapOrderArmed = value; },
    cancelBuildPlacement() { w.buildPlacementActive = false; },
    centerCameraOnControlGroup() {}, revalidateControlGroups() {},
    updateControlGroupUI() { w.updateContextualCommands(); },
  });
  w.teamUnits = [w.units.filter(u => u.team === 0), w.units.filter(u => u.team === 1)];
  w.eval([
    wildlifeClientFunctionSource(source),
    fn('updateStationaryOrderControls', 'updateSelectionUI'),
    fn('updateSelectionUI', 'updateContextualCommands'), fn('updateContextualCommands', 'updateControlGroupUI'),
    fn('updateRosterProductionOptions', 'updateBuildingLifecycleActions'),
    fn('updateResearchOptions', 'buildingWoodCost'),
    fn('selectedIds', 'issueStationaryOrder'), fn('controlGroupKeyLabel', 'clearControlGroups'),
    fn('clearActiveControlGroup', 'assignControlGroup'), fn('assignControlGroup', 'centerCameraOnControlGroup'),
    fn('recallControlGroup', 'syncSelectionMesh'),
    between('function selectWholeTeam(', 'const matchMenu ='),
    between('const contextualBar =', 'let hudPreferences;'),
    between('function selectDockTab(', 'matchMenuToggle.addEventListener'),
  ].join('\n'));
  // The dock function ends before its following listener, rather than another declaration.
  w.eval(between("for (const button of document.querySelectorAll('[data-open-dock-tab]'))", "document.querySelector('#guidance-toggle').addEventListener"));
  w.eval(between("for (const button of document.querySelectorAll('[data-context-proxy]'))", '\nupdateContextualCommands();'));
  // Register the two real Escape handlers in their production order.
  w.eval(between("window.addEventListener('keydown', (event) => {\n  if (document.fullscreenElement", 'const AUDIO_CAPTIONS ='));
  w.eval(between('function controlGroupIndexFromKey(', "window.addEventListener('keydown', (event) => {\n  if (event.key === 'Shift')"));
  w.ui.selectIdleWorkers.addEventListener('click', w.selectIdleWorkers);
  w.ui.selectMilitary.addEventListener('click', w.selectMilitary);
  w.updateSelectionUI();
  return { w, d, dom, bar, quick, observers,
    select(ids = [], building = null) {
      w.selected = new w.Set(ids); w.latestBuildings = building ? [building] : [];
      w.selectedBuildingId = building?.id ?? null; w.updateSelectionUI();
    },
    click(element) { assert.ok(visible(element)); element.focus(); element.click(); },
    escape() { d.activeElement.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true })); },
  };
}

for (const team of [0, 1]) test(`seat ${team}: utility selection describes its actual role`, () => {
  const f = fixture(team);
  Object.assign(f.w, { matchMedia: () => ({ matches: false }), attackMoveMode: false,
    updateBuildingResearchControls() {}, syncTargetOrderUI() {}, syncBattlefieldCursor() {} });
  f.w.eval(fn('buildingSupportsRally', 'syncTargetOrderUI'));
  const expectations = {
    farm: /Food plot.*200.*food remaining/,
    'palisade-wall': /Blocks land movement/,
    'palisade-gate': /Gate closed.*both teams/,
    watchtower: /Defends.*7.*range/,
    house: /Population capacity \+8/,
    mill: /Drop-off: food/,
    storehouse: /Drop-off: food and wood/,
  };
  for (const [type, expected] of Object.entries(expectations)) {
    const building = { id: 50, team, type, complete: true, progress: 1,
      hp: BUILDING_DEFINITIONS[type].maxHp, maxHp: BUILDING_DEFINITIONS[type].maxHp, harvestStock: 200 };
    f.select([], building); f.w.updateCommandUI();
    assert.match(f.w.ui.selectedBuildingProduction.textContent, expected, type);
    building.complete = false; f.select([], building); f.w.updateCommandUI();
    assert.doesNotMatch(f.w.ui.selectedBuildingProduction.textContent, /unlock production/, type);
    assert.match(f.w.ui.commandHint.textContent, /finish construction/, type);
  }
  const farm = { id: 50, team, type: 'farm', complete: true, progress: 1, hp: 600, maxHp: 600, harvestStock: 0 };
  f.select([], farm); f.w.updateCommandUI();
  assert.match(f.w.ui.selectedBuildingProduction.textContent, /0 \/ 200 food remaining.*Exhausted/);
  assert.match(f.w.ui.commandHint.textContent, /Clear exhausted Farm.*build a new Farm/);
  const gate = { id: 50, team, type: 'palisade-gate', complete: true, progress: 1, hp: 300, maxHp: 300, gateOpen: true };
  f.select([], gate); assert.match(f.w.ui.selectedBuildingProduction.textContent, /Gate open.*both teams/);
  f.dom.window.close();
});

// Exercise selection with the actual economy/command handlers. The default
// fixture deliberately lets other tests set availability independently.
function economyFixture(team) {
  const f = fixture(team), w = f.w;
  Object.assign(w, { ownedPopulationReadout, matchMedia: () => ({ matches: false }),
    buildPlacementPending: false, buildPlacementType: 'barracks', attackMoveMode: false,
    INFANTRY_FOOD_COST: UNIT_DEFINITIONS.infantry.cost.food,
    INFANTRY_TRAIN_SECONDS: UNIT_DEFINITIONS.infantry.trainSeconds,
    WORKER_FOOD_COST: UNIT_DEFINITIONS.worker.cost.food,
    WORKER_TRAIN_SECONDS: UNIT_DEFINITIONS.worker.trainSeconds,
    ARCHER_FOOD_COST: UNIT_DEFINITIONS.archer.cost.food,
    ARCHER_WOOD_COST: UNIT_DEFINITIONS.archer.cost.wood,
    BARRACKS_WOOD_COST: BUILDING_DEFINITIONS.barracks.cost.wood,
    ARCHERY_RANGE_WOOD_COST: BUILDING_DEFINITIONS['archery-range'].cost.wood,
    WORKER_QUEUE_LIMIT: 5, ARCHERY_RANGE_QUEUE_LIMIT: 5,
    syncTargetOrderUI() {}, syncBattlefieldCursor() {},
  });
  w.eval([
    fn('findTrainableArcheryRange', 'buildingLabel'),
    fn('updateBuildingResearchControls', 'updateResearchOptions'),
    fn('buildingSupportsRally', 'syncTargetOrderUI'),
    fn('updateBuildingLifecycleActions', 'updateRosterBuildingOptions'),
    fn('updateRosterBuildingOptions', 'updateEconomyUI'),
    fn('updateEconomyUI', 'updateRoomUI'),
    fn('selectBuilding', 'pickFriendly'),
    fn('applyWaypointQueueCounts', 'updateRosterProductionOptions'),
  ].join('\n'));
  w.updateEconomyUI();
  return f;
}

for (const team of [0, 1]) test(`seat ${team}: Orders Patrol and Follow require living owned land selection after every refresh`, t => {
  const f = economyFixture(team), w = f.w; t.after(() => f.dom.window.close());
  w.eval(fn('setPersistentTargetMode', 'setAttackMoveMode'));
  w.selectDockTab('command', true);
  const choices = [...f.d.querySelectorAll('[data-persistent-order]')];
  const patrol = choices.find(button => button.dataset.persistentOrder === 'patrol' && !button.closest('.contextual-command-bar'));
  const assertDisabled = disabled => { for (const button of choices) assert.equal(button.disabled, disabled, button.textContent); };
  assert.equal(patrol.closest('[hidden]'), null, 'the Orders drawer exposes the affected controls');
  assertDisabled(true);
  w.updateCommandUI(); w.updateEconomyUI(); assertDisabled(true);
  const worker = team * 2, military = worker + 1, enemy = (1 - team) * 2;
  f.select([worker]); assertDisabled(false);
  patrol.click(); assert.equal(w.persistentTargetMode, 'patrol');
  f.select(); assertDisabled(true);
  patrol.click(); assert.equal(w.persistentTargetMode, 'patrol', 'a disabled control cannot toggle the target mode');
  f.select([military]); assertDisabled(false);
  w.units[military].hp = 0; w.updateSelectionUI(); assertDisabled(true);
  f.select([enemy]); assertDisabled(true);
  w.units[military].hp = 100; f.select([worker, military]); assertDisabled(false);
  f.select([], { id: 80, team, type: 'barracks', complete: true, productionQueue: [] }); assertDisabled(true);
  w.units[worker].kind = 'skiff'; f.select([worker]); assertDisabled(true);
  w.units[worker].kind = 'worker'; f.select([worker]); assertDisabled(false);
  w.updateEconomyUI(); w.updateCommandUI(); assertDisabled(false);
  assert.equal(w.sentCommands.length, 0, 'target-mode selection does not issue a battlefield order');
});

for (const team of [0, 1]) test(`seat ${team}: selection immediately refreshes paid construction without a Move or snapshot`, t => {
  const f = economyFixture(team), w = f.w; t.after(() => f.dom.window.close());
  const builds = [w.ui.buildBarracks, w.ui.buildRange, w.ui.buildHouse,
    w.ui.rosterBuildingOptions.querySelector('[data-building="mill"]')];
  const assertDisabled = value => { for (const button of builds) assert.equal(button.disabled, value, button.textContent); };
  assertDisabled(true);
  w.selectIdleWorkers(); assertDisabled(false);
  w.selectMilitary(); assertDisabled(true);
  w.selectWorkers(); assertDisabled(false);
  f.select(); assertDisabled(true);
  w.selectIdleWorkers(); assertDisabled(false);
  assert.equal(w.sentCommands.length, 0, 'selection needs no Move command to refresh Build');

  const wood = [500, 500]; wood[team] = 0;
  w.updateEconomyUI({ wood }); assertDisabled(true);
  w.selectIdleWorkers(); assertDisabled(true);
  w.updateEconomyUI({ wood: [500, 500] }); assertDisabled(false);
  w.selectIdleWorkers(); assertDisabled(false);
  w.buildPlacementPending = true; w.updateSelectionUI(); assertDisabled(true);
  w.buildPlacementPending = false; w.updateSelectionUI(); assertDisabled(false);
});

for (const team of [0, 1]) test(`seat ${team}: selected Range production follows completion, resources and authoritative availability`, t => {
  const f = economyFixture(team), w = f.w; t.after(() => f.dom.window.close());
  const barracks = { id: 7, team, type: 'barracks', complete: true, productionQueue: [] };
  const range = { id: 8, team, type: 'archery-range', complete: false, progress: .5, productionQueue: [] };
  w.latestBuildings = [barracks, range];
  w.selectBuilding(barracks); assert.equal(f.bar.querySelector('[data-product="infantry"]').dataset.producer, '7');
  w.selectBuilding(range);
  const train = f.bar.querySelector('[data-product="archer"]');
  const assertAvailable = (available, reason) => {
    assert.equal(train.getAttribute('aria-disabled'), String(!available));
    assert.equal(train.disabled, false, 'unavailable contextual production stays inspectable');
    if (reason) assert.match(train.textContent, reason);
  };
  assertAvailable(false, /Complete a production building/);
  train.focus(); range.complete = true; range.progress = 1;
  w.updateEconomyUI(); w.updateSelectionUI({ refreshEconomy: false });
  assertAvailable(true); assert.equal(f.d.activeElement, train);
  assert.equal(f.bar.querySelector('[data-context-proxy="train-archer"]').hidden, true);
  const food = [500, 500]; food[team] = 0;
  w.updateEconomyUI({ food }); assertAvailable(false, /Need .*food/);
  train.click(); assert.equal(w.sentCommands.length, 0);
  w.updateEconomyUI({ food: [500, 500] }); assertAvailable(true);
  range.productionBlocked = true; w.updateEconomyUI(); assertAvailable(false, /spawn area/);
  range.productionBlocked = false;
  range.productionQueue = Array(5).fill('archer'); w.updateEconomyUI(); assertAvailable(false, /Queue full/);
  range.productionQueue = [];
  const population = [null, null]; population[team] = { available: 0 };
  w.updateEconomyUI({ population }); assertAvailable(false, /Population full/);
  w.updateEconomyUI({ population: [null, null] }); assertAvailable(true);
  range.productionOptions = [{ kind: 'archer', available: false, reason: 'REQUIRES MILITARY TIER II' }];
  w.updateEconomyUI(); assertAvailable(false, /REQUIRES MILITARY TIER II/);
  range.productionOptions[0].available = true; w.updateEconomyUI(); assertAvailable(true);
  w.selectBuilding(range); w.updateSelectionUI();
  assert.equal(f.bar.querySelector('[data-product="archer"]'), train);
  assert.equal(f.d.activeElement, train);
  train.click(); assert.deepEqual(JSON.parse(JSON.stringify(w.sentCommands)), [{ type: 'trainUnit', kind: 'archer', buildingId: 8 }]);
});

test('waypoint-only and post-economy selection renders retain live availability without a second economy pass', t => {
  const f = economyFixture(0), w = f.w; t.after(() => f.dom.window.close());
  const update = w.updateEconomyUI; let economyPasses = 0;
  w.updateEconomyUI = (...args) => { economyPasses++; update(...args); };
  w.selectIdleWorkers(); assert.equal(economyPasses, 1);
  w.applyWaypointQueueCounts([[0, 2]]);
  assert.equal(w.ui.selectedWaypoints.hidden, false); assert.match(w.ui.selectedWaypoints.textContent, /2 QUEUED/);
  assert.equal(economyPasses, 1, 'waypoint-only messages do not change selection or economy');
  w.updateEconomyUI({ wood: [0, 500] });
  w.updateSelectionUI({ refreshEconomy: false });
  assert.equal(economyPasses, 2); assert.equal(w.ui.buildBarracks.disabled, true);
  const snapshot = fn('applyState', 'updateEnvironmentStateCaptureSnapshot');
  assert.match(snapshot, /updateEconomyUI\(state, audioReset\);[\s\S]*updateSelectionUI\(\{ refreshEconomy: false \}\);/);
});

for (const team of [0, 1]) test(`seat ${team}: shipped stance binding follows selection, confirmed snapshots and visible focus recovery`, t => {
  const f = fixture(team); t.after(() => f.dom.window.close());
  const worker = team * 2, military = worker + 1;
  for (const unit of f.w.units) unit.generation = 0;
  applyUnitStances(f.w.units, [[military, 0, 'aggressive']], team, UNIT_DEFINITIONS);
  f.select([worker, military]);
  const group = f.bar.querySelector('[data-stance-controls]'), button = group.querySelector('[data-combat-stance="defensive"]');
  assert.equal(group.hidden, false); f.click(button);
  assert.deepEqual(JSON.parse(JSON.stringify(f.w.sentCommands)), [{ type: 'setStance', ids: [military], unitGenerations: [0], stance: 'defensive' }]);
  assert.equal(button.getAttribute('aria-pressed'), 'false');
  applyUnitStances(f.w.units, [[military, 0, 'defensive']], team, UNIT_DEFINITIONS); f.w.updateSelectionUI();
  assert.equal(button.getAttribute('aria-pressed'), 'true'); assert.equal(f.d.activeElement, button);
  f.select([worker]); assert.equal(group.hidden, true);
  assert.equal(f.d.activeElement.closest('[hidden]'), null, 'existing selection recovery handles a hidden stance control');
  f.select([military]); f.click(button);
  f.w.eval(fn('setConnection', 'setPlayer'));
  f.w.socket = null; f.w.setConnection('RECONNECTING');
  assert.equal(button.getAttribute('aria-disabled'), 'true');
  assert.equal(f.d.activeElement, button); button.click(); assert.equal(f.w.sentCommands.length, 2);
});

for (const team of [0, 1]) test(`seat ${team}: single Worker portrait opens dismissible notes and keeps live health and focus`, t => {
  const f = fixture(team); t.after(() => f.dom.window.close());
  const own = team * 2, role = team === 0 ? 'human' : 'boughward-worker';
  const portrait = f.bar.querySelector('[data-selection-portrait]'), image = portrait.querySelector('img');
  const health = f.bar.querySelector('[data-worker-health]'), notes = f.d.querySelector('#selected-worker-notes');
  assert.equal(portrait.hidden, true);
  f.select([own]);
  assert.equal(portrait.hidden, false);
  assert.equal(image.getAttribute('src'), WORKER_PORTRAITS[role].asset);
  assert.equal(image.alt, '');
  assert.match(portrait.getAttribute('aria-label'), new RegExp(WORKER_PORTRAITS[role].appearanceFamily));
  assert.equal(health.textContent, 'Worker · 100 / 100 HP');
  assert.equal(portrait.dataset.codexEntry, 'unit.worker');
  f.click(portrait);
  assert.equal(f.w.commandDock.hidden, false);
  assert.equal(f.w.commandDock.dataset.activePanel, 'selection');
  assert.equal(notes.hidden, false);
  assert.equal(notes.querySelector('[data-worker-abilities]').textContent, 'Move · Attack · Gather · Build · Repair');
  assert.equal(notes.querySelector('[data-worker-health]').textContent, '100 / 100 HP');
  assert.equal(notes.querySelector('[data-worker-movement]').textContent, 'Base move: 2.6 cells/s');
  assert.equal(notes.querySelector('[data-worker-attack]').textContent, 'Base attack: 4 melee vs ground · 0.85s interval · 1.28 cells range');
  assert.equal(notes.querySelector('[data-worker-training]').textContent, 'Town Center · 50 food · 25s · 1 population');
  assert.equal(notes.querySelector('details').open, false);
  f.escape();
  assert.equal(f.w.commandDock.hidden, true);
  assert.equal(f.d.activeElement, portrait);
  assert.deepEqual([...f.w.selected], [own]);
  f.w.units[own].hp = 37; f.w.updateSelectionUI();
  assert.equal(health.textContent, 'Worker · 37 / 100 HP');
  assert.equal(notes.querySelector('[data-worker-health]').textContent, '37 / 100 HP');
  assert.equal(portrait.querySelector('img'), image);
  assert.equal(f.d.activeElement, portrait);
});

for (const team of [0, 1]) test(`seat ${team}: Infantry reuses the compact identity and dismissible definition-derived notes`, t => {
  const f = fixture(team); t.after(() => f.dom.window.close());
  const own = team * 2 + 1, role = team === 0 ? 'infantry' : 'boughward-infantry';
  const button = f.bar.querySelector('[data-selection-portrait]'), image = button.querySelector('img');
  const health = f.bar.querySelector('[data-worker-health]'), notes = f.d.querySelector('#selected-worker-notes');
  f.select([team * 2]); f.select([own]);
  assert.equal(button.hidden, false); assert.equal(image.getAttribute('src'), INFANTRY_PORTRAITS[role].asset);
  assert.equal(button.dataset.codexEntry, 'unit.infantry');
  assert.equal(button.getAttribute('aria-label'), `Infantry · ${INFANTRY_PORTRAITS[role].appearanceFamily} — open role notes`);
  assert.equal(notes.getAttribute('aria-label'), 'Infantry role notes');
  assert.equal(health.textContent, 'Infantry · 100 / 100 HP');
  f.click(button); assert.equal(f.w.commandDock.dataset.activePanel, 'selection');
  assert.equal(notes.querySelector('[data-worker-abilities]').textContent, 'Move · Attack · Attack structures');
  assert.equal(notes.querySelector('[data-worker-training]').textContent, 'Barracks · 50 food · 12s · 1 population');
  assert.equal(notes.querySelector('[data-worker-attack]').textContent, 'Base attack: 10 melee vs ground · 0.85s interval · 1.28 cells range · 1.5 damage vs structures');
  f.escape(); assert.equal(f.d.activeElement, button); assert.deepEqual([...f.w.selected], [own]);
  f.w.units[own].hp = 37; f.w.updateSelectionUI();
  assert.equal(health.textContent, 'Infantry · 37 / 100 HP'); assert.equal(button.querySelector('img'), image);
  image.dispatchEvent(new f.w.Event('error')); assert.equal(image.parentElement.hidden, true);
  f.w.updateSelectionUI(); assert.equal(image.parentElement.hidden, true, 'snapshots do not expose a known failed image');
  assert.equal(button.hidden, false); f.click(button); assert.equal(notes.hidden, false);
  notes.querySelector('details').open = true; notes.querySelector('a').focus();
  f.select([own, team * 2]); assert.equal(notes.hidden, true); assert.equal(notes.querySelector('details').open, false);
  assert.equal(f.d.activeElement, f.d.querySelector('#dock-tab-selection'));
  f.select([team * 2]); assert.equal(image.parentElement.hidden, false, 'supported source change restores artwork');
  assert.equal(notes.getAttribute('aria-label'), 'Worker role notes');
  f.select([own]); f.w.units[own].hp = 0; f.w.updateSelectionUI(); assert.equal(button.hidden, true);
  f.w.units[own].hp = 100; f.select([own]); f.w.localTeam = null; f.w.updateSelectionUI(); assert.equal(button.hidden, true);
});

for (const team of [0, 1]) test(`seat ${team}: Archer replaces Infantry facts while retaining compact notes, live nodes and focus`, t => {
  const f = fixture(team); t.after(() => f.dom.window.close());
  const own = team * 2 + 1, role = team === 0 ? 'archer' : 'boughward-archer';
  const button = f.bar.querySelector('[data-selection-portrait]'), image = button.querySelector('img');
  const health = f.bar.querySelector('[data-worker-health]'), notes = f.d.querySelector('#selected-worker-notes');
  f.select([own]); f.w.units[own].kind = 'archer'; f.w.units[own].hp = 70; f.select([own]);
  assert.equal(button.hidden, false); assert.equal(image.getAttribute('src'), ARCHER_PORTRAITS[role].asset);
  assert.equal(image.alt, ''); assert.equal(button.dataset.codexEntry, 'unit.archer');
  assert.equal(button.getAttribute('aria-label'), `Archer · ${ARCHER_PORTRAITS[role].appearanceFamily} — open role notes`);
  assert.equal(notes.getAttribute('aria-label'), 'Archer role notes');
  assert.equal(health.textContent, 'Archer · 70 / 70 HP');
  f.click(button); assert.equal(f.w.commandDock.dataset.activePanel, 'selection');
  assert.equal(notes.querySelector('[data-worker-abilities]').textContent, 'Move · Attack · Attack structures');
  assert.equal(notes.querySelector('[data-worker-training]').textContent, 'Archery Range · 25 food + 45 wood · 7s · 1 population');
  assert.equal(notes.querySelector('[data-worker-attack]').textContent, 'Base attack: 7 pierce vs ground · 1s interval · 4.5 cells range · 0.8 damage vs structures');
  const details = notes.querySelector('details'), link = notes.querySelector('a');
  details.open = true; link.focus(); f.w.units[own].hp = 29; f.w.updateSelectionUI();
  assert.equal(health.textContent, 'Archer · 29 / 70 HP'); assert.equal(button.querySelector('img'), image);
  assert.equal(notes.querySelector('details'), details); assert.equal(details.open, true); assert.equal(f.d.activeElement, link);
  f.escape(); assert.equal(f.w.commandDock.hidden, true); assert.equal(f.d.activeElement, button);
  image.dispatchEvent(new f.w.Event('error')); f.w.updateSelectionUI();
  assert.equal(image.parentElement.hidden, true); assert.equal(button.hidden, false, 'role notes retain their written entry after art failure');
  f.click(button); link.focus(); f.select([own, team * 2]);
  assert.equal(notes.hidden, true); assert.equal(details.open, false); assert.equal(f.d.activeElement, f.d.querySelector('#dock-tab-selection'));
  f.select([team * 2]); assert.equal(image.parentElement.hidden, false); assert.equal(notes.getAttribute('aria-label'), 'Worker role notes');
  f.select([own]); f.w.units[own].hp = 0; f.w.updateSelectionUI(); assert.equal(button.hidden, true);
  f.w.units[own].hp = 70;
  const enemy = (1 - team) * 2 + 1; f.w.units[enemy].kind = 'archer'; f.w.units[enemy].hp = 70;
  f.select([enemy]); assert.equal(button.hidden, true);
  f.select([own]); f.w.localTeam = null; f.w.updateSelectionUI(); assert.equal(button.hidden, true);
});

for (const team of [0, 1]) test(`seat ${team}: Archer thumbnails preserve both resource costs, focus and the paid Range command`, t => {
  const f = economyFixture(team); t.after(() => f.dom.window.close());
  const role = team === 0 ? 'archer' : 'boughward-archer';
  const building = { id: 18, team, type: 'archery-range', complete: true, hp: 1800, maxHp: 1800, productionQueue: [] };
  f.select([], building);
  const button = f.bar.querySelector('[data-product="archer"]'), image = button.querySelector('img');
  const label = button.querySelector('[data-production-label]'), source = f.w.ui.trainArcher;
  assert.equal(image.getAttribute('src'), ARCHER_PORTRAITS[role].asset); assert.equal(image.alt, '');
  assert.equal(image.parentElement.getAttribute('aria-hidden'), 'true');
  assert.equal(source.querySelector('img').getAttribute('src'), image.getAttribute('src'));
  assert.match(label.textContent, /Train Archer.*25 food \/ 45 wood/); assert.match(source.getAttribute('aria-label'), /25 food and 45 wood/);
  button.focus(); f.w.latestWood[team] = 0; f.w.updateEconomyUI();
  assert.equal(button.getAttribute('aria-disabled'), 'true'); assert.match(label.textContent, /Need 0 food \/ 45 wood/);
  assert.equal(button.querySelector('img'), image); assert.equal(button.querySelector('[data-production-label]'), label); assert.equal(f.d.activeElement, button);
  f.click(button); assert.equal(f.w.sentCommands.length, 0);
  image.dispatchEvent(new f.w.Event('error')); f.w.latestWood[team] = 500; f.w.updateEconomyUI();
  assert.equal(image.parentElement.hidden, true); assert.equal(button.getAttribute('aria-disabled'), 'false');
  f.click(button); assert.deepEqual(JSON.parse(JSON.stringify(f.w.sentCommands)), [{ type: 'trainUnit', kind: 'archer', buildingId: building.id }]);
  f.w.humanRosterPreview = false; f.w.castPreview = false; f.w.updateContextualCommands();
  assert.equal(image.parentElement.hidden, true); assert.equal(source.querySelector('.unit-action-art').hidden, true); assert.match(label.textContent, /Train Archer/);
});

test('Archer artwork requires its effective role and preserves unsupported appearance fallbacks', t => {
  const f = fixture(); t.after(() => f.dom.window.close());
  f.w.units[1].kind = 'archer'; f.w.units[1].hp = 70;
  const button = f.bar.querySelector('[data-selection-portrait]');
  for (const role of ['infantry', 'human', 'elf', null]) {
    f.w.unitSpriteRuntime.roleForUnit = () => role; f.select([1]); assert.equal(button.hidden, true);
  }
  f.w.unitSpriteRuntime.roleForUnit = () => 'archer'; f.select([1]); assert.equal(button.hidden, false);
  f.w.units[1].kind = 'spearman'; f.select([1]); assert.equal(button.hidden, true, 'another unit cannot borrow Archer identity');
  f.w.units[1].kind = 'archer'; f.w.castPreview = false; f.w.humanRosterPreview = false;
  f.select([1]); assert.equal(button.hidden, true);
});

for (const team of [0, 1]) test(`seat ${team}: product portraits retain text, focus, availability and native training commands`, t => {
  const f = fixture(team); t.after(() => f.dom.window.close());
  const role = team === 0 ? 'infantry' : 'boughward-infantry';
  const building = { id: 8, team, type: 'barracks', complete: true, hp: 1800, maxHp: 1800, productionQueue: [] };
  f.select([], building);
  const button = f.bar.querySelector('[data-product="infantry"]'), image = button.querySelector('img');
  const label = button.querySelector('[data-production-label]'), source = f.w.ui.trainInfantry;
  assert.equal(image.getAttribute('src'), INFANTRY_PORTRAITS[role].asset); assert.equal(image.alt, '');
  assert.equal(image.parentElement.getAttribute('aria-hidden'), 'true');
  assert.equal(source.querySelector('img').getAttribute('src'), image.getAttribute('src'));
  assert.match(source.textContent, /Queue infantry.*50 FOOD/); assert.match(label.textContent, /Train Infantry.*50 food/);
  button.focus(); f.w.latestFood[team] = 0; f.w.updateContextualCommands();
  assert.equal(button.getAttribute('aria-disabled'), 'true'); assert.match(label.textContent, /Need 50 food/);
  assert.equal(f.d.activeElement, button); assert.equal(button.querySelector('img'), image);
  assert.equal(button.querySelector('[data-production-label]'), label);
  f.click(button); assert.equal(f.w.sentCommands.length, 0);
  image.dispatchEvent(new f.w.Event('error')); f.w.latestFood[team] = 500; f.w.updateContextualCommands();
  assert.equal(image.parentElement.hidden, true); assert.match(label.textContent, /Train Infantry/);
  f.click(button); assert.deepEqual(JSON.parse(JSON.stringify(f.w.sentCommands)), [{ type: 'trainUnit', kind: 'infantry', buildingId: building.id }]);
  const workerRole = team === 0 ? 'human' : 'boughward-worker';
  assert.equal(f.w.ui.trainWorker.querySelector('img').getAttribute('src'), WORKER_PORTRAITS[workerRole].asset);
  f.w.castPreview = false; f.w.updateContextualCommands();
  assert.equal(button.querySelector('.unit-action-art').hidden, true); assert.match(button.textContent, /Train Infantry/);
  assert.equal(source.querySelector('.unit-action-art').hidden, true);
});

test('unsupported Infantry appearance and mismatched Worker role retain text-only selection', t => {
  const f = fixture(); t.after(() => f.dom.window.close());
  const button = f.bar.querySelector('[data-selection-portrait]');
  for (const role of ['orc', 'human', null]) {
    f.w.unitSpriteRuntime.roleForUnit = () => role; f.select([1]); assert.equal(button.hidden, true);
  }
  f.w.unitSpriteRuntime.roleForUnit = () => 'infantry'; f.w.humanRosterPreview = false;
  f.w.castPreview = false; f.select([1]); assert.equal(button.hidden, true);
});

test('Worker entry follows changed registry capabilities, stats, cost and producer rather than duplicating gameplay facts', () => {
  const definition = {
    ...UNIT_DEFINITIONS.worker, capabilities: ['move', 'attack', 'repair'],
    cost: { food: 65, wood: 10 }, trainSeconds: 30, population: 2,
    combat: { ...UNIT_DEFINITIONS.worker.combat, maxHp: 120, moveSpeed: 3, damage: 6, targetTags: ['mounted'], period: 1, range: 1.5 },
  };
  const facts = workerRoleFacts({ hp: 42 }, definition, {
    workshop: { label: 'Workshop', products: ['worker'] },
    barracks: { label: 'Barracks', products: ['infantry'] },
  });
  assert.deepEqual(facts, {
    health: '42 / 120 HP', abilities: 'Move · Attack · Repair', movement: 'Base move: 3 cells/s',
    attack: 'Base attack: 6 melee vs mounted · 1s interval · 1.5 cells range',
    training: 'Workshop · 65 food + 10 wood · 30s · 2 population',
  });
});

test('optional Worker world note quotes the inspected lore source and labels its status and destination', t => {
  const f = fixture(); t.after(() => f.dom.window.close());
  f.select([0]); f.click(f.bar.querySelector('[data-selection-portrait]'));
  const details = f.d.querySelector('#selected-worker-notes details');
  const lore = readFileSync(new URL('../docs/lore/world.md', import.meta.url), 'utf8');
  assert.equal(details.open, false);
  assert.equal(details.querySelector('summary').textContent, 'World notes (working lore)');
  assert.equal(details.querySelector('q').textContent, 'The past survives in soil, craft, custom and argument.');
  assert.ok(lore.includes(details.querySelector('q').textContent));
  assert.match(lore, /connections below are working lore/);
  const link = details.querySelector('a');
  assert.equal(link.href, 'https://github.com/lbeezr/thousand-unit-skirmish/blob/3c2aabf8490e942a000927551bb37ab6e4e7094a/docs/lore/world.md#vaelora');
  assert.equal(link.target, '_blank'); assert.ok(link.relList.contains('noopener'));
  assert.match(link.textContent, /opens in a new tab/);
  f.click(details.querySelector('summary')); assert.equal(details.open, true);
  f.click(details.querySelector('summary')); assert.equal(details.open, false);
});

for (const team of [0, 1]) test(`seat ${team}: live Worker snapshots preserve lore nodes, disclosure and keyboard focus; Escape dismisses`, t => {
  const f = fixture(team); t.after(() => f.dom.window.close());
  const own = team * 2, portrait = f.bar.querySelector('[data-selection-portrait]');
  f.select([own]); f.click(portrait);
  const notes = f.d.querySelector('#selected-worker-notes'), details = notes.querySelector('details');
  const summary = details.querySelector('summary'), link = details.querySelector('a');
  f.click(summary);
  for (const focused of [summary, link]) {
    focused.focus(); f.w.units[own].hp = 64; f.w.updateSelectionUI();
    assert.equal(details.open, true); assert.equal(details.querySelector('summary'), summary);
    assert.equal(details.querySelector('a'), link); assert.equal(f.d.activeElement, focused);
    assert.equal(notes.querySelector('[data-worker-health]').textContent, '64 / 100 HP');
  }
  f.escape();
  assert.equal(f.w.commandDock.hidden, true); assert.equal(f.d.activeElement, portrait);
  assert.deepEqual([...f.w.selected], [own]);
});

for (const team of [0, 1]) test(`seat ${team}: Formation / route remains an operable stable focus target in the command strip`, t => {
  const f = fixture(team); t.after(() => f.dom.window.close());
  const own = team * 2, route = f.bar.querySelector('[data-context-details]');
  const image = route.querySelector('img'), label = route.querySelector('[data-context-details-label]');
  f.select([own]);
  assert.equal(route.hidden, false); assert.equal(route.textContent, 'Formation / route');
  assert.equal(image.hidden, false); assert.equal(image.getAttribute('src'), '/assets/ui/icons/actions/formation.svg');
  image.dispatchEvent(new f.w.Event('error'));
  assert.equal(route.textContent, 'Formation / route', 'image failure retains the written name');
  route.focus(); f.w.units[own].hp = 64; f.w.updateSelectionUI();
  assert.equal(f.d.activeElement, route);
  assert.equal(f.bar.querySelector('[data-context-details]'), route);
  assert.equal(route.querySelector('img'), image); assert.equal(route.querySelector('[data-context-details-label]'), label);
  for (const dismiss of [() => f.escape(), () => f.click(f.d.querySelector('#dock-close'))]) {
    f.click(route);
    assert.equal(f.w.commandDock.dataset.activePanel, 'command');
    dismiss();
    assert.equal(f.w.commandDock.hidden, true); assert.equal(f.d.activeElement, route);
    assert.deepEqual([...f.w.selected], [own]);
  }
});

for (const team of [0, 1]) test(`seat ${team}: action glyphs survive selection updates and Formation stays specific to units`, t => {
  const f = fixture(team); t.after(() => f.dom.window.close());
  const own = team * 2, boat = f.w.units.length;
  f.w.units.push({ id: boat, team, kind: 'skiff', hp: 120, cargo: 1, cargoType: 'food' });
  const details = f.bar.querySelector('[data-context-details]'), formation = details.querySelector('img');
  const controls = [...f.d.querySelectorAll('[data-persistent-order], [data-stationary-order], [data-return-cargo]')];
  const images = controls.map(button => button.querySelector('img'));
  const labels = controls.map(button => button.textContent);
  const titles = controls.map(button => button.title);
  for (const ids of [[own], [own + 1], [own, own + 1], [boat]]) {
    f.select(ids);
    assert.equal(formation.hidden, false); assert.equal(details.hidden, false);
    assert.equal(details.textContent, 'Formation / route');
    controls.forEach((button, i) => {
      assert.equal(button.querySelector('img'), images[i]);
      images[i].dispatchEvent(new f.w.Event('error'));
      assert.equal(button.textContent, labels[i]); assert.equal(button.title, titles[i]);
    });
  }
  for (const type of ['barracks', 'house']) {
    f.select([], { id: 8, team, type, complete: true, hp: 1800, productionQueue: [] });
    assert.equal(details.querySelector('img'), formation);
    assert.equal(formation.hidden, true, 'building rally/upgrade controls do not imply formation');
    assert.equal(details.textContent, 'Rally / upgrade details');
    assert.equal(details.hidden, type === 'house');
  }
  f.select([]); assert.equal(formation.hidden, true); assert.equal(details.hidden, true);
});

for (const [name, change] of [
  ['cleared selection', f => f.select([])],
  ['group', f => f.select([0, 1])],
  ['Barracks', f => f.select([], { id: 8, team: 0, type: 'barracks', complete: true, hp: 1800, productionQueue: [] })],
  ['dead Worker', f => { f.w.units[0].hp = 0; f.w.updateSelectionUI(); }],
  ['unsupported appearance', f => { f.w.unitSpriteRuntime.roleForUnit = () => 'worker'; f.w.updateContextualCommands(); }],
]) test(`focused Worker lore cannot leave hidden focus after ${name}`, t => {
  const f = fixture(); t.after(() => f.dom.window.close());
  f.select([0]); f.click(f.bar.querySelector('[data-selection-portrait]'));
  const notes = f.d.querySelector('#selected-worker-notes'), details = notes.querySelector('details');
  f.click(details.querySelector('summary')); details.querySelector('a').focus();
  change(f);
  assert.equal(notes.hidden, true); assert.equal(details.open, false);
  assert.equal(f.d.activeElement, f.d.querySelector('#dock-tab-selection'));
  assert.equal(f.d.activeElement.closest('[hidden]'), null);
  f.escape(); assert.equal(f.w.commandDock.hidden, true);
  assert.equal(f.d.activeElement.closest('[hidden]'), null);
});

test('Unit identity is hidden for groups, unsupported roles/buildings, enemy, dead or spectator selections', t => {
  const f = fixture(); t.after(() => f.dom.window.close());
  const portrait = f.bar.querySelector('[data-selection-portrait]'), notes = f.d.querySelector('#selected-worker-notes');
  f.w.units[4] = { id: 4, team: 0, kind: 'worker', hp: 100 };
  f.w.units[5] = { id: 5, team: 0, kind: 'spearman', hp: 100 };
  for (const ids of [[0, 4], [0, 1], [5], [2], [99], []]) {
    f.select([0]); f.select(ids);
    assert.equal(portrait.hidden, true, `selection ${ids}`);
    assert.equal(notes.hidden, true);
    if (ids.length === 2) assert.match(f.bar.querySelector('[data-context-summary]').textContent, /2 selected/);
  }
  f.select([0]);
  f.select([], { id: 8, team: 0, type: 'storehouse', complete: true, hp: 1200, productionQueue: [] });
  assert.equal(portrait.hidden, true); assert.equal(notes.hidden, true);
  f.select([0]); f.w.units[0].hp = 0; f.w.updateSelectionUI();
  assert.equal(portrait.hidden, true);
  f.w.units[0].hp = 100; f.select([0]); f.w.localTeam = null; f.w.updateSelectionUI();
  assert.equal(portrait.hidden, true);
});

test('portrait follows the effective appearance and hides for unrepresented legacy/model previews', t => {
  const f = fixture(); t.after(() => f.dom.window.close());
  const portrait = f.bar.querySelector('[data-selection-portrait]');
  f.w.unitSpriteRuntime.roleForUnit = () => 'boughward-worker'; f.select([0]);
  assert.equal(portrait.querySelector('img').getAttribute('src'), WORKER_PORTRAITS['boughward-worker'].asset);
  f.w.unitSpriteRuntime.roleForUnit = () => 'worker'; f.w.updateContextualCommands();
  assert.equal(portrait.hidden, true);
  f.w.unitSpriteRuntime.roleForUnit = () => 'human'; f.w.humanRosterPreview = false;
  f.w.updateContextualCommands(); assert.equal(portrait.hidden, true);
  f.w.roomPageUrl.searchParams.set('humanVaeloraPreview', '1');
  f.w.updateContextualCommands(); assert.equal(portrait.hidden, false);
  f.w.castPreview = false; f.w.updateContextualCommands(); assert.equal(portrait.hidden, true);
});

test('clearing a Worker while notes are open hides stale identity and restores visible focus on dismissal', t => {
  const f = fixture(); t.after(() => f.dom.window.close());
  const portrait = f.bar.querySelector('[data-selection-portrait]');
  f.select([0]); f.click(portrait); f.select([]);
  assert.equal(f.d.querySelector('#selected-worker-notes').hidden, true);
  f.escape();
  assert.equal(f.w.commandDock.hidden, true);
  assert.equal(f.d.activeElement, f.w.dockToggle);
});

for (const team of [0, 1]) test(`seat ${team}: Farm identity opens accurate compact details and preserves selection audio`, t => {
  const f = fixture(team); t.after(() => f.dom.window.close());
  const button = f.bar.querySelector('[data-selection-portrait]');
  const farm = { id: 10, team, type: 'farm', complete: true, hp: 600, maxHp: 600,
    harvestStock: 173.5, progress: 1, productionQueue: [] };
  const events = [];
  f.w.audio.playEvent = event => events.push(event);
  f.w.eval(fn('selectBuilding', 'pickFriendly'));
  f.w.latestBuildings = [farm]; f.w.selectBuilding(farm);
  assert.deepEqual(JSON.parse(JSON.stringify(events)), [{ cue: 'select', buildingType: 'farm' }]);
  assert.equal(button.hidden, false);
  assert.match(button.getAttribute('aria-label'), /Farm · Food plot.*open structure details/);
  assert.equal(button.querySelector('img').getAttribute('src'), '/assets/ui/icons/food.svg');
  assert.equal(button.dataset.codexEntry, 'building.farm');
  assert.equal(f.w.commandDock.hidden, true, 'selection keeps details dismissible');
  f.click(button);
  assert.equal(f.w.commandDock.dataset.activePanel, 'selection');
  const art = f.d.querySelector('[data-building-art]');
  assert.equal(art.hidden, false);
  assert.match(art.textContent, /Food symbol.*illustration unavailable.*temporary House model/);
  const study = art.querySelector('a');
  assert.match(study.href, /4b626295510f761b0307aefe4c78c67c79eeabf5.*farm-reference-v1\.png$/);
  assert.equal(study.target, '_blank'); assert.match(study.rel, /noopener/);
  assert.match(f.d.querySelector('[data-building-description]').textContent, /planted food plot.*200 food.*deliver.*Mill, Storehouse or Town Center/);
  assert.match(f.d.querySelector('[data-building-instruction]').textContent, /Select Workers.*right-click.*harvest/);
  assert.match(f.w.ui.selectedBuildingProduction.textContent, /173 \/ 200 food remaining/);
  assert.equal(f.w.ui.selectedBuildingState.textContent, 'READY');
  f.escape(); assert.equal(f.d.activeElement, button);
  farm.harvestStock = 0; f.select([], farm);
  assert.equal(f.w.ui.selectedBuildingState.textContent, 'EXHAUSTED');
  assert.match(f.w.ui.selectedBuildingProduction.textContent, /0 \/ 200.*Exhausted/);
  assert.match(f.d.querySelector('[data-building-instruction]').textContent, /Clear exhausted Farm.*new Farm.*No regrowth/);
  farm.complete = false; farm.progress = .4; f.select([], farm);
  assert.equal(f.w.ui.selectedBuildingState.textContent, 'BUILDING · 40%');
  assert.match(f.d.querySelector('[data-building-instruction]').textContent, /finish construction/);
  assert.doesNotMatch(f.w.ui.selectedBuildingProduction.textContent, /remaining|Exhausted/);
  f.w.matchMedia = () => ({ matches: true }); farm.complete = true; farm.harvestStock = 100; f.select([], farm);
  assert.match(f.d.querySelector('[data-building-instruction]').textContent, /choose Gather \/ move.*tap this Farm.*harvest/);
  f.click(button); study.focus(); f.w.updateSelectionUI();
  assert.equal(f.d.activeElement, study, 'live stock updates preserve the source-study link and focus');
  farm.team = 1 - team; f.select([], farm);
  assert.equal(button.hidden, true); assert.equal(art.hidden, true);
  assert.equal(f.w.ui.selectedBuildingCard.hidden, true, 'enemy stock and assignment instructions stay hidden');
  assert.equal(f.d.activeElement, f.d.querySelector('#dock-tab-selection'), 'hidden Farm link restores visible panel focus');
  farm.team = team; farm.hp = 0; f.select([], farm); assert.equal(button.hidden, true);
  f.select([team * 2]); assert.equal(art.hidden, true);
  assert.equal(f.d.querySelector('[data-building-description]').hidden, true);
});

for (const team of [0, 1]) test(`seat ${team}: Barracks portrait matches lifecycle/team art and opens existing structure details`, t => {
  const f = fixture(team); t.after(() => f.dom.window.close());
  const button = f.bar.querySelector('[data-selection-portrait]'), image = button.querySelector('img');
  const building = { id: 8, team, type: 'barracks', complete: false, hp: 1800, maxHp: 1800, progress: 0, productionQueue: [] };
  const family = team === 0 ? 'azure' : 'ember';
  for (const [changes, state] of [
    [{ progress: 0.1999, complete: false }, 'foundation'],
    [{ progress: 0.2 }, 'frame'],
    [{ progress: 0.8999 }, 'frame'],
    [{ progress: 0.9 }, 'complete'],
    [{ complete: true, hp: 1188 }, 'complete'],
    [{ hp: 1187 }, 'damaged'],
    [{ hp: 594 }, 'damaged'],
    [{ hp: 593 }, 'critical'],
  ]) {
    Object.assign(building, changes); f.select([], building);
    assert.equal(button.hidden, false);
    assert.equal(image.getAttribute('src'), `/assets/buildings/barracks-sprite-test-v1/runtime/barracks-${state}-${family}.webp`);
    assert.equal(button.querySelector('img'), image);
    assert.equal(button.getAttribute('aria-label'), 'Barracks — open structure details');
    assert.equal(button.dataset.codexEntry, 'building.barracks');
    assert.equal(f.bar.querySelector('[data-worker-health]').hidden, true);
    assert.equal(f.d.querySelector('#selected-worker-notes').hidden, true);
  }
  f.click(button);
  assert.equal(f.w.commandDock.dataset.activePanel, 'selection');
  assert.equal(f.d.querySelector('#building-selection-card').hidden, false);
  assert.match(f.d.querySelector('#selected-building-health').textContent, /593 \/ 1,800 HP/);
  f.escape(); assert.equal(f.d.activeElement, button); assert.equal(f.w.selectedBuildingId, building.id);
  building.hp = 1000; f.select([], building);
  assert.equal(f.d.activeElement, button); assert.match(image.src, /damaged/);
  building.hp = 0; f.select([], building); assert.equal(button.hidden, true);
  assert.equal(f.d.activeElement.closest('[hidden]'), null);
});

test('Worker → Barracks → unsupported building → group keeps only current identity and recovers visible focus', t => {
  const f = fixture(); t.after(() => f.dom.window.close());
  const button = f.bar.querySelector('[data-selection-portrait]');
  f.select([0]); f.click(button);
  f.select([], { id: 8, team: 0, type: 'barracks', complete: true, hp: 1800, productionQueue: [] });
  assert.equal(f.d.querySelector('#selected-worker-notes').hidden, true);
  f.escape(); assert.equal(f.d.activeElement, button);
  f.select([], { id: 9, team: 0, type: 'town-center', complete: true, hp: 2400, productionQueue: [] });
  assert.equal(button.hidden, true); assert.equal(f.d.activeElement.closest('[hidden]'), null);
  f.select([0, 1]); assert.equal(button.hidden, true);
  assert.match(f.bar.querySelector('[data-context-summary]').textContent, /2 selected/);
  f.select([], { id: 8, team: 1, type: 'barracks', complete: true, hp: 1800, productionQueue: [] });
  assert.equal(button.hidden, true);
  f.w.localTeam = null;
  f.select([], { id: 8, team: 0, type: 'barracks', complete: true, hp: 1800, productionQueue: [] });
  assert.equal(button.hidden, true);
});

test('decorative command icons preserve text, hotkeys, target states and the existing proxy action', t => {
  const f = fixture(); t.after(() => f.dom.window.close());
  f.select([0]);
  const target = f.bar.querySelector('[data-context-proxy="order-target-toggle"]');
  const image = target.querySelector('img');
  assert.equal(target.textContent, 'Gather / move');
  let activations = 0;
  f.d.querySelector('#order-target-toggle').addEventListener('click', () => { activations++; f.w.tapOrderArmed = !f.w.tapOrderArmed; });
  f.click(target);
  assert.equal(activations, 1); assert.equal(target.textContent, 'Cancel target');
  assert.equal(target.querySelector('img'), image);
  f.click(target); assert.equal(activations, 2); assert.equal(target.textContent, 'Gather / move');
  f.select([], { id: 8, team: 0, type: 'barracks', complete: true, hp: 1800, productionQueue: [] });
  assert.equal(target.textContent, 'Set rally'); assert.equal(target.querySelector('img'), image);
  f.select([1]); assert.equal(target.textContent, 'Target battlefield');
  for (const [selector, asset, label] of [
    ['[data-context-proxy="order-target-toggle"]', 'move', 'Target battlefield'],
    ['[data-context-proxy="attack-move-toggle"]', 'attack', 'Attack move · M'],
    ['[data-context-build]', 'build', 'Build'],
  ]) {
    const button = f.bar.querySelector(selector), icon = button.querySelector('img');
    assert.equal(icon.alt, ''); assert.equal(icon.getAttribute('src'), `/assets/ui/icons/${asset}.svg`);
    assert.equal(button.textContent, label); assert.ok(button.title);
  }
});

for (const team of [0, 1]) test(`seat ${team}: Return cargo appears for carrying workers and sends their order`, t => {
  const f = fixture(team); t.after(() => f.dom.window.close());
  const own = team * 2, enemy = (1 - team) * 2;
  const button = f.bar.querySelector('[data-return-cargo]'), orders = [];
  const image = button.querySelector('img');
  assert.equal(image.getAttribute('src'), '/assets/ui/icons/actions/return-cargo.svg');
  f.w.sendTrackedOrder = command => { orders.push(command); return 100; };
  f.w.setAttackMoveMode = () => {};
  f.w.eval(between('function issueReturnCargo(', "for (const button of document.querySelectorAll('[data-stationary-order]'))"));
  f.select([own]); assert.equal(button.hidden, true);
  Object.assign(f.w.units[own], { cargo: 0.5, cargoType: 'food' });
  f.select([own, own + 1]); assert.equal(button.hidden, false); assert.equal(button.disabled, false);
  assert.equal(button.querySelector('img'), image); assert.equal(button.textContent, 'Return cargo');
  f.click(button); assert.deepEqual([...orders[0].ids], [own]); assert.equal(orders[0].type, 'returnCargo');
  f.select([enemy]); assert.equal(button.hidden, true);
  f.select([], { id: 8, team, type: 'barracks', complete: true, hp: 1800, productionQueue: [] });
  assert.equal(button.hidden, true);
  f.w.matchWinner = team; f.select([own]); assert.equal(button.disabled, true);
  assert.equal(button.querySelector('img'), image);
  f.w.matchWinner = -1; f.w.units[own].cargo = 0; f.select([own]); assert.equal(button.hidden, true);
});

for (const team of [0, 1]) test(`seat ${team}: a carrying Skiff exposes Return cargo and keeps Worker build controls hidden`, t => {
  const f = fixture(team); t.after(() => f.dom.window.close());
  const id = f.w.units.length, orders = [];
  f.w.units.push({ id, team, kind: 'skiff', hp: 120, cargo: .005, cargoType: 'food' });
  f.w.sendTrackedOrder = command => { orders.push(command); return 100; };
  f.w.setAttackMoveMode = () => {};
  f.w.eval(between('function issueReturnCargo(', "for (const button of document.querySelectorAll('[data-stationary-order]'))"));
  f.select([id]); assert.equal(f.bar.dataset.context, 'boats');
  const button = f.bar.querySelector('[data-return-cargo]');
  assert.equal(button.hidden, false); assert.equal(button.disabled, false);
  assert.equal(f.bar.querySelector('[data-context-build]').hidden, true);
  f.click(button); assert.equal(orders[0].type, 'returnCargo'); assert.deepEqual([...orders[0].ids], [id]);
  f.w.units[id].cargo = 0; f.select([id]); assert.equal(button.hidden, true);
});

for (const team of [0, 1]) test(`seat ${team}: Objectives dismisses with focus and selection retained while closed urgency advances`, t => {
  const f = fixture(team), w = f.w; t.after(() => f.dom.window.close());
  const worker = team * 2;
  const toggle = f.d.querySelector('#scenario-brief-toggle');
  const close = f.d.querySelector('#scenario-brief-close');
  const panel = f.d.querySelector('#scenario-brief-panel');
  const urgent = f.d.querySelector('#objective-urgent');
  const definition = JSON.parse(readFileSync(new URL('../maps/bellweather-millrace.json', import.meta.url)));
  Object.assign(w, { scenarioBriefToggle: toggle, objectiveSummary, mapDefinition: definition,
    latestObjectiveStates: new w.Map(), latestMatchElapsedSeconds: 880,
    latestScenarioClockStarted: true, objectiveHoldSummary: null,
    scenarioEventVisuals: new w.Map(), latestScenarioEventStates: new w.Map(), timedVictoryVisual: null,
    lastScenarioEventUiUpdateAt: 0, scenarioClockSynchronizedAt: 1000 });
  // Replace the general fixture's briefing stub with the shipped implementation
  // and bind its actual open/close listeners. Renderer/network remain stubbed.
  w.eval(fn('closeScenarioBrief', 'toggleHudPanel'));
  w.eval(fn('renderScenarioEventCountdown', 'renderObjectiveSummary'));
  w.eval(fn('renderObjectiveSummary', 'syncMatchResultActions'));
  w.eval(between("scenarioBriefToggle.addEventListener('click'", "document.querySelector('#match-menu-close').addEventListener"));
  f.select([worker]); w.renderScenarioEventCountdown(1000);
  assert.equal(toggle.getAttribute('aria-controls'), panel.id);
  assert.match(f.d.querySelector('#map-summary').textContent, /Objective Control · Capture/);
  assert.equal(urgent.textContent, 'Deadline 20s · Crossing Watch');
  assert.equal(urgent.hidden, false);
  for (const dismiss of [() => f.escape(), () => f.click(close)]) {
    f.click(toggle);
    assert.equal(panel.hidden, false); assert.equal(toggle.getAttribute('aria-expanded'), 'true');
    assert.equal(f.d.activeElement, close);
    dismiss();
    assert.equal(panel.hidden, true); assert.equal(toggle.getAttribute('aria-expanded'), 'false');
    assert.equal(f.d.activeElement, toggle);
    assert.deepEqual([...w.selected], [worker]);
    assert.equal(w.selectedBuildingId, null); assert.equal(urgent.hidden, false);
  }
  for (const trigger of definition.triggers) w.latestObjectiveStates.set(trigger.id, { id: trigger.id, owner: team });
  w.objectiveHoldSummary = { activeTeams: [team === 0, team === 1], progressSeconds: [0, 0] };
  w.objectiveHoldSummary.progressSeconds[team] = 6;
  w.renderScenarioEventCountdown(2000);
  assert.equal(panel.hidden, true);
  assert.equal(f.d.querySelector('#map-summary').textContent, 'Objective Control · Defend your victory zones');
  assert.equal(urgent.textContent, `${team === 0 ? 'Azure' : 'Ember'} wins in 14s · Deadline 19s · Crossing Watch`);
  assert.equal(urgent.hidden, false);
  assert.deepEqual([...w.selected], [worker]); assert.equal(w.sentCommands.length, 0);
});

for (const team of [0, 1]) test(`seat ${team}: empty → Worker → army → building → empty preserves selections and essential access`, t => {
  const f = fixture(team); t.after(() => f.dom.window.close());
  const worker = team * 2, army = worker + 1;
  const building = { id: 8, team, type: 'barracks', complete: true, hp: 1800, maxHp: 1800, productionQueue: [] };
  const protectedElements = ['.minimap-panel', '#food-stock', '#wood-stock', '#population-readout', '#objective-urgent', '#field-order-feedback', '#runtime-error', '#match-result'];
  for (const selector of ['#objective-urgent', '#field-order-feedback', '#match-result']) f.d.querySelector(selector).hidden = false;
  f.d.querySelector('#runtime-error').textContent = 'Critical error sample';
  const protectedMarkup = protectedElements.map(s => f.d.querySelector(s).outerHTML);
  for (const [ids, selectedBuilding, kind] of [[[], null, 'none'], [[worker], null, 'workers'], [[army], null, 'military'], [[], building, 'building'], [[], null, 'none']]) {
    f.select(ids, selectedBuilding);
    assert.equal(f.bar.dataset.context, kind);
    assert.equal(f.bar.hidden, kind === 'none'); assert.equal(f.quick.hidden, kind !== 'none');
    assert.equal(f.w.getComputedStyle(kind === 'none' ? f.bar : f.quick).display, 'none');
    assert.deepEqual([...f.w.selected], ids); assert.equal(f.w.selectedBuildingId, selectedBuilding?.id ?? null);
    assert.deepEqual(protectedElements.map(s => f.d.querySelector(s).outerHTML), protectedMarkup);
    const opener = kind === 'none' ? f.w.dockToggle : f.bar.querySelector('[data-context-panel="economy"]');
    f.click(opener); assert.equal(f.w.commandDock.hidden, false);
    f.escape(); assert.equal(f.w.commandDock.hidden, true); assert.equal(f.d.activeElement, opener);
    assert.deepEqual([...f.w.selected], ids); assert.equal(f.w.selectedBuildingId, selectedBuilding?.id ?? null);
    f.click(opener); f.click(f.d.querySelector('#dock-close'));
    assert.equal(f.d.activeElement, opener); assert.deepEqual([...f.w.selected], ids);
    assert.equal(f.w.selectedBuildingId, selectedBuilding?.id ?? null);
    if (kind === 'building') {
      f.escape(); assert.equal(f.w.selectedBuildingId, null);
      assert.equal(f.bar.hidden, true); assert.equal(f.quick.hidden, false);
    }
  }
});

for (const team of [0, 1]) test(`seat ${team}: Quick commands and control-group keys survive row switches`, t => {
  const f = fixture(team); t.after(() => f.dom.window.close());
  f.d.querySelector('#quick-idle').disabled = false;
  f.w.ui.selectIdleWorkers.disabled = false;
  f.click(f.d.querySelector('#quick-idle'));
  assert.deepEqual([...f.w.selected], [team * 2]); assert.equal(f.bar.hidden, false);
  assert.ok(!f.d.activeElement.closest('[hidden]'), 'focus follows the visible command row');
  f.escape(); assert.equal(f.bar.hidden, true); assert.deepEqual([...f.w.selected], []);
  f.click(f.d.querySelector('#quick-army')); assert.deepEqual([...f.w.selected], [team * 2 + 1]);
  f.d.activeElement.dispatchEvent(new f.w.KeyboardEvent('keydown', { key: '1', code: 'Digit1', ctrlKey: true, bubbles: true }));
  assert.deepEqual([...f.w.controlGroups[0]], [team * 2 + 1]);
  f.escape(); assert.equal(f.quick.hidden, false);
  f.d.activeElement.dispatchEvent(new f.w.KeyboardEvent('keydown', { key: '1', code: 'Digit1', bubbles: true }));
  assert.deepEqual([...f.w.selected], [team * 2 + 1]); assert.equal(f.bar.hidden, false);
});

for (const team of [0, 1]) test(`seat ${team}: minimap browser proof selects four owned Workers from the visible empty-selection control`, t => {
  const f = fixture(team); t.after(() => f.dom.window.close());
  f.d.documentElement.dataset.entry = 'game';
  for (const id of [4, 5, 6, 7, 8, 9]) {
    f.w.units.push({ id, team: id % 2, kind: 'worker', hp: 100, task: 'idle' });
  }
  f.w.units.push({ id: 10, team, kind: 'worker', hp: 0, task: 'idle' },
    { id: 11, team, kind: 'worker', hp: 100, task: 'gather' });
  f.w.teamUnits = [0, 1].map(seat => f.w.units.filter(unit => unit.team === seat));
  f.d.querySelector('#quick-idle').disabled = f.w.ui.selectIdleWorkers.disabled = false;
  f.select([]);
  assert.equal(f.bar.hidden, true); assert.equal(f.quick.hidden, false);
  assert.equal(f.w.commandDock.hidden, true);

  // Exercise the runner's actual selector, so returning to the hidden proxy fails here.
  const start = minimapProof.indexOf('stage = `seat ${team}: select Workers`;');
  assert.ok(start >= 0, 'initial Worker-selection step exists');
  const step = minimapProof.slice(start, minimapProof.indexOf('const ids =', start));
  const selector = step.match(/await click\(page, '([^']+)'\);/)?.[1];
  assert.ok(selector, 'runner selects through a native control click');
  const control = f.d.querySelector(selector);
  assert.ok(control && !control.disabled && !control.closest('[hidden]'), 'initial control is visible and enabled');
  f.click(control);
  assert.deepEqual([...f.w.selected], [team * 2, 4 + team, 6 + team, 8 + team]);
  assert.equal(f.d.querySelector('#selected-total').textContent, '4');
  assert.equal(f.bar.hidden, false); assert.equal(f.quick.hidden, true);
  assert.equal(f.w.commandDock.hidden, true);
  assert.deepEqual(f.w.sentCommands, [], 'selection issues no unit order');
});

test('closing a drawer whose opener became hidden, disabled or disconnected restores visible focus', t => {
  const f = fixture(); t.after(() => f.dom.window.close());
  for (const unavailable of ['hidden', 'disabled', 'disconnected']) {
    f.select([0]); const opener = f.bar.querySelector('[data-context-build]'); f.click(opener);
    if (unavailable === 'hidden') f.select([]);
    if (unavailable === 'disabled') opener.disabled = true;
    if (unavailable === 'disconnected') opener.remove();
    f.escape(); assert.equal(f.w.commandDock.hidden, true);
    assert.ok(f.d.activeElement.matches('button') && !f.d.activeElement.disabled && !f.d.activeElement.closest('[hidden]'));
    assert.deepEqual([...f.w.selected], unavailable === 'hidden' ? [] : [0]);
    if (unavailable === 'disabled') opener.disabled = false;
  }
});

test('both command rows are observed; empty state reserves the Quick row, not a vanished bar', t => {
  const f = fixture(); t.after(() => f.dom.window.close());
  const rowObserver = f.observers.find(observer => observer.targets.includes(f.bar) && observer.targets.includes(f.quick));
  assert.deepEqual(rowObserver.targets, [f.bar, f.quick]);
  for (const [ids, expected] of [[[], '52px'], [[0], '86px'], [[1], '86px'], [[], '52px']]) {
    f.select(ids); rowObserver.callback();
    assert.equal(f.d.querySelector('.workspace').style.getPropertyValue('--context-bar-height'), expected);
  }
});

test('selection updates recover focus when a stationary control is disabled or a lifecycle action disappears', t => {
  const f = fixture(); t.after(() => f.dom.window.close());
  f.select([0]);
  f.bar.querySelector('[data-stationary-order="stop"]').focus();
  f.select([]);
  assert.equal(f.d.activeElement, f.w.dockToggle);
  f.select([0]);
  const action = f.d.createElement('button'); action.textContent = 'Repair';
  f.d.querySelector('#building-lifecycle-actions').append(action); action.focus();
  f.w.updateBuildingLifecycleActions = () => action.remove();
  f.w.updateContextualCommands();
  assert.ok(f.d.activeElement.matches('button') && !f.d.activeElement.closest('[hidden]'));
  assert.deepEqual([...f.w.selected], [0]);
});

for (const team of [0, 1]) test(`seat ${team}: combined lifecycle and contextual refresh retains gate action focus`, t => {
  const f = fixture(team); t.after(() => f.dom.window.close());
  f.w.eval(fn('updateBuildingLifecycleActions', 'updateRosterBuildingOptions'));
  const gate = { id: 1, team, type: 'palisade-gate', complete: true, hp: 300, maxHp: 300, gateOpen: false };
  f.select([], gate);
  const action = () => f.d.querySelector('[data-action="setGateOpen"]');
  action().focus(); action().click();
  f.w.latestBuildings = [{ ...gate, hp: 299, gateOpen: true }]; f.w.updateContextualCommands();
  assert.equal(f.d.activeElement, action(), 'contextual fallback must not override restored lifecycle focus');
  assert.match(action().textContent, /Close gate/); action().click();
  assert.deepEqual(JSON.parse(JSON.stringify(f.w.sentCommands)), [
    { type: 'setGateOpen', buildingId: 1, open: true }, { type: 'setGateOpen', buildingId: 1, open: false },
  ]);
  f.w.latestBuildings = [gate]; f.w.updateSelectionUI();
  assert.equal(f.d.activeElement, action(), 'selection refresh must preserve focus after Repair disappears');
  const outside = f.d.querySelector('#match-menu-toggle'); outside.focus();
  f.w.latestBuildings = [{ ...gate, hp: 299 }]; f.w.updateContextualCommands();
  assert.equal(f.d.activeElement, outside, 'refresh must not steal unrelated focus');
  action().focus(); f.select([], { ...gate, id: 2 });
  assert.notEqual(f.d.activeElement, action(), 'changing gates must not transfer action focus');
  action().focus(); f.w.matchWinner = team; f.w.updateContextualCommands();
  assert.equal(action().disabled, true); assert.notEqual(f.d.activeElement, action());
  assert.ok(!f.d.activeElement.disabled && !f.d.activeElement.closest('[hidden]'), 'disabled actions retain the visible fallback');
  f.w.matchWinner = -1; f.w.updateContextualCommands(); action().focus(); f.select([]);
  assert.equal(f.d.activeElement, f.w.dockToggle, 'removing selection retains global command access');
});

test('battlefield Escape cancels target modes before clearing selection; editing keeps selection', t => {
  const f = fixture(); t.after(() => f.dom.window.close());
  f.select([0]);
  for (const [mode, value] of [['persistentTargetMode', 'patrol'], ['tapOrderArmed', true], ['buildPlacementActive', true]]) {
    f.w[mode] = value; f.escape();
    assert.ok(!f.w[mode]); assert.deepEqual([...f.w.selected], [0]); assert.equal(f.bar.hidden, false);
  }
  f.click(f.bar.querySelector('[data-context-panel="economy"]'));
  const editing = f.d.querySelector('#assign-group-slot');
  f.w.selectDockTab('selection'); editing.focus();
  f.escape(); assert.deepEqual([...f.w.selected], [0]); assert.equal(f.w.commandDock.hidden, true);
  // A closed-drawer editing target is artificial, but independently covers the input guard.
  editing.focus(); f.escape(); assert.deepEqual([...f.w.selected], [0]);
  f.bar.querySelector('[data-context-panel="economy"]').focus(); f.escape();
  assert.deepEqual([...f.w.selected], []); assert.equal(f.quick.hidden, false);
});

test('enemy, dead, stale and spectator selections retain global access without selection commands', t => {
  const f = fixture(); t.after(() => f.dom.window.close());
  f.w.units[0].hp = 0;
  for (const [team, ids, building] of [[0, [0, 2, 900], null], [0, [], { id: 8, team: 1, type: 'barracks' }], [null, [1, 2], null]]) {
    f.w.localTeam = team; f.select(ids, building);
    assert.equal(f.bar.hidden, true); assert.equal(f.quick.hidden, false);
    assert.equal(f.d.querySelector('#assign-selected-group').disabled, true);
    f.click(f.w.dockToggle); assert.equal(f.w.commandDock.hidden, false);
    f.escape(); assert.deepEqual([...f.w.selected], ids);
  }
});

for (const team of [0, 1]) test(`seat ${team}: unavailable contextual training retains focus and exposes its reason without sending`, t => {
  const f = fixture(team); t.after(() => f.dom.window.close());
  const building = { id: 8, team, type: 'barracks', complete: true, hp: 1800, maxHp: 1800, productionQueue: [] };
  f.select([], building);
  const train = f.bar.querySelector('[data-product="spearman"]'); train.focus();
  assert.equal(f.d.activeElement, train);
  const blockedStates = [
    [() => { f.w.latestFood[team] = 59.99; }, /Need 1 food/],
    [() => { f.w.latestFood[team] = 500; building.productionQueue = Array(5).fill('infantry'); }, /Queue full/],
    [() => { building.productionQueue = []; building.productionBlocked = true; }, /Clear spawn area/],
    [() => { building.productionBlocked = false; f.w.latestPopulation[team] = { available: 0 }; }, /Population full/],
    [() => { f.w.latestPopulation[team].available = 10; f.w.latestRosterSize = 2000; }, /Unit cap reached/],
    [() => { f.w.latestRosterSize = 4; building.productionOptions = [{ kind: 'spearman', available: false, reason: 'REQUIRES MILITARY TIER II' }]; }, /REQUIRES MILITARY TIER II/],
    [() => { building.productionOptions = []; f.w.matchWinner = team; }, /Match finished/],
  ];
  for (const [apply, reason] of blockedStates) {
    apply(); f.w.updateContextualCommands();
    assert.equal(f.d.activeElement, train, 'availability changes must not move keyboard focus to another command');
    assert.equal(train.disabled, false, 'reason remains reachable with keyboard focus');
    assert.equal(train.getAttribute('aria-disabled'), 'true'); assert.match(train.textContent, reason);
    train.click(); assert.equal(f.w.sentCommands.length, 0, 'unavailable activation sends no production request');
  }
  f.w.matchWinner = -1; f.w.updateContextualCommands();
  assert.equal(train.getAttribute('aria-disabled'), 'false'); assert.equal(f.d.activeElement, train);
  train.click();
  assert.deepEqual(JSON.parse(JSON.stringify(f.w.sentCommands)), [{ type: 'trainUnit', kind: 'spearman', buildingId: 8 }]);
  f.select([]);
  assert.equal(f.d.activeElement, f.w.dockToggle, 'a hidden selection still restores visible command focus');
});

test('initially unavailable contextual training can receive focus for its cost explanation', t => {
  const f = fixture(); t.after(() => f.dom.window.close());
  f.w.latestFood[0] = 0;
  f.select([], { id: 8, team: 0, type: 'barracks', complete: true, hp: 1800, maxHp: 1800 });
  const train = f.bar.querySelector('[data-product="spearman"]'); train.focus();
  assert.equal(f.d.activeElement, train);
  assert.equal(train.getAttribute('aria-disabled'), 'true'); assert.match(train.textContent, /Need 60 food/);
  assert.equal(f.w.getComputedStyle(train).opacity, '0.55');
  assert.equal(f.w.getComputedStyle(train).cursor, 'not-allowed');
  for (const detail of [0, 1]) train.dispatchEvent(new f.w.MouseEvent('click', { bubbles: true, detail }));
  assert.equal(f.w.sentCommands.length, 0, 'both keyboard-style and pointer-style activation are guarded');
});

for (const team of [0, 1]) test(`seat ${team}: unavailable contextual research retains inspectable focus and blocks activation`, t => {
  const f = fixture(team); t.after(() => f.dom.window.close());
  const building = { id: 8, team, type: 'barracks', complete: true, hp: 1800, maxHp: 1800 };
  f.select([], building);
  const research = f.bar.querySelector('[data-technology="infantry-attack"]'); research.focus();
  assert.equal(f.d.activeElement, research);
  const upgradeKey = TECHNOLOGY_DEFINITIONS['infantry-attack'].upgradeKey;
  const blockedStates = [
    [() => { f.w.latestFood[team] = 0; }, /NEED/],
    [() => { f.w.latestFood[team] = 500; building.complete = false; }, /COMPLETE BUILDING/],
    [() => { building.complete = true; f.w.latestTeamResearch[team].active = { type: 'infantry-attack' }; }, /RESEARCH IN PROGRESS/],
    [() => { f.w.latestTeamResearch[team].active = null; f.w.latestTeamResearch[team][upgradeKey] = true; }, /ALREADY COMPLETED/],
    [() => { f.w.latestTeamResearch[team][upgradeKey] = false; building.researchOptions = [{ upgrade: 'infantry-attack', available: false, reason: 'WAIT FOR AUTHORITATIVE STATE' }]; }, /WAIT FOR AUTHORITATIVE STATE/],
    [() => { building.researchOptions = []; f.w.matchWinner = team; }, /MATCH FINISHED/],
  ];
  for (const [apply, reason] of blockedStates) {
    apply(); f.w.updateContextualCommands();
    assert.equal(f.d.activeElement, research, 'availability updates must not move research focus to another command');
    assert.equal(research.disabled, false); assert.equal(research.getAttribute('aria-disabled'), 'true');
    assert.match(research.textContent, reason);
    for (const detail of [0, 1]) research.dispatchEvent(new f.w.MouseEvent('click', { bubbles: true, detail }));
    assert.equal(f.w.sentCommands.length, 0);
  }
  f.w.matchWinner = -1; f.w.updateContextualCommands();
  assert.equal(research.getAttribute('aria-disabled'), 'false'); assert.equal(f.d.activeElement, research);
  research.click();
  assert.deepEqual(JSON.parse(JSON.stringify(f.w.sentCommands)), [{ type: 'researchUpgrade', buildingId: 8, upgrade: 'infantry-attack' }]);
  f.select([]); assert.equal(f.d.activeElement, f.w.dockToggle);
});

for (const team of [0, 1]) test(`seat ${team}: selected Mill exposes paid Food Tools effect and retains lifecycle focus`, t => {
  const f = economyFixture(team); t.after(() => f.dom.window.close());
  const mill = { id: 41, team, type: 'mill', complete: true, hp: 600, maxHp: 600 };
  f.w.latestFood[team] = 100; f.w.latestWood[team] = 75; f.select([], mill);
  const button = f.bar.querySelector('[data-technology="food-tools"]');
  assert.ok(button); button.focus();
  assert.match(button.textContent, /100 food \/ 75 wood.*25s.*20% faster.*Carry 10.*200 food/);
  assert.equal(button.getAttribute('aria-disabled'), 'false');
  assert.equal(f.bar.querySelector('[data-context-products]').children.length, 0, 'Mill gains no unit/plot producer');
  button.click(); assert.deepEqual(JSON.parse(JSON.stringify(f.w.sentCommands)), [{ type: 'researchUpgrade', buildingId: mill.id, upgrade: 'food-tools' }]);
  f.w.latestTeamResearch[team].active = { type: 'food-tools', buildingId: mill.id, progress: .6, remaining: 10 };
  f.w.updateContextualCommands(); f.w.updateBuildingResearchControls(mill);
  assert.equal(f.d.activeElement, button); assert.equal(button.getAttribute('aria-disabled'), 'true');
  assert.match(f.w.ui.buildingResearchReadout.textContent, /FOOD TOOLS.*RESEARCHING 60%.*10S.*20% faster/);
  button.click(); assert.equal(f.w.sentCommands.length, 1);
  f.w.latestTeamResearch[team].active = null; f.w.latestTeamResearch[team].foodTools = true;
  f.w.updateContextualCommands(); f.w.updateBuildingResearchControls(mill);
  assert.match(button.textContent, /ALREADY COMPLETED/); assert.match(f.w.ui.buildingResearchReadout.textContent, /COMPLETED.*20% faster/);
  assert.equal(f.d.activeElement, button); button.click(); assert.equal(f.w.sentCommands.length, 1);
  mill.team = 1 - team; f.select([], mill);
  assert.equal(f.bar.querySelector('[data-technology="food-tools"]'), null, 'opponent Mill cannot expose own research');
});

test('unavailable research prerequisites remain focusable for their explanation', t => {
  const f = fixture(); t.after(() => f.dom.window.close());
  f.select([], { id: 8, team: 0, type: 'barracks', complete: true, hp: 1800, maxHp: 1800 });
  const research = f.bar.querySelector('[data-technology="military-armor"]'); research.focus();
  assert.equal(f.d.activeElement, research); assert.equal(research.getAttribute('aria-disabled'), 'true');
  assert.match(research.textContent, /REQUIRES MILITARY TIER II/);
  research.click(); assert.equal(f.w.sentCommands.length, 0);
});

for (const team of [0, 1]) test(`seat ${team}: Build already opens inspectable details with no resources and restores focus`, t => {
  const f = fixture(team); t.after(() => f.dom.window.close());
  f.w.latestFood[team] = f.w.latestWood[team] = 0; f.select([team * 2]);
  const build = f.bar.querySelector('[data-context-build]');
  assert.equal(build.disabled, false); f.click(build);
  assert.equal(f.w.commandDock.hidden, false); assert.equal(f.w.commandDock.dataset.activePanel, 'economy');
  f.escape(); assert.equal(f.d.activeElement, build); assert.deepEqual([...f.w.selected], [team * 2]);
});

for (const team of [0, 1]) test(`seat ${team}: selected Stone cargo keeps its label and real Return cargo action`, t => {
  const f = fixture(team); t.after(() => f.dom.window.close());
  const own = team * 2, orders = [];
  f.w.sendTrackedOrder = command => { orders.push(command); return 100; };
  f.w.setAttackMoveMode = () => {};
  f.w.eval(between('function issueReturnCargo(', "for (const button of document.querySelectorAll('[data-stationary-order]'))"));
  f.w.mapDefinition = { economyProfileId: 'stone-defense-v1' };
  Object.assign(f.w.units[own], { cargoType: 'stone', cargo: 3.125, generation: 17 });
  f.select([own]);
  assert.match(f.bar.querySelector('[data-context-summary]').textContent, /Cargo 0 food \/ 0 wood \/ 3 stone/);
  const button = f.bar.querySelector('[data-return-cargo]');
  assert.equal(button.hidden, false); assert.equal(button.disabled, false);
  f.click(button);
  assert.equal(orders.at(-1).type, 'returnCargo');
  assert.deepEqual([...orders.at(-1).ids], [own]);
  assert.equal(f.w.units[own].cargo, 3.125, 'issuing the order never grants a bank or discards cargo');
  f.w.mapDefinition = {}; f.w.updateSelectionUI();
  assert.equal(button.hidden, true); assert.doesNotMatch(f.bar.querySelector('[data-context-summary]').textContent, /stone/);
});

for (const team of [0, 1]) test(`seat ${team}: owned Sheep uses the existing compact Herd/Stop strip and returns cleanly to army context`, t => {
  const f = fixture(team); t.after(() => f.dom.window.close());
  const node = { id: 'owned-hud-sheep', type: 'food', stock: 100, x: 2.5, z: 3.5,
    wildlifeSpecies: 'bellweather-sheep' };
  const row = { ...node, wildlifeState: 'alive', wildlifeTeam: team,
    wildlifeHeading: 0, wildlifeActivity: 'grazing' };
  Object.assign(f.w, { mapDefinition: { id: 'sheep-hud', width: 16, height: 16, fogOfWar: true,
    resourceNodes: [node] }, MAP_WIDTH: 16, MAP_HEIGHT: 16, MAP_HALF_X: 8, MAP_HALF_Z: 8,
    latestFogCells: new Uint8Array(256).fill(2), latestForestStocks: new Map(), resourceNodeVisuals: new Map(),
    wildlifeRenderer: { reconcile() {}, isAvailable: () => true }, TEAM_NAMES: ['Azure', 'Ember'],
  });
  f.w.applyWildlifeState({ mapId: 'sheep-hud', forestEpoch: 7, resourceNodes: [row] });
  f.w.selectWildlife(row);
  assert.equal(f.w.selected.size, 0); assert.equal(f.w.selectedBuildingId, null);
  assert.equal(f.bar.hidden, false); assert.equal(f.bar.dataset.context, 'wildlife');
  assert.match(f.bar.querySelector('[data-context-summary]').textContent,
    new RegExp(`Bellweather Sheep · ${team === 0 ? 'Azure' : 'Ember'} · 100 food`));
  const target = f.bar.querySelector('[data-context-proxy="order-target-toggle"]');
  assert.equal(target.hidden, false); assert.equal(target.querySelector('[data-command-label]').textContent, 'Herd');
  const stop = f.bar.querySelector('[data-stationary-order="stop"]');
  assert.equal(stop.hidden, false); assert.equal(stop.disabled, false);
  const visible = [...f.bar.querySelectorAll('button')].filter(button => !button.closest('[hidden]'));
  assert.deepEqual(visible.map(button => button.dataset.stationaryOrder || button.dataset.contextProxy), ['order-target-toggle', 'stop']);
  assert.equal(f.d.querySelector('#assign-selected-group').disabled, true);
  f.w.selectWorkers();
  assert.equal(f.w.selectedWildlifeId, null); assert.deepEqual([...f.w.selected], [team * 2]);
  assert.equal(f.bar.dataset.context, 'workers');
  assert.equal(f.bar.querySelector('[data-context-build]').hidden, false);
  assert.equal(f.bar.querySelector('[data-context-groups]').hidden, false);
});
