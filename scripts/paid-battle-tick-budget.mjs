// Paid, fog-enabled native battles. Observational whole-tick costs, no renderer claim.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { clearAndBuildFortifiedSite, sendFortifiedCommand } from './fortified-site-clearance.mjs';
import { BUILDING_DEFINITIONS as B, TECHNOLOGY_DEFINITIONS as T,
  UNIT_DEFINITIONS as U } from '../src/gameplay-definitions.mjs';

const policy = Number(process.argv[2] ?? 4), size = Number(process.argv[3] ?? 250);
assert.ok([0, 4].includes(policy)); assert.ok([250, 2000].includes(size));
process.env.RTS_MOVE_PLANNING_TURNS_PER_TICK = String(policy);
const base = JSON.parse(await readFile(new URL('../maps/fortified-crossing.json', import.meta.url)));
const map = structuredClone(base);
// Pad the existing terrain while preserving every obstacle's world position.
for (const obstacle of map.obstacles) { obstacle.column += (160 - map.width) / 2; obstacle.row += (160 - map.height) / 2; }
Object.assign(map, { id: `paid-battle-tick-budget-${size}`, name: 'Paid Battle Tick Budget',
  width: 160, height: 160, startingArmySize: size - 2, triggers: [], regions: [],
  scenarioEvents: [], timedVictory: null, victoryHoldSeconds: 0 });
const sha = value => createHash('sha256').update(value).digest('hex');
const sourceSha256 = sha(await readFile(new URL('../server.mjs', import.meta.url)));
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const quantiles = values => {
  const sorted = values.toSorted((a, b) => a - b), at = q => sorted.length
    ? sorted[Math.max(0, Math.ceil(sorted.length * q) - 1)] : null;
  return { count: sorted.length, p50: at(.5), p95: at(.95), max: at(1) };
};
const fixture = await createFortifiedFixture({ diagnostics: true, timeoutMs: 120000 });
const spent = [{ food: 0, wood: 0 }, { food: 0, wood: 0 }], orders = [], ticks = new Map();
let clients, token = 1, stage = 'startup', report;
const own = (team, kind) => clients[team].latest.units.filter(u => u[1] === team && u[4] > 0 && u[5] === kind);
async function order(team, command, expected) {
  const issuedTick = clients[team].latest.tick;
  const notice = await sendFortifiedCommand(clients[team], { ...command, clientOrderToken: token++ }, expected);
  orders.push({ team, issuedTick, appliedNoticeTick: clients[team].latest.tick,
    type: command.type, unitCount: command.ids?.length ?? 0, x: command.x, z: command.z,
    buildingType: command.buildingType, upgrade: command.upgrade, kind: command.kind, notice: notice.message });
  return notice;
}
async function pay(team, command, definition, expected) {
  await order(team, command, expected);
  for (const resource of ['food', 'wood']) spent[team][resource] += definition.cost[resource];
}
function ledger(saved) {
  for (const team of [0, 1]) for (const resource of ['food', 'wood']) {
    const nodes = map.resourceNodes.filter(n => n.type === resource && (team ? n.x > 0 : n.x < 0));
    const harvested = nodes.reduce((sum, node) => sum + node.stock
      - saved.state.resourceNodes.find(n => n.id === node.id).stock, 0);
    const cargo = saved.state.units.filter(u => u.team === team && u.cargoType === resource)
      .reduce((sum, u) => sum + u.cargo, 0);
    const bank = saved.state[resource === 'food' ? 'teamFood' : 'teamWood'][team];
    assert.ok(Math.abs(bank - (map.startingResources[resource] - spent[team][resource] + harvested - cargo)) < 1e-5,
      `team ${team} ${resource} paid ledger and deposits`);
  }
}
async function collect() {
  const health = await fixture.health({ tickSamples: true });
  for (const sample of health.tickTiming.samples) ticks.set(sample.tickNumber, sample);
  return health;
}
try {
  await fixture.start(); clients = [await fixture.connect(0), await fixture.connect(1)];
  const sessions = clients.map(c => c.welcome.player.sessionToken);
  clients[0].send({ type: 'publishMap', map });
  await Promise.all(clients.map(c => c.wait(m => m.type === 'mapChange' && m.map.id === map.id, 'paid map')));
  stage = 'paid construction, research, training and harvesting';
  await Promise.all([0, 1].map(async team => {
    const army = own(team, 'infantry'), workers = own(team, 'worker'), sign = team ? 1 : -1;
    await order(team, { type: 'move', ids: army.map(u => u[0]), unitGenerations: army.map(u => u[8]), x: sign * 48.5, z: 10.5 }, /MOVE ORDER/);
    await pay(team, { type: 'build', ids: workers.slice(0, 2).map(u => u[0]),
      buildingType: 'house', x: sign * 30.5, z: -20.5 }, B.house, /BUILD ORDER/);
    await clients[team].state(s => s.buildings.some(b => b.team === team && b.type === 'house' && b.complete), 'paid House complete');
    await clearAndBuildFortifiedSite({ team, state: async () => clients[team].latest,
      move: (units, goal) => order(team, { type: 'move', ids: units.map(u => u[0]), unitGenerations: units.map(u => u[8]), ...goal }, /MOVE ORDER/),
      build: async () => {
        const notice = await order(team, { type: 'build', ids: workers.slice(0, 2).map(u => u[0]),
          buildingType: 'barracks', x: sign * 18.5, z: -3.5 }, /BUILD ORDER|BUILD REJECTED · UNITS IN FOOTPRINT/);
        if (notice.message.startsWith('BUILD ORDER')) spent[team].wood += B.barracks.cost.wood;
        return notice;
      } });
    await clients[team].state(s => s.buildings.some(b => b.team === team && b.type === 'barracks' && b.complete), 'paid Barracks complete');
    const barracks = clients[team].latest.buildings.find(b => b.team === team && b.type === 'barracks');
    await pay(team, { type: 'trainUnit', buildingId: barracks.id, kind: 'infantry' }, U.infantry, /QUEUED/);
    await pay(team, { type: 'researchUpgrade', buildingId: barracks.id, upgrade: 'infantry-attack' }, T['infantry-attack'], /STARTED/);
    for (const [i, type] of ['food', 'wood'].entries()) {
      const node = map.resourceNodes.find(n => n.type === type && (team ? n.x > 20 : n.x < -20));
      await order(team, { type: 'gather', ids: [workers[i + 2][0]], nodeId: node.id }, /GATHER ORDER/);
    }
  }));
  const ready = await fixture.checkpoint(s => s.mapDefinition.id === map.id && s.state.teamUpgrades.every(u => u.infantryAttack)
    && s.state.buildings.every(b => b.complete && b.queue === 0));
  ledger(ready); assert.equal(ready.state.units.filter(u => u.hp > 0).length, size);
  assert.ok([0, 1].every(team => ready.state.units.some(u => u.team === team && u.cargo > 0)
    || ready.state.resourceNodes.some(n => n.stock < map.resourceNodes.find(m => m.id === n.id).stock)));
  stage = 'measured movement, combat, fog and ongoing economy';
  await collect(); const startTick = Math.max(...ticks.keys()), phases = [];
  for (let phase = 0; phase < 3; phase++) {
    const firstTick = Math.max(...ticks.keys()) + 1;
    await Promise.all([0, 1].map(team => {
      const army = own(team, 'infantry');
      return order(team, { type: phase === 1 ? 'move' : 'attackMove', ids: army.map(u => u[0]),
        unitGenerations: army.map(u => u[8]), x: phase === 1 ? (team ? 8.5 : -8.5) : (team ? -1.5 : 1.5), z: .5 },
      phase === 1 ? /MOVE ORDER/ : /ATTACK MOVE ORDER/);
    }));
    const deadline = performance.now() + 120000;
    while (Math.max(...ticks.keys()) < firstTick + 299) {
      assert.ok(performance.now() < deadline, 'bounded 300-tick phase must complete');
      await sleep(200); await collect();
    }
    phases.push({ phase, firstTick, lastTick: Math.max(...ticks.keys()) });
  }
  const endTick = Math.max(...ticks.keys()), measured = [...ticks.values()].filter(t => t.tickNumber > startTick && t.tickNumber <= endTick)
    .toSorted((a, b) => a.tickNumber - b.tickNumber);
  assert.equal(measured.length, endTick - startTick, 'every measured tick captured once across rolling windows');
  const complete = await fixture.checkpoint(s => s.state.tickNumber >= endTick); ledger(complete);
  const casualties = size - complete.state.units.filter(u => u.hp > 0).length;
  assert.ok(casualties > 0, 'measured battle includes actual combat casualties');
  const slowest = measured.toSorted((a, b) => b.durationMs - a.durationMs).slice(0, 10);
  const summary = { totalTickMs: quantiles(measured.map(t => t.durationMs)),
    simulationIncludingPlanningMs: quantiles(measured.map(t => t.simulationMs)),
    planningMs: quantiles(measured.filter(t => t.planningTurns > 0).map(t => t.planningMs)),
    visionMs: quantiles(measured.map(t => t.visionMs)), scenarioMs: quantiles(measured.map(t => t.scenarioMs)),
    broadcastMs: quantiles(measured.map(t => t.broadcastMs)), checkpointMs: quantiles(measured.map(t => t.checkpointMs)),
    overBudgetTicks: measured.filter(t => t.durationMs > 1000 / 30).length, budgetMs: 1000 / 30, slowest };
  stage = 'paid economy and battle checkpoint recovery';
  await fixture.stop(); await fixture.start(); clients = [await fixture.connect(0, sessions[0]), await fixture.connect(1, sessions[1])];
  assert.ok(clients.every(c => c.welcome.recoveredFromCheckpoint));
  const restored = await fixture.checkpoint(s => s.state.tickNumber >= complete.state.tickNumber); ledger(restored);
  assert.ok(restored.state.teamUpgrades.every(u => u.infantryAttack));
  report = { schemaVersion: 1, head, sourceSha256, policy, size, node: process.version, platform: process.platform,
    cpu: os.cpus()[0]?.model, map, spent, orders, startTick, endTick, phases, casualties, paidLedger: true,
    checkpointRecovery: true, summary, ticks: measured,
    limits: ['native two-seat loopback, 160x160 fog map padded from Fortified Crossing; no scripted rewards or actor injection',
      'whole outer tick includes planning, movement/combat/economy, vision, scenario, broadcast and synchronous checkpoint work',
      'three fixed 300-tick command phases, all unique samples retained; timers measure but do not choose authoritative planner work',
      'shared cloud host and diagnostic polling overhead; no renderer, device capacity, timer-quality or causal speedup claim'] };
} catch (error) {
  report = { schemaVersion: 1, head, sourceSha256, policy, size, stage, failure: error.message,
    health: await fixture.health({ tickSamples: true }).catch(() => null), orders, spent };
  throw error;
} finally {
  if (process.env.PAID_BATTLE_TICK_RECORD) await writeFile(process.env.PAID_BATTLE_TICK_RECORD, JSON.stringify(report, null, 2) + '\n');
  await fixture.dispose();
}
console.log(JSON.stringify({ policy, size, casualties: report.casualties, summary: report.summary }));
