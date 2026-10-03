import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { selectionContext } from '../src/selection-context.mjs';
import { updateSelectionPortrait, WORKER_PORTRAITS } from '../src/selection-portrait.mjs';
import { UNIT_DEFINITIONS, BUILDING_DEFINITIONS, TECHNOLOGY_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { researchAction, researchOptions } from '../src/research-actions.mjs';
import { setHudActionAvailability, isHudActionUnavailable } from '../src/hud-layout.mjs';
import { livingIdleWorkerIds, livingUnitIdsOfKinds } from '../src/unit-selection.mjs';
import { formatResourceStock, formatResourceRequirement } from '../src/resource-format.mjs';

const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
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
  w.ResizeObserver = class { constructor(callback) { this.callback = callback; this.targets = []; observers.push(this); } observe(target) { this.targets.push(target); } };
  w.ui = {};
  for (const [, name, selector] of source.matchAll(/^\s*(\w+): document\.querySelector\('([^']+)'\)/gm)) w.ui[name] = d.querySelector(selector);
  Object.assign(w, {
    selectionContext, updateSelectionPortrait, UNIT_DEFINITIONS, BUILDING_DEFINITIONS, TECHNOLOGY_DEFINITIONS,
    castPreview: true, humanRosterPreview: true, roomPageUrl: new URL('http://localhost/'),
    unitSpriteRuntime: { roleForUnit: unit => unit.team === 0 ? 'human' : 'boughward-worker' },
    researchAction, researchOptions, setHudActionAvailability, isHudActionUnavailable,
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
    updateCommandUI() {}, updateEconomyUI() {}, updateBuildingSelectionVisual() {},
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

for (const team of [0, 1]) test(`seat ${team}: single Worker portrait opens dismissible notes and keeps live health and focus`, t => {
  const f = fixture(team); t.after(() => f.dom.window.close());
  const own = team * 2, role = team === 0 ? 'human' : 'boughward-worker';
  const portrait = f.bar.querySelector('[data-worker-portrait]'), image = portrait.querySelector('img');
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
  assert.match(notes.textContent, /Gathers food and wood\. Builds and repairs structures\./);
  f.escape();
  assert.equal(f.w.commandDock.hidden, true);
  assert.equal(f.d.activeElement, portrait);
  assert.deepEqual([...f.w.selected], [own]);
  f.w.units[own].hp = 37; f.w.updateSelectionUI();
  assert.equal(health.textContent, 'Worker · 37 / 100 HP');
  assert.equal(portrait.querySelector('img'), image);
  assert.equal(f.d.activeElement, portrait);
});

test('portrait and role notes never invent an individual for groups, buildings, enemy, dead or spectator selections', t => {
  const f = fixture(); t.after(() => f.dom.window.close());
  const portrait = f.bar.querySelector('[data-worker-portrait]'), notes = f.d.querySelector('#selected-worker-notes');
  f.w.units[4] = { id: 4, team: 0, kind: 'worker', hp: 100 };
  for (const ids of [[0, 4], [0, 1], [1], [2], [99], []]) {
    f.select([0]); f.select(ids);
    assert.equal(portrait.hidden, true, `selection ${ids}`);
    assert.equal(notes.hidden, true);
    if (ids.length === 2) assert.match(f.bar.querySelector('[data-context-summary]').textContent, /2 selected/);
  }
  f.select([0]);
  f.select([], { id: 8, team: 0, type: 'barracks', complete: true, hp: 1800, productionQueue: [] });
  assert.equal(portrait.hidden, true); assert.equal(notes.hidden, true);
  f.select([0]); f.w.units[0].hp = 0; f.w.updateSelectionUI();
  assert.equal(portrait.hidden, true);
  f.w.units[0].hp = 100; f.select([0]); f.w.localTeam = null; f.w.updateSelectionUI();
  assert.equal(portrait.hidden, true);
});

test('portrait follows the effective appearance and hides for unrepresented legacy/model previews', t => {
  const f = fixture(); t.after(() => f.dom.window.close());
  const portrait = f.bar.querySelector('[data-worker-portrait]');
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
  const portrait = f.bar.querySelector('[data-worker-portrait]');
  f.select([0]); f.click(portrait); f.select([]);
  assert.equal(f.d.querySelector('#selected-worker-notes').hidden, true);
  f.escape();
  assert.equal(f.w.commandDock.hidden, true);
  assert.equal(f.d.activeElement, f.w.dockToggle);
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
  f.w.sendTrackedOrder = command => { orders.push(command); return 100; };
  f.w.setAttackMoveMode = () => {};
  f.w.eval(between('function issueReturnCargo(', "for (const button of document.querySelectorAll('[data-stationary-order]'))"));
  f.select([own]); assert.equal(button.hidden, true);
  Object.assign(f.w.units[own], { cargo: 0.5, cargoType: 'food' });
  f.select([own, own + 1]); assert.equal(button.hidden, false); assert.equal(button.disabled, false);
  f.click(button); assert.deepEqual([...orders[0].ids], [own]); assert.equal(orders[0].type, 'returnCargo');
  f.select([enemy]); assert.equal(button.hidden, true);
  f.select([], { id: 8, team, type: 'barracks', complete: true, hp: 1800, productionQueue: [] });
  assert.equal(button.hidden, true);
  f.w.matchWinner = team; f.select([own]); assert.equal(button.disabled, true);
  f.w.matchWinner = -1; f.w.units[own].cargo = 0; f.select([own]); assert.equal(button.hidden, true);
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
  assert.deepEqual(f.observers[0].targets, [f.bar, f.quick]);
  for (const [ids, expected] of [[[], '52px'], [[0], '86px'], [[1], '86px'], [[], '52px']]) {
    f.select(ids); f.observers[0].callback();
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
