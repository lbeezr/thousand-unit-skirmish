import test from 'node:test';
import assert from 'node:assert/strict';
import { corridorInfluence, rootEnvelope, queryReach, inputDependencyClosure,
  physicalBoundaryDecision, regionCandidates } from './crowd-influence-boundary.mjs';
import { createHash } from 'node:crypto';
import { createFiniteRoomProbe } from './crowd-influence-boundary-probe.mjs';
import { selectCrowdStep } from '../src/unit-crowd-steering.mjs';
import { canTraverseStaticBodySegment, LAND_CLEARANCE_PROFILE } from '../src/unit-movement.mjs';
import { UNIT_DEFINITIONS } from '../src/gameplay-definitions.mjs';
const body = (id, x, z, speed = 2.6, radius = .22) => ({ id, x, z, speed, radius });
const owner = body(0, 0, 0), registry = Object.entries(LAND_CLEARANCE_PROFILE.radiusByKind)
  .map(([kind, radius]) => ({ radius, speed: UNIT_DEFINITIONS[kind].combat.moveSpeed }));
test('finite reach distinguishes touching, frozen guards, short prefixes and delayed owner motion', () => {
  const bodies = [body(1, .7, .2), body(2, .5, 1), body(3, .5, 1, 0), body(4, .5, 1.481)];
  const short = corridorInfluence(owner, bodies, { ticks: 1 });
  assert.equal(short.end.x, 2.6 / 30); assert.equal(short.members.length, 0);
  const full = corridorInfluence(owner, bodies, { ticks: 12 });
  assert.deepEqual(full.members.map(b => b.id), [1, 2]);
  assert.equal(full.end.x, .75); assert.ok(full.members.every(b => b.reach >= .44));
  assert.equal(corridorInfluence(owner, [body(5, .5, 1.48)], { ticks: 12 }).members.length, 1);
  assert.equal(corridorInfluence(owner, [body(6, .75, .5)], { ticks: 1 }).members.length, 0,
    'future corridor end is unspendable before owner can reach it');
});
test('delayed owner inclusion uses full horizon even when nominal early trace misses a body', () => {
  const p = body(1, -.8, 0);
  const result = corridorInfluence(owner, [p], { ticks: 12 });
  assert.equal(result.members.length, 1); assert.equal(result.members[0].earliestNominalTick, null);
});
test('generic query bounds exceed2.1 at9/12 without assuming absent fast bodies', () => {
  assert.ok(Math.abs(queryReach(owner, registry, 6) - 1.92) < 1e-12);
  assert.ok(Math.abs(queryReach(owner, registry, 9) - 2.6) < 1e-12);
  assert.ok(Math.abs(queryReach(owner, registry, 12) - 3.05) < 1e-12);
  assert.ok(Math.abs(queryReach(owner, [owner], 12) - 2.23) < 1e-12);
});
test('query completeness cannot be inferred from observed included membership or2.25 collection', () => {
  const influence = { members: [] }, closure = { ids: [0] }, base = { owner, peers: registry, ticks: 12,
    influence, closure, cohortIds: [0], query: { visits: 1, overflow: false, neighbors: [], coveredRadius: 2.1 } };
  assert.deepEqual(physicalBoundaryDecision(base).reasons, ['horizon-outside-certified-query']);
  assert.equal(physicalBoundaryDecision({ ...base, query: { ...base.query, coveredRadius: 2.25 } }).status, 'refuse');
  assert.equal(physicalBoundaryDecision({ ...base, ticks: 1 }).status, 'candidate-witness-only');
  assert.equal(physicalBoundaryDecision({ ...base, ticks: 1, query: { ...base.query, overflow: true } }).status, 'refuse');
});
test('current and possible future dependency closure is bounded and deterministic', () => {
  const bodies = [body(0, 0, 0), body(1, 2, 0), body(2, 4, 0), body(3, 6.4, 0)];
  assert.deepEqual(inputDependencyClosure(bodies, [0]).ids, [0, 1, 2]);
  assert.deepEqual(inputDependencyClosure(bodies, [0], 1).ids, [0, 1, 2]);
  assert.deepEqual(inputDependencyClosure(bodies, [0], 3).ids, [0, 1, 2, 3]);
  assert.deepEqual(inputDependencyClosure([...bodies].reverse(), [0], 3).ids, [0, 1, 2, 3]);
  assert.equal(inputDependencyClosure(bodies, [0]).stats.pairDistances, 6);
  assert.throws(() => inputDependencyClosure(Array.from({ length: 65 }, (_, id) => body(id, id, 0)), [0]));
  assert.throws(() => rootEnvelope(Array.from({ length: 5 }, (_, id) => body(id, id, 0)), [], 1));
});
test('physical root envelope stays separate from the intervention membership', () => {
  const roots = [body(0, 0, 0), body(1, 4, 0)], all = [...roots, body(2, .5, 0), body(3, 2, 0)];
  assert.deepEqual(rootEnvelope(roots, all, 1).ids, [2]);
  assert.deepEqual(rootEnvelope(roots, all, 12).ids, [2, 3]);
});
test('a body outside even12-tick fixed physical reach can immediately change ordinary lane arbitration', () => {
  const choose = withPeer => {
    const u = { id: 0, generation: 1, orderRevision: 1, kind: 'infantry', hp: 100, x: 0, z: 0,
      path: [1], pathIndex: 0, moveGoalCell: 1 };
    const peer = { ...u, id: 1, z: 1.95, target: { x: -3, z: 1.95 } };
    return selectCrowdStep({ unit: u, tick: 1, target: { x: 3, z: 0 }, cellCenter: { x: .5, z: .5 },
      stepDistance: 2.6 / 30, neighbors: withPeer ? [peer] : [], canTraverse: () => true });
  };
  assert.equal(corridorInfluence(owner, [body(1, 0, 1.95)], { ticks: 12 }).members.length, 0);
  const without = choose(false), withPeer = choose(true);
  assert.notDeepEqual([without.x, without.z], [withPeer.x, withPeer.z]);
  assert.equal(without.z, 0); assert.ok(withPeer.z > 0);
  assert.ok(Math.hypot(withPeer.x * withPeer.stepDistance, withPeer.z * withPeer.stepDistance - 1.95) >= .44,
    'executed candidate remains physically clear of the distant peer');
});
test('bounded coarse current index accounts for collection work and fails on body/visit overflow', () => {
  const region = { minX: 0, maxX: 1, minZ: 0, maxZ: 1 };
  const a = regionCandidates([body(1, .5, .5), body(2, 5, 5)], region, 2.08,
    { offset: { x: 48, z: 32 }, padding: .15 });
  assert.equal(a.indexBuildVisits, 2); assert.deepEqual(a.neighbors.map(b => b.id), [1]);
  assert.equal(a.overflow, false); assert.ok(a.bucketHeads <= 36);
  const dense = regionCandidates(Array.from({ length: 65 }, (_, id) => body(id, .5, .5)), region, 0);
  assert.equal(dense.overflow, true); assert.equal(dense.neighbors.length, 64);
  const visited = regionCandidates(Array.from({ length: 129 }, (_, id) => body(id, -1.1, -1.1)), region, 1.3);
  assert.equal(visited.overflow, true); assert.equal(visited.visits, 128);
  assert.throws(() => regionCandidates([], region, Infinity));
  assert.throws(() => regionCandidates([], region, 3));
  assert.throws(() => regionCandidates([], { ...region, maxX: 100 }, 1));
});
test('one tile can physically fit two infantry lanes; full body transit still needs17 ticks', () => {
  const width = 8, height = 8, blocked = c => c % width === 4 && Math.floor(c / width) !== 4;
  const fromA = { x: -.22, z: .22 }, toA = { x: 1.22, z: .22 };
  const fromB = { x: -.22, z: .78 }, toB = { x: 1.22, z: .78 };
  assert.equal(canTraverseStaticBodySegment(fromA, toA, .22, width, height, c => !blocked(c)), true);
  assert.equal(canTraverseStaticBodySegment(fromB, toB, .22, width, height, c => !blocked(c)), true);
  assert.ok(Math.abs(.78 - .22 - .44 - .12) < 1e-12);
  assert.equal(Math.ceil((1 + .44) / (2.6 / 30)), 17);
  assert.deepEqual([0, 1, 2, 3].map(i => Math.ceil((1.44 + i * .44) / (2.6 / 30))), [17, 22, 27, 32]);
  assert.equal(Math.ceil((1.44 + .44) / (2.6 / 30)), 22);
});

function portalWorld() {
  const hash = v => createHash('sha256').update(JSON.stringify(v)).digest('hex');
  const units = [-.3, -5].map((x, id) => ({ id, x, z: .5, kind: 'infantry', hp: 100,
    generation: 2, orderRevision: 3, path: [1], pathIndex: 0, moveGoalCell: 1,
    moveGoalPoint: null, queuedWaypoints: [] }));
  const origins = units.map(u => ({ id: u.id, x: u.x, z: u.z, raw: { x: 5, z: .5 },
    generation: 2, orderRevision: 3, pathIndex: 0, goal: 1, goalPoint: null,
    queue: [], pathLength: 1, pathSha256: hash(u.path) }));
  const probe = createFiniteRoomProbe({ mode: 'influence', startTick: 1, origins, serviceOrigins: origins });
  function step(tick, { fromX = units[0].x, toX = fromX + .08, epoch = 1, generation = 2 } = {}) {
    const u = units[0]; u.x = toX; u.generation = generation;
    probe.observeExecuted({ tick, units, navigationRevision: 1, epoch,
      steps: [{ id: 0, generation, revision: 3, navigationRevision: 1, tick,
        from: { x: fromX, z: .5 }, to: { x: toX, z: .5 }, neighbours: [units[1]] }] });
  }
  return { probe, step };
}
test('opposite portal transit requires continuous matched executed receipts', () => {
  const w = portalWorld(); for (let tick = 1; tick <= 20; tick++) w.step(tick);
  const r = w.probe.report.influence;
  assert.deepEqual(r.fullTransits, [{ id: 0, direction: 'east', entryTick: 2, exitTick: 19, emptyAfterExit: true }]);
  assert.ok(r.crossingCandidates.every(e => e.validReceipt));
  assert.equal(w.probe.report.ledger.failed, null);
});
for (const reason of ['gap', 'duplicate', 'epoch', 'unmatched', 'generation']) {
  test(`matching portal planes cannot earn transit after ${reason} invalidates receipts`, () => {
    const w = portalWorld(); w.step(1); w.step(2);
    assert.equal(w.probe.report.influence.crossingCandidates[0].type, 'entry');
    const tick = reason === 'gap' ? 4 : reason === 'duplicate' ? 2 : 3;
    w.step(tick, { fromX: 1.2, toX: 1.3, epoch: reason === 'epoch' ? 2 : 1,
      generation: reason === 'generation' ? 3 : 2 });
    assert.equal(w.probe.report.influence.crossingCandidates.at(-1).type, 'exit');
    assert.equal(w.probe.report.influence.crossingCandidates.at(-1).validReceipt, false);
    assert.deepEqual(w.probe.report.influence.fullTransits, []);
  });
}
