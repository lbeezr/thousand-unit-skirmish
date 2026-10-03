// Current elimination boundaries in a real worker. Checkpoint fixtures are
// deliberate edge states, not claims of normal play, balance or browser proof.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';

const fixture = await createFortifiedFixture({ mapPath: 'maps/open-field.json', timeoutMs: 15000 });
const records = [];
let clients, token = 1;
const map = { id: 'victory-elimination-proof', name: 'Elimination proof', width: 64, height: 64,
  terrainSeed: 19, fogOfWar: false, startingArmySize: 24,
  startingResources: { food: 1000, wood: 1000 },
  spawnPoints: [{ team: 0, x: -20, z: 0 }, { team: 1, x: 20, z: 0 }],
  obstacles: [], resourceNodes: [], triggers: [], scenarioEvents: [] };
const order = (team, command, expected) => clients[team].command(
  { ...command, clientOrderToken: token++ }, expected);
function clearQueues(state) {
  for (const p of state.workerProduction) Object.assign(p,
    { queue: 0, trainingRemaining: 0, productionBlocked: false });
  for (const b of state.buildings) Object.assign(b,
    { queue: 0, productionQueue: [], trainingRemaining: 0, productionBlocked: false });
}
function killTeam(state, team) {
  for (const unit of state.units) if (unit.team === team) unit.hp = 0;
}

try {
  await fixture.start(); clients = [await fixture.connect(0), await fixture.connect(1)];
  clients[0].send({ type: 'publishMap', map });
  await Promise.all(clients.map(c => c.wait(m => m.type === 'mapChange' && m.map.id === map.id)));
  for (const team of [0, 1]) await order(team, { type: 'build', buildingType: 'barracks',
    ids: clients[team].latest.units.filter(u => u[1] === team && u[5] === 'worker').map(u => u[0]),
    x: team ? 14.5 : -14.5, z: 8.5 }, /BARRACKS PLACED/);
  await Promise.all(clients.map(c => c.state(s => s.buildings.length === 2
    && s.buildings.every(b => b.complete), 'paid Barracks completed')));
  for (const team of [0, 1]) {
    await order(team, { type: 'stop', ids: clients[team].latest.units.filter(u => u[1] === team).map(u => u[0]) }, /STOP ORDER/);
    const after = clients[team].messages.length;
    clients[team].send({ type: 'trainWorker' });
    await clients[team].wait(m => m.type === 'notice' && /WORKER QUEUED/.test(m.message), 'paid Worker queue', after);
    await order(team, { type: 'trainUnit', kind: 'infantry',
      buildingId: clients[team].latest.buildings.find(b => b.team === team).id }, /QUEUED/);
  }
  await fixture.stop();
  const paid = await fixture.checkpoint();
  assert.ok(paid.state.workerProduction.every(p => p.queue === 1));
  assert.ok(paid.state.buildings.every(b => b.productionQueue[0] === 'infantry'));
  const base = structuredClone(paid); clearQueues(base.state);
  base.state.teamFood = [0, 0]; base.state.teamWood = [0, 0];
  base.state.seatSessions = [];

  async function run(name, mutate, expected, { connect = true } = {}) {
    const saved = structuredClone(base); mutate(saved.state);
    await writeFile(fixture.checkpointPath, JSON.stringify(saved));
    await fixture.start();
    if (connect) {
      clients = [await fixture.connect(0), await fixture.connect(1)];
      assert.ok(clients.every(c => c.welcome.recoveredFromCheckpoint), `${name}: fixture must restore`);
    }
    await fixture.checkpoint(s => s.state.tickNumber >= saved.state.tickNumber + 12);
    await fixture.stop(); const result = await fixture.checkpoint();
    assert.equal(result.matchId, saved.matchId, `${name}: match identity must survive`);
    assert.equal(result.state.matchWinner, expected, name);
    if (expected >= 0) assert.equal(result.state.matchWinnerReason, 'elimination', name);
    records.push({ name, winner: result.state.matchWinner,
      reason: result.state.matchWinnerReason, elapsed: result.state.matchElapsedSeconds });
    return result;
  }
  const worker = await run('Worker survives destroyed home and can rebuild', state => {
    killTeam(state, 0); state.units.find(u => u.team === 0 && u.kind === 'worker').hp = 100;
    state.homeTownCenters[0].hp = 0; state.teamFood[0] = 100; state.teamWood[0] = 400;
  }, -1);
  assert.equal(worker.state.homeTownCenters[0].hp, 0);
  assert.equal(worker.state.units.filter(u => u.team === 0 && u.hp > 0).length, 1);
  await run('Empty army can afford a legal Worker without an existing queue', state => {
    killTeam(state, 0); state.teamFood[0] = 50;
  }, -1);
  await run('Intact but unaffordable base does not prevent defeat', state => killTeam(state, 0), 1);
  await run('Both teams unable to field land units draw', state => {
    killTeam(state, 0); killTeam(state, 1);
  }, 2);
  await run('Paid Worker queue prevents early defeat after army loss', state => {
    killTeam(state, 0); state.workerProduction[0] = structuredClone(paid.state.workerProduction[0]);
  }, -1);
  await run('Paid military queue survives destroyed Town Center', state => {
    killTeam(state, 0); state.homeTownCenters[0].hp = 0;
    state.buildings[0] = structuredClone(paid.state.buildings[0]);
  }, -1);
  await run('Unfinished producer without Workers cannot recover', state => {
    killTeam(state, 0); state.homeTownCenters[0].hp = 0;
    state.teamFood[0] = 1000; state.teamWood[0] = 1000;
    state.buildings.find(b => b.team === 0).complete = false;
    state.buildings.find(b => b.team === 0).progress = 0.5;
  }, 1);
  await run('No automatic stalemate result after an hour', state => {
    for (const team of [0, 1]) {
      killTeam(state, team); state.units.find(u => u.team === team && u.kind === 'worker').hp = 100;
      state.homeTownCenters[team].hp = 0;
    }
    state.matchElapsedSeconds = 3600;
  }, -1);
  const prestart = await run('No players leaves a fresh scenario clock stopped', state => {
    state.scenarioClockStarted = false; state.matchElapsedSeconds = 0;
  }, -1, { connect: false });
  assert.equal(prestart.state.scenarioClockStarted, false);
  assert.equal(prestart.state.matchElapsedSeconds, 0);
  const preclockDefeat = await run('Elimination can finish with no players before clock start', state => {
    killTeam(state, 0); state.scenarioClockStarted = false; state.matchElapsedSeconds = 0;
  }, 1, { connect: false });
  assert.equal(preclockDefeat.state.matchElapsedSeconds, 0);
  const disconnected = await run('Started clock continues with no connected players', () => {}, -1, { connect: false });
  assert.ok(disconnected.state.matchElapsedSeconds > base.state.matchElapsedSeconds);
  const finished = await run('Restored result remains final', state => {
    state.matchWinner = 1; state.matchWinnerReason = 'elimination';
  }, 1);
  assert.equal(finished.state.matchElapsedSeconds, base.state.matchElapsedSeconds);
  const report = { status: 'passed', scenario: 'existing recovery-aware elimination', records,
    serverSha256: createHash('sha256').update(await readFile(new URL('../server.mjs', import.meta.url))).digest('hex'),
    limits: ['Checkpoint edge fixtures in the native worker; no rendered, balance or deployed-match claim.',
      'Water-only elimination is defined in the runtime audit; boats are not created by this land fixture.'] };
  if (process.env.VICTORY_AUDIT_RECORD) await writeFile(process.env.VICTORY_AUDIT_RECORD, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
} finally { await fixture.dispose(); }
