import assert from 'node:assert/strict';
import test from 'node:test';
import { followTravelMovementActive } from '../src/combat-movement.mjs';
import { activeLandMovementBodyRadius, canTraverseStaticBodySegment, LAND_CLEARANCE_PROFILE } from '../src/unit-movement.mjs';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';

test('Follow clearance derives only from target-free military persistent intent', () => {
  const unit = { kind: 'infantry', hp: 100, attackMove: false, attackTargetId: -1, attackBuildingTargetId: -1,
    buildingTargetId: null, gatherNodeId: null, gatherForestCell: -1, combatStance: 'noAttack',
    persistentOrder: { type: 'follow', targetId: 7, targetGeneration: 2, status: 'blocked' }, movePlanningPending: true };
  assert.equal(followTravelMovementActive(unit), true);
  for (const [kind, radius] of Object.entries(LAND_CLEARANCE_PROFILE.radiusByKind)) {
    assert.equal(activeLandMovementBodyRadius({ ...unit, kind }), kind === 'worker' ? 0 : radius);
  }
  for (const override of [{ kind: 'worker' }, { kind: 'sheep' }, { kind: 'skiff' }, { kind: 'unknown' },
    { hp: 0 }, { movementDomain: 'water' }, { holdingPosition: true }, { attackMove: true },
    { attackTargetId: 0 }, { attackBuildingTargetId: 0 }, { stanceCombat: true }, { stanceReturning: true },
    { persistentOrder: null }, { persistentOrder: { type: 'patrol' } }, { gatherNodeId: 'berry' },
    { gatherForestCell: 0 }, { gatherPhase: 'to-base' }, { buildingTargetId: 0 }]) {
    assert.equal(followTravelMovementActive({ ...unit, ...override }), false, JSON.stringify(override));
  }
});

async function journey(team, action, kind = 'infantry') {
  process.env.RTS_MAP = 'maps/open-field.json'; process.env.RTS_GAME_MODE = 'pvp'; process.env.RTS_PREGAME = '0';
  process.env.RTS_MOVE_PLANNING_TURNS_PER_TICK = '0'; delete process.env.RTS_MATCH_STATE_PATH;
  const map = { id: 'follow-travel-journey', name: 'Follow Travel Journey', width: 64, height: 48,
    terrainSeed: 881, fogOfWar: false, startingArmySize: 16, startingResources: { food: 800, wood: 2000 },
    spawnPoints: [{ team: 0, x: -20, z: -16 }, { team: 1, x: 20, z: 16 }],
    resourceNodes: [], triggers: [], scenarioEvents: [],
    obstacles: [{ column: 33, row: 25, width: 1, height: 1, material: 'stone' }] };
  const fixture = await createPathingReplayFixture(map, { traceLandSteps: true, traceRouteRejoins: true });
  let r = fixture.replay, cold;
  try {
    const command = (type, fields = {}, selected = id) => r.order(r.units[selected].team,
      { type, ids: [selected], unitGenerations: [r.units[selected].generation], ...fields });
    for (const seat of [0, 1]) {
      const units = r.units.filter(u => u.team === seat); r.order(seat, { type: 'stop', ids: units.map(u => u.id) });
      r.order(seat, { type: 'setStance', stance: 'noAttack', ids: units.filter(u => u.kind !== 'worker').map(u => u.id) });
    }
    if (kind === 'archer') {
      const builder = r.units.find(u => u.team === team && u.kind === 'worker'), sign = team ? 1 : -1;
      command('build', { buildingType: 'archery-range', x: sign * 25.5, z: sign * 16.5 }, builder.id); r.drain();
      const home = r.buildings.find(b => b.team === team && b.type === 'archery-range'); assert.ok(home);
      for (let t = 0; t < 1500 && !home.complete; t++) r.step(); assert.ok(home.complete);
      assert.ok(r.order(team, { type: 'trainUnit', buildingId: home.id, kind }).some(n => /ARCHER QUEUED/.test(n.message)));
      for (let t = 0; t < 500 && !r.units.some(u => u.team === team && u.kind === kind); t++) r.step();
      const archer = r.units.find(u => u.team === team && u.kind === kind); assert.ok(archer);
      command('stop', {}, archer.id); command('setStance', { stance: 'noAttack' }, archer.id);
    }
    const id = r.units.find(u => u.team === team && u.kind === kind).id;
    const leaderId = r.units.find(u => u.team === team && u.kind === 'worker' && u.id !== id).id;
    const actor = () => r.units[id], leader = () => r.units[leaderId];
    command('move', { x: 6.5, z: .5 }, leaderId); command('move', { x: .75, z: .95 }); r.drain();
    for (let t = 0; t < 800 && [actor(), leader()].some(u => u.pathIndex < u.path.length); t++) r.step();
    assert.deepEqual([actor().x, actor().z], [.75, .95]);
    const untouched = r.units.filter(u => u.id !== id).map(u => [u.id, u.orderRevision, u.hp]);
    const radius = LAND_CLEARANCE_PROFILE.radiusByKind[kind]; let safeSteps = 0;
    const clear = (from, to) => canTraverseStaticBodySegment(from, to, radius, 64, 48, r.isWalkable);
    const step = options => {
      r.step(options);
      if (kind !== 'worker') for (const s of r.landSteps.filter(s => s.id === id)) {
        assert.ok(clear(s.from, s.to), `unsafe Follow/queued step ${JSON.stringify(s)}`); safeSteps++;
      }
    };
    const until = (condition, options) => {
      for (let t = 0; t < 700 && !condition(); t++) step(options);
      assert.ok(condition(), 'bounded real-command Follow condition');
    };
    const recover = async (separate = false) => {
      const saved = JSON.parse(JSON.stringify(r.checkpoint())); assert.ok(r.validate(structuredClone(saved)));
      if (separate) { await cold?.dispose(); cold = await createPathingReplayFixture(map, { traceLandSteps: true, traceRouteRejoins: true }); r = cold.replay; }
      r.restore(saved); assert.equal(actor().moveGoalCell, saved.state.units[id].moveGoalCell);
      assert.deepEqual(actor().persistentOrder, saved.state.units[id].persistentOrder);
      assert.equal(actor().orderRevision, saved.state.units[id].orderRevision + Number(saved.state.units[id].movePlanningPending));
      return saved;
    };
    const follow = () => {
      assert.ok(command('follow', { targetId: leaderId, targetGeneration: leader().generation }).some(n => /FOLLOW ORDER/.test(n.message)));
      assert.equal(actor().persistentOrder.targetId, leaderId); assert.equal(actor().persistentOrder.targetGeneration, leader().generation);
      assert.equal(actor().attackMove, false); assert.equal(actor().combatStance, kind === 'worker' ? null : 'noAttack');
    };
    const phase = name => {
      if (name === 'accepted') return;
      until(() => actor().movePlanningPending, { planningTurns: 0 });
      assert.ok(actor().moveGoalCell >= 0, 'merged core publishes the accepted catch-up goal before callbacks');
      if (name === 'active') { r.drain(); step(); assert.ok(actor().pathIndex < actor().path.length); }
    };
    const settle = () => until(() => Math.hypot(leader().x - actor().x, leader().z - actor().z) <= 4
      && !actor().movePlanningPending && actor().pathIndex >= actor().path.length);
    const finishPoint = () => until(() => !actor().movePlanningPending && actor().pathIndex >= actor().path.length
      && Math.hypot(actor().x + 3.5, actor().z + 3.5) < .001);
    const changed = await action({ r: () => r, id, leaderId, actor, leader, command, step, until, recover, follow,
      phase, settle, finishPoint, clear, safeSteps: () => safeSteps }) ?? [];
    assert.deepEqual(r.units.filter(u => u.id !== id && !changed.includes(u.id)).map(u => [u.id, u.orderRevision, u.hp]),
      untouched.filter(u => !changed.includes(u[0])), 'Follow recruits no unselected roster and produces no damage');
  } finally { await cold?.dispose(); await fixture.dispose(); }
}

for (const team of [0, 1]) for (const kind of ['infantry', 'archer']) for (const recovery of ['accepted', 'pending', 'active']) {
  test(`seat ${team}: ${kind} Follow preserves friendly generation and chosen goal through ${recovery} recovery`, async () => {
    await journey(team, async ({ r, id, actor, leader, follow, phase, recover, settle, step, safeSteps }) => {
      follow(); phase(recovery); const generation = leader().generation;
      if (recovery !== 'accepted') {
        const expected = kind === 'archer' ? 1640 : (team ? 1508 : 1572);
        assert.equal(actor().moveGoalCell, expected, 'existing two-cell ID-derived offset stays selected');
      }
      await recover(); const goal = actor().moveGoalCell;
      settle(); assert.equal(actor().persistentOrder.targetGeneration, generation); assert.equal(actor().persistentOrder.targetId, leader().id);
      if (goal >= 0) assert.equal(actor().moveGoalCell, goal);
      assert.ok(safeSteps() > 0); assert.equal(actor().attackTargetId, -1); assert.equal(actor().attackBuildingTargetId, -1);
      const revision = actor().orderRevision, position = [actor().x, actor().z];
      for (let t = 0; t < 90; t++) step(); assert.equal(actor().orderRevision, revision);
      assert.deepEqual([actor().x, actor().z], position, 'settled Follow remains within the unchanged four-cell deadband');
      assert.equal(r().units[id].hp, kind === 'infantry' ? 100 : 70);
    }, kind);
  });
}

for (const team of [0, 1]) for (const phaseName of ['pending', 'active']) for (const replacement of ['stop', 'holdPosition', 'move', 'queuedMove']) {
  test(`seat ${team}: ${replacement} cancels ${phaseName} Follow across recovery without reviving the leader`, async () => {
    await journey(team, async ({ r, actor, command, follow, phase, recover, step, finishPoint }) => {
      follow(); phase(phaseName); const firstGoal = actor().moveGoalCell;
      command(replacement === 'queuedMove' ? 'move' : replacement,
        replacement === 'move' || replacement === 'queuedMove' ? { x: -3.5, z: -3.5, queue: replacement === 'queuedMove' } : {});
      assert.equal(actor().persistentOrder, null); await recover();
      const position = [actor().x, actor().z], revision = actor().orderRevision;
      if (replacement === 'queuedMove') { assert.equal(actor().moveGoalCell, firstGoal); assert.equal(actor().queuedWaypoints.length, 1); }
      if (replacement === 'move' || replacement === 'queuedMove') {
        finishPoint(); assert.equal(actor().queuedWaypoints.length, 0);
        if (replacement === 'queuedMove') assert.equal(actor().orderRevision, revision + 1, 'queue promotes exactly once');
      } else { for (let t = 0; t < 90; t++) step(); assert.deepEqual([actor().x, actor().z], position); }
      r().drain(); for (let t = 0; t < 30; t++) step(); assert.equal(actor().persistentOrder, null);
    });
  });
}

for (const team of [0, 1]) for (const turns of [0, 1]) test(`seat ${team}: ${turns} planner turns retain first pending Follow then queued fractional Move in a cold module`, async () => {
  await journey(team, async ({ r, actor, command, follow, phase, recover, until, finishPoint }) => {
    follow(); phase('pending'); const firstGoal = actor().moveGoalCell;
    command('move', { x: -3.5, z: -3.5, queue: true }); assert.equal(actor().persistentOrder, null);
    const queue = structuredClone(actor().queuedWaypoints); await recover(true);
    assert.deepEqual(actor().queuedWaypoints, queue); assert.equal(actor().moveGoalCell, firstGoal);
    until(() => actor().path.length > 0, { planningTurns: turns || undefined });
    assert.equal(actor().moveGoalCell, firstGoal, 'the durable accepted catch-up executes first');
    assert.equal(actor().queuedWaypoints.length, 1); r().drain(); finishPoint();
    assert.equal(actor().queuedWaypoints.length, 0); assert.equal(actor().persistentOrder, null);
  });
});

for (const team of [0, 1]) {
  test(`seat ${team}: actual leader death stops Follow safely through recovery`, async () => {
    await journey(team, async ({ r, actor, leader, leaderId, command, follow, phase, until, recover, step }) => {
      follow(); phase('active'); const enemy = r().units.find(u => u.team !== team && u.kind === 'infantry');
      command('move', { x: 8.5, z: .5 }, enemy.id); r().drain();
      until(() => r().units[enemy.id].pathIndex >= r().units[enemy.id].path.length);
      assert.ok(command('attack', { targetId: leaderId, targetGeneration: leader().generation }, enemy.id).some(n => /ATTACK ORDER/.test(n.message)));
      until(() => leader().hp === 0); await recover(); until(() => actor().persistentOrder === null);
      const position = [actor().x, actor().z]; for (let t = 0; t < 60; t++) step();
      assert.deepEqual([actor().x, actor().z], position); assert.equal(actor().attackTargetId, -1);
      return [leaderId, enemy.id];
    });
  });
  test(`seat ${team}: moving friendly leader triggers existing bounded replans through recovery`, async () => {
    await journey(team, async ({ actor, leader, leaderId, command, follow, phase, step, recover, settle }) => {
      follow(); phase('active'); const goal = actor().moveGoalCell;
      command('move', { x: 12.5, z: -3.5 }, leaderId); for (let t = 0; t < 45; t++) step();
      await recover(); settle(); assert.notEqual(actor().moveGoalCell, goal);
      assert.equal(actor().persistentOrder.targetId, leaderId); assert.equal(actor().persistentOrder.targetGeneration, leader().generation);
      return [leaderId];
    });
  });
  test(`seat ${team}: valid checkpoint leader generation replacement safely stops Follow`, async () => {
    await journey(team, async ({ r, id, actor, leaderId, follow, phase, step }) => {
      follow(); phase('active'); const saved = r().checkpoint(); saved.state.units[leaderId].generation++;
      saved.state.units[leaderId].moveGoalPoint = null;
      saved.state.unitGenerationCounters[leaderId] = saved.state.units[leaderId].generation;
      assert.ok(r().validate(structuredClone(saved))); r().restore(saved);
      for (let t = 0; t < 35; t++) step(); assert.equal(actor().persistentOrder, null);
      const position = [actor().x, actor().z]; for (let t = 0; t < 35; t++) step();
      assert.deepEqual([actor().x, actor().z], position); assert.equal(r().units[id].attackTargetId, -1);
    });
  });
  test(`seat ${team}: already-close leader retains Follow with empty travel through recovery`, async () => {
    await journey(team, async ({ r, actor, leaderId, command, follow, recover, step, safeSteps }) => {
      command('move', { x: 3.5, z: -.5 }, leaderId); r().drain();
      for (let t = 0; t < 100 && r().units[leaderId].pathIndex < r().units[leaderId].path.length; t++) r().step();
      follow(); await recover(); const position = [actor().x, actor().z];
      for (let t = 0; t < 90; t++) step(); assert.deepEqual([actor().x, actor().z], position);
      assert.equal(actor().path.length, 0); assert.ok(actor().persistentOrder); assert.equal(safeSteps(), 0);
      return [leaderId];
    });
  });
  test(`seat ${team}: legacy body overlap uses existing bounded monotone escape and retains Follow during recovery`, async () => {
    await journey(team, async ({ r, id, actor, follow, phase, recover }) => {
      const saved = r().checkpoint(); saved.state.units[id].x = .91; assert.ok(r().validate(structuredClone(saved))); r().restore(saved);
      follow(); phase('pending'); await recover(); const goal = actor().moveGoalCell;
      let escaped = 0;
      for (let t = 0; t < 90; t++) {
        r().step();
        assert.equal(actor().persistentOrder.type, 'follow'); assert.equal(actor().moveGoalCell, goal);
        for (const s of r().landSteps.filter(s => s.id === id)) {
          assert.ok(canTraverseStaticBodySegment(s.from, s.to, .22, 64, 48, r().isWalkable, { allowEscape: true }));
          if (!canTraverseStaticBodySegment(s.from, s.from, .22, 64, 48, r().isWalkable)) escaped++;
        }
      }
      assert.ok(escaped > 0); assert.ok(canTraverseStaticBodySegment(actor(), actor(), .22, 64, 48, r().isWalkable));
    });
  });
  test(`seat ${team}: a paid obstacle repairs Follow without replacing its friendly leader`, async () => {
    await journey(team, async ({ r, actor, leaderId, command, follow, phase, recover, settle }) => {
      follow(); phase('active'); const builder = r().units.find(u => u.team === team && u.kind === 'worker' && u.id !== leaderId);
      const wood = r().wood[team], navigation = r().navigationRevision;
      assert.ok(command('build', { buildingType: 'palisade-wall', x: 2.5, z: .5 }, builder.id).some(n => /PLACED/.test(n.message)));
      command('stop', {}, builder.id); const paid = r().wood[team]; assert.ok(paid < wood); assert.ok(r().navigationRevision > navigation);
      await recover(); settle(); assert.equal(actor().persistentOrder.targetId, leaderId); assert.equal(r().wood[team], paid);
      assert.ok(r().buildings.some(b => b.team === team && b.type === 'palisade-wall')); return [builder.id];
    });
  });
  test(`seat ${team}: foreign/stale leader and Follow cycle rejection retain the accepted selected intent`, async () => {
    await journey(team, ({ r, id, actor, leader, leaderId, command, follow }) => {
      follow(); const before = structuredClone(actor()), foreign = r().units.find(u => u.team !== team && u.kind === 'worker');
      for (const fields of [{ targetId: foreign.id, targetGeneration: foreign.generation },
        { targetId: leaderId, targetGeneration: leader().generation + 1 }, { targetId: 99999, targetGeneration: 1 }]) {
        assert.ok(command('follow', fields).some(n => /REJECTED/.test(n.message))); assert.deepEqual(actor(), before);
      }
      assert.ok(command('follow', { targetId: id, targetGeneration: actor().generation }, leaderId).some(n => /FOLLOW CYCLE/.test(n.message)));
      assert.deepEqual(actor(), before);
    });
  });
  test(`seat ${team}: actual Worker Follow remains outside the military body adopter`, async () => {
    await journey(team, ({ actor, follow, settle }) => {
      follow(); settle(); assert.equal(followTravelMovementActive(actor()), false); assert.equal(activeLandMovementBodyRadius(actor()), 0);
    }, 'worker');
  });
}
