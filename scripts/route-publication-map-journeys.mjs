import assert from 'node:assert/strict';
import test from 'node:test';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';

process.env.RTS_MAP = 'maps/open-field.json';
process.env.RTS_GAME_MODE = 'pvp';
process.env.RTS_PREGAME = '0';
delete process.env.RTS_MATCH_STATE_PATH;
// Real <=256 planner/publication/execution and complete checkpoint bodies.
// Custom authored replay grids do not qualify ordinary map admission or pixels.
for (const [width, height] of [[16, 17], [160, 160], [256, 256]]) for (const team of [0, 1]) {
  test(`${width}x${height}, seat ${team}: queued fractional Move executes through cold recovery`, async () => {
    process.env.RTS_MOVE_PLANNING_TURNS_PER_TICK = '0';
    const map = { id: `publication-${width}-${height}`, name: 'PUBLICATION COMPATIBILITY', width, height,
      terrainSeed: 881, fogOfWar: false, startingArmySize: 12,
      spawnPoints: [{ team: 0, x: -5.5, z: -5.5 }, { team: 1, x: 5.5, z: 5.5 }],
      resourceNodes: [], obstacles: [], triggers: [], scenarioEvents: [] };
    const original = await createPathingReplayFixture(map);
    let recovered;
    try {
      const r = original.replay;
      for (const seat of [0, 1]) r.order(seat, { type: 'stop', ids: r.units.filter(u => u.team === seat).map(u => u.id) });
      const actor = r.units.find(u => u.team === team && u.kind === 'infantry');
      const order = fields => r.order(team, { type: 'move', ids: [actor.id], unitGenerations: [actor.generation], ...fields });
      order({ x: .25, z: .75 });
      assert.equal(actor.movePlanningPending, true);
      const firstGoal = actor.moveGoalCell;
      order({ queue: true, x: 1.25, z: -1.25 });
      const queued = structuredClone(actor.queuedWaypoints[0]);
      const saved = JSON.parse(JSON.stringify(r.checkpoint()));
      assert.ok(r.validate(saved));
      recovered = await createPathingReplayFixture(map);
      const next = recovered.replay;
      next.restore(saved);
      const current = next.units[actor.id];
      assert.equal(current.moveGoalCell, firstGoal);
      assert.deepEqual(current.queuedWaypoints[0], queued);
      let sawFirstPoint = false;
      for (let tick = 0; tick < 600; tick++) {
        next.step();
        if (Math.hypot(current.x - .25, current.z - .75) < .02) sawFirstPoint = true;
        assert.equal(current.generation, actor.generation);
        assert.ok(next.isWalkable(next.cell(current.x, current.z)));
        if (current.queuedWaypoints.length === 0 && !current.movePlanningPending
          && current.pathIndex === current.path.length && Math.hypot(current.x - 1.25, current.z + 1.25) < .02) break;
      }
      assert.ok(sawFirstPoint, 'first fractional arrival precedes queued travel');
      assert.equal(current.moveGoalCell, queued.destination);
      assert.equal(current.queuedWaypoints.length, 0);
      assert.equal(current.movePlanningPending, false);
      assert.equal(current.pathIndex, current.path.length);
      assert.ok(Math.hypot(current.x - 1.25, current.z + 1.25) < .02);
      assert.equal(next.planningJobs.length, 0);
    } finally {
      await recovered?.dispose();
      await original.dispose();
      delete process.env.RTS_MOVE_PLANNING_TURNS_PER_TICK;
    }
  });
}
