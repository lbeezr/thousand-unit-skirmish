// Actual Millrace capture plus deliberate checkpoint boundary states.
// These checks establish native policy/recovery behavior, not rendered balance.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';

const fixture = await createFortifiedFixture({ mapPath: 'maps/bellweather-millrace.json', timeoutMs: 60000 });
const mapPath = new URL('../maps/bellweather-millrace.json', import.meta.url);
const sourceBytes = await readFile(mapPath);
const sourceMap = JSON.parse(sourceBytes);
const envKeys = ['RTS_MATCH_MODE_ID', 'RTS_MATCH_MODE_VERSION', 'RTS_PREGAME', 'RTS_SOLO_PRACTICE'];
const inherited = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
const records = [];
let clients, orderToken = 1;
function launchMode(id) {
  for (const key of envKeys) delete process.env[key];
  if (id) Object.assign(process.env, { RTS_MATCH_MODE_ID: id, RTS_MATCH_MODE_VERSION: '1' });
}
function assertIdentity(value, id) {
  assert.equal(value.matchModeId, id);
  assert.equal(value.matchModeVersion, 1);
}
function assertSkirmish(client) {
  assertIdentity(client.welcome, 'skirmish');
  assertIdentity(client.welcome.state, 'skirmish');
  assert.equal(client.welcome.map.triggers.some(trigger => trigger.victory === true), false);
  assert.equal(Object.hasOwn(client.welcome.map, 'victoryHoldSeconds'), false);
  assert.equal(Object.hasOwn(client.welcome.map, 'timedVictory'), false);
  assert.equal(client.welcome.state.victoryHold, null);
}
const mapHash = map => createHash('sha256').update(JSON.stringify(map)).digest('base64url');
const command = (team, value, expression) => clients[team].command(
  { ...value, clientOrderToken: orderToken++ }, expression);
async function connect() {
  clients = [await fixture.connect(0), await fixture.connect(1)];
}
async function restored(snapshot, launchId) {
  const saved = structuredClone(snapshot);
  saved.state.seatSessions = [];
  await writeFile(fixture.checkpointPath, JSON.stringify(saved));
  launchMode(launchId);
  await fixture.start(); await connect();
  assert.ok(clients.every(client => client.welcome.recoveredFromCheckpoint), fixture.logs);
  assert.ok(clients.every(client => client.welcome.matchId === saved.matchId));
  await fixture.checkpoint(value => value.state.tickNumber >= saved.state.tickNumber + 12);
  await fixture.stop();
  return fixture.checkpoint();
}
function completeRelief(snapshot) {
  snapshot.state.scenarioEventStates.find(event => event.id === 'relief').fired = true;
  for (const team of [0, 1]) {
    snapshot.state.teamFood[team] += 100;
    snapshot.state.teamWood[team] += 75;
  }
}

try {
  launchMode();
  await fixture.start(); await connect();
  assert.ok(clients.every(client => !client.welcome.recoveredFromCheckpoint));
  assert.ok(clients.every(client => client.welcome.matchModeId === 'authored'));
  await fixture.stop();
  const authored = await fixture.checkpoint();
  assert.deepEqual(authored.mapDefinition.triggers, sourceMap.triggers);
  assert.deepEqual(authored.mapDefinition.scenarioEvents, sourceMap.scenarioEvents);
  assert.equal(authored.mapHash, mapHash(authored.mapDefinition));

  await rm(fixture.checkpointPath);
  launchMode('skirmish');
  await fixture.start(); await connect();
  assert.ok(clients.every(client => !client.welcome.recoveredFromCheckpoint));
  clients.forEach(assertSkirmish);
  const fresh = await fixture.checkpoint();
  assertIdentity(fresh, 'skirmish');
  assert.equal(fresh.schemaVersion, 30);
  assert.deepEqual(fresh.mapDefinition, authored.mapDefinition);
  assert.equal(fresh.mapHash, authored.mapHash);
  records.push({ name: 'Fresh Skirmish projects client rules and preserves canonical map/checksum', mapHash: fresh.mapHash });

  const post = sourceMap.triggers[0];
  const army = clients[0].latest.units.filter(unit => unit[1] === 0 && unit[5] === 'infantry').map(unit => unit[0]);
  assert.equal(army.length, 8);
  const beforeFood = clients[0].latest.food[0], beforeWood = clients[0].latest.wood[0];
  const after = clients[0].messages.length;
  await command(0, { type: 'move', ids: army,
    x: post.zone.column + post.zone.width / 2 - sourceMap.width / 2,
    z: post.zone.row + post.zone.height / 2 - sourceMap.height / 2 }, /MOVE ORDER/);
  const capture = await clients[0].wait(message => message.type === 'trigger' && message.triggerId === post.id,
    'normal army capture earns the post bonus', after);
  assert.equal(capture.team, 0);
  assert.match(capture.message, /\+75 FOOD.*\+50 WOOD/);
  await clients[0].state(state => state.objectives.find(objective => objective.id === post.id)?.owner === 0
    && state.food[0] === beforeFood + 75 && state.wood[0] === beforeWood + 50, 'capture reward banks');
  assert.equal(clients[0].latest.winner, -1);
  assert.ok(clients[0].latest.matchElapsedSeconds < 120, 'capture proof precedes relief income');
  for (const team of [0, 1]) await command(team, { type: 'stop',
    ids: clients[team].latest.units.filter(unit => unit[1] === team).map(unit => unit[0]) }, /STOP ORDER/);
  await fixture.stop();
  const captured = await fixture.checkpoint();
  assert.deepEqual(captured.mapDefinition, authored.mapDefinition);
  assert.equal(captured.mapHash, authored.mapHash);
  records.push({ name: 'Actual eight-Infantry movement and nine-second post capture keeps +75 food/+50 wood',
    elapsed: captured.state.matchElapsedSeconds, winner: captured.state.matchWinner });

  const owned = structuredClone(captured);
  owned.state.triggerStates.forEach(state => Object.assign(state, { owner: 0, progressTeam: -1, progress: 0 }));
  owned.state.scenarioClockStarted = true;
  owned.state.matchElapsedSeconds = 901;
  completeRelief(owned);
  const afterDeadline = await restored(owned);
  clients.forEach(assertSkirmish);
  assertIdentity(afterDeadline, 'skirmish');
  assert.equal(afterDeadline.state.matchWinner, -1);
  assert.equal(afterDeadline.state.matchWinnerReason, null);
  assert.ok(afterDeadline.state.matchElapsedSeconds > 901);
  assert.ok(afterDeadline.state.triggerStates.every(state => state.owner === 0));
  assert.equal(afterDeadline.mapHash, authored.mapHash);
  records.push({ name: 'Saved Skirmish overrides absent launch identity; all posts owned after 900s cannot win',
    elapsed: afterDeadline.state.matchElapsedSeconds, winner: afterDeadline.state.matchWinner });

  const stranded = structuredClone(captured);
  for (const unit of stranded.state.units) if (unit.team === 0 && unit.kind !== 'worker') unit.hp = 0;
  const workers = stranded.state.units.filter(unit => unit.team === 0 && unit.kind === 'worker');
  workers.slice(1).forEach(unit => { unit.hp = 0; });
  stranded.state.homeTownCenters[0].hp = 0;
  stranded.state.teamFood[0] = 0; stranded.state.teamWood[0] = 0;
  assert.equal(stranded.state.buildings.length, 0);
  assert.equal(stranded.state.workerProduction[0].queue, 0);
  const worker = await restored(stranded, 'skirmish');
  assert.equal(worker.state.matchWinner, -1);
  assert.equal(worker.state.homeTownCenters[0].hp, 0);
  assert.equal(worker.state.units.filter(unit => unit.team === 0 && unit.hp > 0).length, 1);
  assert.equal(worker.state.teamFood[0], 0); assert.equal(worker.state.teamWood[0], 0);
  records.push({ name: 'A remaining Worker survives destroyed Town Center with zero resources', winner: -1 });
  const defeated = structuredClone(worker);
  defeated.state.units.filter(unit => unit.team === 0).forEach(unit => { unit.hp = 0; });
  const eliminated = await restored(defeated, 'skirmish');
  assert.equal(eliminated.state.matchWinner, 1);
  assert.equal(eliminated.state.matchWinnerReason, 'elimination');
  records.push({ name: 'No land units or recoverable production loses by elimination', winner: 1, reason: 'elimination' });

  const legacy = structuredClone(authored);
  // Mode identity was added after military stance; retain that prior state shape.
  legacy.schemaVersion = 26;
  delete legacy.state.voluntaryEndings;
  delete legacy.matchModeId; delete legacy.matchModeVersion;
  // Schema28 added herd state. A real schema26 fixture cannot claim it while
  // testing the unchanged authored mode migration.
  for (const node of legacy.state.resourceNodes) {
    delete node.wildlifeHerd; delete node.wildlifeGrazeAnchor;
  }
  legacy.state.triggerStates.forEach(state => Object.assign(state,
    { owner: state.id === 'post-2' ? 1 : 0, progressTeam: -1, progress: 0 }));
  legacy.state.scenarioClockStarted = true; legacy.state.matchElapsedSeconds = 899.95;
  completeRelief(legacy);
  const deadline = await restored(legacy, 'skirmish');
  assertIdentity(deadline, 'authored');
  assert.ok(clients.every(client => client.welcome.matchModeId === 'authored'));
  assert.deepEqual(clients[0].welcome.map.timedVictory, sourceMap.timedVictory);
  assert.equal(clients[0].welcome.map.victoryHoldSeconds, 20);
  assert.ok(clients[0].welcome.map.triggers.every(trigger => trigger.victory === true));
  assert.equal(deadline.state.matchWinner, 1);
  assert.equal(deadline.state.matchWinnerReason, 'timed-control');
  assert.equal(deadline.state.matchWinnerTriggerId, 'post-2');
  assert.equal(deadline.mapHash, authored.mapHash);
  records.push({ name: 'Genuine schema-26 authored identity beats fresh Skirmish configuration and retains deadline',
    schemaVersion: deadline.schemaVersion, winner: 1, reason: 'timed-control' });

  for (const identity of [{ matchModeId: 'unknown', matchModeVersion: 1 },
    { matchModeId: 'skirmish', matchModeVersion: 99 }]) {
    const rejected = Object.assign(structuredClone(captured), identity);
    rejected.state.seatSessions = [];
    const serialized = JSON.stringify(rejected);
    const priorFiles = new Set(await readdir(fixture.directory));
    await writeFile(fixture.checkpointPath, serialized);
    launchMode('skirmish'); await fixture.start(); await connect();
    assert.ok(clients.every(client => !client.welcome.recoveredFromCheckpoint));
    assert.ok(clients.every(client => client.welcome.matchId !== rejected.matchId));
    clients.forEach(assertSkirmish);
    await fixture.stop();
    const files = (await readdir(fixture.directory)).filter(name => !priorFiles.has(name) && name.startsWith('match.json.rejected-'));
    assert.equal(files.length, 1);
    assert.equal(await readFile(path.join(fixture.directory, files[0]), 'utf8'), serialized);
    records.push({ name: `Unsupported ${identity.matchModeId}@${identity.matchModeVersion} is retained byte-for-byte, not resumed` });
  }
  assert.deepEqual(await readFile(mapPath), sourceBytes, 'canonical shipped map bytes remain unchanged');
  console.log(JSON.stringify({ status: 'passed', records,
    serverSha256: createHash('sha256').update(await readFile(new URL('../server.mjs', import.meta.url))).digest('hex'),
    limits: ['Capture uses ordinary move orders; clock, ownership and defeat boundaries are deliberate checkpoint fixtures.',
      'No rendered, deployed-match, AI-support or match-duration balance claim.'] }));
} finally {
  await fixture.dispose();
  for (const key of envKeys) {
    if (inherited[key] === undefined) delete process.env[key];
    else process.env[key] = inherited[key];
  }
}
