import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
function between(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `shipped source bounds: ${start}`);
  return source.slice(a, b);
}
export function minimapFixture(team = 0) {
  const dom = new JSDOM('<canvas id="minimap-canvas" width="384" height="384"></canvas>', { runScripts: 'outside-only' });
  const w = dom.window, canvas = w.document.querySelector('canvas');
  const sent = [], captured = new Set();
  let bounds = { left: 100, top: 40, width: 192, height: 192 };
  canvas.getBoundingClientRect = () => bounds;
  canvas.setPointerCapture = id => captured.add(id);
  canvas.hasPointerCapture = id => captured.has(id);
  canvas.releasePointerCapture = id => captured.delete(id);
  const noop = () => {};
  Object.assign(w, {
    minimapCanvas: canvas, minimapPointerId: null,
    MAP_WIDTH: 64, MAP_HEIGHT: 64, MAP_HALF_X: 32, MAP_HALF_Z: 32,
    THREE: { MathUtils: { clamp: (n, min, max) => Math.max(min, Math.min(max, n)) } },
    mapDefinition: { fogOfWar: true }, localTeam: team, matchWinner: -1,
    selected: new Set([1, 2, 3, 4, 99]), selectedBuildingId: null,
    units: [null, { id: 1, team: 0, hp: 40, kind: 'worker', generation: 5 },
      { id: 2, team: 0, hp: 80, kind: 'infantry', generation: 6 },
      { id: 3, team: 1, hp: 40, kind: 'worker', generation: 7 },
      { id: 4, team: 0, hp: 0, kind: 'worker', generation: 8 }],
    latestFogCells: new Uint8Array(4096), buildPlacementActive: false,
    attackMoveMode: false, persistentTargetMode: null, tapOrderArmed: false,
    mapFitActive: true, cameraTarget: { x: 7, z: 9 }, zoom: 0.91,
    ui: { formationSelect: { value: 'line' } },
    TextEncoder, WebSocket: { OPEN: 1 },
    socket: { readyState: 1, send(payload) { sent.push(JSON.parse(payload)); } },
    orderToken: 0, updateCommandUI: noop, showToast: noop, setCamera: noop, drawMinimap: noop,
    groundHeight: () => 0, audio: { playEvent: noop },
    moveMarker: { position: { set: noop }, material: { color: { setHex: noop } }, scale: { setScalar: noop } },
    sendTrackedOrder(command) { return w.sendCommand({ ...command, clientOrderToken: ++w.orderToken }); },
    setTapOrderArmed(armed) { w.tapOrderArmed = armed; },
    setAttackMoveMode(armed) { w.attackMoveMode = armed; },
    pickAt() { throw Error('Minimap must not pick a unit target'); },
    pickResourceNodeAt() { throw Error('Minimap must not pick a resource target'); },
    worldAt() { throw Error('Minimap must not raycast the battlefield camera'); },
  });
  w.eval([
    between('function minimapMapRect(', 'function minimapPoint('),
    between('function worldFromMinimap(', 'function makeInstances('),
    between('function selectedIds()', 'function issueStationaryOrder('),
    between('function sendCommand(', 'function projectUnit('),
    between('function issueMove(', 'function issueBuildingRallyPoint('),
    between('function canIssueMinimapMove(', 'function selectWholeTeam('),
  ].join('\n'));
  return { w, dom, canvas, sent, captured, bounds(value) { bounds = value; },
    event(type, { button = 2, x = 196, y = 136, id = 1, shiftKey = false } = {}) {
      const event = new w.MouseEvent(type, { button, clientX: x, clientY: y, shiftKey, bubbles: true, cancelable: true });
      Object.defineProperty(event, 'pointerId', { value: id });
      canvas.dispatchEvent(event);
      return event;
    },
  };
}

for (const [team, ids, generations] of [[0, [1, 2], [5, 6]], [1, [3], [7]]]) {
  test(`seat ${team}: one ground move for exactly the living selected owned IDs`, t => {
    const f = minimapFixture(team); t.after(() => f.dom.window.close());
    const selected = [...f.w.selected], fog = [...f.w.latestFogCells];
    const down = f.event('pointerdown', { x: 220, y: 100 });
    f.event('pointermove', { x: 250 });
    f.event('pointerup'); f.event('click'); f.event('contextmenu');
    assert.equal(down.defaultPrevented, true);
    assert.equal(f.sent.length, 1, 'pointer move/up/click/contextmenu must not send again');
    assert.deepEqual(f.sent[0], { type: 'move', ids, unitGenerations: generations, x: 8, z: -12, formation: 'line', clientOrderToken: 1 });
    assert.deepEqual([...f.w.selected], selected);
    assert.deepEqual({ ...f.w.cameraTarget }, { x: 7, z: 9 });
    assert.equal(f.w.mapFitActive, true);
    assert.equal(f.captured.size, 0, 'right-click never captures a camera drag');
    assert.deepEqual([...f.w.latestFogCells], fog, 'unexplored movement does not reveal fog');
  });
}

test('Shift right-click queues a plain move, including when a targeting mode was armed', t => {
  const f = minimapFixture(); t.after(() => f.dom.window.close());
  for (const mode of ['attackMove', 'patrol', 'follow']) {
    f.w.attackMoveMode = mode === 'attackMove';
    f.w.persistentTargetMode = mode === 'attackMove' ? null : mode;
    f.w.tapOrderArmed = true;
    f.event('pointerdown', { shiftKey: true });
    assert.equal(f.sent.at(-1).type, 'move'); assert.equal(f.sent.at(-1).queue, true);
    assert.equal(f.w.attackMoveMode, false); assert.equal(f.w.persistentTargetMode, null);
    assert.equal(f.w.tapOrderArmed, false);
  }
});

test('empty, dead, foreign, spectator, building, placement and finished-match contexts cannot send', t => {
  const f = minimapFixture(); t.after(() => f.dom.window.close());
  const states = [
    { selected: new Set() }, { selected: new Set([3, 4, 99]) },
    { localTeam: null }, { selectedBuildingId: 7 }, { buildPlacementActive: true },
    { matchWinner: 0 }, { mapDefinition: null },
  ];
  for (const state of states) {
    Object.assign(f.w, { selected: new Set([1]), localTeam: 0, selectedBuildingId: null,
      buildPlacementActive: false, matchWinner: -1, mapDefinition: {}, ...state });
    assert.equal(f.event('pointerdown').defaultPrevented, false);
    assert.equal(f.event('contextmenu').defaultPrevented, false, 'browser menu stays available outside a valid order context');
  }
  assert.equal(f.sent.length, 0);
});

test('left camera dragging is preserved, ignores other pointers, and never sends units', t => {
  const f = minimapFixture(); t.after(() => f.dom.window.close());
  assert.equal(f.event('pointerdown', { button: 0 }).defaultPrevented, true);
  assert.deepEqual({ ...f.w.cameraTarget }, { x: 0, z: 0 });
  assert.equal(f.w.mapFitActive, false); assert.equal(f.captured.has(1), true);
  f.event('pointermove', { id: 2, x: 244, y: 88 });
  assert.deepEqual({ ...f.w.cameraTarget }, { x: 0, z: 0 });
  f.event('pointerdown', { button: 2 });
  assert.equal(f.sent.length, 0, 'a chord during camera drag cannot issue an order');
  f.event('pointermove', { button: 0, x: 244, y: 88 });
  assert.deepEqual({ ...f.w.cameraTarget }, { x: 16, z: -16 });
  f.event('pointercancel', { button: 0 });
  assert.equal(f.captured.size, 0); assert.equal(f.w.minimapPointerId, null);
  f.event('pointerdown', { button: 0 }); f.event('lostpointercapture', { button: 0 });
  assert.equal(f.w.minimapPointerId, null);
  assert.equal(f.event('pointerdown', { button: 1 }).defaultPrevented, false);
  assert.equal(f.sent.length, 0);
});

test('coordinates invert rendering across map aspect, backing size, CSS stretch, zoom and DPR', t => {
  const f = minimapFixture(); t.after(() => f.dom.window.close());
  for (const [width, height] of [[64, 64], [160, 96], [96, 160], [256, 256]]) {
    Object.assign(f.w, { MAP_WIDTH: width, MAP_HEIGHT: height, MAP_HALF_X: width / 2, MAP_HALF_Z: height / 2 });
    for (const [cssWidth, cssHeight, backing, dpr, zoom] of [[150, 150, 384, 1, 0.48], [300, 210, 768, 2, 2.3]]) {
      f.bounds({ left: 25, top: 70, width: cssWidth, height: cssHeight });
      f.canvas.width = backing; f.canvas.height = backing;
      f.w.devicePixelRatio = dpr; f.w.zoom = zoom;
      const r = f.w.minimapMapRect(backing, backing);
      const x = width * 0.3, z = -height * 0.2;
      const point = f.w.worldFromMinimap({
        clientX: 25 + (r.left + (x + width / 2) * r.scale) * cssWidth / backing,
        clientY: 70 + (r.top + (z + height / 2) * r.scale) * cssHeight / backing,
      });
      assert.ok(Math.abs(point.x - x) < 1e-9 && Math.abs(point.z - z) < 1e-9);
      const edge = f.w.worldFromMinimap({ clientX: -500, clientY: 1000 });
      assert.deepEqual({ ...edge }, { x: -width / 2, z: height / 2 }, 'padding and out-of-bounds drag clamp to map edges');
    }
  }
  f.bounds({ left: 0, top: 0, width: 0, height: 0 });
  assert.equal(f.w.worldFromMinimap({ clientX: 0, clientY: 0 }), null);
  f.event('pointerdown'); assert.equal(f.sent.length, 0);
});

test('offline sends preserve modes and use the existing transport failure path', t => {
  const f = minimapFixture(); t.after(() => f.dom.window.close());
  f.w.socket.readyState = 3; f.w.attackMoveMode = true;
  f.event('pointerdown');
  assert.equal(f.sent.length, 0); assert.equal(f.w.attackMoveMode, true);
});

test('battlefield move, attack-move, Patrol and Follow targeting keep their existing semantics', t => {
  const f = minimapFixture(); t.after(() => f.dom.window.close());
  f.w.issueMove({ x: 4, z: 6 }); assert.equal(f.sent.at(-1).type, 'move');
  f.w.attackMoveMode = true; f.w.issueMove({ x: 4, z: 6 }); assert.equal(f.sent.at(-1).type, 'attackMove');
  f.w.persistentTargetMode = 'patrol'; f.w.issueMove({ x: 4, z: 6 }, true);
  assert.equal(f.sent.at(-1).type, 'patrol'); assert.equal(f.sent.at(-1).queue, undefined);
  const count = f.sent.length; f.w.persistentTargetMode = 'follow'; f.w.issueMove({ x: 4, z: 6 });
  assert.equal(f.sent.length, count);
});
