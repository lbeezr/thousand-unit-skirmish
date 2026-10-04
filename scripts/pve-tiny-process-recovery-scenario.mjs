// Normal HTTP/WebSocket admission and real supervisor/worker restarts.
// Saved checkpoints are read for assertions, never written or edited by this case.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { BUILDING_DEFINITIONS, UNIT_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { toOpponentObservation } from '../src/pve-opponent.mjs';

const mapId = 'veyrholds-terraced-vale';
const identity = { matchModeId: 'skirmish', matchModeVersion: 1 };
// The explicit human control exercises the same normal process protocol. It is
// never reported as a PvE result; CI runs the default normal AI profile.
const launchMode = process.argv[2] ?? 'pve';
assert.ok(['pve', 'pvp'].includes(launchMode), 'Usage: node scripts/pve-tiny-process-recovery-scenario.mjs [pve|pvp]');
const launch = { mode: launchMode, ...identity, ...(launchMode === 'pve' ? { mapSeed: 0, policySeed: 20260925 } : {}) };
const fixture = await createFortifiedFixture({ supervisor: true, mapPath: null, timeoutMs: 45_000 });
const origin = `http://127.0.0.1:${fixture.port}`;
const records = [];
let roomId, human, observer, guest, sessionToken, guestToken, playerId, checkpointPath, orderToken = 1;
const own = (state, kind) => state.units.filter(row => row[1] === 0 && row[4] > 0 && (!kind || row[5] === kind));
const generations = state => own(state).map(row => [row[0], row[8]]);
const mode = value => ({ matchModeId: value.matchModeId, matchModeVersion: value.matchModeVersion });
async function json(url) {
  const response = await fetch(`${origin}${url}`); assert.equal(response.status, 200);
  return response.json();
}
function assertHumanWelcome(client, resumed = false) {
  const welcome = client.welcome;
  assert.equal(welcome.player.team, 0);
  assert.equal(welcome.player.resumed, resumed);
  assert.equal(welcome.map.id, mapId); assert.deepEqual(mode(welcome), identity);
  assert.deepEqual(mode(welcome.state), identity);
  assert.equal(welcome.state.fogOfWar, true);
  assert.equal(welcome.state.visibility.columns, 160); assert.equal(welcome.state.visibility.rows, 160);
  assert.equal(Buffer.from(welcome.state.visibility.data, 'base64').length, 6400);
  assert.equal(welcome.state.food[1], null, 'human cannot read the hidden opponent bank');
  assert.equal(welcome.state.wood[1], null);
  const view = toOpponentObservation(welcome.state, 0, welcome.map);
  const sorted = ids => ids.sort((a, b) => a - b);
  assert.deepEqual(sorted(welcome.state.units.filter(row => row[1] === 1 && row[4] > 0).map(row => row[0])),
    sorted(view.units.visibleEnemies.map(row => row.id)), 'every disclosed enemy unit is in current sight');
  assert.deepEqual(sorted([...welcome.state.buildings, ...welcome.state.homeTownCenters]
    .filter(row => row.team === 1 && row.hp > 0).map(row => row.id)),
    sorted(view.buildings.visibleEnemies.map(row => row.id)), 'every disclosed enemy building is visible');
  if (resumed) assert.equal(welcome.player.id, playerId);
}
async function connect(resumed = false) {
  human = await fixture.connect(0, resumed ? sessionToken : null, roomId);
  assertHumanWelcome(human, resumed);
  if (!resumed) { sessionToken = human.welcome.player.sessionToken; playerId = human.welcome.player.id; }
  if (launchMode === 'pvp') {
    guest = await fixture.connect(1, resumed ? guestToken : null, roomId);
    guestToken = guest.welcome.player.sessionToken;
  }
  observer = await fixture.connect(null, null, roomId);
  assert.equal(observer.welcome.state.connected, 2, 'both normal seats are filled');
}
async function disconnect(client) {
  if (client.socket.readyState === WebSocket.CLOSED) return;
  const closed = once(client.socket, 'close'); client.socket.close(); await closed;
}
async function order(command, expression) {
  await human.command({ ...command, clientOrderToken: orderToken++ }, expression);
}
async function roomMetadata() {
  const room = await json(`/api/rooms/${roomId}`);
  assert.deepEqual(room.launchOptions, launch);
  assert.equal(room.mapId, mapId); assert.deepEqual(mode(room), identity);
  assert.deepEqual(room.roomMetadata, { mapId, ...identity });
  return room;
}
async function restart(stage, validate) {
  const priorMatch = human.welcome.matchId;
  // SIGINT terminates the supervisor and its real child processes, flushing the
  // normal shutdown checkpoint; start creates new OS processes on the same data.
  await fixture.stop();
  const bytes = await readFile(checkpointPath), saved = JSON.parse(bytes);
  assert.equal(saved.matchId, priorMatch); assert.deepEqual(mode(saved), identity);
  assert.equal(saved.mapDefinition.id, mapId);
  await fixture.start(); await connect(true);
  assert.equal(human.welcome.recoveredFromCheckpoint, true);
  assert.equal(human.welcome.matchId, saved.matchId);
  assert.ok(human.welcome.state.tick >= saved.state.tickNumber);
  assert.deepEqual(generations(human.welcome.state), saved.state.units
    .filter(unit => unit.team === 0 && unit.hp > 0).map(unit => [unit.id, unit.generation]));
  await roomMetadata(); await validate(saved, human.welcome.state);
  records.push({ stage, checkpointTick: saved.state.tickNumber,
    resumedTick: human.welcome.state.tick, schemaVersion: saved.schemaVersion,
    checkpointSha256: createHash('sha256').update(bytes).digest('hex'),
    sameSeat: true, sameMatch: true, actualProcessRestart: true });
}
try {
  await fixture.start();
  const status = await json('/api/rooms/status');
  if (launchMode === 'pve') assert.equal(status.ordinarySetup.pve.available, true, 'mode owner must expose normal Tiny PvE admission');
  const excluded = await fetch(`${origin}/api/rooms`, { method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify({ ...launch, mapId: 'veyrholds-threefold-basin' }) });
  assert.equal(excluded.status, 400, 'normal creation cannot request an unsupported map override');
  const response = await fetch(`${origin}/api/rooms`, { method: 'POST',
    headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(launch) });
  assert.equal(response.status, 201, `normal create-room protocol must admit Tiny Skirmish ${launchMode}`);
  const room = await response.json(); roomId = room.roomId;
  assert.deepEqual(room.launchOptions, launch);
  checkpointPath = path.join(fixture.directory, 'rooms', 'rooms', roomId, 'match-state.json');
  await connect(); await roomMetadata();
  assert.equal(own(human.latest, 'worker').length, 4); assert.equal(own(human.latest, 'infantry').length, 8);
  assert.equal(human.latest.units.filter(row => row[1] === 1).length, 0, 'opening enemy roster stays hidden');
  const initialGenerations = generations(human.latest);
  const workers = own(human.latest, 'worker').map(row => row[0]);
  await order({ type: 'build', buildingType: 'barracks', ids: workers.slice(2), x: -57.5, z: 10.5 },
    new RegExp(`${BUILDING_DEFINITIONS.barracks.label.toUpperCase()} PLACED`));
  const foundationView = await human.state(state => state.buildings.some(row => row.team === 0 && row.type === 'barracks' && !row.complete));
  const producerId = foundationView.buildings.find(row => row.team === 0 && row.type === 'barracks').id;
  assert.equal(foundationView.wood[0], 75, 'ordinary build debits 175 starting wood');
  await order({ type: 'gather', ids: [workers[0]], nodeId: 's0-home-food' }, /GATHER ORDER/);
  await order({ type: 'gather', ids: [workers[1]], nodeId: 's0-home-wood' }, /GATHER ORDER/);
  await order({ type: 'stop', ids: workers.slice(0, 2) }, /STOP ORDER/);
  await disconnect(human); human = await fixture.connect(0, sessionToken, roomId);
  assertHumanWelcome(human, true);
  assert.deepEqual(generations(human.welcome.state), initialGenerations);
  assert.ok(human.welcome.state.buildings.some(row => row.id === producerId && !row.complete));
  records.push({ stage: 'same-process socket reconnect at paid foundation', sameSeat: true,
    tick: human.welcome.state.tick, paidWood: 175, strictHiddenBanks: true });
  await restart('paid foundation', async (saved, state) => {
    const building = saved.state.buildings.find(row => row.id === producerId);
    assert.ok(building && !building.complete);
    const restored = state.buildings.find(row => row.id === producerId);
    assert.ok(restored && restored.progress >= building.progress && restored.hp >= building.hp);
    assert.equal(state.food[0], saved.state.teamFood[0], 'stopped deposits keep food exact across restart');
    assert.equal(state.wood[0], saved.state.teamWood[0], 'restart neither grants resources nor charges the producer again');
  });
  await order({ type: 'gather', ids: [workers[0]], nodeId: 's0-home-food' }, /GATHER ORDER/);
  await order({ type: 'gather', ids: [workers[1]], nodeId: 's0-home-wood' }, /GATHER ORDER/);
  await human.state(state => state.buildings.some(row => row.id === producerId && row.complete), 'paid producer completes after real restart');
  await order({ type: 'stop', ids: workers }, /STOP ORDER/);
  const stable = await human.state(state => own(state, 'worker').every(row => row[9] === 'idle'), 'ordinary Stop stabilizes deposits');
  const paidFood = UNIT_DEFINITIONS.infantry.cost.food * 2, paidWood = UNIT_DEFINITIONS.infantry.cost.wood * 2;
  const beforeTrain = own(human.latest, 'infantry').map(row => row[0]);
  const queuedNotice = new RegExp(`${UNIT_DEFINITIONS.infantry.label.toUpperCase()} QUEUED`);
  await order({ type: 'trainUnit', buildingId: producerId, kind: 'infantry' }, queuedNotice);
  await order({ type: 'trainUnit', buildingId: producerId, kind: 'infantry' }, queuedNotice);
  await human.state(state => state.buildings.some(row => row.id === producerId && row.queue === 2)
    && state.food[0] === stable.food[0] - paidFood && state.wood[0] === stable.wood[0] - paidWood,
  'two recruits debit the actual definition costs');
  await restart('paid production queue', async (saved, state) => {
    const building = saved.state.buildings.find(row => row.id === producerId), restored = state.buildings.find(row => row.id === producerId);
    assert.equal(building.queue, 2); assert.equal(restored.queue, building.queue);
    assert.ok(restored.trainingRemaining <= building.trainingRemaining && restored.trainingRemaining > 0);
    assert.equal(state.food[0], saved.state.teamFood[0], 'restoration neither grants food nor charges recruits twice');
    assert.equal(state.wood[0], saved.state.teamWood[0]);
  });
  await order({ type: 'gather', ids: [workers[0]], nodeId: 's0-home-food' }, /GATHER ORDER/);
  await order({ type: 'gather', ids: [workers[1]], nodeId: 's0-home-wood' }, /GATHER ORDER/);
  const recruited = await human.state(state => own(state, 'infantry').length === beforeTrain.length + 2, 'both paid recruits finish after restart');
  const newInfantry = own(recruited, 'infantry').filter(row => !beforeTrain.includes(row[0]));
  assert.equal(newInfantry.length, 2);
  const progress = await human.state(state => state.food[0] > recruited.food[0] || state.wood[0] > recruited.wood[0], 'gathered cargo deposits after restart');
  records.push({ stage: 'continued paid production and deposits', recruited: newInfantry.map(row => row[0]),
    paidFood, paidWood, producerComplete: true, tick: progress.tick });
  const oldGenerations = generations(human.latest), oldTick = human.latest.tick, after = human.messages.length;
  const previousById = new Map(oldGenerations);
  const assertNewOpeningGenerations = state => {
    assert.deepEqual(generations(state).map(([id]) => id), initialGenerations.map(([id]) => id));
    for (const [id, generation] of generations(state)) {
      assert.notEqual(generation, previousById.get(id), `reset renews opening unit ${id}'s generation`);
    }
  };
  human.send({ type: 'reset' });
  await human.wait(row => row.type === 'notice' && row.message === 'BATTLEFIELD RESET', 'normal host rematch', after);
  const reset = await human.state(state => own(state).length === 12 && state.food[0] === 150 && state.wood[0] === 250
    && state.buildings.every(row => row.home), 'normal rematch opening');
  assert.ok(reset.tick >= oldTick); assert.equal(reset.winner, -1);
  assert.equal(reset.units.filter(row => row[1] === 1).length, 0, 'reset clears previous enemy sight');
  assertNewOpeningGenerations(reset);
  await roomMetadata();
  await restart('rematch epoch', async (saved, state) => {
    assert.equal(own(state).length, 12); assert.equal(state.winner, -1);
    assert.ok(state.buildings.every(row => row.home));
    assertNewOpeningGenerations(state);
    assert.equal(state.food[0], saved.state.teamFood[0]); assert.equal(state.wood[0], saved.state.teamWood[0]);
  });
  if (launchMode === 'pvp') {
    const worker = guest.latest.units.find(row => row[1] === 1 && row[5] === 'worker');
    guest.send({ type: 'gather', ids: [worker[0]], nodeId: 's1-home-food' });
  }
  await observer.state(state => state.units.some(row => row[1] === 1 && row[5] === 'worker'
    && ['gathering', 'returning'].includes(row[9])), 'fresh rematch second seat gathers after real restart');
  console.log(JSON.stringify({ status: 'passed', mode: launchMode, mapId, ...identity, mapSeed: launch.mapSeed,
    policySeed: launch.policySeed, records, limits: ['Local ordinary HTTP/WebSocket protocol with real OS process restarts.',
      'Running-match host reset, not a rendered defeat/result rematch.', 'No rendered or deployed acceptance; no checkpoint edits or resource grants.'] }));
} finally { await fixture.dispose(); }
