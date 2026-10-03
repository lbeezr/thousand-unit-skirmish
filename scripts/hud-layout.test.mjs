import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { hudSafeRect, normalizeHudPreferences, bindContextualCommandStrip } from '../src/hud-layout.mjs';
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

function commandStripFixture(t, width = 750) {
  const dom = new JSDOM('<div id="strip"><button id="first">Idle workers</button><span><button id="last">Formation / route</button></span></div><button id="outside">Outside</button>');
  t.after(() => dom.window.close());
  const { document } = dom.window;
  const strip = document.querySelector('#strip');
  const first = document.querySelector('#first'), last = document.querySelector('#last');
  const frames = new Map(); let nextFrame = 1, scroll = 0;
  dom.window.requestAnimationFrame = callback => { const id = nextFrame++; frames.set(id, callback); return id; };
  dom.window.cancelAnimationFrame = id => frames.delete(id);
  Object.defineProperties(strip, {
    clientWidth: { configurable: true, value: width }, clientLeft: { value: 0 },
    scrollWidth: { configurable: true, value: width + 300 },
    scrollLeft: { get: () => scroll, set: value => { scroll = Math.max(0, Math.min(300, value)); } },
  });
  strip.getBoundingClientRect = () => ({ left: 320, right: 320 + width, width });
  first.getBoundingClientRect = () => ({ left: 320 - scroll, right: 400 - scroll, width: 80 });
  last.getBoundingClientRect = () => ({ left: 913.0625 - scroll, right: 1093.0625 - scroll, width: 180 });
  const unbind = bindContextualCommandStrip(strip); t.after(unbind);
  return { dom, strip, first, last, unbind, frame() {
    const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback());
  }, wheel(options = {}) {
    const event = new dom.window.WheelEvent('wheel', { bubbles: true, cancelable: true, shiftKey: true, deltaY: 30, ...options });
    strip.dispatchEvent(event); return event;
  } };
}

test('focused Formation reveals the complete native-reported 23.0625px overflow', t => {
  const f = commandStripFixture(t);
  f.last.focus();
  assert.equal(f.dom.window.document.activeElement, f.last);
  assert.equal(f.strip.scrollLeft, 24);
  assert.ok(f.last.getBoundingClientRect().right <= f.strip.getBoundingClientRect().right);
  f.strip.scrollLeft = 0; f.frame(); // Simulate browser focus scrolling after focusin.
  assert.equal(f.strip.scrollLeft, 24);
  f.first.focus(); f.frame();
  assert.equal(f.strip.scrollLeft, 0, 'reverse traversal reveals the leading command');
});

test('deferred reveal preserves later focus and ignores a hidden selection bar', t => {
  const f = commandStripFixture(t);
  f.last.focus(); f.strip.scrollLeft = 100;
  f.dom.window.document.querySelector('#outside').focus(); f.frame();
  assert.equal(f.strip.scrollLeft, 100);
  f.last.focus(); f.strip.hidden = true; f.strip.scrollLeft = 0; f.frame();
  assert.equal(f.strip.scrollLeft, 0);
});

test('already visible commands do not move and oversized commands reveal their start', t => {
  const f = commandStripFixture(t);
  f.first.focus(); f.frame(); assert.equal(f.strip.scrollLeft, 0);
  Object.defineProperty(f.strip, 'clientWidth', { value: 120 });
  f.strip.getBoundingClientRect = () => ({ left: 320, right: 440, width: 120 });
  f.last.getBoundingClientRect = () => ({ left: 350.0625 - f.strip.scrollLeft, right: 530.0625 - f.strip.scrollLeft, width: 180 });
  f.last.focus(); f.frame();
  assert.equal(f.strip.scrollLeft, 30, 'oversized commands keep their leading edge inside without oscillation');
  assert.ok(f.last.getBoundingClientRect().left >= 320 && f.last.getBoundingClientRect().left < 321);
});

for (const width of [750, 749.5]) test(`a ${width}px near-fit command stays fully revealed without fractional oscillation`, t => {
  const f = commandStripFixture(t);
  f.last.getBoundingClientRect = () => ({ left: 320.6 - f.strip.scrollLeft, right: 320.6 + width - f.strip.scrollLeft, width });
  f.last.focus();
  const offset = f.strip.scrollLeft;
  assert.ok(offset > 0 && offset < 1);
  f.frame();
  assert.equal(f.strip.scrollLeft, offset, 'the deferred recheck must not reverse the correction');
  assert.ok(f.last.getBoundingClientRect().left >= 320);
  assert.ok(f.last.getBoundingClientRect().right <= 1070);
});

for (const [mode, delta, expected] of [[0, 30, 30], [1, 2, 32], [2, 1, 300]]) {
  test(`Shift vertical wheel scrolls only the command strip (deltaMode ${mode})`, t => {
    const f = commandStripFixture(t);
    assert.equal(f.wheel({ deltaMode: mode, deltaY: delta }).defaultPrevented, true);
    assert.equal(f.strip.scrollLeft, expected);
    assert.equal(f.dom.window.document.activeElement, f.dom.window.document.body);
    assert.equal(f.wheel({ deltaMode: 0, deltaY: -1000 }).defaultPrevented, true);
    assert.equal(f.strip.scrollLeft, 0);
    assert.equal(f.wheel({ deltaY: -30 }).defaultPrevented, true, 'edge input does not scroll an ancestor');
  });
}

test('native horizontal wheels, ordinary wheels, zoom and nonoverflow remain native', t => {
  const f = commandStripFixture(t);
  for (const options of [{ deltaX: 20 }, { shiftKey: false }, { ctrlKey: true }, { metaKey: true }, { cancelable: false }, { deltaY: 0 }]) {
    assert.equal(f.wheel(options).defaultPrevented, false);
    assert.equal(f.strip.scrollLeft, 0);
  }
  Object.defineProperty(f.strip, 'scrollWidth', { value: f.strip.clientWidth });
  assert.equal(f.wheel().defaultPrevented, false);
});

test('disposing the strip cancels pending reveal and leaves wheel input native', t => {
  const f = commandStripFixture(t);
  f.last.focus(); f.strip.scrollLeft = 0; f.unbind(); f.frame();
  assert.equal(f.strip.scrollLeft, 0);
  assert.equal(f.wheel().defaultPrevented, false);
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

function responsiveHudFixture(width, height) {
  const dom = new JSDOM(readFileSync(new URL('../index.html', import.meta.url), 'utf8'), {
    runScripts: 'outside-only', url: 'http://localhost/',
  });
  const w = dom.window, d = w.document, style = d.createElement('style');
  style.textContent = readFileSync(new URL('../style.css', import.meta.url), 'utf8'); d.head.append(style);
  const activeRules = rules => [...rules].flatMap(rule => {
    if (rule.type === 1) return [rule];
    if (rule.type !== 4) return [];
    const conditions = [...rule.conditionText.matchAll(/\((min|max)-(width|height):\s*(\d+)px\)/g)];
    // These geometry checks use size media queries; pointer-specific targets are separate.
    return conditions.length && conditions.every(([, limit, axis, n]) => limit === 'min'
      ? { width, height }[axis] >= Number(n) : { width, height }[axis] <= Number(n)) ? activeRules(rule.cssRules) : [];
  });
  const rules = activeRules(style.sheet.cssRules);
  function declaration(element, property) {
    if (element.style.getPropertyValue(property)) return element.style.getPropertyValue(property);
    let value = '', priority = -1;
    for (const rule of rules) for (const selector of rule.selectorText.split(',')) {
      const candidate = rule.style.getPropertyValue(property);
      if (!candidate || !element.matches(selector.trim())) continue;
      // :has() takes its simple class argument's specificity. Reject other
      // functions rather than pretending jsdom supplies a browser layout/cascade.
      const weightedSelector = selector.replace(/:has\((\.[\w-]+)\)/g, ' $1');
      assert.doesNotMatch(weightedSelector, /[():]/, `geometry selector: ${selector}`);
      const attributes = (weightedSelector.match(/\[[^\]]+\]/g) || []).length;
      const plain = weightedSelector.replace(/\[[^\]]+\]/g, '');
      const weight = (plain.match(/#[\w-]+/g) || []).length * 10000
        + ((plain.match(/\.[\w-]+/g) || []).length + attributes) * 100
        + plain.split(/[\s>+~]+/).filter(part => /^[a-z]/i.test(part)).length
        + (rule.style.getPropertyPriority(property) === 'important' ? 1000000 : 0);
      if (weight >= priority) { priority = weight; value = candidate; }
    }
    return value || (property.startsWith('--') && element.parentElement ? declaration(element.parentElement, property) : '');
  }
  function pixels(element, property) {
    const expand = value => value.replace(/var\((--[\w-]+)\)/g, (_, token) => expand(declaration(element, token)));
    const expression = expand(declaration(element, property))
      .replace(/([\d.]+)(px|vw|dvh|%)/g, (_, n, unit) => String(Number(n) * (unit === 'px' ? 1 : unit === 'dvh' ? height / 100 : width / 100)))
      .replace(/calc\(/g, '(').replace(/min\(/g, 'Math.min(');
    assert.ok(expression.length && /^[\d\s.+\-*/(),]*$/.test(expression.replaceAll('Math.min', '')), `supported CSS length: ${expression}`);
    const value = Function(`return (${expression});`)();
    assert.ok(Number.isFinite(value)); return value;
  }
  const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  Object.assign(w, { appShell: d.querySelector('.app-shell'), normalizeHudPreferences });
  w.eval(source.slice(source.indexOf('let hudPreferences;'), source.indexOf('function syncFullscreenToggle(')));
  const workspace = d.querySelector('.workspace'), bar = d.querySelector('.contextual-command-bar');
  workspace.style.setProperty('--context-bar-height', '128px');
  bar.hidden = false; d.querySelector('.hud-quick-access').hidden = true;
  return { dom, d, pixels, bar, map: d.querySelector('.minimap-panel') };
}

for (const [width, height] of [[1280, 800], [1280, 720], [800, 640], [621, 640], [800, 420], [620, 640], [360, 480]]) {
  test(`compact selection bar clears small/large map at ${width} × ${height}`, t => {
    const f = responsiveHudFixture(width, height); t.after(() => f.dom.window.close());
    for (const size of ['small', 'large', 'small']) {
      assert.equal(f.d.querySelector('.app-shell').dataset.minimapSize, size);
      const barRight = f.pixels(f.bar, 'left') + f.pixels(f.bar, 'max-width');
      const mapLeft = width - f.pixels(f.map, 'right') - f.pixels(f.map, 'width');
      assert.ok(barRight <= width, 'the full command width stays inside the viewport');
      if (width > 620) assert.ok(mapLeft - barRight >= 8, `${size} map must clear the bar's width cap: gap ${mapLeft - barRight}px`);
      else assert.ok(f.pixels(f.map, 'bottom') - (f.pixels(f.bar, 'bottom') + f.pixels(f.bar, 'max-height')) >= 8,
        'narrow layouts stack the map above the observed bar height');
      if (width > 620 && width <= 920) {
        const quick = f.d.querySelector('.hud-quick-access');
        assert.ok(mapLeft - (f.pixels(quick, 'left') + f.pixels(quick, 'max-width')) >= 8,
          'empty-selection Quick commands use the same current map width');
      }
      f.d.querySelector('#minimap-size-toggle').click();
    }
  });
}
