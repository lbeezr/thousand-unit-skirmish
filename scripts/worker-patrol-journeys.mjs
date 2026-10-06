import assert from 'node:assert/strict';
import test from 'node:test';
import * as predicates from '../src/combat-movement.mjs';
import { activeLandMovementBodyRadius, activeMoveGoalPoint, createClearanceMoveGoalPoint,
  canTraverseStaticBodySegment } from '../src/unit-movement.mjs';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';
import { UNIT_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { combatDamage } from '../src/combat-rules.mjs';

test('Worker Patrol/objective body derives from existing target-free intent, including cargo', () => {
  const unit = { kind: 'worker', hp: 100, attackMove: true, persistentOrder: { type: 'patrol' },
    attackTargetId: -1, attackBuildingTargetId: -1, gatherNodeId: null, gatherForestCell: -1,
    buildingTargetId: null, movePlanningPending: true, cargo: .5, cargoType: 'food' };
  assert.equal(typeof predicates.workerPatrolObjectiveMovementActive, 'function');
  for (const override of [{}, { persistentOrder: null }, { attackMove: false }]) {
    const actor = { ...unit, ...override };
    assert.equal(predicates.workerPatrolObjectiveMovementActive(actor), true);
    assert.equal(activeLandMovementBodyRadius(actor), .18);
    assert.equal(predicates.patrolTravelMovementActive(actor), false);
    assert.equal(predicates.attackMoveObjectiveMovementActive(actor), false);
  }
  for (const override of [{ kind: 'infantry' }, { kind: 'sheep' }, { kind: 'skiff' }, { kind: 'unknown' },
    { hp: 0 }, { movementDomain: 'water' }, { holdingPosition: true },
    { attackTargetId: 0 }, { attackBuildingTargetId: 0 }, { stanceCombat: true }, { stanceReturning: true },
    { persistentOrder: { type: 'follow' } }, { persistentOrder: null, attackMove: false },
    { gatherNodeId: 'food' }, { gatherForestCell: 0 }, { gatherPhase: 'to-base' }, { buildingTargetId: 0 }]) {
    assert.equal(predicates.workerPatrolObjectiveMovementActive({ ...unit, ...override }), false, JSON.stringify(override));
  }
});

async function journey(team, turns, action, { food = false, combat = false } = {}) {
  process.env.RTS_MAP = 'maps/open-field.json'; process.env.RTS_GAME_MODE = 'pvp'; process.env.RTS_PREGAME = '0';
  process.env.RTS_MOVE_PLANNING_TURNS_PER_TICK = String(turns); delete process.env.RTS_MATCH_STATE_PATH;
  const map = { id: 'worker-patrol-journey', name: 'Worker Patrol Journey', width: 64, height: 48,
    terrainSeed: 881, fogOfWar: !combat, startingArmySize: 16, startingResources: { food: 800, wood: 2000 },
    spawnPoints: [{ team: 0, x: -20, z: -16 }, { team: 1, x: 20, z: 16 }],
    resourceNodes: food ? [{ id: 'food', type: 'food', x: -1.5, z: .5, stock: 24 }] : [],
    triggers: [], scenarioEvents: [], obstacles: [{ column: 33, row: 25, width: 1, height: 1, material: 'stone' }] };
  const original = await createPathingReplayFixture(map, { traceLandSteps: true, traceRouteRejoins: true, tracePatrolAcquiredSteps: combat });
  let r = original.replay, cold;
  try {
    for (const seat of [0, 1]) r.order(seat, { type: 'stop', ids: r.units.filter(u => u.team === seat).map(u => u.id) });
    const [id, leaderId, builderId] = r.units.filter(u => u.team === team && u.kind === 'worker').map(u => u.id);
    const actor = () => r.units[id], leader = () => r.units[leaderId];
    const command = (type, fields = {}, selected = id) => r.order(r.units[selected].team,
      { type, ids: [selected], unitGenerations: [r.units[selected].generation], ...fields });
    command('move', { x: .79, z: .95 }); command('move', { x: 6.5, z: .5 }, leaderId); r.drain();
    for (let t = 0; t < 1000 && [actor(), leader()].some(u => u.movePlanningPending || u.pathIndex < u.path.length); t++) r.step();
    assert.deepEqual([actor().x, actor().z], [.79, .95]);
    const untouched = r.units.filter(u => u.id !== id).map(u => [u.id, u.orderRevision, u.hp, u.cargo]);
    const clear = (from, to) => canTraverseStaticBodySegment(from, to, .18, 64, 48, r.isWalkable);
    assert.ok(clear(actor(), actor())); let steps = 0;
    const step = options => {
      r.step(options);
      for (const s of r.landSteps.filter(s => s.id === id)) {
        if (combat && s.patrolAcquired) {
          assert.equal(s.bodyRadius, .18);
          assert.ok(clear(s.from, s.to), 'actual acquired Worker Patrol step uses the shared static body');
        } else if (combat && actor().attackTargetId >= 0 && actor().persistentOrder?.type !== 'patrol') {
          assert.equal(activeLandMovementBodyRadius(actor()), 0, 'direct acquired Worker AttackMove retains its separate profile');
        } else assert.ok(clear(s.from, s.to), `unsafe Worker Patrol/objective/queued step ${JSON.stringify(s)}`);
        steps++;
      }
    };
    const until = (condition, options, limit = 900) => {
      for (let t = 0; t < limit && !condition(); t++) step(options);
      assert.ok(condition(), 'bounded actual Worker command arrival');
    };
    const recover = async () => {
      const saved = JSON.parse(JSON.stringify(r.checkpoint())); assert.ok(r.validate(structuredClone(saved)));
      await cold?.dispose(); cold = await createPathingReplayFixture(map, { traceLandSteps: true, traceRouteRejoins: true, tracePatrolAcquiredSteps: combat });
      r = cold.replay; r.restore(saved);
      const before = saved.state.units[id];
      assert.equal(actor().moveGoalCell, before.moveGoalCell); assert.deepEqual(actor().persistentOrder, before.persistentOrder);
      assert.equal(actor().orderRevision, before.orderRevision + Number(before.movePlanningPending));
      assert.equal(actor().cargo, before.cargo); assert.equal(actor().cargoType, before.cargoType);
      assert.deepEqual(actor().workIntent, before.workIntent); assert.deepEqual(actor().queuedWaypoints, before.queuedWaypoints);
      return saved;
    };
    const patrol = () => {
      const start = Math.floor(actor().z + 24) * 64 + Math.floor(actor().x + 32);
      assert.ok(command('patrol', { x: 6.5, z: .5 }).some(n => /PATROL/.test(n.message)));
      assert.deepEqual([actor().persistentOrder.start, actor().persistentOrder.end, actor().persistentOrder.leg], [start, 1574, 1]);
      assert.equal(actor().attackMove, true); assert.equal(actor().combatStance, null);
    };
    const phase = name => {
      if (name === 'accepted') return;
      assert.ok(actor().movePlanningPending); assert.equal(actor().moveGoalCell, 1574);
      if (name === 'active') { r.drain(); step(); assert.ok(actor().pathIndex < actor().path.length); }
    };
    const cycles = count => {
      let switches = 0, previous = actor().persistentOrder.leg;
      until(() => { const leg = actor().persistentOrder.leg;
        if (leg !== previous) { switches++; previous = leg; }
        return switches >= count;
      }, undefined, 1800);
    };
    const finish = () => until(() => !actor().movePlanningPending && actor().pathIndex >= actor().path.length
      && Math.hypot(actor().x + 3.5, actor().z + 3.5) < .001);
    const changed = await action({ r: () => r, id, leaderId, builderId, actor, leader, command, step, until,
      recover, patrol, phase, cycles, finish, steps: () => steps }) ?? [];
    assert.equal(actor().hp, 100); assert.equal(actor().attackTargetId, -1); assert.equal(actor().attackBuildingTargetId, -1);
    assert.deepEqual(r.units.filter(u => u.id !== id && !changed.includes(u.id)).map(u => [u.id, u.orderRevision, u.hp, u.cargo]),
      untouched.filter(u => !changed.includes(u[0])), 'no unselected Worker recruitment or foreign damage');
  } finally { await cold?.dispose(); await original.dispose(); }
}

for (const team of [0, 1]) for (const type of ['patrol', 'attackMove']) for (const ending of ['loss', 'kill']) {
  test(`seat ${team}: Worker ${type} acquired-target ${ending} keeps combat policy and resumes its saved objective after cold recovery`, async () => {
    await journey(team, 1, async ({ r, actor, command, until, recover, step, cycles }) => {
      command('move', { x: -8.5, z: -5.5 });
      until(() => !actor().movePlanningPending && actor().pathIndex >= actor().path.length);
      const targetId = r().units.find(u => u.team !== team && u.kind === 'worker').id;
      const target = () => r().units[targetId];
      command('move', { x: -5.5, z: -4.5 }, targetId);
      until(() => !target().movePlanningPending && target().pathIndex >= target().path.length);
      command('stop', {}, targetId);
      command(type, { x: 6.5, z: .5 });
      until(() => actor().attackTargetId === targetId);
      assert.equal(activeLandMovementBodyRadius(actor()), type === 'patrol' ? .18 : 0);
      assert.equal(predicates.workerPatrolObjectiveMovementActive(actor()), false);
      const goal = actor().moveGoalCell, anchor = [actor().attackMoveAnchorX, actor().attackMoveAnchorZ];
      const order = structuredClone(actor().persistentOrder), resume = [...actor().attackMoveResumePath];
      const resumeIndex = actor().attackMoveResumePathIndex;
      await recover();
      assert.equal(actor().attackTargetId, targetId); assert.equal(actor().moveGoalCell, goal);
      assert.deepEqual([actor().attackMoveAnchorX, actor().attackMoveAnchorZ], anchor);
      assert.deepEqual(actor().persistentOrder, order); assert.deepEqual(actor().attackMoveResumePath, resume);
      assert.equal(actor().attackMoveResumePathIndex, resumeIndex);
      if (ending === 'loss') {
        command('move', { x: 24.5, z: 16.5 }, targetId);
        until(() => actor().attackTargetId < 0, undefined, 1200);
        assert.ok(target().hp > 0);
        assert.equal(actor().moveGoalCell, goal); assert.equal(actor().path.at(-1), goal);
        assert.equal(actor().attackMoveResumePath, null);
        assert.deepEqual([actor().attackMoveAnchorX, actor().attackMoveAnchorZ], anchor);
        if (order) {
          assert.deepEqual({ ...actor().persistentOrder, nextTick: order.nextTick }, order);
          assert.ok(actor().persistentOrder.nextTick >= order.nextTick, 'existing Patrol timer continues while pursuing');
        } else assert.equal(actor().persistentOrder, null);
        await recover(); assert.equal(actor().attackTargetId, -1);
        assert.equal(actor().moveGoalCell, goal); assert.equal(activeLandMovementBodyRadius(actor()), .18);
        // A still-visible fleeing target can be acquired again under the unchanged
        // policy. This control proves the real loss/resume boundary, not peaceful arrival.
        return [targetId];
      } else {
        let hits = 0;
        for (let t = 0; t < 1600 && target().hp > 0; t++) {
          const hp = target().hp, distance = Math.hypot(actor().x - target().x, actor().z - target().z);
          step();
          if (target().hp < hp) {
            assert.ok(distance <= UNIT_DEFINITIONS.worker.combat.range + 1e-8);
            assert.equal(hp - target().hp, Math.min(hp, combatDamage(UNIT_DEFINITIONS.worker, UNIT_DEFINITIONS.worker)));
            hits++;
          }
        }
        assert.equal(target().hp, 0); assert.ok(hits > 0); until(() => actor().attackTargetId < 0);
      }
      assert.equal(actor().attackMove, true); assert.equal(activeLandMovementBodyRadius(actor()), .18);
      assert.deepEqual([actor().attackMoveAnchorX, actor().attackMoveAnchorZ], anchor);
      if (type === 'patrol') { assert.deepEqual([actor().persistentOrder.start, actor().persistentOrder.end], [order.start, order.end]); cycles(2); }
      else { until(() => !actor().movePlanningPending && actor().pathIndex >= actor().path.length); assert.deepEqual([actor().x, actor().z], [6.5, .5]); }
      return [targetId];
    }, { combat: true });
  });
}

for (const team of [0, 1]) for (const turns of [0, 1]) for (const recovery of ['accepted', 'pending', 'active']) {
  test(`seat ${team}, mode ${turns}: Worker Patrol contact-free endpoint cycling through ${recovery} cold recovery`, async () => {
    await journey(team, turns, async ({ actor, patrol, phase, recover, cycles, steps }) => {
      patrol(); phase(recovery); const order = structuredClone(actor().persistentOrder);
      await recover(); cycles(2);
      assert.deepEqual([actor().persistentOrder.start, actor().persistentOrder.end], [order.start, order.end]);
      assert.equal(actor().attackMove, true); assert.equal(actor().persistentOrder.leg, order.leg);
      assert.equal(activeLandMovementBodyRadius(actor()), .18); assert.ok(steps() > 0);
    });
  });
}

for (const team of [0, 1]) for (const turns of [0, 1]) for (const phaseName of ['pending', 'active']) {
  test(`seat ${team}, mode ${turns}: queued Move cancels ${phaseName} Patrol while preserving its objective leg and cold completion`, async () => {
    await journey(team, turns, async ({ r, actor, command, patrol, phase, recover, until, finish, steps }) => {
      patrol(); phase(phaseName);
      const goal = actor().moveGoalCell, revision = actor().orderRevision, path = actor().path, index = actor().pathIndex;
      const jobs = r().planningJobs;
      assert.ok(command('move', { x: -3.5, z: -3.5, queue: true }).some(n => /WAYPOINT QUEUED/.test(n.message)));
      assert.equal(actor().persistentOrder, null); assert.equal(actor().attackMove, true);
      assert.equal(actor().moveGoalCell, goal); assert.equal(actor().orderRevision, revision);
      assert.equal(actor().path, path); assert.equal(actor().pathIndex, index); assert.deepEqual(r().planningJobs, jobs);
      for (const [i, job] of r().planningJobs.entries()) assert.equal(job, jobs[i]);
      assert.equal(actor().moveGoalPoint, null); assert.equal(activeLandMovementBodyRadius(actor()), .18);
      assert.equal(actor().queuedWaypoints.length, 1); await recover(); const restoredRevision = actor().orderRevision;
      until(() => actor().queuedWaypoints.length === 0); assert.equal(actor().attackMove, false);
      assert.ok(activeMoveGoalPoint(actor())); finish(); assert.equal(actor().persistentOrder, null);
      assert.equal(actor().queuedWaypoints.length, 0); assert.equal(actor().orderRevision, restoredRevision + 1);
      assert.ok(steps() > 0);
    });
  });
}

for (const team of [0, 1]) for (const phaseName of ['pending', 'active']) for (const replacement of ['stop', 'holdPosition', 'move']) {
  test(`seat ${team}: ${replacement} explicitly replaces ${phaseName} Worker Patrol across cold recovery`, async () => {
    await journey(team, 0, async ({ actor, command, patrol, phase, recover, step, finish }) => {
      patrol(); phase(phaseName); command(replacement, replacement === 'move' ? { x: -3.5, z: -3.5 } : {});
      assert.equal(actor().persistentOrder, null); assert.equal(actor().attackMove, false);
      assert.equal(actor().queuedWaypoints.length, 0); await recover();
      if (replacement === 'move') finish();
      else { const position = [actor().x, actor().z]; for (let t = 0; t < 90; t++) step(); assert.deepEqual([actor().x, actor().z], position); }
    });
  });
}

for (const team of [0, 1]) {
  test(`seat ${team}: exhausted Patrol queued Move preserves the existing AttackMove queue-completion window`, async () => {
    await journey(team, 0, async ({ actor, command, patrol, phase, until, recover, finish }) => {
      patrol(); phase('active'); until(() => !actor().movePlanningPending && actor().pathIndex >= actor().path.length);
      const revision = actor().orderRevision; command('move', { x: -3.5, z: -3.5, queue: true });
      assert.equal(actor().persistentOrder, null); assert.equal(actor().attackMove, true);
      assert.equal(actor().orderRevision, revision); assert.equal(actor().queuedWaypoints.length, 1);
      assert.equal(actor().moveGoalCell, 1574); await recover(); finish();
      assert.equal(actor().attackMove, false); assert.equal(actor().queuedWaypoints.length, 0);
    });
  });
  test(`seat ${team}: validator-accepted Patrol with legacy false AttackMove flag keeps its body and endpoint cycle`, async () => {
    await journey(team, 0, async ({ r, actor, patrol, phase, cycles }) => {
      patrol(); phase('active'); const saved = JSON.parse(JSON.stringify(r().checkpoint()));
      // Existing validator-accepted flag compatibility; only the saved flag changes.
      saved.state.units[actor().id].attackMove = false; assert.ok(r().validate(structuredClone(saved)));
      r().restore(saved); assert.equal(actor().attackMove, false); cycles(2);
      assert.equal(actor().attackMove, false); assert.equal(activeLandMovementBodyRadius(actor()), .18);
    });
  });
  test(`seat ${team}: direct target-free Worker AttackMove uses the same objective body through pending cold recovery`, async () => {
    await journey(team, 1, async ({ actor, command, recover, until, steps }) => {
      assert.ok(command('attackMove', { x: 6.5, z: .5 }).some(n => /ATTACK MOVE/.test(n.message)));
      assert.equal(actor().persistentOrder, null); assert.equal(actor().attackMove, true);
      await recover(); until(() => !actor().movePlanningPending && actor().pathIndex >= actor().path.length);
      assert.deepEqual([actor().x, actor().z], [6.5, .5]); assert.equal(actor().moveGoalCell, 1574);
      assert.equal(actor().attackMove, true); assert.equal(actor().moveGoalPoint, null); assert.ok(steps() > 0);
    });
  });
  test(`seat ${team}: queued AttackMove preserves its original objective flag after Patrol cancellation`, async () => {
    await journey(team, 0, async ({ actor, command, patrol, phase, recover, finish }) => {
      patrol(); phase('pending'); command('attackMove', { x: -3.5, z: -3.5, queue: true });
      assert.equal(actor().persistentOrder, null); assert.equal(actor().attackMove, true);
      assert.deepEqual(actor().queuedWaypoints, [{ destination: 1308, attackMove: true }]);
      await recover(); finish(); assert.equal(actor().attackMove, true);
      assert.equal(actor().moveGoalPoint, null); assert.equal(activeLandMovementBodyRadius(actor()), .18);
    });
  });
  test(`seat ${team}: paid dynamic obstruction repairs Worker Patrol without replacing its endpoints`, async () => {
    await journey(team, 1, async ({ r, actor, builderId, command, patrol, phase, recover, cycles }) => {
      patrol(); phase('active'); const order = structuredClone(actor().persistentOrder), wood = r().wood[team];
      assert.ok(command('build', { buildingType: 'palisade-wall', x: 2.5, z: .5 }, builderId).some(n => /PLACED/.test(n.message)));
      command('stop', {}, builderId); const paid = r().wood[team]; assert.ok(paid < wood);
      await recover(); cycles(2); assert.deepEqual([actor().persistentOrder.start, actor().persistentOrder.end], [order.start, order.end]);
      assert.equal(r().wood[team], paid); assert.ok(r().buildings.some(b => b.team === team && b.type === 'palisade-wall'));
      return [builderId];
    });
  });
  test(`seat ${team}: explicit Patrol clears replaced gather work, preserves natural cargo and credits Return once`, async () => {
    await journey(team, 1, async ({ r, actor, command, patrol, recover, cycles, finish, until }) => {
      assert.ok(command('gather', { nodeId: 'food' }).some(n => /GATHER/.test(n.message)));
      until(() => actor().cargo >= .5); assert.ok(actor().workIntent); const cargo = actor().cargo;
      const stock = r().resources.get('food').stock, bank = r().food[team];
      patrol(); assert.equal(actor().workIntent, null); assert.equal(actor().gatherNodeId, null); assert.equal(actor().gatherPhase, '');
      assert.equal(actor().cargo, cargo); await recover(); cycles(2); command('move', { x: -3.5, z: -3.5 }); await recover(); finish();
      assert.equal(actor().cargo, cargo); assert.equal(actor().cargoType, 'food'); assert.equal(r().resources.get('food').stock, stock);
      assert.equal(r().food[team], bank); assert.equal(actor().workIntent, null);
      assert.ok(command('returnCargo').some(n => /RETURN CARGO ORDER/.test(n.message))); await recover();
      until(() => actor().cargo === 0, undefined, 1600); assert.ok(Math.abs(r().food[team] - bank - cargo) < 1e-8);
      assert.equal(r().resources.get('food').stock, stock); assert.equal(actor().workIntent, null);
    }, { food: true });
  });
  test(`seat ${team}: paid construction replaced by Patrol retains its paid unfinished site through recovery`, async () => {
    await journey(team, 0, async ({ r, actor, command, patrol, recover, cycles }) => {
      const wood = r().wood[team]; assert.ok(command('build', { buildingType: 'house', x: -7.5, z: -5.5 }).some(n => /PLACED/.test(n.message)));
      const site = r().buildings.find(b => b.team === team && b.type === 'house'), paid = r().wood[team];
      assert.ok(site); assert.ok(paid < wood); assert.equal(actor().buildingTargetId, site.id); assert.ok(actor().workIntent);
      patrol(); assert.equal(actor().buildingTargetId, null); assert.equal(actor().workIntent, null); await recover(); cycles(2);
      const retained = r().buildings.find(b => b.id === site.id); assert.ok(retained); assert.equal(retained.complete, false);
      assert.equal(r().wood[team], paid); assert.equal(actor().workIntent, null);
    });
  });
  test(`seat ${team}: invalid and foreign Patrol replacements retain selected intent without recruitment`, async () => {
    await journey(team, 0, ({ r, actor, command, patrol }) => {
      patrol(); const before = structuredClone(actor());
      assert.ok(command('patrol', { x: NaN, z: .5 }).some(n => /INVALID DESTINATION/.test(n.message)));
      assert.deepEqual(actor(), before);
      const foreign = r().units.find(u => u.team !== team && u.kind === 'worker'), other = structuredClone(foreign);
      r().order(team, { type: 'patrol', ids: [foreign.id], unitGenerations: [foreign.generation], x: 6.5, z: .5 });
      assert.deepEqual(foreign, other); assert.deepEqual(actor(), before);
    });
  });
}
