import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { id, contextVersion, run, projectTreeOrder, installTreeOrderProbe, findTreePixel, treeApproachPoint } from './renderer-tree-targeting-scenario.mjs';
import { validateCaptureAdapter } from './renderer-capture-context.mjs';
import { createPveHeadlessFixture } from './pve-headless-fixture.mjs';
import { fogCode } from './forest-fringe-fixture.mjs';

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

test('ordinary forest approach excludes blocked ground and requires a real authored frontier', () => {
  const map = { width: 8, height: 8, obstacles: [
    { material: 'forest', column: 3, row: 3, width: 2, height: 2 },
    { material: 'stone', column: 2, row: 3, width: 1, height: 1 },
  ] };
  const original = JSON.stringify(map);
  const point = treeApproachPoint(map, { worldX: -3, worldZ: -.5 }, 27);
  assert.deepEqual(point, { x: -.5, z: -1.5, forestCell: 27, distance: Math.hypot(2.5, -1) });
  assert.equal(JSON.stringify(map), original);
  assert.throws(() => treeApproachPoint(map, { worldX: 0, worldZ: 0 }, 0), /authored forest front/);
  assert.throws(() => treeApproachPoint({ width: 1, height: 1, obstacles: [
    { material: 'forest', column: 0, row: 0, width: 1, height: 1 },
  ] }, { worldX: 0, worldZ: 0 }), /authored forest front/);
});

test('canonical opening has no visible forest; real Move discloses a frontier and real Gather depletes it', async () => {
  const map = JSON.parse(await readFile(new URL('../maps/veyrholds-terraced-vale.json', import.meta.url)));
  const original = JSON.stringify(map), forest = new Set();
  for (const block of map.obstacles.filter(obstacle => obstacle.material === 'forest')) {
    for (let row = block.row; row < block.row + block.height; row++) for (let col = block.column; col < block.column + block.width; col++) forest.add(row * map.width + col);
  }
  const fixture = await createPveHeadlessFixture(map, { matchModeId: 'skirmish', matchModeVersion: 1 });
  try {
    const initial = fixture.replay.observe(0), worker = initial.units.find(unit => unit[1] === 0 && unit[5] === 'worker');
    assert.equal([...forest].filter(cell => fogCode(initial, cell) === 2).length, 0);
    const goal = treeApproachPoint(map, { worldX: worker[2], worldZ: worker[3] });
    const move = await fixture.replay.order(0, { type: 'move', ids: [worker[0]], x: goal.x, z: goal.z });
    assert.ok(move.some(notice => /MOVE/.test(notice.message)));
    let reached = false;
    for (let ticks = 0; ticks < 1200; ticks++) {
      fixture.replay.step();
      const current = fixture.replay.observe(0).units.find(unit => unit[0] === worker[0]);
      if (Math.hypot(current[2] - goal.x, current[3] - goal.z) < 2) { reached = true; break; }
    }
    assert.equal(reached, true, 'native approach completes inside the adapter deadline');
    assert.equal(fogCode(fixture.replay.observe(0), goal.forestCell), 2);
    const gather = await fixture.replay.order(0, { type: 'gather', ids: [worker[0]], forestCell: goal.forestCell });
    assert.ok(gather.some(notice => /GATHER ORDER/.test(notice.message)));
    let depleted;
    for (let ticks = 0; ticks < 1350; ticks++) {
      fixture.replay.step();
      depleted = fixture.replay.observe(0).forestStocks.find(([cell, stock]) => forest.has(cell) && stock === 0);
      if (depleted) break;
    }
    assert.ok(depleted, 'six real wood ticks disclose an actual depleted forest identity');
    assert.equal(fogCode(fixture.replay.observe(0), depleted[0]), 2);
    assert.equal(treeApproachPoint(map, { worldX: worker[2], worldZ: worker[3] }, depleted[0]).forestCell, depleted[0]);
    assert.equal(JSON.stringify(map), original, 'approach never rewrites authored geometry or stock');
  } finally { await fixture.dispose(); }
});
