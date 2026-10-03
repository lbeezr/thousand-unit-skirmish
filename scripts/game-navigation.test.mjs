import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
test('leaving/back navigation closes once, cancels reconnect and restores the existing connection path', () => {
  const listeners = new Map(), closed = [], cleared = [], connections = [];
  const context = vm.createContext({ pageLeaving: false, connectionAttempt: 0, reconnectTimer: 7,
    socket: { close(...args) { closed.push(args); } }, connect() { connections.push(true); },
    window: { clearTimeout(value) { cleared.push(value); }, addEventListener(type, callback) { listeners.set(type, callback); } } });
  const block = source.slice(source.indexOf('function releasePageConnection()'), source.indexOf('\nresize();', source.indexOf('function releasePageConnection()')));
  vm.runInContext(block, context);
  listeners.get('beforeunload')(); listeners.get('pagehide')();
  assert.equal(closed.length, 1); assert.deepEqual(cleared, [7]);
  assert.equal(context.pageLeaving, true); assert.equal(context.reconnectTimer, null);
  listeners.get('pageshow')({ persisted: false }); assert.equal(connections.length, 0);
  listeners.get('pageshow')({ persisted: true });
  assert.equal(connections.length, 1); assert.equal(context.pageLeaving, false); assert.equal(context.socket, null);
});

for (const resume of [false, true]) test(`a delayed ${resume ? 'Resume' : 'room'} lookup cannot admit a stale page after back restoration`, async () => {
  const pending = [], admitted = [], retries = [], listeners = new Map();
  const context = vm.createContext({ pageLeaving: false, connectionAttempt: 0, reconnectTimer: null,
    localTeam: null, HAS_ROOM_PARAMETER: !resume, ROOM_ID: 'R'.repeat(32), ROOM_ID_PATTERN: /^[A-Za-z0-9_-]{32}$/,
    RESUME_REQUESTED: resume, entrySessionConfirmed: false, ROOM_SESSION_STORAGE_KEY: 'saved',
    sessionStorage: { getItem: () => 'T'.repeat(43) }, socket: null, URL,
    setConnection() {}, showToast() {}, scheduleReconnect() { retries.push(true); },
    connectSocket(options) { admitted.push(options); },
    fetch: () => new Promise((resolve, reject) => pending.push({ resolve, reject })),
    window: { location: { href: 'https://game.test/' }, clearTimeout() {},
      addEventListener(type, callback) { listeners.set(type, callback); } } });
  const connect = source.slice(source.indexOf('async function connect()'), source.indexOf('\nfunction connectSocket('));
  const lifecycle = source.slice(source.indexOf('function releasePageConnection()'), source.indexOf('\nresize();', source.indexOf('function releasePageConnection()')));
  vm.runInContext(`${connect}\n${lifecycle}`, context);
  const old = context.connect();
  listeners.get('pagehide')(); listeners.get('pageshow')({ persisted: true });
  assert.equal(pending.length, 2);
  pending[1].resolve({ ok: true, status: 200, json: async () => ({ valid: true }) });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(admitted.length, 1);
  pending[0].resolve({ ok: true, status: 200, json: async () => ({ valid: true }) });
  await old;
  assert.equal(admitted.length, 1, 'the old request cannot open another socket');
  assert.equal(retries.length, 0);
});
