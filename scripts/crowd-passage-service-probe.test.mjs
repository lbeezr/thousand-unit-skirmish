import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createFiniteRoomProbe } from './crowd-passage-service-probe.mjs';
import { comparePassageWitness } from './crowd-passage-service-diagnostic.mjs';
const hash = v => createHash('sha256').update(JSON.stringify(v)).digest('hex');
function world({ count = 4, order = [0, 1, 2, 3] } = {}) {
  const width = 16, height = 16, point = c => ({ x: c % width - 7.5, z: Math.floor(c / width) - 7.5 });
  const cell = (x, z) => Math.floor(z + 8) * width + Math.floor(x + 8);
  const units = Array.from({ length: count }, (_, id) => ({ id, generation: 2, orderRevision: 3,
    kind: 'infantry', hp: 100, team: 0, x: -6.5 + id * 3, z: -4.5,
    path: [cell(-6.5 + id * 3, 6.5)], pathIndex: 0, moveGoalCell: cell(-6.5 + id * 3, 6.5),
    moveGoalPoint: null, queuedWaypoints: [], gatherNodeId: null, buildingTargetId: null }));
  const origins = units.map(u => ({ id: u.id, x: u.x, z: u.z, raw: point(u.path[0]),
    generation: 2, orderRevision: 3, pathIndex: 0, goal: u.moveGoalCell, goalPoint: null,
    queue: [], pathLength: 1, pathSha256: hash(u.path) }));
  const probe = createFiniteRoomProbe({ mode: 'passage', startTick: 1,
    origins: order.filter(id => id < 4 && id < count).map(id => origins[id]), serviceOrigins: origins });
  const map = { width, height, point, cell, levels: new Int8Array(width * height), isWalkable: () => true };
  const query = () => ({ visits: 0, overflow: false, neighbors: [] });
  const ctx = (id, tick) => ({ unit: units[id], units, tick, remainingStep: .08,
    navigationRevision: 1, epoch: 1, query: query(), queryFor: query, map, hasGrant: false,
    normal: { x: 0, z: 1, stepDistance: .08, target: point(units[id].path[0]) } });
  function tick(number, { moveIds = units.map(u => u.id), changeCtx = () => {}, receipt = true } = {}) {
    const steps = [];
    for (const u of units) {
      const c = ctx(u.id, number); changeCtx(c);
      const before = structuredClone(units), v = probe.select(c);
      assert.equal(v, c.normal, 'no motion, priority or hold override'); assert.deepEqual(units, before);
      if (moveIds.includes(u.id)) {
        const from = { x: u.x, z: u.z }; u.z += .08;
        if (receipt) steps.push({ id: u.id, generation: u.generation, revision: u.orderRevision,
          navigationRevision: 1, tick: number, from, to: { x: u.x, z: u.z } });
      }
    }
    probe.observeExecuted({ units, steps, tick: number, navigationRevision: 1, epoch: 1 });
  }
  return { units, origins, probe, ctx, tick };
}
test('fresh covered passage serves two recipients only through actual own-call receipts', () => {
  const { probe, tick } = world(); for (let t = 1; t <= 5; t++) tick(t);
  assert.equal(probe.report.state, 'complete'); assert.deepEqual(probe.report.served, [0, 1]);
  assert.deepEqual(probe.report.events.map(e => [e.type, e.tick, e.id]), [
    ['admit', 2, 0], ['service-own-call', 2, 0], ['executed-service', 3, 0],
    ['handoff-selection', 4, 1], ['service-own-call', 4, 1], ['executed-service', 5, 1], ['complete', 5, undefined] ]);
  assert.equal(probe.report.stats.admissionAttempts, 1); assert.equal(probe.report.stats.handoffs, 1);
  assert.equal(probe.report.stats.queries, 28); // 4/tick + 4 at each of two selected calls
});
test('recipient ranking and census are deterministic under origin-array permutations', () => {
  const a = world(), b = world({ order: [3, 1, 0, 2] });
  for (let t = 1; t <= 5; t++) { a.tick(t); b.tick(t); }
  assert.deepEqual(a.probe.report, b.probe.report);
});
test('uncovered first boundary refuses before service; later census is no retry', () => {
  const { units, probe, tick } = world({ count: 5 });
  const extra = units[4]; extra.x = -5.5;
  for (let t = 1; t <= 6; t++) tick(t, { changeCtx: c => {
    c.query = { visits: 1, overflow: false, neighbors: [extra] };
    c.queryFor = () => ({ visits: 1, overflow: false, neighbors: [extra] });
  } });
  assert.equal(probe.report.state, 'aborted'); assert.equal(probe.report.stats.admissionAttempts, 1);
  assert.equal(probe.report.census.length, 6); assert.deepEqual(probe.report.events[0].uncovered, [4]);
  assert.equal(probe.report.events.some(e => e.type === 'admit'), false);
});
test('query overflow never counts as a covered boundary', () => {
  for (const mutate of [q => { q.overflow = true; }, q => { q.visits = 129; }]) {
    const { probe, tick } = world();
    for (let t = 1; t <= 2; t++) tick(t, { changeCtx: c => mutate(c.query) });
    assert.equal(probe.report.state, 'aborted'); assert.ok(probe.report.census.every(c => !c.covered));
  }
});
test('missing first captain call terminates the armed witness at the finite receipt deadline', () => {
  const { units, probe } = world();
  for (let t = 1; t <= 5; t++) probe.observeExecuted({ units, steps: [], tick: t, navigationRevision: 1, epoch: 1 });
  assert.equal(probe.report.state, 'aborted'); assert.deepEqual(probe.report.events,
    [{ type: 'abort', tick: 2, reason: 'first-own-call-missing' }]);
  assert.equal(probe.report.stats.admissionAttempts, 0);
});
test('Stop, exact endpoint, actor reference and in-place path changes refuse admission', () => {
  for (const mutate of [w => { w.units[1].holdingPosition = true; },
    w => { w.units[1].moveGoalPoint = { x: 0, z: 0 }; },
    w => { w.units[1] = structuredClone(w.units[1]); },
    w => { w.units[1].path[0]--; }]) {
    const w = world(); w.tick(1); mutate(w); w.tick(2);
    assert.equal(w.probe.report.state, 'aborted'); assert.equal(w.probe.report.events.some(e => e.type === 'admit'), false);
  }
});
test('a safe proposal without matched executed receipts cannot earn service', () => {
  const { probe, tick } = world(); tick(1); tick(2, { receipt: false });
  assert.equal(probe.report.state, 'aborted'); assert.equal(probe.report.events.some(e => e.type === 'executed-service'), false);
  assert.ok(probe.report.ledger.actors.every(a => !a.valid));
});
test('every affected actor is guarded, including one outside all cohort queries', () => {
  const { units, probe, tick } = world({ count: 5 }); tick(1); tick(2);
  units[4].moveGoalPoint = { x: 7.5, z: 5.5 }; tick(3);
  assert.equal(probe.report.state, 'aborted'); assert.deepEqual(probe.report.events.at(-1).invalid, [4]);
});
test('regression beyond episode acceptance bound cancels service without teleport or undo', () => {
  const w = world(); w.tick(1); w.tick(2, { moveIds: [] });
  const u = w.units[3], from = { x: u.x, z: u.z }; u.z -= .16;
  w.probe.observeExecuted({ units: w.units, tick: 3, navigationRevision: 1, epoch: 1,
    steps: [{ id: u.id, generation: 2, revision: 3, tick: 3, navigationRevision: 1,
      from, to: { x: u.x, z: u.z } }] });
  assert.equal(w.probe.report.state, 'aborted'); assert.deepEqual(w.probe.report.events.at(-1).loss, [3]);
  assert.equal(u.z, from.z - .16); assert.equal(w.probe.report.served.length, 0);
});
test('an unserved window expires finitely and does not renew', () => {
  const { probe, tick } = world(); for (let t = 1; t <= 30; t++) tick(t, { moveIds: [] });
  assert.equal(probe.report.state, 'aborted'); assert.equal(probe.report.events.at(-1).tick, 13);
  assert.equal(probe.report.stats.admissionAttempts, 1); assert.equal(probe.report.stats.handoffs, 0);
});
test('a changed boundary between completed service and handoff cancels rather than reserves room', () => {
  const { units, probe, tick } = world(); tick(1); tick(2); tick(3);
  assert.equal(probe.report.state, 'handoff'); units[2].holdingPosition = true; tick(4);
  assert.equal(probe.report.state, 'aborted'); assert.deepEqual(probe.report.served, [0]);
  assert.equal(probe.report.events.some(e => e.type === 'handoff-selection'), false);
});
test('one recipient service does not hand off while another cohort actor has no executed service', () => {
  const { probe, tick } = world();
  tick(1); for (let t = 2; t <= 15; t++) tick(t, { moveIds: [0, 1, 3] });
  assert.equal(probe.report.state, 'aborted'); assert.deepEqual(probe.report.served, [0]);
  assert.equal(probe.report.stats.handoffs, 0);
  assert.equal(probe.report.events.some(e => e.type === 'handoff-selection'), false);
});
test('handoff selection spends no preview budget and must pass the selected serial own call', () => {
  const { units, probe, tick } = world({ count: 5 }); tick(1); tick(2); tick(3);
  tick(4, { changeCtx: c => { if (c.unit.id === 1) {
    c.query = { visits: 1, overflow: false, neighbors: [units[4]] };
  } } });
  assert.equal(probe.report.state, 'aborted'); assert.equal(probe.report.stats.handoffSelections, 1);
  assert.equal(probe.report.stats.handoffs, 0); assert.deepEqual(probe.report.served, [0]);
  assert.equal(probe.report.events.filter(e => e.type === 'service-own-call').length, 1);
});
test('whole-set comparison rejects local service and baseline equality as recovery', () => {
  const actors = [0, 1, 2].map(id => ({ id, rawProgress: id === 2 ? 0 : .3,
    generation: 2, revision: 3, pathIndex: 0, pathSha256: 'a', goal: 1, queue: [] }));
  const baseline = { ticks: 48, inputSha256: 'x', traceSha256: 'y', affectedIds: [0, 1],
    frontierIds: [0, 1], initialActors: actors.map(a => ({ ...a, orderRevision: 3 })),
    samples: [{ tick: 24, actors: actors.map(a => ({ ...a, rawProgress: 0 })) }, { tick: 48, actors }] };
  const candidate = { ...baseline, mode: 'passage', probe: { state: 'complete', events: [{ type: 'admit' }],
    ledger: { actors: actors.map(a => ({ id: a.id, valid: true })) } } };
  const c = comparePassageWitness(baseline, candidate, [2]);
  assert.equal(c.affectedCount, 3); assert.equal(c.completeServiceWitness, true);
  assert.equal(c.zeroInterventionBaselineRepeat, true); assert.equal(c.qualified, false);
  assert.deepEqual(c.stalled.map(a => a.id), [2]); assert.deepEqual(c.retainedControls.map(a => a.id), [2]);
});
test('post-completion endpoint, reference and receipt/phase changes invalidate final qualification', () => {
  for (const mutate of ['endpoint', 'reference', 'receipt', 'phase', 'late-debt']) {
    const w = world({ count: 2 }); for (let t = 1; t <= 5; t++) w.tick(t);
    assert.equal(w.probe.report.state, 'complete');
    if (mutate === 'endpoint') { w.units[0].moveGoalPoint = { x: 0, z: 0 }; w.tick(6); }
    if (mutate === 'reference') { w.units[0] = structuredClone(w.units[0]); w.tick(6); }
    if (mutate === 'receipt' || mutate === 'phase') w.probe.observeExecuted({ units: w.units, steps: [],
      tick: mutate === 'receipt' ? 5 : 6, navigationRevision: mutate === 'phase' ? 2 : 1, epoch: 1 });
    if (mutate === 'late-debt') for (let t = 6; t <= 20; t++) w.tick(t, { moveIds: [] });
    const actors = w.units.map(u => ({ id: u.id, rawProgress: .4, generation: 2, revision: 3,
      pathIndex: 0, pathSha256: 'a', goal: 1, queue: [] }));
    const baseline = { ticks: 48, inputSha256: 'x', traceSha256: 'y', frontierIds: [0, 1], affectedIds: [0, 1],
      initialActors: actors.map(a => ({ ...a, orderRevision: 3 })),
      samples: [{ tick: 24, actors: actors.map(a => ({ ...a, rawProgress: 0 })) }, { tick: 48, actors }] };
    const c = comparePassageWitness(baseline, { ...baseline, mode: 'passage', probe: w.probe.report }, []);
    assert.equal(c.completeServiceWitness, true, 'historical service remains observed');
    assert.equal(c.allReceiptsValid, mutate === 'late-debt'); assert.equal(c.qualified, false);
    if (mutate === 'late-debt') assert.equal(c.serviceBoundsRetained, false);
  }
});
