import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { UNIT_DEFINITIONS } from '../src/gameplay-definitions.mjs';

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
    UNIT_DEFINITIONS,
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
    between('function selectedWaterUnits(', 'function updateCommandUI('),
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

