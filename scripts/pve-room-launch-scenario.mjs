import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { selectPveMapId } from '../src/pve-match.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TIMEOUT_MS = 30_000;
const MAP_SEED = 1;
const POLICY_SEED = 20260926;
const MAP_ID = selectPveMapId(MAP_SEED);

async function freePort() {
  const listener = createServer();
  listener.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const port = listener.address().port;
  await new Promise((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()));
  return port;
}

function createClient(port, roomId) {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws?room=${encodeURIComponent(roomId)}`, ['rts-v1']);
  const messages = [];
  const messageWaiters = [];
  const stateWaiters = [];
  let latestState = null;
  socket.addEventListener('message', (event) => {
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    messages.push(message);
    if (message.type === 'welcome' || message.type === 'mapChange') latestState = message.state;
    else if (message.type === 'state') latestState = message;
    if (latestState) {
      for (let index = stateWaiters.length - 1; index >= 0; index--) {
        const waiter = stateWaiters[index];
        if (!waiter.predicate(latestState)) continue;
        stateWaiters.splice(index, 1);
        clearTimeout(waiter.timer);
        waiter.resolve(latestState);
      }
    }
    for (let index = messageWaiters.length - 1; index >= 0; index--) {
      const waiter = messageWaiters[index];
      if (!waiter.predicate(message)) continue;
      messageWaiters.splice(index, 1);
      clearTimeout(waiter.timer);
      waiter.resolve(message);
    }
  });

  function waitForMessage(predicate, timeoutMs = TIMEOUT_MS) {
    const existing = messages.find(predicate);
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const waiter = { predicate, resolve, timer: setTimeout(() => {
        messageWaiters.splice(messageWaiters.indexOf(waiter), 1);
        reject(new Error(`Timed out waiting for a room message: ${JSON.stringify(messages.slice(-4))}`));
      }, timeoutMs) };
      messageWaiters.push(waiter);
    });
  }

  function waitForState(predicate, timeoutMs = TIMEOUT_MS) {
    if (latestState && predicate(latestState)) return Promise.resolve(latestState);
    return new Promise((resolve, reject) => {
      const waiter = { predicate, resolve, timer: setTimeout(() => {
        stateWaiters.splice(stateWaiters.indexOf(waiter), 1);
        reject(new Error('Timed out waiting for a room state.'));
      }, timeoutMs) };
      stateWaiters.push(waiter);
    });
  }

  return {
    socket,
    messages,
    waitForMessage,
    waitForState,
    get latestState() { return latestState; },
  };
}

async function waitForSupervisor(child, port, output) {
  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Room supervisor exited early: ${output()}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/rooms/status`, {
        cache: 'no-store', signal: AbortSignal.timeout(500),
      });
      if (response.ok && (await response.json()).enabled === true) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Room supervisor did not become ready: ${output()}`);
}

function startSupervisor(port, roomDataDirectory, customMapDirectory) {
  const child = spawn(process.execPath, [path.join(ROOT, 'room-supervisor.mjs')], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      RTS_HOST: '127.0.0.1',
      RTS_MAP: 'maps/forked-vale.json',
      RTS_ROOM_DATA_DIRECTORY: roomDataDirectory,
      RTS_CUSTOM_MAP_DIRECTORY: customMapDirectory,
      RTS_MAX_ROOMS: '2',
      RTS_MAX_PEERS: '2',
      RTS_ACCESS_PASSWORD: '',
      // Stale parent values must not leak into either the default PvP worker or this room.
      RTS_GAME_MODE: 'pvp',
      RTS_PVE_MAP_SEED: '77',
      RTS_PVE_POLICY_SEED: '88',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });
  return { child, output: () => output };
}

async function stopSupervisor(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, 'exit').catch(() => {});
  child.kill('SIGTERM');
  await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 10_000))]);
  if (child.exitCode === null && child.signalCode === null) {
    const killed = once(child, 'exit').catch(() => {});
    child.kill('SIGKILL');
    await killed;
  }
}

async function closeClient(client) {
  if (!client || client.socket.readyState === WebSocket.CLOSED) return;
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 1000);
    client.socket.addEventListener('close', () => { clearTimeout(timer); resolve(); }, { once: true });
    client.socket.close(1000, 'PvE room launch scenario complete');
  });
}

async function waitForRoomMetadata(port, roomId) {
  const deadline = Date.now() + TIMEOUT_MS;
  let lastRoom = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/rooms/${roomId}`, {
        cache: 'no-store', signal: AbortSignal.timeout(500),
      });
      if (response.ok) {
        lastRoom = await response.json();
        if (lastRoom.roomMetadata?.mapId) return lastRoom;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Room metadata did not include the worker's map ID: ${JSON.stringify(lastRoom)}`);
}

async function waitForPersistedRoom(roomDataDirectory, roomId) {
  const deadline = Date.now() + TIMEOUT_MS;
  let lastIndex = null;
  while (Date.now() < deadline) {
    try {
      lastIndex = JSON.parse(await readFile(path.join(roomDataDirectory, 'rooms.json'), 'utf8'));
      const room = lastIndex.rooms.find((entry) => entry.id === roomId);
      if (room?.mapId) return room;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`PvE launch options and worker map ID were not persisted: ${JSON.stringify(lastIndex)}`);
}

function hasOpponentOpening(state, spawn) {
  const hasGatheringWorker = state.units?.some((unit) => unit[1] === 1 && unit[5] === 'worker'
    && ['gathering', 'returning'].includes(unit[9]));
  const hasMovedSoldier = state.units?.some((unit) => unit[1] === 1 && unit[5] !== 'worker'
    && unit[4] > 0 && Math.hypot(unit[2] - spawn.x, unit[3] - spawn.z) > 2);
  return hasGatheringWorker && hasMovedSoldier;
}

function changedGenerationWorkerGathering(state, priorGenerations) {
  return state.units?.some((unit) => unit[1] === 1 && unit[5] === 'worker'
    && ['gathering', 'returning'].includes(unit[9])
    && priorGenerations.get(unit[0]) !== unit[8]);
}

const port = await freePort();
const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'rts-pve-room-launch-'));
const roomDataDirectory = path.join(tempRoot, 'room-data');
const customMapDirectory = path.join(tempRoot, 'default-maps');
const legacyRoomId = 'L'.repeat(32);
await mkdir(roomDataDirectory, { recursive: true });
await mkdir(path.join(roomDataDirectory, 'rooms', legacyRoomId), { recursive: true });
await writeFile(path.join(roomDataDirectory, 'rooms.json'), JSON.stringify({ version: 3, rooms: [{
  id: legacyRoomId, createdAt: Date.now(), lastActiveAt: Date.now(),
  launchOptions: { mode: 'pve', mapSeed: MAP_SEED, policySeed: POLICY_SEED }, mapId: MAP_ID,
}] }));
const supervisor = startSupervisor(port, roomDataDirectory, customMapDirectory);
const clients = [];
let roomId = null;

try {
  await waitForSupervisor(supervisor.child, port, supervisor.output);
  const createdResponse = await fetch(`http://127.0.0.1:${port}/api/rooms`, {
    method: 'POST',
    headers: {
      origin: `http://127.0.0.1:${port}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ mode: 'pve', mapSeed: MAP_SEED, policySeed: POLICY_SEED }),
    cache: 'no-store',
  });
  assert.equal(createdResponse.status, 400, 'fresh ordinary AI is blocked until the 160-map capability is accepted');
  assert.match((await createdResponse.json()).error, /160.*Skirmish AI acceptance/);
  const created = await (await fetch(`http://127.0.0.1:${port}/api/rooms/${legacyRoomId}`)).json();
  roomId = created.roomId;
  assert.match(roomId, /^[A-Za-z0-9_-]{32}$/);
  assert.deepEqual(created.launchOptions, {
    mode: 'pve', mapSeed: MAP_SEED, policySeed: POLICY_SEED,
  }, 'an existing room retains complete historical PvE launch options');

  const human = createClient(port, roomId);
  clients.push(human);
  const humanWelcome = await human.waitForMessage((message) => message.type === 'welcome');
  assert.equal(humanWelcome.player.team, 0, 'the human receives the host seat');
  assert.equal(humanWelcome.state.mapId, MAP_ID, 'the worker selected the seeded authored map');
  assert.equal(humanWelcome.map.id, MAP_ID);

  const observer = createClient(port, roomId);
  clients.push(observer);
  const observerWelcome = await observer.waitForMessage((message) => message.type === 'welcome');
  assert.equal(observerWelcome.player.team, null, 'the deterministic opponent reserves Team 1');
  assert.equal(observerWelcome.state.connected, 2, 'the AI fills the second match seat');
  assert.ok(observerWelcome.map.spawnPoints.some((spawn) => spawn.team === 1));
  const opponentSpawn = observerWelcome.map.spawnPoints.find((spawn) => spawn.team === 1);

  const room = await waitForRoomMetadata(port, roomId);
  assert.deepEqual(room.launchOptions, created.launchOptions,
    'the room API retains the exact PvE seeds used to start the worker');
  assert.equal(room.mapId, MAP_ID);
  assert.deepEqual(room.roomMetadata, { mapId: MAP_ID, matchModeId: 'authored', matchModeVersion: 1 },
    'worker readiness publishes the selected map through room metadata');
  const persistedRoom = await waitForPersistedRoom(roomDataDirectory, roomId);
  assert.deepEqual(persistedRoom.launchOptions, created.launchOptions);
  assert.equal(persistedRoom.mapId, MAP_ID,
    'the supervisor persists launch options and worker-selected map ID together');

  const opened = await observer.waitForState((state) => hasOpponentOpening(state, opponentSpawn), TIMEOUT_MS);
  assert.equal(opened.mapId, MAP_ID);
  assert.ok(opened.tick > observerWelcome.state.tick,
    'the worker should advance after the opponent is attached');
  const priorGenerations = new Map(opened.units
    .filter((unit) => unit[1] === 1 && unit[5] === 'worker')
    .map((unit) => [unit[0], unit[8]]));
  assert.ok(priorGenerations.size > 0, 'the initial opponent roster has workers');

  const beforeResetTick = observer.latestState.tick;
  const resetNotice = human.waitForMessage((message) => message.type === 'notice'
    && message.message === 'BATTLEFIELD RESET');
  human.socket.send(JSON.stringify({ type: 'reset' }));
  await resetNotice;
  const rematch = await observer.waitForState((state) => state.tick > beforeResetTick
    && changedGenerationWorkerGathering(state, priorGenerations), TIMEOUT_MS);
  assert.equal(rematch.mapId, MAP_ID, 'the rematch keeps its seeded map');

  const rematchRoom = await waitForRoomMetadata(port, roomId);
  assert.deepEqual(rematchRoom.launchOptions, created.launchOptions,
    'the room API keeps both seeds unchanged after rematch');
  assert.equal(rematchRoom.roomMetadata.mapId, MAP_ID);
  console.log(JSON.stringify({
    roomId,
    mapId: MAP_ID,
    mapSeed: MAP_SEED,
    policySeed: POLICY_SEED,
    teamOneReservedFor: 'deterministic-opponent',
    freshOrdinaryAiUnavailable: true, legacySeededRoomStillPlayable: true,
    rematchMapAndSeedsPreserved: true,
    newWorkerGenerationGathered: true,
  }));
} catch (error) {
  console.error(supervisor.output());
  throw error;
} finally {
  for (const client of clients) await closeClient(client);
  await stopSupervisor(supervisor.child);
  await rm(tempRoot, { recursive: true, force: true });
}
