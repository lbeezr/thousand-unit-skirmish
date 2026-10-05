import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';

const map = { id: 'native-patrol-travel', name: 'Native Patrol Travel',
  width: 64, height: 48, terrainSeed: 881, fogOfWar: false, startingArmySize: 16,
  spawnPoints: [{ team: 0, x: -20, z: -16 }, { team: 1, x: 20, z: 16 }],
  resourceNodes: [], triggers: [], scenarioEvents: [],
  obstacles: [{ column: 33, row: 25, width: 1, height: 1, material: 'stone' }] };
const fixture = await createFortifiedFixture({ mapPath: 'maps/open-field.json', timeoutMs: 30000 });
let clients, token = 1800;
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
  await Promise.all(clients.map(c => c.wait(m => m.type === 'mapChange' && m.map.id === map.id, 'patrol map')));
  for (const team of [0, 1]) {
    const units = clients[team].latest.units.filter(u => u[1] === team);
    await order(team, { type: 'stop', ids: units.map(u => u[0]) }, /STOP ORDER/);
    await order(team, { type: 'setStance', stance: 'noAttack', ids: units.filter(u => u[5] !== 'worker').map(u => u[0]) }, /STANCE ORDER/);
  }
  for (const team of [0, 1]) {
    const id = clients[team].latest.units.find(u => u[1] === team && u[5] === 'infantry')[0];
    const goal = { x: 6.5, z: .5 };
    await order(team, { type: 'move', ids: [id], unitGenerations: [row(team, id)[8]], x: .75, z: .95 }, /MOVE ORDER/);
    await clients[team].state(s => { const u = s.units.find(u => u[0] === id); return Math.hypot(u[2] - .75, u[3] - .95) < .02; }, 'fractional Move arrival');
    const before = await fixture.checkpoint(s => !s.state.units[id].movePlanningPending && s.state.units[id].pathIndex >= s.state.units[id].path.length);
    const notice = await order(team, { type: 'patrol', ids: [id], unitGenerations: [row(team, id)[8]], ...goal }, /PATROL ORDER/);
    const active = await fixture.checkpoint(s => { const u = s.state.units[id];
      return u.persistentOrder?.type === 'patrol' && u.persistentOrder.leg === 1
        && !u.movePlanningPending && u.pathIndex < u.path.length;
    });
    const endpoints = { start: active.state.units[id].persistentOrder.start, end: active.state.units[id].persistentOrder.end };
    assert.equal(active.state.units[id].combatStance, 'noAttack');
    await fixture.stop(); await fixture.start();
    clients = [await fixture.connect(0, sessions[0]), await fixture.connect(1, sessions[1])];
    assert.ok(clients.every(c => c.welcome.recoveredFromCheckpoint));
    const returning = await fixture.checkpoint(s => {
      const u = s.state.units[id]; return u.persistentOrder?.leg === 0
        && !u.movePlanningPending && u.pathIndex < u.path.length;
    });
    assert.equal(returning.state.units[id].persistentOrder.start, endpoints.start);
    assert.equal(returning.state.units[id].persistentOrder.end, endpoints.end);
    await fixture.stop(); await fixture.start();
    clients = [await fixture.connect(0, sessions[0]), await fixture.connect(1, sessions[1])];
    assert.ok(clients.every(c => c.welcome.recoveredFromCheckpoint));
    const complete = await fixture.checkpoint(s => {
      const u = s.state.units[id]; return u.persistentOrder?.leg === 1
        && !u.movePlanningPending && u.pathIndex < u.path.length;
    });
    const u = complete.state.units[id];
    assert.equal(u.hp, before.state.units[id].hp); assert.equal(u.attackMove, true);
    assert.equal(u.combatStance, 'noAttack'); assert.equal(u.attackTargetId, -1);
    assert.equal(u.persistentOrder.start, endpoints.start); assert.equal(u.persistentOrder.end, endpoints.end);
    observations.push({ team, id, notice, start: { x: .75, z: .95 }, goal,
      activePosition: { x: active.state.units[id].x, z: active.state.units[id].z },
      recoveredBothSeats: true, outboundAndReturnColdRestarts: true, endpoints, nextOutboundPosition: { x: u.x, z: u.z }, hpUnchanged: true });
    await order(team, { type: 'stop', ids: [id] }, /STOP ORDER/);
    await order(team, { type: 'move', ids: [id], x: -5.5, z: -5.5 }, /MOVE ORDER/);
    await clients[team].state(s => { const moved = s.units.find(v => v[0] === id);
      return Math.hypot(moved[2] + 5.5, moved[3] + 5.5) < .02;
    }, 'park completed patroller');
  }
  const report = { sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    sourceDirty: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim() !== '',
    observations, limits: ['Native authoritative process, two real WebSocket seats and real cold restart.',
      'Physical body admission is established separately by the traced command regressions.',
      'No rendered frames; served staging/production identity remains unverified.'] };
  if (process.env.PATROL_TRAVEL_RECORD) await writeFile(process.env.PATROL_TRAVEL_RECORD, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
} finally { await fixture.dispose(); }
