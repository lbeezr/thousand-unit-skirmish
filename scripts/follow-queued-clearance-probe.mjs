// Reporter success means collected observations, not physical acceptance.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';
import { activeLandMovementBodyRadius, canTraverseStaticBodySegment } from '../src/unit-movement.mjs';
process.env.RTS_MAP = 'maps/open-field.json'; process.env.RTS_GAME_MODE = 'pvp'; process.env.RTS_PREGAME = '0';
process.env.RTS_MOVE_PLANNING_TURNS_PER_TICK = '0'; delete process.env.RTS_MATCH_STATE_PATH;
const map = { id: 'follow-queued-clearance', name: 'Follow Queued Clearance', width: 64, height: 48,
  terrainSeed: 881, fogOfWar: false, startingArmySize: 16,
  spawnPoints: [{ team: 0, x: -20, z: -16 }, { team: 1, x: 20, z: 16 }],
  resourceNodes: [], triggers: [], scenarioEvents: [],
  obstacles: [{ column: 33, row: 25, width: 1, height: 1, material: 'stone' }] };
const records = []; let serverSha256;
for (const team of [0, 1]) {
  const fixture = await createPathingReplayFixture(map, { traceLandSteps: true }); let cold;
  try {
    let r = fixture.replay; serverSha256 = fixture.sourceSha256;
    for (const seat of [0, 1]) r.order(seat, { type: 'stop', ids: r.units.filter(u => u.team === seat).map(u => u.id) });
    const id = r.units.find(u => u.team === team && u.kind === 'infantry').id, leaderId = r.units.find(u => u.team === team && u.kind === 'worker').id;
    const command = (selected, type, fields = {}) => r.order(team, { type, ids: [selected], unitGenerations: [r.units[selected].generation], ...fields });
    command(id, 'setStance', { stance: 'noAttack' }); command(id, 'move', { x: .75, z: .95 }); command(leaderId, 'move', { x: 6.5, z: .5 }); r.drain();
    for (let t = 0; t < 800 && [r.units[id], r.units[leaderId]].some(u => u.pathIndex < u.path.length); t++) r.step();
    assert.deepEqual([r.units[id].x, r.units[id].z], [.75, .95]);
    command(id, 'follow', { targetId: leaderId, targetGeneration: r.units[leaderId].generation });
    for (let t = 0; t < 60 && !r.units[id].movePlanningPending; t++) r.step({ planningTurns: 0 });
    assert.ok(r.units[id].movePlanningPending); const beforeQueueRadius = activeLandMovementBodyRadius(r.units[id]);
    command(id, 'move', { x: -3.5, z: -3.5, queue: true }); const saved = JSON.parse(JSON.stringify(r.checkpoint())); assert.ok(r.validate(saved));
    cold = await createPathingReplayFixture(map, { traceLandSteps: true }); r = cold.replay; r.restore(saved);
    const afterRestore = { goal: r.units[id].moveGoalCell, point: r.units[id].moveGoalPoint,
      persistentOrder: r.units[id].persistentOrder, radius: activeLandMovementBodyRadius(r.units[id]),
      queue: structuredClone(r.units[id].queuedWaypoints) };
    let contacts = 0, first, firstLegExecuted = false;
    for (let t = 0; t < 600; t++) {
      r.step(); if (r.units[id].moveGoalCell === afterRestore.goal && r.units[id].path.length) firstLegExecuted = true;
      for (const s of r.landSteps.filter(s => s.id === id)) if (!canTraverseStaticBodySegment(s.from, s.to, .22, 64, 48, r.isWalkable)) {
        contacts++; first ??= s;
      }
    }
    const u = r.units[id]; records.push({ team, id, beforeQueueRadius, afterRestore, firstLegExecuted, contacts, first,
      queuedMoveCompleted: Math.hypot(u.x + 3.5, u.z + 3.5) < .001,
      final: { x: u.x, z: u.z, goal: u.moveGoalCell, pending: u.movePlanningPending, queue: structuredClone(u.queuedWaypoints) } });
  } finally { await cold?.dispose(); await fixture.dispose(); }
}
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
console.log(JSON.stringify({ source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  checkoutDirty: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim() !== '', serverSha256,
  unitMovementSha256: sha256(await readFile(new URL('../src/unit-movement.mjs', import.meta.url))),
  combatMovementSha256: sha256(await readFile(new URL('../src/combat-movement.mjs', import.meta.url))), records }));
