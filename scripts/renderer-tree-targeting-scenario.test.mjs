import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { id, contextVersion, run, projectTreeOrder, installTreeOrderProbe, findTreePixel } from './renderer-tree-targeting-scenario.mjs';
import { validateCaptureAdapter } from './renderer-capture-context.mjs';

test('tree adapter imports without acquiring a browser and uses the existing version1 contract', () => {
  assert.equal(validateCaptureAdapter({ id, contextVersion, run }, 'tree-targeting').run, run);
});
test('only one actual Gather identity and selected worker survive public evidence projection', () => {
  const command = { type: 'gather', ids: [9], forestCell: 160, token: 'private', unitGenerations: [42], password: 'private', message: 'private' };
  assert.deepEqual(projectTreeOrder(command), { type: 'gather', workerId: 9, forestCell: 160 });
  assert.deepEqual(projectTreeOrder({ type: 'gather', ids: [9], nodeId: 's0-home-wood' }), { type: 'gather', workerId: 9, nodeId: 's0-home-wood' });
  for (const invalid of [{ type: 'chat', ids: [9], nodeId: 's0-home-wood' }, { ...command, nodeId: 's0-home-wood' },
    { ...command, forestCell: 25600 }, { ...command, forestCell: -1 }, { ...command, ids: [9, 10] },
    { ...command, ids: [NaN] }, { type: 'gather', ids: [9], nodeId: 'http://private.invalid/token' }]) assert.equal(projectTreeOrder(invalid), null);
});
test('observer forwards native sends unchanged and bounds sanitized receipts', () => {
  const sent = [];
  class NativeSocket { send(value) { sent.push(value); return 'native-result'; } }
  const window = { WebSocket: NativeSocket };
  vm.runInNewContext(`(${installTreeOrderProbe.toString()})(${projectTreeOrder.toString()})`, { window });
  const socket = new window.WebSocket();
  for (let i = 0; i < 40; i++) assert.equal(socket.send(JSON.stringify({ type: 'gather', ids: [9], forestCell: i, token: 'secret' })), 'native-result');
  socket.send('non-json'); socket.send(JSON.stringify({ type: 'chat', message: 'private' }));
  assert.equal(sent.length, 42); assert.equal(window.__rtsTreeIssuedOrders.length, 32);
  assert.equal(JSON.stringify(window.__rtsTreeIssuedOrders).includes('secret'), false);
});
test('opaque screen search preserves the independent registered identity and demonstrates crown distance', async () => {
  const target = { forestCell: 22, stock: 6, family: 'actual-canopy', root: { x: 50, y: 95 }, bounds: { left: 30, top: 20, right: 70, bottom: 100 } };
  const snapshot = { targets: [target], viewport: { left: 0, top: 0, width: 1280, height: 720 } };
  let queries = 0;
  const page = { cdp: { evaluate: async expression => { queries++; assert.match(expression, /^window\.__rtsTreeTargetCapture\.pick\(/); return { forestCell: 22 }; } } };
  const point = await findTreePixel(page, snapshot, 'forest', true);
  assert.equal(point.forestCell, 22); assert.ok(Math.hypot(point.x - 50, point.y - 95) > 32); assert.equal(queries, 1);
  page.cdp.evaluate = async () => ({ forestCell: 23 });
  assert.equal(await findTreePixel(page, snapshot, 'forest', true), null, 'foreground other tree cannot pretend to be this registered instance');
  assert.equal(await findTreePixel(page, snapshot, 'node'), null);
});
