// Registered ordinary capture case. No browser/server launch or import effects.
import assert from 'node:assert/strict';
import path from 'node:path';
import { runNoviceScenario } from './renderer-qualification-novice.mjs';

export const id = 'novice-flow';
export const contextVersion = 1;

export function noviceCheckpointReady() {
  const map = window.__rtsEnvironmentStateSnapshot?.mapId;
  return map === 'veyrholds-terraced-vale'
    && document.querySelector('#map-select')?.value === map
    && ['ROOM LIVE', 'WAITING FOR PLAYER 2'].includes(document.querySelector('#network-status')?.textContent);
}

// Bounded DOM observations from the ordinary selected-Worker checkpoint. This
// accompanies the real GPU/movement captures; it cannot substitute for them.
export async function readWorkerPilot() {
  await document.fonts.ready;
  const visible = element => Boolean(element && !element.closest('[hidden]') && element.getClientRects().length);
  const bar = document.querySelector('.contextual-command-bar');
  const portrait = document.querySelector('[data-selection-portrait]');
  const rect = portrait?.getBoundingClientRect();
  const controls = [...document.querySelectorAll('.worker-primary-actions > button')];
  const bounds = bar?.getBoundingClientRect();
  const minimap = document.querySelector('.minimap-panel');
  const mapBounds = visible(minimap) ? minimap.getBoundingClientRect() : null;
  return { context: bar?.dataset.context, visible: visible(document.querySelector('[data-worker-hud]')),
    portrait: { visible: visible(portrait), width: rect?.width, height: rect?.height },
    legacyHidden: !visible(bar?.querySelector(':scope > .contextual-actions')),
    actions: controls.filter(visible).map(button => button.dataset.workerAction),
    clipped: controls.some(button => { const r = button.getBoundingClientRect(); return r.left < bounds.left || r.right > bounds.right || r.bottom > bounds.bottom; }),
    withinViewport: Boolean(bounds && bounds.left >= 0 && bounds.right <= innerWidth && bounds.top >= 0 && bounds.bottom <= innerHeight),
    clearOfMinimap: !mapBounds || bounds.right <= mapBounds.left || bounds.left >= mapBounds.right
      || bounds.bottom <= mapBounds.top || bounds.top >= mapBounds.bottom,
    fonts: document.fonts.check('14px "HUD DM Sans"') && document.fonts.check('26px "HUD Barlow Condensed"') };
}

export function validateWorkerPilot(receipt) {
  assert.equal(receipt?.context, 'workers'); assert.equal(receipt.visible, true);
  assert.equal(receipt.portrait?.visible, true);
  assert.equal(receipt.portrait.width, 72); assert.equal(receipt.portrait.height, 72);
  assert.equal(receipt.legacyHidden, true); assert.equal(receipt.clipped, false);
  assert.equal(receipt.withinViewport, true); assert.equal(receipt.clearOfMinimap, true);
  assert.deepEqual(receipt.actions, ['build', 'gather', 'repair', 'return', 'move', 'stop']);
  assert.equal(receipt.fonts, true);
}

export async function run({ version, page, origin, source, capture, evidenceDirectory }, { execute = runNoviceScenario } = {}) {
  assert.equal(version, contextVersion, 'novice case requires the shared version 1 context');
  assert.ok(typeof capture === 'function', 'novice case requires the shared capture hook');
  assert.ok(typeof evidenceDirectory === 'string' && path.isAbsolute(evidenceDirectory),
    'novice case requires the owned case artifact directory');
  let sharedCaptured = false;
  let workerPilotVerified = false;
  const result = await execute({ page, origin, evidenceDirectory,
    release: { sourceRevision: source?.revision, digest: source?.digest },
    onSelected: async () => {
      await page.wait(`(${noviceCheckpointReady.toString()})()`, 'synced Worker checkpoint');
      validateWorkerPilot(await page.cdp.evaluate(`(${readWorkerPilot.toString()})()`));
      workerPilotVerified = true;
      await capture({ page, mapId: 'veyrholds-terraced-vale', checkpoint: 'selected-worker' });
      sharedCaptured = true;
    } });
  const passed = result.status === 'passed' && sharedCaptured;
  return { status: passed ? 'passed' : 'failed', checks: [
    { id: 'normal-menu-worker-pointer-move', passed },
    { id: 'source-bound-worker-selection', passed: sharedCaptured },
    { id: 'live-worker-displacement-frames', passed: result.status === 'passed' && result.frames?.length === 2 },
    { id: 'worker-72px-primary-actions', passed: workerPilotVerified },
  ] };
}
