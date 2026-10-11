import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

// Execute the real supervisor transitions with a controllably delayed TCP
// connection. Native startup tests cover the earlier worker-ready boundary.
function fixture() {
  const source = readFileSync(new URL('../room-supervisor.mjs', import.meta.url), 'utf8');
  const parsed = ts.createSourceFile('room-supervisor.mjs', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const functions = parsed.statements.filter(statement => ts.isFunctionDeclaration(statement)
    && ['proxyUpgrade', 'archiveRoom'].includes(statement.name?.text));
  function socket() {
    const value = new EventEmitter();
    value.pipe = () => value;
    value.write = () => true;
    value.destroy = () => {
      if (value.destroyed) return;
      value.destroyed = true;
      value.emit('close');
    };
    return value;
  }
  const upstream = socket(), downstream = socket();
  const room = { id: 'room', activeConnections: 0, pendingConnections: 0, worker: {} };
  const context = vm.createContext({ connectTcp: () => upstream, proxySockets: new Set(),
    rooms: new Map([[room.id, room]]), setTimeout: () => 1, clearTimeout: () => {},
    touchRoom: () => {}, persistRoomIndex: async () => {}, rejectUpgrade: () => {}, console,
    stopWorker: () => { throw new Error('must not stop an admitted connection'); },
  });
  vm.runInContext(functions.map(statement => statement.getFullText(parsed)).join('\n'), context);
  context.proxyUpgrade({ method: 'GET', url: '/ws', httpVersion: '1.1', rawHeaders: [] }, downstream, null, { port: 1234 }, room);
  return { room, upstream, downstream, archive: () => context.archiveRoom(room, 'operator') };
}

test('archive cannot win between worker readiness and TCP connect', async () => {
  const { room, upstream, downstream, archive } = fixture();
  assert.equal(room.pendingConnections, 1);
  assert.equal(await archive(), false);
  upstream.emit('connect');
  assert.equal(room.pendingConnections, 0);
  assert.equal(room.activeConnections, 1);
  assert.equal(await archive(), false);
  downstream.destroy();
  upstream.emit('error', new Error('late socket error'));
  assert.equal(room.pendingConnections, 0);
  assert.equal(room.activeConnections, 0);
});

test('aborted or failed TCP connect releases its reservation exactly once', () => {
  for (const cause of ['client', 'upstream']) {
    const { room, upstream, downstream } = fixture();
    if (cause === 'client') downstream.destroy();
    else upstream.emit('error', new Error('connect refused'));
    upstream.emit('close');
    downstream.emit('close');
    assert.equal(room.pendingConnections, 0);
    assert.equal(room.activeConnections, 0);
  }
});
