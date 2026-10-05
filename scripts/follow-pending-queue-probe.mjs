// Characterize a retained core pending-goal dependency; successful execution
// means the observations were collected, not that queued recovery passed.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';
process.env.RTS_MAP = 'maps/open-field.json'; process.env.RTS_GAME_MODE = 'pvp';
process.env.RTS_PREGAME = '0'; process.env.RTS_MOVE_PLANNING_TURNS_PER_TICK = '0';
delete process.env.RTS_MATCH_STATE_PATH;
const map = { id: 'follow-pending-queue-probe', name: 'Follow Pending Queue Probe', width: 64, height: 48,
  terrainSeed: 881, fogOfWar: false, startingArmySize: 16,
  spawnPoints: [{ team: 0, x: -20, z: -16 }, { team: 1, x: 20, z: 16 }],
  resourceNodes: [], triggers: [], scenarioEvents: [], obstacles: [] };
const records = [];
for (const team of [0, 1]) {
  const fixture = await createPathingReplayFixture(map), r = fixture.replay;
  try {
    for (const seat of [0, 1]) {
      const units = r.units.filter(u => u.team === seat);
      r.order(seat, { type: 'stop', ids: units.map(u => u.id) });
    }
    const id = r.units.find(u => u.team === team && u.kind === 'infantry').id;
    const leader = r.units.find(u => u.team === team && u.kind === 'worker');
    const command = (selected, type, fields) => r.order(team,
      { type, ids: [selected.id], unitGenerations: [selected.generation], ...fields });
    command(r.units[id], 'move', { x: .75, z: .95 }); command(leader, 'move', { x: 6.5, z: .5 }); r.drain();
    for (let t = 0; t < 800 && [r.units[id], leader].some(u => u.pathIndex < u.path.length); t++) r.step();
    assert.deepEqual([r.units[id].x, r.units[id].z], [.75, .95]);
    command(r.units[id], 'follow', { targetId: leader.id, targetGeneration: leader.generation });
    for (let t = 0; t < 60 && !r.units[id].movePlanningPending; t++) r.step({ planningTurns: 0 });
    assert.equal(r.units[id].movePlanningPending, true);
    const pendingGoal = r.units[id].moveGoalCell;
    const notices = command(r.units[id], 'move', { x: -3.5, z: -3.5, queue: true });
    const saved = r.checkpoint(); assert.ok(r.validate(structuredClone(saved))); r.restore(structuredClone(saved));
    const afterRestore = { pending: r.units[id].movePlanningPending, goal: r.units[id].moveGoalCell,
      persistentOrder: r.units[id].persistentOrder, queued: structuredClone(r.units[id].queuedWaypoints) };
    for (let t = 0; t < 600; t++) r.step();
    const u = r.units[id]; records.push({ team, id, notices, pendingGoal, afterRestore,
      final: { x: u.x, z: u.z, goal: u.moveGoalCell, pending: u.movePlanningPending,
        queued: structuredClone(u.queuedWaypoints), path: [...u.path] },
      queuedMoveCompleted: Math.hypot(u.x + 3.5, u.z + 3.5) < .001 });
  } finally { await fixture.dispose(); }
}
console.log(JSON.stringify({ source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  dirty: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim() !== '', records }));
