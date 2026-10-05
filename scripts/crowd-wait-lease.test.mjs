import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { selectCrowdStep, crowdPassagePoint, canTraverseCrowdBodySegment,
  ordinaryCrowdBodyRadius, stationaryCrowdObstacle } from '../src/unit-crowd-steering.mjs';
import { crowdWaitLease, CROWD_LEASE_TICKS } from '../src/crowd-wait-lease.mjs';
import { canTraverseStaticBodySegment, canTraverseUnitStep } from '../src/unit-movement.mjs';
import { townCenterFootprintCells } from '../src/town-center-spawn.mjs';
import { pathingBaselineMap } from './pathing-baseline-cases.mjs';

// Reduce the already retained production failure; do not invent a new map or
// copy the diagnostic witness's hand-authored escape waypoints into policy.
const retained = JSON.parse(gunzipSync(readFileSync(new URL(
  '../docs/qa-evidence/ordinary-crowd-steering-2026-10-05/review-ring-diagnostics.json.gz', import.meta.url))));
const frozen = retained.crowdReview.find(s => s.id === 103);
const map = pathingBaselineMap({ group: 64 });
const blocked = new Set(townCenterFootprintCells(map.spawnPoints, 1, map.width, map.height));
const levels = new Uint8Array(map.width * map.height);
const cell = p => Math.floor(p.z + 32) * map.width + Math.floor(p.x + 48);
const walkable = c => c >= 0 && c < levels.length && !blocked.has(c);
const pointAllowed = p => canTraverseStaticBodySegment(p, p, .22, map.width, map.height, walkable);
const actor = source => ({ ...source, kind: 'infantry', hp: 100, generation: 1, orderRevision: 2,
  path: [1, 2, 3], pathIndex: 0, moveGoalCell: 3, queuedWaypoints: [{ destination: 4 }] });

for (const reverse of [false, true]) for (const mixedSpeed of [false, true])
  test(`retained parked cluster releases two own routes, reverse=${reverse}, mixedSpeed=${mixedSpeed}`, () => {
    const a = actor(frozen.neighbors.find(o => o.id === 94)), b = actor({ ...frozen.unit, id: 103 });
    const parked = frozen.neighbors.filter(o => o.id !== 94)
      .map(o => ({ ...o, hp: 100, path: [], pathIndex: 0, moveGoalCell: -1 }));
    const before = structuredClone(parked), revisions = [a.orderRevision, b.orderRevision];
    const paths = [a.path, b.path], queues = [structuredClone(a.queuedWaypoints), structuredClone(b.queuedWaypoints)];
    for (let tick = 0; tick < 600 && [a, b].some(u => u.pathIndex < u.path.length); tick++) {
      for (const unit of reverse ? [b, a] : [a, b]) {
        if (unit.pathIndex === unit.path.length) continue;
        const neighbors = [...parked, unit === a ? b : a].filter(o => Math.hypot(o.x - unit.x, o.z - unit.z) <= 2.1);
        const raw = { x: 28.5, z: (unit === a ? 21.5 : 20.5) - unit.pathIndex };
        const target = unit.pathIndex < unit.path.length - 1
          ? crowdPassagePoint(raw, { x: 0, z: -1 }, unit, neighbors, pointAllowed) : raw;
        const canTraverse = p => canTraverseUnitStep(cell(unit), cell(p), map.width, levels, walkable)
          && canTraverseStaticBodySegment(unit, p, .22, map.width, map.height, walkable, { allowEscape: true });
        const move = selectCrowdStep({ unit, target, progressTarget: raw, neighbors, tick,
          stepDistance: 2.6 / 30 * (mixedSpeed && unit === a ? .5 : 1), travelDirection: { x: 0, z: -1 },
          cellCenter: { x: Math.floor(unit.x) + .5, z: Math.floor(unit.z) + .5 }, pointAllowed, canTraverse,
          escapeAllowed: p => canTraverseUnitStep(cell(unit), cell(p), map.width, levels, walkable)
            && canTraverseStaticBodySegment(unit, p, .22, map.width, map.height, walkable),
          targetOf: o => o === a ? { x: -11.5, z: .5 } : o === b ? { x: -12.5, z: .5 } : null });
        if (move.waitingForCrowd) continue;
        const to = move.reachedWaypoint ? move.target
          : { x: unit.x + move.x * move.stepDistance, z: unit.z + move.z * move.stepDistance };
        assert.ok(canTraverse(to)); assert.ok(canTraverseCrowdBodySegment(unit, to, .22, neighbors));
        Object.assign(unit, to); if (move.reachedWaypoint) unit.pathIndex++;
      }
      assert.deepEqual(parked, before);
      assert.deepEqual([a.orderRevision, b.orderRevision], revisions);
      assert.equal(a.path, paths[0]); assert.equal(b.path, paths[1]);
      assert.deepEqual([a.queuedWaypoints, b.queuedWaypoints], queues);
    }
    assert.equal(a.pathIndex, a.path.length); assert.equal(b.pathIndex, b.path.length);
    assert.deepEqual([a.x, a.z, b.x, b.z], [28.5, 19.5, 28.5, 18.5]);
  });

function leaseFixture() {
  const unit = actor({ id: 1, x: 0, z: .5 }), peer = actor({ id: 2, x: .44, z: .5 });
  const worker = { kind: 'worker', hp: 100, x: 0, z: 1.5, path: [], pathIndex: 0 };
  const state = { lastProgressTick: 0, bestDistance: 3, leaseCooldown: -Infinity, lastGrantTick: -Infinity };
  const observed = { lastProgressTick: 0, bestDistance: 3, lastGrantTick: -Infinity };
  const args = { unit, state, tick: 120, neighbors: [peer, worker], radius: .22,
    radiusOf: ordinaryCrowdBodyRadius, parked: stationaryCrowdObstacle,
    readState: other => other === peer ? observed : null, admit: () => true, blockedBy: () => true,
    heading: { x: 1, z: 0 }, stepDistance: .09, target: { x: 2, z: .5 },
    stats: { arbitrationVisits: 0, leaseAge: 0 } };
  return { args, unit, peer, worker, state, observed };
}

test('leases require an obstructing peer and a genuinely stationary obstacle', () => {
  const f = leaseFixture();
  assert.equal(crowdWaitLease({ ...f.args, blockedBy: () => false }), null);
  f.worker.path = [1]; f.worker.moveGoalCell = 1;
  assert.equal(stationaryCrowdObstacle(f.worker), false);
  assert.equal(crowdWaitLease(f.args), null);
  assert.equal(f.state.lease, undefined);
});

test('lease release measures waypoint or fixed-target progress, never distance travelled', () => {
  const f = leaseFixture(); assert.ok(crowdWaitLease(f.args)?.yieldingForCrowd);
  f.peer.x = -1; // Travel without progress does not release the finite hold.
  assert.ok(crowdWaitLease({ ...f.args, tick: 121 })?.waitingForCrowd);
  f.observed.bestDistance = 2.8;
  assert.equal(crowdWaitLease({ ...f.args, tick: 122 }), null);
  assert.equal(f.state.lease, null);
});

test('a lease rejects a one-step opening without a clear retreat corridor', () => {
  const f = leaseFixture(); let corridorChecks = 0;
  assert.equal(crowdWaitLease({ ...f.args, escapeAllowed: () => { corridorChecks++; return false; } }), null);
  assert.ok(corridorChecks > 0 && corridorChecks <= 14); assert.equal(f.state.lease, undefined);
});

test('an active grant ends when its stationary activation body receives a route', () => {
  const f = leaseFixture(); crowdWaitLease(f.args);
  f.worker.path = [1];
  assert.equal(crowdWaitLease({ ...f.args, tick: 121 }), null);
  assert.equal(f.state.lease, null);
});

test('only the specific failed obstruction changing permits an unchanged pair retry', () => {
  const f = leaseFixture(); crowdWaitLease(f.args);
  const blocker = actor({ id: 3, x: -.44, z: .5 }), unrelated = actor({ id: 4, x: -1, z: 1.5 });
  f.args.neighbors.push(blocker, unrelated);
  crowdWaitLease({ ...f.args, tick: 121, admit: () => false, failedBlocker: () => blocker });
  assert.equal(f.state.failedLease.blocker, blocker);
  unrelated.x -= .2;
  assert.equal(crowdWaitLease({ ...f.args, tick: 300 }), null);
  blocker.x -= .2;
  assert.ok(crowdWaitLease({ ...f.args, tick: 301 })?.yieldingForCrowd);
});

test('a failure record does not suppress a new peer order on the same route', () => {
  const f = leaseFixture(); crowdWaitLease(f.args);
  crowdWaitLease({ ...f.args, tick: 180 });
  f.peer.orderRevision++;
  assert.ok(crowdWaitLease({ ...f.args, tick: 300 })?.yieldingForCrowd);
});

test('failed finite lease cannot renew unchanged body dependency indefinitely', () => {
  const f = leaseFixture(); crowdWaitLease(f.args);
  assert.equal(f.state.lease.until - f.state.lease.since, CROWD_LEASE_TICKS);
  assert.equal(CROWD_LEASE_TICKS, 60);
  crowdWaitLease({ ...f.args, tick: 180 });
  assert.equal(f.state.lease, null);
  assert.equal(crowdWaitLease({ ...f.args, tick: 300 }), null);
  f.observed.bestDistance -= .2;
  assert.ok(crowdWaitLease({ ...f.args, tick: 301 })?.yieldingForCrowd);
});

for (const change of ['departure', 'generation', 'revision', 'path', 'waypoint', 'ineligible', 'stale-observation'])
  test(`a live lease revalidates ${change}`, () => {
    const f = leaseFixture(); crowdWaitLease(f.args);
    const args = { ...f.args, tick: 121 };
    if (change === 'departure') args.neighbors = [f.worker];
    if (change === 'generation') f.peer.generation++;
    if (change === 'revision') f.peer.orderRevision++;
    if (change === 'path') f.peer.path = f.peer.path.slice();
    if (change === 'waypoint') f.peer.pathIndex++;
    if (change === 'ineligible') f.peer.holdingPosition = true;
    if (change === 'stale-observation') args.readState = () => null;
    assert.equal(crowdWaitLease(args), null);
    assert.equal(f.state.lease, null);
  });

for (const change of ['generation', 'revision', 'path', 'waypoint', 'navigation', 'epoch', 'rollback', 'observation-gap', 'overflow', 'Stop'])
  test(`ordinary controller discards transient grants across ${change}`, () => {
    const unit = actor({ id: 1, x: 0, z: .5 }), peer = actor({ id: 2, x: .44, z: .5 });
    const worker = { kind: 'worker', hp: 100, x: 0, z: 1.5, path: [], pathIndex: 0 };
    const move = (u, tick, extra = {}) => selectCrowdStep({ unit: u, tick, target: { x: u === unit ? 2 : -2, z: .5 },
      neighbors: [u === unit ? peer : unit, worker], stepDistance: .09, canTraverse: () => true, ...extra });
    for (let tick = 0; tick < 120; tick++) { move(peer, tick); move(unit, tick); }
    assert.ok(move(unit, 120).yieldingForCrowd);
    const extra = {}, tick = change === 'rollback' ? 1 : change === 'observation-gap' ? 125 : 121;
    if (change === 'generation') unit.generation++;
    if (change === 'revision') unit.orderRevision++;
    if (change === 'path') unit.path = unit.path.slice();
    if (change === 'waypoint') unit.pathIndex++;
    if (change === 'navigation') extra.navigationRevision = 1;
    if (change === 'epoch') extra.epoch = 1;
    if (change === 'overflow') extra.overflow = true;
    if (change === 'Stop') unit.holdingPosition = true;
    const result = move(unit, tick, extra);
    if (change === 'Stop') {
      assert.equal(result, null); unit.holdingPosition = false;
      assert.equal(move(unit, tick + 1).crowdControl.waitAge, 0);
    } else {
      assert.equal(result.crowdControl.leaseAge, 0);
      if (change !== 'observation-gap' && change !== 'overflow') assert.equal(result.crowdControl.waitAge, 0);
      if (change === 'overflow') {
        assert.ok(result.waitingForCrowd); assert.equal(result.crowdControl.proposals, 0);
        assert.equal(result.crowdControl.bodyVisits, 0);
      }
    }
  });

test('an active own retreat cannot consume a projected intermediate waypoint', () => {
  const unit = actor({ id: 1, x: 0, z: .5 }), peer = actor({ id: 2, x: .44, z: .5 });
  const worker = { kind: 'worker', hp: 100, x: 0, z: 1.5, path: [], pathIndex: 0 };
  const move = (u, tick, extra = {}) => selectCrowdStep({ unit: u, tick,
    target: { x: u === unit ? 2 : -2, z: .5 }, neighbors: [u === unit ? peer : unit, worker],
    stepDistance: .09, canTraverse: () => true, ...extra });
  for (let tick = 0; tick < 120; tick++) { move(peer, tick); move(unit, tick); }
  assert.ok(move(unit, 120).yieldingForCrowd);
  move(peer, 120); // Fresh serial observation keeps the grant valid at tick 121.
  const before = { path: unit.path, pathIndex: unit.pathIndex, queue: structuredClone(unit.queuedWaypoints) };
  const result = move(unit, 121, { target: { x: unit.x, z: unit.z }, progressTarget: { x: 2, z: .5 } });
  assert.equal(result.reachedWaypoint, undefined);
  assert.ok(result.yieldingForCrowd);
  assert.equal(unit.path, before.path); assert.equal(unit.pathIndex, before.pathIndex);
  assert.deepEqual(unit.queuedWaypoints, before.queue);
});
