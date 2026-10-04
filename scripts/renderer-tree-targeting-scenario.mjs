// Owned adapter for the shared qualified ordinary-game runner; no launcher or CLI.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
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
  const { page, origin, source, capture } = validateCaptureContext(value);
  const checks = [];
  const check = (id, passed) => checks.push({ id, passed: Boolean(passed) });
  await page.cdp.call('Page.addScriptToEvaluateOnNewDocument', {
    source: `(${installTreeOrderProbe.toString()})(${projectTreeOrder.toString()})`,
  });
  await page.cdp.call('Page.navigate', { url: origin + '/' });
  await page.wait('document.querySelector("#menu-new-game")?.disabled === false', 'normal New Game menu');
  await button(page, '#menu-new-game');
  await page.wait('window.__rtsTreeTargetCapture && document.querySelector("#map-select")?.options.length > 1', 'normal game map picker');
  await button(page, '#match-menu-toggle');
  // Invoke the ordinary map selector's change handler, which issues the normal
  // host map command. Never alter mapDefinition, stock, units or sprite clips.
  assert.equal(await page.cdp.evaluate(`(() => { const select = document.querySelector('#map-select');
    if (select.disabled || ![...select.options].some(o => o.value === ${JSON.stringify(mapId)})) return false;
    select.value = ${JSON.stringify(mapId)}; select.dispatchEvent(new Event('change',{bubbles:true})); return true; })()`), true);
  await page.wait(`window.__rtsEnvironmentStateSnapshot?.mapId === ${JSON.stringify(mapId)} && window.__rtsTreeTargetCapture.snapshot().workers.length > 0`, 'canonical applied map and own Worker');
  await button(page, '#match-menu-close');
  const snapshot = () => page.cdp.evaluate('window.__rtsTreeTargetCapture.snapshot()');
  let state = await snapshot();
  assert.equal(state.mapId, mapId); assert.equal(state.forestSlots, 3162);
  check('normal-menu-canonical-forest-registration', true);
  const worker = state.workers.find(w => Math.abs(w.depth) <= 1);
  assert.ok(worker, 'own visible Worker required');
  await pointer(page, worker.x, worker.y); await key(page, ' ', 'Space');
  const record = async (checkpoint, details) => {
    const result = await capture({ page, mapId, checkpoint });
    assert.ok(result && path.isAbsolute(result.directory), 'owned checkpoint directory required');
    await writeFile(path.join(result.directory, 'tree-target.json'), JSON.stringify({ schemaVersion: 1,
      source, mapId, workerId: worker.id, ...details }, null, 2) + '\n');
  };
  const clickTarget = async (kind, checkpoint, outsideRoot = false) => {
    state = await snapshot();
    const target = await findTreePixel(page, state, kind, outsideRoot);
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
  await clickTarget('forest', 'forest-ordinary');
  await key(page, 's', 'KeyS');
  await clickTarget('node', 'wood-node');
  await key(page, 's', 'KeyS');
  state = await snapshot();
  await page.cdp.call('Input.dispatchMouseEvent', { type: 'mouseWheel', x: worker.x, y: worker.y, deltaX: 0, deltaY: -1200 });
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
  await page.wait(`window.__rtsTreeTargetCapture.snapshot().epoch > ${epoch}`, 'normal reset forest lifetime');
  await button(page, '#match-menu-close');
  const reset = await snapshot();
  check('normal-reset-preserves-registered-forest', reset.forestSlots === 3162 && reset.targets.every(t => t.stock > 0));
  await record('reset-forest', { epoch: reset.epoch, forestSlots: reset.forestSlots });
  return { status: checks.every(c => c.passed) ? 'passed' : 'blocked', checks };
}
