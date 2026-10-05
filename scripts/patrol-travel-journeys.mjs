import assert from 'node:assert/strict';
import test from 'node:test';
import { patrolTravelMovementActive, attackMoveAcquiredMovementActive } from '../src/combat-movement.mjs';
import { activeLandMovementBodyRadius, canTraverseStaticBodySegment, LAND_CLEARANCE_PROFILE } from '../src/unit-movement.mjs';
import { UNIT_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { combatDamage } from '../src/combat-rules.mjs';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';

test('Patrol travel derives from target-free military persistent intent, including blocked/pending and noAttack', () => {
  const unit = { kind: 'infantry', hp: 100, persistentOrder: { type: 'patrol', status: 'blocked', leg: 0 },
    attackMove: true, attackTargetId: -1, attackBuildingTargetId: -1, buildingTargetId: null,
    combatStance: 'noAttack', movePlanningPending: true, gatherNodeId: null, gatherForestCell: -1 };
  assert.equal(patrolTravelMovementActive(unit), true);
  assert.equal(patrolTravelMovementActive({ ...unit, attackMove: false }), true, 'persistent intent owns travel even in a validator-accepted older flag combination');
  for (const [kind, radius] of Object.entries(LAND_CLEARANCE_PROFILE.radiusByKind)) {
    assert.equal(activeLandMovementBodyRadius({ ...unit, kind }), kind === 'worker' ? 0 : radius);
  }
  for (const override of [{ kind: 'worker' }, { kind: 'skiff' }, { kind: 'sheep' }, { kind: 'unknown' },
    { hp: 0 }, { movementDomain: 'water' }, { holdingPosition: true }, { persistentOrder: null },
    { persistentOrder: { type: 'follow' } }, { attackTargetId: 0 }, { attackBuildingTargetId: 0 },
    { stanceCombat: true }, { stanceReturning: true }, { gatherNodeId: 'berry' },
    { gatherForestCell: 0 }, { gatherPhase: 'to-base' }, { buildingTargetId: 0 }]) {
    assert.equal(patrolTravelMovementActive({ ...unit, ...override }), false, JSON.stringify(override));
  }
});

async function journey(team, action, kind = 'infantry') {
  process.env.RTS_MAP = 'maps/open-field.json'; process.env.RTS_GAME_MODE = 'pvp';
  process.env.RTS_PREGAME = '0'; process.env.RTS_MOVE_PLANNING_TURNS_PER_TICK = '0';
  delete process.env.RTS_MATCH_STATE_PATH;
  const map = { id: 'patrol-travel-journey', name: 'Patrol Travel Journey', width: 64, height: 48,
    terrainSeed: 881, fogOfWar: false, startingArmySize: 16, startingResources: { food: 500, wood: 1000 },
    spawnPoints: [{ team: 0, x: -20, z: -16 }, { team: 1, x: 20, z: 16 }],
    resourceNodes: [], triggers: [], scenarioEvents: [],
    obstacles: [{ column: 33, row: 25, width: 1, height: 1, material: 'stone' }] };
  const fixture = await createPathingReplayFixture(map, { traceLandSteps: true }), r = fixture.replay;
  try {
    for (const seat of [0, 1]) {
      const units = r.units.filter(u => u.team === seat);
      r.order(seat, { type: 'stop', ids: units.map(u => u.id) });
      r.order(seat, { type: 'setStance', stance: 'noAttack', ids: units.filter(u => u.kind !== 'worker').map(u => u.id) });
    }
    const id = r.units.find(u => u.team === team && u.kind === kind).id, actor = () => r.units[id];
    const radius = LAND_CLEARANCE_PROFILE.radiusByKind[kind];
    const command = (type, fields = {}, selected = id) => r.order(r.units[selected].team,
      { type, ids: [selected], unitGenerations: [r.units[selected].generation], ...fields });
    command('move', { x: .75, z: .95 }); r.drain();
    for (let t = 0; t < 700 && actor().pathIndex < actor().path.length; t++) r.step();
    assert.deepEqual({ x: actor().x, z: actor().z }, { x: .75, z: .95 });
    const clear = (from, to) => canTraverseStaticBodySegment(from, to, radius, map.width, map.height, r.isWalkable);
    assert.ok(clear(actor(), actor()));
    const untouched = r.units.filter(u => u.id !== id).map(u => [u.id, u.orderRevision]);
    let safeSteps = 0, switches = 0;
    const step = () => {
      const before = structuredClone(actor()); r.step();
      if (activeLandMovementBodyRadius(actor()) > 0) for (const s of r.landSteps.filter(s => s.id === id)) {
        assert.ok(clear(s.from, s.to), `unsafe adopted ${s.reason}: ${JSON.stringify(s)}`); safeSteps++;
      }
      if (before.persistentOrder?.type === 'patrol' && actor().persistentOrder?.type === 'patrol'
        && before.persistentOrder.leg !== actor().persistentOrder.leg) {
        switches++; const oldDestination = before.persistentOrder.leg ? before.persistentOrder.end : before.persistentOrder.start;
        assert.equal(r.cell(before.x, before.z), oldDestination, 'leg switches only after reaching its existing endpoint cell');
        assert.equal(before.attackTargetId, -1); assert.equal(before.attackBuildingTargetId, -1);
        assert.ok(before.pathIndex >= before.path.length && !before.movePlanningPending);
        assert.equal(actor().orderRevision, before.orderRevision + 1, 'existing persistent planner owns exactly one continuation revision');
      }
    };
    const until = (condition, limit = 900) => { for (let t = 0; t < limit && !condition(); t++) step(); assert.ok(condition(), 'bounded journey condition'); };
    const recover = () => {
      const saved = r.checkpoint(); assert.ok(r.validate(structuredClone(saved))); r.restore(structuredClone(saved));
      assert.deepEqual(actor().persistentOrder, saved.state.units[id].persistentOrder);
      assert.equal(actor().orderRevision, saved.state.units[id].orderRevision
        + Number(saved.state.units[id].movePlanningPending), 'existing recovery replans a pending leg once under a new revision');
      assert.equal(actor().moveGoalCell, saved.state.units[id].moveGoalCell);
    };
    const patrol = () => {
      assert.ok(command('patrol', { x: 6.5, z: .5 }).some(n => /PATROL/.test(n.message)));
      assert.equal(actor().movePlanningPending, true); assert.deepEqual(actor().persistentOrder,
        { type: 'patrol', start: r.cell(.75, .95), end: r.cell(6.5, .5), leg: 1,
          status: 'active', nextTick: r.tick + (id % 30) });
      if (kind !== 'worker') assert.equal(activeLandMovementBodyRadius(actor()), radius);
    };
    const phase = name => {
      if (name === 'pending') return;
      r.drain(); step();
      if (name === 'outbound') return;
      until(() => actor().persistentOrder.leg === 0 && actor().movePlanningPending);
      if (name === 'return') { r.drain(); step(); assert.equal(actor().persistentOrder.leg, 0); }
    };
    const finishPoint = point => until(() => !actor().movePlanningPending && actor().pathIndex >= actor().path.length
      && Math.hypot(actor().x - point.x, actor().z - point.z) < .001);
    const changed = await action({ r, id, actor, command, step, until, recover, patrol, phase, finishPoint, radius, clear,
      safeSteps: () => safeSteps, switches: () => switches }) ?? [];
    assert.deepEqual(r.units.filter(u => u.id !== id && !changed.includes(u.id)).map(u => [u.id, u.orderRevision]),
      untouched.filter(([uid]) => !changed.includes(uid)), 'only actual selected command actors change accepted orders');
  } finally { await fixture.dispose(); }
}

for (const team of [0, 1]) for (const recovery of ['pending', 'outbound', 'returnPending', 'return']) {
  test(`seat ${team}: Patrol cycles original cell endpoints through ${recovery} recovery with static-clear travel`, async () => {
    await journey(team, ({ r, actor, step, until, recover, patrol, phase, safeSteps, switches }) => {
      patrol(); phase(recovery); const original = structuredClone(actor().persistentOrder), hp = actor().hp;
      recover(); until(() => switches() >= 4);
      assert.equal(actor().persistentOrder.start, original.start); assert.equal(actor().persistentOrder.end, original.end);
      assert.equal(actor().persistentOrder.status, 'active'); assert.equal(actor().hp, hp); assert.ok(safeSteps() > 0);
      assert.equal(actor().attackMove, true); assert.equal(actor().combatStance, 'noAttack');
      for (let t = 0; t < 5; t++) step();
      assert.equal(r.point(original.start).x, .5, 'return remains the original start cell center, not a new fractional policy');
    });
  });
}

for (const team of [0, 1]) for (const stage of ['pending', 'return']) for (const replacement of ['stop', 'holdPosition', 'move', 'queuedMove']) {
  test(`seat ${team}: ${replacement} replaces ${stage} Patrol through recovery without reviving old legs`, async () => {
    await journey(team, ({ actor, command, step, recover, patrol, phase, finishPoint }) => {
      patrol(); phase(stage);
      if (replacement === 'move' || replacement === 'queuedMove') {
        command('move', { x: -3.5, z: -3.5, ...(replacement === 'queuedMove' ? { queue: true } : {}) });
        assert.equal(actor().persistentOrder, null, 'queued admission also cancels persistent intent immediately');
        recover(); finishPoint({ x: -3.5, z: -3.5 }); assert.equal(actor().queuedWaypoints.length, 0);
      } else {
        command(replacement); const pose = { x: actor().x, z: actor().z }, revision = actor().orderRevision;
        recover(); for (let t = 0; t < 80; t++) step();
        assert.deepEqual({ x: actor().x, z: actor().z }, pose); assert.equal(actor().orderRevision, revision);
        assert.equal(actor().path.length, 0); assert.equal(actor().movePlanningPending, false);
      }
      assert.equal(actor().persistentOrder, null); assert.equal(patrolTravelMovementActive(actor()), false);
      assert.equal(actor().attackMove, false); assert.equal(actor().attackTargetId, -1); assert.equal(actor().attackMoveResumePath, null);
    });
  });
}

for (const team of [0, 1]) test(`seat ${team}: actual Patrol acquisition remains excluded, damages legally and restores its same leg through recovery`, async () => {
  await journey(team, ({ r, id, actor, command, step, until, recover, patrol, switches }) => {
    const targetId = r.units.find(u => u.team !== team && u.kind === 'worker').id, target = () => r.units[targetId];
    command('move', { x: 2.25, z: .95 }, targetId); r.drain(); until(() => target().pathIndex >= target().path.length);
    patrol(); r.drain(); command('setStance', { stance: 'aggressive' }); step();
    assert.equal(actor().attackTargetId, targetId); assert.equal(actor().persistentOrder.leg, 1);
    assert.equal(patrolTravelMovementActive(actor()), false); assert.equal(attackMoveAcquiredMovementActive(actor()), false);
    assert.equal(activeLandMovementBodyRadius(actor()), 0, 'Patrol acquired pursuit is explicitly deferred');
    const resume = [...actor().attackMoveResumePath], index = actor().attackMoveResumePathIndex;
    const order = structuredClone(actor().persistentOrder); recover(); let damage = 0;
    for (let t = 0; t < 600 && actor().attackTargetId >= 0; t++) {
      const before = structuredClone(actor()), hp = target().hp; step();
      if (target().hp < hp) {
        damage++; assert.ok(Math.hypot(before.x - target().x, before.z - target().z) <= UNIT_DEFINITIONS.infantry.combat.range);
        assert.equal(hp - target().hp, Math.min(hp, combatDamage(UNIT_DEFINITIONS.infantry, UNIT_DEFINITIONS.worker)));
      }
      if (actor().attackTargetId >= 0) assert.equal(actor().persistentOrder.leg, order.leg);
    }
    assert.ok(damage > 0); assert.equal(target().hp, 0); assert.equal(actor().persistentOrder.leg, order.leg);
    assert.deepEqual(actor().path, resume); assert.equal(actor().pathIndex, index); assert.equal(actor().attackMoveResumePath, null);
    assert.equal(patrolTravelMovementActive(actor()), true); recover(); until(() => switches() >= 2);
    assert.equal(actor().persistentOrder.start, order.start); assert.equal(actor().persistentOrder.end, order.end);
    return [targetId];
  });
});

for (const team of [0, 1]) test(`seat ${team}: live target leaves Patrol leash and the same endpoint cycle resumes after recovery`, async () => {
  await journey(team, ({ r, actor, command, step, until, recover, patrol, switches }) => {
    const targetId = r.units.find(u => u.team !== team && u.kind === 'worker').id, target = () => r.units[targetId];
    command('move', { x: 2.25, z: .95 }, targetId); r.drain(); until(() => target().pathIndex >= target().path.length);
    patrol(); r.drain(); command('setStance', { stance: 'aggressive' }); step(); assert.equal(actor().attackTargetId, targetId);
    const order = structuredClone(actor().persistentOrder), anchor = [actor().attackMoveAnchorX, actor().attackMoveAnchorZ];
    command('move', { x: 14.5, z: .5 }, targetId); until(() => actor().attackTargetId < 0);
    assert.ok(target().hp > 0); assert.equal(actor().persistentOrder.leg, order.leg);
    assert.deepEqual([actor().attackMoveAnchorX, actor().attackMoveAnchorZ], anchor);
    recover(); until(() => switches() >= 2);
    assert.equal(actor().persistentOrder.start, order.start); assert.equal(actor().persistentOrder.end, order.end);
    return [targetId];
  });
});

for (const team of [0, 1]) test(`seat ${team}: paid endpoint blockage preserves Patrol cells and reopens after cancellation/recovery`, async () => {
  await journey(team, ({ r, actor, command, until, recover, patrol, phase, switches }) => {
    patrol(); phase('outbound'); const order = structuredClone(actor().persistentOrder), navigation = r.navigationRevision;
    const worker = r.units.find(u => u.team !== team && u.kind === 'worker');
    command('build', { buildingType: 'palisade-wall', x: 6.5, z: .5 }, worker.id);
    const wall = r.buildings.find(b => b.team !== team && b.type === 'palisade-wall'); assert.ok(wall);
    assert.ok(r.navigationRevision > navigation); until(() => actor().persistentOrder.status === 'blocked'); recover();
    assert.equal(actor().persistentOrder.start, order.start); assert.equal(actor().persistentOrder.end, order.end);
    command('cancelConstruction', { buildingId: wall.id }, worker.id); assert.ok(!r.buildings.some(b => b.id === wall.id));
    recover(); until(() => switches() >= 2); assert.equal(actor().persistentOrder.status, 'active');
    assert.equal(actor().persistentOrder.start, order.start); assert.equal(actor().persistentOrder.end, order.end);
    return [worker.id];
  });
});

for (const team of [0, 1]) test(`seat ${team}: actual Follow retains its separate deadband and zero Patrol body policy`, async () => {
  await journey(team, ({ r, actor, command, until, recover }) => {
    const leader = r.units.find(u => u.team === team && u.kind === 'worker');
    command('follow', { targetId: leader.id, targetGeneration: leader.generation }); recover();
    until(() => Math.hypot(actor().x - leader.x, actor().z - leader.z) <= 4);
    assert.equal(actor().persistentOrder.type, 'follow'); assert.equal(patrolTravelMovementActive(actor()), false);
    assert.equal(activeLandMovementBodyRadius(actor()), 0); assert.equal(actor().attackTargetId, -1);
  });
});

for (const team of [0, 1]) test(`seat ${team}: actual Worker Patrol remains excluded and retains endpoint cycling/recovery`, async () => {
  await journey(team, ({ actor, until, recover, patrol, switches }) => {
    patrol(); recover(); until(() => switches() >= 2);
    assert.equal(actor().persistentOrder.type, 'patrol'); assert.equal(patrolTravelMovementActive(actor()), false);
    assert.equal(activeLandMovementBodyRadius(actor()), 0);
  }, 'worker');
});

for (const team of [0, 1]) test(`seat ${team}: validated saved Patrol with attackMove disabled keeps its same travel intent and cell cycle`, async () => {
  await journey(team, ({ r, id, actor, until, patrol, switches }) => {
    patrol(); r.drain(); const saved = r.checkpoint(), order = structuredClone(actor().persistentOrder);
    saved.state.units[id].attackMove = false;
    assert.ok(r.validate(structuredClone(saved))); r.restore(structuredClone(saved));
    assert.equal(patrolTravelMovementActive(actor()), true); until(() => switches() >= 2);
    assert.equal(actor().persistentOrder.start, order.start); assert.equal(actor().persistentOrder.end, order.end);
    assert.equal(actor().attackMove, false, 'the new selector does not rewrite a saved gameplay flag');
    assert.equal(actor().attackTargetId, -1);
  });
});
