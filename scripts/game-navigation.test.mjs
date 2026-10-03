import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
test('leaving/back navigation closes once, cancels reconnect and restores the existing connection path', () => {
  const listeners = new Map(), closed = [], cleared = [], connections = [];
  const context = vm.createContext({ pageLeaving: false, reconnectTimer: 7,
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
