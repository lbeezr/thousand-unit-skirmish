import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { armyAttackMap } from './army-attack-continuation-case.mjs';

const fixture = await createFortifiedFixture({ mapPath: 'maps/open-field.json', timeoutMs: 60000 });
const map = armyAttackMap(), orders = [], records = [];
let clients, token = 1;
async function order(team, command, expected = /ORDER/) {
  command.clientOrderToken = token++;
  const notice = await clients[team].command(command, /ORDER|REJECTED/);
  assert.match(notice.message, expected);
  orders.push({ team, tick: clients[team].latest.tick, command, notice: notice.message });
}
try {
  await fixture.start(); clients = [await fixture.connect(0), await fixture.connect(1)];
  clients[0].send({ type: 'publishMap', map });
  await Promise.all(clients.map(c => c.wait(m => m.type === 'mapChange' && m.map.id === map.id, 'stance map')));
  const lanes = [0, 1].map(team => ({ team, side: team ? -1 : 1, z: team ? 8.5 : -8.5,
    unit: clients[team].latest.units.find(u => u[1] === team && u[5] === 'infantry'),
    enemy: clients[1 - team].latest.units.find(u => u[1] === 1 - team && u[5] === 'worker') }));
  for (const team of [0, 1]) {
    await order(team, { type: 'setStance', stance: 'noAttack',
      ids: clients[team].latest.units.filter(u => u[1] === team && u[5] !== 'worker').map(u => u[0]) });
  }
  for (const l of lanes) {
    await order(l.team, { type: 'move', ids: [l.unit[0]], x: -3.5 * l.side, z: l.z });
    await order(1 - l.team, { type: 'move', ids: [l.enemy[0]], x: -1.5 * l.side, z: l.z });
  }
  const staged = await fixture.checkpoint(s => lanes.every(l => [l.unit[0], l.enemy[0]].every(id => {
    const u = s.state.units[id]; return !u.movePlanningPending && u.pathIndex === u.path.length;
  })));
  for (const l of lanes) {
    await clients[l.team].state(s => s.units.some(u => u[0] === l.enemy[0]), 'target visible');
    assert.equal(staged.state.units[l.enemy[0]].hp, 100, 'No Attack setup stays passive');
    assert.ok(clients[l.team].latest.unitStances.every(row => staged.state.units[row[0]].team === l.team));
    await order(l.team, { type: 'setStance', ids: [l.unit[0]], unitGenerations: [l.unit[8]], stance: 'standGround' });
  }
  const held = await fixture.checkpoint(s => s.state.tickNumber >= staged.state.tickNumber + 12);
  for (const l of lanes) {
    assert.equal(held.state.units[l.enemy[0]].hp, 100, 'Stand Ground does not chase a two-cell target');
    assert.equal(held.state.units[l.unit[0]].x, staged.state.units[l.unit[0]].x);
    await order(l.team, { type: 'setStance', ids: [l.unit[0]], stance: 'defensive' });
  }
  await Promise.all(lanes.map(l => clients[l.team].state(s => {
    const u = s.units.find(u => u[0] === l.unit[0]); return u && Math.abs(u[2] + 3.5 * l.side) > .05;
  }, 'Defensive automatic pursuit begins')));
  for (const l of lanes) await order(1 - l.team,
    { type: 'move', ids: [l.enemy[0]], x: 6.5 * l.side, z: l.z });
  // Normal position broadcasts reveal the reversal toward each anchor. Stop
  // promptly in that window instead of relying on a one-second checkpoint to
  // happen to overlap a short return route.
  await Promise.all(lanes.map(l => {
    let farthest = 0;
    return clients[l.team].state(s => {
      const u = s.units.find(u => u[0] === l.unit[0]);
      const progress = u ? (u[2] + 3.5 * l.side) * l.side : 0;
      farthest = Math.max(farthest, progress);
      return progress > .1 && progress < farthest - .05;
    }, 'Defensive return toward saved anchor begins');
  }));
  const sessions = clients.map(c => c.welcome.player.sessionToken);
  await fixture.stop(); const saved = await fixture.checkpoint();
  assert.equal(saved.schemaVersion, 29);
  assert.ok(lanes.every(l => saved.state.units[l.unit[0]].stanceReturning));
  await fixture.start(); clients = [await fixture.connect(0, sessions[0]), await fixture.connect(1, sessions[1])];
  assert.ok(clients.every(c => c.welcome.recoveredFromCheckpoint));
  const back = await fixture.checkpoint(s => lanes.every(l => {
    const u = s.state.units[l.unit[0]];
    return !u.stanceReturning && !u.movePlanningPending && Math.hypot(u.x + 3.5 * l.side, u.z - l.z) < .02;
  }));
  assert.equal(back.schemaVersion, 29);
  for (const l of lanes) {
    records.push({ team: l.team, unit: l.unit[0], returnCheckpointTick: saved.state.tickNumber,
      restoredAtTick: saved.state.tickNumber, returnedAtTick: back.state.tickNumber,
      stance: back.state.units[l.unit[0]].combatStance, enemyHp: back.state.units[l.enemy[0]].hp });
    await order(l.team, { type: 'setStance', ids: [l.unit[0]], stance: 'aggressive' });
    await order(1 - l.team, { type: 'move', ids: [l.enemy[0]], x: -.5 * l.side, z: l.z });
  }
  const fought = await fixture.checkpoint(s => lanes.every(l => s.state.units[l.enemy[0]].hp < 100));
  for (const l of lanes) {
    assert.ok(fought.state.units[l.unit[0]].hp > 0);
    await order(l.team, { type: 'stop', ids: [l.unit[0]] });
  }
  const stopped = await fixture.checkpoint(s => lanes.every(l => {
    const u = s.state.units[l.unit[0]]; return u.combatStance === 'noAttack' && u.attackTargetId < 0 && !u.attackMove;
  }));
  assert.ok(stopped.state.units.filter(u => u.kind === 'worker').every(u => u.combatStance === null));
  const report = { status: 'passed', revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    sourceSha256: createHash('sha256').update(await readFile(new URL('../server.mjs', import.meta.url))).digest('hex'),
    orders, records, limits: ['native two-seat WebSocket worker; no rendered or hosted-build claim'] };
  if (process.env.MILITARY_STANCE_NATIVE_RECORD) await writeFile(process.env.MILITARY_STANCE_NATIVE_RECORD, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
} finally { await fixture.dispose(); }
