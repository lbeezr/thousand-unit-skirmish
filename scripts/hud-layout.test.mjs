import test from 'node:test';
import assert from 'node:assert/strict';
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
