import assert from 'node:assert/strict';
import test from 'node:test';
import { createPveHeadlessFixture, assertRecoveredWorkerObservation } from './pve-headless-fixture.mjs';
import { woodJobMap, woodJobTarget, woodDraw } from './resource-job-fixture.mjs';
import { BUILDING_DEFINITIONS } from '../src/gameplay-definitions.mjs';

const stateOf = replay => replay.checkpoint().state;
const workerOf = replay => stateOf(replay).units[0];
function until(replay, condition, label, limit = 3000) {
  for (let tick = 0; tick < limit; tick++) { if (condition(stateOf(replay))) return stateOf(replay); replay.step(); }
  assert.fail(`Timed out: ${label}; worker ${JSON.stringify(workerOf(replay))}`);
}
async function order(replay, command, expected) {
  const notices = await replay.order(0, { ids: [0], ...command }); replay.drain();
  assert.ok(notices.some(n => expected.test(n.message)), JSON.stringify(notices));
}
function conserved(state, map, paidWood = 0) {
  const cargo = state.units.filter(u => u.team === 0 && u.cargoType === 'wood').reduce((sum, u) => sum + u.cargo, 0);
  assert.ok(Math.abs(woodDraw(state, map) - (state.teamWood[0] - 100 + paidWood) - cargo) < 1e-4, 'draw = bank + cargo + paid Wood');
}

for (const kind of ['forest', 'node']) test(`${kind} work preserves original anchor across deliveries/cold restore and exhausts only its finite area with real paid Farm`, async () => {
  const map = woodJobMap(kind), fixture = await createPveHeadlessFixture(map, { matchModeId: 'authored', matchModeVersion: 1 });
  const { replay } = fixture;
  try {
    await order(replay, { type: 'build', ids: [1], buildingType: 'farm', x: -14.5, z: -8.5 }, /PLACED|BUILD ORDER|PLANNING BUILD/);
    await order(replay, { type: 'gather', ...woodJobTarget(kind) }, /GATHER ORDER/);
    const anchor = structuredClone(workerOf(replay).workIntent.anchor);
    const changed = until(replay, state => {
      const worker = state.units[0];
      return worker.gatherPhase === 'gathering' && worker.cargo > 6
        && (kind === 'forest' ? worker.gatherForestCell !== woodJobTarget(kind).forestCell : worker.gatherNodeId === 'next-tree');
    }, 'replacement source receives actual work');
    conserved(changed, map, BUILDING_DEFINITIONS.farm.cost.wood);
    const saved = replay.checkpoint(), before = [replay.observe(0), replay.observe(1)];
    replay.restore(saved);
    for (const team of [0, 1]) assertRecoveredWorkerObservation(replay.observe(team), before[team]);
    assert.deepEqual(workerOf(replay).workIntent.anchor, anchor);
    const finished = until(replay, state => state.units[0].gatherPhase === '' && state.units[0].cargo === 0
      && state.buildings.some(b => b.type === 'farm' && b.complete), 'area exhausts and paid Farm completes');
    assert.equal(finished.units[0].workIntent, null);
    assert.ok(Math.abs(finished.teamWood[0] - (100 - BUILDING_DEFINITIONS.farm.cost.wood + (kind === 'forest' ? 18 : 12))) < 1e-4);
    assert.equal(finished.teamFood[0], 100);
    assert.equal(finished.buildings.filter(b => b.type === 'farm').length, 1);
    assert.equal(finished.buildings.find(b => b.type === 'farm').harvestStock, 200);
    if (kind === 'node') {
      assert.equal(finished.resourceNodes.find(n => n.id === 'far-tree').stock, 6);
      assert.equal(finished.resourceNodes.find(n => n.id === 'near-food').stock, 6);
    }
    conserved(finished, map, BUILDING_DEFINITIONS.farm.cost.wood);
    const revision = finished.units[0].orderRevision;
    for (let tick = 0; tick < 300; tick++) replay.step();
    assert.equal(workerOf(replay).orderRevision, revision, 'exhausted area never starts a retry loop');
    conserved(stateOf(replay), map, BUILDING_DEFINITIONS.farm.cost.wood);
  } finally { await fixture.dispose(); }
});

test('accepted queued Move/Stop/Return/manual replacement win; rejected and foreign orders preserve current job and all typed cargo', async () => {
  const map = woodJobMap('node'), fixture = await createPveHeadlessFixture(map, { matchModeId: 'authored', matchModeVersion: 1 });
  const { replay } = fixture;
  try {
    await order(replay, { type: 'gather', nodeId: 'first-tree' }, /GATHER ORDER/);
    until(replay, s => s.units[0].gatherNodeId === 'next-tree' && s.units[0].cargo > 6, 'partial cargo after first depletion');
    const intent = structuredClone(workerOf(replay).workIntent);
    await order(replay, { type: 'move', x: 'invalid', z: 0 }, /REJECTED/);
    assert.deepEqual(workerOf(replay).workIntent, intent);
    await order(replay, { type: 'move', ids: [4], x: 0.5, z: 0.5 }, /REJECTED|NO VALID|NO UNITS/);
    assert.deepEqual(workerOf(replay).workIntent, intent);
    await order(replay, { type: 'move', queue: true, x: -5.5, z: -5.5 }, /MOVE|WAYPOINT/);
    assert.equal(workerOf(replay).workIntent, null, 'existing queued request replaces an active gather job');
    await order(replay, { type: 'stop' }, /STOP ORDER/);
    const stopped = stateOf(replay), retained = stopped.units[0].cargo;
    for (let tick = 0; tick < 100; tick++) replay.step();
    assert.equal(workerOf(replay).cargo, retained); assert.equal(workerOf(replay).gatherPhase, '');
    assert.deepEqual(stateOf(replay).resourceNodes, stopped.resourceNodes);
    await order(replay, { type: 'returnCargo' }, /RETURN CARGO ORDER/);
    await order(replay, { type: 'move', queue: true, x: -5.5, z: -5.5 }, /WAYPOINT QUEUED/);
    until(replay, s => s.units[0].cargo === 0 && s.units[0].queuedWaypoints.length === 0
      && s.units[0].pathIndex >= s.units[0].path.length, 'real return then queued destination');
    assert.equal(workerOf(replay).workIntent, null); conserved(stateOf(replay), map);
    await order(replay, { type: 'gather', nodeId: 'near-food' }, /GATHER ORDER/);
    until(replay, s => s.units[0].cargoType === 'food' && s.units[0].cargo > 0, 'manual food replaces Wood');
    assert.equal(workerOf(replay).workIntent, null);
    await order(replay, { type: 'stop' }, /STOP ORDER/);
    const foodStock = stateOf(replay).resourceNodes.find(n => n.id === 'near-food').stock;
    await order(replay, { type: 'gather', nodeId: 'next-tree' }, /GATHER ORDER/);
    assert.deepEqual(workerOf(replay).workIntent.anchor, { x: -10.5, z: 5.5 }, 'manual replacement creates a new anchor');
    until(replay, s => s.units[0].cargo === 0 && s.units[0].gatherPhase === '', 'remaining Wood area finishes');
    assert.ok(Math.abs(stateOf(replay).teamFood[0] - (106 - foodStock)) < 1e-4, 'incompatible Food cargo banks once before Wood');
    conserved(stateOf(replay), map);
    assert.equal(stateOf(replay).resourceNodes.find(n => n.id === 'far-tree').stock, 6);
  } finally { await fixture.dispose(); }
});

test('legacy cold restore creates only the existing active Wood job and rejects malformed/cross-generation intent without mutating authority', async () => {
  const map = woodJobMap('node'), fixture = await createPveHeadlessFixture(map, { matchModeId: 'authored', matchModeVersion: 1 });
  const { replay } = fixture;
  try {
    await order(replay, { type: 'gather', nodeId: 'first-tree' }, /GATHER ORDER/);
    until(replay, s => s.units[0].cargo > 0 && s.units[0].cargo < 1, 'first active source');
    const legacy = replay.checkpoint(); for (const unit of legacy.state.units) delete unit.workIntent;
    replay.restore(legacy);
    assert.deepEqual(workerOf(replay).workIntent.anchor, { x: -11.5, z: 5.5 });
    for (const change of [{ generation: workerOf(replay).generation + 1 }, { version: 2 }, { resource: 'food' },
      { anchor: { x: Infinity, z: 0 } }, { radius: 1000 }]) {
      const malformed = replay.checkpoint(), before = stateOf(replay);
      Object.assign(malformed.state.units[0].workIntent, change);
      assert.throws(() => replay.restore(malformed), /invalid unit work state/);
      assert.deepEqual(stateOf(replay), before);
    }
    conserved(stateOf(replay), map);
  } finally { await fixture.dispose(); }
});

test('an undisclosed Wood source inside the original circle is skipped and never wakes an exhausted job', async () => {
  const map = woodJobMap('node'); map.fogOfWar = true;
  map.resourceNodes.find(node => node.id === 'next-tree').z = 13.5;
  const fixture = await createPveHeadlessFixture(map, { matchModeId: 'authored', matchModeVersion: 1 });
  const { replay } = fixture;
  try {
    await order(replay, { type: 'gather', nodeId: 'first-tree' }, /GATHER ORDER/);
    const finished = until(replay, s => s.units[0].gatherPhase === '' && s.units[0].cargo === 0
      && s.teamWood[0] > 100, 'visible area ends without seeking hidden Wood');
    assert.equal(finished.teamWood[0], 106);
    assert.equal(finished.resourceNodes.find(node => node.id === 'next-tree').stock, 6);
    assert.equal(finished.units[0].workIntent, null); conserved(finished, map);
    await order(replay, { type: 'move', x: -11.5, z: 11.5 }, /MOVE ORDER/);
    until(replay, s => s.units[0].pathIndex >= s.units[0].path.length, 'explicit discovery');
    assert.equal(stateOf(replay).resourceNodes.find(node => node.id === 'next-tree').stock, 6);
    for (let tick = 0; tick < 300; tick++) replay.step();
    assert.equal(workerOf(replay).workIntent, null);
    assert.equal(stateOf(replay).resourceNodes.find(node => node.id === 'next-tree').stock, 6);
  } finally { await fixture.dispose(); }
});
