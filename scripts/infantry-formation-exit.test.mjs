import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';
import { armyAttackMap } from './army-attack-continuation-case.mjs';
import { LAND_CLEARANCE_PROFILE, canTraverseStaticBodySegment } from '../src/unit-movement.mjs';
import { canTraverseCrowdBodySegment, CROWD_PROPOSAL_LIMIT, CROWD_POINT_PROPOSAL_LIMIT } from '../src/unit-crowd-steering.mjs';

const intent = u => ({ id: u.id, generation: u.generation, x: u.x, z: u.z, hp: u.hp,
  goal: u.moveGoalCell, path: [...u.path], pathIndex: u.pathIndex, revision: u.orderRevision,
  queue: structuredClone(u.queuedWaypoints) });

async function exit(team, { slot = 0, direction = 'forward', cold = false, interrupt = false, map = armyAttackMap() } = {}) {
  let f = await createPathingReplayFixture(map, { traceLandSteps: true, traceCrowdSteps: true }), r = f.replay;
  try {
    for (const seat of [0, 1]) r.order(seat, { type: 'setStance', stance: 'noAttack',
      ids: r.units.filter(u => u.team === seat && u.kind !== 'worker').map(u => u.id) });
    const id = r.units.filter(u => u.team === team && u.kind === 'infantry')[slot].id;
    const actor = () => r.units[id], side = team ? -1 : 1;
    const target = direction.includes('-') ? { x: direction.startsWith('backward') ? -30.5 * side : -.5 * side,
      z: direction.endsWith('north') ? -10.5 : 10.5 }
      : direction === 'forward' ? { x: map.id === 'veyrholds-terraced-vale'
      ? map.spawnPoints.find(p => p.team === team).x + side * 12 : -.5 * side, z: .5 }
      : direction === 'backward' ? { x: -28.5 * side, z: .5 }
      : { x: -20.5 * side, z: direction === 'north' ? -9.5 : 10.5 };
    const order = command => {
      const notices = r.order(team, { ids: [id], unitGenerations: [actor().generation], ...command });
      assert.ok(notices.some(n => /ORDER|PLANNING|QUEUED/.test(n.message)), JSON.stringify(notices)); r.drain();
    };
    const parked = r.units.filter(u => u.id !== id).map(intent);
    order({ type: 'move', ...target });
    const revision = actor().orderRevision, goal = actor().moveGoalCell;
    let writes = 0;
    const step = () => {
      r.step();
      for (const s of r.landSteps.filter(s => s.id === id)) {
        writes++;
        assert.ok(canTraverseCrowdBodySegment(s.from, s.to, LAND_CLEARANCE_PROFILE.radiusByKind.infantry,
          s.neighbours, { allowEscape: true }), `body clearance at ${s.tick}: ${s.reason}`);
        assert.ok(canTraverseStaticBodySegment(s.from, s.to, .22, map.width, map.height, r.isWalkable,
          { allowEscape: true }), `static clearance at ${s.tick}`);
      }
      for (const sample of r.crowdSteps.filter(s => s.id === id)) {
        assert.ok(sample.proposals <= CROWD_PROPOSAL_LIMIT);
        assert.ok(sample.pointProposals <= CROWD_POINT_PROPOSAL_LIMIT);
      }
      assert.deepEqual(r.units.filter(u => u.id !== id).map(intent), parked, 'parked formation retains poses and orders');
    };
    for (let i = 0; i < 100; i++) step();
    if (cold) {
      const cp = r.checkpoint(); r.validate(cp); await f.dispose();
      f = await createPathingReplayFixture(map, { traceLandSteps: true, traceCrowdSteps: true }); r = f.replay;
      r.restore(structuredClone(cp));
      assert.equal(actor().moveGoalCell, goal); assert.equal(actor().orderRevision, revision);
    }
    if (interrupt) {
      order({ type: 'stop' });
      const stopped = intent(actor());
      for (let i = 0; i < 120; i++) { step(); assert.deepEqual(intent(actor()), stopped); }
      order({ type: 'move', x: -28.5 * side, z: -7.5 });
      target.x = -28.5 * side; target.z = -7.5;
    }
    const arrived = () => !actor().movePlanningPending && actor().pathIndex === actor().path.length
      && Math.hypot(actor().x - target.x, actor().z - target.z) < .02;
    for (let i = 0; i < 1000 && !arrived(); i++) step();
    assert.ok(arrived(), `seat ${team} slot ${slot} ${direction}: ${JSON.stringify(intent(actor()))}`);
    assert.ok(writes > 0);
    if (!interrupt) {
      // A diagonal deflection beside the real Town Center may use the existing
      // static-route repair. It keeps the requested point and is bounded here.
      assert.ok(actor().orderRevision - revision <= 1);
      assert.equal(actor().moveGoalCell, goal);
      assert.equal(actor().moveGoalPoint.requestedX, target.x);
      assert.equal(actor().moveGoalPoint.requestedZ, target.z);
    }
  } finally { await f.dispose(); }
}

for (const team of [0, 1]) {
  for (const slot of Array.from({ length: 8 }, (_, i) => i)) for (const direction of [
    'forward', 'backward', 'north', 'south', 'forward-north', 'forward-south', 'backward-north', 'backward-south'])
    test(`seat ${team}: Infantry slot ${slot} exits the parked opening ${direction}`, () => exit(team, { slot, direction }));
  test(`seat ${team}: opening exit reconstructs after cold recovery`, () => exit(team, { cold: true }));
  test(`seat ${team}: Stop abandons transient exit and a new Move replaces it`, () => exit(team, { cold: true, interrupt: true }));
  test(`seat ${team}: ordinary Tiny Terraced Vale Infantry exit survives cold recovery`, async () =>
    exit(team, { cold: true, map: JSON.parse(await readFile(new URL('../maps/veyrholds-terraced-vale.json', import.meta.url))) }));
}

for (const team of [0, 1]) test(`seat ${team}: whole starting Infantry army exits with moving peers`, async () => {
  const map = armyAttackMap(), f = await createPathingReplayFixture(map, { traceLandSteps: true, traceCrowdSteps: true }), r = f.replay;
  try {
    for (const seat of [0, 1]) r.order(seat, { type: 'setStance', stance: 'noAttack',
      ids: r.units.filter(u => u.team === seat && u.kind !== 'worker').map(u => u.id) });
    const army = r.units.filter(u => u.team === team && u.kind === 'infantry'), ids = army.map(u => u.id);
    const parked = r.units.filter(u => !ids.includes(u.id)).map(intent);
    const notices = r.order(team, { type: 'move', ids, unitGenerations: army.map(u => u.generation), x: team ? -.5 : .5, z: .5 });
    assert.ok(notices.some(n => /ORDER|PLANNING/.test(n.message))); r.drain();
    const goals = army.map(u => ({ cell: u.moveGoalCell, ...r.point(u.moveGoalCell) }));
    const arrived = () => army.every((u, i) => !u.movePlanningPending && u.pathIndex === u.path.length
      && Math.hypot(u.x - goals[i].x, u.z - goals[i].z) < .02);
    for (let tick = 0; tick < 1000 && !arrived(); tick++) {
      r.step();
      for (const s of r.landSteps.filter(s => ids.includes(s.id))) {
        assert.ok(canTraverseCrowdBodySegment(s.from, s.to, .22, s.neighbours, { allowEscape: true }));
        assert.ok(canTraverseStaticBodySegment(s.from, s.to, .22, map.width, map.height, r.isWalkable, { allowEscape: true }));
      }
      for (const s of r.crowdSteps.filter(s => ids.includes(s.id))) {
        assert.ok(s.proposals <= CROWD_PROPOSAL_LIMIT); assert.ok(s.pointProposals <= CROWD_POINT_PROPOSAL_LIMIT);
      }
      assert.deepEqual(r.units.filter(u => !ids.includes(u.id)).map(intent), parked);
    }
    assert.ok(arrived(), JSON.stringify(army.map(intent)));
    for (const [i, u] of army.entries()) {
      assert.equal(u.moveGoalCell, goals[i].cell);
    }
  } finally { await f.dispose(); }
});
