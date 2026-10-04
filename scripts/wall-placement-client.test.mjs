import { economyClientBindings } from './economy-client-fixture.mjs';
import { wildlifeClientBindings, wildlifeClientFunctionSource } from './wildlife-client-fixture-bindings.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { BUILDING_DEFINITIONS, TECHNOLOGY_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { WallPlacementGesture, wallCellAt, previewWallPlacement, wallPlacementFeedback } from '../src/wall-placement.mjs';
import { createWallPlacementGhost } from '../src/wall-placement-ghost.mjs';
import { classifyOrderNotice } from '../src/order-feedback.mjs';

const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const between = (start, end) => {
  const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a); return source.slice(a, b);
};

function fixture(t, team = 0) {
  const dom = new JSDOM('<canvas tabindex="0"></canvas><div class="field-hint"></div><button id="guidance-toggle"></button><div id="status"></div><input>', { runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  const w = dom.window, d = w.document, canvas = d.querySelector('canvas');
  const captures = new Set(), commands = [], toasts = [];
  let overlay = false;
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, right: 200, bottom: 200, width: 200, height: 200 });
  d.elementFromPoint = () => overlay ? d.querySelector('input') : canvas;
  canvas.setPointerCapture = id => captures.add(id);
  canvas.hasPointerCapture = id => captures.has(id);
  canvas.releasePointerCapture = id => { captures.delete(id); const event = new w.Event('lostpointercapture'); Object.defineProperty(event, 'pointerId', { value: id }); canvas.dispatchEvent(event); };
  w.matchMedia = () => ({ matches: false });
  const units = [0, 1].map(id => ({ id, kind: 'worker', hp: 100, team: id, serverX: 8.5, serverZ: 8.5 }));
  Object.assign(w, { ...economyClientBindings(), ...wildlifeClientBindings(), BUILDING_DEFINITIONS, TECHNOLOGY_DEFINITIONS, WallPlacementGesture, wallCellAt, previewWallPlacement, wallPlacementFeedback,
    renderer: { domElement: canvas }, wallPlacementGesture: new WallPlacementGesture(), wallKeyboardCell: null,
    pendingWallPreview: null,
    wallPlacementGhost: createWallPlacementGhost(), placementGhost: { visible: false },
    localTeam: team, matchWinner: -1, MAP_WIDTH: 20, MAP_HEIGHT: 20, MAP_HALF_X: 10, MAP_HALF_Z: 10,
    latestFood: [0, 0], latestWood: [250, 250], latestBuildings: [], latestForestStocks: new Map(), latestResourceStocks: new Map(),
    latestTeamResearch: [{}, {}],
    mapDefinition: { obstacles: [], resourceNodes: [], triggers: [] }, units, teamUnits: units.map(unit => [unit]),
    selected: new w.Set([team]), selectedIds: () => [...w.selected].filter(id => units[id]?.hp > 0 && units[id]?.team === team),
    selectedWorkerIds: () => w.selectedIds().filter(id => units[id]?.kind === 'worker'),
    buildingFootprint: type => BUILDING_DEFINITIONS[type].footprint,
    buildingWoodCost: type => BUILDING_DEFINITIONS[type].cost.wood,
    buildingLabel: type => BUILDING_DEFINITIONS[type].label,
    buildPlacementActive: false, buildPlacementPending: false, buildPlacementType: 'house',
    pendingBuildOrderToken: null, pendingBuildBaseline: new w.Set(),
    attackMoveMode: false, persistentTargetMode: null, tapOrderArmed: false, tapOrderPointer: null,
    cursorPointer: null, cursorShift: false, spaceDown: false, pan: null, drag: null,
    movedPointer: false, lastFriendlyUnitClick: null, lastUnitPickState: null, lastCursorSample: 0,
    guidanceDismissed: false, ui: { placementStatus: d.querySelector('#status') },
    groundHeight: () => 0, worldAt: (x, y) => ({ x: x / 10 - 10, z: y / 10 - 10 }), cameraTarget: { x: -8.5, z: -8.5 },
    clearActiveControlGroup() {}, syncSelectionMesh() {}, updateSelectionUI() {}, updateCommandUI() {},
    updateEconomyUI() {}, closeDockDetails() {}, syncTargetOrderUI() {}, syncBattlefieldCursor() {},
    sendTrackedOrder(command) { commands.push(command); return commands.length; }, showToast(message) { toasts.push(message); },
    formatResourceRequirement: String, issueContextOrder() {}, clearHeldCameraKeys() {},
    keyboardTargetIsEditing: event => event.target?.matches('input'), cameraNavigationKeydown: () => false,
    controlGroupIndexFromKey: () => null, appShell: d.createElement('div'),
  });
  w.eval(wildlifeClientFunctionSource(source) + between('function wallPlacementAt(', 'function queueWorker('));
  w.eval(between('function updateRosterBuildingOptions(', 'function updateEconomyUI('));
  // Isolate battlefield cursor picking; its logic has separate tests.
  w.syncBattlefieldCursor = () => {};
  w.eval(between("renderer.domElement.addEventListener('pointerdown'", 'function canIssueMinimapMove('));
  w.eval(between("window.addEventListener('keydown', (event) => {\n  lastFriendlyUnitClick", "document.addEventListener('focusin'"));
  const pointer = (type, x, y, { id = 1, button = 0, shiftKey = false } = {}) => {
    const event = new w.MouseEvent(type, { clientX: x, clientY: y, button, shiftKey, bubbles: true, cancelable: true });
    Object.defineProperty(event, 'pointerId', { value: id }); canvas.dispatchEvent(event); return event;
  };
  const key = (key, options = {}) => { const event = new w.KeyboardEvent('keydown', { key, code: key, bubbles: true, cancelable: true, ...options }); (options.target || canvas).dispatchEvent(event); return event; };
  return { w, d, canvas, commands, toasts, captures, pointer, key, overlay(value) { overlay = value; }, begin() { w.beginBuildPlacement('palisade-wall'); } };
}

for (const team of [0, 1]) test(`seat ${team}: normal menu starts drag, previews total cost, then sends one atomic command`, t => {
  const f = fixture(t, team); f.begin();
  assert.equal(f.d.activeElement, f.canvas); assert.equal(f.w.buildPlacementActive, true);
  f.pointer('pointerdown', 15, 15); assert.equal(f.commands.length, 0); assert.ok(f.captures.has(1));
  f.pointer('pointermove', 45, 35);
  assert.match(f.w.ui.placementStatus.textContent, /6 NEW · 90 WOOD/);
  assert.equal(f.w.wallPlacementGhost.tiles.count, 6);
  f.pointer('pointerup', 45, 35);
  assert.equal(f.commands.length, 1); assert.equal(f.commands[0].type, 'buildWall');
  assert.deepEqual(JSON.parse(JSON.stringify(f.commands[0].points)), [{ column: 1, row: 1 }, { column: 4, row: 3 }]);
  assert.deepEqual([...f.commands[0].ids], [team]); assert.equal(f.commands[0].axisOrder, 'column-first');
  assert.equal(f.w.latestWood[team], 250, 'client never debits a bank');
  assert.equal(f.w.buildPlacementPending, true); assert.equal(f.captures.size, 0);
  assert.equal(f.w.wallPlacementGhost.tiles.count, 6, 'pending line remains visible');
  f.w.latestWood[team] = 0; f.w.cursorShift = true; f.w.updateBuildPlacementGhost(45, 35);
  assert.match(f.w.ui.placementStatus.textContent, /6 NEW · 90 WOOD/, 'sent preview stays fixed through stock/Shift changes');
  f.w.dispatchEvent(new f.w.Event('blur')); f.w.updateBuildPlacementGhost(null, null);
  assert.equal(f.w.buildPlacementPending, true); assert.equal(f.w.wallPlacementGhost.tiles.count, 6, 'blur cannot discard a submitted preview');
  f.pointer('pointerup', 45, 35); f.pointer('pointerdown', 45, 35); f.pointer('pointerup', 45, 35);
  assert.equal(f.commands.length, 1, 'pending and repeated release cannot resend');
});

test('Shift chooses the alternate elbow; a tap sends one segment', t => {
  const f = fixture(t); f.begin(); f.pointer('pointerdown', 15, 15);
  f.pointer('pointermove', 45, 35, { shiftKey: true });
  f.pointer('pointerup', 45, 35, { shiftKey: true }); assert.equal(f.commands[0].axisOrder, 'row-first');
  f.w.cancelBuildPlacement(false); f.begin();
  f.pointer('pointerdown', 15, 15); f.pointer('pointerup', 15, 15);
  assert.deepEqual(JSON.parse(JSON.stringify(f.commands[1].points)), [{ column: 1, row: 1 }, { column: 1, row: 1 }]);
});

test('blocked or unaffordable lines send nothing and remain retryable', t => {
  const f = fixture(t); f.begin(); f.w.latestWood[0] = 44.99;
  f.pointer('pointerdown', 15, 15); f.pointer('pointermove', 35, 15); f.pointer('pointerup', 35, 15);
  assert.equal(f.commands.length, 0); assert.match(f.toasts.at(-1), /NEED 45 WOOD/);
  assert.equal(f.w.buildPlacementActive, true); assert.equal(f.w.buildPlacementPending, false);
  f.w.latestWood[0] = 250; f.w.mapDefinition.resourceNodes = [{ x: -7.5, z: -8.5 }];
  f.pointer('pointerdown', 15, 15); f.pointer('pointermove', 35, 15); f.pointer('pointerup', 35, 15);
  assert.equal(f.commands.length, 0); assert.match(f.toasts.at(-1), /RESOURCE IN THIS LINE/);
  f.w.mapDefinition.resourceNodes = []; f.pointer('pointerdown', 15, 15); f.pointer('pointerup', 35, 15);
  assert.equal(f.commands.length, 1);
});

test('pointer cancellation, lost capture, blur, Escape and RMB discard the entire gesture', t => {
  for (const action of ['pointercancel', 'lostpointercapture', 'blur', 'Escape', 'RMB']) {
    const f = fixture(t); f.begin(); f.pointer('pointerdown', 15, 15); f.pointer('pointermove', 35, 15);
    if (action === 'blur') f.w.dispatchEvent(new f.w.Event('blur'));
    else if (action === 'Escape') f.key('Escape');
    else if (action === 'RMB') f.pointer('pointerdown', 35, 15, { button: 2 });
    else f.pointer(action, 35, 15);
    f.pointer('pointerup', 35, 15);
    assert.equal(f.commands.length, 0, action); assert.equal(f.w.wallPlacementGesture.anchor, null, action);
  }
});

test('off-map release and release over HUD cancel without clamping or paying', t => {
  for (const target of ['outside-canvas', 'off-map', 'hud']) {
    const f = fixture(t); f.begin(); f.pointer('pointerdown', 15, 15);
    if (target === 'hud') f.overlay(true);
    if (target === 'off-map') f.w.worldAt = () => ({ x: 10.1, z: 0 });
    f.pointer('pointerup', target === 'outside-canvas' ? 205 : 35, 15);
    assert.equal(f.commands.length, 0, target); assert.equal(f.w.buildPlacementPending, false);
  }
});

test('a second pointer cannot change, replace or release the active line', t => {
  const f = fixture(t); f.begin(); f.pointer('pointerdown', 15, 15);
  f.pointer('pointerdown', 85, 85, { id: 2 }); f.pointer('pointermove', 95, 95, { id: 2 });
  f.pointer('pointerup', 95, 95, { id: 2 }); assert.equal(f.commands.length, 0);
  assert.equal(f.w.wallPlacementGesture.anchor.column, 1);
  f.pointer('pointerup', 35, 15); assert.equal(f.commands[0].points[1].column, 3);
});

test('camera changes refresh the captured endpoint before release; pan initiation cancels unsent work', t => {
  const f = fixture(t); f.begin(); f.pointer('pointerdown', 15, 15); f.pointer('pointermove', 35, 15);
  f.w.worldAt = (x, y) => ({ x: x / 10 - 9, z: y / 10 - 10 });
  f.w.updateBuildPlacementGhost(35, 15);
  assert.equal(f.w.wallPlacementGesture.end.column, 4); assert.equal(f.w.wallPlacementGhost.tiles.count, 4);
  f.pointer('pointerup', 35, 15); assert.equal(f.commands[0].points[1].column, 4);
  f.w.cancelBuildPlacement(false); f.begin(); f.pointer('pointerdown', 15, 15);
  f.pointer('pointerdown', 35, 15, { button: 1 }); f.pointer('pointerup', 35, 15, { button: 1 });
  assert.equal(f.commands.length, 1, 'middle-button release cannot commit a left drag');
  assert.equal(f.w.wallPlacementGesture.anchor, null);
});

test('focused keyboard arrows and two Enter presses place one line; typing and key repeats do not submit', t => {
  const f = fixture(t); f.begin(); f.key('Enter');
  f.key('ArrowRight'); f.key('ArrowRight', { repeat: true }); f.key('ArrowDown', { shiftKey: true });
  f.key('Enter', { repeat: true }); assert.equal(f.commands.length, 0);
  f.key('Enter', { target: f.d.querySelector('input') }); assert.equal(f.commands.length, 0);
  f.key('Enter'); assert.equal(f.commands.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(f.commands[0].points)), [{ column: 1, row: 1 }, { column: 3, row: 2 }]);
});

test('keyboard invalid endpoint can be corrected without starting over', t => {
  const f = fixture(t); f.begin(); f.key('Enter');
  f.w.latestWood[0] = 15; f.key('ArrowRight'); f.key('Enter');
  assert.equal(f.commands.length, 0); assert.ok(f.w.wallPlacementGesture.anchor);
  f.key('ArrowLeft'); f.key('Enter'); assert.equal(f.commands.length, 1);
});

test('only a matching terminal wall acknowledgement releases pending input, including no-charge reuse', () => {
  for (const message of ['PALISADE LINE PLACED · 3 SEGMENTS · 45 WOOD', 'WALL ALREADY PLACED · NO CHARGE']) {
    const reply = token => classifyOrderNotice({ message, noticeToken: token, currentOrderToken: 8, pendingBuildOrderToken: 7 });
    assert.equal(reply(7).completePendingBuild, true); assert.equal(reply(7).showToast, true);
    assert.equal(reply(6).completePendingBuild, undefined); assert.equal(reply(null).completePendingBuild, undefined);
  }
});

test('terminal wall notices finish actual order feedback, including fully reused no-op requests', t => {
  const f = fixture(t), outcomes = [];
  f.w.currentOrderToken = 7;
  f.w.finishOrderStatus = (...args) => outcomes.push(args);
  f.w.eval(between('function applyOrderNotice(', 'function sendTrackedOrder('));
  for (const message of ['PALISADE LINE PLACED · 3 SEGMENTS · 45 WOOD', 'WALL ALREADY PLACED · NO CHARGE']) {
    assert.equal(f.w.applyOrderNotice(7, message), true); assert.equal(outcomes.at(-1)[2], 'applied');
  }
  assert.equal(f.w.applyOrderNotice(6, 'WALL ALREADY PLACED · NO CHARGE'), false);
  assert.equal(outcomes.length, 2);
});

for (const team of [0, 1]) test(`seat ${team}: zero bank can enter the normal menu for free reuse; new cells remain unaffordable`, t => {
  const f = fixture(t, team), menu = f.d.createElement('div'); f.d.body.append(menu);
  f.w.latestWood[team] = 0;
  f.w.latestBuildings = [{ id: 10, type: 'palisade-wall', team, x: -8.5, z: -8.5 }];
  f.w.updateRosterBuildingOptions(menu);
  assert.equal(menu.querySelector('[data-building="palisade-wall"]').disabled, false);
  assert.equal(menu.querySelector('[data-building="storehouse"]').disabled, true, 'ordinary building price gates remain');
  menu.querySelector('[data-building="palisade-wall"]').click(); assert.equal(f.w.buildPlacementActive, true);
  f.pointer('pointerdown', 15, 15); f.pointer('pointermove', 25, 15);
  assert.match(f.w.ui.placementStatus.textContent, /NEED 15 WOOD/);
  f.pointer('pointerup', 25, 15); assert.equal(f.commands.length, 0);
  f.pointer('pointerdown', 15, 15); f.pointer('pointerup', 15, 15);
  assert.equal(f.commands.length, 1); assert.equal(f.commands[0].type, 'buildWall');
  assert.match(f.w.ui.placementStatus.textContent, /0 NEW · 0 WOOD · 1 REUSED FREE/);
});

for (const team of [0, 1]) test(`seat ${team}: wall submission retains only explicitly selected living friendly Workers`, t => {
  const f = fixture(t, team);
  const otherWorker = { id: 2, team, kind: 'worker', hp: 100, serverX: 7.5, serverZ: 7.5 };
  f.w.units.push(otherWorker, { id: 3, team, kind: 'infantry', hp: 100 },
    { id: 4, team: 1 - team, kind: 'worker', hp: 100 }, { id: 5, team, kind: 'worker', hp: 0 });
  f.w.teamUnits[team].push(otherWorker);
  f.begin();
  // Entry selection is a separately reported/owned shared bug. Exercise the
  // authoritative wall gesture's explicit selection after that entry point.
  f.w.selected = new f.w.Set([team, 3, 4, 5]);
  f.pointer('pointerdown', 15, 15); f.pointer('pointerup', 35, 15);
  assert.equal(f.commands.length, 1); assert.deepEqual([...f.commands[0].ids], [team]);
  assert.equal(f.w.selected.has(2), false, 'unselected friendly Worker stays unselected');
});

test('wall preview follows the shared disclosed-resource cache through depletion and reset', t => {
  const f = fixture(t); f.begin();
  f.w.mapDefinition.resourceNodes = [{ id: 'food', x: -7.5, z: -8.5, stock: 10 }];
  const points = [{ column: 1, row: 1 }, { column: 3, row: 1 }];
  assert.equal(f.w.wallPlacementAt(points).valid, false, 'unknown retains authored exclusion');
  f.w.latestResourceStocks.set('food', 0); assert.equal(f.w.wallPlacementAt(points).valid, true);
  f.w.latestResourceStocks.set('food', 10); assert.equal(f.w.wallPlacementAt(points).valid, false, 'shared reset stock closes it again');
  f.w.latestResourceStocks.clear(); assert.equal(f.w.wallPlacementAt(points).valid, false);
});
