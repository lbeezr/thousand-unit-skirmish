export const NAVIGATION_SETTINGS_KEY = 'thousand-unit-skirmish-navigation-settings';
export const DEFAULT_NAVIGATION_SETTINGS = Object.freeze({ cameraSpeed: 1, edgeScrollEnabled: true });

export function normalizeNavigationSettings(value = {}) {
  value = value && typeof value === 'object' ? value : {};
  const speed = Number(value.cameraSpeed);
  return {
    cameraSpeed: Number.isFinite(speed) ? Math.min(2, Math.max(0.5, speed)) : DEFAULT_NAVIGATION_SETTINGS.cameraSpeed,
    edgeScrollEnabled: typeof value.edgeScrollEnabled === 'boolean'
      ? value.edgeScrollEnabled : DEFAULT_NAVIGATION_SETTINGS.edgeScrollEnabled,
  };
}

export function createNavigationSettings(storage = undefined) {
  if (storage === undefined) {
    try { storage = globalThis.localStorage; } catch { storage = null; }
  }
  let settings = DEFAULT_NAVIGATION_SETTINGS;
  try {
    const stored = storage?.getItem(NAVIGATION_SETTINGS_KEY);
    if (stored) settings = normalizeNavigationSettings(JSON.parse(stored));
  } catch {
    // Keep working with defaults when browser storage is unavailable.
  }
  return {
    get() { return { ...settings }; },
    set(patch) {
      settings = normalizeNavigationSettings({ ...settings, ...patch });
      try { storage?.setItem(NAVIGATION_SETTINGS_KEY, JSON.stringify(settings)); } catch {}
      return { ...settings };
    },
  };
}

const sharedNavigationSettings = createNavigationSettings();
export const getNavigationSettings = () => sharedNavigationSettings.get();
export const setNavigationSettings = (patch) => sharedNavigationSettings.set(patch);

export function fitZoomForBounds({ bounds, availableWidth, availableHeight, padding = 0.92 }) {
  const width = Math.max(0, bounds.right - bounds.left);
  const height = Math.max(0, bounds.bottom - bounds.top);
  if (!width || !height || availableWidth <= 0 || availableHeight <= 0) return 0;
  return Math.min(availableWidth / width, availableHeight / height) * padding;
}

export function cameraArrowInputAllowed({
  key, altKey = false, ctrlKey = false, metaKey = false, shiftKey = false,
  defaultPrevented = false, mapAvailable = false, pageVisible = false,
  dialogOpen = false, menuOpen = false, mapStudioOpen = false,
  buildPlacement = false, selectionDragging = false, manualPan = false, targetOrder = false,
  editingTarget = false,
}) {
  return ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key)
    && !altKey && !ctrlKey && !metaKey && !shiftKey && !defaultPrevented
    && mapAvailable && pageVisible && !dialogOpen && !menuOpen && !mapStudioOpen
    && !buildPlacement && !selectionDragging && !manualPan && !targetOrder && !editingTarget;
}

export function cameraTargetDeltaForScreenFocus(pointGround, destinationGround) {
  return { x: pointGround.x - destinationGround.x, z: pointGround.z - destinationGround.z };
}

export function createCameraArrowKeys() {
  const keys = new Set();
  return {
    press(key) { if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key)) keys.add(key); },
    release(key) { keys.delete(key); },
    clear() { keys.clear(); },
    get pressed() { return [...keys]; },
    direction() {
      let x = Number(keys.has('ArrowRight')) - Number(keys.has('ArrowLeft'));
      let y = Number(keys.has('ArrowDown')) - Number(keys.has('ArrowUp'));
      const magnitude = Math.hypot(x, y) || 1;
      x /= magnitude;
      y /= magnitude;
      return { x, y };
    },
  };
}

export function mapFitZoom(bounds, availableWidth, availableHeight) {
  return Math.max(0.01, Math.min(2.3, fitZoomForBounds({ bounds, availableWidth, availableHeight })));
}

export function minimumMapZoom(bounds, availableWidth, availableHeight) {
  return Math.min(0.48, mapFitZoom(bounds, availableWidth, availableHeight));
}
