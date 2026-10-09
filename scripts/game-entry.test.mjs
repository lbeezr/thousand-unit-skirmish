import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { bootGameEntry } from '../src/game-entry.mjs';
import { isGameEntry, savedRoomSession, LAST_ROOM_STORAGE_KEY, SESSION_STORAGE_PREFIX } from '../src/game-entry-session.mjs';
import { practiceEntryCatalog } from '../src/world/practice-entry-catalog.mjs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const room = 'R'.repeat(32), token = 'T'.repeat(43);
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
const turn = () => new Promise(resolve => setImmediate(resolve));

test('New Game follows the published AI capability through refresh while Resume and human entry remain available', async () => {
  const tiny = JSON.parse(readFileSync(new URL('../maps/veyrholds-terraced-vale.json', import.meta.url)));
  let capability = { available: false, reason: 'AI is unavailable during maintenance.' };
  const f = await fixture({ stored: { [LAST_ROOM_STORAGE_KEY]: room, [`${SESSION_STORAGE_PREFIX}${room}`]: token },
    handler: (url, options) => json(url === '/api/rooms/status' ? { enabled: true,
      ordinarySetup: { pve: capability }, practiceSetup: practiceEntryCatalog(tiny) }
      : options?.method === 'POST' ? { roomId: room, launchOptions: { mode: 'pve', mapSeed: 12, policySeed: 34 } }
        : { valid: true }) });
  const button = f.node('menu-new-game');
  assert.equal(button.hidden, false); assert.equal(button.disabled, true);
  assert.match(button.querySelector('span').textContent, /maintenance/);
  assert.equal(f.win.document.activeElement, f.node('menu-practice'));
  assert.equal(f.node('menu-resume').disabled, false); assert.equal(f.node('menu-create-room').disabled, false);
  button.dispatchEvent(new f.win.Event('click')); await turn();
  assert.equal(f.requests.filter(row => row.options?.method === 'POST').length, 0);
  capability = { available: true, mapId: tiny.id, matchModeId: 'skirmish', matchModeVersion: 1 };
  await f.controller.refresh();
  assert.equal(button.disabled, false);
  assert.match(button.querySelector('span').textContent, /Play vs AI · Skirmish · Tiny · 160 × 160 · Veyrhold/);
  assert.doesNotMatch(button.textContent, /Millrace|Rootways|Small|Bannerfall/);
  button.click(); button.click(); await turn();
  assert.equal(f.requests.filter(row => row.options?.method === 'POST').length, 1);
  assert.deepEqual(JSON.parse(f.requests.at(-1).options.body), { mode: 'pve' });
  assert.equal(f.navigations.length, 1);
  capability = { available: false, reason: 'AI temporarily offline.' }; await f.controller.refresh();
  assert.equal(button.disabled, true); assert.equal(f.node('menu-resume').disabled, false);
  f.node('menu-resume').click(); await turn();
  assert.equal(new URL(f.navigations.at(-1)).searchParams.get('resume'), '1');
  f.win.close();
});
async function fixture({ url = 'http://game.test/', stored = {}, handler } = {}) {
  const dom = new JSDOM(html, { url }), win = dom.window;
  for (const [key, value] of Object.entries(stored)) win.sessionStorage.setItem(key, value);
  const requests = [], navigations = [], loaded = [];
  for (const dialog of win.document.querySelectorAll('dialog')) {
    dialog.showModal = () => { dialog.open = true; };
    dialog.close = () => { dialog.open = false; setImmediate(() => dialog.dispatchEvent(new win.Event('close'))); };
  }
  win.markPrototypeReady = () => { win.document.documentElement.dataset.boot = 'ready'; };
  const controller = await bootGameEntry({ win, loadGame: async () => loaded.push(true), navigate: value => navigations.push(value),
    fetchImpl: async (path, options) => {
      requests.push({ path, options });
      return handler ? handler(path, options) : json({ enabled: true, ordinarySetup: { pve: { available: true } } });
    } });
  return { win, controller, requests, navigations, loaded, node: id => win.document.getElementById(id) };
}

test('root entry is a menu; invites, explicit resume and authored render links remain deliberate game routes', () => {
  assert.equal(isGameEntry('http://game.test/'), false);
  assert.equal(isGameEntry('http://game.test/?utm_source=friend'), false);
  for (const query of [`room=${room}`, 'room=bad', 'resume=1', 'play=1', 'humanRosterPreview=1', 'rendererCapture=environment-state']) {
    assert.equal(isGameEntry(`http://game.test/?${query}`), true);
  }
  const doc = new JSDOM(html).window.document;
  assert.deepEqual([...doc.querySelectorAll('script[type=module][src]')].map(node => node.getAttribute('src')), ['./src/game-entry.mjs']);
});

test('a fresh profile never loads the renderer or joins the shared battlefield', async () => {
  const f = await fixture();
  assert.equal(f.win.document.documentElement.dataset.entry, 'menu');
  assert.equal(f.win.document.documentElement.dataset.boot, 'ready');
  assert.deepEqual(f.loaded, []);
  assert.deepEqual(f.requests.map(row => row.path), ['/api/rooms/status']);
  assert.equal(f.node('menu-resume').hidden, true);
  assert.equal(f.win.document.activeElement, f.node('menu-new-game'));
});

test('stale profiles retain saved bytes and hide unconfirmed Resume without joining', async () => {
  const f = await fixture({ stored: { [`${SESSION_STORAGE_PREFIX}default`]: token },
    handler: path => json(path === '/api/rooms/status' ? { enabled: true, ordinarySetup: { pve: { available: true } } } : { valid: false }) });
  assert.deepEqual(f.loaded, []); assert.deepEqual(f.navigations, []);
  assert.equal(f.node('menu-resume').hidden, true);
  assert.equal(f.win.sessionStorage.getItem(`${SESSION_STORAGE_PREFIX}default`), token);
  assert.equal(f.requests[1].options.headers['x-rts-resume-token'], token);
  assert.ok(!f.requests[1].path.includes(token), 'resume token stays out of URLs');
  assert.equal(savedRoomSession({ getItem() { throw new Error('denied'); } }), null);
});

for (const target of ['default', room]) {
  test(`Resume ${target === 'default' ? 'legacy default' : 'invite room'} is explicit and revalidated before navigation`, async () => {
    let valid = true;
    const f = await fixture({ stored: { [LAST_ROOM_STORAGE_KEY]: target, [`${SESSION_STORAGE_PREFIX}${target}`]: token },
      handler: path => json(path === '/api/rooms/status' ? { enabled: true, ordinarySetup: { pve: { available: true } } } : { valid }) });
    assert.equal(f.node('menu-resume').hidden, false); assert.deepEqual(f.navigations, []);
    valid = false; f.node('menu-resume').click(); await turn();
    assert.deepEqual(f.navigations, []); assert.match(f.node('game-menu-status').textContent, /expired/);
    valid = true; await f.controller.refresh(); f.node('menu-resume').click(); await turn();
    const url = new URL(f.navigations[0]);
    assert.equal(url.searchParams.get('resume'), '1');
    assert.equal(url.searchParams.get('room'), target === 'default' ? null : target);
    assert.deepEqual(f.loaded, []);
  });
}

for (const [id, expected, studio] of [
  ['menu-new-game', { mode: 'pve' }, false], ['menu-create-room', { mode: 'pvp', pregame: true }, false],
  ['menu-practice', { mode: 'pvp', practice: true }, false],
  ['menu-studio', { mode: 'pvp' }, true],
]) {
  test(`${id} creates one clean room and strips prior entry parameters`, async () => {
    let release;
    const f = await fixture({ url: 'http://game.test/?utm_source=old&mode=pve&mapSeed=7', handler: (path, options) =>
      options?.method === 'POST' ? new Promise(resolve => { release = resolve; }) : json({ enabled: true, ordinarySetup: { pve: { available: true } } }) });
    f.node(id).click(); f.node(id).click(); f.node('menu-create-room').click();
    assert.equal(f.requests.filter(row => row.options?.method === 'POST').length, 1);
    assert.deepEqual(JSON.parse(f.requests.at(-1).options.body), expected);
    release(json({ roomId: room, launchOptions: { mode: expected.mode, mapSeed: 12, policySeed: 34 } })); await turn();
    const url = new URL(f.navigations[0]);
    assert.equal(url.searchParams.get('room'), room);
    assert.equal(url.searchParams.has('utm_source'), false);
    assert.equal(url.searchParams.has('studio'), studio);
    if (expected.mode === 'pve') assert.equal(url.searchParams.get('mapSeed'), '12');
    else assert.equal(url.searchParams.has('mapSeed'), false);
  });
}

test('join checks same-server links, expiry and pending duplicate submits', async () => {
  let release;
  const f = await fixture({ handler: path => path === '/api/rooms/status' ? json({ enabled: true, ordinarySetup: { pve: { available: true } } }) : new Promise(resolve => { release = resolve; }) });
  f.node('menu-join').click(); const dialog = f.node('menu-join-dialog'), form = dialog.querySelector('form'), input = form.querySelector('input');
  const submit = () => form.dispatchEvent(new f.win.Event('submit', { cancelable: true }));
  input.value = `http://other.test/?room=${room}`; submit(); await turn();
  assert.equal(f.requests.length, 1);
  input.value = room; submit(); submit();
  assert.equal(f.requests.length, 2);
  release(json({ error: 'missing' }, 404)); await turn();
  assert.match(dialog.querySelector('[role=status]').textContent, /expired or not found/);
  assert.deepEqual(f.navigations, []);
});

test('cancel and browser-back restoration invalidate unfinished navigation', async () => {
  let release;
  const f = await fixture({ handler: (path, options) => path === '/api/rooms/status' ? json({ enabled: true, ordinarySetup: { pve: { available: true } } })
    : new Promise(resolve => { release = resolve; }) });
  f.node('menu-join').click(); const dialog = f.node('menu-join-dialog');
  dialog.querySelector('input').value = room;
  dialog.querySelector('form').dispatchEvent(new f.win.Event('submit', { cancelable: true }));
  dialog.querySelector('[data-close]').click(); release(json({ ok: true })); await turn();
  assert.deepEqual(f.navigations, []);
  f.node('menu-create-room').click();
  f.win.dispatchEvent(new f.win.PageTransitionEvent('pageshow', { persisted: true })); await turn();
  release(json({ roomId: room })); await turn();
  assert.deepEqual(f.navigations, []); assert.equal(f.node('menu-create-room').disabled, false);
});

for (const action of ['menu-new-game', 'menu-practice', 'menu-resume', 'menu-join']) {
  for (const persisted of [false, true]) test(`${action} cannot navigate after leaving the menu (${persisted ? 'back cache' : 'unload'})`, async () => {
    let waiting = false, finish;
    const f = await fixture({ stored: action === 'menu-resume'
      ? { [LAST_ROOM_STORAGE_KEY]: room, [`${SESSION_STORAGE_PREFIX}${room}`]: token } : {},
      handler: path => path === '/api/rooms/status' ? json({ enabled: true, ordinarySetup: { pve: { available: true } } })
        : waiting ? new Promise(resolve => { finish = resolve; }) : json({ valid: true }) });
    waiting = true;
    f.node(action).click();
    if (action === 'menu-join') {
      const dialog = f.node('menu-join-dialog');
      dialog.querySelector('input').value = room;
      dialog.querySelector('form').dispatchEvent(new f.win.Event('submit', { cancelable: true }));
    }
    assert.equal(typeof finish, 'function', 'the selected action has a pending server request');
    f.win.dispatchEvent(new f.win.PageTransitionEvent('pagehide', { persisted }));
    finish(json({ roomId: room, valid: true, launchOptions: { mode: 'pve', mapSeed: 12, policySeed: 34 } }));
    await turn();
    assert.deepEqual(f.navigations, [], 'a response cannot move a page the player has left');
    assert.deepEqual(f.loaded, []);
    if (persisted) {
      waiting = false;
      f.win.dispatchEvent(new f.win.PageTransitionEvent('pageshow', { persisted: true }));
      await turn();
      if (action === 'menu-join') f.node('menu-join-dialog').querySelector('[data-close]').click();
      waiting = true;
      f.node('menu-practice').click();
      finish(json({ roomId: 'N'.repeat(32) }));
      await turn();
      assert.equal(f.navigations.length, 1, 'returning permits an explicit fresh choice');
      assert.equal(new URL(f.navigations[0]).searchParams.get('room'), 'N'.repeat(32));
    }
    f.win.close();
  });
}

for (const lookup of ['availability', 'saved session']) test(`leaving ignores a stale ${lookup} refresh until explicit restoration`, async () => {
  let waiting = false, finish;
  const f = await fixture({ stored: { [LAST_ROOM_STORAGE_KEY]: room, [`${SESSION_STORAGE_PREFIX}${room}`]: token },
    handler: path => waiting && path === (lookup === 'availability' ? '/api/rooms/status' : `/api/session?room=${room}`)
      ? new Promise(resolve => { finish = resolve; })
      : json(path === '/api/rooms/status' ? { enabled: true, ordinarySetup: { pve: { available: true } } } : { valid: true }) });
  waiting = true;
  const refreshing = f.controller.refresh();
  await turn();
  assert.equal(typeof finish, 'function');
  f.win.dispatchEvent(new f.win.PageTransitionEvent('pagehide', { persisted: true }));
  finish(json(lookup === 'availability' ? { enabled: false } : { valid: false }));
  await refreshing;
  assert.equal(f.node('menu-practice').disabled, false, 'stale availability cannot replace the retained menu state');
  assert.equal(f.node('menu-resume').hidden, false, 'stale session validity cannot erase the saved choice');
  assert.deepEqual(f.navigations, []);
  waiting = false;
  const requestsBeforeReturn = f.requests.length;
  f.win.dispatchEvent(new f.win.PageTransitionEvent('pageshow', { persisted: true }));
  await turn();
  assert.equal(f.requests.length, requestsBeforeReturn + 2, 'return rechecks both availability and saved session');
  f.node('menu-resume').click();
  await turn();
  assert.equal(f.navigations.length, 1);
  assert.equal(new URL(f.navigations[0]).searchParams.get('room'), room);
  assert.equal(new URL(f.navigations[0]).searchParams.get('resume'), '1');
  f.win.close();
});

for (const cancel of ['button', 'escape']) test(`Join ${cancel} cancellation invalidates before queued close and preserves the next game action`, async () => {
  const pending = [];
  const f = await fixture({ handler: path => path === '/api/rooms/status' ? json({ enabled: true, ordinarySetup: { pve: { available: true } } })
    : new Promise(resolve => pending.push(resolve)) });
  f.node('menu-join').click(); const dialog = f.node('menu-join-dialog');
  dialog.querySelector('input').value = room;
  dialog.querySelector('form').dispatchEvent(new f.win.Event('submit', { cancelable: true }));
  if (cancel === 'button') dialog.querySelector('[data-close]').click();
  else { dialog.dispatchEvent(new f.win.Event('cancel', { cancelable: true })); dialog.close(); }
  assert.equal(dialog.open, false);
  pending[0](json({ ok: true }));
  for (let i = 0; i < 5; i++) await Promise.resolve();
  assert.deepEqual(f.navigations, [], 'a lookup resolved before queued close cannot navigate');
  f.node('menu-create-room').click();
  await turn(); // Deliver the earlier close while the new game request is pending.
  pending[1](json({ roomId: room })); await turn();
  assert.equal(f.navigations.length, 1, 'the old close cannot cancel the new action');
});

test('settings are available without a match and retain unrelated audio preferences', async () => {
  const f = await fixture();
  f.win.localStorage.setItem('tus-audio-v1', JSON.stringify({ voiceLevel: 1.6, musicLevel: .3 }));
  f.node('menu-settings').click(); assert.equal(f.node('menu-settings-dialog').open, true);
  f.node('menu-camera-speed').value = '150'; f.node('menu-camera-speed').dispatchEvent(new f.win.Event('input'));
  f.node('menu-audio-volume').value = '25'; f.node('menu-audio-volume').dispatchEvent(new f.win.Event('input'));
  assert.equal(JSON.parse(f.win.localStorage.getItem('thousand-unit-skirmish-navigation-settings')).cameraSpeed, 1.5);
  const audio = JSON.parse(f.win.localStorage.getItem('tus-audio-v1'));
  assert.equal(audio.volume, .25); assert.equal(audio.voiceLevel, 1.6); assert.equal(audio.musicLevel, .3);
  assert.deepEqual(f.loaded, []); assert.equal(f.requests.length, 1);
});

test('invite and refresh route to the existing game exactly once; root refresh remains menu', async () => {
  const f = await fixture({ url: `http://game.test/?room=${room}` });
  assert.deepEqual(f.loaded, [true]); assert.deepEqual(f.requests, []);
  const refreshed = await fixture({ url: `http://game.test/?room=${room}` });
  assert.deepEqual(refreshed.loaded, [true]);
  assert.equal((await fixture()).loaded.length, 0);
});

for (const status of [401, 503]) test(`Resume HTTP ${status} is an interruption, retains the saved choice, and retries the same room`, async () => {
  let responseStatus = 200;
  const f = await fixture({ stored: { [LAST_ROOM_STORAGE_KEY]: room, [`${SESSION_STORAGE_PREFIX}${room}`]: token },
    handler: path => path === '/api/rooms/status' ? json({ enabled: true, ordinarySetup: { pve: { available: true } } }) : responseStatus === 200
      ? json({ valid: true }) : new Response('Authentication required.', { status: responseStatus }) });
  responseStatus = status; f.node('menu-resume').click(); await turn();
  assert.deepEqual(f.navigations, []);
  assert.equal(f.node('menu-resume').hidden, false);
  assert.match(f.node('game-menu-status').textContent, status === 401 ? /sign.in/i : /cannot check/i);
  assert.doesNotMatch(f.node('game-menu-status').textContent, /expired/i);
  assert.equal(f.win.sessionStorage.getItem(`${SESSION_STORAGE_PREFIX}${room}`), token);
  responseStatus = 200; f.node('menu-resume').click(); await turn();
  const target = new URL(f.navigations[0]);
  assert.equal(target.searchParams.get('resume'), '1'); assert.equal(target.searchParams.get('room'), room);
  assert.equal(f.requests.filter(row => row.options?.method === 'POST').length, 0);
});

test('menu, create and join authentication interruptions show a sign-in action without parsing a text challenge as JSON', async () => {
  let interrupted = false;
  const handler = () => interrupted ? new Response('Authentication required.', { status: 401 }) : json({ enabled: true, ordinarySetup: { pve: { available: true } } });
  const f = await fixture({ handler }); interrupted = true;
  f.node('menu-create-room').click(); await turn();
  assert.match(f.node('game-menu-status').textContent, /sign.in/i);
  assert.doesNotMatch(f.node('game-menu-status').textContent, /JSON|Unexpected token/i);
  f.node('menu-join').click(); const dialog = f.node('menu-join-dialog');
  dialog.querySelector('input').value = room;
  dialog.querySelector('form').dispatchEvent(new f.win.Event('submit', { cancelable: true })); await turn();
  assert.match(dialog.querySelector('[role=status]').textContent, /sign.in/i);
  const root = await fixture({ handler });
  assert.match(root.node('game-menu-status').textContent, /sign.in/i);
  assert.deepEqual(root.loaded, []); assert.deepEqual(root.navigations, []);
});

for (const status of [401, 503]) test(`back-cache refresh preserves only the same previously validated Resume during HTTP ${status}`, async () => {
  let responseStatus = 200, valid = true;
  const f = await fixture({ stored: { [LAST_ROOM_STORAGE_KEY]: room, [`${SESSION_STORAGE_PREFIX}${room}`]: token },
    handler: path => responseStatus !== 200 ? new Response('Temporarily interrupted', { status: responseStatus })
      : json(path === '/api/rooms/status' ? { enabled: true, ordinarySetup: { pve: { available: true } } } : { valid }) });
  responseStatus = status;
  f.win.dispatchEvent(new f.win.PageTransitionEvent('pageshow', { persisted: true })); await turn();
  assert.equal(f.node('menu-resume').hidden, false); assert.equal(f.node('menu-resume').disabled, false);
  assert.deepEqual(f.loaded, []); assert.deepEqual(f.navigations, []);
  responseStatus = 200; f.node('menu-resume').click(); await turn();
  assert.equal(new URL(f.navigations[0]).searchParams.get('room'), room);
  valid = false; await f.controller.refresh(); assert.equal(f.node('menu-resume').hidden, true);
  valid = true; await f.controller.refresh(); assert.equal(f.node('menu-resume').hidden, false);
  f.win.sessionStorage.setItem(`${SESSION_STORAGE_PREFIX}${room}`, 'X'.repeat(43));
  responseStatus = status; await f.controller.refresh();
  assert.equal(f.node('menu-resume').hidden, true, 'a different unvalidated token cannot inherit a cached Resume choice');
});
