import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';

// Actual two-seat commands and process recovery. Exhaustive admitted-substep
// clearance belongs to automatic-stance-pursuit-journeys; broadcasts and these
// checkpoints do not stand in for a rendered or every-substep observation.
const fixture = await createFortifiedFixture({ mapPath: 'maps/open-field.json', timeoutMs: 60000 });
const map = { id: 'automatic-stance-native', name: 'Automatic Stance Native',
  width: 64, height: 48, terrainSeed: 881, fogOfWar: true, startingArmySize: 16,
  startingResources: { food: 800, wood: 2500 },
  spawnPoints: [{ team: 0, x: -20, z: -16 }, { team: 1, x: 20, z: 16 }],
  resourceNodes: [], triggers: [], scenarioEvents: [],
  obstacles: [16, 34].map(row => ({ column: 33, row, width: 1, height: 1, material: 'stone' })) };
const orders = [], records = [];
let clients, token = 1;
async function order(team, command) {
  command.clientOrderToken = token++;
  const notice = await clients[team].command(command, /ORDER|REJECTED/);
  assert.match(notice.message, /ORDER/);
  orders.push({ team, tick: clients[team].latest.tick, command, notice: notice.message });
}
try {
  await fixture.start(); clients = [await fixture.connect(0), await fixture.connect(1)];
  clients[0].send({ type: 'publishMap', map });
  await Promise.all(clients.map(c => c.wait(m => m.type === 'mapChange' && m.map.id === map.id, 'pursuit map')));
  for (const team of [0, 1]) await order(team, { type: 'stop', ids: clients[team].latest.units.filter(u => u[1] === team).map(u => u[0]) });
  const lanes = [0, 1].map(team => ({ team, z: team ? 9 : -9,
    actor: clients[team].latest.units.find(u => u[1] === team && u[5] === 'infantry')[0] }));
  for (const [phase, stance] of ['aggressive', 'defensive'].entries()) {
    const roster = await fixture.checkpoint();
    for (const l of lanes) {
      l.target = roster.state.units.filter(u => u.team !== l.team && u.kind === 'worker' && u.hp > 0)[0].id;
      await order(l.team, { type: 'move', ids: [l.actor], x: .75, z: l.z + .95 });
      await order(1 - l.team, { type: 'move', ids: [l.target], x: 2.5, z: l.z + .5 });
    }
    const staged = await fixture.checkpoint(s => lanes.every(l => [[l.actor, .75, l.z + .95], [l.target, 2.5, l.z + .5]].every(([id, x, z]) => {
      const u = s.state.units[id]; return !u.movePlanningPending && u.pathIndex === u.path.length
        && Math.hypot(u.x - x, u.z - z) < .001;
    })));
    for (const l of lanes) {
      assert.equal(staged.state.units[l.target].hp, 100);
      assert.deepEqual([staged.state.units[l.actor].x, staged.state.units[l.actor].z], [.75, l.z + .95]);
      await clients[l.team].state(s => s.units.some(u => u[0] === l.target), 'actual target visibility');
      await order(l.team, { type: 'setStance', ids: [l.actor], stance });
    }
    await Promise.all(lanes.map(l => clients[l.team].state(s => {
      const u = s.units.find(u => u[0] === l.actor);
      return u && Math.hypot(u[2] - .75, u[3] - l.z - .95) > .03;
    }, 'actual automatic pursuit begins')));
    const sessions = clients.map(c => c.welcome.player.sessionToken);
    await fixture.stop(); const saved = await fixture.checkpoint();
    for (const l of lanes) {
      const u = saved.state.units[l.actor];
      assert.equal(u.stanceCombat, true); assert.equal(u.attackTargetId, l.target);
      assert.deepEqual([u.stanceAnchorX, u.stanceAnchorZ], [.75, l.z + .95]);
      assert.deepEqual([u.attackMoveAnchorX, u.attackMoveAnchorZ], [.75, l.z + .95]);
      assert.ok(saved.state.units[l.target].hp > 0);
    }
    await fixture.start(); clients = [await fixture.connect(0, sessions[0]), await fixture.connect(1, sessions[1])];
    assert.ok(clients.every(c => c.welcome.recoveredFromCheckpoint));
    const finished = await fixture.checkpoint(s => lanes.every(l => {
      const u = s.state.units[l.actor];
      return s.state.units[l.target].hp === 0 && (stance !== 'defensive'
        || (!u.stanceReturning && !u.movePlanningPending && u.pathIndex === u.path.length));
    }));
    for (const l of lanes) {
      const u = finished.state.units[l.actor];
      assert.deepEqual([u.stanceAnchorX, u.stanceAnchorZ], [.75, l.z + .95]);
      if (stance === 'defensive') assert.ok(Math.hypot(u.x - .5, u.z - l.z - .5) < .02);
      records.push({ phase, team: l.team, stance, actor: l.actor, target: l.target,
        savedTick: saved.state.tickNumber, savedActor: saved.state.units[l.actor],
        completedTick: finished.state.tickNumber, completedActor: u, targetHp: finished.state.units[l.target].hp });
      await order(l.team, { type: 'stop', ids: [l.actor] });
    }
  }
  const report = { status: 'passed', revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    sourceDirty: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim() !== '', orders, records,
    limits: ['native two-seat WebSocket/process recovery only; no rendered or provider identity claim'] };
  if (process.env.AUTOMATIC_STANCE_NATIVE_RECORD) await writeFile(process.env.AUTOMATIC_STANCE_NATIVE_RECORD, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
} finally { await fixture.dispose(); }
