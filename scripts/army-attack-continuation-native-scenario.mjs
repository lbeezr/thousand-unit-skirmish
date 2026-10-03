// Native worker timing and WebSocket admission. No patched simulation or roster.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { armyAttackMap } from './army-attack-continuation-case.mjs';

const fixture = await createFortifiedFixture({ mapPath: 'maps/open-field.json', timeoutMs: 60000 });
const map = armyAttackMap(), orders = [], records = [];
const sourceSha256 = createHash('sha256').update(await readFile(new URL('../server.mjs', import.meta.url))).digest('hex');
let clients, token = 1;
const workers = team => clients[team].latest.units.filter(u => u[1] === team && u[5] === 'worker').map(u => u[0]);
async function order(team, command, expected) {
  command.clientOrderToken = token++;
  const notice = await clients[team].command(command, new RegExp(`${expected.source}|REJECTED|FAILED`));
  assert.match(notice.message, expected);
  orders.push({ team, tick: clients[team].latest.tick, command, notice: notice.message });
}
try {
  await fixture.start(); clients = [await fixture.connect(0), await fixture.connect(1)];
  clients[0].send({ type: 'publishMap', map });
  await Promise.all(clients.map(c => c.wait(m => m.type === 'mapChange' && m.map.id === map.id, 'bounded combat map')));
  await Promise.all([0, 1].map(team => order(team, { type: 'build', buildingType: 'archery-range',
    ids: workers(team), x: team ? 20.5 : -20.5, z: team ? 8.5 : -8.5 }, /RANGE PLACED/)));
  await fixture.checkpoint(s => s.state.buildings.filter(b => b.type === 'archery-range').length === 2
    && s.state.buildings.every(b => b.complete));
  for (let i = 0; i < 3; i++) await Promise.all([0, 1].map(team => order(team, { type: 'trainUnit', kind: 'archer',
    buildingId: clients[team].latest.buildings.find(b => b.type === 'archery-range').id }, /QUEUED/)));
  await Promise.all([0, 1].map(team => clients[team].state(s => s.units.filter(u => u[1] === team && u[5] === 'archer').length === 3,
    'three paid Archers')));
  const lanes = [0, 1].map(team => ({ team, side: team ? -1 : 1, z: team ? 8.5 : -8.5,
    attackers: clients[team].latest.units.filter(u => u[1] === team && u[5] === 'archer'), targets: workers(1 - team).slice(0, 2) }));
  for (const lane of lanes) {
    await order(lane.team, { type: 'move', ids: lane.attackers.map(u => u[0]), x: -3.5 * lane.side, z: lane.z }, /MOVE ORDER/);
    for (const [i, id] of lane.targets.entries()) await order(1 - lane.team,
      { type: 'move', ids: [id], x: .5 * lane.side, z: lane.z + i * 2 }, /MOVE ORDER/);
  }
  const staged = await fixture.checkpoint(s => lanes.every(l => [...l.attackers.map(u => u[0]), ...l.targets].every(id => {
    const u = s.state.units[id]; return u && !u.movePlanningPending && u.pathIndex === u.path.length;
  })));
  for (const lane of lanes) {
    await clients[lane.team].state(s => lane.targets.every(id => s.units.some(u => u[0] === id)), 'targets normally visible');
    const target = staged.state.units[lane.targets[0]];
    await order(lane.team, { type: 'attack', ids: lane.attackers.map(u => u[0]),
      unitGenerations: lane.attackers.map(u => u[8]), targetId: target.id, targetGeneration: target.generation }, /ATTACK ORDER/);
  }
  // Observe normal broadcasts, then stop gracefully to checkpoint this short
  // combat window rather than waiting for the periodic checkpoint cadence.
  await Promise.all(lanes.map(l => clients[l.team].state(s => {
    const focused = s.units.find(u => u[0] === l.targets[0]);
    const next = s.units.find(u => u[0] === l.targets[1]);
    return (!focused || focused[4] === 0) && next && next[4] > 0 && next[4] < 100;
  }, 'focused target dead and second-target damage begins')));
  const sessions = clients.map(c => c.welcome.player.sessionToken);
  await fixture.stop();
  const saved = await fixture.checkpoint();
  assert.ok(lanes.every(l => saved.state.units[l.targets[0]].hp === 0
    && saved.state.units[l.targets[1]].hp > 0 && saved.state.units[l.targets[1]].hp < 100
    && l.attackers.some(a => saved.state.units[a[0]].attackTargetId === l.targets[1])),
  'recovery occurs during actual second-target combat');
  await fixture.start(); clients = [await fixture.connect(0, sessions[0]), await fixture.connect(1, sessions[1])];
  assert.ok(clients.every(c => c.welcome.recoveredFromCheckpoint), 'both seats reclaimed recovered room');
  const finished = await fixture.checkpoint(s => lanes.every(l => l.targets.every(id => s.state.units[id].hp === 0)));
  for (const lane of lanes) {
    records.push({ team: lane.team, attackers: lane.attackers.map(a => a[0]), targets: lane.targets,
      resumedAtTick: saved.state.tickNumber, checkpointTick: saved.state.tickNumber,
      secondTargetHpAtCheckpoint: saved.state.units[lane.targets[1]].hp,
      finishedAtTick: finished.state.tickNumber, targetHp: lane.targets.map(id => finished.state.units[id].hp),
      attackerHp: lane.attackers.map(a => finished.state.units[a[0]].hp) });
    await order(lane.team, { type: 'stop', ids: lane.attackers.map(a => a[0]) }, /STOP ORDER/);
  }
  await fixture.checkpoint(s => lanes.every(l => l.attackers.every(a => {
    const u = s.state.units[a[0]]; return !u.attackMove && u.attackTargetId < 0 && !u.movePlanningPending && u.path.length === 0;
  })));
  const report = { sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    sourceSha256, mapId: map.id, status: 'passed', orders, records,
    limits: ['local native two-seat WebSocket worker; no rendered appearance or deployed-build claim'] };
  if (process.env.ARMY_ATTACK_NATIVE_RECORD) await writeFile(process.env.ARMY_ATTACK_NATIVE_RECORD, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, sourceSha256, records }));
} finally { await fixture.dispose(); }
