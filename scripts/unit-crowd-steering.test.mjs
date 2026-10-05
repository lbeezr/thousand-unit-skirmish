import assert from 'node:assert/strict';
import test from 'node:test';
import { canTraverseCrowdBodySegment, ordinaryCrowdBodyRadius, selectCrowdStep,
  CROWD_NEIGHBOR_LIMIT, CROWD_PROPOSAL_LIMIT } from '../src/unit-crowd-steering.mjs';
import { LAND_CLEARANCE_PROFILE, segmentRectangleDistanceSquared } from '../src/unit-movement.mjs';

const actor = (extra = {}) => ({ id: 1, generation: 17, orderRevision: 8, kind: 'infantry',
  x: 0, z: .5, hp: 100, path: [1], pathIndex: 0, moveGoalCell: 1, ...extra });

test('a distant perpendicular final goal does not force a same-route front actor to retreat into its follower', () => {
  const front = actor({ id: 66, x: -.22, z: 3.057, target: { x: 18.5, z: 3.5 } });
  const rear = actor({ id: 64, x: -.22, z: 3.498, target: { x: 16.5, z: 3.5 } });
  const target = { x: -.22, z: 1.999 };
  const moveAt = tick => selectCrowdStep({ unit: front, target, progressTarget: { x: -.5, z: 1.5 },
    travelDirection: { x: 0, z: -1 }, tick, stepDistance: .043333333333333,
    directionOf: () => ({ x: 0, z: -1 }),
    neighbors: [rear], cellCenter: { x: -.5, z: 3.5 }, canTraverse: p => p.x <= -.22 + 1e-9 });
  moveAt(0);
  const move = moveAt(40);
  assert.ok(!move.waitingForCrowd && move.z < -.9 && !move.yieldingForCrowd);
  assert.ok(canTraverseCrowdBodySegment(front,
    { x: front.x + move.x * move.stepDistance, z: front.z + move.z * move.stepDistance }, .22, [rear]));
});

test('a safe oblique forward step is retained beside a wall with two same-route followers', () => {
  // This is the three-body tail of the paid-obstruction choke: the route heads
  // north before turning south toward distant formation goals. The lane score
  // favours an oblique step, but the followers have no opposing route claim.
  const front = actor({ id: 6, x: -.23, z: -.94, target: { x: 18.5, z: -3.5 } });
  const followers = [actor({ id: 5, x: -.61, z: -1.18, target: { x: 17.5, z: -3.5 } }),
    actor({ id: 4, x: -.82, z: -1.57, target: { x: 16.5, z: -3.5 } })];
  const before = structuredClone([front, ...followers]), wall = { minX: 0, maxX: 1, minZ: -32, maxZ: 0 };
  const allowed = p => Math.sqrt(segmentRectangleDistanceSquared(front, p, wall)) >= .22 - 1e-9;
  const safeForward = { x: front.x, z: front.z + .043333333333333 };
  assert.ok(allowed(safeForward));
  assert.ok(canTraverseCrowdBodySegment(front, safeForward, .22, followers));
  const moveAt = tick => selectCrowdStep({ unit: front, target: { x: front.x, z: .001 },
    progressTarget: { x: -.5, z: .5 }, travelDirection: { x: 0, z: 1 }, tick,
    stepDistance: .086666666666667, neighbors: followers, cellCenter: { x: -.5, z: -.5 },
    directionOf: other => ({ x: -.5 - other.x, z: -.5 - other.z }), canTraverse: allowed });
  moveAt(0);
  const move = moveAt(40);
  assert.ok(!move.waitingForCrowd && !move.yieldingForCrowd && move.z > 0,
    'an admitted forward step must survive follower arbitration after the stall threshold');
  assert.ok(move.z < .9, 'the witness exercises the previously discarded oblique proposal');
  const to = { x: front.x + move.x * move.stepDistance, z: front.z + move.z * move.stepDistance };
  assert.ok(allowed(to)); assert.ok(canTraverseCrowdBodySegment(front, to, .22, followers));
  assert.ok(move.crowdControl.proposals <= CROWD_PROPOSAL_LIMIT);
  assert.deepEqual([front, ...followers], before, 'selection never writes a pose or order');
});

test('oblique follower exemption is independent of neighbor order and excludes other body policies', () => {
  const run = (extra = [], changeDirection = false, reverse = false) => {
    const front = actor({ id: 6, x: -.23, z: -.94, target: { x: 18.5, z: -3.5 } });
    const followers = [actor({ id: 5, x: -.61, z: -1.18, target: { x: 17.5, z: -3.5 } }),
      actor({ id: 4, x: -.82, z: -1.57, target: { x: 16.5, z: -3.5 } }), ...extra];
    const neighbors = reverse ? followers.toReversed() : followers;
    const select = tick => selectCrowdStep({ unit: front, target: { x: front.x, z: .001 },
      progressTarget: { x: -.5, z: .5 }, travelDirection: { x: 0, z: 1 }, tick,
      stepDistance: .086666666666667, neighbors, cellCenter: { x: -.5, z: -.5 },
      directionOf: other => changeDirection && other.id === 4 ? { x: 0, z: -1 }
        : { x: -.5 - other.x, z: -.5 - other.z }, canTraverse: p => p.x <= -.22 });
    select(0); return select(40);
  };
  const { crowdControl: a, ...forward } = run();
  const { crowdControl: b, ...reordered } = run([], false, true);
  assert.deepEqual(reordered, forward);
  for (const parked of [actor({ id: 2, x: -1.7, z: -1.4, pathIndex: 1 }),
    actor({ id: 2, x: -1.7, z: -1.4, holdingPosition: true })])
    assert.ok(run([parked]).waitingForCrowd, 'parked and held bodies retain existing arbitration');
  assert.ok(run([], true).waitingForCrowd, 'one opposing route retains existing arbitration');
  assert.ok(run([actor({ id: 2, x: -1.7, z: .1 })]).waitingForCrowd,
    'a body ahead cannot be classified as a follower');
});

for (const lateral of [false, true]) test(`following bodies never exempt a selected ${lateral ? 'lateral' : 'backward'} step from yielding`, () => {
  const front = actor({ id: 6, x: -.78, z: -.94, target: { x: 18.5, z: -3.5 } });
  const followers = [actor({ id: 5, x: -1.28, z: -1.1, target: { x: 17.5, z: -3.5 } }),
    actor({ id: 4, x: -1.4, z: -1.65, target: { x: 16.5, z: -3.5 } })];
  const select = tick => selectCrowdStep({ unit: front, target: lateral ? { x: -2, z: -.94 } : { x: -.78, z: -2 },
    travelDirection: { x: 0, z: 1 }, tick, stepDistance: .086666666666667,
    neighbors: followers, cellCenter: { x: -.5, z: -.5 }, directionOf: () => ({ x: 0, z: 1 }),
    canTraverse: p => p.x <= -.22 });
  const before = select(0);
  if (lateral) assert.equal(before.z, 0, 'the pre-arbitration proposal has zero forward projection');
  else assert.ok(before.z < 0, 'the pre-arbitration proposal heads backward on the segment');
  const after = select(40);
  assert.ok(after.waitingForCrowd || after.yieldingForCrowd);
});

test('parked-body detour chooses the physically open side beside a wall', () => {
  const u = actor({ x: -1 }), parked = actor({ id: 2, x: .5, path: [], pathIndex: 0, holdingPosition: true });
  const initial = structuredClone(parked), target = { x: 2, z: .5 };
  for (let tick = 1; tick <= 150 && !u.pathIndex; tick++) {
    const move = selectCrowdStep({ unit: u, target, stepDistance: .09, tick, neighbors: [parked],
      pointAllowed: p => p.z <= .78, canTraverse: p => p.z <= .78 });
    if (move.waitingForCrowd) continue;
    const to = move.reachedWaypoint ? move.target : { x: u.x + move.x * move.stepDistance, z: u.z + move.z * move.stepDistance };
    assert.ok(canTraverseCrowdBodySegment(u, to, .22, [parked])); assert.ok(to.z <= .78);
    Object.assign(u, to); if (move.reachedWaypoint) u.pathIndex++;
    assert.deepEqual(parked, initial);
  }
  assert.equal(u.pathIndex, 1, 'reachable endpoint does not oscillate beneath an invalid detour point');
  assert.deepEqual([u.x, u.z], [target.x, target.z]);
});

test('a retained parked-body detour revalidates its terrain continuation before selecting an alternative', () => {
  const u = actor(), parked = actor({ id: 2, x: .49, path: [], holdingPosition: true });
  const before = structuredClone(parked), calls = [];
  let lowerOnly = false;
  const select = tick => selectCrowdStep({ unit: u, target: { x: 2, z: .5 },
    stepDistance: .09, tick, neighbors: [parked], canTraverse: () => true,
    pointAllowed: () => true, detourAllowed: p => {
      calls.push({ x: p.x, z: p.z }); return !lowerOnly || p.z < .5;
    } });
  const first = select(1);
  assert.ok(first.z > 0); assert.equal(first.crowdControl.detourTerrainProbes, calls.length);
  assert.ok(calls.length <= 8);
  calls.length = 0; lowerOnly = true;
  const next = select(2);
  assert.ok(calls[0].z > .5 && calls[1].z < .5, 'the retained side is rejected before its alternative is admitted');
  assert.ok(next.z < 0); assert.equal(next.crowdControl.detourTerrainProbes, calls.length);
  assert.ok(canTraverseCrowdBodySegment(u,
    { x: u.x + next.x * next.stepDistance, z: u.z + next.z * next.stepDistance }, .22, [parked]));
  assert.deepEqual(parked, before);
});

for (const reverse of [false, true]) test(`two Scouts yield serially through a finite passage, reverse=${reverse}`, () => {
  const units = [-2, 2].map((x, id) => actor({ id, kind: 'scout', x, target: { x: x < 0 ? 3 : -3, z: .5 } }));
  const walls = [{ minX: -1.5, maxX: 1.5, minZ: -10, maxZ: 0 },
    { minX: -1.5, maxX: 1.5, minZ: 1, maxZ: 10 }];
  for (let tick = 1; tick <= 360 && units.some(u => !u.pathIndex); tick++) {
    for (const u of reverse ? units.toReversed() : units) {
      if (u.pathIndex) continue;
      const neighbors = units.filter(v => v !== u);
      const allowed = (from, to) => walls.every(w => Math.sqrt(segmentRectangleDistanceSquared(from, to, w)) >= .28 - 1e-9);
      const move = selectCrowdStep({ unit: u, target: u.target, neighbors, stepDistance: .09, tick,
        cellCenter: { x: Math.floor(u.x) + .5, z: .5 }, pointAllowed: p => allowed(p, p), canTraverse: p => allowed(u, p) });
      if (move.waitingForCrowd) continue;
      const to = move.reachedWaypoint ? move.target : { x: u.x + move.x * move.stepDistance, z: u.z + move.z * move.stepDistance };
      assert.ok(allowed(u, to)); assert.ok(canTraverseCrowdBodySegment(u, to, .28, neighbors));
      Object.assign(u, to); if (move.reachedWaypoint) u.pathIndex++;
    }
  }
  assert.ok(units.every(u => u.pathIndex === 1), 'circles that cannot fit abreast require physical yielding');
});

test('ordinary crowd eligibility preserves stopped, idle, pending, dead and other caller policies', () => {
  assert.equal(ordinaryCrowdBodyRadius(actor()), .22);
  for (const extra of [{ holdingPosition: true }, { pathIndex: 1 }, { hp: 0 }, { kind: 'worker' }, { movePlanningPending: true },
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
  const { crowdControl, noProgressTicks, ...move } = selectCrowdStep({ unit: u, target, stepDistance: .1, neighbors: [], canTraverse: () => true });
  assert.deepEqual(move, { target, reachedWaypoint: true, stepDistance: .05 });
  assert.equal(noProgressTicks, 0); assert.ok(crowdControl.proposals > 0 && crowdControl.proposals <= 128);
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
