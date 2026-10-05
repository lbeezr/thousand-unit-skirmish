import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
const map = { id: 'native-worker-patrol', name: 'Native Worker Patrol', width: 64, height: 48,
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
  await Promise.all(clients.map(c => c.wait(m => m.type === 'mapChange' && m.map.id === map.id, 'Patrol map')));
  for (const team of [0, 1]) {
    const units = clients[team].latest.units.filter(u => u[1] === team);
    await order(team, { type: 'stop', ids: units.map(u => u[0]) }, /STOP ORDER/);
    await order(team, { type: 'setStance', stance: 'noAttack', ids: units.filter(u => u[5] !== 'worker').map(u => u[0]) }, /STANCE ORDER/);
  }
  for (const team of [0, 1]) {
    const [id] = clients[team].latest.units.filter(u => u[1] === team && u[5] === 'worker').map(u => u[0]);
    await order(team, { type: 'move', ids: [id], x: .79, z: .95 }, /MOVE ORDER/);
    await Promise.all([
      clients[team].state(s => { const u = s.units.find(u => u[0] === id); return Math.hypot(u[2] - .79, u[3] - .95) < .02; }, 'fractional follower arrival'),
    ]);
    const notice = await order(team, { type: 'patrol', ids: [id], unitGenerations: [row(team, id)[8]], x: 20.5, z: .5 }, /PATROL/);
    const active = await fixture.checkpoint(s => s.state.units[id].persistentOrder?.type === 'patrol'
      && !s.state.units[id].movePlanningPending && s.state.units[id].pathIndex < s.state.units[id].path.length);
    const goal = active.state.units[id].moveGoalCell, acceptedRevision = active.state.units[id].orderRevision;
    const endpoints = [active.state.units[id].persistentOrder.start, active.state.units[id].persistentOrder.end];
    await restart();
    const resumed = await fixture.checkpoint(s => s.state.units[id].persistentOrder?.type === 'patrol'
      && s.state.units[id].pathIndex < s.state.units[id].path.length);
    assert.deepEqual([resumed.state.units[id].persistentOrder.start, resumed.state.units[id].persistentOrder.end], endpoints);
    assert.equal(resumed.state.units[id].moveGoalCell, goal);
    assert.equal(resumed.state.units[id].attackMove, true);
    await order(team, { type: 'move', ids: [id], x: -3.5, z: -3.5, queue: true }, /WAYPOINT QUEUED/);
    const queued = await fixture.checkpoint(s => s.state.units[id].persistentOrder === null
      && s.state.units[id].moveGoalCell === goal && s.state.units[id].queuedWaypoints.length === 1
      && s.state.units[id].pathIndex < s.state.units[id].path.length);
    assert.equal(queued.state.units[id].moveGoalPoint, null);
    assert.equal(queued.state.units[id].attackMove, true);
    assert.equal(queued.state.units[id].orderRevision, acceptedRevision);
    await restart();
    const complete = await fixture.checkpoint(s => { const u = s.state.units[id]; return u.persistentOrder === null
      && u.queuedWaypoints.length === 0 && !u.movePlanningPending && Math.hypot(u.x + 3.5, u.z + 3.5) < .001; });
    const u = complete.state.units[id]; assert.equal(u.hp, active.state.units[id].hp);
    assert.equal(u.attackMove, false); assert.equal(u.attackTargetId, -1); assert.equal(u.attackBuildingTargetId, -1); assert.equal(u.combatStance, null);
    observations.push({ team, id, notice, endpoints, goal, acceptedRevision,
      activePosition: { x: active.state.units[id].x, z: active.state.units[id].z },
      queuedPosition: { x: queued.state.units[id].x, z: queued.state.units[id].z },
      queuedFirstLegAttackMove: queued.state.units[id].attackMove,
      activePatrolAndCancelledObjectiveColdRestarts: true, recoveredBothSeats: true,
      queuedPointCompleted: true, persistentPatrolCancelled: true, actorHpUnchanged: true });
    for (const [selected, point] of [[id, { x: team ? 8.5 : -5.5, z: -5.5 }]]) {
      await order(team, { type: 'stop', ids: [selected] }, /STOP ORDER/);
      await order(team, { type: 'move', ids: [selected], ...point }, /MOVE ORDER/);
      await clients[team].state(s => { const unit = s.units.find(v => v[0] === selected); return Math.hypot(unit[2] - point.x, unit[3] - point.z) < .02; }, 'park completed Patrol actor');
    }
  }
  const report = { source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    dirty: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim() !== '', observations,
    limits: ['Actual native Worker authority, both WebSocket seats, four cold restarts from active Patrol and active cancelled objective leg.',
      'Endpoint cycling, first pending objective before publication, traced static body geometry, natural cargo, paid construction and other interruption cases require separate CPU evidence.',
      'No rendered frames or identified served deployment acceptance.'] };
  if (process.env.WORKER_PATROL_RECORD) await writeFile(process.env.WORKER_PATROL_RECORD, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
} finally { await fixture.dispose(); }
