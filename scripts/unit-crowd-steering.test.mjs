import assert from 'node:assert/strict';
import test from 'node:test';
import { canTraverseCrowdBodySegment, ordinaryCrowdBodyRadius, selectCrowdStep,
  CROWD_NEIGHBOR_LIMIT } from '../src/unit-crowd-steering.mjs';
import { LAND_CLEARANCE_PROFILE } from '../src/unit-movement.mjs';

const actor = (extra = {}) => ({ id: 1, generation: 17, orderRevision: 8, kind: 'infantry',
  x: 0, z: .5, hp: 100, path: [1], pathIndex: 0, moveGoalCell: 1, ...extra });

test('ordinary crowd eligibility preserves stopped, idle, pending, dead and other caller policies', () => {
  assert.equal(ordinaryCrowdBodyRadius(actor()), .22);
  for (const extra of [{ holdingPosition: true }, { pathIndex: 1 }, { hp: 0 },
    { movementDomain: 'water' }, { moveGoalCell: -1 }, { attackMove: true }, { persistentOrder: {} },
    { stanceReturning: true }, { stanceCombat: true }, { attackTargetId: 0 },
    { attackBuildingTargetId: 0 }, { gatherNodeId: 0 }, { gatherForestCell: 0 },
    { gatherPhase: 'to-base' }, { buildingTargetId: 0 }])
    assert.equal(ordinaryCrowdBodyRadius(actor(extra)), 0, JSON.stringify(extra));
});

test('body sweeps reject tunneling between clear endpoints and retain exact tangency', () => {
  const neighbor = actor({ x: .3, z: .5 });
  assert.equal(canTraverseCrowdBodySegment({ x: 0, z: .5 }, { x: .2, z: .5 }, .22, [neighbor]), false);
  const tangent = { kind: 'infantry', x: .1, z: .94 };
  assert.equal(canTraverseCrowdBodySegment({ x: 0, z: .5 }, { x: .2, z: .5 }, .22, [tangent]), true);
  assert.equal(canTraverseCrowdBodySegment({ x: 0, z: .5 }, { x: .2, z: .5 }, .22,
    [{ ...tangent, z: .94 - 1e-6 }]), false);
});

test('inherited overlap only escapes monotonically without entering a second body', () => {
  const u = actor(), neighbor = actor({ x: .2 });
  const escape = { x: -.1, z: .5 };
  assert.equal(canTraverseCrowdBodySegment(u, escape, .22, [neighbor]), false);
  assert.equal(canTraverseCrowdBodySegment(u, escape, .22, [neighbor], { allowEscape: true }), true);
  assert.equal(canTraverseCrowdBodySegment(u, { x: .1, z: .5 }, .22, [neighbor], { allowEscape: true }), false);
  assert.equal(canTraverseCrowdBodySegment(u, escape, .22, [neighbor, actor({ x: -.5 })], { allowEscape: true }), false);
});

test('bounded overflow and unknown physical bodies fail closed; no neighbour is silently skipped', () => {
  const from = actor(), to = { x: .1, z: .5 };
  const neighbors = Array.from({ length: CROWD_NEIGHBOR_LIMIT + 1 }, () => actor({ x: 20 }));
  assert.equal(canTraverseCrowdBodySegment(from, to, .22, neighbors), false);
  assert.equal(canTraverseCrowdBodySegment(from, to, .22, [{ kind: 'unknown', x: 20, z: .5 }]), false);
  assert.equal(selectCrowdStep({ unit: from, target: to, stepDistance: .1, neighbors, canTraverse: () => true }).waitingForCrowd, true);
});

test('clear final point stays exact while a blocked terminal cannot snap through a body', () => {
  const u = actor(), target = { x: .05, z: .5 };
  assert.deepEqual(selectCrowdStep({ unit: u, target, stepDistance: .1, neighbors: [], canTraverse: () => true }),
    { target, reachedWaypoint: true, stepDistance: .05 });
  const blocked = selectCrowdStep({ unit: u, target, stepDistance: .1,
    neighbors: [actor({ x: .48 })], canTraverse: () => true });
  assert.equal(blocked.reachedWaypoint, undefined);
});

function corridor(kinds, reverse = false) {
  const units = kinds.map((kind, i) => actor({ id: i, kind, x: i ? 2 : -2,
    target: { x: i ? -2 : 2, z: .5 } }));
  const trace = [], arrived = new Map(), waits = new Map(units.map(u => [u.id, 0]));
  for (let tick = 1; tick <= 120; tick++) {
    for (const u of reverse ? units.toReversed() : units) {
      if (u.pathIndex) continue;
      const radius = LAND_CLEARANCE_PROFILE.radiusByKind[u.kind];
      const neighbors = units.filter(v => v !== u);
      const move = selectCrowdStep({ unit: u, target: u.target, stepDistance: .09, neighbors,
        cellCenter: { x: Math.floor(u.x) + .5, z: .5 },
        canTraverse: p => p.z >= radius - 1e-9 && p.z <= 1 - radius + 1e-9 });
      assert.ok(move);
      if (move.waitingForCrowd) { waits.set(u.id, waits.get(u.id) + 1); continue; }
      const to = move.reachedWaypoint ? move.target
        : { x: u.x + move.x * move.stepDistance, z: u.z + move.z * move.stepDistance };
      assert.ok(canTraverseCrowdBodySegment(u, to, radius, neighbors));
      assert.ok(Math.hypot(to.x - u.x, to.z - u.z) <= .09 + 1e-9);
      u.x = to.x; u.z = to.z;
      if (move.reachedWaypoint) { u.pathIndex++; arrived.set(u.id, tick); }
    }
    trace.push(units.map(u => [u.id, u.x, u.z, u.pathIndex]));
    if (units.every(u => u.pathIndex)) break;
  }
  assert.equal(arrived.size, units.length, 'finite deadline retains a stalled mixed pair');
  assert.ok(Math.max(...arrived.values()) - Math.min(...arrived.values()) <= 5);
  assert.ok(Math.max(...waits.values()) <= 5);
  return { trace, arrivals: [...arrived], waits: [...waits] };
}
for (const kinds of [['infantry', 'infantry'], ['scout', 'infantry'], ['infantry', 'scout']])
  for (const reverse of [false, true]) test(`${kinds.join('/')}, serial reverse=${reverse}: physical throat repeats with bounded progress`, () => {
    assert.deepEqual(corridor(kinds, reverse), corridor(kinds, reverse));
  });

test('a parked blocker is never mutated and an impassable local segment waits without an order change', () => {
  const u = actor(), other = actor({ x: .5, pathIndex: 1, holdingPosition: true });
  const before = structuredClone([u, other]);
  const move = selectCrowdStep({ unit: u, target: { x: 2, z: .5 }, stepDistance: .1,
    neighbors: [other], canTraverse: () => false });
  assert.equal(move.waitingForCrowd, true);
  assert.deepEqual([u, other], before);
});

for (const reverse of [false, true]) test(`opposed two-actor columns avoid initial gridlock, serial reverse=${reverse}`, () => {
  const units = [-2, -2.5, 2, 2.5].map((x, id) => actor({ id, x,
    target: { x: [3.5, 3, -3.5, -3][id], z: .5 } }));
  const initial = structuredClone(units);
  let maximumWait = 0;
  const waits = new Map(units.map(u => [u.id, 0]));
  for (let tick = 1; tick <= 180; tick++) {
    for (const u of reverse ? units.toReversed() : units) {
      if (u.pathIndex) continue;
      const others = units.filter(v => v !== u);
      const move = selectCrowdStep({ unit: u, target: u.target, stepDistance: .09, neighbors: others,
        cellCenter: { x: Math.floor(u.x) + .5, z: .5 }, canTraverse: p => p.z >= .22 - 1e-9 && p.z <= .78 + 1e-9 });
      if (move.waitingForCrowd) { waits.set(u.id, waits.get(u.id) + 1); continue; }
      maximumWait = Math.max(maximumWait, waits.get(u.id)); waits.set(u.id, 0);
      const to = move.reachedWaypoint ? move.target : { x: u.x + move.x * move.stepDistance, z: u.z + move.z * move.stepDistance };
      assert.ok(canTraverseCrowdBodySegment(u, to, .22, others));
      u.x = to.x; u.z = to.z;
      if (move.reachedWaypoint) u.pathIndex++;
    }
    if (units.every(u => u.pathIndex)) break;
  }
  assert.ok(units.every(u => u.pathIndex === 1), JSON.stringify(units));
  assert.ok(maximumWait < 30, `finite group no-progress window: ${maximumWait}`);
  assert.deepEqual(units.map(u => [u.id, u.generation, u.orderRevision, u.target]),
    initial.map(u => [u.id, u.generation, u.orderRevision, u.target]));
});
