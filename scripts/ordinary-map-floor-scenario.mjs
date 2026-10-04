// Ordinary fresh entry, historical rooms and explicit Practice Labs through the real supervisor.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { NORMAL_MATCH_MAP_ID, NORMAL_HUMAN_MATCH_MODE } from '../src/match-modes.mjs';
import { FRESH_PVE_UNAVAILABLE_REASON } from '../src/room-launch-options.mjs';

const fixture = await createFortifiedFixture({ supervisor: true, mapPath: null, timeoutMs: 15000 });
const records = [], origin = `http://127.0.0.1:${fixture.port}`;
const authored = { matchModeId: 'authored', matchModeVersion: 1 };
const mode = value => ({ matchModeId: value.matchModeId, matchModeVersion: value.matchModeVersion });
const ordinary = rows => rows.filter(row => row.selectable && !row.internalFixture);
const json = async url => (await fetch(`${origin}${url}`)).json();
async function create(options) {
  const response = await fetch(`${origin}/api/rooms`, { method: 'POST',
    headers: { 'content-type': 'application/json', origin }, body: JSON.stringify(options) });
  assert.equal(response.status, 201); return response.json();
}
async function exchange(client, command, predicate) {
  const after = client.messages.length; client.send(command);
  return client.wait(predicate, command.type, after);
}
function lobby(client) {
  return client.messages.findLast(row => row.type === 'lobby')?.lobby ?? client.latest.lobby ?? client.welcome.lobby;
}
async function ready(client) {
  await exchange(client, { type: 'setReady', revision: lobby(client).revision, ready: true },
    row => row.type === 'lobby' && row.lobby.seats.some(seat => seat.id === client.welcome.player.id && seat.ready));
}
try {
  await fixture.start();
  const status = await json('/api/rooms/status');
  assert.equal(status.ordinarySetup.minimumSide, 160);
  assert.deepEqual(mode(status.ordinarySetup), NORMAL_HUMAN_MATCH_MODE);
  assert.deepEqual(status.ordinarySetup.mapSizeTiers.map(tier => [tier.id, tier.side, tier.engineLimitAllows]),
    [['tiny',160,true],['small',192,true],['medium',224,true],['large',256,true],['xl',320,false]]);
  assert.deepEqual(mode(status.practiceSetup), authored);
  assert.equal(status.practiceSetup.map.id, NORMAL_MATCH_MAP_ID);
  assert.equal(status.practiceSetup.map.sizeTierLabel, 'Tiny');
  assert.deepEqual(status.ordinarySetup.pve, { available: false, reason: FRESH_PVE_UNAVAILABLE_REASON });
  const root = await fixture.connect(0);
  assert.equal(root.welcome.map.id, NORMAL_MATCH_MAP_ID);
  assert.deepEqual(mode(root.welcome), NORMAL_HUMAN_MATCH_MODE);
  assert.ok(root.welcome.maps.every(row => row.width >= 160 && row.height >= 160 && row.selectable));
  assert.deepEqual(root.welcome.maps.map(map => [map.id, map.width, map.height, map.sizeTierId]).sort(), [
    ['frontier-160', 160, 160, 'tiny'],
    ['veyrholds-terraced-vale', 160, 160, 'tiny'],
    ['veyrholds-threefold-basin', 192, 192, 'small'],
    ['woodland-expanse', 160, 160, 'tiny'],
  ]);
  const small = root.welcome.maps.find(map => map.id === 'veyrholds-threefold-basin');
  assert.equal(small.ordinarySelectable, true);
  assert.equal(small.supportedUnitCapacity, null);
  assert.deepEqual(small.matchModes.map(mode => [mode.id, mode.version]), [['authored', 1], ['skirmish', 1]],
    'Small exposes only its actual authored and registered human Skirmish rules');
  assert.equal(root.latest.scenarioClockStarted, false);
  records.push({ name: 'Unconfigured root and fresh status use Tiny Skirmish; three real Tiny maps and reviewed Small are ordinary choices; XL remains unavailable' });

  const created = await create({ mode: 'pvp', pregame: true });
  assert.deepEqual(created.launchOptions, { mode: 'pvp', pregame: true, ...NORMAL_HUMAN_MATCH_MODE });
  const host = await fixture.connect(0, null, created.roomId), guest = await fixture.connect(1, null, created.roomId);
  assert.equal(host.welcome.map.id, NORMAL_MATCH_MAP_ID);
  await ready(host); await ready(guest);
  const before = structuredClone(lobby(host));
  for (const command of [{ type: 'configureLobby', revision: before.revision, mapId: 'bellweather-millrace', ...authored },
    { type: 'configureLobby', revision: before.revision, mapId: 'stone-defense-field', ...authored }]) {
    const denied = await exchange(host, command, row => row.type === 'lobbyRejected');
    assert.deepEqual(denied.lobby, before, 'compact-map rejection preserves accepted readiness and settings');
  }
  const smallMap = { id: 'too-small-ordinary', name: 'Too Small Ordinary', width: 64, height: 64,
    obstacles: [], spawnPoints: [{ team: 0, x: -12, z: 0 }, { team: 1, x: 12, z: 0 }], triggers: [], resourceNodes: [] };
  await exchange(host, { type: 'launchMatch', revision: before.revision }, row => row.type === 'lobby' && row.lobby.phase === 'running');
  await host.state(state => state.scenarioClockStarted, 'ordinary two-seat clock starts');
  const deniedMap = await exchange(host, { type: 'publishMap', map: smallMap }, row => row.type === 'mapRejected');
  assert.match(deniedMap.message, /160/);
  assert.deepEqual(mode(host.latest), NORMAL_HUMAN_MATCH_MODE);
  records.push({ name: 'Create Room starts Tiny Skirmish; forged compact map/configuration is rejected atomically, and both ready humans launch normally' });

  const control = await create({ mode: 'pvp', pregame: true, matchModeId: 'objective-control', matchModeVersion: 1 });
  const objective = await fixture.connect(0, null, control.roomId);
  const woodland = JSON.parse(await readFile(new URL('../maps/woodland-expanse.json', import.meta.url)));
  assert.equal(objective.welcome.map.id, woodland.id);
  assert.equal(objective.welcome.map.victoryHoldSeconds, woodland.victoryHoldSeconds);
  assert.deepEqual(objective.welcome.map.timedVictory, woodland.timedVictory);
  assert.deepEqual(objective.welcome.map.triggers, woodland.triggers);
  records.push({ name: 'Explicit Objective Control selects Woodland160 and retains exact authored post, hold and deadline rules' });

  const practiceRoom = await create({ mode: 'pvp', practice: true });
  const practice = await fixture.connect(0, null, practiceRoom.roomId);
  assert.equal(practice.welcome.map.id, NORMAL_MATCH_MAP_ID);
  assert.deepEqual(mode(practice.welcome), authored);
  assert.ok(ordinary(practice.welcome.maps).every(row => row.width >= 160 && row.height >= 160));
  for (const id of ['shore-fishing', 'stone-defense-field']) {
    const row = practice.welcome.maps.find(row => row.id === id);
    assert.ok(row && row.internalFixture && row.selectable && !row.ordinarySelectable);
    const changed = await exchange(practice, { type: 'selectMap', mapId: id }, row => row.type === 'mapChange' && row.map.id === id);
    assert.deepEqual(mode(changed), authored);
    assert.equal(changed.state.practice, true);
  }
  const worker = practice.latest.units.find(row => row[1] === 0 && row[5] === 'worker' && row[4] > 0);
  practice.send({ type: 'move', ids: [worker[0]], x: worker[2] + 2, z: worker[3] + 2, clientOrderToken: 1 });
  await practice.state(state => state.scenarioClockStarted, 'one-human Practice clock starts');
  records.push({ name: 'One-human Authored Practice opens Tiny and preserves explicit Shore Fishing and Stone Defense internal Labs' });

  const unavailable = await fetch(`${origin}/api/rooms`, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mode: 'pve', mapSeed: 0, policySeed: 1 }) });
  assert.equal(unavailable.status, 400); assert.equal((await unavailable.json()).error, FRESH_PVE_UNAVAILABLE_REASON);
  records.push({ name: 'Fresh ordinary AI creation is honestly unavailable while its160-map acceptance is pending' });

  await fixture.stop();
  const oldId = 'O'.repeat(32), aiId = 'A'.repeat(32);
  for (const id of [oldId, aiId]) await mkdir(path.join(fixture.directory, 'rooms', 'rooms', id), { recursive: true });
  await writeFile(path.join(fixture.directory, 'rooms', 'rooms.json'), JSON.stringify({ version: 2, rooms: [
    { id: oldId, createdAt: Date.now(), lastActiveAt: Date.now(), launchOptions: { mode: 'pvp' }, mapId: 'underbough-rootways' },
    { id: aiId, createdAt: Date.now(), lastActiveAt: Date.now(), launchOptions: { mode: 'pve', mapSeed: 0, policySeed: 1 }, mapId: 'bellweather-millrace' },
  ] }));
  await fixture.start();
  const historical = await fixture.connect(0, null, oldId);
  assert.equal(historical.welcome.map.id, 'underbough-rootways');
  assert.deepEqual(mode(historical.welcome), authored);
  const current = historical.welcome.maps.find(row => row.id === 'underbough-rootways');
  assert.ok(current.legacyCurrent && !current.selectable && !current.ordinarySelectable);
  assert.ok(historical.welcome.maps.filter(row => row.selectable).every(row => row.width >= 160 && row.height >= 160));
  const historicalCheckpoint = path.join(fixture.directory, 'rooms', 'rooms', oldId, 'match-state.json');
  const saved = await fixture.checkpoint(row => row.mapDefinition.id === 'underbough-rootways', historicalCheckpoint);
  const savedHash = saved.mapHash;
  const oldAI = await fixture.connect(0, null, aiId);
  assert.equal(oldAI.welcome.map.id, 'bellweather-millrace');
  assert.deepEqual(mode(oldAI.welcome), authored);
  assert.equal((await json(`/api/rooms/${aiId}`)).launchOptions.mode, 'pve');
  records.push({ name: 'An old index without checkpoint retains historical Rootways/Authored and displays its current legacy map disabled; old AI seeds still select Millrace' });
  await fixture.stop(); await fixture.start();
  const restored = await fixture.connect(0, historical.welcome.player.sessionToken, oldId);
  assert.equal(restored.welcome.recoveredFromCheckpoint, true);
  assert.equal(restored.welcome.map.id, 'underbough-rootways');
  assert.deepEqual(mode(restored.welcome), authored);
  const resumed = await fixture.checkpoint(row => row.sequence > saved.sequence, historicalCheckpoint);
  assert.equal(resumed.mapHash, savedHash);
  assert.deepEqual(resumed.mapDefinition, saved.mapDefinition);
  records.push({ name: 'Historical canonical map/hash and saved mode survive a real supervisor cold restart without being remapped to the fresh default' });
  console.log(JSON.stringify({ status: 'passed', records,
    serverSha256: createHash('sha256').update(await readFile(new URL('../server.mjs', import.meta.url))).digest('hex'),
    supervisorSha256: createHash('sha256').update(await readFile(new URL('../room-supervisor.mjs', import.meta.url))).digest('hex'),
    limits: ['Native room/protocol acceptance; browser rendering, identified staging deployment and AI capability acceptance remain open.',
      'Explicit RTS_MAP roots and one-human internal Labs are separate from ordinary fresh REST entry; canonical fixture validation stays16–256.'] }));
} finally { await fixture.dispose(); }
