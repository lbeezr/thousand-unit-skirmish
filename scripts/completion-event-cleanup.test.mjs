import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('./completion-event-scenario.mjs', import.meta.url), 'utf8');
const start = source.indexOf('async function closeClient(');
const end = source.indexOf('\nfunction eventFired(', start);
assert.ok(start >= 0 && end > start);
const timeoutMs = Number(source.match(/const CLIENT_CLOSE_TIMEOUT_MS = (\d+);/)[1]);

function fixture({ stopError, removeError } = {}) {
  const timers = new Set(), calls = [];
  const context = vm.createContext({
    WebSocket, CLIENT_CLOSE_TIMEOUT_MS: timeoutMs,
    setTimeout(callback, ms) { const timer = { callback, ms }; timers.add(timer); return timer; },
    clearTimeout(timer) { timers.delete(timer); },
    async stopServer(server) { calls.push(['stop', server]); if (stopError) throw stopError; },
    async rm(directory, options) {
      calls.push(['remove', directory, { ...options }]); if (removeError) throw removeError;
    },
  });
  vm.runInContext(source.slice(start, end), context);
  return { ...context, timers, calls, expire() {
    for (const timer of [...timers]) { assert.equal(timer.ms, 500); timer.callback(); }
  } };
}

function client({ state = WebSocket.OPEN, closeEvent = true, closeError } = {}) {
  const listeners = new Set();
  const socket = {
    readyState: state, closeCalls: [],
    addEventListener(type, listener) { assert.equal(type, 'close'); listeners.add(listener); },
    removeEventListener(type, listener) { assert.equal(type, 'close'); listeners.delete(listener); },
    close(...args) {
      this.closeCalls.push(args);
      if (closeError) throw closeError;
      this.readyState = WebSocket.CLOSING;
      if (closeEvent) { this.readyState = WebSocket.CLOSED; for (const listener of [...listeners]) listener(); }
    },
  };
  return { socket, listeners };
}

test('graceful and already closed clients leave no timer or listener', async () => {
  const f = fixture(), c = client(), closed = client({ state: WebSocket.CLOSED });
  await f.closeClient(c); await f.closeClient(closed); await f.closeClient(null);
  assert.deepEqual(c.socket.closeCalls, [[1000, 'timed event scenario complete']]);
  assert.deepEqual(closed.socket.closeCalls, []);
  assert.equal(f.timers.size, 0); assert.equal(c.listeners.size, 0);
});

for (const state of [WebSocket.OPEN, WebSocket.CLOSING]) {
  test(`a missing close event at state ${state} fails within the cleanup allowance and still disposes the server`, async () => {
    const f = fixture(), c = client({ state, closeEvent: false });
    const cleanup = f.cleanupScenario([c, client()], 'owned-server', 'owned-data');
    const rejected = assert.rejects(cleanup, /did not close within 500 ms/);
    f.expire(); await rejected;
    assert.deepEqual(f.calls, [['stop', 'owned-server'], ['remove', 'owned-data', { recursive: true, force: true }]]);
    assert.equal(f.timers.size, 0); assert.equal(c.listeners.size, 0);
  });
}

test('synchronous close failure is retained after server and temporary-data cleanup', async () => {
  const error = new Error('close failed'), f = fixture(), c = client({ closeError: error });
  await assert.rejects(f.cleanupScenario([c], 'server', 'data'), actual => actual === error);
  assert.equal(f.calls.length, 2); assert.equal(f.timers.size, 0); assert.equal(c.listeners.size, 0);
});

test('an original scenario failure and every disposal failure remain visible', async () => {
  const original = new Error('original reward assertion'), stopError = new Error('stop failed');
  const removeError = new Error('remove failed'), closeError = new Error('close failed');
  const f = fixture({ stopError, removeError });
  await assert.rejects(f.cleanupScenario([client({ closeError })], 'server', 'data', original), error => {
    assert.deepEqual(Array.from(error.errors), [original, closeError, stopError, removeError]);
    return true;
  });
  assert.equal(f.calls.length, 2);
});

test('an original scenario failure is rethrown unchanged after successful cleanup', async () => {
  const original = new Error('original assertion'), f = fixture();
  await assert.rejects(f.cleanupScenario([client()], 'server', 'data', original), error => error === original);
  assert.equal(f.calls.length, 2);
});

test('real scenario missing-close fault exits nonzero after assertions and leaves no owned server or data', async () => {
  const scratch = await mkdtemp(path.join(os.tmpdir(), 'rts-completion-cleanup-test-'));
  const preload = path.join(scratch, 'missing-close.mjs'), pidFile = path.join(scratch, 'servers.json');
  const data = path.join(scratch, 'data');
  const { mkdir } = await import('node:fs/promises'); await mkdir(data);
  try {
    await writeFile(preload, `import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { writeFileSync } from 'node:fs';
const spawn = childProcess.spawn, pids = [];
childProcess.spawn = (...args) => {
  const child = spawn(...args); pids.push(child.pid);
  writeFileSync(${JSON.stringify(pidFile)}, JSON.stringify(pids)); return child;
};
syncBuiltinESMExports();
const NativeWebSocket = globalThis.WebSocket;
globalThis.WebSocket = class extends NativeWebSocket {
  addEventListener(type, ...args) { if (type !== 'close') super.addEventListener(type, ...args); }
};
`);
    const result = spawnSync(process.execPath, ['--import', preload, 'scripts/completion-event-scenario.mjs'], {
      cwd: path.resolve(import.meta.dirname, '..'), encoding: 'utf8', timeout: 45_000,
      env: { ...process.env, TMPDIR: data },
    });
    assert.ifError(result.error); assert.equal(result.signal, null); assert.equal(result.status, 1);
    assert.match(result.stdout, /"scenario":"completion conditions","result":"pass"/);
    assert.match(result.stderr, /did not close within 500 ms/);
    const pids = JSON.parse(await readFile(pidFile, 'utf8'));
    assert.equal(pids.length, 2, 'both original and restarted server processes are tracked');
    for (const pid of pids) assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
    assert.deepEqual(await readdir(data), []);
  } finally { await rm(scratch, { recursive: true, force: true }); }
});
