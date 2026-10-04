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

export function bindContextualCommandStrip(strip) {
  if (!strip) return () => {};
  const view = strip.ownerDocument.defaultView;
  let frame = 0, pendingButton = null, disposed = false;
  let buttons = new Set(strip.querySelectorAll('button'));
  const layoutSelector = 'button, [data-command-layout]';
  let observed = new Set(strip.querySelectorAll(layoutSelector));
  const reveal = button => {
    if (disposed || !strip.contains(button) || button.closest('[hidden]') || button.disabled
      || strip.clientWidth <= 0 || strip.scrollWidth <= strip.clientWidth) return;
    const viewport = strip.getBoundingClientRect();
    const left = viewport.left + strip.clientLeft;
    const right = Math.min(viewport.right, left + strip.clientWidth);
    const bounds = button.getBoundingClientRect();
    const oversized = bounds.width > right - left;
    const start = bounds.left - left, end = bounds.right - right;
    const rounded = end > 0 ? Math.ceil(end) : Math.floor(Math.min(0, start));
    // A near-fit button must not overshoot and clip its opposite edge on recheck.
    const delta = oversized ? Math.floor(start) : Math.max(end, Math.min(start, rounded));
    if (delta) strip.scrollLeft += delta;
  };
  const scheduleReveal = button => {
    if (disposed || !button?.matches('button') || !strip.contains(button)) return;
    pendingButton = button;
    if (frame) return;
    frame = view.requestAnimationFrame(() => {
      frame = 0;
      const button = pendingButton; pendingButton = null;
      if (!disposed && strip.ownerDocument.activeElement === button) reveal(button);
    });
  };
  const focus = event => {
    const button = event.target.closest?.('button');
    if (!button || !strip.contains(button) || strip.clientWidth <= 0) return;
    reveal(button);
    // Recheck after the browser's own focus scrolling; never move a later focus.
    scheduleReveal(button);
  };
  const wheel = event => {
    if (!event.shiftKey || event.ctrlKey || event.metaKey || !event.cancelable
      || event.defaultPrevented || event.deltaX
      || !event.deltaY || strip.clientWidth <= 0 || strip.scrollWidth <= strip.clientWidth) return;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? strip.clientWidth : 1;
    strip.scrollLeft += event.deltaY * unit;
    event.preventDefault();
  };
  const measureLayout = () => {
    const viewport = strip.getBoundingClientRect(), left = viewport.left + strip.clientLeft;
    const boxes = new Map();
    for (const button of buttons) {
      const bounds = button.getBoundingClientRect();
      if (bounds.width > 0) {
        // Content coordinates stay constant when the player scrolls manually.
        boxes.set(button, [bounds.left - left + strip.scrollLeft, bounds.width]);
      }
    }
    return { width: Math.min(viewport.right - left, strip.clientWidth), boxes };
  };
  let layout = measureLayout();
  const layoutChanged = () => {
    if (disposed) return;
    const next = measureLayout();
    const changed = Math.abs(next.width - layout.width) > .001 || next.boxes.size !== layout.boxes.size
      || [...next.boxes].some(([button, box]) => {
        const prior = layout.boxes.get(button);
        return !prior || box.some((value, index) => Math.abs(value - prior[index]) > .001);
      });
    layout = next;
    if (changed) scheduleReveal(strip.ownerDocument.activeElement);
  };
  const resizeObserver = new view.ResizeObserver(layoutChanged);
  // Labelled groups can shift their buttons while individual button sizes stay
  // fixed. Only marked layout containers add observation beyond the controls.
  for (const element of [strip, ...observed]) resizeObserver.observe(element);
  const mutationObserver = new view.MutationObserver(records => {
    if (disposed || !records.some(record => record.type === 'childList'
      && [...record.addedNodes, ...record.removedNodes].some(node => node.nodeType === 1
        && (node.matches(layoutSelector) || node.querySelector(layoutSelector))))) return;
    const current = new Set(strip.querySelectorAll(layoutSelector));
    for (const element of observed) if (!current.has(element)) resizeObserver.unobserve(element);
    for (const element of current) if (!observed.has(element)) resizeObserver.observe(element);
    observed = current;
    buttons = new Set(strip.querySelectorAll('button'));
    layoutChanged();
  });
  mutationObserver.observe(strip, { childList: true, subtree: true });
  strip.addEventListener('focusin', focus);
  strip.addEventListener('wheel', wheel, { passive: false });
  return () => {
    disposed = true;
    strip.removeEventListener('focusin', focus);
    strip.removeEventListener('wheel', wheel);
    resizeObserver.disconnect(); mutationObserver.disconnect();
    if (frame) view.cancelAnimationFrame(frame);
    frame = 0; pendingButton = null; buttons.clear(); observed.clear(); layout = null;
  };
}
