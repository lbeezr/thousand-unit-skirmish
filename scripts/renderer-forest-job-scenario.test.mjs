import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import * as adapter from './renderer-forest-job-scenario.mjs';
import { validateCaptureAdapter } from './renderer-capture-context.mjs';

const row = (cargo = 0, action = null, task = 'gathering', generation = 1) => {
  const value = []; Object.assign(value, { 0: 10, 1: 0, 2: -44, 3: -2, 4: 25,
    5: 'worker', 6: cargo, 7: cargo ? 'wood' : null, 8: generation, 9: task, 17: action }); return value;
};
const message = (units = [row()], wood = [100, null], stocks = [[0, 5]]) => ({
  type: 'state', mapId: 'veyrholds-terraced-vale', tick: 5, units, wood,
  visibility: { columns: 2, rows: 2, data: Buffer.from([2]).toString('base64') }, forestStocks: stocks,
  player: { token: 'must-not-retain' }, food: [100, 789], notices: ['private metadata'],
});
const progress = () => ({ valid: true, private: true, lastWood: 100, workers: [{ id: 10,
  generation: 1, lastCargo: 0, deposits: 0, harvest: false, returned: false, resumed: false }] });

test('owned adapter imports without a workload and declares the actual version1 interface', () => {
  assert.equal(validateCaptureAdapter(adapter, 'forest-jobs'), adapter);
});
test('seat projection excludes raw/private metadata and flags unauthorized forest disclosure', () => {
  const state = adapter.projectForestJobState(message(), 0);
  assert.deepEqual(Object.keys(state).sort(), ['tick', 'team', 'wood', 'visibility', 'otherBankPrivate', 'foreignWorkers', 'stocksPrivate', 'workers'].sort());
  assert.equal(state.otherBankPrivate, true); assert.equal(state.stocksPrivate, true);
  assert.equal(JSON.stringify(state).includes('must-not-retain'), false);
  assert.equal(adapter.projectForestJobState(message(), null), null);
  assert.equal(adapter.projectForestJobState({ ...message(), mapId: 'open-field' }, 0), null);
  assert.equal(adapter.projectForestJobState(message([row()], [100, 999], [[1, 0]]), 0).stocksPrivate, false);
  assert.equal(adapter.projectForestJobState(message([], [100, 999]), 0).otherBankPrivate, false);
});
test('productive observation requires real bank credit, typed cargo, return and resumed harvest', () => {
  const job = progress();
  for (const [cargo, action, task, wood] of [[3, 'gather-wood', 'gathering', 100],
    [10, null, 'returning', 100], [0, null, 'gathering', 110], [0, null, 'gathering', 110],
    [2, 'gather-wood', 'gathering', 110], [10, null, 'returning', 110],
    [0, null, 'gathering', 120], [5, 'gather-wood', 'gathering', 120],
    [10, null, 'returning', 120], [0, null, 'gathering', 130]]) {
    adapter.observeForestJobCycle(job, adapter.projectForestJobState(message([row(cargo, action, task)], [wood, null]), 0));
  }
  assert.equal(job.valid, true); assert.equal(job.private, true);
  assert.deepEqual(job.workers.map(worker => [worker.deposits, worker.harvest, worker.returned, worker.resumed]), [[3, true, true, true]]);
});
test('lost cargo, replaced Worker, wrong cargo and private-bank disclosure cannot pass', () => {
  for (const failure of ['lost', 'generation', 'cargo', 'privacy']) {
    const job = progress();
    adapter.observeForestJobCycle(job, adapter.projectForestJobState(message([row(10, null, 'returning')]), 0));
    const worker = row(failure === 'lost' ? 0 : 5, null, 'gathering', failure === 'generation' ? 2 : 1);
    if (failure === 'cargo') worker[7] = 'food';
    adapter.observeForestJobCycle(job, adapter.projectForestJobState(message([worker], [100, failure === 'privacy' ? 999 : null]), 0));
    assert.equal(failure === 'privacy' ? job.private : job.valid, false, failure);
  }
});
test('canonical both-seat plan uses bounded authored open edges without changing map resources', async () => {
  const map = JSON.parse(await readFile(new URL('../maps/veyrholds-terraced-vale.json', import.meta.url)));
  const original = JSON.stringify(map);
  for (const spawn of map.spawnPoints) {
    const plan = adapter.planForestApproach(map, spawn);
    assert.ok(plan.cells.includes(plan.cell));
    const col = Math.floor(plan.target.x + map.width / 2), row = Math.floor(plan.target.z + map.height / 2);
    assert.ok(col >= 0 && col < map.width && row >= 0 && row < map.height);
    assert.equal(map.obstacles.some(o => col >= o.column && col < o.column + o.width && row >= o.row && row < o.row + o.height), false);
  }
  assert.equal(JSON.stringify(map), original);
});
test('post-render observation reads selected owned actors without changing the rendered world', async () => {
  const actors = [{ id: 10, hp: 25, team: 0, kind: 'worker', renderX: 0, renderZ: 0 },
    { id: 20, hp: 25, team: 1, kind: 'worker', renderX: 0, renderZ: 0 },
    { id: 11, hp: 25, team: 0, kind: 'worker', renderX: 2, renderZ: 0 }];
  const before = JSON.stringify(actors); actors.forEach(Object.freeze); Object.freeze(actors);
  class Vector {
    constructor(x, y, z) { Object.assign(this, { x, y, z }); }
    project() { return this; }
  }
  const context = vm.createContext({ window: { __forestJobCapture: {} }, localTeam: 0, units: actors,
    selected: new Set([10]), groundHeight: () => -1.25, camera: Object.freeze({}), THREE: { Vector3: Vector },
    renderer: { info: { render: { frame: 99 } }, domElement: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }) } } });
  assert.equal(vm.runInContext(`(${adapter.observeRenderedForestWorkers.toString()})()`, context), false, 'breakpoint must not pause');
  const output = JSON.parse(JSON.stringify(context.window.__forestJobCapture.render));
  assert.deepEqual(output.workers.map(worker => [worker.id, worker.selected, worker.inView]), [[10, true, true], [11, false, false]]);
  assert.equal(JSON.stringify(actors), before);
  const source = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.equal(source.split('\n').filter(line => line.trim() === 'renderer.render(scene, camera);').length, 1);
});
