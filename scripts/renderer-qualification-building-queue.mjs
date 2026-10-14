// Bounded paid production through the ordinary HUD in the existing clean-pack
// renderer. No bank, queue, clock or selection mutation is exposed to the page.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { UNIT_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { BUILDING_ORIENTATION_CAPTURE_MAP } from './renderer-qualification-building-orientation.mjs';
import { rosterControlPoint } from './renderer-roster-audio-capture.mjs';
import { interactionTargetPoint } from './renderer-interaction-audio-scenario.mjs';

export const QUEUE_CAPTURE_MAP = Object.freeze({ ...BUILDING_ORIENTATION_CAPTURE_MAP,
  id: 'rendered-building-queue', name: 'Rendered building production queue' });
const snapshot = 'window.__rtsEnvironmentStateSnapshot';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

export function readQueueObservation(buildingId) {
  const state = window.__rtsEnvironmentStateSnapshot;
  const building = state?.buildings.find(row => row.id === buildingId);
  const list = document.querySelector('[data-building-queue-list]');
  return { mapId: state?.mapId, team: state?.team, bank: state?.bank,
    building: building ? { id: building.id, team: building.team, type: building.type, complete: building.complete,
      queue: building.productionQueue, remaining: building.trainingRemaining, blocked: building.productionBlocked } : null,
    selected: window.__rtsInteractionAudioSnapshot().buildings.some(row => row.id === buildingId && row.selected),
    controls: [...(list?.querySelectorAll('button') || [])].map(button => ({
      index: Number(button.dataset.queueIndex), label: button.textContent, enabled: !button.disabled
        && button.getAttribute('aria-disabled') !== 'true' && !button.closest('[hidden]'),
    })), focus: document.activeElement?.dataset.queueIndex ?? null };
}

export function validateQueueObservation(observation, queue) {
  assert.equal(observation.mapId, QUEUE_CAPTURE_MAP.id); assert.equal(observation.team, 0);
  assert.equal(observation.building?.team, observation.team); assert.equal(observation.building.type, 'barracks');
  assert.equal(observation.building.complete, true); assert.equal(observation.selected, true);
  assert.deepEqual(observation.building.queue, queue);
  assert.ok(Number.isFinite(observation.bank?.food) && Number.isFinite(observation.bank?.wood));
  assert.ok(Number.isFinite(observation.building.remaining) && observation.building.remaining >= 0);
  assert.equal(observation.controls.length, queue.length);
  for (const [index, kind] of queue.entries()) {
    const control = observation.controls[index];
    assert.equal(control.index, index); assert.equal(control.enabled, true);
    assert.equal(control.label, `${index + 1}. ${UNIT_DEFINITIONS[kind].label} · Cancel`);
  }
}

export function validateQueueRefund(before, after, index) {
  const kinds = before.building.queue;
  validateQueueObservation(before, kinds);
  validateQueueObservation(after, kinds.filter((_, position) => position !== index));
  assert.equal(after.building.id, before.building.id);
  const kind = kinds[index], rule = UNIT_DEFINITIONS[kind];
  assert.ok(rule, 'cancelled slot must identify a registered paid unit');
  const refund = { food: after.bank.food - before.bank.food, wood: after.bank.wood - before.bank.wood };
  if (index > 0) assert.deepEqual(refund, rule.cost, 'waiting slot must refund its exact complete price');
  else {
    assert.ok(before.building.remaining > 0 && before.building.remaining < rule.trainSeconds,
      'active cancellation must follow actual productive training');
    const fractions = [];
    for (const resource of ['food', 'wood']) {
      if (!rule.cost[resource]) assert.equal(refund[resource], 0);
      else {
        assert.ok(refund[resource] > 0 && refund[resource] < rule.cost[resource], 'active slot refunds only unfinished work');
        fractions.push(refund[resource] / rule.cost[resource]);
      }
    }
    assert.ok(fractions.every(value => Math.abs(value - fractions[0]) < 1e-6), 'both resources retain the same unfinished fraction');
    assert.ok(fractions[0] <= before.building.remaining / rule.trainSeconds + 1e-6,
      'active refund cannot exceed the observed unfinished work');
  }
  return { kind, index, refund };
}

export async function captureBuildingQueue(page, directory, { source, release, onStage = () => {} } = {}) {
  const report = { schemaVersion: 1, scope: 'authored-map-paid-building-queue-native-HUD',
    source, release, mapId: QUEUE_CAPTURE_MAP.id, team: 0, status: 'failed', frames: [], transitions: [], attempts: [],
    appearanceReview: 'pending', ordinaryTinyAcceptance: 'unverified' };
  const file = path.join(directory, 'building-queue.json');
  const persist = () => writeFile(file, JSON.stringify(report, null, 2) + '\n');
  const point = async position => {
    assert.ok(position && Number.isFinite(position.x) && Number.isFinite(position.y), 'visible input point required');
    for (const type of ['mousePressed', 'mouseReleased'])
      await page.cdp.call('Input.dispatchMouseEvent', { type, ...position, button: 'left', clickCount: 1 });
  };
  const click = async selector => point(await page.wait(
    `(${rosterControlPoint.toString()})(${JSON.stringify(selector)})`, 'visible enabled queue scenario control'));
  let buildingId;
  const observe = () => page.cdp.evaluate(`(${readQueueObservation.toString()})(${buildingId})`);
  const waitQueue = queue => page.wait(`JSON.stringify(${snapshot}?.buildings.find(b=>b.id===${buildingId})?.productionQueue)===${JSON.stringify(JSON.stringify(queue))}`, 'authoritative ordered queue');
  async function retainRefund(input, before, index) {
    const after = await observe();
    report.attempts.push({ input, index, before, after }); await persist();
    report.transitions.push({ input, ...validateQueueRefund(before, after, index) }); await persist();
  }
  async function capture(name, queue) {
    onStage(name);
    const before = await observe(); validateQueueObservation(before, queue);
    const frame = await page.cdp.evaluate('window.__rtsQualification.request()');
    assert.match(frame.version, /^WebGL 2\.0/); assert.equal(frame.contextLost, false); assert.equal(frame.glError, 0);
    const prior = report.frames.at(-1);
    assert.ok(Number.isInteger(frame.number) && frame.number > (prior?.number ?? 0)
      && Number.isFinite(frame.time) && frame.time > (prior?.time ?? 0), 'rendered frame identity must advance');
    assert.ok(frame.pixels.length === 192 && frame.pixels.every(value => Number.isInteger(value) && value >= 0 && value <= 255)
      && new Set(frame.pixels).size > 2, 'actual varied WebGL frame required');
    const png = Buffer.from((await page.cdp.call('Page.captureScreenshot', { format: 'png', fromSurface: true })).data, 'base64');
    const canvas = Buffer.from(frame.canvasPng, 'base64');
    for (const bytes of [png, canvas]) assert.ok(bytes.length > 10000
      && bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')), 'actual PNG required');
    assert.equal(png.readUInt32BE(16), 1280); assert.equal(png.readUInt32BE(20), 720);
    assert.equal(canvas.readUInt32BE(16), frame.canvasWidth); assert.equal(canvas.readUInt32BE(20), frame.canvasHeight);
    await writeFile(path.join(directory, name + '.png'), png);
    await writeFile(path.join(directory, name + '-canvas.png'), canvas);
    const after = await observe(); validateQueueObservation(after, queue);
    report.frames.push({ name, number: frame.number, time: frame.time, before, after,
      pngSha256: hash(png), canvasSha256: hash(canvas) }); await persist();
  }
  try {
    onStage('queue-map'); await persist();
    assert.equal(await page.cdp.evaluate(`window.__rtsEnvironmentCaptureCommand(${JSON.stringify({ type: 'publishMap', map: QUEUE_CAPTURE_MAP })})`), true);
    await page.wait(`${snapshot}?.mapId===${JSON.stringify(QUEUE_CAPTURE_MAP.id)}&&${snapshot}.team===0`, 'applied owned queue fixture');
    if (await page.cdp.evaluate('document.querySelector("#command-deck").hidden')) await click('#dock-toggle');
    await click('#dock-tab-economy'); await click('#select-workers'); await click('#build-barracks');
    const rect = await page.cdp.evaluate('(()=>{const r=document.querySelector("#viewport canvas").getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}})()');
    let pointer, ghost;
    for (const [x, y] of [[.5,.5],[.55,.45],[.45,.55],[.6,.4],[.4,.6]]) {
      pointer = { x: rect.x + rect.width * x, y: rect.y + rect.height * y };
      await page.cdp.call('Input.dispatchMouseEvent', { type: 'mouseMoved', ...pointer });
      ghost = await page.wait('window.__rtsBuildingPlacementSnapshot?.active&&window.__rtsBuildingPlacementSnapshot', 'paid queue placement preview');
      if (ghost.visible && ghost.valid) break;
    }
    assert.equal(ghost.visible, true); assert.equal(ghost.valid, true); await point(pointer);
    const building = await page.wait(`${snapshot}?.buildings.find(b=>b.type==='barracks'&&b.team===0&&b.complete)`, 'paid Barracks completion', 60000);
    buildingId = building.id;
    assert.equal(await page.cdp.evaluate(`${snapshot}.bank.wood`), QUEUE_CAPTURE_MAP.startingResources.wood - 175);
    if (!await page.cdp.evaluate('document.querySelector("#command-deck").hidden')) await click('#dock-toggle');
    await point(await page.wait(`(${interactionTargetPoint.toString()})('building',${buildingId})`, 'ordinary Barracks picking'));
    const queue = ['spearman', 'infantry', 'spearman'];
    for (const kind of queue) await click(`[data-context-products] [data-product="${kind}"]`);
    await waitQueue(queue); await capture('building-queue-mixed', queue);
    let before = await observe(); await click('[data-queue-index="1"]'); await waitQueue(['spearman', 'spearman']);
    await retainRefund('pointer', before, 1);
    await capture('building-queue-waiting-cancelled', ['spearman', 'spearman']);
    // Readback/PNG transfer can consume most of the first 12-second timer on
    // the cloud renderer. Let that paid unit finish naturally, then buy one
    // waiting Spearman behind its fresh successor. No clock or stock mutation.
    onStage('building-queue-fresh-active-head');
    await waitQueue(['spearman']);
    const paidBefore = await observe();
    await click('[data-context-products] [data-product="spearman"]'); await waitQueue(['spearman', 'spearman']);
    const paidAfter = await observe();
    assert.deepEqual({ food: paidBefore.bank.food - paidAfter.bank.food,
      wood: paidBefore.bank.wood - paidAfter.bank.wood }, UNIT_DEFINITIONS.spearman.cost);
    report.replenishment = { before: paidBefore, after: paidAfter }; await persist();
    await page.wait(`${snapshot}.buildings.find(b=>b.id===${buildingId}).trainingRemaining<${UNIT_DEFINITIONS.spearman.trainSeconds}`, 'fresh active Spearman timer advances');
    before = await observe(); await click('[data-queue-index="0"]'); await waitQueue(['spearman']);
    await retainRefund('pointer', before, 0);
    await capture('building-queue-active-cancelled', ['spearman']);
    await page.wait(`${snapshot}.buildings.find(b=>b.id===${buildingId}).trainingRemaining<${UNIT_DEFINITIONS.spearman.trainSeconds}`, 'next paid head timer advances');
    before = await observe(); assert.equal(before.focus, '0', 'queue refresh preserves keyboard focus');
    for (const type of ['keyDown', 'keyUp']) await page.cdp.call('Input.dispatchKeyEvent', { type, key: 'Enter', code: 'Enter' });
    await waitQueue([]); await retainRefund('Enter', before, 0);
    await capture('building-queue-empty', []); report.status = 'captured-needs-review';
    return report;
  } finally { await persist(); }
}
