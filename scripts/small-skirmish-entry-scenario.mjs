import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { NORMAL_MATCH_MAP_ID, NORMAL_HUMAN_MATCH_MODE } from '../src/match-modes.mjs';

const mapId = 'veyrholds-threefold-basin';
const fixture = await createFortifiedFixture({ supervisor: true, mapPath: null, timeoutMs: 45000 });
const origin = `http://127.0.0.1:${fixture.port}`;
const lobby = client => client.messages.findLast(message => message.type === 'lobby')?.lobby ?? client.latest.lobby;
async function exchange(client, command, predicate) {
  const after = client.messages.length; client.send(command);
  return client.wait(predicate, command.type, after);
}
try {
  await fixture.start();
  const response = await fetch(`${origin}/api/rooms`, { method: 'POST',
    headers: { 'content-type': 'application/json', origin }, body: JSON.stringify({ mode: 'pvp', pregame: true }) });
  assert.equal(response.status, 201);
  const room = await response.json();
  const clients = [await fixture.connect(0, null, room.roomId), await fixture.connect(1, null, room.roomId)];
  assert.equal(clients[0].welcome.map.id, NORMAL_MATCH_MAP_ID);
  const choice = clients[0].welcome.maps.find(map => map.id === mapId);
  assert.deepEqual([choice.width, choice.height, choice.sizeTierLabel, choice.selectable], [192, 192, 'Small', true]);
  assert.ok(choice.matchModes.some(mode => mode.id === 'skirmish' && mode.selectable));
  await exchange(clients[0], { type: 'configureLobby', revision: lobby(clients[0]).revision,
    mapId, ...NORMAL_HUMAN_MATCH_MODE }, message => message.type === 'lobby' && message.lobby.mapId === mapId);
  for (const client of clients) await exchange(client, { type: 'setReady', revision: lobby(client).revision,
    ready: true }, message => message.type === 'lobby'
    && message.lobby.seats.some(seat => seat.id === client.welcome.player.id && seat.ready));
  await exchange(clients[0], { type: 'launchMatch', revision: lobby(clients[0]).revision },
    message => message.type === 'lobby' && message.lobby.phase === 'running');
  for (const client of clients) await client.state(state => state.scenarioClockStarted, 'Small human clock');
  for (const [team, client] of clients.entries()) {
    const workers = client.latest.units.filter(unit => unit[1] === team && unit[5] === 'worker');
    const home = client.latest.homeTownCenters.find(center => center.team === team);
    await client.command({ type: 'build', buildingType: 'house', ids: [workers[0][0]],
      x: home.x + (team === 0 ? 10 : -10), z: home.z + 12, clientOrderToken: 10 + team }, /HOUSE PLACED/);
    const placed = await client.state(state => state.buildings.some(building => building.type === 'house'), 'paid House foundation');
    assert.equal(placed.wood[team], 175, 'ordinary 250 wood pays the real 75-wood House price');
    await client.command({ type: 'gather', ids: workers.slice(1).map(unit => unit[0]),
      nodeId: `s${team}-home-food`, clientOrderToken: 20 + team }, /GATHER ORDER/);
  }
  for (const [team, client] of clients.entries()) await client.state(state => state.food[team] > 150
    && state.buildings.some(building => building.team === team && building.type === 'house' && building.complete),
  'paid construction and actual food deposit');
  const tokens = clients.map(client => client.welcome.player.sessionToken);
  const checkpointPath = path.join(fixture.directory, 'rooms', 'rooms', room.roomId, 'match-state.json');
  await fixture.stop();
  const saved = JSON.parse(await readFile(checkpointPath, 'utf8'));
  assert.equal(saved.mapDefinition.id, mapId); assert.equal(saved.matchModeId, 'skirmish');
  await fixture.start();
  for (const team of [0, 1]) {
    const resumed = await fixture.connect(team, tokens[team], room.roomId);
    assert.equal(resumed.welcome.map.id, mapId); assert.equal(resumed.welcome.matchModeId, 'skirmish');
    assert.ok(resumed.latest.buildings.some(building => building.team === team && building.type === 'house' && building.complete));
    assert.ok(resumed.latest.food[team] >= saved.state.teamFood[team]);
  }
  console.log(JSON.stringify({ status: 'passed', mapId, nativeIdentity: 'skirmish@1',
    normalCreateRoom: true, bothSeatsPaidHouse: true, bothSeatsDepositedFood: true, coldSeatResume: true,
    canonicalMapHash: saved.mapHash, schemaVersion: saved.schemaVersion,
    serverSha256: createHash('sha256').update(await readFile(new URL('../server.mjs', import.meta.url))).digest('hex'),
    limits: ['Ordinary supervisor/native commands without grants or checkpoint edits; no full battle, capacity, AI, browser or deployed claim.'] }));
} finally { await fixture.dispose(); }
