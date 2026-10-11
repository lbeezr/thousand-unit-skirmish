// The only extra actor is a fresh owned second seat. It uses the public Join
// Room dialog and ordinary Attack/Stop orders; no state or health is injected.
import assert from 'node:assert/strict';
import { clickNovicePoint } from './renderer-qualification-novice.mjs';
import { interactionTargetPoint } from './renderer-interaction-audio-scenario.mjs';
import { validateStagingOrigin } from './renderer-roster-audio-plan.mjs';

// Host Repair uses its normal friendly-building picker. This observer must not
// validate the guest attack: it deliberately cannot return an enemy building.
export function repairBuildingPoint(id, x, z) {
  if (!Number.isSafeInteger(id) || id < 0 || ![x, z].every(Number.isFinite)) return null;
  for (const lift of [0, .5, 1, 1.5, 2, 3]) {
    const center = window.__rtsInteractionAudioProject(x, z, lift);
    if (!center) continue;
    for (const dx of [0, -8, 8, -16, 16]) for (const dy of [0, -8, 8]) {
      const point = { x: center.x + dx, y: center.y + dy };
      const picked = window.__rtsInteractionAudioPick(point.x, point.y);
      if (picked?.kind === 'building' && picked.id === id) return point;
    }
  }
  return null;
}
// The disclosed paid House has a solid body at this lift. Projection only
// establishes an uncovered canvas point; the ordinary attack acknowledgement
// and subsequent damage to this exact House establish the actual target.
export function repairAttackPoint(x, z) {
  if (![x, z].every(Number.isFinite)) return null;
  return window.__rtsInteractionAudioProject(x, z, 1);
}
export function validateRepairHealth(before, after, buildingId) {
  for (const row of [before, after]) {
    assert.equal(row?.id, buildingId); assert.equal(row?.team, 0); assert.equal(row?.type, 'house');
    assert.equal(row?.complete, true);
    assert.ok(Number.isFinite(row.hp) && Number.isFinite(row.maxHp) && row.hp > 0 && row.maxHp > 0 && row.hp <= row.maxHp);
  }
  assert.equal(after.maxHp, before.maxHp); assert.ok(before.hp < before.maxHp, 'real prior damage is required');
  assert.ok(after.hp > before.hp, 'ordinary paid Repair must increase disclosed health');
  return { buildingId, beforeHp: before.hp, afterHp: after.hp, maxHp: before.maxHp };
}
const snapshot = 'window.__rtsInteractionAudioSnapshot()';
const building = id => `window.__rtsEnvironmentStateSnapshot?.buildings.find(b => b.id === ${id} && b.team === 0 && b.type === 'house' && b.complete)`;
async function key(page, value) {
  await page.cdp.call('Input.dispatchKeyEvent', { type: 'keyDown', key: value, code: `Key${value.toUpperCase()}` });
  await page.cdp.call('Input.dispatchKeyEvent', { type: 'keyUp', key: value, code: `Key${value.toUpperCase()}` });
}
async function selectUnit(page, id) {
  const point = await page.wait(`(${interactionTargetPoint.toString()})('unit',${id})`, 'exact owned unit pixel');
  await clickNovicePoint(page, point);
}
async function housePoint(page, house) {
  return page.wait(`(${repairBuildingPoint.toString()})(${house.id},${house.x},${house.z})`, 'exact visible paid House pixel');
}
export async function captureWorkerRepair({ page, openGuest, origin, mapId, build, record, control, signal,
  evidence = async () => {}, progress = async () => {} }) {
  validateStagingOrigin(origin); assert.equal(typeof openGuest, 'function');
  let guest, roomCode = null;
  const receipt = { method: 'ordinary-two-seat-attack-stop-repair', status: 'preparing', guestDisposed: false };
  const check = () => signal?.throwIfAborted();
  const step = async stage => { check(); await progress(stage); };
  try {
    await step('build-house');
    const placed = await build('house');
    await step('house-ready');
    const house = await page.cdp.evaluate(building(placed.id));
    assert.ok(house?.complete && house.hp === house.maxHp && house.hp > 10);
    receipt.buildingId = house.id; receipt.initialHp = house.hp;
    await evidence({ ...receipt });
    // Clear builders and set all host units to Stop/No attack so they cannot
    // kill the one guest Infantry approaching the structure.
    await step('clear-host-units');
    await key(page, 'a');
    const workers = (await page.cdp.evaluate(snapshot)).units.filter(unit => unit.kind === 'worker').map(unit => unit.id);
    assert.ok(workers.length > 0);
    const parking = await page.wait('window.__rtsInteractionAudioProject(-22.5,-10.5)', 'ordinary clear parking point');
    await clickNovicePoint(page, parking, 'right');
    await page.wait(`(() => { const rows=window.__rtsEnvironmentStateSnapshot?.workers.filter(w => ${JSON.stringify(workers)}.includes(w.id));
      return rows?.length === ${workers.length} && rows.every(w => Math.hypot(w.x-(${house.x}),w.z-(${house.z})) > 6); })()`, 'builders clear the attack target', 30000);
    await step('host-stop');
    await key(page, 's');
    await page.wait('document.querySelector("#order-status")?.dataset.state === "applied" && document.querySelector("#order-status").textContent.startsWith("STOP ORDER")', 'host Stop applied');
    await page.wait('Array.from(document.querySelectorAll("[data-combat-stance=noAttack]")).some(e => !e.closest("[hidden]") && e.getAttribute("aria-pressed") === "true")', 'host military shows No attack');
    await step('guest-open');
    roomCode = await page.cdp.evaluate('new URL(location.href).searchParams.get("room")');
    assert.ok(typeof roomCode === 'string' && /^[A-Za-z0-9_-]{32}$/.test(roomCode), 'fresh room code required');
    guest = await openGuest(); check();
    assert.equal(await guest.cdp.evaluate('location.href'), 'about:blank');
    await guest.cdp.call('Page.addScriptToEvaluateOnNewDocument', { source: 'window.__rtsCaptureDiagnostics=true;' });
    await step('guest-menu');
    await guest.cdp.call('Page.navigate', { url: `${origin}/` });
    await guest.wait('document.documentElement?.dataset.entry === "menu" && document.querySelector("#menu-join")?.disabled === false', 'guest public menu');
    await step('guest-join');
    await control(guest, '#menu-join');
    await control(guest, '#menu-join-dialog input');
    await guest.cdp.call('Input.insertText', { text: roomCode }); roomCode = null;
    await control(guest, '#menu-join-dialog button[type="submit"]');
    await step('guest-seat');
    await guest.wait(`window.__rtsInteractionAudioSnapshot?.().mapId === ${JSON.stringify(mapId)} && ${snapshot}.team === 1`, 'fresh guest owns only the second seat', 35000);
    await step('guest-camera');
    await control(guest, '#camera-fit-map');
    await step('guest-unit');
    const infantry = (await guest.cdp.evaluate(snapshot)).units.find(unit => unit.kind === 'infantry' && unit.point);
    assert.ok(infantry); await selectUnit(guest, infantry.id);
    await step('guest-target');
    const attackPoint = await guest.wait(`(${repairAttackPoint.toString()})(${house.x},${house.z})`, 'visible disclosed enemy House body pixel');
    await step('guest-attack');
    await clickNovicePoint(guest, attackPoint, 'right');
    await guest.wait('document.querySelector("#order-status")?.dataset.state === "applied" && document.querySelector("#order-status").textContent.startsWith("ATTACK BUILDING ORDER")', 'ordinary guest building attack applied');
    await step('house-damage');
    await page.wait(`(() => { const b=${building(house.id)}; return b && b.hp > 0 && b.hp <= b.maxHp-10 && b; })()`, 'actual enemy hits damage paid House', 60000);
    await step('guest-stop');
    await key(guest, 's');
    await guest.wait('document.querySelector("#order-status")?.dataset.state === "applied" && document.querySelector("#order-status").textContent.startsWith("STOP ORDER")', 'guest attack stops');
    await guest.wait('Array.from(document.querySelectorAll("[data-combat-stance=noAttack]")).some(e => !e.closest("[hidden]") && e.getAttribute("aria-pressed") === "true")', 'guest Infantry shows No attack');
    const damaged = await page.cdp.evaluate(building(house.id));
    assert.ok(damaged?.hp > 0 && damaged.hp < damaged.maxHp);
    receipt.status = 'damaged'; receipt.damagedHp = damaged.hp; receipt.guestAttackStopped = true;
    await evidence({ ...receipt });
    await step('host-worker');
    await selectUnit(page, workers[0]);
    await step('repair-recording');
    await record('unit.worker.repair', async () => {
      await step('repair-order');
      await control(page, '[data-worker-action="repair"]');
      await clickNovicePoint(page, await housePoint(page, house));
      await page.wait('document.querySelector("#order-status")?.dataset.state === "applied" && document.querySelector("#order-status").textContent.startsWith("REPAIR ORDER")', 'ordinary tracked Repair applied');
    });
    await step('repair-health');
    const repaired = await page.wait(`(() => { const b=${building(house.id)}; return b && b.hp > ${damaged.hp} && b; })()`, 'paid Repair increases health', 45000);
    receipt.health = validateRepairHealth(damaged, repaired, house.id);
    receipt.status = 'repaired'; await evidence({ ...receipt });
    return receipt;
  } finally {
    roomCode = null;
    if (guest) { await guest.dispose(); receipt.guestDisposed = true; await evidence({ ...receipt }); }
  }
}
