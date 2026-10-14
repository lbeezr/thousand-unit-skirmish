// Feature-owned public staging appearance capture. Import never launches a browser.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFortifiedBrowser } from './fortified-browser-fixture.mjs';
import { validateRosterCapability, observeRosterBrowser } from './renderer-roster-audio-staging.mjs';
import { STAGING_ORIGIN, validateStagingOrigin } from './renderer-roster-audio-plan.mjs';
import { rosterControlPoint } from './renderer-roster-audio-capture.mjs';
import { interactionTargetPoint } from './renderer-interaction-audio-scenario.mjs';
import { buildElevationGrid } from '../src/map-utils.mjs';
import { canTraverseElevation } from '../src/elevation.mjs';

export const SURROUND_MAP_ID = 'veyrholds-terraced-vale';
export const SURROUND_FILES = Object.freeze(['index.html', 'style.css', 'src/main.js',
  'src/presentation/rendering/battlefield-surround.mjs', 'src/presentation/rendering/ground-surfaces.mjs',
  'src/terrain-height.mjs', 'src/terrain-texture-sampling.mjs', 'src/camera-controls.mjs']);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const snapshotExpression = 'window.__rtsBrowserRecoverySnapshot()';

export async function identifySurroundSource(revision, fetcher = fetch, signal) {
  assert.match(revision, /^[a-f0-9]{40}$/);
  const files = await Promise.all(SURROUND_FILES.map(async file => {
    const get = async url => {
      const response = await fetcher(url, { redirect: 'error', credentials: 'omit',
        signal: AbortSignal.any([AbortSignal.timeout(15000), ...(signal ? [signal] : [])]) });
      assert.equal(response.status, 200, 'public source file unavailable');
      const chunks = []; let size = 0;
      for await (const chunk of response.body) {
        size += chunk.length; assert.ok(size < 2000000, 'source size outside bounded contract'); chunks.push(chunk);
      }
      const bytes = Buffer.concat(chunks); assert.ok(bytes.length > 0, 'empty source');
      return bytes;
    };
    const expected = await get(`https://raw.githubusercontent.com/lbeezr/thousand-unit-skirmish/${revision}/${file}`);
    const actual = await get(`${STAGING_ORIGIN}/${file}`);
    assert.equal(sha(actual), sha(expected), 'staging source changed or differs from the intended revision');
    return { path: file, bytes: actual.length, sha256: sha(actual) };
  }));
  return { expectedRevision: revision, identityScope: 'exact-public-setting-file-hashes', files };
}

// Choose a reachable ordinary map-edge destination, without editing any cells.
export function reachableEdgeGoals(map, position) {
  assert.equal(map.id, SURROUND_MAP_ID); assert.equal(map.width, 160); assert.equal(map.height, 160);
  const { width, height } = map, blocked = new Uint8Array(width * height);
  assert.ok(Number.isFinite(position.x) && Number.isFinite(position.z)
    && position.x >= -width / 2 && position.x < width / 2
    && position.z >= -height / 2 && position.z < height / 2);
  for (const obstacle of map.obstacles) for (let z = obstacle.row; z < obstacle.row + obstacle.height; z++) {
    for (let x = obstacle.column; x < obstacle.column + obstacle.width; x++) blocked[z * width + x] = 1;
  }
  const levels = buildElevationGrid(width, height, map.elevationPatches);
  const start = Math.floor(position.z + height / 2) * width + Math.floor(position.x + width / 2);
  assert.ok(start >= 0 && start < blocked.length && !blocked[start]);
  const distance = new Int32Array(blocked.length).fill(-1), queue = new Int32Array(blocked.length);
  queue[0] = start; distance[start] = 0; let head = 0, tail = 1;
  while (head < tail) {
    const cell = queue[head++], x = cell % width, z = Math.floor(cell / width);
    for (const next of [x > 0 ? cell - 1 : -1, x + 1 < width ? cell + 1 : -1,
      z > 0 ? cell - width : -1, z + 1 < height ? cell + width : -1]) {
      if (next < 0 || blocked[next] || distance[next] >= 0 || !canTraverseElevation(levels, cell, next)) continue;
      distance[next] = distance[cell] + 1; queue[tail++] = next;
    }
  }
  return Array.from(distance, (steps, cell) => ({ cell, steps, column: cell % width, row: Math.floor(cell / width) }))
    .filter(p => p.steps > 0 && Math.min(p.column, p.row, width - 1 - p.column, height - 1 - p.row) <= 3)
    .sort((a, b) => a.steps - b.steps || a.cell - b.cell).slice(0, 32)
    .map(p => ({ x: p.column - width / 2 + .5, z: p.row - height / 2 + .5, steps: p.steps }));
}

export function readSurroundView() {
  const recovery = window.__rtsBrowserRecoverySnapshot?.();
  const units = window.__rtsInteractionAudioSnapshot?.();
  const canvas = document.querySelector('#viewport canvas');
  const gl = canvas?.getContext('webgl2');
  return { mapId: units?.mapId, team: units?.team, tick: recovery?.tick,
    boot: document.documentElement.dataset.boot, socketState: recovery?.socketState, recovering: recovery?.recovering,
    viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio }, camera: recovery?.camera,
    worker: recovery?.worker ? { id: recovery.worker.id, x: recovery.worker.serverX, z: recovery.worker.serverZ,
      point: recovery.worker.screen } : null,
    graphics: { version: gl?.getParameter(gl.VERSION), lost: gl?.isContextLost(), error: gl?.getError() } };
}

export function validateSurroundFrame(view, mapId, png, priorTick) {
  assert.equal(view.mapId, mapId); assert.ok([0, 1].includes(view.team));
  assert.equal(view.boot, 'ready'); assert.equal(view.socketState, 1); assert.equal(view.recovering, false);
  assert.ok(view.tick > priorTick, 'real authoritative state must advance');
  assert.equal(view.viewport.dpr, 1);
  assert.ok([[1280, 720], [1920, 1080], [1024, 768]].some(([w, h]) => view.viewport.width === w && view.viewport.height === h));
  assert.match(view.graphics.version, /^WebGL 2\.0/); assert.equal(view.graphics.lost, false); assert.equal(view.graphics.error, 0);
  assert.ok(png.length > 10000 && png.length < 10000000);
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16), view.viewport.width); assert.equal(png.readUInt32BE(20), view.viewport.height);
}

async function click(page, point, button = 'left') {
  assert.ok(point && Number.isFinite(point.x) && Number.isFinite(point.y));
  await page.cdp.call('Page.bringToFront');
  await page.cdp.call('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
  for (const type of ['mousePressed', 'mouseReleased']) await page.cdp.call('Input.dispatchMouseEvent', { type, ...point, button, clickCount: 1 });
}
async function control(page, selector) {
  const point = await page.wait(`(${rosterControlPoint.toString()})(${JSON.stringify(selector)})`, 'visible enabled ordinary control');
  await click(page, point);
}
async function zoom(page, requested) {
  const state = await page.cdp.evaluate(snapshotExpression);
  const point = await page.cdp.evaluate('(() => {const r=document.querySelector("#viewport canvas").getBoundingClientRect();return {x:r.left+r.width*.5,y:r.top+r.height*.35};})()');
  await page.cdp.call('Input.dispatchMouseEvent', { type: 'mouseWheel', ...point,
    deltaX: 0, deltaY: Math.log(state.camera.zoom / requested) / .001 });
  await page.wait(`Math.abs(${snapshotExpression}.camera.zoom-${requested})<.0001`, 'ordinary wheel zoom');
}
async function minimapPoint(page, x, z) {
  const point = await page.cdp.evaluate(`(()=>{const c=document.querySelector('#minimap-canvas');
    const r=c.getBoundingClientRect(),x=r.left+r.width*${x},y=r.top+r.height*${z};
    return document.elementFromPoint(x,y)===c ? {x,y}:null;})()`);
  await click(page, point);
}

export async function captureSurroundScene({ pages, directory, map }) {
  const [host, peer] = pages;
  const report = { schemaVersion: 1, scope: 'normal-public-staging-Terraced-Vale-setting', status: 'failed',
    appearanceReview: 'pending', frames: [], checks: [], issues: [], room: 'fresh-owned-two-seat-room' };
  const persist = () => writeFile(path.join(directory, 'scene.json'), JSON.stringify(report, null, 2) + '\n');
  let phase = 'entry';
  const ready = async p => {
    await p.cdp.call('Page.bringToFront');
    return p.wait(`document.querySelector('#room-lobby')?.open===false&&window.__rtsInteractionAudioSnapshot?.().mapId===${JSON.stringify(SURROUND_MAP_ID)}&&window.__rtsBrowserRecoverySnapshot?.().socketState===1&&!window.__rtsBrowserRecoverySnapshot?.().recovering`, 'normal Terraced Vale and live socket', 35000);
  };
  const readyBoth = async () => { for (const p of pages) await ready(p); };
  const shot = async (p, name, mapId = SURROUND_MAP_ID) => {
    assert.ok(report.frames.length < 32);
    const prior = await p.cdp.evaluate(`${snapshotExpression}.tick`);
    await p.wait(`${snapshotExpression}.tick>${prior}`, 'advancing game state before screenshot');
    const view = await p.cdp.evaluate(`(${readSurroundView.toString()})()`);
    const bytes = Buffer.from((await p.cdp.call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })).data, 'base64');
    const file = name + '.png'; await writeFile(path.join(directory, file), bytes, { flag: 'wx' });
    report.frames.push({ file, sha256: sha(bytes), view, priorTick: prior }); await persist();
    validateSurroundFrame(view, mapId, bytes, prior); return view;
  };
  const launch = async () => {
    for (const p of pages) await p.wait('document.querySelector("#lobby-ready")?.disabled===false', 'two ordinary lobby seats');
    await control(host, '#lobby-ready');
    await host.wait('document.querySelector("#lobby-ready").textContent==="Not ready"', 'host readiness accepted');
    await peer.wait('document.querySelector("#room-lobby ul[aria-label=\"Player seats\"] li")?.textContent.includes(": Ready")', 'peer receives host readiness');
    await control(peer, '#lobby-ready');
    await host.wait('document.querySelector("#lobby-launch")?.disabled===false', 'both ready');
    await control(host, '#lobby-launch');
    await Promise.all(pages.map(p => p.wait('document.querySelector("#room-lobby")?.open===false', 'ordinary match launched')));
    for (const p of pages) if (await p.cdp.evaluate('document.querySelector("#match-menu").hidden===false')) {
      await control(p, '#match-menu-close');
    }
  };
  const reset = async () => {
    if (await host.cdp.evaluate('document.querySelector("#match-menu").hidden')) await control(host, '#match-menu-toggle');
    await host.wait('document.querySelector("#match-menu").hidden===false', 'ordinary match menu');
    await control(host, '#reset-army');
    await Promise.all(pages.map(p => p.wait('document.querySelector("#room-lobby")?.open===true', 'normal reset returns to lobby')));
  };
  try {
    await host.cdp.call('Page.navigate', { url: STAGING_ORIGIN + '/' });
    await host.wait('document.querySelector("#menu-create-room")?.disabled===false', 'normal New Game');
    await control(host, '#menu-create-room');
    await host.wait('document.querySelector("#lobby-map")?.disabled===false', 'ordinary map picker');
    phase = 'default-lobby-settings';
    // The first map control can render before the mode/socket acknowledgement.
    // Wait for the real default settings; never select or manufacture them.
    await host.wait(`document.querySelector('#lobby-map')?.value===${JSON.stringify(SURROUND_MAP_ID)}&&document.querySelector('#lobby-match-mode')?.value==='skirmish@1'&&window.__rtsInteractionAudioSnapshot?.().mapId===${JSON.stringify(SURROUND_MAP_ID)}&&window.__rtsBrowserRecoverySnapshot?.().socketState===1`, 'acknowledged normal default map and mode', 35000);
    assert.equal(await host.cdp.evaluate('document.querySelector("#lobby-map").value'), SURROUND_MAP_ID, 'normal default map required');
    assert.equal(await host.cdp.evaluate('document.querySelector("#lobby-match-mode").value'), 'skirmish@1');
    phase = 'owned-room-url';
    const roomUrl = await host.cdp.evaluate('location.href');
    assert.equal(new URL(roomUrl).origin, STAGING_ORIGIN);
    assert.match(new URL(roomUrl).searchParams.get('room') ?? '', /^[A-Za-z0-9_-]{32}$/);
    await peer.cdp.call('Page.navigate', { url: roomUrl });
    phase = 'normal-two-seat-launch';
    await launch(); await readyBoth();
    assert.deepEqual((await Promise.all(pages.map(p => p.cdp.evaluate('window.__rtsInteractionAudioSnapshot().team')))).sort(), [0, 1]);
    report.checks.push({ id: 'normal-default-two-seat-Terraced-Vale', passed: true });
    phase = 'view-matrix';
    for (const p of pages) {
      const team = await p.cdp.evaluate('window.__rtsInteractionAudioSnapshot().team');
      await control(p, '#camera-home-base'); await zoom(p, .91); await shot(p, `team-${team}-ordinary-home`);
      await zoom(p, .48); await shot(p, `team-${team}-strategic-home`);
      await control(p, '#camera-fit-map'); await shot(p, `team-${team}-fit-map`);
      await zoom(p, .48);
      for (const [name, x, z] of [['north-west', .005, .005], ['north-east', .995, .005],
        ['south-east', .995, .995], ['south-west', .005, .995]]) {
        await minimapPoint(p, x, z); await shot(p, `team-${team}-${name}`);
      }
      for (const [width, height] of [[1920, 1080], [1024, 768]]) {
        await p.cdp.call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
        await control(p, '#camera-fit-map'); await shot(p, `team-${team}-fit-${width}x${height}`);
      }
      await p.cdp.call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    }
    phase = 'edge-workers';
    const moves = [];
    for (const p of pages) {
      await control(p, '#camera-home-base'); await zoom(p, .91);
      const worker = (await p.cdp.evaluate(snapshotExpression)).worker;
      const point = await p.wait(`(${interactionTargetPoint.toString()})('unit',${worker.id})`, 'visible own Worker');
      await click(p, point);
      await control(p, '#camera-fit-map');
      const candidates = reachableEdgeGoals(map, { x: worker.serverX, z: worker.serverZ });
      let goal;
      for (const candidate of candidates) {
        const target = await p.cdp.evaluate(`window.__rtsInteractionAudioProject(${candidate.x},${candidate.z})`);
        if (target) { goal = candidate; await click(p, target, 'right'); break; }
      }
      assert.ok(goal, 'reachable visible map-edge destination required'); moves.push({ p, goal, id: worker.id });
    }
    for (const { p, goal, id } of moves) {
      await p.cdp.call('Page.bringToFront');
      await p.wait(`(()=>{const w=${snapshotExpression}.worker;return w?.id===${id}&&Math.hypot(w.serverX-${goal.x},w.serverZ-${goal.z})<2;})()`, 'normal Worker Move reaches map edge', 95000);
      await minimapPoint(p, (goal.x + map.width / 2) / map.width, (goal.z + map.height / 2) / map.height);
      await zoom(p, .91);
      assert.ok(await p.cdp.evaluate(`window.__rtsInteractionAudioSnapshot().workers.find(w=>w.id===${id})?.point`), 'edge Worker visible beside scenery');
      const team = await p.cdp.evaluate('window.__rtsInteractionAudioSnapshot().team');
      await shot(p, `team-${team}-visible-edge-worker`);
    }
    report.checks.push({ id: 'native-Worker-edge-Move-both-seats', passed: true });
    phase = 'rematch-and-map-switch';
    await reset();
    await launch(); await readyBoth();
    for (const p of pages) { const team = await p.cdp.evaluate('window.__rtsInteractionAudioSnapshot().team'); await control(p, '#camera-home-base'); await shot(p, `team-${team}-rematch`); }
    await reset();
    await host.wait('document.querySelector("#lobby-map")?.disabled===false', 'host can change pregame map');
    const select = async value => {
      // This is the normal visible lobby selector and its change handler.
      await host.cdp.evaluate(`(()=>{const s=document.querySelector('#lobby-map');s.value=${JSON.stringify(value)};s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
      await host.wait(`document.querySelector('#lobby-map').value===${JSON.stringify(value)}&&!document.querySelector('#lobby-ready').disabled`, 'host map acknowledgement');
    };
    const other = await host.cdp.evaluate(`[...document.querySelector('#lobby-map').options].find(o=>o.value!==${JSON.stringify(SURROUND_MAP_ID)}&&!o.disabled)?.value`);
    assert.ok(other); await select(other); await launch();
    for (const p of pages) { await p.wait(`window.__rtsInteractionAudioSnapshot?.().mapId===${JSON.stringify(other)}`, 'applied alternate map'); await control(p, '#camera-fit-map'); const team = await p.cdp.evaluate('window.__rtsInteractionAudioSnapshot().team'); await shot(p, `team-${team}-alternate-map`, other); }
    await reset(); await host.wait('document.querySelector("#lobby-map")?.disabled===false', 'return-map lobby');
    await select(SURROUND_MAP_ID); await launch(); await readyBoth();
    for (const p of pages) { await control(p, '#camera-fit-map'); const team = await p.cdp.evaluate('window.__rtsInteractionAudioSnapshot().team'); await shot(p, `team-${team}-returned-map`); }
    report.checks.push({ id: 'ordinary-rematch-and-map-switch-both-seats', passed: true });
    report.status = 'captured-needs-review';
  } catch (error) {
    report.issues.push({ phase, code: error instanceof assert.AssertionError ? 'contract-failed' : /timeout/i.test(error.message) ? 'wait-timeout' : 'capture-failed' });
    try { await shot(host, 'failure'); } catch { report.issues.push({ code: 'failure-frame-unvalidated' }); }
  }
  await persist(); return report;
}

export async function runSurroundStaging({ sourceRevision, runnerRevision, directory, preflightFile }, {
  openBrowser = createFortifiedBrowser, identify = identifySurroundSource, capture = captureSurroundScene,
  platform = process.platform,
} = {}) {
  assert.match(sourceRevision, /^[a-f0-9]{40}$/); assert.match(runnerRevision, /^[a-f0-9]{40}$/);
  assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), runnerRevision);
  assert.equal(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(), '');
  assert.ok(path.isAbsolute(directory) && path.isAbsolute(preflightFile)); validateStagingOrigin(STAGING_ORIGIN);
  validateRosterCapability(JSON.parse(await readFile(preflightFile, 'utf8')), runnerRevision, platform);
  await mkdir(directory);
  const report = { scope: 'public-staging-battlefield-surround', status: 'failed', sourceRevision, runnerRevision,
    sandbox: 'enabled', appearanceReview: 'pending', issues: [] };
  let browser, timer, capturePromise, observers = [];
  const deadline = new AbortController();
  // A case owns one deadline, including source reads and cleanup. No new native
  // input starts after abort; closing CDP drains any already pending wait.
  timer = setTimeout(() => deadline.abort(new Error('case timeout')), 360000);
  const guarded = page => ({ cdp: {
    call: (...args) => { deadline.signal.throwIfAborted(); return page.cdp.call(...args); },
    evaluate: (...args) => { deadline.signal.throwIfAborted(); return page.cdp.evaluate(...args); },
  }, wait: (...args) => { deadline.signal.throwIfAborted(); return page.wait(...args); } });
  try {
    report.sourceBefore = await identify(sourceRevision, fetch, deadline.signal);
    const mapResponse = await fetch(`https://raw.githubusercontent.com/lbeezr/thousand-unit-skirmish/${sourceRevision}/maps/veyrholds-terraced-vale.json`, { redirect: 'error', credentials: 'omit', signal: AbortSignal.any([deadline.signal, AbortSignal.timeout(15000)]) });
    assert.equal(mapResponse.status, 200); const map = await mapResponse.json();
    deadline.signal.throwIfAborted(); browser = await openBrowser(); report.browser = browser.version.product;
    deadline.signal.throwIfAborted();
    const pages = await Promise.all([0, 1].map(() => browser.page('about:blank', { beforeScript: 'window.__rtsCaptureDiagnostics=true;' })));
    observers = pages.map(p => observeRosterBrowser(p, STAGING_ORIGIN, SURROUND_FILES));
    capturePromise = capture({ pages: pages.map(guarded), directory, map });
    const outcome = await Promise.race([capturePromise, new Promise((_, reject) => {
      deadline.signal.addEventListener('abort', () => reject(deadline.signal.reason), { once: true });
      if (deadline.signal.aborted) reject(deadline.signal.reason);
    })]);
    report.captureStatus = outcome.status; report.sourceAfter = await identify(sourceRevision, fetch, deadline.signal);
    report.observations = observers.map(o => o.finish()); observers = [];
    if (outcome.status === 'captured-needs-review' && report.observations.every(o => o.passed)) report.status = 'captured-needs-review';
    else report.issues.push({ code: 'capture-or-browser-failure' });
  } catch { report.issues.push({ code: 'staging-setting-contract-failed' }); }
  finally {
    clearTimeout(timer); deadline.abort(); for (const observer of observers) observer.finish();
    try { await browser?.dispose(); } catch { report.issues.push({ code: 'owned-browser-cleanup-failed' }); report.status = 'failed'; }
    await capturePromise?.catch(() => {});
    await writeFile(path.join(directory, 'qualification.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  }
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    assert.equal(process.argv.length, 6);
    const [sourceRevision, runnerRevision, directory, preflightFile] = process.argv.slice(2);
    const result = await runSurroundStaging({ sourceRevision, runnerRevision, directory: path.resolve(directory), preflightFile: path.resolve(preflightFile) });
    console.log(JSON.stringify({ status: result.status, sourceRevision, appearanceReview: result.appearanceReview }));
    process.exitCode = result.status === 'captured-needs-review' ? 0 : 1;
  } catch { console.error('Scenery capture prerequisites failed; inspect safe retained receipts.'); process.exitCode = 1; }
}
