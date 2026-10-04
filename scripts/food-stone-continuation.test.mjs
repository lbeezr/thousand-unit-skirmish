import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createPveHeadlessFixture, assertRecoveredWorkerObservation } from './pve-headless-fixture.mjs';
import { foodStoneJobMap, auditWorkerId, resourceBank, typedDraw, resourceJobObservation } from './food-stone-job-fixture.mjs';
import { createGatherWorkIntent } from '../src/work-intent.mjs';
import { isShoreFish } from '../src/shore-fishing.mjs';

const stateOf = replay => replay.checkpoint().state;
const workerOf = (replay, team) => stateOf(replay).units.find(unit => unit.id === auditWorkerId(team));
function until(replay, predicate, label, limit = 2400) {
  for (let tick = 0; tick < limit; tick++) { if (predicate(stateOf(replay))) return stateOf(replay); replay.step(); }
  assert.fail(`Timed out: ${label}; ${JSON.stringify(stateOf(replay).units.filter(u => u.kind === 'worker'))}`);
}

// Command-boundary topology fixture: production assignGather body with an
// explicitly disconnected graph, not mutation of a live match/checkpoint.
for (const resource of ['food', 'stone']) for (const disconnected of ['target', 'worker']) {
  test(`${resource} disconnected ${disconnected}: rejected Gather retains the current Wood intent and typed cargo`, () => {
    const source = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
    const start = source.indexOf('function assignGather('), end = source.indexOf('\nfunction ', start + 1);
    assert.ok(start > 0 && end > start);
    const unit = { id: 0, team: 0, kind: 'worker', hp: 50, generation: 2,
      x: 1, z: 0, cargo: .5, cargoType: 'wood', gatherNodeId: 'active-wood',
      gatherForestCell: -1, gatherPhase: 'gathering', orderRevision: 5,
      workIntent: createGatherWorkIntent(2, { x: 1, z: 0 }) };
    const node = { id: 'candidate', type: resource, x: 2, z: 0, stock: 6 }, notices = [];
    const before = structuredClone({ unit, node });
    const context = vm.createContext({ isShoreFish, commandUnits: () => [unit], harvestNodeById: () => node,
      unitHasCapability: () => true, spawnByTeam: [{ x: 0, z: 0 }, { x: 0, z: 0 }],
      worldToCell: x => x, nearestOpenCell: cell => cell,
      walkableComponents: disconnected === 'target' ? [0, 0, 1] : [0, 1, 0],
      sendOrderNotice: (_, __, message) => notices.push(message) });
    vm.runInContext(source.slice(start, end), context);
    context.assignGather({ team: 0 }, { type: 'gather', ids: [0], nodeId: node.id });
    assert.match(notices.at(-1), disconnected === 'target' ? /RESOURCE NODE UNREACHABLE/ : /NO REACHABLE WORKERS/);
    assert.deepEqual({ unit, node }, before);
  });
}
async function order(replay, team, command, expected) {
  const notices = await replay.order(team, { ids: [auditWorkerId(team)], ...command }); replay.drain();
  assert.ok(notices.some(notice => expected.test(notice.message)), JSON.stringify(notices));
}
function conserved(state, map) {
  for (const resource of ['food', 'wood', ...(map.economyProfileId ? ['stone'] : [])]) {
    const cargo = state.units.filter(u => u.cargoType === resource).reduce((sum, u) => sum + u.cargo, 0);
    const banked = [0, 1].reduce((sum, team) => sum + resourceBank(state, resource, team) - (map.startingResources[resource] ?? 0), 0);
    assert.ok(Math.abs(typedDraw(state, map, resource) - banked - cargo) < 1e-4, `${resource}: drawn = bank + typed cargo`);
  }
}

for (const resource of ['food', 'stone']) for (const team of [0, 1]) {
  test(`seat ${team} ${resource}: current source-only job delivers once after cold restore; nearby same/other sources stay untouched`, async () => {
    const map = foodStoneJobMap(resource), fixture = await createPveHeadlessFixture(map, { matchModeId: 'authored', matchModeVersion: 1 });
    const { replay } = fixture;
    try {
      await order(replay, team, { type: 'gather', nodeId: `seat-${team}-first` }, /GATHER ORDER/);
      until(replay, state => state.units[auditWorkerId(team)].cargo > .5, 'real initial draw');
      assert.equal(workerOf(replay, team).workIntent, null, 'automatic durable area policy remains Wood-only');
      const saved = replay.checkpoint(), views = [replay.observe(0), replay.observe(1)];
      replay.restore(saved);
      for (const seat of [0, 1]) assertRecoveredWorkerObservation(replay.observe(seat), views[seat]);
      assert.equal(workerOf(replay, team).gatherNodeId, `seat-${team}-first`);
      const finished = until(replay, state => state.units[auditWorkerId(team)].cargo === 0
        && state.units[auditWorkerId(team)].gatherPhase === '', 'finite source delivers and ends');
      assert.deepEqual(resourceJobObservation(finished, resource, team), { team,
        bank: (map.startingResources[resource] ?? 0) + 6, cargo: 0, cargoType: null,
        gatherNodeId: null, phase: '', workIntent: null, nextStock: 6 });
      for (const node of finished.resourceNodes.filter(node => node.id !== `seat-${team}-first`)) assert.equal(node.stock, 6);
      const revision = workerOf(replay, team).orderRevision;
      for (let tick = 0; tick < 300; tick++) replay.step();
      assert.equal(workerOf(replay, team).orderRevision, revision, 'idle job has no failed retry loop');
      conserved(stateOf(replay), map);
    } finally { await fixture.dispose(); }
  });

  test(`seat ${team} ${resource}: manual same/other-type replacement, Stop/Move/Return and rejected orders preserve exact typed cargo`, async () => {
    const map = foodStoneJobMap(resource), fixture = await createPveHeadlessFixture(map, { matchModeId: 'authored', matchModeVersion: 1 });
    const { replay } = fixture;
    try {
      await order(replay, team, { type: 'gather', nodeId: `seat-${team}-first` }, /GATHER ORDER/);
      until(replay, state => state.units[auditWorkerId(team)].cargo > .5, 'first fractional cargo');
      for (const command of [{ type: 'gather', nodeId: 'missing' }, { type: 'move', x: 'invalid', z: 0 },
        { type: 'gather', nodeId: `seat-${team}-next`, unitGenerations: [workerOf(replay, team).generation + 1] },
        { type: 'gather', nodeId: `seat-${team}-next`, ids: [auditWorkerId(1 - team)] }]) {
        const before = stateOf(replay);
        await order(replay, team, command, /REJECTED|NO REACHABLE WORKERS/);
        assert.deepEqual(stateOf(replay), before, 'rejected order preserves complete authority');
      }
      await order(replay, team, { type: 'gather', nodeId: `seat-${team}-next` }, /GATHER ORDER/);
      assert.equal(workerOf(replay, team).cargoType, resource);
      assert.equal(workerOf(replay, team).gatherNodeId, `seat-${team}-next`);
      until(replay, state => state.resourceNodes.find(node => node.id === `seat-${team}-next`).stock < 5.5, 'manual successor draws');
      await order(replay, team, { type: 'stop' }, /STOP ORDER/);
      const stopped = stateOf(replay);
      for (let tick = 0; tick < 100; tick++) replay.step();
      assert.equal(workerOf(replay, team).cargo, stopped.units[auditWorkerId(team)].cargo);
      assert.deepEqual(stateOf(replay).resourceNodes, stopped.resourceNodes);
      await order(replay, team, { type: 'move', x: (team ? 1 : -1) * 14.5, z: -5.5 }, /MOVE ORDER/);
      assert.equal(workerOf(replay, team).cargoType, resource);
      await order(replay, team, { type: 'returnCargo' }, /RETURN CARGO ORDER/);
      until(replay, state => state.units[auditWorkerId(team)].cargo === 0, 'manual return delivers once');
      assert.equal(workerOf(replay, team).gatherNodeId, null);
      conserved(stateOf(replay), map);
      await order(replay, team, { type: 'gather', nodeId: `seat-${team}-first` }, /GATHER ORDER/);
      until(replay, state => state.units[auditWorkerId(team)].cargo > .5, 'cargo before incompatible replacement');
      await order(replay, team, { type: 'gather', nodeId: `seat-${team}-other` }, /GATHER ORDER/);
      assert.equal(workerOf(replay, team).gatherPhase, 'to-base');
      assert.equal(workerOf(replay, team).cargoType, resource);
      assert.equal(workerOf(replay, team).gatherNodeId, `seat-${team}-other`, 'accepted manual replacement remains the execution target');
      until(replay, state => state.units[auditWorkerId(team)].cargo === 0 && state.units[auditWorkerId(team)].gatherPhase === '', 'other source and typed delivery finish');
      conserved(stateOf(replay), map);
      assert.equal(stateOf(replay).resourceNodes.find(node => node.id === `seat-${team}-far`).stock, 6);
    } finally { await fixture.dispose(); }
  });
}
