import assert from 'node:assert/strict';
import test from 'node:test';
import { attackMoveObjectiveMovementActive, attackMoveAcquiredMovementActive, patrolTravelMovementActive } from '../src/combat-movement.mjs';
import { activeLandMovementBodyRadius, canTraverseStaticBodySegment, LAND_CLEARANCE_PROFILE } from '../src/unit-movement.mjs';
import { UNIT_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { combatDamage } from '../src/combat-rules.mjs';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';

test('explicit target-free AttackMove clearance activates while pending, including noAttack stance', () => {
  const unit = { kind: 'infantry', hp: 100, attackMove: true, combatStance: 'noAttack',
    attackTargetId: -1, attackBuildingTargetId: -1, buildingTargetId: null,
    movePlanningPending: true, attackMoveRouteReady: false, path: [], gatherNodeId: null, gatherForestCell: -1 };
  assert.equal(attackMoveObjectiveMovementActive(unit), true);
  for (const [kind, radius] of Object.entries(LAND_CLEARANCE_PROFILE.radiusByKind)) {
    assert.equal(activeLandMovementBodyRadius({ ...unit, kind }), radius);
  }
  for (const override of [{ kind: 'worker' }, { kind: 'skiff' }, { kind: 'sheep' }, { kind: 'unknown' },
    { hp: 0 }, { movementDomain: 'water' }, { attackMove: false }, { attackMove: undefined },
    { holdingPosition: true }, { attackTargetId: 0 }, { attackBuildingTargetId: 0 },
    { stanceCombat: true }, { stanceReturning: true }, { persistentOrder: { type: 'patrol' } },
    { persistentOrder: { type: 'follow' } }, { gatherNodeId: 'berry' }, { gatherForestCell: 0 },
    { gatherPhase: 'to-base' }, { buildingTargetId: 0 }]) {
    assert.equal(attackMoveObjectiveMovementActive({ ...unit, ...override }), false, JSON.stringify(override));
    assert.equal(activeLandMovementBodyRadius({ ...unit, ...override }), override.attackTargetId === 0 || override.persistentOrder?.type === 'patrol'
      ? LAND_CLEARANCE_PROFILE.radiusByKind.infantry : override.kind === 'worker' ? LAND_CLEARANCE_PROFILE.radiusByKind.worker : 0, JSON.stringify(override));
  }
});

// Commands, planning publication and every admitted physical substep use the
// unchanged production host. No route injection, planner or visual substitute.
async function journey(team, action) {
  process.env.RTS_MAP = 'maps/open-field.json'; process.env.RTS_GAME_MODE = 'pvp';
  process.env.RTS_PREGAME = '0'; process.env.RTS_MOVE_PLANNING_TURNS_PER_TICK = '0';
  delete process.env.RTS_MATCH_STATE_PATH;
  const map = { id: 'attack-move-objective-journey', name: 'AttackMove Objective Journey',
    width: 64, height: 48, terrainSeed: 881, fogOfWar: false, startingArmySize: 16,
    startingResources: { food: 500, wood: 1000 },
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
    const id = r.units.find(u => u.team === team && u.kind === 'infantry').id;
    const actor = () => r.units[id], radius = LAND_CLEARANCE_PROFILE.radiusByKind.infantry;
    const command = (type, fields = {}, selected = id) => r.order(r.units[selected].team,
      { type, ids: [selected], unitGenerations: [r.units[selected].generation], ...fields });
    command('move', { x: .75, z: .95 }); r.drain();
    for (let t = 0; t < 700 && actor().pathIndex < actor().path.length; t++) r.step();
    assert.deepEqual({ x: actor().x, z: actor().z }, { x: .75, z: .95 });
    const clear = (from, to, allowEscape = false) => canTraverseStaticBodySegment(from, to, radius,
      map.width, map.height, r.isWalkable, { allowEscape });
    assert.ok(clear(actor(), actor()), 'real Move establishes a body-clear fractional start');
    const untouched = r.units.filter(u => u.id !== id).map(u => [u.id, u.orderRevision]);
    let safeSteps = 0;
    const step = (options) => {
      r.step(options);
      for (const s of r.landSteps.filter(s => s.id === id)) {
        assert.ok(clear(s.from, s.to), `unsafe objective ${s.reason}: ${JSON.stringify(s)}`);
        safeSteps++;
      }
    };
    const recover = () => {
      const saved = r.checkpoint(); assert.ok(r.validate(structuredClone(saved)));
      r.restore(structuredClone(saved));
    };
    const finish = (point = { x: 6.5, z: .5 }, limit = 250) => {
      for (let t = 0; t < limit && (actor().movePlanningPending || actor().pathIndex < actor().path.length
        || Math.hypot(actor().x - point.x, actor().z - point.z) > .001); t++) step();
      assert.ok(!actor().movePlanningPending && actor().pathIndex >= actor().path.length);
      assert.ok(Math.hypot(actor().x - point.x, actor().z - point.z) < .001, 'bounded safe objective arrival');
    };
    const otherCommands = await action({ r, id, actor, command, step, recover, finish, clear,
      count: () => safeSteps, radius }) ?? [];
    assert.deepEqual(r.units.filter(u => u.id !== id && !otherCommands.includes(u.id)).map(u => [u.id, u.orderRevision]),
      untouched.filter(([uid]) => !otherCommands.includes(uid)), 'no other selected orders change');
  } finally { await fixture.dispose(); }
}

for (const team of [0, 1]) for (const recovery of ['none', 'pending', 'active', 'arrived']) {
  test(`seat ${team}: noAttack AttackMove safely completes through ${recovery} recovery`, async () => {
    await journey(team, ({ actor, command, r, step, recover, finish, count, radius }) => {
      const hp = actor().hp;
      command('attackMove', { x: 6.5, z: .5 });
      assert.ok(actor().movePlanningPending && !actor().attackMoveRouteReady && !actor().path.length);
      assert.equal(activeLandMovementBodyRadius(actor()), radius);
      if (recovery === 'pending') recover();
      if (recovery === 'active') { r.drain(); step(); step(); recover(); }
      finish();
      if (recovery === 'arrived') { recover(); for (let t = 0; t < 15; t++) step(); }
      assert.equal(actor().attackMove, true); assert.equal(actor().combatStance, 'noAttack');
      assert.equal(actor().hp, hp); assert.ok(count() > 0);
    });
  });
}

for (const team of [0, 1]) for (const phase of ['pending', 'active']) for (const replacement of ['stop', 'holdPosition', 'queuedMove']) {
  test(`seat ${team}: ${replacement} replaces ${phase} objective without stale recovery`, async () => {
    await journey(team, ({ actor, command, r, step, recover, finish }) => {
      command('attackMove', { x: 6.5, z: .5 });
      if (phase === 'active') { r.drain(); step(); step(); }
      if (replacement === 'queuedMove') {
        command('move', { x: -3.5, z: -3.5, queue: true });
        assert.equal(actor().queuedWaypoints.length, 1);
        recover(); finish({ x: -3.5, z: -3.5 }, 500);
        assert.equal(actor().attackMove, false); assert.equal(actor().queuedWaypoints.length, 0);
      } else {
        command(replacement); const position = { x: actor().x, z: actor().z };
        const revision = actor().orderRevision;
        assert.equal(activeLandMovementBodyRadius(actor()), 0); recover();
        for (let t = 0; t < 40; t++) step();
        assert.deepEqual({ x: actor().x, z: actor().z }, position);
        assert.equal(actor().orderRevision, revision); assert.equal(actor().attackMove, false);
        assert.equal(actor().movePlanningPending, false); assert.equal(actor().path.length, 0);
        assert.equal(actor().attackMoveResumePath, null);
      }
    });
  });
}

for (const team of [0, 1]) test(`seat ${team}: a paid footprint changes navigation and safely repairs the same objective through recovery`, async () => {
  await journey(team, ({ r, id, actor, command, step, recover, finish }) => {
    command('attackMove', { x: 6.5, z: .5 }); r.drain(); step(); step();
    const goal = actor().moveGoalCell, navigation = r.navigationRevision;
    const worker = r.units.find(u => u.team !== team && u.kind === 'worker');
    command('build', { buildingType: 'palisade-wall', x: 2.5, z: .5 }, worker.id);
    assert.ok(r.navigationRevision > navigation); recover(); finish();
    assert.equal(actor().moveGoalCell, goal); assert.equal(actor().attackMove, true);
    assert.ok(r.buildings.some(b => b.team !== team && b.type === 'palisade-wall'));
    return [worker.id];
  });
});

for (const team of [0, 1]) test(`seat ${team}: actual Patrol uses its separate travel policy and retains endpoint cycling`, async () => {
  await journey(team, ({ r, id, actor, command, clear }) => {
    command('patrol', { x: 6.5, z: .5 }); r.drain();
    let contacts = 0; const legs = new Set();
    for (let t = 0; t < 200; t++) {
      assert.equal(attackMoveObjectiveMovementActive(actor()), false);
      assert.equal(patrolTravelMovementActive(actor()), true);
      assert.equal(activeLandMovementBodyRadius(actor()), LAND_CLEARANCE_PROFILE.radiusByKind.infantry);
      r.step(); legs.add(actor().persistentOrder.leg);
      for (const s of r.landSteps.filter(s => s.id === id)) if (!clear(s.from, s.to)) contacts++;
    }
    assert.equal(contacts, 0, 'new separate Patrol travel adoption keeps every admitted static sweep clear');
    assert.deepEqual([...legs].sort(), [0, 1]); assert.equal(actor().persistentOrder.type, 'patrol');
  });
});

for (const team of [0, 1]) for (const targetPoint of [{ x: 3.5, z: 2.5 }, { x: 2.3, z: 2.3 }]) for (const recovery of ['none', 'pursuit']) {
  test(`seat ${team}: acquisition and ${recovery} recovery resume saved objective from fractional pursuit at ${targetPoint.x},${targetPoint.z}`, async () => {
    await journey(team, ({ r, id, actor, command, recover, clear, radius }) => {
      const targetId = r.units.find(u => u.team !== team && u.kind === 'worker').id;
      const target = () => r.units[targetId];
      command('move', targetPoint, targetId); r.drain();
      for (let t = 0; t < 800 && target().pathIndex < target().path.length; t++) r.step();
      assert.ok(Math.hypot(target().x - targetPoint.x, target().z - targetPoint.z) < .001);
      command('setStance', { stance: 'aggressive' }); command('attackMove', { x: 6.5, z: .5 }); r.drain();
      const objective = actor().moveGoalCell, revision = actor().orderRevision;
      let acquired = false, resumed = false, savedPath, savedIndex, receipts = 0, resumedSteps = 0, restored = false;
      let resumptionTick;
      for (let t = 0; t < 700; t++) {
        const before = structuredClone(actor()), hp = target().hp;
        r.step();
        if (actor().attackTargetId === targetId) {
          acquired = true; assert.equal(attackMoveObjectiveMovementActive(actor()), false);
          assert.equal(attackMoveAcquiredMovementActive(actor()), true);
          assert.equal(activeLandMovementBodyRadius(actor()), radius, 'acquired pursuit now has its own body policy');
          assert.ok(actor().attackMoveResumePath);
          savedPath ??= [...actor().attackMoveResumePath]; savedIndex ??= actor().attackMoveResumePathIndex;
          if (recovery === 'pursuit' && !restored) {
            recover(); restored = true;
            assert.deepEqual(actor().attackMoveResumePath, savedPath);
            assert.equal(actor().attackMoveResumePathIndex, savedIndex);
          }
        }
        if (target().hp < hp) {
          receipts++; assert.ok(Math.hypot(before.x - target().x, before.z - target().z) <= UNIT_DEFINITIONS.infantry.combat.range,
            'actual damage requires unchanged weapon range');
          assert.equal(hp - target().hp, Math.min(hp, combatDamage(UNIT_DEFINITIONS.infantry, UNIT_DEFINITIONS.worker)),
            'actual damage retains existing armor and damage rule');
        }
        if (acquired && actor().attackTargetId < 0 && !resumed) {
          resumed = true; resumptionTick = t;
          assert.equal(target().hp, 0, 'actual combat kills the acquired target');
          assert.ok(Math.abs(before.x - (Math.floor(before.x) + .5)) > .001
            || Math.abs(before.z - (Math.floor(before.z) + .5)) > .001, 'resumption begins at a fractional pursuit position');
          assert.deepEqual(actor().path, savedPath, 'clearAttackTarget directly restores the saved objective route');
          assert.equal(actor().pathIndex, savedIndex); assert.equal(actor().attackMoveResumePath, null);
          assert.equal(activeLandMovementBodyRadius(actor()), radius);
        }
        if (resumed) {
          for (const s of r.landSteps.filter(s => s.id === id)) {
            assert.ok(clear(s.from, s.to), `unsafe resumed ${s.reason}: ${JSON.stringify(s)}`); resumedSteps++;
          }
          assert.equal(actor().moveGoalCell, objective);
          assert.ok(actor().orderRevision - revision <= 1, 'at most one existing route repair, no repeated replan loop');
          if (!actor().movePlanningPending && actor().pathIndex >= actor().path.length
            && Math.hypot(actor().x - 6.5, actor().z - .5) < .001) break;
        }
      }
      assert.ok(acquired && resumed && receipts > 0 && resumedSteps > 0);
      assert.ok(r.tick > 0 && Number.isFinite(actor().x) && Number.isFinite(actor().z));
      assert.ok(Math.hypot(actor().x - 6.5, actor().z - .5) < .001, 'saved objective completes in bounded time');
      assert.ok(resumptionTick < 500); assert.equal(actor().attackMove, true);
      assert.equal(actor().orderRevision - revision, 1, 'cornered restored route uses one existing repair');
      return [targetId];
    });
  });
}

for (const team of [0, 1]) for (const interruption of ['stop', 'queuedMove', 'paidFootprint']) {
  test(`seat ${team}: ${interruption} during acquired pursuit preserves replacement or saved objective through recovery`, async () => {
    await journey(team, ({ r, actor, command, recover, finish, clear }) => {
      const target = r.units.find(u => u.team !== team && u.kind === 'worker');
      command('move', { x: 3.5, z: 2.5 }, target.id); r.drain();
      for (let t = 0; t < 800 && target.pathIndex < target.path.length; t++) r.step();
      command('setStance', { stance: 'aggressive' }); command('attackMove', { x: 6.5, z: .5 }); r.drain();
      for (let t = 0; t < 20 && actor().attackTargetId < 0; t++) r.step();
      assert.equal(actor().attackTargetId, target.id); assert.ok(actor().attackMoveResumePath);
      if (interruption === 'stop') {
        command('stop'); const position = { x: actor().x, z: actor().z };
        command('setStance', { stance: 'noAttack' }); recover();
        for (let t = 0; t < 40; t++) r.step();
        assert.deepEqual({ x: actor().x, z: actor().z }, position);
        assert.equal(actor().attackMoveResumePath, null); assert.equal(actor().attackMove, false);
        assert.equal(actor().attackTargetId, -1);
      } else {
        const navigation = r.navigationRevision;
        if (interruption === 'queuedMove') {
          command('move', { x: -3.5, z: -3.5, queue: true });
          assert.equal(actor().queuedWaypoints.length, 1);
        } else {
          command('build', { buildingType: 'palisade-wall', x: 2.5, z: .5 }, target.id);
          assert.ok(r.navigationRevision > navigation);
        }
        recover();
        let resumed = false;
        for (let t = 0; t < 700; t++) {
          r.step();
          if (actor().attackTargetId < 0 && actor().attackMove) resumed = true;
          if (actor().attackTargetId < 0) for (const s of r.landSteps.filter(s => s.id === actor().id)) {
            assert.ok(clear(s.from, s.to), `unsafe interrupted resumption ${JSON.stringify(s)}`);
          }
          const goal = interruption === 'queuedMove' ? { x: -3.5, z: -3.5 } : { x: 6.5, z: .5 };
          if (!actor().movePlanningPending && actor().pathIndex >= actor().path.length
            && Math.hypot(actor().x - goal.x, actor().z - goal.z) < .001) break;
        }
        assert.ok(resumed); finish(interruption === 'queuedMove' ? { x: -3.5, z: -3.5 } : undefined);
        if (interruption === 'queuedMove') {
          assert.equal(actor().attackMove, false); assert.equal(actor().queuedWaypoints.length, 0);
        }
      }
      return [target.id];
    });
  });
}
