export const BUILDING_ROTATION_SETTINGS_KEY = 'thousand-unit-skirmish-building-rotation-keys';
export const DEFAULT_BUILDING_ROTATION_KEYS = Object.freeze({ left: '[', right: ']' });

// Keep camera, control groups, existing orders and browser shortcuts reserved.
export function validBuildingRotationKey(key) {
  return typeof key === 'string' && [...key].length === 1 && !/[\s\d]/u.test(key)
    && !'apfshm'.includes(key.toLowerCase());
}

export function createBuildingRotationSettings(storage = undefined) {
  if (storage === undefined) { try { storage = globalThis.localStorage; } catch { storage = null; } }
  let keys = { ...DEFAULT_BUILDING_ROTATION_KEYS };
  try {
    const saved = JSON.parse(storage?.getItem(BUILDING_ROTATION_SETTINGS_KEY) || 'null');
    if (saved && validBuildingRotationKey(saved.left) && validBuildingRotationKey(saved.right)
      && saved.left.toLowerCase() !== saved.right.toLowerCase()) keys = saved;
  } catch {}
  return { get: () => ({ ...keys }), set(next) {
    if (!validBuildingRotationKey(next.left) || !validBuildingRotationKey(next.right)
      || next.left.toLowerCase() === next.right.toLowerCase()) return false;
    keys = { left: next.left, right: next.right };
    try { storage?.setItem(BUILDING_ROTATION_SETTINGS_KEY, JSON.stringify(keys)); } catch {}
    return true;
  } };
}

export function buildingRotationKeyDirection(event, keys, { active, pending, editing, dialogOpen }) {
  if (!active || pending || editing || dialogOpen || event.defaultPrevented || event.repeat
    || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return 0;
  const key = event.key.toLowerCase();
  return key === keys.left.toLowerCase() ? 1 : key === keys.right.toLowerCase() ? -1 : 0;
}

export const buildingRotationSettings = createBuildingRotationSettings();

// Labels are ordinary DOM text, following the current English HUD. Bindings use
// event.key rather than physical key codes so other keyboard layouts work.
export function mountBuildingRotationSettings(document, settings) {
  const buttons = [...document.querySelectorAll('[data-building-rotate]')];
  const inputs = [...document.querySelectorAll('[data-building-rotation-key]')];
  const sync = () => {
    const keys = settings.get();
    for (const button of buttons) {
      const side = button.dataset.buildingRotate;
      button.textContent = `Rotate ${side} · ${keys[side]}`;
      button.setAttribute('aria-keyshortcuts', keys[side]);
    }
    for (const input of inputs) input.value = keys[input.dataset.buildingRotationKey];
  };
  for (const input of inputs) input.addEventListener('change', () => {
    const next = { ...settings.get(), [input.dataset.buildingRotationKey]: input.value };
    const valid = settings.set(next);
    input.setCustomValidity(valid ? '' : 'Choose two different single keys; camera, unit orders and number keys are reserved.');
    if (valid) { for (const other of inputs) other.setCustomValidity(''); sync(); }
    else input.reportValidity();
  });
  sync();
}

export function mountBuildingRotationControls(document, settings, turn) {
  for (const button of document.querySelectorAll('[data-building-rotate]')) {
    const side = button.dataset.buildingRotate;
    button.textContent = `Rotate ${side} · ${settings.get()[side]}`;
    button.addEventListener('click', () => turn(side === 'left' ? 1 : -1));
  }
}
