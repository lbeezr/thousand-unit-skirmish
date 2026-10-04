// CPU rejection/projection contracts. Shared CI #331 context module is required;
// absence fails import rather than silently skipping the joint dependency.
import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { contextVersion, id, installRouteObserver, plainFoodTargets, ROUTE_MAP_ID, run, validateRouteEvidence } from './renderer-worker-route-scenario.mjs';
import { projectWorkCycleState } from './worker-work-cycle-capture.mjs';
import { validateCaptureContext } from './renderer-capture-context.mjs';

const nodeId = 's0-home-food';
const worker = { id: 0, team: 0, generation: 7, x: 0, z: 0, cargo: 0, cargoType: null, task: 'idle', action: null };
function state(tick, changes = {}, stock = 650, food = 150) {
  return { tick, team: 0, food, workers: [{ ...worker, ...changes }, { ...worker, id: 1, x: -2 }], nodes: [{ id: nodeId, stock }] };
}
function evidence() {
  const samples = [state(2, { x: 0.6, task: 'moving' }), state(3, { x: 2.1, task: 'moving' }),
    state(4, { x: 1, task: 'gathering' }), state(5, { x: 2.5, task: 'gathering' }),
    state(6, { x: 5, task: 'gathering', cargo: 0.5, cargoType: 'food', action: 'gather-food' }, 649.5),
    state(7, { x: 4, task: 'returning', cargo: 10, cargoType: 'food' }, 640),
    state(8, { x: 3, task: 'returning', cargo: 10, cargoType: 'food' }, 640),
    state(9, { x: 1, task: 'gathering' }, 640, 160), state(10, { x: 2.1, task: 'gathering' }, 640, 160),
    state(11, { x: 5, task: 'gathering', cargo: 0.5, cargoType: 'food', action: 'gather-food' }, 639.5, 160),
    state(12, { x: 5, cargo: 0.5, cargoType: 'food' }, 639.5, 160)];
  const checkpoints = ['manual-departure', 'manual-midpoint', 'gather-departure', 'gather-midpoint', 'food-harvest',
    'return-departure', 'return-midpoint', 'deposit-resume', 'resume-midpoint', 'food-resumed', 'manual-stop'];
  return { initial: state(1), final: samples.at(-1), gatherStart: { ...worker }, workerId: 0, nodeId,
    droppedSamples: 0, samples, frames: checkpoints.map((checkpoint, i) => ({ checkpoint, state: structuredClone(samples[i]),
      number: i + 1, time: (i + 1) * 100, pngSha256: (i + 1).toString(16).padStart(64, '0'), canvasSha256: (i + 1).toString(16).padStart(64, '0') })) };
}

test('optional explicit canonical map preserves default Open Field rejection and own-seat projection', () => {
  const raw = { type: 'state', mapId: ROUTE_MAP_ID, tick: 1, food: [150, 9999],
    units: [[0, 0, 1, 2, 40, 'worker', 0, null, 7, 'idle'], [1, 1, 8, 9, 40, 'worker', 99, 'food', 8, 'idle']],
    resourceNodes: [{ id: nodeId, type: 'food', stock: 650 }] };
  assert.equal(projectWorkCycleState(raw, 0, [nodeId]), null);
  const explicit = projectWorkCycleState(raw, 0, [nodeId], ROUTE_MAP_ID);
  assert.equal(explicit.food, 150); assert.equal(explicit.workers.length, 1); assert.equal(explicit.nodes.length, 1);
  assert.equal(projectWorkCycleState({ ...raw, mapId: 'open-field' }, 0, [nodeId], ROUTE_MAP_ID), null);
  assert.ok(projectWorkCycleState({ ...raw, mapId: 'open-field' }, 0, [nodeId]));
  assert.equal(projectWorkCycleState(raw, 0, [nodeId], 'unselected-map'), null);
  assert.doesNotMatch(JSON.stringify(explicit), /9999/);
});

test('source-derived target admission excludes Sheep, fish, Farm and spent Food', () => {
  const source = { id: ROUTE_MAP_ID, resourceNodes: [
    { id: nodeId, type: 'food', stock: 650 }, { id: 'sheep', type: 'food', stock: 650, wildlifeSpecies: 'bellweather-sheep' },
    { id: 'fish', type: 'food', stock: 650, resourceVariant: 'shore-fish' },
    { id: 'farm', type: 'food', stock: 200, sourceBuildingId: 10 }, { id: 'spent', type: 'food', stock: 0 },
    { id: 'wood', type: 'wood', stock: 650 },
  ] };
  assert.deepEqual(plainFoodTargets(source).map(n => n.id), [nodeId]);
  assert.throws(() => plainFoodTargets({ ...source, id: 'open-field' }));
});

test('adapter consumes actual version1 immutable shared context, rejecting drift before acquiring pages', async () => {
  assert.equal(id, 'worker-routes'); assert.equal(contextVersion, 1);
  const page = { cdp: { call: async () => {}, evaluate: async () => {} }, wait: async () => {} };
  let acquired = 0;
  const context = { version: 1, page, openPage: async () => { acquired++; }, capture: async () => {},
    origin: 'http://127.0.0.1:4321', source: Object.freeze({ revision: 'a'.repeat(40), digest: `sha256:${'b'.repeat(64)}` }) };
  assert.equal(validateCaptureContext(context), context);
  for (const change of [{ version: 2 }, { openPage: undefined }, { capture: undefined },
    { source: { ...context.source } }, { origin: 'https://private-host.invalid' }]) {
    await assert.rejects(() => run({ ...context, ...change }));
  }
  assert.equal(acquired, 0);
});

test('ordinary phase receipts preserve one deposit, exact start and fresh productive resumption', () => {
  assert.deepEqual(validateRouteEvidence(evidence()), { startingFood: 150, bankedFood: 10, sourceDraw: 10.5,
    finalFoodCargo: 0.5, wireRoundingTolerance: 0.011, unselectedWorkers: 1 });
});

test('matched-start, typed conservation, visibility, override and advancing frames cannot silently weaken', () => {
  const corruptions = [e => { e.gatherStart.x += 0.03; }, e => { e.frames.pop(); },
    e => { e.samples[2].nodes = []; }, e => { e.samples[4].workers[0].cargoType = 'wood'; },
    e => { e.samples[2].nodes[0].stock--; }, e => { e.samples[3].food += 10; },
    e => { e.samples[2].workers[1].task = 'gathering'; }, e => { e.samples[2].workers[0].generation++; },
    e => { e.frames[1].canvasSha256 = e.frames[0].canvasSha256; }, e => { e.frames[1].number = e.frames[0].number; },
    e => { e.final.workers[0].task = 'gathering'; }, e => { e.droppedSamples = 1; }];
  for (const corrupt of corruptions) { const candidate = structuredClone(evidence()); corrupt(candidate); assert.throws(() => validateRouteEvidence(candidate)); }
});

test('every midpoint and Stop rejects missing, stale, foreign, nonconserving and wrong-task frames independently of samples', () => {
  for (const checkpoint of ['manual-midpoint', 'gather-midpoint', 'return-midpoint', 'resume-midpoint', 'manual-stop']) {
    for (const corrupt of [
      (e, i) => { e.frames.splice(i, 1); }, (e, i) => { e.frames[i].checkpoint = 'unreviewed-phase'; },
      (e, i) => { e.frames[i].number = e.frames[i - 1].number; }, (e, i) => { e.frames[i].time = e.frames[i - 1].time; },
      (e, i) => { e.frames[i].canvasSha256 = e.frames[i - 1].canvasSha256; },
      (e, i) => { e.frames[i].state.workers[0].id = 100; }, (e, i) => { e.frames[i].state.workers[0].generation++; },
      (e, i) => { e.frames[i].state.team = 1; }, (e, i) => { e.frames[i].state.workers[0].team = 1; },
      (e, i) => { e.frames[i].state.nodes = []; }, (e, i) => { e.frames[i].state.food++; },
      (e, i) => { e.frames[i].state.workers[1].task = 'gathering'; },
      (e, i) => { e.frames[i].state.workers[0].task = checkpoint === 'manual-stop' ? 'gathering' : 'idle'; },
      (e, i) => { e.frames[i].state.workers[0].x = NaN; },
    ]) {
      const candidate = evidence(), i = candidate.frames.findIndex(f => f.checkpoint === checkpoint);
      corrupt(candidate, i); assert.throws(() => validateRouteEvidence(candidate), checkpoint);
    }
    if (checkpoint !== 'manual-stop') {
      const candidate = evidence(), i = candidate.frames.findIndex(f => f.checkpoint === checkpoint);
      candidate.frames[i].state.workers[0].x = candidate.frames[i - 1].state.workers[0].x;
      assert.throws(() => validateRouteEvidence(candidate), 'midpoint needs displacement from its recorded departure');
      const wrongCargo = evidence(); wrongCargo.frames[i].state.workers[0].cargoType = 'food';
      wrongCargo.frames[i].state.workers[0].cargo = checkpoint === 'return-midpoint' ? 9 : 1;
      wrongCargo.frames[i].state.nodes[0].stock += checkpoint === 'return-midpoint' ? 1 : -1;
      assert.throws(() => validateRouteEvidence(wrongCargo), 'midpoint cargo expectation applies even when Food conserves');
    }
  }
  const sixOnly = evidence(); sixOnly.frames = sixOnly.frames.filter(f => !f.checkpoint.endsWith('midpoint') && f.checkpoint !== 'manual-stop');
  assert.throws(() => validateRouteEvidence(sixOnly), 'the old six-frame-only trace must fail');
  const reordered = evidence(); [reordered.frames[1], reordered.frames[2]] = [reordered.frames[2], reordered.frames[1]];
  assert.throws(() => validateRouteEvidence(reordered), 'all phase captures must retain their exact order');
});

test('normal-room observer preserves root diagnostics and URL while retaining bounded safe own-seat samples', () => {
  class Socket {
    constructor(url) { this.url = url; this.listeners = []; }
    addEventListener(_, listener) { this.listeners.push(listener); }
    receive(message) { for (const listener of this.listeners) listener({ data: JSON.stringify(message) }); }
  }
  const window = { WebSocket: Socket, __rtsCaptureDiagnostics: true,
    history: { replaceState() { throw new Error('URL mutation forbidden'); } }, location: { href: 'http://127.0.0.1:4321/' } };
  const context = vm.createContext({ window });
  vm.runInContext(`(${installRouteObserver.toString()})(${projectWorkCycleState.toString()},${JSON.stringify(ROUTE_MAP_ID)},${JSON.stringify([nodeId])})`, context);
  const socket = new window.WebSocket('ws://private-socket/?room=private-room');
  const state = { mapId: ROUTE_MAP_ID, tick: 1, food: [150, 9999], units: [[0, 0, 1, 2, 40, 'worker', 0, null, 7, 'idle']],
    resourceNodes: [{ id: nodeId, type: 'food', stock: 650 }] };
  socket.receive({ type: 'welcome', player: { team: 0, sessionToken: 'private-token' }, state });
  window.__workerRoutes.workerId = 0;
  socket.receive({ type: 'notice', message: 'private-notice' });
  for (let tick = 2; tick <= 2402; tick++) socket.receive({ type: 'state', ...state, tick });
  assert.equal(window.__workerRoutes.samples.length, 2400); assert.equal(window.__workerRoutes.droppedSamples, 1);
  assert.equal(window.__rtsCaptureDiagnostics, true); assert.equal(window.location.href, 'http://127.0.0.1:4321/');
  assert.doesNotMatch(JSON.stringify(window.__workerRoutes), /private-|9999|sessionToken|location|socket/);
});
