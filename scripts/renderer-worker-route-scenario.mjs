// Ordinary owned-room scenario for the shared renderer-feature-capture runner.
// Importing this module never starts a browser, server or workload.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { projectWorkCycleState, validateWorkCycle, validateWorkCycleFrame } from './worker-work-cycle-capture.mjs';
import { validateCaptureContext } from './renderer-capture-context.mjs';

export const id = 'worker-routes';
export const contextVersion = 1;
export const ROUTE_MAP_ID = 'veyrholds-threefold-basin';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const checkpoints = Object.freeze(['manual-departure', 'manual-midpoint', 'gather-departure', 'gather-midpoint',
  'food-harvest', 'return-departure', 'return-midpoint', 'deposit-resume', 'resume-midpoint', 'food-resumed', 'manual-stop']);
const phaseTasks = Object.freeze(['moving', 'moving', 'gathering', 'gathering', 'gathering',
  'returning', 'returning', 'gathering', 'gathering', 'gathering', 'idle']);
const requiredPhases = Object.freeze({ 'manual-departure': 'manual-approach', 'gather-departure': 'gather-approach',
  'food-harvest': 'harvest', 'return-departure': 'automatic-return', 'deposit-resume': 'deposit-resume', 'food-resumed': 'resume-harvest' });

export function plainFoodTargets(map) {
  assert.equal(map.id, ROUTE_MAP_ID, 'scenario requires the reviewed canonical ordinary map');
  return map.resourceNodes.filter(node => node.type === 'food' && node.stock > 20
    && node.wildlifeSpecies === undefined && node.resourceVariant === undefined && node.sourceBuildingId === undefined);
}

// Observe received own-seat data only. The root injects diagnostics before each
// document; this observer does not change entry URLs, art, economy or commands.
export function installRouteObserver(project, mapId, allowedNodeIds) {
  const probe = window.__workerRoutes = { team: null, latest: null, samples: [], droppedSamples: 0, workerId: null };
  const NativeSocket = window.WebSocket;
  window.WebSocket = class extends NativeSocket {
    constructor(...args) {
      super(...args);
      this.addEventListener('message', event => {
        let message; try { message = JSON.parse(event.data); } catch { return; }
        if (message.type === 'welcome' && [0, 1].includes(message.player?.team)) probe.team = message.player.team;
        if (!['welcome', 'mapChange', 'state'].includes(message.type)) return;
        const state = project(message, probe.team, allowedNodeIds, mapId); if (!state) return;
        probe.latest = state;
        if (probe.workerId !== null) {
          if (probe.samples.length < 2400) probe.samples.push(state); else probe.droppedSamples++;
        }
      });
    }
  };
}

export function validateRouteEvidence(evidence) {
  assert.deepEqual(evidence.frames.map(frame => frame.checkpoint), checkpoints, 'all eleven ordered phase captures required');
  const workerAt = state => state.workers.find(w => w.id === evidence.workerId);
  const first = workerAt(evidence.initial);
  assert.ok(first && Math.hypot(evidence.gatherStart.x - first.x, evidence.gatherStart.z - first.z) <= 0.02,
    'manual and Gather must start at the same settled cell center');
  const frames = evidence.frames.filter(frame => Object.hasOwn(requiredPhases, frame.checkpoint))
    .map(frame => ({ ...frame, phase: requiredPhases[frame.checkpoint] }));
  const conservation = validateWorkCycle({ ...evidence, frames });
  const foodCargo = state => state.workers.reduce((sum, w) => sum + (w.cargoType === 'food' ? w.cargo : 0), 0);
  const source = evidence.initial.nodes.find(n => n.id === evidence.nodeId);
  const total = evidence.initial.food + source.stock + foodCargo(evidence.initial);
  const others = evidence.initial.workers.filter(w => w.id !== evidence.workerId);
  let previous;
  for (const [index, frame] of evidence.frames.entries()) {
    const state = frame.state, worker = state && workerAt(state), node = state?.nodes.find(n => n.id === evidence.nodeId);
    assert.ok(worker && node && Number.isFinite(state.food) && Number.isFinite(node.stock), 'every frame needs visible economy and Worker identity');
    assert.equal(state.team, evidence.initial.team, 'every frame must retain its own seat');
    assert.equal(worker.team, evidence.initial.team, 'every frame must retain its owned Worker');
    assert.ok(Number.isInteger(worker.id) && Number.isInteger(worker.generation)
      && Number.isFinite(worker.x) && Number.isFinite(worker.z), 'every frame needs finite live Worker coordinates');
    assert.equal(worker.generation, first.generation, 'every frame must retain the current generation');
    assert.ok(Number.isFinite(worker.cargo) && worker.cargo >= 0 && worker.cargo <= 10
      && (worker.cargo === 0 || worker.cargoType === 'food'), 'every frame must retain typed bounded Food cargo');
    assert.equal(worker.task, phaseTasks[index], 'every phase must retain its expected order');
    assert.equal(state.food, evidence.initial.food + (index >= 7 ? 10 : 0), 'phase bank must show exactly the single deposit');
    if (frame.checkpoint === 'food-harvest' || frame.checkpoint === 'food-resumed') {
      assert.ok(worker.action === 'gather-food' && worker.cargo >= 0.5 && worker.cargo < 10, 'harvest phase must retain productive partial Food');
    } else if (frame.checkpoint !== 'manual-stop') {
      assert.equal(worker.cargo, frame.checkpoint.startsWith('return-') ? 10 : 0, 'phase cargo must match its active work stage');
    }
    assert.ok(Math.abs(state.food + node.stock + foodCargo(state) - total) <= 0.011, 'every frame must conserve Food at wire precision');
    for (const other of others) {
      const actual = state.workers.find(w => w.id === other.id);
      assert.ok(actual && actual.generation === other.generation && actual.task === other.task && actual.cargo === other.cargo,
        'every frame must preserve unselected Workers');
    }
    assert.ok(Number.isInteger(state.tick) && state.tick >= (previous?.state.tick ?? evidence.initial.tick), 'phase simulation ticks cannot go backward');
    assert.ok(Number.isInteger(frame.number) && frame.number > 0 && Number.isFinite(frame.time), 'every frame needs advancing rendered identity');
    assert.match(frame.pngSha256 ?? '', /^[a-f0-9]{64}$/, 'every frame needs its screenshot digest');
    assert.match(frame.canvasSha256 ?? '', /^[a-f0-9]{64}$/, 'every frame needs its canvas digest');
    if (previous) {
      assert.ok(frame.number > previous.number && frame.time > previous.time, 'every phase capture must advance frame/time');
      assert.notEqual(frame.canvasSha256, previous.canvasSha256, 'every phase canvas must advance');
    }
    previous = frame;
  }
  const at = checkpoint => workerAt(evidence.frames.find(frame => frame.checkpoint === checkpoint).state);
  const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  for (const [midpoint, departure, task, cargo] of [
    ['manual-midpoint', 'manual-departure', 'moving', 0], ['gather-midpoint', 'gather-departure', 'gathering', 0],
    ['return-midpoint', 'return-departure', 'returning', 10], ['resume-midpoint', 'deposit-resume', 'gathering', 0],
  ]) {
    const worker = at(midpoint);
    assert.equal(worker.task, task, 'midpoint must retain its active order');
    assert.equal(worker.cargo, cargo, 'midpoint must retain its expected cargo');
    assert.ok(distance(worker, at(departure)) >= 1, 'midpoint must meaningfully advance from its departure capture');
  }
  assert.ok(distance(at('manual-midpoint'), first) >= 2 && distance(at('gather-midpoint'), evidence.gatherStart) >= 2,
    'manual and Gather midpoints must travel from the matched start');
  assert.equal(at('manual-stop').task, 'idle', 'Stop phase itself must show the override');
  return conservation;
}

export async function run(context) {
  validateCaptureContext(context);
  const { page, openPage, origin, source, capture } = context;
  const mapBytes = await readFile(new URL(`../maps/${ROUTE_MAP_ID}.json`, import.meta.url));
  const definition = JSON.parse(mapBytes), targets = plainFoodTargets(definition);
  const sourceBinding = { revision: source.revision, digest: source.digest };
  const scene = { mapId: definition.id, canonicalDefinitionSha256: digest(mapBytes), matchModeId: 'skirmish', matchModeVersion: 1 };
  const observer = `(${installRouteObserver.toString()})(${projectWorkCycleState.toString()},${JSON.stringify(definition.id)},${JSON.stringify(targets.map(node => node.id))})`;
  const install = targetPage => targetPage.cdp.call('Page.addScriptToEvaluateOnNewDocument', { source: observer });
  await install(page);
  await page.cdp.call('Page.navigate', { url: `${origin}/` });
  await page.wait("document.documentElement.dataset.entry==='menu' && !document.querySelector('#menu-create-room')?.disabled", 'normal create-room menu');
  await page.cdp.evaluate("document.querySelector('#menu-create-room').click()");
  await page.wait("document.documentElement.dataset.entry==='game' && document.querySelector('#room-lobby')?.open && !document.querySelector('#lobby-map')?.disabled", 'normal owned pregame room');
  const roomCode = await page.cdp.evaluate("new URL(location.href).searchParams.get('room')");
  assert.match(roomCode ?? '', /^[A-Za-z0-9_-]{32}$/, 'normal Create Room must create an invite room');
  await page.cdp.evaluate(`(()=>{const map=document.querySelector('#lobby-map'),option=[...map.options].find(o=>o.value===${JSON.stringify(definition.id)}&&!o.disabled);if(!option)throw new Error('reviewed ordinary map unavailable');map.value=option.value;map.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await page.wait(`document.querySelector('#lobby-map')?.value===${JSON.stringify(definition.id)} && !document.querySelector('#lobby-map')?.disabled`, 'canonical map UI selection');
  assert.equal(await page.cdp.evaluate("document.querySelector('#lobby-match-mode').value"), 'skirmish@1', 'normal map selection must preserve Skirmish');

  const guest = await openPage(); await install(guest);
  await guest.cdp.call('Page.navigate', { url: `${origin}/` });
  await guest.wait("document.documentElement.dataset.entry==='menu' && !document.querySelector('#menu-join')?.disabled", 'normal join-room menu');
  await guest.cdp.evaluate("document.querySelector('#menu-join').click()");
  await guest.cdp.evaluate(`(()=>{const dialog=document.querySelector('#menu-join-dialog');dialog.querySelector('input').value=${JSON.stringify(roomCode)};dialog.querySelector('form').requestSubmit();})()`);
  await guest.wait("document.querySelector('#room-lobby')?.open && !document.querySelector('#lobby-ready')?.disabled", 'second human pregame seat');
  assert.equal(await page.cdp.evaluate('window.__workerRoutes.team'), 0, 'creator must own Azure');
  assert.equal(await guest.cdp.evaluate('window.__workerRoutes.team'), 1, 'normal Join Room must own Ember');
  await page.cdp.evaluate("document.querySelector('#lobby-ready').click()");
  await page.wait("document.querySelector('#lobby-ready')?.textContent==='Not ready'", 'host ready accepted');
  await guest.cdp.evaluate("document.querySelector('#lobby-ready').click()");
  await page.wait("!document.querySelector('#lobby-launch')?.disabled", 'both humans ready');
  await page.cdp.evaluate("document.querySelector('#lobby-launch').click()");
  const running = `!document.querySelector('#room-lobby')?.open && document.documentElement.dataset.boot==='ready' && window.__rtsEnvironmentAssetStatus?.ready && window.__rtsEnvironmentStateSnapshot?.mapId===${JSON.stringify(definition.id)}`;
  await page.wait(running, 'launched ordinary host match'); await guest.wait(running, 'launched ordinary guest match');
  await page.cdp.evaluate("document.querySelector('#camera-home-base').click()");
  const snapshot = () => page.cdp.evaluate('window.__workerRoutes.latest');
  const live = await snapshot();
  assert.ok(live && live.workers.length > 1 && live.workers.every(w => w.task === 'idle' && w.cargo === 0), 'fresh owned idle Workers required');
  const worker = live.workers.slice().sort((a, b) => a.id - b.id)[0];
  const node = targets.filter(n => live.nodes.some(disclosed => disclosed.id === n.id && disclosed.stock > 20))
    .sort((a, b) => Math.hypot(a.x - worker.x, a.z - worker.z) - Math.hypot(b.x - worker.x, b.z - worker.z))[0];
  assert.ok(node && Math.hypot(node.x - worker.x, node.z - worker.z) > 5, 'visible plain Food source with room for two approach captures required');
  const evidence = { schemaVersion: 1, scope: 'ordinary-worker-routes', source: sourceBinding, scene,
    workerId: worker.id, nodeId: node.id, node: { id: node.id, x: node.x, z: node.z }, commands: [], frames: [] };
  const row = `window.__workerRoutes.latest?.workers.find(w=>w.id===${worker.id})`;
  const command = async payload => {
    assert.equal(await page.cdp.evaluate(`window.__rtsEnvironmentCaptureCommand(${JSON.stringify(payload)})`), true, 'one-Worker command must use the live client');
    evidence.commands.push(payload);
  };
  const settled = { x: Math.floor(worker.x) + 0.5, z: Math.floor(worker.z) + 0.5 };
  if (Math.hypot(worker.x - settled.x, worker.z - settled.z) > 0.02) {
    await command({ type: 'move', ids: [worker.id], ...settled });
    await page.wait(`(()=>{const w=${row};return w?.task==='idle'&&Math.hypot(w.x-(${settled.x}),w.z-(${settled.z}))<=0.02})()`, 'settled matched cell center');
  }
  evidence.initial = await snapshot();
  await page.cdp.evaluate(`window.__workerRoutes.workerId=${worker.id}`);

  let lastDirectory;
  const checkpoint = async name => {
    const frame = await page.cdp.evaluate(`window.__rtsQualification.request(${worker.id}).then(frame=>({...frame,state:window.__workerRoutes.latest}))`);
    const canvas = Buffer.from(frame.canvasPng, 'base64'); delete frame.canvasPng;
    const receipt = await capture({ page, mapId: definition.id, checkpoint: name });
    assert.equal(receipt.manifest.source.revision, source.revision, 'screenshot must bind the immutable source');
    assert.equal(receipt.manifest.scene.mapId, definition.id, 'screenshot must bind the applied canonical map');
    assert.equal(receipt.manifest.scene.checkpoint, name, 'screenshot must retain its unique phase');
    assert.ok(path.isAbsolute(receipt.directory) && path.basename(receipt.directory) === name, 'shared checkpoint directory required');
    assert.equal(receipt.manifest.image.file, 'color.png', 'shared screenshot filename required');
    const png = await readFile(path.join(receipt.directory, 'color.png'));
    assert.equal(digest(png), receipt.manifest.image.sha256, 'screenshot bytes must match the shared receipt');
    validateWorkCycleFrame(frame, png, canvas);
    frame.checkpoint = name; frame.pngSha256 = digest(png); frame.canvasSha256 = digest(canvas);
    frame.readbackSha256 = digest(Buffer.from(frame.pixels));
    evidence.frames.push(frame); lastDirectory = receipt.directory;
    await writeFile(path.join(receipt.directory, 'worker-canvas.png'), canvas, { flag: 'wx' });
    await writeFile(path.join(receipt.directory, 'worker-route-state.json'), `${JSON.stringify({
      schemaVersion: 1, source: sourceBinding, scene, checkpoint: name, workerId: worker.id, nodeId: node.id,
      frame, afterScreenshot: await snapshot(), image: { file: 'color.png', sha256: frame.pngSha256 },
      canvas: { file: 'worker-canvas.png', sha256: frame.canvasSha256 },
      timing: 'economy/frame readback precedes shared screenshot; afterScreenshot brackets receipt',
    }, null, 2)}\n`, { flag: 'wx' });
    return frame;
  };
  const displaced = (start, distance, task, cargo = 0) => `(()=>{const w=${row};return w?.task===${JSON.stringify(task)}&&w.cargo===${cargo}&&Math.hypot(w.x-(${start.x}),w.z-(${start.z}))>=${distance}&&Math.hypot(w.x-(${node.x}),w.z-(${node.z}))>2})()`;
  const workerAtFrame = frame => frame.state.workers.find(w => w.id === worker.id);
  await command({ type: 'move', ids: [worker.id], x: node.x, z: node.z });
  await page.wait(displaced(settled, 0.5, 'moving'), 'manual departure'); const manual = await checkpoint('manual-departure');
  await page.wait(`${displaced(settled, 2, 'moving')}&&${displaced(workerAtFrame(manual), 1, 'moving')}`, 'manual midpoint'); await checkpoint('manual-midpoint');
  await command({ type: 'move', ids: [worker.id], ...settled });
  await page.wait(`(()=>{const w=${row};return w?.task==='idle'&&Math.hypot(w.x-(${settled.x}),w.z-(${settled.z}))<=0.02})()`, 'return to identical settled start');
  evidence.gatherStart = await page.cdp.evaluate(row);
  await command({ type: 'gather', ids: [worker.id], nodeId: node.id });
  await page.wait(displaced(settled, 0.5, 'gathering'), 'gather departure'); const gather = await checkpoint('gather-departure');
  await page.wait(`${displaced(settled, 2, 'gathering')}&&${displaced(workerAtFrame(gather), 1, 'gathering')}`, 'gather midpoint'); await checkpoint('gather-midpoint');
  const harvesting = `(()=>{const w=${row};return w?.action==='gather-food'&&w.cargo>=0.5&&w.cargo<10})()`;
  await page.wait(harvesting, 'productive Food harvest'); await checkpoint('food-harvest');
  await page.wait(`(()=>{const w=${row};return w?.task==='returning'&&w.cargo===10&&Math.hypot(w.x-(${node.x}),w.z-(${node.z}))>1.9})()`, 'full-load automatic return', 30000);
  const returnFrame = await checkpoint('return-departure');
  const returnStart = returnFrame.state.workers.find(w => w.id === worker.id);
  await page.wait(displaced(returnStart, 1, 'returning', 10), 'automatic return midpoint'); await checkpoint('return-midpoint');
  await page.wait(`(()=>{const s=window.__workerRoutes.latest,w=${row};return s?.food===${evidence.initial.food + 10}&&w?.task==='gathering'&&w.cargo===0&&Math.hypot(w.x-(${node.x}),w.z-(${node.z}))>2})()`, 'one deposit and automatic resume');
  const deposit = await checkpoint('deposit-resume');
  await page.wait(displaced(deposit.state.workers.find(w => w.id === worker.id), 1, 'gathering'), 'resume midpoint');
  await checkpoint('resume-midpoint');
  await page.wait(harvesting, 'productive resumed Food harvest'); await checkpoint('food-resumed');
  await command({ type: 'stop', ids: [worker.id] });
  await page.wait(`(${row})?.task==='idle'`, 'manual Stop wins'); await checkpoint('manual-stop');
  evidence.final = await snapshot();
  Object.assign(evidence, await page.cdp.evaluate('({samples:window.__workerRoutes.samples,droppedSamples:window.__workerRoutes.droppedSamples})'));
  evidence.conservation = validateRouteEvidence(evidence);
  await writeFile(path.join(lastDirectory, 'worker-route-summary.json'), `${JSON.stringify(evidence, null, 2)}\n`, { flag: 'wx' });
  return { status: 'passed', checks: [
    'normal-create-join-ready-launch', 'canonical-human-skirmish-map', 'matched-manual-gather-start',
    'real-one-worker-food-work-cycle', 'food-stock-bank-cargo-conserved', 'unselected-workers-not-recruited',
    'manual-stop-wins', 'advancing-game-canvas-sequence',
  ].map(id => ({ id, passed: true })) };
}
