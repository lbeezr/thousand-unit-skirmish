import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';

const map = { id: 'native-attack-move-acquired', name: 'Native Acquired AttackMove',
  width: 64, height: 48, terrainSeed: 881, fogOfWar: false, startingArmySize: 16,
  spawnPoints: [{ team: 0, x: -20, z: -16 }, { team: 1, x: 20, z: 16 }],
  resourceNodes: [], triggers: [], scenarioEvents: [],
  obstacles: [{ column: 33, row: 25, width: 1, height: 1, material: 'stone' }] };
const fixture = await createFortifiedFixture({ mapPath: 'maps/open-field.json', timeoutMs: 30000 });
let clients, token = 1300;
const observations = [];
const row = (team, id) => clients[team].latest.units.find(u => u[0] === id);
async function order(team, command, expected) {
  const notice = await clients[team].command({ ...command, clientOrderToken: token++ }, /ORDER|REJECTED|FAILED/);
  assert.match(notice.message, expected); return notice.message;
}
try {
  await fixture.start(); clients = [await fixture.connect(0), await fixture.connect(1)];
  const sessions = clients.map(c => c.welcome.player.sessionToken);
  clients[0].send({ type: 'publishMap', map, persist: true });
  await Promise.all(clients.map(c => c.wait(m => m.type === 'mapChange' && m.map.id === map.id, 'acquired map')));
  for (const team of [0, 1]) {
    const units = clients[team].latest.units.filter(u => u[1] === team);
    await order(team, { type: 'stop', ids: units.map(u => u[0]) }, /STOP ORDER/);
    await order(team, { type: 'setStance', stance: 'noAttack', ids: units.filter(u => u[5] !== 'worker').map(u => u[0]) }, /STANCE ORDER/);
  }
  for (const team of [0, 1]) {
    const id = clients[team].latest.units.find(u => u[1] === team && u[5] === 'infantry')[0];
    const targetId = clients[1 - team].latest.units.find(u => u[1] !== team && u[5] === 'worker' && u[4] > 0)[0];
    await order(1 - team, { type: 'move', ids: [targetId], unitGenerations: [row(1 - team, targetId)[8]], x: 4.5, z: .5 }, /MOVE ORDER/);
    await order(team, { type: 'move', ids: [id], unitGenerations: [row(team, id)[8]], x: .75, z: .95 }, /MOVE ORDER/);
    await Promise.all([
      clients[team].state(s => { const u = s.units.find(u => u[0] === id); return Math.hypot(u[2] - .75, u[3] - .95) < .02; }, 'fractional attacker arrival'),
      clients[1 - team].state(s => { const u = s.units.find(u => u[0] === targetId); return Math.hypot(u[2] - 4.5, u[3] - .5) < .02; }, 'target arrival'),
    ]);
    const before = await fixture.checkpoint(s => !s.state.units[id].movePlanningPending && !s.state.units[targetId].movePlanningPending);
    const notice = await order(team, { type: 'attackMove', ids: [id], unitGenerations: [row(team, id)[8]],
      x: 6.5, z: .5 }, /ATTACK MOVE ORDER/);
    await order(team, { type: 'setStance', ids: [id], stance: 'aggressive' }, /STANCE ORDER/);
    const active = await fixture.checkpoint(s => s.state.units[id].attackTargetId === targetId
      && s.state.units[id].pathIndex < s.state.units[id].path.length);
    assert.equal(active.state.units[id].combatStance, 'aggressive'); assert.equal(active.state.units[id].attackMove, true);
    assert.ok(active.state.units[id].attackMoveResumePath);
    const anchor = [active.state.units[id].attackMoveAnchorX, active.state.units[id].attackMoveAnchorZ];
    assert.equal(active.state.units[id].orderRevision, before.state.units[id].orderRevision + 1);
    const goal = active.state.units[id].moveGoalCell;
    await fixture.stop(); await fixture.start();
    clients = [await fixture.connect(0, sessions[0]), await fixture.connect(1, sessions[1])];
    assert.ok(clients.every(c => c.welcome.recoveredFromCheckpoint));
    const complete = await fixture.checkpoint(s => {
      const u = s.state.units[id]; return s.state.units[targetId].hp === 0 && u.attackTargetId < 0
        && !u.movePlanningPending && u.pathIndex >= u.path.length && Math.hypot(u.x - 6.5, u.z - .5) < .001;
    });
    const u = complete.state.units[id];
    assert.equal(u.hp, before.state.units[id].hp); assert.equal(u.attackMove, true);
    assert.equal(u.combatStance, 'aggressive'); assert.equal(u.attackMoveResumePath, null);
    assert.deepEqual([u.attackMoveAnchorX, u.attackMoveAnchorZ], anchor);
    assert.equal(u.moveGoalCell, goal); assert.equal(u.orderRevision, active.state.units[id].orderRevision);
    observations.push({ team, id, targetId, notice, activePosition: { x: active.state.units[id].x, z: active.state.units[id].z },
      recoveredBothSeats: true, targetKilled: true, actorHpUnchanged: true,
      acceptedRevision: u.orderRevision, durableGoal: goal, anchor, objectiveCompleted: true, completedPosition: { x: u.x, z: u.z } });
    // Keep the next seat's fractional start independent of this completed actor.
    await order(team, { type: 'move', ids: [id], unitGenerations: [row(team, id)[8]], x: -5.5, z: -5.5 }, /MOVE ORDER/);
    await clients[team].state(s => { const moved = s.units.find(u => u[0] === id); return Math.hypot(moved[2] + 5.5, moved[3] + 5.5) < .02; }, 'park completed attacker');
  }
  const report = { sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    sourceDirty: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim() !== '', observations,
    limits: ['Real native authoritative process, both WebSocket seats and actual cold restart during acquired AttackMove pursuit.',
      'Physical static body admission and exact damage/range rules require the separate traced command regressions.',
      'No rendered frames; identified served staging/production acceptance remains open.'] };
  if (process.env.ATTACKMOVE_ACQUIRED_RECORD) await writeFile(process.env.ATTACKMOVE_ACQUIRED_RECORD, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
} finally { await fixture.dispose(); }
