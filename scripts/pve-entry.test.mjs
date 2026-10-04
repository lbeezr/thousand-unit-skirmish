import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { mountPveEntry } from '../src/pve-entry.mjs';

const json = (value, status = 200) => new Response(JSON.stringify(value), { status });
const turn = () => new Promise(resolve => setImmediate(resolve));

test('fresh AI controls use published capability without changing an existing legacy AI run', async () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const mode of ['human', 'legacy-ai']) for (const available of [false, true]) {
    const dom = new JSDOM(html, { url: `https://game.test/?room=${'R'.repeat(32)}${mode === 'legacy-ai' ? '&mode=pve&mapSeed=1&policySeed=2' : ''}` });
    const requests = [], navigations = [], pending = new Map();
    const capability = { available, reason: 'Fresh AI maintenance.', mapId: 'veyrholds-terraced-vale',
      matchModeId: 'skirmish', matchModeVersion: 1 };
    mountPveEntry({ win: dom.window, navigate: url => navigations.push(url), fetchImpl: (url, options) => {
      requests.push({ url, options }); return new Promise(resolve => pending.set(url, resolve));
    } });
    pending.get('/api/rooms/status')(json({ enabled: true, ordinarySetup: { pve: capability } })); await turn();
    const start = dom.window.document.querySelector('#pve-start'), next = dom.window.document.querySelector('#pve-new-map');
    const button = mode === 'human' ? start : next;
    assert.equal(button.hidden, false); assert.equal(button.disabled, !available);
    assert.equal(next.textContent, 'NEW GAME');
    if (!available) {
      assert.match(button.title, /maintenance/); button.dispatchEvent(new dom.window.Event('click')); await turn();
      assert.equal(requests.filter(row => row.options?.method === 'POST').length, 0);
    } else {
      button.click(); button.click(); assert.equal(requests.filter(row => row.options?.method === 'POST').length, 1);
      assert.deepEqual(JSON.parse(requests.at(-1).options.body), { mode: 'pve' });
    }
    // A late room response must preserve both the actual run and pending creation.
    pending.get(`/api/rooms/${'R'.repeat(32)}`)(json(mode === 'legacy-ai'
      ? { launchOptions: { mode: 'pve', mapSeed: 1, policySeed: 2 }, mapId: 'bellweather-millrace' }
      : { launchOptions: { mode: 'pvp' } })); await turn();
    assert.equal(button.disabled, true);
    assert.equal(dom.window.document.querySelector('.pve-run-stamp').hidden, mode !== 'legacy-ai');
    if (mode === 'legacy-ai') assert.match(dom.window.document.querySelector('.pve-run-map-seed').textContent, /MAP SEED 1$/);
    if (available) {
      button.dispatchEvent(new dom.window.Event('click')); start.dispatchEvent(new dom.window.Event('click'));
      assert.equal(requests.filter(row => row.options?.method === 'POST').length, 1);
      pending.get('/api/rooms')(json({ error: 'Capacity reached.' }, 503)); await turn();
      assert.equal(button.disabled, false); assert.match(dom.window.document.querySelector('#pve-entry-status').textContent, /CAPACITY/);
      button.click(); assert.equal(requests.filter(row => row.options?.method === 'POST').length, 2);
      pending.get('/api/rooms')(json({ roomId: 'N'.repeat(32), launchOptions: { mode: 'pve', mapSeed: 12, policySeed: 34 } }));
      await turn(); assert.equal(navigations.length, 1);
      assert.equal(new URL(navigations[0]).searchParams.get('room'), 'N'.repeat(32));
    }
    dom.window.close();
  }
});

// Model reflected attributes like the browser: assigning the same value still
// queues a mutation. Drain in bounded batches so a regression fails, not hangs.
function createDom() {
  const observers = [];
  class Element {
    constructor(parent = null) {
      this.parent = parent;
      this.attributes = new Map();
      this.dataset = {};
      this.classList = { toggle() {} };
    }
    setAttribute(name, value) {
      this.attributes.set(name, String(value));
      for (const observer of observers) {
        if (!observer.options.attributeFilter.includes(name)) continue;
        for (let node = this; node; node = node.parent) {
          if (node === observer.target) { observer.pending = true; break; }
          if (!observer.options.subtree) break;
        }
      }
    }
    get hidden() { return this.attributes.has('hidden'); }
    set hidden(value) { this.setBoolean('hidden', value); }
    get disabled() { return this.attributes.has('disabled'); }
    set disabled(value) { this.setBoolean('disabled', value); }
    setBoolean(name, value) {
      if (value) this.setAttribute(name, '');
      else if (this.attributes.has(name)) {
        this.setAttribute(name, '');
        this.attributes.delete(name);
      }
    }
    append(...children) { for (const child of children) child.parent = this; }
    insertBefore(child) { child.parent = this; }
    querySelector() { return null; }
    addEventListener() {}
  }
  const actions = new Element();
  const army = new Element();
  const create = new Element(actions);
  const join = new Element(actions);
  const buttons = [new Element(army), new Element(army)];
  const nodes = new Map([
    ['.room-actions', actions], ['.map-label', new Element()],
    ['.army-section', army], ['#room-create', create], ['#room-join', join],
  ]);
  const document = {
    readyState: 'complete', head: new Element(),
    createElement: () => new Element(),
    querySelector: (selector) => nodes.get(selector) ?? null,
    querySelectorAll: (selector) => selector === '.size-options button' ? buttons : [],
  };
  class MutationObserver {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe(target, options) { this.target = target; this.options = options; }
  }
  function drain() {
    for (let batch = 0; batch < 10; batch++) {
      const pending = observers.filter((observer) => observer.pending);
      if (!pending.length) return;
      for (const observer of pending) observer.pending = false;
      for (const observer of pending) observer.callback();
    }
    assert.fail('PvE attribute observers never settle; browser rendering would freeze');
  }
  return { document, MutationObserver, buttons, create, join, drain };
}

test('PvE entry settles after room status and host UI updates', async () => {
  const dom = createDom();
  const original = { window: globalThis.window, MutationObserver: globalThis.MutationObserver, fetch: globalThis.fetch };
  const pending = new Map();
  try {
    globalThis.window = {
      document: dom.document,
      location: { href: 'https://example.test/?room=MvoKZsCl2NbYDljdz914uMtfH8b373XE&mode=pve&mapSeed=1189641871&policySeed=2978533755' },
    };
    globalThis.MutationObserver = dom.MutationObserver;
    globalThis.fetch = (url) => new Promise((resolve) => pending.set(url, resolve));
    mountPveEntry();
    assert.ok(dom.buttons.every((button) => button.disabled));
    assert.ok(dom.create.hidden && dom.join.hidden);

    // Both asynchronous responses reapply the PvE state after observers mount.
    for (const [url, resolve] of pending) {
      resolve({ ok: true, json: async () => url.endsWith('/status')
        ? { enabled: true }
        : { mode: 'pve', mapSeed: 1189641871, policySeed: 2978533755 } });
      await new Promise((done) => setImmediate(done));
      dom.drain();
    }

    // Ordinary host/connection UI writes must be corrected, then settle.
    dom.buttons[0].disabled = false;
    dom.create.hidden = false;
    dom.join.hidden = false;
    dom.drain();
    assert.ok(dom.buttons.every((button) => button.disabled));
    assert.ok(dom.create.hidden && dom.join.hidden);

    // Repeated writes from another UI owner also must not create a loop.
    dom.buttons[1].disabled = true;
    dom.create.hidden = true;
    dom.drain();
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  }
});

test('actual author CSS hides fixed AI map/Studio controls and preserves Practice controls', async () => {
  const original = { window: globalThis.window, MutationObserver: globalThis.MutationObserver, fetch: globalThis.fetch };
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
  try {
    for (const mode of ['pve', 'practice']) {
      const dom = new JSDOM(html, { url: `https://game.test/?room=${'R'.repeat(32)}${mode === 'pve' ? '&mode=pve&mapSeed=1&policySeed=2' : ''}` });
      const sheet = dom.window.document.createElement('style'); sheet.textContent = styles; dom.window.document.head.append(sheet);
      globalThis.window = dom.window;
      globalThis.MutationObserver = dom.window.MutationObserver;
      globalThis.fetch = async url => ({ ok: true, json: async () => url.endsWith('/status') ? { enabled: true }
        : { launchOptions: mode === 'pve' ? { mode: 'pve', mapSeed: 1, policySeed: 2 } : { mode: 'pvp', practice: true } } });
      const { mountPveEntry } = await import('../src/pve-entry.mjs'); mountPveEntry();
      await new Promise(resolve => setImmediate(resolve));
      const picker = dom.window.document.querySelector('.map-picker');
      const studio = dom.window.document.querySelector('#map-studio-open');
      assert.equal(picker.hidden, mode === 'pve');
      assert.equal(studio.hidden, mode === 'pve');
      assert.equal(dom.window.getComputedStyle(picker).display, mode === 'pve' ? 'none' : 'flex');
      assert.equal(dom.window.getComputedStyle(studio).display === 'none', mode === 'pve');
      dom.window.close();
    }
  } finally { Object.assign(globalThis, original); }
});
