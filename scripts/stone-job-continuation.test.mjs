import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createPveHeadlessFixture, assertRecoveredWorkerObservation } from './pve-headless-fixture.mjs';
import { foodStoneJobMap, auditWorkerId, typedDraw } from './food-stone-job-fixture.mjs';
import { activeWorkIntent, createGatherWorkIntent } from '../src/work-intent.mjs';
import { GATHER_WORK_AREA_RADIUS, gatherWorkArea, inGatherWorkArea, nearbyGatherSources } from '../src/gather-work-area.mjs';

const stateOf = replay => replay.checkpoint().state;
const workerOf = (replay, team) => stateOf(replay).units[auditWorkerId(team)];
function conserved(state, map) {
  for (const resource of ['food', 'wood', 'stone']) {
    const bank = state[`team${resource[0].toUpperCase()}${resource.slice(1)}`];
    const deposited = bank.reduce((sum, value) => sum + value - (map.startingResources[resource] ?? 0), 0);
    const cargo = state.units.filter(unit => unit.cargoType === resource).reduce((sum, unit) => sum + unit.cargo, 0);
    assert.ok(Math.abs(typedDraw(state, map, resource) - deposited - cargo) < 1e-4, `${resource}: finite draw = bank + typed cargo`);
  }
}
function until(replay, map, predicate, label, limit = 2400) {
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

for (const team of [0, 1]) test(`seat ${team}: Stone continuation retains its original typed area through partial cargo and cold restore`, async () => {
  const map = foodStoneJobMap('stone');
  map.resourceNodes.push(...[0, 1].map(seat => ({ id: `seat-${seat}-wood`, type: 'wood', x: (seat ? 1 : -1) * 12.5, z: 6.5, stock: 6 })));
  const fixture = await createPveHeadlessFixture(map, { matchModeId: 'authored', matchModeVersion: 1 });
  const { replay } = fixture;
  try {
    await order(replay, team, { type: 'gather', nodeId: `seat-${team}-first` }, /GATHER ORDER/);
    until(replay, map, state => state.units[auditWorkerId(team)].gatherNodeId === `seat-${team}-next`
      && state.units[auditWorkerId(team)].cargo > 6, 'partial Stone cargo fills from the successor');
    const intent = structuredClone(workerOf(replay, team).workIntent);
    assert.deepEqual(intent, { version: 1, kind: 'gather', generation: workerOf(replay, team).generation,
      resource: 'stone', anchor: { x: (team ? 1 : -1) * 11.5, z: 5.5 } });
    const saved = replay.checkpoint(), views = [replay.observe(0), replay.observe(1)];
    replay.restore(saved);
    for (const seat of [0, 1]) assertRecoveredWorkerObservation(replay.observe(seat), views[seat]);
    assert.deepEqual(workerOf(replay, team).workIntent, intent);
    const done = until(replay, map, state => state.units[auditWorkerId(team)].cargo === 0
      && state.units[auditWorkerId(team)].gatherPhase === '', 'Stone area banks once and ends');
    assert.equal(done.teamStone[team], 12);
    assert.equal(done.units[auditWorkerId(team)].workIntent, null);
    for (const suffix of ['other', 'far', 'wood']) assert.equal(done.resourceNodes.find(n => n.id === `seat-${team}-${suffix}`).stock, 6);
    const revision = done.units[auditWorkerId(team)].orderRevision;
    for (let tick = 0; tick < 300; tick++) { replay.step(); conserved(stateOf(replay), map); }
    assert.equal(workerOf(replay, team).orderRevision, revision, 'empty area does not retry');
    assert.equal(stateOf(replay).teamStone[team], 12, 'completed delivery never duplicates');
  } finally { await fixture.dispose(); }
});

test('an explicit Stone intent cannot restore a Wood forest target', async () => {
  const map = foodStoneJobMap('stone'); map.obstacles = [{ column: 60, row: 100, width: 1, height: 1, material: 'forest' }];
  const fixture = await createPveHeadlessFixture(map, { matchModeId: 'authored', matchModeVersion: 1 });
  const { replay } = fixture;
  try {
    await order(replay, 0, { type: 'gather', forestCell: 100 * map.width + 60 }, /GATHER ORDER/);
    const before = stateOf(replay), bad = replay.checkpoint();
    assert.equal(bad.state.units[0].workIntent.resource, 'wood');
    bad.state.units[0].workIntent.resource = 'stone';
    assert.throws(() => replay.restore(bad), /invalid forest target/);
    assert.deepEqual(stateOf(replay), before);
  } finally { await fixture.dispose(); }
});

for (const team of [0, 1]) test(`seat ${team}: two Workers share the last Stone source without duplicates or empty-area retries`, async () => {
  const map = foodStoneJobMap('stone');
  map.resourceNodes = map.resourceNodes.filter(node => !node.id.endsWith('-next'));
  const fixture = await createPveHeadlessFixture(map, { matchModeId: 'authored', matchModeVersion: 1 });
  const { replay } = fixture, ids = [auditWorkerId(team), auditWorkerId(team) + 1];
  try {
    await order(replay, team, { type: 'gather', ids, nodeId: `seat-${team}-first` }, /GATHER ORDER/);
    until(replay, map, state => state.resourceNodes.find(n => n.id === `seat-${team}-first`).stock === 0, 'shared source depletes');
    const before = stateOf(replay);
    await order(replay, team, { type: 'gather', nodeId: `seat-${team}-first` }, /RESOURCE NODE EMPTY/);
    assert.deepEqual(stateOf(replay), before, 'depleted manual target rejection preserves complete authority');
    const done = until(replay, map, state => ids.every(id => state.units[id].cargo === 0 && state.units[id].gatherPhase === ''), 'last fractional cargo banks');
    assert.equal(done.teamStone[team], 6);
    assert.ok(ids.every(id => done.units[id].workIntent === null));
    for (const suffix of ['other', 'far']) assert.equal(done.resourceNodes.find(n => n.id === `seat-${team}-${suffix}`).stock, 6);
    const revisions = ids.map(id => done.units[id].orderRevision);
    for (let tick = 0; tick < 300; tick++) { replay.step(); conserved(stateOf(replay), map); }
    assert.deepEqual(ids.map(id => stateOf(replay).units[id].orderRevision), revisions);
    assert.equal(stateOf(replay).teamStone[team], 6);
  } finally { await fixture.dispose(); }
});

for (const team of [0, 1]) test(`seat ${team}: queued Move cancels Stone intent; queued return and incompatible manual replacement deposit each type once`, async () => {
  const map = foodStoneJobMap('stone'), fixture = await createPveHeadlessFixture(map, { matchModeId: 'authored', matchModeVersion: 1 });
  const { replay } = fixture;
  try {
    await order(replay, team, { type: 'gather', nodeId: `seat-${team}-first` }, /GATHER ORDER/);
    until(replay, map, state => state.units[auditWorkerId(team)].cargo > .5, 'actual partial Stone cargo');
    await order(replay, team, { type: 'move', queue: true, x: (team ? 1 : -1) * 15.5, z: -5.5 }, /MOVE|WAYPOINT/);
    assert.equal(workerOf(replay, team).workIntent, null);
    await order(replay, team, { type: 'stop' }, /STOP ORDER/);
    const stopped = stateOf(replay), retained = workerOf(replay, team).cargo;
    for (let tick = 0; tick < 90; tick++) replay.step();
    assert.deepEqual(stateOf(replay).resourceNodes, stopped.resourceNodes);
    assert.equal(workerOf(replay, team).cargo, retained);
    await order(replay, team, { type: 'returnCargo' }, /RETURN CARGO ORDER/);
    await order(replay, team, { type: 'attackMove', queue: true, x: (team ? 1 : -1) * 15.5, z: -5.5 }, /WAYPOINT QUEUED/);
    const saved = replay.checkpoint(), goal = workerOf(replay, team).queuedWaypoints[0].destination;
    replay.restore(saved);
    const done = until(replay, map, state => {
      const unit = state.units[auditWorkerId(team)];
      return unit.cargo === 0 && unit.gatherPhase === '' && unit.queuedWaypoints.length === 0
        && !unit.movePlanningPending && unit.pathIndex === unit.path.length && unit.moveGoalCell === goal;
    }, 'typed deposit precedes queued attack-move completion');
    assert.equal(done.teamStone[team], retained);
    assert.equal(done.units[auditWorkerId(team)].workIntent, null);
    assert.equal(done.units[auditWorkerId(team)].attackMove, true);
    assert.deepEqual(done.resourceNodes, stopped.resourceNodes);
    for (let tick = 0; tick < 90; tick++) { replay.step(); conserved(stateOf(replay), map); }
    assert.equal(stateOf(replay).teamStone[team], retained);
    await order(replay, team, { type: 'gather', nodeId: `seat-${team}-other` }, /GATHER ORDER/);
    until(replay, map, state => state.units[auditWorkerId(team)].cargo > .5, 'Food before Stone replacement');
    const foodCargo = workerOf(replay, team).cargo;
    await order(replay, team, { type: 'gather', nodeId: `seat-${team}-first` }, /GATHER ORDER/);
    assert.equal(workerOf(replay, team).workIntent.resource, 'stone');
    assert.equal(workerOf(replay, team).cargoType, 'food');
    assert.equal(workerOf(replay, team).gatherPhase, 'to-base');
    until(replay, map, state => state.units[auditWorkerId(team)].cargo === 0
      && state.units[auditWorkerId(team)].gatherPhase === '', 'remaining fixed Stone area finishes');
    assert.ok(Math.abs(stateOf(replay).teamFood[team] - 100 - foodCargo) < 1e-4);
    assert.equal(stateOf(replay).teamStone[team], 12);
    assert.equal(stateOf(replay).resourceNodes.find(n => n.id === `seat-${team}-far`).stock, 6);
  } finally { await fixture.dispose(); }
});

for (const team of [0, 1]) test(`seat ${team}: a hidden Stone successor inside the original circle is skipped and never wakes completed work`, async () => {
  const map = foodStoneJobMap('stone'); map.fogOfWar = true;
  Object.assign(map.resourceNodes.find(n => n.id === `seat-${team}-next`), { x: (team ? 1 : -1) * 11.5, z: 13 });
  const fixture = await createPveHeadlessFixture(map, { matchModeId: 'authored', matchModeVersion: 1 });
  const { replay } = fixture;
  try {
    await order(replay, team, { type: 'gather', nodeId: `seat-${team}-first` }, /GATHER ORDER/);
    const depleted = until(replay, map, state => state.resourceNodes.find(n => n.id === `seat-${team}-first`).stock === 0, 'visible Stone depletion');
    const hidden = depleted.resourceNodes.find(n => n.id === `seat-${team}-next`);
    assert.ok(inGatherWorkArea(gatherWorkArea(depleted.units[auditWorkerId(team)].workIntent.anchor, 'stone'), hidden));
    const cell = Math.floor(hidden.z + map.height / 2) * map.width + Math.floor(hidden.x + map.width / 2);
    const view = Buffer.from(replay.observe(team).visibility.data, 'base64');
    assert.notEqual((view[cell >> 2] >> ((cell & 3) * 2)) & 3, 2, 'inside-radius candidate is not currently visible at retarget time');
    const done = until(replay, map, state => state.units[auditWorkerId(team)].cargo === 0
      && state.units[auditWorkerId(team)].gatherPhase === '', 'hidden successor is excluded');
    assert.equal(done.teamStone[team], 6);
    assert.equal(done.resourceNodes.find(n => n.id === hidden.id).stock, 6);
    assert.equal(done.units[auditWorkerId(team)].workIntent, null);
    await order(replay, team, { type: 'move', x: hidden.x, z: 11.5 }, /MOVE ORDER/);
    until(replay, map, state => state.units[auditWorkerId(team)].pathIndex === state.units[auditWorkerId(team)].path.length, 'explicit discovery');
    for (let tick = 0; tick < 300; tick++) replay.step();
    assert.equal(workerOf(replay, team).workIntent, null);
    assert.equal(stateOf(replay).resourceNodes.find(n => n.id === hidden.id).stock, 6);
    conserved(stateOf(replay), map);
  } finally { await fixture.dispose(); }
});

test('legacy active Stone restores only its current source anchor; malformed intents fail without authority mutation', async () => {
  const map = foodStoneJobMap('stone'), fixture = await createPveHeadlessFixture(map, { matchModeId: 'authored', matchModeVersion: 1 });
  const { replay } = fixture;
  try {
    await order(replay, 0, { type: 'gather', nodeId: 'seat-0-first' }, /GATHER ORDER/);
    until(replay, map, state => state.units[0].cargo > .5, 'legacy partial draw');
    const legacy = replay.checkpoint(); for (const unit of legacy.state.units) delete unit.workIntent;
    replay.restore(legacy);
    assert.deepEqual(workerOf(replay, 0).workIntent, { version: 1, kind: 'gather', generation: workerOf(replay, 0).generation,
      resource: 'stone', anchor: { x: -11.5, z: 5.5 } });
    for (const change of [{ resource: 'food' }, { resource: 'wood' }, { generation: workerOf(replay, 0).generation + 1 }, { version: 2 }, { radius: 100 }]) {
      const bad = replay.checkpoint(), before = stateOf(replay);
      Object.assign(bad.state.units[0].workIntent, change);
      assert.throws(() => replay.restore(bad), /invalid unit work state|gather intent conflicts/);
      assert.deepEqual(stateOf(replay), before);
    }
    await order(replay, 0, { type: 'gather', nodeId: 'seat-0-other' }, /GATHER ORDER/);
    const food = replay.checkpoint(); for (const unit of food.state.units) delete unit.workIntent;
    replay.restore(food);
    assert.equal(workerOf(replay, 0).workIntent, null, 'legacy Food does not acquire Stone/Wood area policy');
    const mismatched = replay.checkpoint(), before = stateOf(replay);
    mismatched.state.units[0].workIntent = createGatherWorkIntent(workerOf(replay, 0).generation, { x: -11.5, z: 5.5 }, 'stone');
    assert.throws(() => replay.restore(mismatched), /gather intent conflicts/);
    assert.deepEqual(stateOf(replay), before);
    conserved(stateOf(replay), map);
  } finally { await fixture.dispose(); }
});

// Synthetic continuation topology boundary. Production function body is intact;
// no live authority or checkpoint topology is rewritten to force disconnection.
for (const obstruction of ['component', 'no-field', 'no-path']) test(`Stone continuation skips ${obstruction} candidate without clearing intent/cargo or scanning forest`, () => {
  const source = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
  const start = source.indexOf('function continueAreaGathering('), end = source.indexOf('\nfunction ', start + 1);
  assert.ok(start > 0 && end > start);
  const unit = { hp: 50, generation: 2, x: 0, z: 0, team: 0, cargo: 6, cargoType: 'stone', queuedWaypoints: [],
    workIntent: createGatherWorkIntent(2, { x: 0, z: 0 }, 'stone'), gatherNodeId: 'empty', gatherForestCell: -1 };
  const candidate = { id: 'next', type: 'stone', x: 1, z: 0, stock: 6 }, before = structuredClone(unit);
  const context = vm.createContext({ activeWorkIntent, gatherWorkArea, nearbyGatherSources, GATHER_WORK_AREA_RADIUS,
    WORKER_CARRY_CAPACITY: 10, nearestOpenCell: c => c, worldToCell: x => x,
    walkableComponents: obstruction === 'component' ? [0, 1] : [0, 0],
    resourceNodeStates: new Map([[candidate.id, candidate]]), MAP_WIDTH: 160, MAP_HEIGHT: 160,
    cellVisibleToTeam: () => true, isWalkable: () => true,
    forestCellMask: new Proxy([], { get() { assert.fail('Stone must not scan forest cells'); } }),
    getAttackFlowFieldForGoals: () => obstruction === 'no-field' ? null : { goals: new Set([1]) },
    pathFromAttackFlow: () => [], routeWorker() { assert.fail('unreachable source must not receive an execution route'); } });
  vm.runInContext(source.slice(start, end), context);
  assert.equal(context.continueAreaGathering(unit), false);
  assert.deepEqual(unit, before);
  assert.equal(candidate.stock, 6);
});
