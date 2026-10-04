// Real ordinary map selection, paid economy and process recovery; no state injection.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { NORMAL_MATCH_MAP_ID, NORMAL_HUMAN_MATCH_MODE } from '../src/match-modes.mjs';
import { lobbyMapConfiguration } from '../src/match-mode-controls.mjs';

const mapId = 'veyrholds-riven-escarpment';
const identity = value => ({ matchModeId: value.matchModeId, matchModeVersion: value.matchModeVersion });
const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const sourceDirty = Boolean(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim());
const inputNames = ['server.mjs', 'room-supervisor.mjs', 'src/match-modes.mjs',
  'src/match-mode-controls.mjs', 'scripts/medium-skirmish-entry-scenario.mjs', `maps/${mapId}.json`];
const inputSHA256 = Object.fromEntries(await Promise.all(inputNames.map(async name =>
  [name, createHash('sha256').update(await readFile(new URL(`../${name}`, import.meta.url))).digest('hex')])));
const fixture = await createFortifiedFixture({ supervisor: true, mapPath: null, timeoutMs: 45000 });
const origin = `http://127.0.0.1:${fixture.port}`;
const lobby = client => client.messages.findLast(row => row.type === 'lobby')?.lobby ?? client.latest.lobby;
async function exchange(client, command, predicate) {
  const after = client.messages.length; client.send(command);
  return client.wait(predicate, command.type, after);
}
const startedAt = new Date().toISOString();
try {
  await fixture.start();
  const status = await (await fetch(`${origin}/api/rooms/status`)).json();
  assert.deepEqual(status.ordinarySetup.pve, { available: true, mapId: NORMAL_MATCH_MAP_ID,
    supportedMapIds: [NORMAL_MATCH_MAP_ID], ...NORMAL_HUMAN_MATCH_MODE });
  const response = await fetch(`${origin}/api/rooms`, { method: 'POST',
    headers: { 'content-type': 'application/json', origin }, body: JSON.stringify({ mode: 'pvp', pregame: true }) });
  assert.equal(response.status, 201);
  const room = await response.json();
  assert.deepEqual(room.launchOptions, { mode: 'pvp', pregame: true, ...NORMAL_HUMAN_MATCH_MODE });
  const clients = [await fixture.connect(0, null, room.roomId), await fixture.connect(1, null, room.roomId)];
  assert.equal(clients[0].welcome.map.id, NORMAL_MATCH_MAP_ID);
  await clients[0].wait(row => row.type === 'lobby' && row.lobby.seats.filter(seat => seat.connected).length === 2,
    'host sees both admitted seats');
  const choice = lobby(clients[0]).maps.find(map => map.id === mapId);
  assert.deepEqual([choice.width, choice.height, choice.sizeTierLabel, choice.selectable], [224, 224, 'Medium', true]);
  assert.equal(choice.ordinarySelectable, true);
  assert.equal(choice.supportedUnitCapacity, null);
  assert.equal(choice.matchModes.find(mode => mode.id === 'skirmish').pveSupported, false);
  const configuration = lobbyMapConfiguration(lobby(clients[0]), choice);
  assert.deepEqual(configuration, { mapId }, 'ordinary map choice preserves Skirmish without another mode opt-in');
  const changes = clients.map(client => client.wait(row => row.type === 'mapChange' && row.map.id === mapId,
    'both seats receive Medium', client.messages.length));
  await exchange(clients[0], { type: 'configureLobby', revision: lobby(clients[0]).revision, ...configuration },
    row => row.type === 'lobby' && row.lobby.mapId === mapId);
  for (const changed of await Promise.all(changes)) {
    assert.deepEqual(identity(changed), NORMAL_HUMAN_MATCH_MODE);
    assert.equal(Buffer.from(changed.state.visibility.data, 'base64').length, 12544);
  }
  for (const client of clients) await exchange(client, { type: 'setReady', revision: lobby(client).revision,
    ready: true }, row => row.type === 'lobby'
    && row.lobby.seats.some(seat => seat.id === client.welcome.player.id && seat.ready));
  await clients[0].wait(row => row.type === 'lobby' && row.lobby.canLaunch, 'host sees both Ready acknowledgements');
  await exchange(clients[0], { type: 'launchMatch', revision: lobby(clients[0]).revision },
    row => row.type === 'lobby' && row.lobby.phase === 'running');
  for (const client of clients) await client.state(state => state.scenarioClockStarted, 'Medium two-human clock');
  for (const [team, client] of clients.entries()) {
    const workers = client.latest.units.filter(unit => unit[1] === team && unit[5] === 'worker');
    const home = client.latest.homeTownCenters.find(center => center.team === team);
    assert.equal(workers.length, 4);
    await client.command({ type: 'build', buildingType: 'house', ids: [workers[0][0]],
      x: home.x + (team === 0 ? 10 : -10), z: home.z + 12, clientOrderToken: 10 + team }, /HOUSE PLACED/);
    const placed = await client.state(state => state.buildings.some(building => building.team === team
      && building.type === 'house'), 'paid House foundation');
    assert.equal(placed.wood[team], 175, 'the real75-wood House price is paid');
    await client.command({ type: 'gather', ids: workers.slice(1).map(unit => unit[0]),
      nodeId: `s${team}-home-food`, clientOrderToken: 20 + team }, /GATHER ORDER/);
  }
  for (const [team, client] of clients.entries()) await client.state(state => state.food[team] > 150
    && state.buildings.some(building => building.team === team && building.type === 'house' && building.complete),
  'paid construction and food deposit');
  const tokens = clients.map(client => client.welcome.player.sessionToken);
  const checkpointPath = path.join(fixture.directory, 'rooms', 'rooms', room.roomId, 'match-state.json');
  await fixture.stop();
  const saved = JSON.parse(await readFile(checkpointPath, 'utf8'));
  assert.deepEqual(identity(saved), NORMAL_HUMAN_MATCH_MODE);
  assert.equal(saved.mapDefinition.id, mapId);
  await fixture.start();
  const resumed = [await fixture.connect(0, tokens[0], room.roomId), await fixture.connect(1, tokens[1], room.roomId)];
  for (const [team, client] of resumed.entries()) {
    assert.ok(client.welcome.recoveredFromCheckpoint && client.welcome.player.resumed);
    assert.equal(client.welcome.matchId, saved.matchId);
    assert.equal(client.welcome.map.id, mapId);
    assert.deepEqual(identity(client.welcome), NORMAL_HUMAN_MATCH_MODE);
    assert.equal(Buffer.from(client.latest.visibility.data, 'base64').length, 12544);
    assert.ok(client.latest.buildings.some(building => building.team === team && building.type === 'house' && building.complete));
    assert.ok(client.latest.food[team] >= saved.state.teamFood[team]);
  }
  const restored = await fixture.checkpoint(snapshot => snapshot.sequence > saved.sequence, checkpointPath);
  assert.equal(restored.mapHash, saved.mapHash);
  assert.deepEqual(restored.mapDefinition, saved.mapDefinition);
  const metadata = await (await fetch(`${origin}/api/rooms/${room.roomId}`)).json();
  assert.deepEqual(metadata.roomMetadata, { mapId, ...NORMAL_HUMAN_MATCH_MODE });
  // Human pregame reset acknowledges the return to the lobby, then sends its opening state.
  await exchange(resumed[0], { type: 'reset' }, row => row.type === 'lobby'
    && row.lobby.phase === 'lobby' && row.lobby.mapId === mapId);
  const reset = await resumed[0].state(state => state.armySize === 24 && state.buildings.length === 0
    && state.food[0] === 150 && state.wood[0] === 250 && state.lobby?.phase === 'lobby', 'Medium host rematch opening');
  assert.deepEqual(identity(reset), NORMAL_HUMAN_MATCH_MODE);
  assert.equal(lobby(resumed[0]).mapId, mapId);
  console.log(JSON.stringify({ status: 'passed', sourceRevision, sourceDirty, inputSHA256, startedAt,
    finishedAt: new Date().toISOString(), mapId, dimensions: [224, 224], nativeIdentity: 'skirmish@1',
    normalCreateRoom: true, mapOnlySelectionKeepsSkirmish: true, packedFogBytesPerSeat: 12544,
    bothSeatsPaidHouse: true, bothSeatsDepositedFood: true, realColdSeatResume: true,
    rematchKeepsMapAndMode: true, canonicalMapHash: saved.mapHash, schemaVersion: saved.schemaVersion,
    limits: ['Native ordinary commands without grants or checkpoint edits; no full battle, balance, AI, capacity, browser or deployment claim.'] }));
} finally { await fixture.dispose(); }
