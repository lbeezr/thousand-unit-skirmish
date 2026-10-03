import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

import { cameraDepthSafePlanes, cameraTargetForZoomAnchor, canEdgeScroll, edgeScrollDirection,
  edgeScrollCameraDelta, shouldBlockEdgeScrollForFocus } from '../src/camera-controls.mjs';
import {
  cameraArrowInputAllowed,
  cameraTargetDeltaForScreenFocus,
  createCameraArrowKeys,
  createNavigationSettings,
  DEFAULT_NAVIGATION_SETTINGS,
  fitZoomForBounds,
  mapFitZoom,
  normalizeNavigationSettings,
  NAVIGATION_SETTINGS_KEY,
} from '../src/navigation-settings.mjs';

const clientSource = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const edgeZone = Number(clientSource.match(/const CAMERA_EDGE_ZONE_PX = (\d+);/)[1]);
const edgeSpeed = Number(clientSource.match(/const CAMERA_EDGE_SPEED_PX_PER_SECOND = (\d+);/)[1]);
const edgeStart = clientSource.indexOf('  if (edgeScrollPointer && mapDefinition) {');
const edgeEnd = clientSource.indexOf('  const alpha = 1 - Math.exp(-frameDelta * 16);', edgeStart);
assert.ok(edgeStart >= 0 && edgeEnd > edgeStart, 'shipped animation edge-scroll block');
const edgeCode = clientSource.slice(edgeStart, edgeEnd);

function edgeFixture(rect, devicePixelRatio = 1, settings = { cameraSpeed: 1, edgeScrollEnabled: true }) {
  class Element { matches() { return false; } closest() { return null; } }
  const canvas = Object.assign(new Element(), { width: rect.width * devicePixelRatio, height: rect.height * devicePixelRatio,
    getBoundingClientRect: () => rect });
  const context = vm.createContext({ Element, renderer: { domElement: canvas },
    window: { devicePixelRatio }, viewport: { clientHeight: rect.height },
    document: { visibilityState: 'visible', activeElement: new Element(), elementFromPoint: () => canvas, querySelector: () => null },
    canEdgeScroll, edgeScrollDirection, edgeScrollCameraDelta, shouldBlockEdgeScrollForFocus,
    CAMERA_EDGE_ZONE_PX: edgeZone, CAMERA_EDGE_SPEED_PX_PER_SECOND: edgeSpeed,
    mapDefinition: {}, drag: null, pan: null, tapOrderArmed: false, tapOrderPointer: null, buildPlacementActive: false,
    ui: { mapStudio: { open: false } }, matchMenu: { hidden: true }, helpPanel: { hidden: true },
    scenarioBriefPanel: { hidden: true }, hudScrim: { hidden: true }, getNavigationSettings: () => settings,
    frameDelta: 0.016, baseFrustum: 43, zoom: 0.91, cameraTarget: { x: 0, z: 0 }, mapFitActive: true,
    setCamera() {},
  });
  return { context, sample(x, y, overrides = {}) {
    context.cameraTarget.x = context.cameraTarget.z = 0; context.mapFitActive = true;
    context.edgeScrollPointer = { x: rect.left + x, y: rect.top + y, pointerType: 'mouse', buttons: 0, ...overrides };
    vm.runInContext(edgeCode, context);
    return Math.hypot(context.cameraTarget.x, context.cameraTarget.z);
  } };
}

test('mouse edge-scroll band doubles from 40 to 80 CSS pixels without changing peak speed', () => {
  assert.equal(edgeZone, 80); assert.equal(edgeSpeed, 650);
});

for (const [width, height] of [[1280, 720], [800, 420], [360, 480]]) for (const dpr of [1, 2, 3]) {
  test(`shipped edge scroll uses canvas-relative CSS thresholds at ${width} × ${height}, DPR ${dpr}`, () => {
    const f = edgeFixture({ left: 137, top: 53, width, height }, dpr);
    for (const distance of [0, 39.99, 40, 40.01, 60, 79.99, 80, 80.01]) {
      for (const [x, y, axis, sign] of [[distance, height / 2, 'x', -1], [width - distance, height / 2, 'x', 1],
        [width / 2, distance, 'y', -1], [width / 2, height - distance, 'y', 1]]) {
        f.sample(x, y);
        const strength = distance < 80 ? 1 - distance / 80 : 0;
        const expected = edgeScrollCameraDelta(axis === 'x' ? strength * sign : 0, axis === 'y' ? strength * sign : 0,
          650 * 0.016, 43 / (height * 0.91));
        assert.ok(Math.abs(f.context.cameraTarget.x - expected.x) < 1e-10 && Math.abs(f.context.cameraTarget.z - expected.z) < 1e-10,
          `${axis} edge at ${distance}px keeps the configured speed/ramp`);
        assert.equal(f.context.mapFitActive, strength === 0);
      }
    }
    for (const [x, y] of [[-1, height / 2], [width + 1, height / 2], [width / 2, -1], [width / 2, height + 1], [width / 2, height / 2]]) {
      assert.equal(f.sample(x, y), 0, 'outside canvas or central pointer does not scroll');
    }
  });
}

test('edge-scroll thresholds follow a resized and repositioned canvas without using backing pixels', () => {
  const rect = { left: 90, top: 40, width: 1280, height: 720 }, f = edgeFixture(rect, 2);
  assert.ok(f.sample(1220, 360) > 0);
  Object.assign(rect, { left: 17, top: 72, width: 800, height: 420 });
  f.context.viewport.clientHeight = rect.height;
  f.context.renderer.domElement.width = 2400; f.context.renderer.domElement.height = 1260;
  const expected = edgeScrollCameraDelta(0.25, 0, 650 * 0.016, 43 / (420 * 0.91));
  f.sample(740, 210);
  assert.ok(Math.abs(f.context.cameraTarget.x - expected.x) < 1e-10 && Math.abs(f.context.cameraTarget.z - expected.z) < 1e-10);
  assert.equal(f.sample(1220, 360), 0, 'old canvas extent no longer receives edge input');
});

test('wider band preserves saved preferences and actual animation input exclusions', () => {
  const rect = { left: 90, top: 40, width: 1000, height: 600 };
  const stored = { getItem: () => JSON.stringify({ cameraSpeed: 1.6, edgeScrollEnabled: false }) };
  const disabled = createNavigationSettings(stored);
  assert.equal(edgeFixture(rect, 2, disabled.get()).sample(60, 300), 0, 'saved disabled preference wins');
  const normal = edgeFixture(rect).sample(60, 300);
  assert.ok(Math.abs(edgeFixture(rect, 2, { ...disabled.get(), edgeScrollEnabled: true }).sample(60, 300) / normal - 1.6) < 1e-12);
  for (const block of [
    f => { f.context.drag = {}; }, f => { f.context.pan = {}; }, f => { f.context.tapOrderArmed = true; },
    f => { f.context.buildPlacementActive = true; }, f => { f.context.ui.mapStudio.open = true; },
    f => { f.context.document.querySelector = () => ({}); }, f => { f.context.matchMenu.hidden = false; },
    f => { f.context.document.visibilityState = 'hidden'; },
    f => { f.context.document.activeElement.matches = () => true; },
    f => { f.context.renderer.domElement.closest = () => ({}); },
  ]) {
    const f = edgeFixture(rect); block(f); assert.equal(f.sample(60, 300), 0);
  }
  const f = edgeFixture(rect);
  assert.equal(f.sample(60, 300, { buttons: 1 }), 0);
  assert.equal(f.sample(60, 300, { pointerType: 'touch' }), 0);
});

test('camera navigation defaults are enabled and persist a clamped speed and edge-scroll preference', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const settings = createNavigationSettings(storage);
  assert.deepEqual(settings.get(), DEFAULT_NAVIGATION_SETTINGS);
  settings.set({ cameraSpeed: 2.7, edgeScrollEnabled: false });
  assert.deepEqual(settings.get(), { cameraSpeed: 2, edgeScrollEnabled: false });
  assert.deepEqual(JSON.parse(values.get(NAVIGATION_SETTINGS_KEY)), settings.get());
  assert.deepEqual(createNavigationSettings(storage).get(), settings.get());
  assert.deepEqual(normalizeNavigationSettings(null), DEFAULT_NAVIGATION_SETTINGS);
});

test('held arrow keys cancel on release or focus loss and diagonal movement stays normalized', () => {
  const keys = createCameraArrowKeys();
  keys.press('ArrowRight');
  keys.press('ArrowDown');
  assert.ok(Math.abs(keys.direction().x - Math.SQRT1_2) < 1e-9);
  assert.ok(Math.abs(keys.direction().y - Math.SQRT1_2) < 1e-9);
  keys.release('ArrowRight');
  assert.deepEqual(keys.direction(), { x: 0, y: 1 });
  keys.clear();
  assert.deepEqual(keys.pressed, []);
});

test('arrow navigation is suppressed for menus, text fields, dialogs, and modified shortcuts', () => {
  const activeGame = { key: 'ArrowLeft', mapAvailable: true, pageVisible: true };
  assert.equal(cameraArrowInputAllowed(activeGame), true);
  for (const blocked of [
    { menuOpen: true }, { editingTarget: true }, { dialogOpen: true },
    { mapStudioOpen: true }, { buildPlacement: true }, { selectionDragging: true },
    { manualPan: true }, { targetOrder: true }, { shiftKey: true }, { defaultPrevented: true },
  ]) assert.equal(cameraArrowInputAllowed({ ...activeGame, ...blocked }), false);
});

test('fit zoom fits both map dimensions and screen focus uses the matching camera target delta', () => {
  assert.equal(fitZoomForBounds({
    bounds: { left: 0, right: 1200, top: 0, bottom: 600 },
    availableWidth: 1000,
    availableHeight: 400,
    padding: 1,
  }), 2 / 3);
  assert.deepEqual(cameraTargetDeltaForScreenFocus({ x: 7, z: -2 }, { x: 4, z: 5 }), { x: 3, z: -7 });
  assert.deepEqual(cameraTargetForZoomAnchor({ x: 1, z: 2 }, { x: 4, z: 5 }, { x: 3, z: 2 }), { x: 2, z: 5 });
  assert.equal(mapFitZoom({ left: 0, right: 100, top: 0, bottom: 100 }, 1000, 1000), 2.3);
});

test('256 × 256 map corners stay inside dynamic camera clip planes at the HUD-safe target offset', () => {
  const horizontal = 0.78 / Math.hypot(0.78, 1.12, 0.78);
  const clipPlanes = cameraDepthSafePlanes({
    halfX: 128,
    halfZ: 128,
    targetX: 140,
    targetZ: -140,
    cameraOffsetX: horizontal,
    cameraOffsetZ: horizontal,
  });
  assert.ok(clipPlanes.distance - clipPlanes.extent >= 12);
  assert.ok(clipPlanes.far - clipPlanes.distance >= clipPlanes.extent + 24);
});
