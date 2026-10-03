import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { bootGameEntry } from '../src/game-entry.mjs';
import { isGameEntry, savedRoomSession, LAST_ROOM_STORAGE_KEY, SESSION_STORAGE_PREFIX } from '../src/game-entry-session.mjs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const room = 'R'.repeat(32), token = 'T'.repeat(43);
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
const turn = () => new Promise(resolve => setImmediate(resolve));
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
      return handler ? handler(path, options) : json({ enabled: true });
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
    handler: path => json(path === '/api/rooms/status' ? { enabled: true } : { valid: false }) });
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
      handler: path => json(path === '/api/rooms/status' ? { enabled: true } : { valid }) });
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
  ['menu-studio', { mode: 'pvp' }, true],
]) {
  test(`${id} creates one clean room and strips prior entry parameters`, async () => {
    let release;
    const f = await fixture({ url: 'http://game.test/?utm_source=old&mode=pve&mapSeed=7', handler: (path, options) =>
      options?.method === 'POST' ? new Promise(resolve => { release = resolve; }) : json({ enabled: true }) });
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
  const f = await fixture({ handler: path => path === '/api/rooms/status' ? json({ enabled: true }) : new Promise(resolve => { release = resolve; }) });
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
  const f = await fixture({ handler: (path, options) => path === '/api/rooms/status' ? json({ enabled: true })
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

for (const cancel of ['button', 'escape']) test(`Join ${cancel} cancellation invalidates before queued close and preserves the next game action`, async () => {
  const pending = [];
  const f = await fixture({ handler: path => path === '/api/rooms/status' ? json({ enabled: true })
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
    handler: path => path === '/api/rooms/status' ? json({ enabled: true }) : responseStatus === 200
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
  const handler = () => interrupted ? new Response('Authentication required.', { status: 401 }) : json({ enabled: true });
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
      : json(path === '/api/rooms/status' ? { enabled: true } : { valid }) });
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
