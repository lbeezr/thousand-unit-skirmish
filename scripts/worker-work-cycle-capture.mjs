// Opt-in ordinary packed-game work loop. No state injection, staging or art baseline claim.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFortifiedBrowser } from './fortified-browser-fixture.mjs';
import { qualifyRendererCapability, safeRequestPath, validateRelease } from './renderer-qualification.mjs';
import { stopChild } from './temporary-resources.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const PHASES = ['manual-approach', 'gather-approach', 'harvest', 'automatic-return', 'deposit-resume', 'resume-harvest'];
export const id = 'worker-work-cycle';

// The received seat snapshot is the only economy source. Never retain its raw
// envelope, player/session data, socket URL, notices or an opponent's rows/bank.
export function projectWorkCycleState(message, team, allowedNodeIds, expectedMapId = 'open-field') {
  const state = message?.state ?? message;
  if (![0, 1].includes(team) || state?.mapId !== expectedMapId || !Number.isInteger(state.tick)
    || !Array.isArray(state.units) || !Array.isArray(state.resourceNodes)) return null;
  const finite = value => Number.isFinite(value) ? value : null;
  return { tick: state.tick, team, food: finite(state.food?.[team]),
    dropoffs: [...(state.homeTownCenters ?? []), ...(state.buildings ?? [])]
      .filter(building => building.team === team && building.complete && building.hp > 0
        && ['town-center', 'storehouse', 'mill'].includes(building.type))
      .map(building => ({ id: building.id, type: building.type, x: finite(building.x), z: finite(building.z) })),
    workers: state.units.filter(row => row?.[1] === team && row[5] === 'worker' && row[4] > 0)
      .map(row => ({ id: row[0], team, generation: row[8], x: finite(row[2]), z: finite(row[3]),
        cargo: finite(row[6]), cargoType: ['food', 'wood', 'stone'].includes(row[7]) ? row[7] : null,
        task: ['idle', 'moving', 'gathering', 'returning', 'holding', 'attacking', 'building', 'repairing', 'patrolling', 'following']
          .includes(row[9]) ? row[9] : null,
        action: ['gather-food', 'gather-wood', 'gather-stone', 'build', 'repair'].includes(row[17]) ? row[17] : null })),
    nodes: state.resourceNodes.filter(node => allowedNodeIds.includes(node?.id) && node.type === 'food'
      && node.resourceVariant === undefined && node.wildlifeSpecies === undefined)
      .map(node => ({ id: node.id, stock: finite(node.stock) })),
  };
}

// Runs before the game's modules. Observe the existing socket and animation
// callback; commands still go through the existing live client hook. Readback
// follows the actual render, because preserveDrawingBuffer is false by default.
export function installWorkCycleProbe(project, allowedNodeIds) {
  const probe = window.__workerWorkCycle = { team: null, latest: null, samples: [], droppedSamples: 0,
    workerId: null, nodeId: null, number: 0, errors: [], pending: null,
    request: () => new Promise(resolve => { probe.pending = resolve; }) };
  const NativeSocket = window.WebSocket;
  window.WebSocket = class extends NativeSocket {
    constructor(...args) {
      super(...args);
      this.addEventListener('message', event => {
        let message; try { message = JSON.parse(event.data); } catch { return; }
        if (message.type === 'welcome' && [0, 1].includes(message.player?.team)) probe.team = message.player.team;
        if (!['welcome', 'mapChange', 'state'].includes(message.type)) return;
        const state = project(message, probe.team, allowedNodeIds); if (!state) return;
        probe.latest = state;
        if (probe.workerId !== null) {
          if (probe.samples.length < 2400) probe.samples.push(state); else probe.droppedSamples++;
        }
      });
    }
  };
  const nativeConsoleError = console.error.bind(console);
  console.error = (...args) => { probe.errors.push({ kind: 'console-error' }); nativeConsoleError(...args); };
  window.addEventListener('error', event => probe.errors.push({ kind: event.target === window ? 'exception' : 'resource-error' }), true);
  window.addEventListener('unhandledrejection', () => probe.errors.push({ kind: 'promise-rejection' }));
  const nativeRaf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = callback => nativeRaf(time => {
    callback(time); probe.number++;
    if (!probe.pending) return;
    const resolve = probe.pending; probe.pending = null;
    const canvas = document.querySelector('#viewport canvas'), gl = canvas?.getContext('webgl2');
    if (!gl) { resolve({ number: probe.number, time, version: null }); return; }
    const pixels = [], pixel = new Uint8Array(4);
    for (let y = 0; y < 6; y++) for (let x = 0; x < 8; x++) {
      gl.readPixels(Math.floor((x + 0.5) * gl.drawingBufferWidth / 8),
        Math.floor((y + 0.5) * gl.drawingBufferHeight / 6), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      pixels.push(...pixel);
    }
    resolve({ number: probe.number, time, version: gl.getParameter(gl.VERSION), contextLost: gl.isContextLost(),
      glError: gl.getError(), pixels, canvasWidth: gl.drawingBufferWidth, canvasHeight: gl.drawingBufferHeight,
      canvasPng: canvas.toDataURL('image/png').split(',')[1], state: probe.latest });
  });
}

export function validateWorkCycleFrame(frame, png, canvas) {
  assert.match(frame.version ?? '', /^WebGL 2\.0/, 'game must use WebGL2');
  assert.equal(frame.contextLost, false, 'game context must remain live');
  assert.equal(frame.glError, 0, 'game readback must have no GL errors');
  assert.ok(Number.isInteger(frame.number) && frame.number > 0 && Number.isFinite(frame.time), 'rendered identity required');
  assert.ok(Array.isArray(frame.pixels) && frame.pixels.length === 192
    && frame.pixels.every(value => Number.isInteger(value) && value >= 0 && value <= 255), '48 RGBA samples required');
  const colors = new Set(Array.from({ length: 48 }, (_, i) => frame.pixels.slice(i * 4, i * 4 + 4).join(',')));
  assert.ok(colors.size > 1 && frame.pixels.some((v, i) => i % 4 !== 3 && v > 0), 'readback must contain varied nonblank pixels');
  for (const [bytes, width, height] of [[png, 1280, 720], [canvas, frame.canvasWidth, frame.canvasHeight]]) {
    assert.ok(Number.isInteger(width) && width >= 320 && Number.isInteger(height) && height >= 200, 'image dimensions required');
    assert.ok(bytes.length > 10000 && bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
      && bytes.toString('ascii', 12, 16) === 'IHDR', 'nonempty PNG required');
    assert.equal(bytes.readUInt32BE(16), width, 'PNG width mismatch');
    assert.equal(bytes.readUInt32BE(20), height, 'PNG height mismatch');
  }
}

// Network cargo is rounded to cents; the authority runs at fractional ticks.
// The tolerance covers that wire rounding only, never a lost unit of Food.
export function validateWorkCycle({ initial, final, gatherStart, workerId, nodeId, samples, frames, droppedSamples }) {
  assert.equal(droppedSamples, 0, 'all bounded work-cycle samples must be retained');
  assert.ok(samples.length > 5 && samples.length <= 2400, 'bounded advancing work samples required');
  const workerAt = state => state.workers.find(worker => worker.id === workerId);
  const nodeAt = state => state.nodes.find(node => node.id === nodeId);
  const first = workerAt(initial), source = nodeAt(initial);
  assert.ok(first && source && Number.isFinite(initial.food) && source.stock > 20
    && first.cargo === 0 && first.task === 'idle', 'fresh idle Worker and finite source required');
  const foodCargo = state => state.workers.reduce((sum, worker) => sum + (worker.cargoType === 'food' ? worker.cargo : 0), 0);
  const total = initial.food + source.stock + foodCargo(initial);
  const otherWorkers = initial.workers.filter(worker => worker.id !== workerId);
  const validateState = state => {
    assert.equal(state.team, initial.team, 'seat must not change');
    const worker = workerAt(state), node = nodeAt(state);
    assert.ok(worker && node && Number.isFinite(state.food) && Number.isFinite(node.stock), 'visible source and Worker evidence required');
    assert.ok(Number.isInteger(worker.id) && Number.isInteger(worker.generation)
      && Number.isFinite(worker.x) && Number.isFinite(worker.z), 'live Worker identity and coordinates required');
    assert.equal(worker.generation, first.generation, 'Worker generation must remain stable');
    assert.ok(worker.cargo >= 0 && worker.cargo <= 10, 'cargo capacity must remain unchanged');
    assert.ok(worker.cargo === 0 || worker.cargoType === 'food', 'carried cargo must stay typed Food');
    assert.ok(Math.abs(state.food + node.stock + foodCargo(state) - total) <= 0.011, 'Food stock/bank/cargo must conserve at wire precision');
    for (const other of otherWorkers) {
      const actual = state.workers.find(worker => worker.id === other.id);
      assert.ok(actual, 'unselected Worker must remain present');
      assert.equal(actual.generation, other.generation, 'unselected Worker generation must remain stable');
      assert.equal(actual.task, other.task, 'unselected Worker must not be recruited');
      assert.equal(actual.cargo, other.cargo, 'unselected Worker must not harvest');
    }
  };
  let tick = initial.tick;
  for (const state of samples) {
    assert.ok(state.tick >= tick, 'received simulation ticks must not go backward'); tick = state.tick;
    validateState(state);
  }
  assert.deepEqual(frames.map(frame => frame.phase), PHASES, 'all six real-game phases required');
  let previous;
  for (const frame of frames) {
    assert.match(frame.pngSha256 ?? '', /^[a-f0-9]{64}$/, 'screenshot digest required');
    assert.match(frame.canvasSha256 ?? '', /^[a-f0-9]{64}$/, 'canvas digest required');
    assert.ok(frame.state && workerAt(frame.state), 'frame must carry its received economy sample');
    validateState(frame.state);
    if (previous) {
      assert.ok(frame.number > previous.number && frame.time > previous.time, 'rendered captures must advance');
      assert.notEqual(frame.canvasSha256, previous.canvasSha256, 'canvas must advance independently of the HUD');
    }
    previous = frame;
  }
  const [manual, approach, harvest, returning, resume, resumed] = frames.map(frame => workerAt(frame.state));
  assert.equal(manual.task, 'moving', 'manual reference must move');
  assert.ok(Math.hypot(manual.x - first.x, manual.z - first.z) >= 0.4, 'manual reference must displace the live Worker');
  assert.equal(approach.task, 'gathering', 'gather approach must retain its work order');
  assert.ok(Math.hypot(approach.x - (gatherStart ?? first).x, approach.z - (gatherStart ?? first).z) >= 0.4,
    'gather approach must displace the live Worker');
  assert.equal(approach.cargo, 0, 'approach must precede harvest');
  assert.equal(harvest.action, 'gather-food', 'harvest must include a real authority receipt');
  assert.ok(harvest.cargo > 0 && harvest.cargo < 10, 'harvest must carry actual partial Food');
  assert.equal(returning.task, 'returning', 'automatic return must retain its work task');
  assert.equal(returning.cargo, 10, 'automatic return must carry a full typed load');
  assert.ok(Math.hypot(returning.x - harvest.x, returning.z - harvest.z) >= 0.3, 'automatic return must travel from the source');
  assert.equal(resume.task, 'gathering', 'deposit must automatically resume work');
  assert.equal(resume.cargo, 0, 'deposit must empty carried Food');
  assert.equal(frames[4].state.food, initial.food + 10, 'one full load must be banked');
  assert.equal(resumed.action, 'gather-food', 'resumed harvest must include a fresh authority receipt');
  assert.ok(resumed.cargo > 0 && resumed.cargo < 10, 'resumed work must draw new finite Food');
  assert.ok(Math.hypot(resumed.x - resume.x, resumed.z - resume.z) >= 0.3, 'resumed work must travel back to the source');
  validateState(final);
  assert.equal(workerAt(final).task, 'idle', 'explicit final Stop must win');
  assert.equal(final.food, initial.food + 10, 'bounded capture must finish after one deposit');
  assert.ok(Math.abs(final.food + nodeAt(final).stock + foodCargo(final) - total) <= 0.011, 'final Food must conserve');
  return { startingFood: initial.food, bankedFood: final.food - initial.food,
    sourceDraw: source.stock - nodeAt(final).stock, finalFoodCargo: foodCargo(final),
    wireRoundingTolerance: 0.011, unselectedWorkers: otherWorkers.length };
}

async function reservePort() {
  const socket = createServer();
  await new Promise((resolve, reject) => { socket.once('error', reject); socket.listen(0, '127.0.0.1', resolve); });
  const { port } = socket.address();
  await new Promise((resolve, reject) => socket.close(error => error ? reject(error) : resolve())); return port;
}

function captureReport() {
  return { schemaVersion: 1, adapterId: id, scope: 'local-packed-game-worker-work-cycle', status: 'failed',
    sandbox: 'enabled', source: null, release: null, served: null, frames: [], commands: [], samples: [],
    browserEvents: [], droppedBrowserEvents: 0, issues: [], deploymentVerified: false, stagingRendered: false };
}

// Shared hosted runner adapter: caller owns capability, browser, packed server
// and their cleanup. This adapter creates and disposes only its own page/context.
export async function run({ browser, origin, evidenceDirectory, pack }) {
  await mkdir(evidenceDirectory, { recursive: true });
  const report = captureReport();
  let stage = 'entry', page;
  const event = value => {
    if (report.browserEvents.length < 100) report.browserEvents.push(value); else report.droppedBrowserEvents++;
  };
  try {
    const url = new URL(origin);
    assert.ok(url.protocol === 'http:' && url.hostname === '127.0.0.1' && url.port !== ''
      && url.pathname === '/' && url.search === '' && url.hash === '' && url.username === '' && url.password === '',
    'adapter requires an owned loopback packed-game origin');
    assert.equal(origin, url.origin, 'adapter requires the canonical loopback origin');
    assert.ok(process.getuid?.() > 0, 'capture must run as a non-root user');
    stage = 'release';
    report.source = { revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
      dirty: execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim() !== '' };
    validateRelease(pack, report.source);
    assert.deepEqual(JSON.parse(await readFile(path.join(pack.directory, 'release-manifest.json'), 'utf8')),
      { sourceRevision: pack.sourceRevision, sourceDirty: pack.sourceDirty, digest: pack.digest, files: pack.files }, 'manifest must match the pack');
    const digest = createHash('sha256');
    for (const file of [...pack.files].sort()) digest.update(file).update('\0').update(await readFile(path.join(pack.directory, file))).update('\0');
    assert.equal(`sha256:${digest.digest('hex')}`, pack.digest, 'release bytes must match their digest');
    report.release = { sourceRevision: pack.sourceRevision, digest: pack.digest, files: pack.files.length };
    const map = JSON.parse(await readFile(path.join(pack.directory, 'maps/open-field.json'), 'utf8'));
    assert.equal(map.id, 'open-field'); assert.deepEqual(map.obstacles, []);
    const nodes = map.resourceNodes.filter(node => node.type === 'food' && node.wildlifeSpecies === undefined && node.resourceVariant === undefined);
    const lock = JSON.parse(await readFile(path.join(pack.directory, 'package-lock.json'), 'utf8'));
    const installed = JSON.parse(await readFile(path.join(pack.directory, 'node_modules/three/package.json'), 'utf8'));
    assert.equal(installed.version, lock.packages['node_modules/three'].version, 'install locked packed runtime dependencies before capture');
    stage = 'server';
    const response = await fetch(`${origin}/health`, { signal: AbortSignal.timeout(5000) });
    assert.equal(response.status, 200, 'packed supervisor must be healthy');
    const health = await response.json(); assert.equal(health.ok, true, 'packed supervisor must be ready');
    const identity = health.buildIdentity;
    assert.equal(identity?.status, 'identified', 'served release identity required');
    assert.equal(identity.sourceRevision, pack.sourceRevision, 'served source must match the clean pack');
    assert.equal(identity.sourceDirty, false); assert.equal(identity.digest, pack.digest);
    report.served = { scope: 'owned-loopback-packed-supervisor', status: identity.status, origin: identity.origin,
      sourceRevision: identity.sourceRevision, sourceDirty: identity.sourceDirty, digest: identity.digest, files: [] };
    for (const file of ['index.html', 'src/main.js', 'vendor/three.module.js', 'vendor/three.core.js']) {
      const response = await fetch(`${origin}/${file}`, { signal: AbortSignal.timeout(5000) }); assert.equal(response.status, 200);
      const hash = sha256(Buffer.from(await response.arrayBuffer()));
      const packedPath = file.startsWith('vendor/') ? `node_modules/three/build/${path.basename(file)}` : file;
      assert.equal(hash, sha256(await readFile(path.join(pack.directory, packedPath))), 'served runtime bytes must match the pack');
      report.served.files.push({ path: file, sha256: hash });
    }
    stage = 'browser'; assert.ok(browser?.version?.product && typeof browser.page === 'function', 'qualified browser required');
    report.browser = browser.version;
    page = await browser.page('about:blank', { beforeScript:
      `(${installWorkCycleProbe.toString()})(${projectWorkCycleState.toString()},${JSON.stringify(nodes.map(node => node.id))})` });
    page.cdp.on('Runtime.consoleAPICalled', e => { if (e.type === 'error') event({ kind: 'console-error' }); });
    const requests = new Map();
    page.cdp.on('Network.requestWillBeSent', e => { if (requests.size < 2000) requests.set(e.requestId, safeRequestPath(e.request.url, origin, pack.files)); });
    page.cdp.on('Network.responseReceived', e => {
      if (e.response.status < 400) return;
      const pathname = safeRequestPath(e.response.url, origin, pack.files);
      event({ kind: 'http-error', status: e.response.status, path: pathname,
        expected: pathname === '/favicon.ico' && e.response.status === 404 });
    });
    page.cdp.on('Network.loadingFinished', e => requests.delete(e.requestId));
    page.cdp.on('Network.loadingFailed', e => { event({ kind: 'request-failed', path: requests.get(e.requestId) ?? null }); requests.delete(e.requestId); });
    await page.cdp.call('Page.navigate', { url: `${origin}/?rendererCapture=environment-state` });
    await page.wait("document.documentElement.dataset.entry === 'game' && document.documentElement.dataset.boot === 'ready' && window.__rtsEnvironmentAssetStatus?.ready && window.__workerWorkCycle.latest?.workers.length", 'ordinary packed game boot', 30000);
    report.entry = { route: '/?rendererCapture=environment-state', previewFlags: [], mapId: 'open-field', defaultPresentation: true };
    await page.cdp.evaluate("document.querySelector('#camera-home-base').click()");
    const assetStatus = await page.cdp.evaluate('window.__rtsEnvironmentAssetStatus');
    assert.ok(assetStatus.loadedFiles.length > 0, 'default decoded asset evidence required');
    report.assets = [];
    for (const asset of assetStatus.loadedFiles) {
      const relative = asset.path.startsWith('assets/') ? asset.path : `assets/environment/frontier-interactive-v1/${asset.path}`;
      assert.ok(pack.files.includes(relative), 'decoded default asset must be packed');
      assert.equal(asset.sha256, sha256(await readFile(path.join(pack.directory, relative))), 'decoded asset must match packed bytes');
      report.assets.push({ path: relative, sha256: asset.sha256, dimensionsPx: asset.dimensionsPx });
    }
    const live = await page.cdp.evaluate('window.__workerWorkCycle.latest');
    const worker = live.workers.filter(w => w.task === 'idle' && w.cargo === 0).sort((a, b) => a.id - b.id)[0];
    assert.ok(worker && live.workers.every(w => w.task === 'idle' && w.cargo === 0), 'fresh idle Workers required');
    const node = nodes.filter(n => live.nodes.some(visible => visible.id === n.id && visible.stock > 20))
      .sort((a, b) => Math.hypot(a.x - worker.x, a.z - worker.z) - Math.hypot(b.x - worker.x, b.z - worker.z))[0];
    assert.ok(node && Math.hypot(node.x - worker.x, node.z - worker.z) > 4, 'visible finite source must leave room for an approach capture');
    report.workerId = worker.id; report.node = { id: node.id, x: node.x, z: node.z, startingStock: node.stock };
    await page.cdp.evaluate(`Object.assign(window.__workerWorkCycle,{workerId:${worker.id},nodeId:${JSON.stringify(node.id)}})`);
    report.initial = await page.cdp.evaluate('window.__workerWorkCycle.latest');
    assert.equal(report.initial.dropoffs.length, 1, 'this bounded work cycle requires one owned completed Food drop-off');
    const row = 'window.__workerWorkCycle.latest?.workers.find(w => w.id === ' + worker.id + ')';
    const command = async payload => {
      assert.equal(await page.cdp.evaluate(`window.__rtsEnvironmentCaptureCommand(${JSON.stringify(payload)})`), true, 'command must use the real live client');
      report.commands.push(payload);
    };
    const capture = async phase => {
      const frame = await page.cdp.evaluate('window.__workerWorkCycle.request()');
      const png = Buffer.from((await page.cdp.call('Page.captureScreenshot', { format: 'png', fromSurface: true })).data, 'base64');
      const canvas = Buffer.from(frame.canvasPng, 'base64'); delete frame.canvasPng;
      validateWorkCycleFrame(frame, png, canvas);
      frame.phase = phase; frame.png = `${phase}.png`; frame.canvas = `${phase}-canvas.png`;
      frame.pngSha256 = sha256(png); frame.canvasSha256 = sha256(canvas); frame.readbackSha256 = sha256(Buffer.from(frame.pixels));
      await writeFile(path.join(evidenceDirectory, frame.png), png); await writeFile(path.join(evidenceDirectory, frame.canvas), canvas);
      report.frames.push(frame);
    };
    stage = 'manual-reference';
    await command({ type: 'move', ids: [worker.id], x: node.x, z: node.z });
    await page.wait(`(()=>{const w=${row};return w?.task==='moving'&&Math.hypot(w.x-(${worker.x}),w.z-(${worker.z}))>=0.5})()`, 'manual reference displacement');
    await capture('manual-approach');
    await command({ type: 'move', ids: [worker.id], x: worker.x, z: worker.z });
    await page.wait(`(()=>{const w=${row};return w?.task==='idle'&&Math.hypot(w.x-(${worker.x}),w.z-(${worker.z}))<0.7})()`, 'manual return to the same starting area');
    report.gatherStart = await page.cdp.evaluate(row);
    stage = 'work-cycle';
    await command({ type: 'gather', ids: [worker.id], nodeId: node.id });
    await page.wait(`(()=>{const w=${row};return w?.task==='gathering'&&w.cargo===0&&Math.hypot(w.x-(${report.gatherStart.x}),w.z-(${report.gatherStart.z}))>=0.5&&Math.hypot(w.x-(${node.x}),w.z-(${node.z}))>2})()`, 'real gather approach');
    await capture('gather-approach');
    await page.wait(`(()=>{const w=${row};return w?.action==='gather-food'&&w.cargo>=0.5&&w.cargo<10})()`, 'productive finite Food harvest');
    await capture('harvest');
    await page.wait(`(()=>{const w=${row};return w?.task==='returning'&&w.cargo===10&&Math.hypot(w.x-(${node.x}),w.z-(${node.z}))>1.9})()`, 'automatic full-load return', 30000);
    await capture('automatic-return');
    await page.wait(`(()=>{const s=window.__workerWorkCycle.latest,w=${row};return s.food===${report.initial.food + 10}&&w?.task==='gathering'&&w.cargo===0&&Math.hypot(w.x-(${node.x}),w.z-(${node.z}))>2})()`, 'banked Food and automatic work resumption');
    await capture('deposit-resume');
    await page.wait(`(()=>{const w=${row};return w?.action==='gather-food'&&w.cargo>=0.5&&w.cargo<10})()`, 'productive resumed harvest');
    await capture('resume-harvest');
    await command({ type: 'stop', ids: [worker.id] });
    await page.wait(`(${row})?.task==='idle'`, 'explicit Stop ends the captured work loop');
    report.final = await page.cdp.evaluate('window.__workerWorkCycle.latest');
    const observed = await page.cdp.evaluate('({samples:window.__workerWorkCycle.samples,droppedSamples:window.__workerWorkCycle.droppedSamples})');
    report.samples = observed.samples; report.droppedSamples = observed.droppedSamples;
    report.conservation = validateWorkCycle(report); report.status = 'passed';
  } catch (error) {
    report.issues.push({ stage, code: error instanceof assert.AssertionError ? 'contract-failed' : 'execution-failed',
      message: error instanceof assert.AssertionError ? error.message.split('\n')[0] : `Work-cycle capture failed during ${stage}` });
  } finally {
    if (page) {
      if (page.errors.length) event({ kind: 'exception', count: page.errors.length });
      try { for (const flag of (await page.cdp.evaluate('window.__workerWorkCycle.errors')).slice(0, 100)) event(flag); }
      catch { report.issues.push({ stage: 'evidence', code: 'probe-unavailable' }); report.status = 'failed'; }
      if (report.browserEvents.some(e => !e.expected) || report.droppedBrowserEvents) {
        report.issues.push({ stage: 'browser', code: 'browser-errors' }); report.status = 'failed';
      }
    }
    try { await page?.dispose(); } catch { report.status = 'failed'; report.issues.push({ stage: 'cleanup', code: 'page-cleanup-failed' }); }
    await writeFile(path.join(evidenceDirectory, 'work-cycle.json'), `${JSON.stringify(report, null, 2)}\n`);
  }
  return report;
}

export async function captureWorkerWorkCycle(packFile, evidenceDirectory) {
  await mkdir(evidenceDirectory, { recursive: true });
  const report = captureReport(); let stage = 'preflight', browser, server, temporary;
  try {
    assert.ok(process.getuid?.() > 0, 'capture must run as a non-root user');
    report.preflight = await qualifyRendererCapability();
    if (report.preflight.status !== 'ready') { report.status = 'blocked'; return report; }
    stage = 'release';
    const pack = JSON.parse(await readFile(packFile, 'utf8'));
    report.source = { revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
      dirty: execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim() !== '' };
    validateRelease(pack, report.source);
    stage = 'server'; temporary = await mkdtemp(path.join(os.tmpdir(), 'rts-worker-work-cycle-'));
    const port = await reservePort(), origin = `http://127.0.0.1:${port}`;
    server = spawn(process.execPath, [path.join(pack.directory, 'room-supervisor.mjs')], { cwd: pack.directory,
      env: { PATH: process.env.PATH, PORT: String(port), RTS_HOST: '127.0.0.1', RTS_MAP: 'maps/open-field.json',
        RTS_CUSTOM_MAP_DIRECTORY: path.join(temporary, 'maps'), RTS_ROOM_DATA_DIRECTORY: path.join(temporary, 'rooms') },
      stdio: ['ignore', 'ignore', 'ignore'] });
    let serverError; server.on('error', error => { serverError = error; });
    const deadline = Date.now() + 20000;
    while (true) {
      if (serverError) throw serverError; assert.equal(server.exitCode, null, 'packed supervisor exited');
      const response = await fetch(`${origin}/health`, { signal: AbortSignal.timeout(1000) }).catch(() => null);
      if (response?.ok && (await response.json()).ok) break;
      assert.ok(Date.now() < deadline, 'packed supervisor startup timed out'); await sleep(100);
    }
    stage = 'browser'; browser = await createFortifiedBrowser();
    Object.assign(report, await run({ browser, origin, evidenceDirectory, pack }));
  } catch (error) {
    report.issues.push({ stage, code: error instanceof assert.AssertionError ? 'contract-failed' : 'execution-failed',
      message: error instanceof assert.AssertionError ? error.message.split('\n')[0] : `Work-cycle capture failed during ${stage}` });
  } finally {
    for (const cleanup of [() => browser?.dispose(), () => stopChild(server, { graceMs: 9000 }),
      () => temporary && rm(temporary, { recursive: true, force: true })]) {
      try { await cleanup(); } catch { report.status = 'failed'; report.issues.push({ stage: 'cleanup', code: 'cleanup-failed' }); }
    }
    await writeFile(path.join(evidenceDirectory, 'work-cycle.json'), `${JSON.stringify(report, null, 2)}\n`);
  }
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 4) { process.stderr.write('Usage: node scripts/worker-work-cycle-capture.mjs PACK_JSON EVIDENCE_DIRECTORY\n'); process.exitCode = 2; }
  else {
    const result = await captureWorkerWorkCycle(process.argv[2], process.argv[3]);
    console.log(JSON.stringify({ status: result.status, scope: result.scope, source: result.source, release: result.release,
      frames: result.frames.length, issues: result.issues }));
    process.exitCode = result.status === 'passed' ? 0 : result.status === 'blocked' ? 3 : 1;
  }
}
