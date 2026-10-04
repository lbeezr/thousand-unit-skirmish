import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createPveHeadlessFixture, assertRecoveredWorkerObservation } from './pve-headless-fixture.mjs';
import { foodStoneJobMap, auditWorkerId, typedDraw } from './food-stone-job-fixture.mjs';
import { activeWorkIntent, createGatherWorkIntent } from '../src/work-intent.mjs';
import { gatherWorkArea, nearbyGatherSources, GATHER_WORK_AREA_RADIUS } from '../src/gather-work-area.mjs';

const stateOf = replay => replay.checkpoint().state;
const workerOf = (replay, team) => stateOf(replay).units[auditWorkerId(team)];
const expectedIntent = (worker, source) => ({ version: 1, kind: 'gather', generation: worker.generation,
  resource: 'food', sourceKind: 'neutral-land-food', anchor: { x: source.x, z: source.z } });
function conserved(state, map) {
  for (const resource of ['food', 'wood']) {
    const bank = state[`team${resource[0].toUpperCase()}${resource.slice(1)}`];
    const deposited = bank.reduce((sum, value) => sum + value - map.startingResources[resource], 0);
    const cargo = state.units.filter(unit => unit.cargoType === resource).reduce((sum, unit) => sum + unit.cargo, 0);
    const crop = state.buildings.filter(b => b.type === 'farm').reduce((sum, b) => sum + (b.harvestStock ?? 0), 0);
    const planting = state.buildings.filter(b => b.type === 'farm' && b.complete).length * 200;
    const paid = resource === 'wood' ? state.buildings.filter(b => b.type === 'farm').length * 60 : 0;
    assert.ok(Math.abs(typedDraw(state, map, resource) + (resource === 'food' ? planting - crop : 0)
      - deposited - cargo - paid) < 1e-4, `${resource}: stock = bank + typed cargo + paid cost`);
  }
}
function until(replay, map, predicate, label, limit = 3000) {
  for (let tick = 0; tick < limit; tick++) {
    const state = stateOf(replay); conserved(state, map);
    if (predicate(state)) return state;
    replay.step();
  }
  assert.fail(`Timed out: ${label}; ${JSON.stringify(stateOf(replay).units.map(({ id, cargo, gatherNodeId, gatherPhase, workIntent }) => ({ id, cargo, gatherNodeId, gatherPhase, workIntent })))}`);
}
async function order(replay, team, command, expected) {
  const notices = await replay.order(team, { ids: [auditWorkerId(team)], ...command }); replay.drain();
  assert.ok(notices.some(notice => expected.test(notice.message)), JSON.stringify(notices));
}
async function withMap(map, run) {
  const fixture = await createPveHeadlessFixture(map, { matchModeId: 'authored', matchModeVersion: 1 });
  try { await run(fixture.replay); } finally { await fixture.dispose(); }
}

for (const team of [0, 1]) test(`seat ${team}: plain Food fills across nodes and deposits repeatedly without changing its original area or recruiting Workers`, async () => {
  const map = foodStoneJobMap('food'), first = map.resourceNodes.find(n => n.id === `seat-${team}-first`);
  map.resourceNodes.find(n => n.id === `seat-${team}-next`).stock = 18;
  await withMap(map, async replay => {
    const untouched = stateOf(replay).units.filter(u => u.id !== auditWorkerId(team));
    await order(replay, team, { type: 'gather', nodeId: first.id }, /GATHER ORDER/);
    assert.deepEqual(workerOf(replay, team).workIntent, expectedIntent(workerOf(replay, team), first));
    until(replay, map, state => state.units[auditWorkerId(team)].gatherNodeId === `seat-${team}-next`
      && state.units[auditWorkerId(team)].cargo > 6, 'partial cargo reselects plain Food');
    const saved = replay.checkpoint(), views = [replay.observe(0), replay.observe(1)];
    replay.restore(saved);
    for (const seat of [0, 1]) assertRecoveredWorkerObservation(replay.observe(seat), views[seat]);
    assert.deepEqual(workerOf(replay, team).workIntent, expectedIntent(workerOf(replay, team), first));
    until(replay, map, state => state.teamFood[team] === 110 && state.units[auditWorkerId(team)].cargo > 0, 'first full deposit resumes');
    assert.deepEqual(workerOf(replay, team).workIntent.anchor, { x: first.x, z: first.z });
    const done = until(replay, map, state => state.units[auditWorkerId(team)].cargo === 0
      && state.units[auditWorkerId(team)].gatherPhase === '', 'three deposits finish the fixed area');
    assert.equal(done.teamFood[team], 124);
    assert.equal(done.units[auditWorkerId(team)].workIntent, null);
    assert.deepEqual(done.units.filter(u => u.id !== auditWorkerId(team)), untouched, 'all unselected actors retain complete state');
    for (const suffix of ['other', 'far']) assert.equal(done.resourceNodes.find(n => n.id === `seat-${team}-${suffix}`).stock, 6);
    assert.ok(done.resourceNodes.every(n => !Object.hasOwn(n, 'team') && !Object.hasOwn(n, 'sourceBuildingId')));
    const revision = done.units[auditWorkerId(team)].orderRevision;
    for (let tick = 0; tick < 300; tick++) replay.step();
    assert.equal(workerOf(replay, team).orderRevision, revision, 'finished job neither retries nor wakes');
    conserved(stateOf(replay), map);
  });
});

for (const team of [0, 1]) test(`seat ${team}: hidden plain Food inside the original area is skipped without a later wake-up`, async () => {
  const map = foodStoneJobMap('food'); map.fogOfWar = true;
  Object.assign(map.resourceNodes.find(n => n.id === `seat-${team}-next`), { x: (team ? 1 : -1) * 11.5, z: 13 });
  await withMap(map, async replay => {
    await order(replay, team, { type: 'gather', nodeId: `seat-${team}-first` }, /GATHER ORDER/);
    const depleted = until(replay, map, state => state.resourceNodes.find(n => n.id === `seat-${team}-first`).stock === 0, 'visible depletion');
    const hidden = depleted.resourceNodes.find(n => n.id === `seat-${team}-next`);
    const cell = Math.floor(hidden.z + map.height / 2) * map.width + Math.floor(hidden.x + map.width / 2);
    const visibility = Buffer.from(replay.observe(team).visibility.data, 'base64');
    assert.notEqual((visibility[cell >> 2] >> ((cell & 3) * 2)) & 3, 2, 'candidate actually undisclosed at reselection');
    const done = until(replay, map, state => state.units[auditWorkerId(team)].cargo === 0
      && state.units[auditWorkerId(team)].gatherPhase === '', 'hidden area ends');
    assert.equal(done.teamFood[team], 106); assert.equal(done.units[auditWorkerId(team)].workIntent, null);
    await order(replay, team, { type: 'move', x: hidden.x, z: 11.5 }, /MOVE ORDER/);
    until(replay, map, state => state.units[auditWorkerId(team)].pathIndex === state.units[auditWorkerId(team)].path.length, 'manual discovery');
    for (let tick = 0; tick < 300; tick++) replay.step();
    assert.equal(workerOf(replay, team).workIntent, null);
    assert.equal(stateOf(replay).resourceNodes.find(n => n.id === hidden.id).stock, 6);
  });
});

for (const team of [0, 1]) test(`seat ${team}: selected Workers share fractional final Food exactly without recruiting anyone else`, async () => {
  const map = foodStoneJobMap('food'); map.resourceNodes = map.resourceNodes.filter(n => !n.id.endsWith('-next'));
  map.resourceNodes.find(n => n.id === `seat-${team}-first`).stock = .004;
  await withMap(map, async replay => {
    const ids = [auditWorkerId(team), auditWorkerId(team) + 1], untouched = stateOf(replay).units.filter(u => !ids.includes(u.id));
    await order(replay, team, { type: 'gather', ids, nodeId: `seat-${team}-first` }, /GATHER ORDER/);
    const done = until(replay, map, state => ids.every(id => state.units[id].cargo === 0 && state.units[id].gatherPhase === ''), 'fractional shared delivery');
    assert.ok(Math.abs(done.teamFood[team] - 100.004) < 1e-8);
    assert.ok(ids.every(id => done.units[id].workIntent === null));
    assert.deepEqual(done.units.filter(u => !ids.includes(u.id)), untouched);
    assert.equal(done.resourceNodes.find(n => n.id === `seat-${team}-far`).stock, 6);
  });
});

test('legacy Food remains source-only; source-class and generation corruption is rejected atomically', async () => {
  const map = foodStoneJobMap('food');
  await withMap(map, async replay => {
    await order(replay, 0, { type: 'gather', nodeId: 'seat-0-first' }, /GATHER ORDER/);
    until(replay, map, state => state.units[0].cargo > .5, 'real cargo');
    const good = replay.checkpoint();
    for (const change of [{ sourceKind: 'farm' }, { sourceKind: undefined }, { resource: 'wood' },
      { generation: good.state.units[0].generation + 1 }, { version: 2 }, { radius: 100 }]) {
      const bad = structuredClone(good), before = stateOf(replay);
      Object.assign(bad.state.units[0].workIntent, change);
      assert.throws(() => replay.restore(bad), /invalid unit work state|gather intent conflicts/);
      assert.deepEqual(stateOf(replay), before);
    }
    for (const missing of [true, false]) {
      const legacy = structuredClone(good);
      if (missing) delete legacy.state.units[0].workIntent; else legacy.state.units[0].workIntent = null;
      replay.restore(legacy);
      assert.equal(workerOf(replay, 0).workIntent, null);
      const done = until(replay, map, state => state.units[0].cargo === 0 && state.units[0].gatherPhase === '', 'legacy source-only finish');
      assert.equal(done.teamFood[0], 106); assert.equal(done.resourceNodes.find(n => n.id === 'seat-0-next').stock, 6);
    }
  });
});

for (const team of [0, 1]) test(`seat ${team}: plain Food cannot take nearby paid Farm, live Sheep, carcass or shore fish; manual assignments stay source-only`, async () => {
  const map = foodStoneJobMap('food'), sign = team ? 1 : -1;
  const liveId = `seat-${team}-sheep`, carcassId = `seat-${team}-carcass`, fishId = `seat-${team}-fish`;
  map.resourceNodes.push({ id: liveId, type: 'food', wildlifeSpecies: 'bellweather-sheep', x: sign * 13.5, z: 7.5, stock: 4 },
    { id: carcassId, type: 'food', wildlifeSpecies: 'bellweather-sheep', x: sign * 10.5, z: 7.5, stock: 4 },
    { id: fishId, type: 'food', resourceVariant: 'shore-fish', x: sign * 12.5, z: 5.5, stock: 4 });
  map.obstacles.push({ column: Math.floor(sign * 13.5 + 80), row: 85, width: 1, height: 1, material: 'water' });
  await withMap(map, async replay => {
    await order(replay, team, { type: 'build', buildingType: 'farm', x: sign * 11.5, z: 11.5 }, /PLACED|PLANNING BUILD/);
    until(replay, map, state => state.buildings.some(b => b.type === 'farm' && b.complete), 'actual paid Farm completes');
    const farm = stateOf(replay).buildings.find(b => b.type === 'farm'), farmId = `farm:${farm.id}`;
    await order(replay, team, { type: 'gather', ids: [auditWorkerId(team) + 1], nodeId: carcassId }, /GATHER ORDER/);
    assert.equal(stateOf(replay).units[auditWorkerId(team) + 1].workIntent, null);
    until(replay, map, state => state.resourceNodes.find(n => n.id === carcassId).wildlifeState === 'carcass', 'actual interaction creates carcass');
    await order(replay, team, { type: 'stop', ids: [auditWorkerId(team) + 1] }, /STOP ORDER/);
    const carcassStock = stateOf(replay).resourceNodes.find(n => n.id === carcassId).stock;
    await order(replay, team, { type: 'gather', nodeId: `seat-${team}-first` }, /GATHER ORDER/);
    const plainIntent = workerOf(replay, team).workIntent;
    const done = until(replay, map, state => state.units[auditWorkerId(team)].cargo === 0
      && state.units[auditWorkerId(team)].gatherPhase === '', 'only plain Food continues');
    assert.equal(done.teamFood[team], 112); assert.equal(done.teamWood[team], 40);
    assert.equal(done.buildings.find(b => b.id === farm.id).harvestStock, 200);
    assert.equal(done.resourceNodes.find(n => n.id === liveId).stock, 4);
    assert.equal(done.resourceNodes.find(n => n.id === liveId).wildlifeState, 'alive');
    assert.equal(done.resourceNodes.find(n => n.id === carcassId).stock, carcassStock);
    assert.equal(done.resourceNodes.find(n => n.id === fishId).stock, 4);
    assert.equal(done.units[auditWorkerId(team)].workIntent, null);
    for (const target of [farmId, liveId, carcassId, fishId]) {
      await order(replay, team, { type: 'gather', nodeId: target }, /GATHER ORDER/);
      assert.equal(workerOf(replay, team).workIntent, null, `${target} retains manual source-only policy`);
      const bad = replay.checkpoint(), before = stateOf(replay);
      bad.state.units[auditWorkerId(team)].workIntent = structuredClone(plainIntent);
      assert.throws(() => replay.restore(bad), /Food intent conflicts with source class/);
      assert.deepEqual(stateOf(replay), before);
    }
    const before = stateOf(replay);
    await order(replay, 1 - team, { ids: [auditWorkerId(1 - team)], type: 'gather', nodeId: farmId }, /FARM BELONGS TO THE OTHER TEAM/);
    assert.deepEqual(stateOf(replay), before);
  });
});

for (const team of [0, 1]) test(`seat ${team}: accepted queued movement cancels plain Food; a later explicit return deposits retained cargo before its queued route`, async () => {
  const map = foodStoneJobMap('food');
  await withMap(map, async replay => {
    await order(replay, team, { type: 'gather', nodeId: `seat-${team}-first` }, /GATHER ORDER/);
    until(replay, map, state => state.units[auditWorkerId(team)].cargo > .5, 'real Food before queue');
    await order(replay, team, { type: 'attackMove', queue: true, x: (team ? 1 : -1) * 15.5, z: -5.5 }, /MOVE|WAYPOINT/);
    assert.equal(workerOf(replay, team).workIntent, null);
    // Existing queue semantics can start a leg immediately when gathering has
    // no active route. Stop preserves cargo; explicit Return owns its delivery.
    await order(replay, team, { type: 'stop' }, /STOP ORDER/);
    const retained = workerOf(replay, team).cargo, stoppedStock = stateOf(replay).resourceNodes;
    await order(replay, team, { type: 'returnCargo' }, /RETURN CARGO ORDER/);
    await order(replay, team, { type: 'attackMove', queue: true, x: (team ? 1 : -1) * 15.5, z: -5.5 }, /WAYPOINT QUEUED/);
    const goal = workerOf(replay, team).queuedWaypoints[0].destination, saved = replay.checkpoint();
    replay.restore(saved);
    const done = until(replay, map, state => {
      const unit = state.units[auditWorkerId(team)];
      return unit.cargo === 0 && unit.gatherPhase === '' && unit.queuedWaypoints.length === 0
        && !unit.movePlanningPending && unit.pathIndex === unit.path.length && unit.moveGoalCell === goal;
    }, 'current Food delivery precedes the queued attack move');
    assert.equal(done.teamFood[team], 100 + retained);
    assert.deepEqual(done.resourceNodes, stoppedStock);
    assert.equal(done.resourceNodes.find(n => n.id === `seat-${team}-next`).stock, 6);
    assert.equal(done.units[auditWorkerId(team)].workIntent, null);
    assert.equal(done.units[auditWorkerId(team)].attackMove, true);
  });
});

// Explicit production route-boundary fixture; no live topology is overwritten.
for (const obstruction of ['component', 'no-field', 'no-path']) test(`plain Food continuation skips ${obstruction} without debit, target change or forest scan`, () => {
  const source = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
  const start = source.indexOf('function continueAreaGathering('), end = source.indexOf('\nfunction ', start + 1);
  const node = { id: 'next', type: 'food', x: 1, z: 0, stock: 6 };
  const unit = { hp: 50, generation: 2, x: 0, z: 0, team: 0, cargo: 6, cargoType: 'food', queuedWaypoints: [],
    workIntent: expectedIntent({ generation: 2 }, { x: 0, z: 0 }), gatherNodeId: 'empty', gatherForestCell: -1 };
  const before = structuredClone(unit);
  const context = vm.createContext({ activeWorkIntent, gatherWorkArea, nearbyGatherSources, GATHER_WORK_AREA_RADIUS,
    WORKER_CARRY_CAPACITY: 10, nearestOpenCell: c => c, worldToCell: x => x,
    walkableComponents: obstruction === 'component' ? [0, 1] : [0, 0],
    resourceNodeStates: new Map([[node.id, node]]), MAP_WIDTH: 160, MAP_HEIGHT: 160,
    cellVisibleToTeam: () => true, isWalkable: () => true,
    forestCellMask: new Proxy([], { get() { assert.fail('Food must not scan forest'); } }),
    getAttackFlowFieldForGoals: () => obstruction === 'no-field' ? null : { goals: new Set([1]) },
    pathFromAttackFlow: () => [], routeWorker() { assert.fail('unreachable candidate must not route'); } });
  vm.runInContext(source.slice(start, end), context);
  assert.equal(context.continueAreaGathering(unit), false); assert.deepEqual(unit, before); assert.equal(node.stock, 6);
});
