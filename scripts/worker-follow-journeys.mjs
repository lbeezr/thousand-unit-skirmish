import assert from 'node:assert/strict';
import test from 'node:test';
import * as predicates from '../src/combat-movement.mjs';
import { activeLandMovementBodyRadius, activeMoveGoalPoint, createClearanceMoveGoalPoint,
  canTraverseStaticBodySegment } from '../src/unit-movement.mjs';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';

test('Worker Follow body derives only from its accepted target-free land intent', () => {
  const unit = { kind: 'worker', hp: 100, persistentOrder: { type: 'follow' },
    attackTargetId: -1, attackBuildingTargetId: -1, gatherNodeId: null, gatherForestCell: -1,
    buildingTargetId: null, movePlanningPending: true, cargo: .5, cargoType: 'food' };
  assert.equal(typeof predicates.workerFollowTravelMovementActive, 'function');
  assert.equal(predicates.workerFollowTravelMovementActive(unit), true);
  assert.equal(predicates.followTravelMovementActive(unit), false, 'military eligibility is unchanged');
  assert.equal(activeLandMovementBodyRadius(unit), .18, 'carried cargo does not hide explicit Follow');
  for (const override of [{ kind: 'infantry' }, { kind: 'sheep' }, { kind: 'skiff' }, { hp: 0 },
    { movementDomain: 'water' }, { holdingPosition: true }, { attackMove: true },
    { attackTargetId: 0 }, { attackBuildingTargetId: 0 }, { stanceCombat: true }, { stanceReturning: true },
    { persistentOrder: null }, { persistentOrder: { type: 'patrol' } }, { gatherNodeId: 'food' },
    { gatherForestCell: 0 }, { gatherPhase: 'to-base' }, { buildingTargetId: 0 }]) {
    assert.equal(predicates.workerFollowTravelMovementActive({ ...unit, ...override }), false, JSON.stringify(override));
  }
});

async function journey(team, turns, action, { food = false } = {}) {
  process.env.RTS_MAP = 'maps/open-field.json'; process.env.RTS_GAME_MODE = 'pvp'; process.env.RTS_PREGAME = '0';
  process.env.RTS_MOVE_PLANNING_TURNS_PER_TICK = String(turns); delete process.env.RTS_MATCH_STATE_PATH;
  const map = { id: 'worker-follow-journey', name: 'Worker Follow Journey', width: 64, height: 48,
    terrainSeed: 881, fogOfWar: true, startingArmySize: 16, startingResources: { food: 800, wood: 2000 },
    spawnPoints: [{ team: 0, x: -20, z: -16 }, { team: 1, x: 20, z: 16 }],
    resourceNodes: food ? [{ id: 'food', type: 'food', x: -1.5, z: .5, stock: 24 }] : [],
    triggers: [], scenarioEvents: [], obstacles: [{ column: 33, row: 25, width: 1, height: 1, material: 'stone' }] };
  const original = await createPathingReplayFixture(map, { traceLandSteps: true, traceRouteRejoins: true });
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
        assert.ok(clear(s.from, s.to), `unsafe Worker Follow/converted Move step ${JSON.stringify(s)}`); steps++;
      }
    };
    const until = (condition, options, limit = 900) => {
      for (let t = 0; t < limit && !condition(); t++) step(options);
      assert.ok(condition(), 'bounded actual Worker command arrival');
    };
    const recover = async () => {
      const saved = JSON.parse(JSON.stringify(r.checkpoint())); assert.ok(r.validate(structuredClone(saved)));
      await cold?.dispose(); cold = await createPathingReplayFixture(map, { traceLandSteps: true, traceRouteRejoins: true });
      r = cold.replay; r.restore(saved);
      const before = saved.state.units[id];
      assert.equal(actor().moveGoalCell, before.moveGoalCell); assert.deepEqual(actor().persistentOrder, before.persistentOrder);
      assert.equal(actor().orderRevision, before.orderRevision + Number(before.movePlanningPending));
      assert.equal(actor().cargo, before.cargo); assert.equal(actor().cargoType, before.cargoType);
      assert.deepEqual(actor().workIntent, before.workIntent); assert.deepEqual(actor().queuedWaypoints, before.queuedWaypoints);
      return saved;
    };
    const follow = () => {
      assert.ok(command('follow', { targetId: leaderId, targetGeneration: leader().generation }).some(n => /FOLLOW ORDER/.test(n.message)));
      assert.equal(actor().persistentOrder.targetId, leaderId); assert.equal(actor().persistentOrder.targetGeneration, leader().generation);
      assert.equal(actor().attackMove, false); assert.equal(actor().combatStance, null);
    };
    const phase = name => {
      if (name === 'accepted') return;
      until(() => actor().movePlanningPending, { planningTurns: 0 });
      assert.equal(actor().moveGoalCell, team ? 1640 : 1576, 'original ID offset selects the same cell');
      if (name === 'active') { r.drain(); step(); assert.ok(actor().pathIndex < actor().path.length); }
    };
    const settle = () => until(() => Math.hypot(leader().x - actor().x, leader().z - actor().z) <= 4
      && !actor().movePlanningPending && actor().pathIndex >= actor().path.length);
    const finish = () => until(() => !actor().movePlanningPending && actor().pathIndex >= actor().path.length
      && Math.hypot(actor().x + 3.5, actor().z + 3.5) < .001);
    const changed = await action({ r: () => r, id, leaderId, builderId, actor, leader, command, step, until,
      recover, follow, phase, settle, finish, steps: () => steps }) ?? [];
    assert.equal(actor().hp, 100); assert.equal(actor().attackTargetId, -1); assert.equal(actor().attackBuildingTargetId, -1);
    assert.deepEqual(r.units.filter(u => u.id !== id && !changed.includes(u.id)).map(u => [u.id, u.orderRevision, u.hp, u.cargo]),
      untouched.filter(u => !changed.includes(u[0])), 'no unselected Worker recruitment or foreign damage');
  } finally { await cold?.dispose(); await original.dispose(); }
}

for (const team of [0, 1]) for (const turns of [0, 1]) for (const recovery of ['accepted', 'pending', 'active']) {
  test(`seat ${team}, mode ${turns}: Worker Follow contact and arrival through ${recovery} cold recovery`, async () => {
    await journey(team, turns, async ({ actor, follow, phase, recover, settle, step, steps }) => {
      follow(); phase(recovery); const goal = actor().moveGoalCell; await recover(); settle();
      if (goal >= 0) assert.equal(actor().moveGoalCell, goal);
      assert.equal(activeLandMovementBodyRadius(actor()), .18); assert.ok(steps() > 0);
      const revision = actor().orderRevision, position = [actor().x, actor().z];
      for (let t = 0; t < 90; t++) step();
      assert.equal(actor().orderRevision, revision); assert.deepEqual([actor().x, actor().z], position);
      assert.equal(actor().persistentOrder.type, 'follow');
    });
  });
}

for (const team of [0, 1]) for (const turns of [0, 1]) for (const phaseName of ['pending', 'active']) {
  test(`seat ${team}, mode ${turns}: queued Move preserves the ${phaseName} Worker catch-up then arrives after cold recovery`, async () => {
    await journey(team, turns, async ({ r, actor, command, follow, phase, recover, until, finish, steps }) => {
      follow(); phase(phaseName);
      const goal = actor().moveGoalCell, revision = actor().orderRevision, path = actor().path, index = actor().pathIndex;
      const jobs = r().planningJobs;
      command('move', { x: -3.5, z: -3.5, queue: true });
      assert.equal(actor().persistentOrder, null); assert.equal(actor().moveGoalCell, goal); assert.equal(actor().orderRevision, revision);
      assert.equal(actor().path, path); assert.equal(actor().pathIndex, index); assert.deepEqual(r().planningJobs, jobs);
      for (const [i, job] of r().planningJobs.entries()) assert.equal(job, jobs[i], 'accepted planning job object is retained');
      assert.equal(activeMoveGoalPoint(actor())?.cell, goal); assert.equal(activeLandMovementBodyRadius(actor()), .18);
      assert.equal(actor().queuedWaypoints.length, 1); await recover();
      until(() => actor().path.length > 0); assert.equal(actor().moveGoalCell, goal); assert.equal(actor().queuedWaypoints.length, 1);
      const restoredRevision = actor().orderRevision; finish();
      assert.equal(actor().queuedWaypoints.length, 0); assert.equal(actor().persistentOrder, null);
      assert.equal(actor().orderRevision, restoredRevision + 1); assert.ok(steps() > 0);
    });
  });
}

for (const team of [0, 1]) for (const phaseName of ['pending', 'active']) for (const replacement of ['stop', 'holdPosition', 'move']) {
  test(`seat ${team}: ${replacement} explicitly replaces ${phaseName} Worker Follow across cold recovery`, async () => {
    await journey(team, 0, async ({ actor, command, follow, phase, recover, step, finish }) => {
      follow(); phase(phaseName); command(replacement, replacement === 'move' ? { x: -3.5, z: -3.5 } : {});
      assert.equal(actor().persistentOrder, null); assert.equal(actor().queuedWaypoints.length, 0); await recover();
      if (replacement === 'move') finish();
      else { const position = [actor().x, actor().z]; for (let t = 0; t < 90; t++) step(); assert.deepEqual([actor().x, actor().z], position); }
      assert.equal(actor().persistentOrder, null);
    });
  });
}

for (const team of [0, 1]) {
  for (const state of ['idle', 'exhausted']) test(`seat ${team}: queued Move replaces ${state} Worker Follow without an extra catch-up`, async () => {
    await journey(team, 0, async ({ actor, command, follow, settle, recover, finish }) => {
      follow(); if (state === 'exhausted') settle();
      assert.equal(actor().movePlanningPending, false); assert.ok(actor().pathIndex >= actor().path.length);
      const revision = actor().orderRevision; command('move', { x: -3.5, z: -3.5, queue: true });
      assert.equal(actor().orderRevision, revision + 1); assert.equal(actor().persistentOrder, null);
      assert.equal(actor().queuedWaypoints.length, 0); assert.equal(actor().moveGoalCell, 1308);
      assert.deepEqual([actor().moveGoalPoint.requestedX, actor().moveGoalPoint.requestedZ], [-3.5, -3.5]);
      await recover(); finish();
    });
  });
  test(`seat ${team}: paid dynamic obstruction repairs Worker Follow with the same leader`, async () => {
    await journey(team, 1, async ({ r, actor, builderId, leaderId, command, follow, phase, recover, settle }) => {
      follow(); phase('active'); const wood = r().wood[team], navigation = r().navigationRevision;
      assert.ok(command('build', { buildingType: 'palisade-wall', x: 2.5, z: .5 }, builderId).some(n => /PLACED/.test(n.message)));
      command('stop', {}, builderId); const paid = r().wood[team]; assert.ok(paid < wood); assert.ok(r().navigationRevision > navigation);
      await recover(); settle(); assert.equal(actor().persistentOrder.targetId, leaderId); assert.equal(r().wood[team], paid);
      assert.ok(r().buildings.some(b => b.team === team && b.type === 'palisade-wall')); return [builderId];
    });
  });
  test(`seat ${team}: a moving leader keeps Worker Follow generation and bounded replanning through cold recovery`, async () => {
    await journey(team, 1, async ({ actor, leader, leaderId, command, follow, phase, step, recover, settle }) => {
      follow(); phase('active'); const goal = actor().moveGoalCell, generation = leader().generation;
      command('move', { x: 12.5, z: -3.5 }, leaderId); for (let t = 0; t < 45; t++) step();
      await recover(); settle(); assert.notEqual(actor().moveGoalCell, goal);
      assert.equal(actor().persistentOrder.targetId, leaderId); assert.equal(actor().persistentOrder.targetGeneration, generation);
      return [leaderId];
    });
  });
  test(`seat ${team}: rejected Worker Follow replacements preserve the accepted selected intent`, async () => {
    await journey(team, 0, ({ r, id, actor, leader, leaderId, command, follow }) => {
      follow(); const before = structuredClone(actor()), foreign = r().units.find(u => u.team !== team && u.kind === 'worker');
      for (const fields of [{ targetId: foreign.id, targetGeneration: foreign.generation },
        { targetId: leaderId, targetGeneration: leader().generation + 1 }, { targetId: 99999, targetGeneration: 1 }]) {
        assert.ok(command('follow', fields).some(n => /REJECTED/.test(n.message))); assert.deepEqual(actor(), before);
      }
      assert.ok(command('follow', { targetId: id, targetGeneration: actor().generation }, leaderId).some(n => /FOLLOW CYCLE/.test(n.message)));
      assert.deepEqual(actor(), before);
    });
  });
  test(`seat ${team}: queued Worker AttackMove preserves its original policy after the cleared Follow catch-up`, async () => {
    await journey(team, 0, async ({ actor, command, follow, phase, recover, until }) => {
      follow(); phase('pending'); const goal = actor().moveGoalCell, revision = actor().orderRevision;
      command('attackMove', { x: -3.5, z: -3.5, queue: true });
      assert.equal(actor().persistentOrder, null); assert.equal(actor().attackMove, false);
      assert.equal(actor().moveGoalCell, goal); assert.equal(actor().orderRevision, revision);
      assert.equal(activeLandMovementBodyRadius(actor()), .18); assert.deepEqual(actor().queuedWaypoints, [{ destination: 1308, attackMove: true }]);
      await recover(); until(() => actor().attackMove);
      assert.equal(actor().queuedWaypoints.length, 0); assert.equal(actor().moveGoalPoint, null);
      assert.equal(activeLandMovementBodyRadius(actor()), .18, 'the separately adopted target-free Worker objective retains its original policy');
      command('stop'); await recover(); assert.equal(actor().persistentOrder, null);
    });
  });
  test(`seat ${team}: Worker queued catch-up preserves an API-authored valid point`, async () => {
    await journey(team, 0, async ({ r, actor, command, follow, phase, recover, finish }) => {
      follow(); phase('pending'); const goal = actor().moveGoalCell, center = r().point(goal);
      const point = createClearanceMoveGoalPoint(actor(), center.x + .1, center.z, goal, 64, 48, r().isWalkable);
      // Isolated point-preservation boundary; no pose, route or job is changed.
      actor().moveGoalPoint = point; command('move', { x: -3.5, z: -3.5, queue: true });
      assert.equal(actor().moveGoalPoint, point); assert.equal(activeMoveGoalPoint(actor()), point); await recover(); finish();
    });
  });
  test(`seat ${team}: explicit Follow cancels productive gather intent but preserves naturally gathered cargo`, async () => {
    await journey(team, 1, async ({ r, actor, command, follow, recover, settle, finish, until }) => {
      assert.ok(command('gather', { nodeId: 'food' }).some(n => /GATHER/.test(n.message)));
      until(() => actor().cargo >= .5); assert.ok(actor().workIntent); assert.equal(actor().gatherPhase, 'gathering');
      const cargo = actor().cargo, stock = r().resources.get('food').stock, bank = r().food[team];
      follow(); assert.equal(actor().workIntent, null); assert.equal(actor().gatherNodeId, null); assert.equal(actor().gatherPhase, '');
      assert.equal(actor().cargo, cargo); await recover(); settle(); command('move', { x: -3.5, z: -3.5 }); await recover(); finish();
      assert.equal(actor().cargo, cargo); assert.equal(actor().cargoType, 'food'); assert.equal(r().resources.get('food').stock, stock);
      assert.equal(r().food[team], bank); assert.equal(actor().workIntent, null); assert.equal(actor().persistentOrder, null);
      assert.ok(command('returnCargo').some(n => /RETURN CARGO ORDER/.test(n.message))); await recover();
      until(() => actor().cargo === 0, undefined, 1600); assert.ok(Math.abs(r().food[team] - bank - cargo) < 1e-8);
      assert.equal(r().resources.get('food').stock, stock); assert.equal(actor().workIntent, null);
    }, { food: true });
  });
  test(`seat ${team}: paid construction replaced by Follow keeps its paid site through cold recovery`, async () => {
    await journey(team, 0, async ({ r, actor, command, follow, recover, settle }) => {
      const wood = r().wood[team]; assert.ok(command('build', { buildingType: 'house', x: -7.5, z: -5.5 }).some(n => /PLACED/.test(n.message)));
      const site = r().buildings.find(b => b.team === team && b.type === 'house'); assert.ok(site); const paid = r().wood[team]; assert.ok(paid < wood);
      assert.equal(actor().buildingTargetId, site.id); assert.ok(actor().workIntent);
      follow(); assert.equal(actor().buildingTargetId, null); assert.equal(actor().workIntent, null); await recover(); settle();
      const retained = r().buildings.find(b => b.id === site.id); assert.ok(retained); assert.equal(retained.complete, false);
      assert.equal(r().wood[team], paid); assert.equal(actor().buildingTargetId, null); assert.equal(actor().workIntent, null);
    });
  });
}
