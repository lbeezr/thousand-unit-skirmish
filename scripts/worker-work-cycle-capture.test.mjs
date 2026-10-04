// CPU capture rejection/projection contracts. No browser or rendered acceptance.
import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { id, installWorkCycleProbe, projectWorkCycleState, run, validateWorkCycle, validateWorkCycleFrame } from './worker-work-cycle-capture.mjs';

const nodeId = 'azure-berries';
const worker = { id: 0, team: 0, generation: 7, x: 0, z: 0, cargo: 0, cargoType: null, task: 'idle', action: null };
const other = { ...worker, id: 1, x: -2 };
function state(tick, updates = {}, stock = 300, food = 100) {
  return { tick, team: 0, food, workers: [{ ...worker, ...updates }, { ...other }], nodes: [{ id: nodeId, stock }] };
}
function evidence() {
  const samples = [
    state(2, { x: 0.6, task: 'moving' }),
    state(3, { x: 1, task: 'gathering' }),
    state(4, { x: 5, task: 'gathering', cargo: 0.5, cargoType: 'food', action: 'gather-food' }, 299.5),
    state(5, { x: 4, task: 'returning', cargo: 10, cargoType: 'food' }, 290),
    state(6, { x: 1, task: 'gathering' }, 290, 110),
    state(7, { x: 5, task: 'gathering', cargo: 0.5, cargoType: 'food', action: 'gather-food' }, 289.5, 110),
    state(8, { x: 5, cargo: 0.5, cargoType: 'food' }, 289.5, 110),
  ];
  const phases = ['manual-approach', 'gather-approach', 'harvest', 'automatic-return', 'deposit-resume', 'resume-harvest'];
  return { initial: state(1), final: samples.at(-1), workerId: 0, nodeId, droppedSamples: 0, samples,
    frames: phases.map((phase, i) => ({ phase, number: i + 1, time: (i + 1) * 100,
      pngSha256: String(i + 1).repeat(64), canvasSha256: String(i + 1).repeat(64), state: samples[i] })) };
}
function png(width = 1280, height = 720) {
  const bytes = Buffer.alloc(12000); Buffer.from('89504e470d0a1a0a', 'hex').copy(bytes);
  bytes.write('IHDR', 12); bytes.writeUInt32BE(width, 16); bytes.writeUInt32BE(height, 20); return bytes;
}

test('received projection retains only own Worker economy and disclosed allowlisted plain Food', () => {
  for (const team of [0, 1]) {
    const own = [4, team, 2.5, -3.5, 40, 'worker', 0.25, 'food', 8, 'gathering']; own[17] = 'gather-food';
    const message = { type: 'welcome', player: { team, sessionToken: 'private-token', name: 'private-name' },
      state: { mapId: 'open-field', tick: 9, food: team ? [9999, 100] : [100, 9999], secret: 'private-secret',
        homeTownCenters: [{ id: 50, team, type: 'town-center', complete: true, hp: 600, x: 2, z: 1, secret: 'private-home' }],
        buildings: [{ id: 51, team: 1 - team, type: 'storehouse', complete: true, hp: 300, x: 8, z: 9 }],
        units: [own, [5, 1 - team, 8, 9, 40, 'worker', 999, 'food', 1, 'idle'],
          [6, team, 4, 5, 40, 'infantry', 0, null, 1]],
        resourceNodes: [{ id: nodeId, type: 'food', stock: 299.75, secret: 'private-node' },
          { id: 'hidden-food', type: 'food', stock: 300 },
          { id: 'sheep', type: 'food', stock: 50, wildlifeSpecies: 'bellweather-sheep' },
          { id: 'fish', type: 'food', stock: 50, resourceVariant: 'shore-fish' }] } };
    const result = projectWorkCycleState(message, team, [nodeId, 'sheep', 'fish']);
    assert.equal(result.food, 100); assert.equal(result.team, team);
    assert.deepEqual(result.workers, [{ id: 4, team, generation: 8, x: 2.5, z: -3.5, cargo: 0.25,
      cargoType: 'food', task: 'gathering', action: 'gather-food' }]);
    assert.deepEqual(result.nodes, [{ id: nodeId, stock: 299.75 }]);
    assert.deepEqual(result.dropoffs, [{ id: 50, type: 'town-center', x: 2, z: 1 }]);
    assert.doesNotMatch(JSON.stringify(result), /private-|9999|hidden-food|sheep|fish/);
    assert.equal(projectWorkCycleState({ ...message, state: { ...message.state, mapId: 'unexpected-map' } }, team, [nodeId]), null);
    assert.equal(projectWorkCycleState(message, null, [nodeId]), null);
  }
});

test('one deposit and resumed productive harvest conserve exact typed Food without recruiting others', () => {
  assert.deepEqual(validateWorkCycle(evidence()), { startingFood: 100, bankedFood: 10, sourceDraw: 10.5,
    finalFoodCargo: 0.5, wireRoundingTolerance: 0.011, unselectedWorkers: 1 });
});

test('lost/duplicated cargo, bank changes, hidden sources, foreign seat and unselected recruitment fail', () => {
  const failures = [
    e => { e.samples[2].nodes[0].stock -= 1; },
    e => { e.samples[2].workers[0].cargo = 0; },
    e => { e.samples[2].workers[0].cargoType = 'wood'; },
    e => { e.samples[3].food += 10; },
    e => { e.samples[2].nodes = []; },
    e => { e.samples[2].team = 1; },
    e => { e.samples[2].workers[1].task = 'gathering'; },
    e => { e.samples[2].workers[1].cargo = 1; },
    e => { e.samples[2].workers[0].generation++; },
    e => { e.samples[2].workers[0].x = null; },
    e => { e.samples[2].tick = 0; },
    e => { e.droppedSamples = 1; },
    e => { e.final.food += 1; },
  ];
  for (const corrupt of failures) { const candidate = structuredClone(evidence()); corrupt(candidate); assert.throws(() => validateWorkCycle(candidate)); }
});

test('phase captures require real travel, receipts, one deposit, final Stop and advancing canvas', () => {
  const failures = [
    e => { e.frames.pop(); },
    e => { e.frames[0].state.workers[0].x = 0; },
    e => { e.frames[1].state.workers[0].x = 0; },
    e => { e.frames[2].state.workers[0].action = null; },
    e => { e.frames[3].state.workers[0].task = 'idle'; },
    e => { e.frames[3].state.workers[0].x = 5; },
    e => { e.frames[4].state.workers[0].task = 'returning'; },
    e => { e.frames[5].state.workers[0].action = null; },
    e => { e.final.workers[0].task = 'gathering'; },
    e => { e.frames[1].number = e.frames[0].number; },
    e => { e.frames[1].time = e.frames[0].time; },
    e => { e.frames[1].canvasSha256 = e.frames[0].canvasSha256; },
    e => { e.frames[1].pngSha256 = null; },
    e => { e.frames[1].state.food = 999; },
  ];
  for (const corrupt of failures) { const candidate = structuredClone(evidence()); corrupt(candidate); assert.throws(() => validateWorkCycle(candidate)); }
});

test('readback rejects GL failures, blank pixels and wrong canvas/screenshot dimensions', () => {
  const frame = { version: 'WebGL 2.0', contextLost: false, glError: 0, number: 2, time: 100,
    pixels: Array.from({ length: 48 }, (_, i) => [i, 20, 40, 255]).flat(), canvasWidth: 1000, canvasHeight: 600 };
  validateWorkCycleFrame(frame, png(), png(1000, 600));
  for (const change of [{ version: 'WebGL 1.0' }, { contextLost: true }, { glError: 1282 }, { time: NaN },
    { pixels: [] }, { pixels: Array(192).fill(0) }, { canvasWidth: 0 }]) {
    assert.throws(() => validateWorkCycleFrame({ ...frame, ...change }, png(), png(1000, 600)));
  }
  assert.throws(() => validateWorkCycleFrame(frame, png(1000, 600), png(1000, 600)));
  assert.throws(() => validateWorkCycleFrame(frame, png(), png()));
});

test('browser observation never retains raw messages/URLs; readback follows rendering with the current sample', async () => {
  let raf, rendered = false, reads = 0; const eventHandlers = [];
  class NativeSocket {
    constructor(url) { this.url = url; this.listeners = []; }
    addEventListener(_, callback) { this.listeners.push(callback); }
    receive(message) { for (const listener of this.listeners) listener({ data: JSON.stringify(message) }); }
  }
  const gl = { drawingBufferWidth: 1280, drawingBufferHeight: 720, VERSION: 1, RGBA: 2, UNSIGNED_BYTE: 3,
    readPixels(x, y, width, height, format, type, pixel) { assert.equal(rendered, true); pixel.set([++reads, 20, 40, 255]); },
    getParameter: () => 'WebGL 2.0', getError: () => 0, isContextLost: () => false };
  const window = { WebSocket: NativeSocket, requestAnimationFrame: callback => { raf = callback; return 1; },
    addEventListener: (_, callback) => eventHandlers.push(callback) };
  const context = vm.createContext({ window, console: { error() {} }, document: {
    querySelector: () => ({ getContext: () => gl, toDataURL: () => `data:image/png;base64,${png().toString('base64')}` }),
  } });
  vm.runInContext(`(${installWorkCycleProbe.toString()})(${projectWorkCycleState.toString()},${JSON.stringify([nodeId])})`, context);
  const socket = new window.WebSocket('ws://private-url/?token=private-token');
  const live = { mapId: 'open-field', tick: 9, food: [100, 9999], resourceNodes: [{ id: nodeId, type: 'food', stock: 300 }],
    units: [[0, 0, 2, 3, 40, 'worker', 0, null, 7, 'gathering']] };
  socket.receive({ type: 'welcome', player: { team: 0, sessionToken: 'private-token' }, state: live });
  window.__workerWorkCycle.workerId = 0;
  socket.receive({ type: 'state', ...live, tick: 10 });
  vm.runInContext("console.error('private-token')", context); eventHandlers[0]({ target: window });
  const capture = window.__workerWorkCycle.request();
  window.requestAnimationFrame(() => { rendered = true; }); raf(110);
  const frame = JSON.parse(JSON.stringify(await capture));
  validateWorkCycleFrame(frame, png(), Buffer.from(frame.canvasPng, 'base64'));
  assert.equal(frame.state.tick, 10); assert.equal(reads, 48);
  const retained = JSON.stringify({ state: frame.state, samples: window.__workerWorkCycle.samples, errors: window.__workerWorkCycle.errors });
  assert.doesNotMatch(retained, /private-|9999|sessionToken|socket/);
  assert.deepEqual(JSON.parse(JSON.stringify(window.__workerWorkCycle.errors)), [{ kind: 'console-error' }, { kind: 'exception' }]);
  for (let tick = 11; tick <= 2411; tick++) socket.receive({ type: 'state', ...live, tick });
  assert.equal(window.__workerWorkCycle.samples.length, 2400); assert.equal(window.__workerWorkCycle.droppedSamples, 2);
});

test('reusable adapter rejects remote/private origins without acquiring or disposing the caller browser', async () => {
  assert.equal(id, 'worker-work-cycle');
  const directory = await mkdtemp(path.join(os.tmpdir(), 'rts-work-cycle-contract-'));
  let acquisitions = 0, disposals = 0;
  const browser = { page: async () => { acquisitions++; }, dispose: async () => { disposals++; } };
  try {
    for (const origin of ['https://private-host.invalid/?token=private-token',
      'http://private-user:private-token@127.0.0.1:4321', 'http://127.0.0.1:4321/private-session']) {
      const report = await run({ browser, origin, evidenceDirectory: directory, pack: null });
      assert.equal(report.status, 'failed'); assert.equal(report.adapterId, id); assert.equal(report.frames.length, 0);
      assert.equal(acquisitions, 0); assert.equal(disposals, 0);
      const retained = await readFile(path.join(directory, 'work-cycle.json'), 'utf8');
      assert.doesNotMatch(retained, /private-|127\.0\.0\.1|https:/);
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});
