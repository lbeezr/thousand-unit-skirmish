import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
function between(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, start); return source.slice(a, b);
}
function fixture() {
  const dom = new JSDOM('<canvas tabindex="0"></canvas><button>Action</button><input><textarea></textarea><select></select><a href="#">Link</a><summary>Details</summary><div role="button" tabindex="0">Action</div><div contenteditable="true"></div><dialog></dialog>', { runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window, canvas = w.document.querySelector('canvas'), points = [], orders = [];
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 });
  canvas.setPointerCapture = () => {};
  const noop = () => {};
  Object.assign(w, {
    renderer: { domElement: canvas }, mapDefinition: {}, mapFitActive: true,
    matchMenu: { hidden: true }, helpPanel: { hidden: true }, scenarioBriefPanel: { hidden: true },
    appShell: null, localTeam: 0, selectedBuildingId: null, latestBuildings: [], selected: new Set([1, 2, 3, 4]),
    units: [null, { id: 1, team: 0, hp: 40, renderX: 10, renderZ: 4 },
      { id: 2, team: 0, hp: 40, renderX: 20, renderZ: 8 },
      { id: 3, team: 1, hp: 40, renderX: -80, renderZ: 0 },
      { id: 4, team: 0, hp: 0, renderX: 90, renderZ: 0 }],
    ui: { mapStudio: { open: false } }, spaceDown: false, spaceCenterPending: false,
    pan: null, drag: null, buildPlacementActive: false, tapOrderArmed: false, tapOrderPointer: null,
    lastFriendlyUnitClick: null, lastUnitPickState: null, movedPointer: false,
    cameraNavigationKeydown: () => false, syncBattlefieldCursor: noop,
    cameraSafeRect: () => ({ left: 10, top: 10, width: 80, height: 80 }),
    focusGroundPointAtScreen(point, x, y) { points.push({ point: { ...point }, x, y }); w.mapFitActive = false; },
    drawMinimap: noop, showToast: noop, clearHeldCameraKeys: noop, cursorPointer: null,
    cursorShift: false, edgeScrollPointer: null, lastControlGroupRecall: null,
    heldCameraKeys: { release: noop }, issueContextOrder: (...args) => orders.push(args),
  });
  w.eval([
    between('function selectedIds()', 'function issueStationaryOrder('),
    between('function centerCameraOnSelection()', 'function centerCameraOnHomeBase('),
    between('function keyboardTargetIsEditing(', 'function clearHeldCameraKeys('),
    between('function selectionCenterShortcutAllowed(', "window.addEventListener('keydown', (event) => {\n  if (event.key === 'Shift')"),
    between("window.addEventListener('keyup'", "document.addEventListener('visibilitychange'"),
    between("renderer.domElement.addEventListener('pointerdown'", "renderer.domElement.addEventListener('pointerleave'"),
    between('function finishPointer(', 'function canIssueMinimapMove('),
    between("document.addEventListener('focusin'", "for (const button of document.querySelectorAll('.size-options button'))"),
  ].join('\n'));
  return { dom, w, canvas, points, orders, key(type, target = canvas, options = {}) {
    const event = new w.KeyboardEvent(type, { key: ' ', code: 'Space', bubbles: true, cancelable: true, ...options });
    target.dispatchEvent(event); return event;
  }, tap(target = canvas, options = {}) { this.key('keydown', target, options); return this.key('keyup', target, options); } };
}

test('a Space tap centers the living owned selected group once, without changing selection or orders', t => {
  const f = fixture(); t.after(() => f.dom.window.close());
  const ids = [...f.w.selected];
  assert.equal(f.key('keydown').defaultPrevented, true);
  assert.equal(f.points.length, 0, 'wait for release to distinguish tap from drag');
  f.key('keydown', f.canvas, { repeat: true }); f.key('keydown', f.canvas, { repeat: true });
  assert.equal(f.key('keyup').defaultPrevented, true);
  f.key('keyup');
  assert.deepEqual(f.points, [{ point: { x: 15, z: 6 }, x: 50, y: 50 }]);
  assert.deepEqual([...f.w.selected], ids); assert.deepEqual(f.orders, []);
  assert.equal(f.w.spaceDown, false); assert.equal(f.w.mapFitActive, false);
});

test('Space + left-drag still pans and does not center on release', t => {
  const f = fixture(); t.after(() => f.dom.window.close());
  f.key('keydown');
  const down = new f.w.MouseEvent('pointerdown', { button: 0, clientX: 20, clientY: 30 });
  Object.defineProperty(down, 'pointerId', { value: 1 }); f.canvas.dispatchEvent(down);
  assert.deepEqual({ ...f.w.pan }, { x: 20, y: 30 }); assert.equal(f.w.spaceCenterPending, false);
  const up = new f.w.MouseEvent('pointerup', { button: 0 });
  Object.defineProperty(up, 'pointerId', { value: 1 }); f.canvas.dispatchEvent(up);
  assert.equal(f.w.pan, null); f.key('keyup');
  assert.deepEqual(f.points, []); assert.deepEqual(f.orders, []);
});

test('Space pressed during an existing middle pan or selection drag cannot arm centering', t => {
  const f = fixture(); t.after(() => f.dom.window.close());
  const down = new f.w.MouseEvent('pointerdown', { button: 1, clientX: 20, clientY: 30 });
  Object.defineProperty(down, 'pointerId', { value: 1 }); f.canvas.dispatchEvent(down);
  f.key('keydown'); assert.equal(f.w.spaceCenterPending, false);
  const up = new f.w.MouseEvent('pointerup', { button: 1 });
  Object.defineProperty(up, 'pointerId', { value: 1 }); f.canvas.dispatchEvent(up);
  f.key('keyup'); assert.equal(f.w.pan, null);
  f.w.drag = {}; f.key('keydown'); f.w.drag = null; f.key('keyup');
  assert.deepEqual(f.points, []); assert.deepEqual(f.orders, []);
});

test('Space centers an owned selected building through the existing HUD-safe camera path', t => {
  const f = fixture(); t.after(() => f.dom.window.close());
  f.w.selectedBuildingId = 7;
  f.w.latestBuildings = [{ id: 7, team: 0, x: -10, z: 20 }];
  f.tap(); assert.deepEqual(f.points, [{ point: { x: -10, z: 20 }, x: 50, y: 50 }]);
});

test('buttons, links, editable controls and modified Space keep native keyboard behavior', t => {
  const f = fixture(); t.after(() => f.dom.window.close());
  for (const selector of ['button', 'input', 'textarea', 'select', 'a', 'summary', '[role="button"]', '[contenteditable]', 'dialog']) {
    const element = f.w.document.querySelector(selector);
    assert.equal(f.key('keydown', element).defaultPrevented, false, selector);
    assert.equal(f.key('keyup', element).defaultPrevented, false, selector);
  }
  for (const key of ['altKey', 'ctrlKey', 'metaKey', 'shiftKey']) assert.equal(f.tap(f.canvas, { [key]: true }).defaultPrevented, false);
  assert.deepEqual(f.points, []); assert.equal(f.w.spaceDown, false);
});

test('open menus/dialogs, active targeting, empty or invalid selection and absent maps never center', t => {
  const f = fixture(); t.after(() => f.dom.window.close());
  for (const menu of ['matchMenu', 'helpPanel', 'scenarioBriefPanel']) {
    f.w[menu].hidden = false; f.tap(); f.w[menu].hidden = true;
  }
  const dialog = f.w.document.querySelector('dialog'); dialog.setAttribute('open', ''); f.tap(); dialog.removeAttribute('open');
  f.w.ui.mapStudio.open = true; f.tap(); f.w.ui.mapStudio.open = false;
  for (const mode of ['buildPlacementActive', 'tapOrderArmed']) { f.w[mode] = true; f.tap(); f.w[mode] = false; }
  f.w.selected = new Set([3, 4, 99]); f.tap();
  f.w.selected.clear(); f.w.selectedBuildingId = 8; f.w.latestBuildings = [{ id: 8, team: 1, x: 1, z: 2 }]; f.tap();
  f.w.mapDefinition = null; f.tap();
  assert.deepEqual(f.points, []); assert.deepEqual(f.orders, []);
});

test('focus changes, blur and already-handled Space cannot leave a pending center', t => {
  const f = fixture(); t.after(() => f.dom.window.close());
  f.key('keydown'); f.w.dispatchEvent(new f.w.Event('blur')); f.key('keyup');
  f.key('keydown'); f.key('keyup', f.w.document.querySelector('input'));
  f.canvas.focus(); f.key('keydown'); f.w.document.querySelector('input').focus(); f.canvas.focus(); f.key('keyup');
  const event = new f.w.KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true });
  event.preventDefault(); f.canvas.dispatchEvent(event); f.key('keyup');
  assert.deepEqual(f.points, []); assert.equal(f.w.spaceCenterPending, false);
});
