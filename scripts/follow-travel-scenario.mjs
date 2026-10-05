import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
const map = { id: 'native-follow-travel', name: 'Native Follow Travel', width: 64, height: 48,
  terrainSeed: 881, fogOfWar: false, startingArmySize: 16,
  spawnPoints: [{ team: 0, x: -20, z: -16 }, { team: 1, x: 20, z: 16 }],
  resourceNodes: [], triggers: [], scenarioEvents: [],
  obstacles: [{ column: 33, row: 25, width: 1, height: 1, material: 'stone' }] };
const fixture = await createFortifiedFixture({ mapPath: 'maps/open-field.json', timeoutMs: 30000 });
let clients, token = 1700; const observations = [];
const row = (team, id) => clients[team].latest.units.find(u => u[0] === id);
async function order(team, command, expected) {
  const notice = await clients[team].command({ ...command, clientOrderToken: token++ }, /ORDER|QUEUED|REJECTED|FAILED/);
  assert.match(notice.message, expected); return notice.message;
}
try {
  await fixture.start(); clients = [await fixture.connect(0), await fixture.connect(1)];
  const sessions = clients.map(c => c.welcome.player.sessionToken);
  const restart = async () => {
    await fixture.stop(); await fixture.start(); clients = [await fixture.connect(0, sessions[0]), await fixture.connect(1, sessions[1])];
    assert.ok(clients.every(c => c.welcome.recoveredFromCheckpoint));
  };
  clients[0].send({ type: 'publishMap', map, persist: true });
  await Promise.all(clients.map(c => c.wait(m => m.type === 'mapChange' && m.map.id === map.id, 'Follow map')));
  for (const team of [0, 1]) {
    const units = clients[team].latest.units.filter(u => u[1] === team);
    await order(team, { type: 'stop', ids: units.map(u => u[0]) }, /STOP ORDER/);
    await order(team, { type: 'setStance', stance: 'noAttack', ids: units.filter(u => u[5] !== 'worker').map(u => u[0]) }, /STANCE ORDER/);
  }
  for (const team of [0, 1]) {
    const id = clients[team].latest.units.find(u => u[1] === team && u[5] === 'infantry')[0];
    const leaderId = clients[team].latest.units.find(u => u[1] === team && u[5] === 'worker')[0];
    await order(team, { type: 'move', ids: [leaderId], x: 20.5, z: .5 }, /MOVE ORDER/);
    await order(team, { type: 'move', ids: [id], x: .75, z: .95 }, /MOVE ORDER/);
    await Promise.all([
      clients[team].state(s => { const u = s.units.find(u => u[0] === id); return Math.hypot(u[2] - .75, u[3] - .95) < .02; }, 'fractional follower arrival'),
      clients[team].state(s => { const u = s.units.find(u => u[0] === leaderId); return Math.hypot(u[2] - 20.5, u[3] - .5) < .02; }, 'leader arrival'),
    ]);
    const leaderGeneration = row(team, leaderId)[8];
    const notice = await order(team, { type: 'follow', ids: [id], unitGenerations: [row(team, id)[8]], targetId: leaderId, targetGeneration: leaderGeneration }, /FOLLOW ORDER/);
    const active = await fixture.checkpoint(s => s.state.units[id].persistentOrder?.type === 'follow'
      && !s.state.units[id].movePlanningPending && s.state.units[id].pathIndex < s.state.units[id].path.length);
    const goal = active.state.units[id].moveGoalCell, acceptedRevision = active.state.units[id].orderRevision;
    await restart();
    const resumed = await fixture.checkpoint(s => s.state.units[id].persistentOrder?.type === 'follow'
      && s.state.units[id].pathIndex < s.state.units[id].path.length);
    assert.equal(resumed.state.units[id].persistentOrder.targetId, leaderId);
    assert.equal(resumed.state.units[id].persistentOrder.targetGeneration, leaderGeneration);
    assert.equal(resumed.state.units[id].moveGoalCell, goal);
    await order(team, { type: 'move', ids: [id], x: -3.5, z: -3.5, queue: true }, /WAYPOINT QUEUED/);
    const queued = await fixture.checkpoint(s => s.state.units[id].persistentOrder === null
      && s.state.units[id].moveGoalCell === goal && s.state.units[id].queuedWaypoints.length === 1
      && s.state.units[id].pathIndex < s.state.units[id].path.length);
    await restart();
    const complete = await fixture.checkpoint(s => { const u = s.state.units[id]; return u.persistentOrder === null
      && u.queuedWaypoints.length === 0 && !u.movePlanningPending && Math.hypot(u.x + 3.5, u.z + 3.5) < .001; });
    const u = complete.state.units[id]; assert.equal(u.hp, active.state.units[id].hp);
    assert.equal(u.attackTargetId, -1); assert.equal(u.attackBuildingTargetId, -1); assert.equal(u.combatStance, 'noAttack');
    observations.push({ team, id, leaderId, leaderGeneration, notice, goal, acceptedRevision,
      activePosition: { x: active.state.units[id].x, z: active.state.units[id].z },
      queuedPosition: { x: queued.state.units[id].x, z: queued.state.units[id].z },
      activeFollowAndQueuedCatchupColdRestarts: true, recoveredBothSeats: true,
      queuedPointCompleted: true, persistentLeaderCancelled: true, actorHpUnchanged: true });
    for (const [selected, point] of [[id, { x: team ? 8.5 : -5.5, z: -5.5 }], [leaderId, { x: team ? 24.5 : 18.5, z: -10.5 }]]) {
      await order(team, { type: 'stop', ids: [selected] }, /STOP ORDER/);
      await order(team, { type: 'move', ids: [selected], ...point }, /MOVE ORDER/);
      await clients[team].state(s => { const unit = s.units.find(v => v[0] === selected); return Math.hypot(unit[2] - point.x, unit[3] - point.z) < .02; }, 'park completed Follow actors');
    }
  }
  const report = { source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    dirty: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim() !== '', observations,
    limits: ['Actual native authority, both WebSocket seats, four cold restarts from active Follow and active queued catch-up.',
      'First pending catch-up before route publication, traced body geometry, trained Archer and other interruption cases require separate CPU evidence.',
      'No rendered frames or identified served deployment acceptance.'] };
  if (process.env.FOLLOW_TRAVEL_RECORD) await writeFile(process.env.FOLLOW_TRAVEL_RECORD, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
} finally { await fixture.dispose(); }
