// Owned scenario only. The shared runner retains browser/pack/server lifetime.
// Actual lifecycle controls must be used with normal browser background policy.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { validateCaptureContext } from './renderer-capture-context.mjs';

export const id = 'browser-resume';
export const contextVersion = 1;
const mapId = 'veyrholds-terraced-vale';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const read = page => page.cdp.evaluate('window.__rtsBrowserRecoverySnapshot()');

async function pointer(page, x, y, button = 'left') {
  await page.cdp.call('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button, clickCount: 1 });
  await page.cdp.call('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button, clickCount: 1 });
}
async function click(page, selector) {
  const point = await page.wait(`(() => { const e=document.querySelector(${JSON.stringify(selector)});
    if (!e || e.disabled || e.hidden) return false; const r=e.getBoundingClientRect();
    return r.width && r.height && {x:r.x+r.width/2,y:r.y+r.height/2}; })()`, 'ordinary control');
  await pointer(page, point.x, point.y);
}
export function validateResume(before, hidden, after, hiddenStart = before) {
  assert.equal(hidden.visibility, 'hidden', 'a real hidden document is required');
  assert.equal(hidden.applied, hiddenStart.applied, 'background presentation must be bounded');
  assert.ok(hidden.pendingCount <= 1);
  assert.equal(after.visibility, 'visible'); assert.equal(after.recovering, false);
  assert.ok(after.tick > before.tick, 'authoritative server must advance across absence');
  assert.ok(after.applied > before.applied);
  assert.deepEqual(after.selected, before.selected);
  assert.deepEqual(after.camera, before.camera);
  assert.equal(after.worker.id, before.worker.id);
  assert.ok(Math.hypot(after.worker.renderX - after.worker.serverX,
    after.worker.renderZ - after.worker.serverZ) < 0.5, 'resume must present current coordinates');
}

export async function run(context) {
  validateCaptureContext(context);
  // CI-owned admission is intentionally explicit: the inherited renderer
  // launcher disables background throttling. Never accept that as this proof.
  if (context.backgroundPolicy !== 'default') return { status: 'blocked', checks: [
    { id: 'normal-browser-background-policy-required', passed: false }] };
  if (typeof context.evidenceDirectory !== 'string' || !path.isAbsolute(context.evidenceDirectory)) return { status: 'blocked', checks: [
    { id: 'owned-evidence-directory-required', passed: false }] };
  const { page, openPage, origin, capture } = context;
  const checks = [], samples = [];
  let windowId, outcome, restorationFailed = false;
  try {
    await page.cdp.call('Page.addScriptToEvaluateOnNewDocument', { source: `
      window.__rtsLifecycleEvents=[];
      for (const type of ['visibilitychange','freeze','resume']) document.addEventListener(type,event=>{
        if(window.__rtsLifecycleEvents.length<32) window.__rtsLifecycleEvents.push({
          type, trusted:event.isTrusted, visibility:document.visibilityState });
      });` });
    await page.cdp.call('Page.navigate', { url: origin });
    await click(page, '#menu-create-room');
    await page.wait('document.querySelector("#room-lobby").open && window.__rtsBrowserRecoverySnapshot', 'normal human lobby');
    const invite = await page.cdp.evaluate('location.href');
    assert.equal(new URL(invite).origin, origin);
    assert.equal(await page.cdp.evaluate('document.querySelector("#lobby-map").value'), mapId);
    const guest = await openPage();
    await guest.cdp.call('Page.navigate', { url: invite });
    await guest.wait('document.querySelector("#room-lobby").open', 'second human lobby');
    await click(guest, '#lobby-ready'); await click(page, '#lobby-ready'); await click(page, '#lobby-launch');
    await page.wait('!document.querySelector("#room-lobby").open && window.__rtsBrowserRecoverySnapshot()?.worker', 'ordinary launched match');
    checks.push({ id: 'normal-two-human-match', passed: true });
    await page.cdp.call('Page.bringToFront');
    const worker = (await read(page)).worker;
    await pointer(page, worker.screen.x, worker.screen.y);
    await page.wait(`window.__rtsBrowserRecoverySnapshot().selected.includes(${worker.id})`, 'one selected Worker');
    await pointer(page, worker.screen.x + 55, worker.screen.y + 25, 'right');
    await page.wait('window.__rtsBrowserRecoverySnapshot().worker.task === "moving"', 'real accepted move');
    await capture({ page, mapId, checkpoint: 'before-absence' });
    // A second owned browser window can blur the still-visible game. Its actual
    // visibility is asserted; it must not be confused with a hidden tab.
    const blurStart = await read(page);
    await guest.cdp.call('Page.bringToFront');
    const blurred = await page.wait('(() => {const s=window.__rtsBrowserRecoverySnapshot();return !s.focused && s;})()', 'actual window blur');
    assert.equal(blurred.visibility, 'visible');
    assert.equal(blurred.recovering, false);
    await page.cdp.call('Page.bringToFront');
    assert.deepEqual((await read(page)).selected, blurStart.selected);
    samples.push({ case: 'visible-blur', before: blurStart, blurred });
    checks.push({ id: 'blur-while-visible', passed: true });
    ({ windowId } = await page.cdp.call('Browser.getWindowForTarget'));
    for (const [name, duration] of [['short', 2500], ['long', 65000], ['switch-1', 500], ['switch-2', 500]]) {
      const before = await read(page);
      await page.cdp.call('Browser.setWindowBounds', { windowId, bounds: { windowState: 'minimized' } });
      await page.wait('document.visibilityState === "hidden"', 'real browser hidden state');
      const hiddenStart = await read(page);
      await sleep(duration);
      const hidden = await read(page);
      await page.cdp.call('Browser.setWindowBounds', { windowId, bounds: { windowState: 'normal' } });
      await page.cdp.call('Page.bringToFront');
      const after = await page.wait('(() => {const s=window.__rtsBrowserRecoverySnapshot();return s.visibility==="visible" && !s.recovering && s;})()', 'fresh resume', 10000);
      validateResume(before, hidden, after, hiddenStart);
      samples.push({ case: name, durationMs: duration, before, hiddenStart, hidden, after });
      await capture({ page, mapId, checkpoint: `resume-${name}` });
      checks.push({ id: `real-hidden-${name}`, passed: true });
    }
    const freezeStart = await read(page);
    await page.cdp.call('Page.setWebLifecycleState', { state: 'frozen' });
    await sleep(3000);
    await page.cdp.call('Page.setWebLifecycleState', { state: 'active' });
    const resumed = await page.wait('(() => {const s=window.__rtsBrowserRecoverySnapshot();return !s.recovering && s.tick>'+freezeStart.tick+' && s;})()', 'fresh freeze resume', 10000);
    assert.deepEqual(resumed.selected, freezeStart.selected); assert.deepEqual(resumed.camera, freezeStart.camera);
    const events = await page.cdp.evaluate('window.__rtsLifecycleEvents');
    assert.ok(events.some(event => event.type === 'freeze' && event.trusted));
    assert.ok(events.some(event => event.type === 'resume' && event.trusted));
    assert.ok(events.some(event => event.type === 'visibilitychange' && event.trusted && event.visibility === 'hidden'));
    checks.push({ id: 'real-browser-freeze-resume', passed: true });
    samples.push({ case: 'freeze', before: freezeStart, after: resumed, events });
    await capture({ page, mapId, checkpoint: 'freeze-resumed' });
    // Network impairment is separate from lifecycle. This provider control
    // does not modify game state, clocks or socket callbacks.
    await page.cdp.call('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    const interrupted = await page.wait('(() => {const s=window.__rtsBrowserRecoverySnapshot();return s.socketState !== 1 && s;})()', 'actual connection interruption', 15000);
    await page.cdp.call('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    const connected = await page.wait('(() => {const s=window.__rtsBrowserRecoverySnapshot();return s.socketState === 1 && !s.recovering && s;})()', 'connection recovery', 15000);
    samples.push({ case: 'network', interrupted, connected });
    await capture({ page, mapId, checkpoint: 'network-restored' });
    checks.push({ id: 'network-restored', passed: true });
    outcome = { status: 'passed', checks };
  } catch {
    outcome = { status: 'failed', checks: [...checks, { id: 'lifecycle-scenario-complete', passed: false }] };
  } finally {
    await page.cdp.call('Page.setWebLifecycleState', { state: 'active' }).catch(() => { restorationFailed = true; });
    if (windowId !== undefined) await page.cdp.call('Browser.setWindowBounds', { windowId, bounds: { windowState: 'normal' } }).catch(() => { restorationFailed = true; });
    await page.cdp.call('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }).catch(() => { restorationFailed = true; });
  }
  if (restorationFailed) outcome = { status: 'failed', checks: [...outcome.checks, { id: 'provider-state-restored', passed: false }] };
  await writeFile(path.join(context.evidenceDirectory, 'browser-resume.json'), `${JSON.stringify({
    schemaVersion: 1, source: context.source, backgroundPolicy: context.backgroundPolicy, ...outcome, samples }, null, 2)}\n`);
  return outcome;
}
