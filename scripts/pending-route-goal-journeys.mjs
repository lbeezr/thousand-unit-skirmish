import assert from 'node:assert/strict';
import test from 'node:test';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';

process.env.RTS_MAP = 'maps/open-field.json';
process.env.RTS_GAME_MODE = 'pvp';
process.env.RTS_PREGAME = '0';
delete process.env.RTS_MATCH_STATE_PATH;
const map = { id: 'pending-route-goal', name: 'PENDING ROUTE GOAL', width: 64, height: 48,
  terrainSeed: 881, fogOfWar: false, startingArmySize: 12,
  startingResources: { food: 500, wood: 500 },
  spawnPoints: [{ team: 0, x: -20, z: -14 }, { team: 1, x: 20, z: 14 }],
  resourceNodes: [], obstacles: [], triggers: [], scenarioEvents: [] };

// Real command, planner, executor and checkpoint bodies in separate native
// modules. Timers/listening are disabled by the existing replay adapter.
for (const turns of [0, 1]) for (const team of [0, 1]) for (const recovery of [false, true]) {
  test(`${turns} planner turns, seat ${team}: first pending route then queued Move${recovery ? ' across cold recovery' : ''}`, async () => {
    process.env.RTS_MOVE_PLANNING_TURNS_PER_TICK = String(turns);
    const original = await createPathingReplayFixture(map);
    let restored;
    try {
      const r = original.replay;
      for (const seat of [0, 1]) r.order(seat, { type: 'stop', ids: r.units.filter(u => u.team === seat).map(u => u.id) });
      const [follower, leader] = r.units.filter(u => u.team === team && u.kind === 'infantry');
      assert.ok(follower && leader);
      const sign = team ? -1 : 1;
      Object.assign(follower, { x: -12.5 * sign, z: .5 });
      Object.assign(leader, { x: 16.5 * sign, z: .5 });
      r.order(team, { type: 'follow', ids: [follower.id], unitGenerations: [follower.generation],
        targetId: leader.id, targetGeneration: leader.generation });
      for (let tick = 0; tick < 30 && !follower.movePlanningPending; tick++) r.step({ planningTurns: 0 });
      assert.equal(follower.movePlanningPending, true);
      assert.equal(follower.path.length, 0, 'first selected route has not published');
      const pending = r.planningJobs.flatMap(job => job.assignments).find(a => a.unit === follower);
      assert.ok(pending);
      const firstGoal = pending.destination;
      assert.equal(follower.moveGoalCell, firstGoal, 'accepted pending destination is durable before publication');
      const queueNotices = r.order(team, { type: 'move', queue: true, ids: [follower.id],
        unitGenerations: [follower.generation], x: 6.25 * sign, z: 8.75 });
      assert.ok(queueNotices.some(n => n.message === 'WAYPOINT QUEUED · 1 UNITS'));
      assert.equal(follower.persistentOrder, null, 'queued Move finishes the accepted leg without retaining the leader');
      assert.equal(follower.moveGoalCell, firstGoal);
      const queued = structuredClone(follower.queuedWaypoints[0]);
      const revision = follower.orderRevision, generation = follower.generation;
      let active = r;
      if (recovery) {
        const snapshot = JSON.parse(JSON.stringify(r.checkpoint()));
        assert.ok(r.validate(snapshot), 'the complete serialized checkpoint passes the real validator');
        restored = await createPathingReplayFixture(map);
        active = restored.replay;
        active.restore(snapshot);
        assert.equal(active.units[follower.id].moveGoalCell, firstGoal);
        assert.equal(active.units[follower.id].movePlanningPending, true);
        assert.deepEqual(active.units[follower.id].queuedWaypoints[0], queued);
      }
      const actor = active.units[follower.id];
      let sawFirstLeg = false;
      for (let tick = 0; tick < 600; tick++) {
        active.step();
        if (actor.moveGoalCell === firstGoal && actor.path.length > 0) sawFirstLeg = true;
        assert.equal(actor.generation, generation);
        assert.equal(actor.attackTargetId, -1);
        assert.equal(actor.attackBuildingTargetId, -1);
        if (actor.queuedWaypoints.length === 0 && !actor.movePlanningPending
          && actor.pathIndex === actor.path.length && actor.moveGoalCell === queued.destination
          && Math.hypot(actor.x - queued.point.x, actor.z - queued.point.z) < .02) break;
      }
      assert.ok(sawFirstLeg, 'the first pending leg executes before the queued destination');
      assert.equal(actor.moveGoalCell, queued.destination);
      assert.equal(actor.queuedWaypoints.length, 0);
      assert.equal(actor.movePlanningPending, false);
      assert.equal(actor.pathIndex, actor.path.length);
      assert.ok(Math.hypot(actor.x - queued.point.x, actor.z - queued.point.z) < .02);
      assert.ok(actor.orderRevision > revision, 'queue promotion still advances the accepted order revision');
    } finally {
      await restored?.dispose();
      await original.dispose();
      delete process.env.RTS_MOVE_PLANNING_TURNS_PER_TICK;
    }
  });
}
