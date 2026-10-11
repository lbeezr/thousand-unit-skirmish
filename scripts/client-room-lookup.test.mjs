import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const source = main.slice(main.indexOf('async function connect()'), main.indexOf('\nfunction connectSocket('));
function fixture({ status = 200 } = {}) {
  let finish, fail, began, reads = 0, sockets = 0, retries = 0;
  const reading = new Promise(resolve => { began = resolve; });
  const body = new Promise((resolve, reject) => { finish = resolve; fail = reject; });
  const context = vm.createContext({ pageLeaving: false, connectionAttempt: 0, localTeam: null,
    HAS_ROOM_PARAMETER: true, ROOM_ID: 'owned'.padEnd(32, 'x'), ROOM_ID_PATTERN: /^[A-Za-z0-9_-]{32}$/,
    RESUME_REQUESTED: false, entrySessionConfirmed: false, AUTHENTICATION_MESSAGE: 'Sign in',
    URL, encodeURIComponent, AbortSignal: { timeout: ms => { assert.equal(ms, 10000); return {}; } },
    window: { location: { href: 'https://example.test/?studio=1' } }, setConnection() {}, showToast() {},
    fetch: async () => ({ status, ok: status >= 200 && status < 300,
      arrayBuffer() { reads++; began(); return body; } }),
    scheduleReconnect() { retries++; }, connectSocket() { sockets++; },
  });
  vm.runInContext(source, context);
  return { context, start: () => vm.runInContext('connect()', context), finish, fail, reading,
    state: () => ({ reads, sockets, retries }) };
}
test('room admission waits for the complete successful response under its existing deadline', async () => {
  const f = fixture(), pending = f.start(); await f.reading;
  assert.deepEqual(f.state(), { reads: 1, sockets: 0, retries: 0 });
  f.finish(new ArrayBuffer(0)); await pending;
  assert.deepEqual(f.state(), { reads: 1, sockets: 1, retries: 0 });
});
test('a truncated or expired successful response retries without opening a socket', async () => {
  const f = fixture(), pending = f.start(); await f.reading;
  f.fail(new Error('body interrupted')); await pending;
  assert.deepEqual(f.state(), { reads: 1, sockets: 0, retries: 1 });
});
for (const cause of ['pageLeaving', 'new-attempt']) test(`body completion cannot revive ${cause}`, async () => {
  const f = fixture(), pending = f.start(); await f.reading;
  if (cause === 'pageLeaving') f.context.pageLeaving = true; else f.context.connectionAttempt++;
  f.finish(new ArrayBuffer(0)); await pending;
  assert.deepEqual(f.state(), { reads: 1, sockets: 0, retries: 0 });
});
for (const status of [401, 404, 503]) test(`room response ${status} retains its existing admission behavior`, async () => {
  const f = fixture({ status }); await f.start();
  assert.deepEqual(f.state(), { reads: 0, sockets: 0, retries: status === 503 ? 1 : 0 });
});
