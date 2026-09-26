import assert from 'node:assert/strict';
import test from 'node:test';

import { cameraDepthSafePlanes, cameraTargetForZoomAnchor } from '../src/camera-controls.mjs';
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
