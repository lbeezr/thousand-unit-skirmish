// Automated ordinary New Game evidence, separate from unassisted human play.
// CI owns packed-server/browser lifetime; this adapter only uses its fresh page.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { isSourceRevision, isReleaseDigest } from '../src/server/build-identity.mjs';
import { checkServedBuildIdentity } from './check-served-build-identity.mjs';
import { installMinimapCameraProbe } from './minimap-browser-probe.mjs';
import { validateFrame, validateMotion } from './renderer-qualification.mjs';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

// Reduce immediately; never retain welcome objects, tokens or raw socket data.
export function reduceNoviceMessage(message, priorTeam = null) {
  if (!message || !['welcome', 'state', 'mapChange'].includes(message.type)) return null;
  const team = message.type === 'welcome' ? message.player?.team : priorTeam;
  if (![0, 1].includes(team)) return null;
  const state = message.type === 'state' ? message : message.state;
  if (!state || !Number.isSafeInteger(state.tick) || state.tick < 0 || !Array.isArray(state.units)) return null;
  const safeId = value => typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,79}$/.test(value) ? value : null;
  const workers = state.units.filter(row => Array.isArray(row) && row[1] === team && row[5] === 'worker'
    && Number.isSafeInteger(row[0]) && row[0] >= 0 && Number.isFinite(row[2]) && Number.isFinite(row[3])
    && Number.isFinite(row[4]) && row[4] > 0 && Number.isInteger(row[8]) && row[8] > 0 && row[8] <= 0xffffffff
    && ['idle', 'moving', 'holding', 'patrolling', 'following', 'gathering', 'returning', 'building', 'repairing', 'attacking'].includes(row[9]))
    .slice(0, 32).map(row => ({ id: row[0], team, x: row[2], z: row[3], hp: row[4], generation: row[8], task: row[9] }));
  const map = message.map;
  return { team, tick: state.tick, mapId: safeId(state.mapId),
    matchModeId: safeId(state.matchModeId ?? message.matchModeId),
    matchModeVersion: Number.isInteger(state.matchModeVersion ?? message.matchModeVersion)
      ? state.matchModeVersion ?? message.matchModeVersion : null,
    armySize: Number.isInteger(state.armySize) && state.armySize >= 0 ? state.armySize : null,
    map: map && Number.isInteger(map.width) && Number.isInteger(map.height)
      && map.width > 0 && map.width <= 512 && map.height > 0 && map.height <= 512
      ? { id: safeId(map.id), width: map.width, height: map.height } : null, workers };
}

export function reduceNoviceCommand(command) {
  if (command?.type !== 'move') return null;
  if (!Array.isArray(command.ids) || !command.ids.length || command.ids.length > 32
    || !command.ids.every(id => Number.isSafeInteger(id) && id >= 0)
    || !Array.isArray(command.unitGenerations) || command.unitGenerations.length !== command.ids.length
    || !command.unitGenerations.every(generation => Number.isInteger(generation) && generation > 0 && generation <= 0xffffffff)
    || !Number.isFinite(command.x) || !Number.isFinite(command.z)
    || !Number.isSafeInteger(command.clientOrderToken) || command.clientOrderToken <= 0) return null;
  return { type: 'move', ids: [...command.ids], unitGenerations: [...command.unitGenerations],
    x: command.x, z: command.z, clientOrderToken: command.clientOrderToken };
}

export function installNoviceProbe(reduceMessage, reduceCommand) {
  const probe = window.__rtsNovice = { team: null, latest: null, map: null, sent: [],
    stateAt: null, number: 0, camera: null, cameraSamples: 0, errors: [], droppedErrors: 0, droppedCommands: 0 };
  const fault = kind => { if (probe.errors.length < 100) probe.errors.push({ kind }); else probe.droppedErrors++; };
  const NativeSocket = window.WebSocket, observedSockets = new WeakSet();
  window.WebSocket = class extends NativeSocket {
    constructor(...args) {
      super(...args);
      try { const url = new URL(args[0], location.href);
        if (url.host !== location.host || url.pathname !== '/ws' || !['ws:', 'wss:'].includes(url.protocol)) return;
      } catch { return; }
      observedSockets.add(this);
      this.addEventListener('message', event => {
        try {
          const safe = reduceMessage(JSON.parse(event.data), probe.team);
          if (!safe) return;
          probe.team = safe.team; probe.map = safe.map ?? probe.map;
          probe.latest = safe; probe.stateAt = performance.now();
        } catch { fault('protocol-observation-failed'); }
      });
    }
    send(data) {
      // Observation must never prevent or replace the native send.
      if (observedSockets.has(this)) try {
        const safe = reduceCommand(JSON.parse(data));
        if (safe) { if (probe.sent.length < 16) probe.sent.push(safe); else probe.droppedCommands++; }
      } catch { fault('command-observation-failed'); }
      return super.send(data);
    }
  };
  const nativeError = console.error.bind(console);
  console.error = (...args) => { fault('console-error'); nativeError(...args); };
  window.addEventListener('error', event => fault(event.target === window ? 'exception' : 'resource-error'), true);
  window.addEventListener('unhandledrejection', () => fault('promise-rejection'));
  const nativeRaf = window.requestAnimationFrame.bind(window);
  let pending = null;
  probe.request = workerId => new Promise(resolve => {
    if (pending) throw Error('A frame request is already pending');
    pending = { workerId, resolve };
  });
  window.requestAnimationFrame = callback => nativeRaf(time => {
    callback(time); probe.number++;
    if (!pending) return;
    const canvas = document.querySelector('#viewport canvas'), gl = canvas?.getContext('webgl2');
    if (!gl) { pending.resolve({ number: probe.number, time, version: null }); pending = null; return; }
    const worker = probe.latest?.workers.find(row => row.id === pending.workerId);
    const pixels = [], pixel = new Uint8Array(4), observedAt = probe.stateAt;
    for (let y = 0; y < 6; y++) for (let x = 0; x < 8; x++) {
      gl.readPixels(Math.floor((x + .5) * gl.drawingBufferWidth / 8),
        Math.floor((y + .5) * gl.drawingBufferHeight / 6), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      pixels.push(...pixel);
    }
    pending.resolve({ number: probe.number, time, worker: worker ? { ...worker } : null,
      tick: probe.latest?.tick, observedAt, stateAgeMs: performance.now() - observedAt,
      version: gl.getParameter(gl.VERSION), contextLost: gl.isContextLost(), glError: gl.getError(), pixels,
      canvasWidth: gl.drawingBufferWidth, canvasHeight: gl.drawingBufferHeight,
      canvasPng: canvas.toDataURL('image/png').split(',')[1] });
    pending = null;
  });
}

export const noviceBeforeScript = `(${installNoviceProbe.toString()})(${reduceNoviceMessage.toString()},${reduceNoviceCommand.toString()})`;

// Serialized read-only browser code; no arbitrary DOM/protocol strings returned.
export function readNoviceUi() {
  const visible = element => {
    if (!element || element.hidden || !element.getClientRects().length) return false;
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  };
  const button = document.querySelector('#menu-new-game'), bar = document.querySelector('.contextual-command-bar');
  const feedback = document.querySelector('#field-order-feedback');
  const query = new URL(location.href).searchParams;
  const seed = key => /^\d{1,10}$/.test(query.get(key) ?? '') && Number(query.get(key)) <= 0xffffffff ? Number(query.get(key)) : null;
  const probe = window.__rtsNovice;
  return { entry: ['menu', 'game'].includes(document.documentElement.dataset.entry) ? document.documentElement.dataset.entry : null,
    ready: document.documentElement.dataset.boot === 'ready', canvas: Boolean(document.querySelector('#viewport canvas')),
    menu: { visible: visible(button), enabled: Boolean(button && !button.disabled) },
    selected: Number(document.querySelector('#selected-total')?.textContent) || 0,
    context: ['none', 'workers', 'military', 'mixed', 'boats', 'building'].includes(bar?.dataset.context) ? bar.dataset.context : null,
    contextVisible: visible(bar),
    feedback: { visible: visible(feedback), state: ['ready', 'pending', 'planning', 'applied', 'failed'].includes(feedback?.dataset.state) ? feedback.dataset.state : null,
      text: /^MOVE ORDER · \d{1,5} UNITS$/.test(feedback?.textContent ?? '') ? feedback.textContent : null },
    mode: query.get('mode') === 'pve' ? 'pve' : null, mapSeed: seed('mapSeed'), policySeed: seed('policySeed'),
    diagnosticEntry: ['play', 'resume', 'rendererCapture', 'workerSpritePreview', 'unitSpritePreview', 'meshyInfantrySpritePreview',
      'humanVaeloraPreview', 'humanAnimationPreview', 'humanRosterPreview', 'castPreview', 'frontierBuildingsPreview'].some(key => query.has(key)),
    roomEntry: query.has('room'), team: probe?.team ?? null, latest: probe?.latest ?? null, map: probe?.map ?? null,
    sent: probe?.sent ?? [], frameNumber: probe?.number ?? 0,
    time: performance.now(), stateAt: probe?.stateAt ?? null, errors: probe?.errors ?? [],
    droppedErrors: probe?.droppedErrors ?? 0, droppedCommands: probe?.droppedCommands ?? 0 };
}

export async function clickNovicePoint(page, point, button = 'left') {
  assert.ok(Number.isFinite(point?.x) && Number.isFinite(point?.y)
    && point.x > 0 && point.x < 1280 && point.y > 0 && point.y < 720, 'pointer point must be inside the viewport');
  assert.ok(['left', 'right'].includes(button), 'only native selection and Move clicks are admitted');
  await page.cdp.call('Page.bringToFront');
  for (const type of ['mousePressed', 'mouseReleased']) await page.cdp.call('Input.dispatchMouseEvent', {
    type, x: point.x, y: point.y, button, clickCount: 1, modifiers: 0,
  });
}

// Uses the cached terrain module's existing active field without modifying it.
export async function projectNoviceTargets() {
  const THREE = await import('/vendor/three.module.js');
  const { groundHeight } = await import('/src/terrain-height.mjs');
  const probe = window.__rtsNovice, sample = probe.camera;
  const canvas = document.querySelector('#viewport canvas'), rect = canvas.getBoundingClientRect();
  const camera = new THREE.OrthographicCamera(...sample.frustum, .1, 1000);
  camera.position.fromArray(sample.position); camera.quaternion.fromArray(sample.quaternion);
  camera.zoom = sample.zoom; camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
  const project = (x, z, lift) => {
    const p = new THREE.Vector3(x, groundHeight(x, z) + lift, z).project(camera);
    const point = { x: rect.left + (p.x + 1) * rect.width / 2, y: rect.top + (1 - p.y) * rect.height / 2 };
    return p.z >= -1 && p.z <= 1 && point.x > 0 && point.x < innerWidth && point.y > 0 && point.y < innerHeight
      && document.elementFromPoint(point.x, point.y) === canvas ? point : null;
  };
  const candidates = probe.latest.workers.map(worker => ({ worker, point: project(worker.x, worker.z, .65) }))
    .filter(candidate => candidate.point);
  const destination = { x: probe.team === 0 ? -57.5 : 57.5, z: 7.5 };
  return { candidates, destination, destinationPoint: project(destination.x, destination.z, 0) };
}

export function validateNoviceOrder(start, command, destination, ui) {
  assert.equal(command?.type, 'move', 'native pointer must submit Move');
  assert.deepEqual(command.ids, [start.worker.id], 'Move must retain the pointer-selected Worker');
  assert.deepEqual(command.unitGenerations, [start.worker.generation], 'Move must retain Worker generation');
  assert.ok(Math.hypot(command.x - destination.x, command.z - destination.z) < 1, 'Move must match the clicked nearby ground');
  assert.equal(ui.selected, 1, 'Move must retain one selected Worker');
  assert.equal(ui.context, 'workers', 'Worker context must remain visible');
  assert.equal(ui.contextVisible, true, 'Worker context must be rendered');
  assert.equal(ui.feedback.visible, true, 'applied Move feedback must be visible');
  assert.equal(ui.feedback.state, 'applied', 'Move must be applied');
  assert.equal(ui.feedback.text, 'MOVE ORDER · 1 UNITS', 'feedback must confirm the one-Worker Move');
}

export function validateNoviceFrames(start, frames) {
  validateMotion(start, frames);
  let previous = start;
  for (const frame of frames) {
    assert.equal(frame.worker.generation, start.worker.generation, 'moving Worker generation must persist');
    assert.ok(Number.isSafeInteger(frame.tick) && frame.tick > previous.tick, 'authoritative state ticks must advance');
    assert.ok(Number.isFinite(frame.observedAt) && frame.observedAt > previous.observedAt,
      'received Worker observations must advance');
    assert.ok(Number.isFinite(frame.stateAgeMs) && frame.stateAgeMs >= 0 && frame.stateAgeMs <= 2000,
      'movement frame must use a recent authoritative observation');
    previous = frame;
  }
}

/** CI contract: fresh about:blank page from the existing qualified packed runner.
 * Install beforeScript before navigation; return failed reports as a nonzero run.
 * The caller owns browser/server cleanup and must retain its cleanup failures.
 */
export async function runNoviceScenario({ origin, page, release, evidenceDirectory, fetchImpl = fetch, onSelected }) {
  await mkdir(evidenceDirectory, { recursive: true });
  const report = { schemaVersion: 1, scope: 'automated-normal-new-game-worker-move', status: 'failed',
    release: { sourceRevision: isSourceRevision(release?.sourceRevision) ? release.sourceRevision : null,
      digest: isReleaseDigest(release?.digest) ? release.digest : null },
    viewport: { width: 1280, height: 720, dpr: 1 }, identity: null, steps: [], frames: [], issues: [], browserEvents: [] };
  let stage = 'identity', navigationOwned = false;
  const read = () => page.cdp.evaluate(`(${readNoviceUi.toString()})()`);
  const capture = async name => {
    const result = await page.cdp.call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    const bytes = Buffer.from(result.data, 'base64');
    assert.ok(bytes.length > 10000 && bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')), 'UI capture must be a nonempty PNG');
    assert.equal(bytes.readUInt32BE(16), 1280, 'UI PNG width must match the viewport');
    assert.equal(bytes.readUInt32BE(20), 720, 'UI PNG height must match the viewport');
    await writeFile(path.join(evidenceDirectory, name), bytes);
    return { png: name, pngSha256: sha256(bytes) };
  };
  const recordEvent = event => {
    if (report.browserEvents.length < 100) report.browserEvents.push(event);
    else report.droppedBrowserEvents = (report.droppedBrowserEvents ?? 0) + 1;
  };
  try {
    const local = new URL(origin);
    assert.equal(local.protocol, 'http:', 'scenario must use the packed loopback server');
    assert.equal(local.hostname, '127.0.0.1', 'scenario must use the packed loopback server');
    assert.equal(local.pathname, '/', 'scenario origin must have no entry path');
    assert.equal(local.search + local.hash + local.username + local.password, '', 'scenario origin must contain no entry flags or credentials');
    report.identity = await checkServedBuildIdentity(origin, report.release, { fetchImpl });
    assert.equal(report.identity.ok, true, 'served build must match the clean packed source and digest');
    assert.equal(report.identity.served?.sourceDirty, false, 'served pack must be clean');
    stage = 'fresh-page';
    assert.equal(await page.cdp.evaluate('location.href'), 'about:blank', 'adapter requires a fresh blank page');
    page.cdp.on('Network.responseReceived', event => {
      const status = event.response?.status;
      if (!(status >= 400)) return;
      let optionalIcon = false;
      try { const url = new URL(event.response.url); optionalIcon = url.origin === origin && url.pathname === '/favicon.ico' && status === 404; } catch {}
      if (!optionalIcon) recordEvent({ kind: 'http-error', status: Number.isInteger(status) ? status : null });
    });
    page.cdp.on('Network.loadingFailed', () => recordEvent({ kind: 'network-failure' }));
    await page.cdp.call('Page.addScriptToEvaluateOnNewDocument', { source: noviceBeforeScript });
    stage = 'menu'; navigationOwned = true;
    await page.cdp.call('Page.navigate', { url: `${origin}/` });
    await page.wait(`document.documentElement.dataset.entry==='menu'&&!document.querySelector('#menu-new-game').disabled`, 'ordinary New Game menu');
    const menu = await read();
    assert.equal(menu.menu.visible, true, 'New Game must be visible'); assert.equal(menu.menu.enabled, true, 'New Game must be enabled');
    assert.equal(menu.canvas, false, 'root menu must precede the game renderer'); assert.equal(menu.diagnosticEntry, false, 'root menu must be ordinary entry');
    report.steps.push({ step: 'menu', entry: menu.entry, visible: menu.menu.visible, enabled: menu.menu.enabled, ...await capture('menu.png') });
    const menuPoint = await page.cdp.evaluate(`(()=>{const e=document.querySelector('#menu-new-game'),r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`);
    await clickNovicePoint(page, menuPoint);
    stage = 'normal-game';
    await page.wait(`document.documentElement.dataset.entry==='game'&&document.documentElement.dataset.boot==='ready'&&window.__rtsNovice?.latest?.workers.length`, 'normal AI match and live Workers', 30000);
    const game = await read();
    assert.equal(game.diagnosticEntry, false, 'New Game must not use a diagnostic entry');
    assert.equal(game.roomEntry, true, 'real New Game must admit a room'); assert.equal(game.mode, 'pve', 'New Game must enter PvE');
    assert.equal(game.latest.mapId, 'veyrholds-terraced-vale', 'normal New Game must admit Tiny Terraced Vale');
    assert.equal(game.latest.matchModeId, 'skirmish'); assert.equal(game.latest.matchModeVersion, 1);
    assert.deepEqual(game.map, { id: 'veyrholds-terraced-vale', width: 160, height: 160 });
    assert.equal(game.latest.workers.length, 4, 'ordinary opening must retain four Workers');
    assert.ok(Number.isInteger(game.mapSeed) && Number.isInteger(game.policySeed), 'real New Game seeds must be disclosed');
    report.match = { mode: game.mode, map: game.map, matchModeId: game.latest.matchModeId,
      matchModeVersion: game.latest.matchModeVersion, mapSeed: game.mapSeed, policySeed: game.policySeed,
      armySize: game.latest.armySize, team: game.team, openingWorkers: game.latest.workers.length };
    report.steps.push({ step: 'normal-game', ...await capture('normal-game.png') });
    stage = 'selection';
    await page.cdp.evaluate(`(async()=>{const THREE=await import('/vendor/three.module.js');(${installMinimapCameraProbe.toString()})(THREE,__rtsNovice);return true})()`);
    await page.wait('window.__rtsNovice.cameraSamples>0&&window.__rtsNovice.camera', 'observed native camera');
    const targets = await page.cdp.evaluate(`(${projectNoviceTargets.toString()})()`);
    assert.ok(targets.candidates.length > 0, 'one living Worker must be visible on the battlefield');
    assert.ok(targets.destinationPoint, 'nearby Move terrain must be visible on the battlefield');
    const selected = targets.candidates[0];
    await clickNovicePoint(page, selected.point);
    await page.wait(`document.querySelector('#selected-total').textContent==='1'&&document.querySelector('.contextual-command-bar').dataset.context==='workers'`, 'one Worker selected by real pointer');
    const selection = await read(); assert.equal(selection.contextVisible, true, 'selected Worker context must be visible');
    assert.equal(selection.sent.length, 0, 'selection must not emit a Move command');
    report.steps.push({ step: 'selection', selected: selection.selected, context: selection.context, worker: selected.worker, ...await capture('selected-worker.png') });
    // The registered runner also retains its source/applied-map checkpoint here.
    // Capture before Move, so screenshot work cannot delay the short live route.
    if (onSelected) await onSelected();
    const start = { number: selection.frameNumber, time: selection.time, tick: selection.latest.tick,
      observedAt: selection.stateAt, worker: selection.latest.workers.find(row => row.id === selected.worker.id) };
    report.start = start;
    stage = 'pointer-move'; await clickNovicePoint(page, targets.destinationPoint, 'right');
    await page.wait(`window.__rtsNovice.sent.length===1&&document.querySelector('#field-order-feedback').dataset.state==='applied'&&!document.querySelector('#field-order-feedback').hidden`, 'visible applied native Move', 15000);
    const applied = await read(); assert.equal(applied.sent.length, 1, 'one pointer click must emit one Move');
    validateNoviceOrder(start, applied.sent[0], targets.destination, applied);
    report.command = applied.sent[0]; report.destination = targets.destination;
    report.steps.push({ step: 'move-feedback', feedback: applied.feedback, ...await capture('move-feedback.png') });
    stage = 'movement'; let previous = start;
    for (let i = 1; i <= 2; i++) {
      await page.wait(`(()=>{const p=window.__rtsNovice,w=p.latest?.workers.find(w=>w.id===${start.worker.id});return w&&w.generation===${start.worker.generation}&&w.task==='moving'&&p.latest.tick>${previous.tick}&&Math.hypot(w.x-${previous.worker.x},w.z-${previous.worker.z})>=.2})()`, 'authoritative Worker displacement', 10000);
      const frame = await page.cdp.evaluate(`window.__rtsNovice.request(${start.worker.id})`);
      const canvas = Buffer.from(frame.canvasPng, 'base64'); delete frame.canvasPng;
      const screenshot = await page.cdp.call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      const png = Buffer.from(screenshot.data, 'base64'); validateFrame(frame, png, canvas);
      frame.png = `movement-${i}.png`; frame.pngSha256 = sha256(png);
      frame.canvas = `canvas-${i}.png`; frame.canvasSha256 = sha256(canvas); frame.readbackSha256 = sha256(Buffer.from(frame.pixels));
      await writeFile(path.join(evidenceDirectory, frame.png), png); await writeFile(path.join(evidenceDirectory, frame.canvas), canvas);
      report.frames.push(frame); previous = frame;
    }
    validateNoviceFrames(start, report.frames);
    const final = await read();
    assert.equal(final.sent.length, 1, 'only the native pointer Move may be submitted');
    assert.equal(final.errors.length + final.droppedErrors + final.droppedCommands + report.browserEvents.length
      + (report.droppedBrowserEvents ?? 0) + page.errors.length, 0, 'normal-entry capture must have no unexpected browser failures');
    report.status = 'passed';
  } catch (error) {
    report.issues.push({ stage, code: error instanceof assert.AssertionError ? 'contract-failed' : 'execution-failed',
      systemCode: ['ENOENT', 'EACCES', 'EPERM', 'ENOSPC', 'ECONNREFUSED', 'ETIMEDOUT'].includes(error.code) ? error.code : null });
  } finally {
    if (navigationOwned) {
      try { report.final = await read(); } catch {
        report.final = { available: false }; report.status = 'failed';
        report.issues.push({ stage: 'evidence', code: 'final-observation-unavailable' });
      }
      // CDP events can arrive during the final awaited read, after the earlier
      // movement check. Retain those failures before serializing the result.
      if ((report.final.errors?.length ?? 0) + (report.final.droppedErrors ?? 0) + (report.final.droppedCommands ?? 0)
        + report.browserEvents.length + (report.droppedBrowserEvents ?? 0) + page.errors.length > 0) {
        report.status = 'failed'; report.issues.push({ stage: 'evidence', code: 'browser-errors' });
      }
    } else report.final = { available: false };
    if (report.status === 'failed') {
      // A rejected origin/build/nonfresh page belongs to no adapter navigation.
      // Do not read or screenshot that unrelated page.
      if (navigationOwned) try { report.failureCapture = await capture('failure.png'); }
      catch { report.failureCapture = { available: false }; }
      else report.failureCapture = { available: false };
    }
    // The read function returns only whitelisted state and known UI categories.
    await writeFile(path.join(evidenceDirectory, 'novice.json'), `${JSON.stringify(report, null, 2)}\n`);
  }
  return report;
}
