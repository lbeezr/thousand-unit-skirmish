// Owned adapter for the shared qualified ordinary-game runner; no launcher or CLI.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CAPTURE_CONTEXT_VERSION, validateCaptureContext } from './renderer-capture-context.mjs';

export const id = 'tree-targeting';
export const contextVersion = CAPTURE_CONTEXT_VERSION;
const mapId = 'veyrholds-terraced-vale';

// Keep only the actual issued Gather identity. No raw envelopes, session tokens,
// WebSocket URLs, chat, generations or opponent observations enter the receipt.
export function projectTreeOrder(command) {
  if (command?.type !== 'gather' || !Array.isArray(command.ids) || command.ids.length !== 1
    || !Number.isSafeInteger(command.ids[0]) || command.ids[0] < 0) return null;
  if (command.forestCell !== undefined && command.nodeId !== undefined) return null;
  if (Number.isSafeInteger(command.forestCell) && command.forestCell >= 0 && command.forestCell < 160 * 160) {
    return { type: 'gather', workerId: command.ids[0], forestCell: command.forestCell };
  }
  if (typeof command.nodeId === 'string' && /^[a-z0-9-]{1,128}$/.test(command.nodeId)) {
    return { type: 'gather', workerId: command.ids[0], nodeId: command.nodeId };
  }
  return null;
}
export function installTreeOrderProbe(project) {
  const orders = window.__rtsTreeIssuedOrders = [];
  const NativeSocket = window.WebSocket;
  window.WebSocket = class extends NativeSocket {
    send(serialized) {
      if (typeof serialized === 'string' && serialized.length < 65536) {
        try { const order = project(JSON.parse(serialized)); if (order && orders.length < 32) orders.push(order); }
        catch { /* Non-JSON sends remain native and are not evidence. */ }
      }
      return super.send(serialized);
    }
  };
}
async function pointer(page, x, y, button = 'left') {
  assert.ok(Number.isFinite(x) && Number.isFinite(y), 'normal pointer coordinates required');
  await page.cdp.call('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await page.cdp.call('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button, clickCount: 1 });
  await page.cdp.call('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button, clickCount: 1 });
}
async function button(page, selector) {
  const position = await page.cdp.evaluate(`(() => { const element = document.querySelector(${JSON.stringify(selector)});
    if (!element || element.disabled || element.hidden) return null;
    element.scrollIntoView({block:'center',inline:'nearest'});
    const r = element.getBoundingClientRect(); return r.width && r.height ? {x:r.x+r.width/2,y:r.y+r.height/2} : null; })()`);
  assert.ok(position, 'ordinary control must be enabled and visible');
  await pointer(page, position.x, position.y);
}
async function key(page, value, code) {
  await page.cdp.call('Input.dispatchKeyEvent', { type: 'keyDown', key: value, code });
  await page.cdp.call('Input.dispatchKeyEvent', { type: 'keyUp', key: value, code });
}
const identity = target => target?.nodeId !== undefined ? { nodeId: target.nodeId }
  : target?.forestCell !== undefined ? { forestCell: target.forestCell } : null;
const sameIdentity = (a, b) => JSON.stringify(identity(a)) === JSON.stringify(identity(b));

// Authored geometry chooses an ordinary approach order, never a stock value.
// The actual server path and received fog determine whether the approach works.
export function treeApproachPoint(map, worker, preferredCell = null) {
  const blocked = new Set(), forest = new Set();
  for (const obstacle of map.obstacles) for (let row = obstacle.row; row < obstacle.row + obstacle.height; row++) {
    for (let col = obstacle.column; col < obstacle.column + obstacle.width; col++) {
      const cell = row * map.width + col; blocked.add(cell);
      if (obstacle.material === 'forest') forest.add(cell);
    }
  }
  const approaches = [];
  for (const cell of preferredCell === null ? forest : [preferredCell]) {
    if (!forest.has(cell)) continue;
    const row = Math.floor(cell / map.width), col = cell % map.width;
    for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const column = col + dx, line = row + dz, adjacent = line * map.width + column;
      if (column < 0 || column >= map.width || line < 0 || line >= map.height || blocked.has(adjacent)) continue;
      const x = column + .5 - map.width / 2, z = line + .5 - map.height / 2;
      approaches.push({ x, z, forestCell: cell, distance: Math.hypot(x - worker.worldX, z - worker.worldZ) });
    }
  }
  approaches.sort((a, b) => a.distance - b.distance);
  assert.ok(approaches.length, 'authored forest front needs an ordinary ground approach');
  return approaches[0];
}

// Scan the registered quad bounds; the real current picker supplies alpha
// coverage. Expected IDs come separately from the actual instance registry.
export async function findTreePixel(page, snapshot, kind, outsideRoot = false) {
  for (const target of snapshot.targets.filter(t => kind === 'forest' ? t.forestCell !== undefined : t.nodeId !== undefined)) {
    const { left, top, right, bottom } = target.bounds;
    for (let row = 0; row < 8; row++) for (let column = 0; column < 7; column++) {
      const x = left + (right - left) * (column + .5) / 7, y = top + (bottom - top) * (row + .5) / 8;
      const view = snapshot.viewport;
      if (x < view.left + 4 || y < view.top + 4 || x > view.left + view.width - 4 || y > view.top + view.height - 4) continue;
      if (outsideRoot && Math.hypot(x - target.root.x, y - target.root.y) <= 32) continue;
      const picked = await page.cdp.evaluate(`window.__rtsTreeTargetCapture.pick(${x},${y})`);
      if (picked && sameIdentity(picked, target)) return { ...identity(target), stock: target.stock, family: target.family, x, y };
    }
  }
  return null;
}

export async function run(value) {
  const { page, openPage, origin, source, capture } = validateCaptureContext(value);
  const checks = [];
  const check = (id, passed) => checks.push({ id, passed: Boolean(passed) });
  await page.cdp.call('Page.addScriptToEvaluateOnNewDocument', {
    source: `(${installTreeOrderProbe.toString()})(${projectTreeOrder.toString()})`,
  });
  await page.cdp.call('Page.navigate', { url: origin + '/' });
  await page.wait('document.querySelector("#menu-create-room")?.disabled === false', 'normal Create Room menu');
  await button(page, '#menu-create-room');
  await page.wait('document.querySelector("#lobby-map")?.disabled === false', 'ordinary pregame map picker');
  // Use the visible host lobby control and real acknowledgement. Live match
  // selectors are intentionally locked; never edit mapDefinition or stocks.
  assert.equal(await page.cdp.evaluate(`(() => { const select = document.querySelector('#lobby-map');
    if (select.disabled || ![...select.options].some(o => o.value === ${JSON.stringify(mapId)})) return false;
    select.value = ${JSON.stringify(mapId)}; select.dispatchEvent(new Event('change',{bubbles:true})); return true; })()`), true);
  await page.wait(`document.querySelector('#lobby-map')?.value === ${JSON.stringify(mapId)} && document.querySelector('#lobby-ready')?.disabled === false`, 'canonical host settings accepted');
  assert.equal(await page.cdp.evaluate("document.querySelector('#lobby-match-mode').value"), 'skirmish@1');
  const roomUrl = await page.cdp.evaluate('location.href');
  const peer = await openPage();
  await peer.cdp.call('Page.navigate', { url: roomUrl });
  const launch = async () => {
    await peer.wait('document.querySelector("#lobby-ready")?.disabled === false', 'second ordinary seat');
    await page.wait("[...document.querySelectorAll('#room-lobby ul[aria-label=\"Player seats\"] li')].length === 2 && [...document.querySelectorAll('#room-lobby ul[aria-label=\"Player seats\"] li')].every(row => !row.textContent.includes('Waiting') && !row.textContent.includes('Disconnected'))", 'both connected seats');
    await button(page, '#lobby-ready');
    await page.wait("document.querySelector('#lobby-ready').textContent === 'Not ready'", 'host ready accepted');
    await peer.wait("document.querySelector('#room-lobby ul[aria-label=\"Player seats\"] li').textContent.includes(': Ready')", 'peer sees host readiness');
    await button(peer, '#lobby-ready');
    await page.wait('document.querySelector("#lobby-launch")?.disabled === false', 'both ready to launch');
    await button(page, '#lobby-launch');
    await page.wait('document.querySelector("#room-lobby")?.open === false', 'ordinary match launched');
  };
  await launch();
  await page.wait(`window.__rtsEnvironmentStateSnapshot?.mapId === ${JSON.stringify(mapId)} && window.__rtsTreeTargetCapture.snapshot().workers.length > 0`, 'canonical applied map and own Worker');
  const snapshot = () => page.cdp.evaluate('window.__rtsTreeTargetCapture.snapshot()');
  let state = await snapshot();
  assert.equal(state.mapId, mapId); assert.equal(state.forestSlots, 3162);
  check('normal-menu-canonical-forest-registration', true);
  let worker = state.workers.find(w => Math.abs(w.depth) <= 1);
  assert.ok(worker, 'own visible Worker required');
  await pointer(page, worker.x, worker.y); await key(page, ' ', 'Space');
  await page.wait(`window.__rtsTreeTargetCapture.snapshot().workers.some(w => w.id === ${worker.id} && w.selected)`, 'ordinary Worker selection');
  const map = JSON.parse(await readFile(new URL('../maps/veyrholds-terraced-vale.json', import.meta.url)));
  const approach = async (preferredCell = null) => {
    const live = await snapshot(), current = live.workers.find(w => w.id === worker.id);
    assert.ok(current, 'existing own Worker must remain live');
    const goal = treeApproachPoint(map, current, preferredCell);
    assert.equal(await page.cdp.evaluate(`window.__rtsEnvironmentCaptureCommand(${JSON.stringify({ type: 'move', ids: [worker.id], x: goal.x, z: goal.z })})`), true, 'ordinary live Move must reach the server');
    await page.wait(`window.__rtsTreeTargetCapture.snapshot().workers.some(w => w.id === ${worker.id} && Math.hypot(w.worldX - ${goal.x}, w.worldZ - ${goal.z}) < 2)`, 'legitimate Worker forest approach', 40000);
    await key(page, ' ', 'Space');
    await page.wait('window.__rtsTreeTargetCapture.snapshot().targets.some(t => t.forestCell !== undefined)', 'received forest visibility');
    return goal;
  };
  const record = async (checkpoint, details) => {
    const result = await capture({ page, mapId, checkpoint });
    assert.ok(result && path.isAbsolute(result.directory), 'owned checkpoint directory required');
    await writeFile(path.join(result.directory, 'tree-target.json'), JSON.stringify({ schemaVersion: 1,
      source, mapId, workerId: worker.id, ...details }, null, 2) + '\n');
  };
  const clickTarget = async (kind, checkpoint, outsideRoot = false, expected = null) => {
    state = await snapshot();
    const candidates = expected ? { ...state, targets: state.targets.filter(target => sameIdentity(target, expected)) } : state;
    const target = await findTreePixel(page, candidates, kind, outsideRoot);
    assert.ok(target, 'actual opaque registered tree pixel must be found');
    assert.ok(Number.isFinite(target.stock) && target.stock > 0, 'target must have current finite positive stock');
    const before = await page.cdp.evaluate('window.__rtsTreeIssuedOrders.length');
    await record(checkpoint + '-before', { epoch: state.epoch, target });
    await pointer(page, target.x, target.y, 'right');
    const issued = await page.wait(`window.__rtsTreeIssuedOrders.length > ${before} && window.__rtsTreeIssuedOrders.at(-1)`, 'actual pointer Gather send');
    assert.equal(issued.workerId, worker.id); assert.ok(sameIdentity(issued, target), 'issued Gather must match registered instance identity');
    await page.wait('document.querySelector("#order-status")?.dataset.state === "applied"', 'native order acceptance');
    await record(checkpoint + '-issued', { epoch: state.epoch, target, issued });
    check(checkpoint + '-native-existing-id', true);
    return target;
  };
  await clickTarget('node', 'wood-node');
  await key(page, 's', 'KeyS');
  const goal = await approach();
  await record('forest-approach', { goal });
  await clickTarget('forest', 'forest-ordinary');
  await key(page, 's', 'KeyS');
  state = await snapshot();
  const current = state.workers.find(w => w.id === worker.id);
  await page.cdp.call('Input.dispatchMouseEvent', { type: 'mouseWheel', x: current.x, y: current.y, deltaX: 0, deltaY: -1200 });
  await page.wait('window.__rtsTreeTargetCapture.snapshot().zoom > 2', 'ordinary pointer zoom');
  await clickTarget('forest', 'forest-crown', true);
  const depleted = await page.wait(`window.__rtsTreeTargetCapture.snapshot().rejected.some(t => t.reason === 'depleted') && window.__rtsTreeTargetCapture.snapshot()`, 'legitimate harvested forest depletion', 45000);
  await key(page, 's', 'KeyS');
  const rejected = depleted.rejected.find(t => t.reason === 'depleted');
  const picked = await page.cdp.evaluate(`window.__rtsTreeTargetCapture.pick(${rejected.root.x},${rejected.root.y})`);
  check('depleted-art-cannot-return-depleted-cell', !sameIdentity(picked, rejected));
  await record('depleted-forest', { epoch: depleted.epoch, rejected: { forestCell: rejected.forestCell, stock: rejected.stock }, picked });
  const hidden = depleted.rejected.find(t => t.reason === 'hidden');
  check('hidden-art-cannot-return-hidden-cell', hidden && !sameIdentity(await page.cdp.evaluate(`window.__rtsTreeTargetCapture.pick(${hidden.root.x},${hidden.root.y})`), hidden));
  if (hidden) await record('hidden-forest', { rejected: { forestCell: hidden.forestCell, reason: 'hidden' } });
  const epoch = (await snapshot()).epoch;
  await button(page, '#match-menu-toggle');
  await button(page, '#reset-army');
  await page.wait('document.querySelector("#room-lobby")?.open === true', 'normal reset returns to pregame');
  await launch();
  await page.wait(`window.__rtsTreeTargetCapture.snapshot().epoch > ${epoch} && window.__rtsTreeTargetCapture.snapshot().workers.length > 0`, 'normal reset forest lifetime');
  if (await page.cdp.evaluate('document.querySelector("#match-menu")?.hidden === false')) await button(page, '#match-menu-close');
  await button(page, '#camera-home-base');
  state = await snapshot(); worker = state.workers.find(w => Math.abs(w.depth) <= 1);
  assert.ok(worker, 'new match own Worker must be visible');
  await pointer(page, worker.x, worker.y); await key(page, ' ', 'Space');
  await page.wait(`window.__rtsTreeTargetCapture.snapshot().workers.some(w => w.id === ${worker.id} && w.selected)`, 'post-reset ordinary selection');
  await approach(rejected.forestCell);
  const reset = await snapshot();
  const restored = reset.targets.find(t => t.forestCell === rejected.forestCell);
  assert.ok(restored, 'previously depleted identity must be disclosed after real reset/approach');
  check('normal-reset-restores-depleted-forest-stock', reset.forestSlots === 3162 && restored.stock === 6);
  await record('reset-forest', { epoch: reset.epoch, forestSlots: reset.forestSlots, restored });
  await clickTarget('forest', 'forest-after-reset', false, rejected);
  return { status: checks.every(c => c.passed) ? 'passed' : 'blocked', checks };
}
