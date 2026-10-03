import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TIMEOUT = 15_000;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const directory = await mkdtemp(path.join(os.tmpdir(), 'rts-pregame-'));
const listener = createServer().listen(0, '127.0.0.1');
await once(listener, 'listening');
const port = listener.address().port;
await new Promise(resolve => listener.close(resolve));
const origin = `http://127.0.0.1:${port}`;
let supervisor;
let output = '';
const clients = [];

async function until(predicate, label) {
  const deadline = Date.now() + TIMEOUT;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await delay(25);
  }
  throw new Error(`Timed out: ${label}\n${output}`);
}
async function start() {
  supervisor = spawn(process.execPath, ['room-supervisor.mjs'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port), RTS_HOST: '127.0.0.1', RTS_MAX_ROOMS: '3',
      RTS_ROOM_DATA_DIRECTORY: directory, RTS_CUSTOM_MAP_DIRECTORY: path.join(directory, 'default-maps'),
      RTS_SESSION_GRACE_MS: '1200' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  supervisor.stdout.on('data', data => { output += data; });
  supervisor.stderr.on('data', data => { output += data; });
  await until(async () => {
    if (supervisor.exitCode !== null) throw new Error(output);
    try { return (await fetch(`${origin}/api/rooms/status`, { signal: AbortSignal.timeout(500) })).ok; }
    catch { return false; }
  }, 'supervisor start');
}
async function stop() {
  if (!supervisor || supervisor.exitCode !== null) return;
  const exited = once(supervisor, 'exit');
  supervisor.kill('SIGINT');
  const timer = setTimeout(() => supervisor.kill('SIGKILL'), 8000);
  try { await exited; } finally { clearTimeout(timer); }
}
function client(roomId, token) {
  const socket = new WebSocket(`${origin.replace('http', 'ws')}/ws?room=${roomId}`,
    ['rts-v1', ...(token ? [`rts-resume.${token}`] : [])]);
  const value = { socket, messages: [], state: null, lobby: null, welcome: null };
  clients.push(value);
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    value.messages.push(message);
    if (message.type === 'welcome') value.welcome = message;
    if (message.state) value.state = message.state;
    else if (message.type === 'state') value.state = message;
    if (message.lobby) value.lobby = message.lobby;
    else if (message.state?.lobby) value.lobby = message.state.lobby;
  });
  value.send = command => socket.send(JSON.stringify(command));
  value.exchange = async (command, predicate) => {
    const cursor = value.messages.length;
    value.send(command);
    let result;
    await until(() => {
      result = value.messages.slice(cursor).find(predicate);
      return Boolean(result);
    }, `reply to ${command.type}`);
    return result;
  };
  value.close = async () => {
    if (socket.readyState === WebSocket.CLOSED) return;
    socket.close();
    await until(() => socket.readyState === WebSocket.CLOSED, 'client disconnect');
  };
  return value;
}
const map = {
  id: 'pregame-arena', name: 'Pregame Arena', width: 32, height: 32, startingArmySize: 8,
  obstacles: [], spawnPoints: [{ team: 0, x: -10, z: 0 }, { team: 1, x: 10, z: 0 }],
  resourceNodes: [{ id: 'food', type: 'food', x: 0, z: -8, stock: 500 }],
  triggers: [{ id: 'opening-zone', name: 'Opening Zone', type: 'capture-zone',
    zone: { column: 4, row: 14, width: 5, height: 5 }, requiredUnits: 1,
    captureSeconds: 0.5, foodReward: 0, victory: false, message: 'CAPTURED' }],
  scenarioEvents: [{ id: 'opening-supply', type: 'timed-supply', name: 'Opening Supply',
    afterSeconds: 0.5, team: 'both', foodReward: 17, message: 'SUPPLY' }],
  fogOfWar: false, victoryMode: 'any', terrainSeed: 13,
};

try {
  await start();
  const created = await fetch(`${origin}/api/rooms`, { method: 'POST', body: JSON.stringify({ pregame: true }) });
  assert.equal(created.status, 201);
  const { roomId, launchOptions } = await created.json();
  assert.equal(launchOptions.pregame, true);
  const roomDirectory = path.join(directory, 'rooms', roomId);
  const checkpointPath = path.join(roomDirectory, 'match-state.json');
  await writeFile(path.join(roomDirectory, 'custom-maps', `${map.id}.json`), JSON.stringify(map));
  let host = client(roomId);
  await until(() => host.welcome, 'host welcome');
  let guest = client(roomId);
  await until(() => guest.welcome && host.lobby.seats.length === 2, 'guest welcome');
  const hostIdentity = host.welcome.player;
  const guestIdentity = guest.welcome.player;
  assert.deepEqual([hostIdentity.team, guestIdentity.team], [0, 1]);
  assert.equal(host.lobby.phase, 'lobby');
  assert.equal(host.state.scenarioClockStarted, false);
  assert.equal(host.lobby.factionId, 'frontier');
  const spectator = client(roomId);
  const duplicate = client(roomId, hostIdentity.sessionToken);
  await until(() => spectator.welcome && duplicate.welcome, 'spectator welcomes');
  assert.equal(spectator.welcome.player.team, null);
  assert.equal(duplicate.welcome.player.resumePending, true);
  assert.equal(duplicate.welcome.player.team, null);
  for (const denied of [guest, spectator, duplicate]) {
    const rejected = await denied.exchange({ type: 'configureLobby', revision: host.lobby.revision, mapId: map.id }, row => row.type === 'lobbyRejected');
    assert.equal(rejected.lobby.mapId, host.lobby.mapId);
  }
  await duplicate.close();
  await spectator.close();
  await host.exchange({ type: 'launchMatch', revision: host.lobby.revision }, row => row.type === 'lobbyRejected');
  await host.exchange({ type: 'configureLobby', revision: host.lobby.revision, mapId: map.id }, row => row.type === 'mapChange');
  await until(() => guest.lobby.mapId === map.id, 'shared configuration');
  const stableUnits = host.state.units.map(row => row.slice(0, 5));
  const checkpoint = async predicate => {
    let saved;
    await until(async () => {
      try { saved = JSON.parse(await readFile(checkpointPath, 'utf8')); return predicate(saved); }
      catch { return false; }
    }, 'checkpoint');
    return saved;
  };
  const saved = await checkpoint(row => row.state.pregame?.phase === 'lobby' && row.mapDefinition.id === map.id);
  await host.exchange({ type: 'gather', ids: [0], nodeId: 'food' }, row => row.type === 'lobbyRejected');
  await host.exchange({ type: 'selectArmySize', count: 500 }, row => row.type === 'lobbyRejected');
  const frozen = await checkpoint(row => row.sequence >= saved.sequence + 2);
  assert.equal(frozen.state.matchElapsedSeconds, 0);
  assert.equal(frozen.state.scenarioClockStarted, false);
  assert.equal(frozen.state.triggerStates[0].progress, 0, 'spawn capture is gated');
  assert.equal(frozen.state.scenarioEventStates[0].fired, false, 'supply is gated');
  assert.deepEqual(frozen.state.units.map(unit => [unit.id, unit.team, Number(unit.x.toFixed(3)), Number(unit.z.toFixed(3)), unit.hp]), stableUnits);

  const ready = async value => value.exchange({ type: 'setReady', revision: value.lobby.revision, ready: true },
    row => row.type === 'lobby' && row.lobby.seats.some(seat => seat.id === value.welcome.player.id && seat.ready));
  await ready(host);
  await ready(guest);
  await until(() => host.lobby.canLaunch, 'both ready');
  const oldRevision = host.lobby.revision;
  await host.exchange({ type: 'configureLobby', revision: oldRevision, mapId: 'absent', armySize: 500 }, row => row.type === 'lobbyRejected');
  assert.equal(host.lobby.canLaunch, true, 'invalid settings are atomic');
  await host.exchange({ type: 'configureLobby', revision: oldRevision, armySize: 250 }, row => row.type === 'mapChange');
  assert.equal(host.lobby.canLaunch, false);
  assert.ok(host.lobby.seats.every(seat => !seat.ready));
  await guest.exchange({ type: 'setReady', revision: oldRevision, ready: true }, row => row.type === 'lobbyRejected');
  const otherMap = host.lobby.maps.find(entry => entry.id !== map.id).id;
  await host.exchange({ type: 'configureLobby', revision: host.lobby.revision, mapId: otherMap }, row => row.type === 'mapChange');
  await host.exchange({ type: 'configureLobby', revision: host.lobby.revision, mapId: map.id }, row => row.type === 'mapChange');
  await ready(host);
  await ready(guest);
  await checkpoint(row => row.state.pregame.revision === host.lobby.revision);
  await stop();
  await start();
  host = client(roomId, hostIdentity.sessionToken);
  guest = client(roomId, guestIdentity.sessionToken);
  await until(() => host.welcome && guest.welcome && host.lobby.seats.every(seat => seat.connected), 'pregame recovery');
  assert.equal(host.welcome.player.id, hostIdentity.id);
  assert.equal(guest.welcome.player.id, guestIdentity.id);
  assert.equal(host.lobby.phase, 'lobby');
  assert.equal(host.lobby.mapId, map.id);
  assert.ok(host.lobby.seats.every(seat => !seat.ready));
  await ready(host);
  await ready(guest);
  await guest.exchange({ type: 'launchMatch', revision: guest.lobby.revision }, row => row.type === 'lobbyRejected');
  const launchRevision = host.lobby.revision;
  const cursor = host.messages.length;
  // Independent sockets race unready against host launch. Either serialization
  // is valid; an unready lobby cannot slip through the gate.
  guest.send({ type: 'setReady', revision: launchRevision, ready: false });
  host.send({ type: 'launchMatch', revision: launchRevision });
  await until(() => host.messages.slice(cursor).some(row => row.type === 'lobbyRejected' || row.lobby?.phase === 'running'), 'launch/unready race');
  if (host.lobby.phase === 'lobby') {
    assert.equal(host.lobby.canLaunch, false);
    await ready(guest);
  }
  await host.exchange({ type: 'launchMatch', revision: launchRevision }, row => row.type === 'lobby' && row.lobby.phase === 'running');
  await host.exchange({ type: 'launchMatch', revision: launchRevision }, row => row.type === 'lobby' && row.lobby.phase === 'running');
  await until(() => host.state.food[0] === 17, 'launch delivers the opening supply');
  await checkpoint(row => row.state.pregame.phase === 'running' && row.state.matchElapsedSeconds >= 1);
  assert.equal(host.messages.filter(row => row.type === 'scenarioEvent').length, 1, 'one opening supply delivery');
  const runningIdentity = (await checkpoint(row => row.state.pregame.phase === 'running')).matchId;
  await guest.close();
  const runningLateJoin = client(roomId);
  await until(() => runningLateJoin.welcome, 'running late join during seat grace');
  assert.equal(runningLateJoin.welcome.player.team, null);
  assert.equal(runningLateJoin.lobby.phase, 'running');
  await runningLateJoin.close();
  guest = client(roomId, guestIdentity.sessionToken);
  await until(() => guest.welcome, 'running seat resume');
  assert.equal(guest.welcome.player.id, guestIdentity.id);
  assert.equal(guest.lobby.phase, 'running');
  assert.equal(guest.welcome.matchId, runningIdentity);
  await stop();
  const indexPath = path.join(directory, 'rooms.json');
  const oldIndex = JSON.parse(await readFile(indexPath, 'utf8'));
  await writeFile(indexPath, JSON.stringify({ version: 1, rooms: oldIndex.rooms.map(({ launchOptions, ...entry }) => entry) }));
  await start();
  host = client(roomId, hostIdentity.sessionToken);
  guest = client(roomId, guestIdentity.sessionToken);
  await until(() => host.welcome && guest.welcome, 'running recovery');
  assert.equal(host.welcome.matchId, runningIdentity);
  assert.equal(host.lobby.phase, 'running');
  assert.equal(host.welcome.recoveredFromCheckpoint, true, 'checkpoint preserves pregame capability after legacy index recovery');
  assert.equal(host.state.food[0], 17);
  await host.exchange({ type: 'publishMap', map: { ...map, id: 'pregame-published' }, persist: true }, row => row.type === 'mapPublished');
  assert.equal(host.lobby.phase, 'lobby', 'Map Studio returns to pregame after publication');
  await ready(host);
  await ready(guest);
  await host.exchange({ type: 'launchMatch', revision: host.lobby.revision }, row => row.type === 'lobby' && row.lobby.phase === 'running');
  await host.exchange({ type: 'reset' }, row => row.type === 'lobby' && row.lobby.phase === 'lobby');
  const resetRevision = host.lobby.revision;
  await until(() => guest.lobby.phase === 'lobby', 'rematch on both clients');
  host.send({ type: 'reset' });
  await ready(host); // Same queue processes the duplicate reset first.
  assert.equal(host.lobby.revision, resetRevision, 'duplicate reset is harmless');
  await ready(guest);
  await host.close();
  await until(() => guest.lobby.seats.some(seat => seat.team === 0 && !seat.connected), 'host disconnect');
  assert.equal(guest.lobby.canLaunch, false);
  assert.ok(guest.lobby.seats.every(seat => !seat.ready));
  assert.equal(guest.welcome.player.team, 1, 'guest is not promoted');
  const resumed = client(roomId, hostIdentity.sessionToken);
  await until(() => resumed.welcome, 'host resume');
  assert.equal(resumed.welcome.player.id, hostIdentity.id);
  assert.ok(resumed.lobby.seats.every(seat => !seat.ready));
  await resumed.close();
  await delay(1500);
  const replacement = client(roomId);
  await until(() => replacement.welcome, 'host replacement after grace');
  assert.equal(replacement.welcome.player.team, 0);
  assert.notEqual(replacement.welcome.player.id, hostIdentity.id);
  assert.equal(replacement.lobby.canLaunch, false);
  assert.ok(replacement.lobby.seats.every(seat => !seat.ready));
  const late = client(roomId, hostIdentity.sessionToken);
  await until(() => late.welcome, 'expired token late join');
  assert.equal(late.welcome.player.team, null);
  for (const [asset, mime] of [['src/room-lobby-ui.mjs', 'javascript'], ['src/room-lobby.css', 'text/css']]) {
    const response = await fetch(`${origin}/${asset}`);
    assert.equal(response.status, 200);
    assert.ok(response.headers.get('content-type').includes(mime));
    assert.ok((await response.text()).length > 100);
  }
  assert.equal((await fetch(`${origin}/src/room-pregame.mjs`)).status, 404, 'server authority module stays private');
  console.log(JSON.stringify({ passed: ['two-seat authority and settings validation', 'simulation/capture/supply freeze',
    'ready invalidation and stale revisions', 'duplicate-token spectators', 'pregame and running restart recovery',
    'launch/unready race and duplicate launch', 'running seat rejoin', 'Map Studio publication returns to lobby',
    'rematch and duplicate reset', 'host disconnect/rejoin/expiry/replacement', 'late join and public module delivery'] }));
} finally {
  const closing = Promise.allSettled(clients.map(value => value.close()));
  await stop();
  await closing;
  await rm(directory, { recursive: true, force: true });
}
