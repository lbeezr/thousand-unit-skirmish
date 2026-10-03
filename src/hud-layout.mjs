// Visible rectangles are shared by camera framing and resource-label occlusion.
export const HUD_SELECTOR = '.topbar, .map-label, .scenario-brief-panel, .objective-panel, .objective-summary, .minimap-panel, .minimap-reopen, .field-hint, .field-order-feedback, .control-dock, .hud-quick-access, .contextual-command-bar, .camera-toolbar, .toast, .match-result, .compass';
export function visibleHudRects(root = document) {
  return [...root.querySelectorAll(HUD_SELECTOR)].filter((element) => {
    if (element.hidden || !element.getClientRects().length) return false;
    const style = getComputedStyle(element);
    return style.visibility !== 'hidden' && Number(style.opacity) !== 0;
  }).map((element) => element.getBoundingClientRect());
}
export function hudSafeRect(bounds, obstacles, gap = 8) {
  const area = { left: bounds.left + gap, top: bounds.top + gap, right: bounds.right - gap, bottom: bounds.bottom - gap };
  const blocks = obstacles.map((r) => ({ left: Math.max(area.left, r.left - gap), right: Math.min(area.right, r.right + gap), top: Math.max(area.top, r.top - gap), bottom: Math.min(area.bottom, r.bottom + gap) })).filter((r) => r.right > r.left && r.bottom > r.top);
  const ys = [...new Set([area.top, area.bottom, ...blocks.flatMap((r) => [r.top, r.bottom])])].sort((a, b) => a - b);
  let best = { left: area.left, top: area.top, right: area.left + 1, bottom: area.top + 1, width: 1, height: 1 };
  for (let i = 0; i < ys.length - 1; i++) for (let j = i + 1; j < ys.length; j++) {
    const top = ys[i], bottom = ys[j];
    const occupied = blocks.filter((r) => r.top < bottom && r.bottom > top).sort((a, b) => a.left - b.left);
    let left = area.left;
    for (const r of [...occupied, { left: area.right, right: area.right }]) {
      const width = r.left - left, height = bottom - top;
      if (width * height > best.width * best.height) best = { left, top, right: r.left, bottom, width, height };
      left = Math.max(left, r.right);
    }
  }
  return best;
}
export function normalizeHudPreferences(value = {}) {
  return { density: value?.density === 'comfortable' ? 'comfortable' : 'compact', minimap: ['small', 'large', 'hidden'].includes(value?.minimap) ? value.minimap : 'small' };
}

export function setHudActionAvailability(button, unavailable, inspectable = false) {
  // Keep contextual costs and block reasons reachable without moving focus.
  button.disabled = unavailable && !inspectable;
  if (inspectable) button.setAttribute('aria-disabled', String(unavailable));
  else button.removeAttribute('aria-disabled');
}

export function isHudActionUnavailable(button) {
  return button.disabled || button.getAttribute('aria-disabled') === 'true';
}
