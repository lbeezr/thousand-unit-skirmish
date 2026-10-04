import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { bootGameEntry } from '../src/game-entry.mjs';
import { practiceEntryCatalog } from '../src/practice-entry-catalog.mjs';
import { mapVictoryRule } from '../src/objective-summary.mjs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const millrace = JSON.parse(readFileSync(new URL('../maps/bellweather-millrace.json', import.meta.url)));
const catalog = practiceEntryCatalog(millrace), roomId = 'R'.repeat(32);
const json = (value, status = 200) => new Response(JSON.stringify(value), { status });
const turn = () => new Promise(resolve => setImmediate(resolve));
async function menu(setup = catalog, create = () => json({ roomId })) {
  const dom = new JSDOM(html, { url: 'http://game.test/' }), posts = [], navigations = [];
  const controller = await bootGameEntry({ win: dom.window, loadGame: () => { throw new Error('Menu cannot load the renderer'); },
    navigate: url => navigations.push(url), fetchImpl: async (url, options) => {
      if (url === '/api/rooms/status') {
        const current = typeof setup === 'function' ? setup() : setup;
        return current instanceof Response ? current : json({ enabled: true, ...(current === undefined ? {} : { practiceSetup: current }) });
      }
      assert.equal(url, '/api/rooms'); posts.push(JSON.parse(options.body)); return create();
    } });
  const select = dom.window.document.querySelector('#practice-match-mode');
  return { dom, controller, posts, navigations, select, button: dom.window.document.querySelector('#menu-practice'),
    choose(value) { select.value = value; select.dispatchEvent(new dom.window.Event('change')); } };
}

test('fresh Practice capability projection preserves exact authored victory rules without terrain or player state', () => {
  const original = JSON.stringify(millrace);
  assert.equal(mapVictoryRule(catalog.map).description, mapVictoryRule(millrace).description);
  assert.deepEqual(catalog.matchModes.map(mode => mode.id), ['authored', 'objective-control', 'skirmish']);
  assert.equal(catalog.map.id, millrace.id); assert.equal(catalog.matchModeId, 'authored');
  assert.equal(Object.hasOwn(catalog.map, 'obstacles'), false); assert.equal(Object.hasOwn(catalog.map, 'resourceNodes'), false);
  assert.equal(Object.hasOwn(catalog, 'player'), false); assert.equal(JSON.stringify(millrace), original);
});

test('interrupted availability preserves an explicit Practice mode through recovery', async () => {
  let current = catalog;
  const f = await menu(() => current); f.choose('skirmish@1');
  current = json({ error: 'Offline' }, 503); await f.controller.refresh();
  assert.equal(f.select.value, 'skirmish@1'); assert.equal(f.button.disabled, true);
  current = catalog; await f.controller.refresh();
  assert.equal(f.select.value, 'skirmish@1'); assert.equal(f.button.disabled, false);
  f.button.click(); await turn();
  assert.deepEqual(f.posts, [{ mode: 'pvp', practice: true, matchModeId: 'skirmish', matchModeVersion: 1 }]);
  f.dom.window.close();
});

test('removed Practice capability blocks creation until a deliberate supported replacement', async () => {
  let current = catalog;
  const f = await menu(() => current); f.choose('skirmish@1');
  current = { ...catalog, matchModes: catalog.matchModes.filter(mode => mode.id !== 'skirmish') };
  await f.controller.refresh();
  assert.equal(f.select.value, 'skirmish@1'); assert.equal(f.button.disabled, true);
  assert.equal(f.select.disabled, false, 'a deliberate available replacement remains reachable');
  assert.match(f.dom.window.document.querySelector('[data-rule]').textContent, /chosen mode is unavailable/);
  f.button.click(); await turn(); assert.deepEqual(f.posts, []);
  f.choose('authored@1'); assert.equal(f.button.disabled, false);
  f.button.click(); await turn(); assert.deepEqual(f.posts, [{ mode: 'pvp', practice: true, matchModeId: 'authored', matchModeVersion: 1 }]);
  f.dom.window.close();
});

test('normal Practice sends the chosen complete mode pair once while creation is pending', async () => {
  let finish;
  const f = await menu(catalog, () => new Promise(resolve => { finish = resolve; }));
  f.choose('skirmish@1');
  assert.match(f.button.querySelector('span').textContent, /Skirmish.*compatible maps/);
  assert.match(f.dom.window.document.querySelector('[data-rule]').textContent, /Capture posts grant bonuses/);
  f.button.click(); f.button.click(); await turn();
  assert.deepEqual(f.posts, [{ mode: 'pvp', practice: true, matchModeId: 'skirmish', matchModeVersion: 1 }]);
  assert.equal(f.select.disabled, true); assert.deepEqual(f.navigations, []);
  finish(json({ roomId })); await turn();
  assert.equal(new URL(f.navigations[0]).searchParams.get('room'), roomId);
  assert.equal(new URL(f.navigations[0]).searchParams.has('mode'), false);
  f.dom.window.close();
});

test('authored default keeps one-click lab Practice and a previous local choice can return to it', async () => {
  const f = await menu(); f.choose('skirmish@1'); f.choose('authored@1');
  f.button.click(); await turn();
  assert.deepEqual(f.posts, [{ mode: 'pvp', practice: true, matchModeId: 'authored', matchModeVersion: 1 }]);
  assert.equal(f.navigations.length, 1); f.dom.window.close();
});

test('unknown version or a withheld default blocks Practice without blocking New Game', async () => {
  for (const setup of [{ ...catalog, matchModeVersion: 999 },
    { ...catalog, matchModes: catalog.matchModes.filter(mode => mode.id !== 'authored') }]) {
    const f = await menu(setup);
    assert.equal(f.button.disabled, true); assert.equal(f.select.disabled, true);
    assert.equal(f.dom.window.document.querySelector('#menu-new-game').disabled, false);
    f.button.click(); await turn(); assert.deepEqual(f.posts, []); f.dom.window.close();
  }
});

test('server-withheld explicit modes never become local Practice choices', async () => {
  const f = await menu({ ...catalog, matchModes: catalog.matchModes.map(mode => ({ ...mode, selectable: false })) });
  assert.deepEqual([...f.select.options].map(option => option.value), ['authored@1']);
  assert.equal(f.select.disabled, true); assert.equal(f.button.disabled, false); f.dom.window.close();
});

test('rejected creation retains the local mode for a deliberate retry', async () => {
  const f = await menu(catalog, () => json({ error: 'Room capacity reached.' }, 503));
  f.choose('objective-control@1'); f.button.click(); await turn();
  assert.deepEqual(f.navigations, []); assert.equal(f.select.value, 'objective-control@1');
  assert.equal(f.select.disabled, false); assert.match(f.dom.window.document.querySelector('#game-menu-status').textContent, /capacity/);
  f.button.click(); await turn(); assert.equal(f.posts.length, 2);
  assert.ok(f.posts.every(value => value.matchModeId === 'objective-control' && value.matchModeVersion === 1));
  f.dom.window.close();
});

test('an older server without the projection retains the existing Practice entry', async () => {
  const f = await menu(null); assert.equal(f.dom.window.document.querySelector('#practice-mode-setup').hidden, true);
  f.button.click(); await turn(); assert.deepEqual(f.posts, [{ mode: 'pvp', practice: true }]);
  assert.equal(f.navigations.length, 1); f.dom.window.close();
});

test('failed Practice creation recovers native disabled-button focus without taking another control', async () => {
  for (const moveFocus of [false, true]) {
    let finish;
    const f = await menu(catalog, () => new Promise(resolve => { finish = resolve; }));
    const doc = f.dom.window.document, settings = doc.querySelector('#menu-settings');
    f.button.focus(); f.button.click(); await turn();
    doc.body.tabIndex = -1; doc.body.focus(); // Model native disabled-control blur.
    if (moveFocus) settings.focus();
    finish(json({ error: 'Try again.' }, 503)); await turn();
    assert.equal(doc.activeElement, moveFocus ? settings : f.button);
    f.dom.window.close();
  }
});


test('Practice sends the displayed server default pair before a later default migration', async () => {
  for (const matchModeId of ['authored', 'skirmish']) {
    const f = await menu({ ...catalog, matchModeId, matchModeVersion: 1 });
    assert.equal(f.select.value, `${matchModeId}@1`); f.button.click(); await turn();
    assert.deepEqual(f.posts, [{ mode: 'pvp', practice: true, matchModeId, matchModeVersion: 1 }]);
    f.dom.window.close();
  }
});

test('Practice describes an offered Tiny map by its exact dimensions without inventing other tiers', async () => {
  const tiny = JSON.parse(readFileSync(new URL('../maps/veyrholds-terraced-vale.json', import.meta.url)));
  const setup = practiceEntryCatalog(tiny);
  setup.map.sizeTierId = 'tiny'; setup.map.sizeTierLabel = 'Tiny';
  const f = await menu(setup);
  assert.equal(f.dom.window.document.querySelector('[data-map]').textContent, `Starts on Tiny · 160 × 160 · ${tiny.name}.`);
  assert.equal(f.button.disabled, false); f.button.click(); await turn();
  assert.deepEqual(f.posts, [{ mode: 'pvp', practice: true, matchModeId: 'authored', matchModeVersion: 1 }]);
  assert.doesNotMatch(f.dom.window.document.querySelector('#practice-mode-setup').textContent, /Small|Medium|Large|XL/);
  f.dom.window.close();
});
