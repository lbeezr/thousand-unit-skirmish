import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { hudSafeRect, normalizeHudPreferences } from '../src/hud-layout.mjs';
const bounds = { left: 0, top: 0, right: 1280, bottom: 720 };
test('closed and expanded HUD use actual visible rectangles without overlaps', () => {
  const header = { left: 0, top: 0, right: 1280, bottom: 54 };
  const bar = { left: 16, top: 650, right: 420, bottom: 706 };
  const map = { left: 1094, top: 490, right: 1264, bottom: 706 };
  const compact = hudSafeRect(bounds, [header, bar, map]);
  const detail = { left: 16, top: 300, right: 596, bottom: 644 };
  const expanded = hudSafeRect(bounds, [header, bar, map, detail]);
  assert.ok(compact.width * compact.height > expanded.width * expanded.height);
  for (const rect of [header, bar, map, detail]) assert.ok(expanded.right <= rect.left || expanded.left >= rect.right || expanded.bottom <= rect.top || expanded.top >= rect.bottom);
  assert.deepEqual(hudSafeRect(bounds, [header, bar, map]), compact, 'closing restores geometry without cached panel bounds');
});
test('offset fullscreen/resize bounds remain within the renderer', () => {
  const viewport = { left: 100, top: 60, right: 944, bottom: 450 };
  const safe = hudSafeRect(viewport, [{ left: 100, right: 944, top: 60, bottom: 114 }]);
  assert.ok(safe.left >= 100 && safe.right <= 944 && safe.top >= 114 && safe.bottom <= 450);
  assert.ok(safe.width > 0 && safe.height > 0);
});
test('preferences accept only supported presentation values', () => {
  assert.deepEqual(normalizeHudPreferences(null), { density: 'compact', minimap: 'small' });
  assert.deepEqual(normalizeHudPreferences({ density: 'comfortable', minimap: 'hidden', selection: 22 }), { density: 'comfortable', minimap: 'hidden' });
});

function minimapKeyboardFixture() {
  const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const dom = new JSDOM(html, { runScripts: 'outside-only' });
  const w = dom.window;
  const between = (start, end) => {
    const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
    assert.ok(a >= 0 && b > a, `client source bounds: ${start}`);
    return source.slice(a, b);
  };
  // Exercise shipped DOM/key/resize routing; WebGL geometry and layout are stubbed.
  Object.assign(w, {
    minimapCanvas: w.document.querySelector('#minimap-canvas'),
    MAP_WIDTH: 64, MAP_HEIGHT: 64, cameraTarget: { x: 0, z: 0 },
    mapDefinition: {}, mapFitActive: true, zoom: 0.48, baseFrustum: 80,
    viewport: { clientWidth: 1280, clientHeight: 720 },
    camera: { updateProjectionMatrix() {} }, renderer: { setSize() {} },
    fitCalls: 0, setCamera() {}, drawMinimap() {}, getMapFitZoom: () => 0.3,
    resizeResourceCallouts() {}, updateResourceNodeCallouts() {},
    fitMapToViewport() { w.fitCalls++; w.cameraTarget.x = w.cameraTarget.z = 0; },
  });
  w.eval(between("minimapCanvas.addEventListener('keydown'", 'function selectWholeTeam('));
  w.eval(between('function resize()', 'function addMapObject('));
  w.minimapCanvas.focus();
  return { w, dom, key(key, repeat = false) {
    const event = new w.KeyboardEvent('keydown', { key, repeat, bubbles: true, cancelable: true });
    w.minimapCanvas.dispatchEvent(event);
    return event;
  } };
}

for (const [key, axis, direction] of [
  ['ArrowLeft', 'x', -1], ['ArrowRight', 'x', 1], ['ArrowUp', 'z', -1], ['ArrowDown', 'z', 1],
]) test(`tactical map ${key} leaves automatic fit and retains its manual view on resize`, t => {
  const f = minimapKeyboardFixture(); t.after(() => f.dom.window.close());
  assert.equal(f.w.document.activeElement, f.w.minimapCanvas);
  assert.equal(f.key(key).defaultPrevented, true);
  assert.equal(f.key(key, true).defaultPrevented, true, 'held arrows still pan');
  assert.equal(f.w.cameraTarget[axis], direction * 3.2);
  f.w.viewport.clientWidth = 900; f.w.viewport.clientHeight = 600;
  f.w.resize();
  assert.equal(f.w.fitCalls, 0, 'resize must not replace a manually chosen viewpoint');
  assert.equal(f.w.cameraTarget[axis], direction * 3.2);
});

test('unhandled tactical-map keys retain automatic fit on resize', t => {
  const f = minimapKeyboardFixture(); t.after(() => f.dom.window.close());
  for (const key of ['Tab', 'Enter', 'Escape', '+']) assert.equal(f.key(key).defaultPrevented, false);
  f.w.resize();
  assert.equal(f.w.fitCalls, 1, 'Fit map remains responsive until actual navigation');
});

test('manual tactical-map navigation retains resize zoom limits without recentering', t => {
  const f = minimapKeyboardFixture(); t.after(() => f.dom.window.close());
  f.key('ArrowRight');
  f.w.zoom = 0.1; f.w.getMapFitZoom = () => 0.4;
  f.w.resize();
  assert.equal(f.w.fitCalls, 0);
  assert.equal(f.w.cameraTarget.x, 1.6);
  assert.equal(f.w.zoom, 0.4); assert.equal(f.w.camera.zoom, 0.4);
});
