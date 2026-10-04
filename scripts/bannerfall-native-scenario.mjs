import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { BANNERFALL_RULES } from '../src/bannerfall-rules.mjs';

const keys = ['RTS_MATCH_MODE_ID', 'RTS_MATCH_MODE_VERSION', 'RTS_SOLO_PRACTICE', 'RTS_PREGAME'];
const inherited = Object.fromEntries(keys.map(key => [key, process.env[key]]));
process.env.RTS_MATCH_MODE_ID = 'bannerfall'; process.env.RTS_MATCH_MODE_VERSION = '1';
delete process.env.RTS_SOLO_PRACTICE; delete process.env.RTS_PREGAME;
// An explicit mode launch selects its shipped arena without a separate map option.
const fixture = await createFortifiedFixture({ mapPath: null, timeoutMs: 60000 });
const records = []; let clients = [];
const live = (state, team) => state.units.filter(unit => unit[1] === team && unit[4] > 0);
async function connect(count = 2) {
  clients = [];
  for (let team = 0; team < count; team++) clients.push(await fixture.connect(team));
}
async function save() { await fixture.stop(); return fixture.checkpoint(); }
function passive(unit) {
  Object.assign(unit, { path: [], pathIndex: 0, attackTargetId: -1, attackBuildingTargetId: -1,
    attackMove: false, attackMoveRouteReady: false, attackMoveResumePath: null,
    attackMoveResumePathIndex: 0, movePlanningPending: false, queuedWaypoints: [],
    persistentOrder: null, combatStance: 'noAttack', stanceCombat: false, stanceReturning: false,
    holdingPosition: false, attackCooldown: 0, repathTimer: 0 });
}
async function restore(value, count = 2, predicate = null) {
  const snapshot = structuredClone(value); snapshot.state.seatSessions = [];
  await writeFile(fixture.checkpointPath, JSON.stringify(snapshot));
  await fixture.start(); await connect(count);
  assert.ok(clients.every(client => client.welcome.recoveredFromCheckpoint), fixture.logs);
  if (predicate) await clients[0].state(predicate, 'restored mode advances');
  else await fixture.checkpoint(saved => saved.state.tickNumber > snapshot.state.tickNumber);
}

try {
  await fixture.start();
  assert.equal((await fixture.health()).map, BANNERFALL_RULES.mapId);
  await connect(1);
  assert.equal(clients[0].welcome.matchModeId, 'bannerfall');
  assert.equal(clients[0].welcome.map.bannerfall.populationCap, 12);
  assert.ok(clients[0].latest.units.every(unit => unit[5] === 'infantry'));
  const waitingTick = clients[0].latest.tick;
  const waiting = await fixture.checkpoint(saved => saved.state.tickNumber >= waitingTick + 15);
  assert.equal(waiting.state.scenarioClockStarted, false);
  assert.equal(waiting.state.matchElapsedSeconds, 0);
  assert.equal(clients[0].latest.scenarioClockStarted, false);
  assert.equal(clients[0].latest.matchElapsedSeconds, 0);
  assert.deepEqual([0, 1].map(team => live(clients[0].latest, team).length), [8, 8]);
  records.push({ name: 'Explicit human mode selects shipped arena; one PvP seat waits with 8 Infantry per side' });
  clients.push(await fixture.connect(1));
  await clients[0].state(state => state.matchElapsedSeconds >= 15
    && live(state, 0).length === 10 && live(state, 1).length === 10, 'ordinary first free wave');
  assert.deepEqual(clients[0].latest.food, [0, 0]);
  assert.deepEqual(clients[0].latest.wood, [0, 0]);
  assert.equal(clients[0].latest.winner, -1);
  const firstWave = await save();
  assert.equal(firstWave.state.bannerfall.nextWaveIndex, 2);
  assert.equal(Object.hasOwn(firstWave.mapDefinition, 'bannerfall'), false);
  records.push({ name: 'Two humans receive the first ordinary 15-second two-Infantry wave without paying resources',
    elapsed: firstWave.state.matchElapsedSeconds, counts: [10, 10] });

  const capped = structuredClone(firstWave);
  capped.state.matchElapsedSeconds = 44.8; capped.state.bannerfall.nextWaveIndex = 3;
  await restore(capped, 2, state => state.reinforcements.nextWaveAtSeconds === 60);
  assert.deepEqual([0, 1].map(team => live(clients[0].latest, team).length), [12, 12]);
  const atCap = await save();
  atCap.state.matchElapsedSeconds = 59.8;
  await restore(atCap, 2, state => state.reinforcements.nextWaveAtSeconds === 75);
  assert.deepEqual([0, 1].map(team => live(clients[0].latest, team).length), [12, 12]);
  assert.equal(clients[0].latest.reinforcements.nextWaveAtSeconds, 75);
  await save();
  records.push({ name: 'Due waves fill to 12 supply, then expire at cap without queueing a burst' });

  const combat = structuredClone(firstWave);
  combat.state.matchElapsedSeconds = 1; combat.state.bannerfall.nextWaveIndex = 1;
  combat.state.units.forEach(passive);
  const attackers = combat.state.units.filter(unit => unit.team === 0).slice(0, 6);
  const victims = combat.state.units.filter(unit => unit.team === 1).slice(0, 6);
  for (let index = 0; index < 6; index++) {
    Object.assign(attackers[index], { x: -0.6, z: index - 3 });
    Object.assign(victims[index], { x: 0.6, z: index - 3, hp: 1 });
  }
  await restore(combat);
  attackers.forEach((unit, index) => clients[0].send({ type: 'attack', ids: [unit.id], targetId: victims[index].id }));
  await clients[0].state(state => state.reinforcements.kills[0] === 6, 'six ordinary lethal attack commands');
  assert.equal(clients[0].latest.reinforcements.kinds[0], 'rider');
  assert.equal(clients[0].messages.filter(message => message.type === 'notice' && /RIDER REINFORCEMENTS UNLOCKED/.test(message.message)).length, 1);
  const evolved = await save();
  assert.equal(evolved.state.bannerfall.creditedGenerations.length, 6);
  assert.deepEqual(evolved.state.bannerfall.kills, [6, 0]);
  records.push({ name: 'Six authoritative enemy troop deaths credit once and visibly unlock future Rider waves' });

  delete process.env.RTS_MATCH_MODE_ID; delete process.env.RTS_MATCH_MODE_VERSION;
  await restore(evolved);
  assert.equal(clients[0].welcome.matchModeId, 'bannerfall');
  assert.deepEqual(clients[0].latest.reinforcements.kills, [6, 0]);
  assert.equal(clients[0].messages.filter(message => /RIDER REINFORCEMENTS UNLOCKED/.test(message.message || '')).length, 0);
  const resumed = await save();
  assert.deepEqual(resumed.state.bannerfall.creditedGenerations, evolved.state.bannerfall.creditedGenerations);
  resumed.state.matchElapsedSeconds = 29.8; resumed.state.bannerfall.nextWaveIndex = 2;
  await restore(resumed, 2, state => state.reinforcements.nextWaveAtSeconds === 45);
  assert.equal(live(clients[0].latest, 0).filter(unit => unit[5] === 'rider').length, 1);
  const riderWave = await save();
  records.push({ name: 'Saved mode and kill ledger beat fresh omission; a Rider costs two supply and is delivered by a later wave' });

  const emptyArmy = structuredClone(firstWave);
  emptyArmy.state.units.filter(unit => unit.team === 0).forEach(unit => { unit.hp = 0; passive(unit); });
  emptyArmy.state.matchElapsedSeconds = 29.8; emptyArmy.state.bannerfall.nextWaveIndex = 2;
  await restore(emptyArmy, 2, state => state.reinforcements.nextWaveAtSeconds === 45);
  assert.equal(clients[0].latest.winner, -1);
  assert.equal(live(clients[0].latest, 0).length, 2);
  await save();
  records.push({ name: 'Losing every troop does not defeat a living core; its next wave repopulates the side' });

  function coreFight(simultaneous) {
    const snapshot = structuredClone(firstWave);
    snapshot.state.matchElapsedSeconds = 1; snapshot.state.bannerfall.nextWaveIndex = 1;
    snapshot.state.units.forEach(passive);
    for (const team of simultaneous ? [0, 1] : [0]) {
      snapshot.state.homeTownCenters[1 - team].hp = 0.1;
      const attacker = snapshot.state.units.find(unit => unit.team === team);
      Object.assign(attacker, { x: team === 0 ? 13 : -13, z: 0,
        attackBuildingTargetId: 1_000_000_000 + 1 - team });
    }
    return snapshot;
  }
  await restore(coreFight(false), 2, state => state.winner === 0);
  assert.equal(clients[0].latest.winnerReason, 'stronghold-destruction');
  assert.ok(live(clients[0].latest, 1).length > 0);
  const terminal = await save();
  await restore(terminal, 2, state => state.winner === 0);
  assert.equal(clients[0].latest.matchElapsedSeconds, Number(terminal.state.matchElapsedSeconds.toFixed(1)));
  assert.deepEqual(clients[0].latest.reinforcements.kills, terminal.state.bannerfall.kills);
  const frozen = await save();
  assert.equal(frozen.state.matchElapsedSeconds, terminal.state.matchElapsedSeconds);
  records.push({ name: 'Actual lethal structure combat defeats an army-bearing side; restored result freezes waves, score and clock' });

  await restore(coreFight(true), 2, state => state.winner === 2);
  assert.equal(clients[0].latest.winnerReason, 'stronghold-destruction');
  const drawn = await save();
  assert.ok(drawn.state.homeTownCenters.every(center => center.hp === 0));
  records.push({ name: 'Both original cores receive lethal damage in the same combat tick and draw' });
  await restore(drawn, 2, state => state.winner === 2);
  clients[0].send({ type: 'reset' });
  await clients[0].state(state => state.winner === -1 && state.reinforcements.kills.every(kills => kills === 0), 'ordinary rematch resets mode state');
  const reset = await save();
  assert.equal(reset.matchModeId, 'bannerfall');
  assert.deepEqual(reset.state.bannerfall.creditedGenerations, []);
  assert.equal(reset.state.bannerfall.nextWaveIndex, 1);
  assert.ok(reset.state.homeTownCenters.every(center => center.hp === 2400));
  records.push({ name: 'Host rematch retains mode while resetting cores, evolution, receipts and wave schedule' });

  const invalidVersion = structuredClone(riderWave); invalidVersion.state.bannerfall.version = 99;
  const unearnedRider = structuredClone(firstWave); unearnedRider.state.units[0].kind = 'rider';
  const unpaidUpgrade = structuredClone(firstWave); unpaidUpgrade.state.teamUpgrades[0].infantryAttack = true;
  const friendlyTarget = structuredClone(firstWave);
  friendlyTarget.state.units[0].attackTargetId = 2;
  assert.equal(friendlyTarget.state.units[0].team, friendlyTarget.state.units[2].team);
  const brokenOpening = structuredClone(reset);
  brokenOpening.state.scenarioClockStarted = false; brokenOpening.state.matchElapsedSeconds = 0;
  brokenOpening.state.units[0].hp = 0;
  for (const [invalid, label] of [[invalidVersion, 'Unsupported mode-state version'],
    [unearnedRider, 'Rider roster without earned evolution'],
    [unpaidUpgrade, 'Technology outside the zero-economy mode'],
    [friendlyTarget, 'Friendly troop target that could award false kill credit'],
    [brokenOpening, 'Damaged opening before the human clock starts']]) {
    invalid.state.seatSessions = [];
    const bytes = JSON.stringify(invalid), priorFiles = new Set(await readdir(fixture.directory));
    await writeFile(fixture.checkpointPath, bytes);
    process.env.RTS_MATCH_MODE_ID = 'bannerfall'; process.env.RTS_MATCH_MODE_VERSION = '1';
    await fixture.start(); await connect();
    assert.equal(clients[0].welcome.recoveredFromCheckpoint, false);
    await save();
    const rejected = (await readdir(fixture.directory)).filter(name => !priorFiles.has(name) && name.startsWith('match.json.rejected-'));
    assert.equal(rejected.length, 1);
    assert.equal(await readFile(path.join(fixture.directory, rejected[0]), 'utf8'), bytes);
    records.push({ name: `${label} is retained byte-for-byte, never reinterpreted` });
  }

  process.env.RTS_SOLO_PRACTICE = '1';
  await writeFile(fixture.checkpointPath, '');
  await fixture.start(); await connect(1);
  await clients[0].state(state => state.scenarioClockStarted && state.matchElapsedSeconds > 0, 'one-seat Practice starts');
  assert.equal(clients[0].latest.matchModeId, 'bannerfall');
  await save();
  records.push({ name: 'Explicit one-human Practice starts the same mode without inventing an AI controller' });

  console.log(JSON.stringify({ status: 'passed', records,
    serverSha256: createHash('sha256').update(await readFile(new URL('../server.mjs', import.meta.url))).digest('hex'),
    limits: ['First wave uses ordinary connected play. Later timer/cap and lethal combat boundaries use deliberate valid checkpoint fixtures.',
      'Blocked-spawn expiry and receipt reuse/wrap are pure rule checks; no rendered, deployed, AI or balance acceptance claim.'] }));
} finally {
  await fixture.dispose();
  for (const key of keys) if (inherited[key] === undefined) delete process.env[key]; else process.env[key] = inherited[key];
}
