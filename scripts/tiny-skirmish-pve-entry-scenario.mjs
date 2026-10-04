// Real New Game API, paid human orders and an OS supervisor/worker restart.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { NORMAL_MATCH_MAP_ID, NORMAL_HUMAN_MATCH_MODE } from '../src/match-modes.mjs';
import { FRESH_PVE_UNSUPPORTED_REASON } from '../src/room-launch-options.mjs';

const fixture = await createFortifiedFixture({ supervisor: true,
  mapPath: 'maps/veyrholds-threefold-basin.json', timeoutMs: 45000 });
const origin = `http://127.0.0.1:${fixture.port}`;
const identity = value => ({ matchModeId: value.matchModeId, matchModeVersion: value.matchModeVersion });
const create = options => fetch(`${origin}/api/rooms`, { method: 'POST',
  headers: { 'content-type': 'application/json', origin }, body: JSON.stringify(options) });
try {
  await fixture.start();
  const status = await (await fetch(`${origin}/api/rooms/status`)).json();
  assert.deepEqual(status.ordinarySetup.pve, { available: true, mapId: NORMAL_MATCH_MAP_ID,
    supportedMapIds: [NORMAL_MATCH_MAP_ID], ...NORMAL_HUMAN_MATCH_MODE });
  const count = status.roomCount;
  for (const options of [{ mode: 'pve', matchModeId: 'authored', matchModeVersion: 1 },
    { mode: 'pve', matchModeId: 'objective-control', matchModeVersion: 1 },
    { mode: 'pve', matchModeId: 'bannerfall', matchModeVersion: 1 },
    { mode: 'pve', mapId: 'veyrholds-threefold-basin', ...NORMAL_HUMAN_MATCH_MODE },
    { mode: 'pve', matchModeId: 'skirmish' },
    { mode: 'pve', ...NORMAL_HUMAN_MATCH_MODE, matchModeVersion: 2 }]) {
    const rejected = await create(options);
    assert.equal(rejected.status, 400);
    const error = (await rejected.json()).error;
    if (['authored', 'objective-control'].includes(options.matchModeId)) {
      assert.equal(error, FRESH_PVE_UNSUPPORTED_REASON);
    }
    assert.equal((await (await fetch(`${origin}/api/rooms/status`)).json()).roomCount, count,
      'a rejected setup cannot allocate a room');
  }
  const response = await create({ mode: 'pve', mapSeed: 1, policySeed: 20260925 });
  assert.equal(response.status, 201);
  const room = await response.json();
  assert.deepEqual(room.launchOptions, { mode: 'pve', mapSeed: 1, policySeed: 20260925, ...NORMAL_HUMAN_MATCH_MODE });
  const human = await fixture.connect(0, null, room.roomId);
  const observer = await fixture.connect(null, null, room.roomId);
  assert.equal(human.welcome.map.id, NORMAL_MATCH_MAP_ID, 'Tiny preset overrides the supervisor Small fixture');
  assert.deepEqual(identity(human.welcome), NORMAL_HUMAN_MATCH_MODE);
  assert.deepEqual([human.welcome.map.width, human.welcome.map.height], [160, 160]);
  assert.equal(observer.welcome.state.connected, 2, 'the AI reserves the other seat');
  assert.ok(human.welcome.map.triggers.every(post => post.victory === false));
  assert.equal(Object.hasOwn(human.welcome.map, 'timedVictory'), false);
  assert.equal(Object.hasOwn(human.welcome.map, 'victoryHoldSeconds'), false);
  await human.state(state => state.scenarioClockStarted, 'normal human/AI match clock');
  const workers = human.latest.units.filter(unit => unit[1] === 0 && unit[5] === 'worker');
  const home = human.latest.homeTownCenters.find(center => center.team === 0);
  assert.equal(workers.length, 4);
  await human.command({ type: 'build', buildingType: 'house', ids: [workers[0][0]],
    x: home.x + 10, z: home.z + 12, clientOrderToken: 1 }, /HOUSE PLACED/);
  const foundation = await human.state(state => state.buildings.some(building => building.team === 0
    && building.type === 'house'), 'paid human House foundation');
  assert.equal(foundation.wood[0], 175, 'opening 250 wood pays the real 75-wood price');
  await human.command({ type: 'gather', ids: workers.slice(1).map(unit => unit[0]),
    nodeId: 's0-home-food', clientOrderToken: 2 }, /GATHER ORDER/);
  await human.state(state => state.food[0] > 150 && state.buildings.some(building => building.team === 0
    && building.type === 'house' && building.complete), 'completed paid House and actual resource deposit');
  const token = human.welcome.player.sessionToken;
  const checkpointPath = path.join(fixture.directory, 'rooms', 'rooms', room.roomId, 'match-state.json');
  await fixture.stop();
  const saved = JSON.parse(await readFile(checkpointPath, 'utf8'));
  assert.equal(saved.schemaVersion, 29); assert.equal(saved.rulesVersion, 6);
  assert.deepEqual(identity(saved), NORMAL_HUMAN_MATCH_MODE);
  assert.equal(saved.mapDefinition.id, NORMAL_MATCH_MAP_ID);
  assert.ok(saved.state.buildings.some(building => building.team === 0 && building.type === 'house' && building.complete));
  const matchId = saved.matchId;
  await fixture.start();
  const resumed = await fixture.connect(0, token, room.roomId);
  assert.equal(resumed.welcome.recoveredFromCheckpoint, true);
  assert.equal(resumed.welcome.matchId, matchId);
  assert.deepEqual(identity(resumed.welcome), NORMAL_HUMAN_MATCH_MODE);
  assert.equal(resumed.welcome.map.id, NORMAL_MATCH_MAP_ID);
  assert.ok(resumed.latest.buildings.some(building => building.team === 0 && building.type === 'house' && building.complete));
  assert.ok(resumed.latest.food[0] >= saved.state.teamFood[0]);
  const metadata = await (await fetch(`${origin}/api/rooms/${room.roomId}`)).json();
  assert.deepEqual(metadata.launchOptions, room.launchOptions);
  assert.deepEqual(metadata.roomMetadata, { mapId: NORMAL_MATCH_MAP_ID, ...NORMAL_HUMAN_MATCH_MODE });
  const after = resumed.messages.length; resumed.send({ type: 'reset' });
  await resumed.wait(message => message.type === 'notice' && message.message === 'BATTLEFIELD RESET', 'AI rematch', after);
  await resumed.state(state => state.buildings.length === 0 && state.armySize === 24
    && state.food[0] === 150 && state.wood[0] === 250, 'ordinary AI rematch opening');
  assert.deepEqual(identity(resumed.latest), NORMAL_HUMAN_MATCH_MODE);
  console.log(JSON.stringify({ status: 'passed', mapId: NORMAL_MATCH_MAP_ID, nativeIdentity: 'skirmish@1',
    normalNewGame: true, inheritedSmallMapOverridden: true, unsupportedSetupsAllocateNoRoom: true,
    humanPaidHouse: true, humanDepositedFood: true, aiSeatReserved: true, realColdResume: true,
    rematchIdentityAndOpeningRetained: true, canonicalMapHash: saved.mapHash,
    schemaVersion: saved.schemaVersion, rulesVersion: saved.rulesVersion,
    serverSha256: createHash('sha256').update(await readFile(new URL('../server.mjs', import.meta.url))).digest('hex'),
    supervisorSha256: createHash('sha256').update(await readFile(new URL('../room-supervisor.mjs', import.meta.url))).digest('hex'),
    limits: ['Native room/protocol commands with no grants or checkpoint edits; full AI replay/recovery is separate existing evidence.',
      'No browser rendering, deployed build, balance, fairness or capacity claim.'] }));
} finally { await fixture.dispose(); }
