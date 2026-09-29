import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Exercise mixed roster production and restart recovery through the authoritative runtime.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERVER_PATH = path.join(ROOT, 'server.mjs');
const TIMEOUT_MS = 70_000;

async function freePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

function connect(port) {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`, ['rts-v1']);
  const messages = [];
  const waiters = [];
  let latest = null;
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    messages.push(message);
    if (message.type === 'state') latest = message;
    if (message.type === 'welcome' || message.type === 'mapChange') latest = message.state;
    for (let index = waiters.length - 1; index >= 0; index--) {
      const waiter = waiters[index];
      if (!waiter.predicate(message)) continue;
      waiters.splice(index, 1);
      clearTimeout(waiter.timer);
      waiter.resolve(message);
    }
  });
  function wait(predicate) {
    const existing = messages.find(predicate);
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const waiter = { predicate, resolve, timer: setTimeout(() => {
        waiters.splice(waiters.indexOf(waiter), 1);
        reject(new Error('Timed out waiting for server message'));
      }, TIMEOUT_MS) };
      waiters.push(waiter);
    });
  }
  return { socket, wait, clearMessages() { messages.length = 0; }, get latest() { return latest; } };
}

function send(client, command) {
  client.socket.send(JSON.stringify(command));
}

async function checkpointWith(checkpointPath, predicate) {
  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const checkpoint = JSON.parse(await readFile(checkpointPath, 'utf8'));
      if (predicate(checkpoint)) return checkpoint;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 35));
  }
  throw new Error('Timed out waiting for the expected match checkpoint');
}


const port = await freePort();
const temp = await mkdtemp(path.join(os.tmpdir(), 'rts-population-'));
const checkpointPath = path.join(temp, 'match.json');
let child;
let clients = [];
let logs = '';
async function stop() {
  for (const client of clients) client.socket.close();
  clients = [];
  if (child && child.exitCode === null) {
    const done = once(child, 'exit'); child.kill('SIGINT'); await done;
  }
}
async function start() {
  child = spawn(process.execPath, [SERVER_PATH], {
    cwd: ROOT, env: { ...process.env, PORT: String(port), RTS_HOST: '127.0.0.1', RTS_GAME_MODE: 'pvp',
      RTS_MAP: 'maps/open-field.json', RTS_MATCH_STATE_PATH: checkpointPath,
      RTS_CUSTOM_MAP_DIRECTORY: path.join(temp, 'custom') }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => { logs += chunk; });
  child.stderr.on('data', (chunk) => { logs += chunk; });
  const deadline = Date.now() + TIMEOUT_MS;
  while (true) {
    if (child.exitCode !== null || Date.now() > deadline) throw Error(logs);
    try { if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) break; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  for (const team of [0, 1]) {
    const client = connect(port); clients.push(client);
    const welcome = await client.wait((m) => m.type === 'welcome');
    assert.equal(welcome.player.team, team);
  }
}
try {
  await start();
  const map = { id: 'population-audit', name: 'Population Audit', width: 64, height: 64,
    terrainSeed: 19, fogOfWar: false, startingArmySize: 24, startingResources: { food: 1000, wood: 1000 },
    spawnPoints: [{ team: 0, x: -20, z: 0 }, { team: 1, x: 20, z: 0 }],
    obstacles: [], resourceNodes: [], triggers: [], scenarioEvents: [] };
  send(clients[0], { type: 'publishMap', map });
  await Promise.all(clients.map((client) => client.wait((m) => m.type === 'mapChange' && m.state.mapId === map.id)));
  for (const [team, client] of clients.entries()) {
    assert.deepEqual(client.latest.population[team], { used: 12, reserved: 0, capacity: 15, available: 3 });
    assert.equal(client.latest.population[1 - team], null, 'enemy population stays private');
    send(client, { type: 'build', ids: client.latest.units.filter((u) => u[1] === team && u[5] === 'worker').map((u) => u[0]),
      buildingType: 'barracks', x: team === 0 ? -14.5 : 14.5, z: 8.5 });
  }
  await clients[0].wait((m) => m.type === 'state' && m.buildings.length === 2 && m.buildings.every((b) => b.complete));
  for (const [team, client] of clients.entries()) {
    const building = client.latest.buildings.find((b) => b.team === team);
    for (let count = 0; count < 3; count++) send(client, { type: 'trainUnit', kind: 'spearman', buildingId: building.id });
    send(client, { type: 'trainWorker' });
    await client.wait((m) => m.type === 'notice' && m.message === 'WORKER TRAINING REJECTED · POPULATION FULL · BUILD A HOUSE');
    send(client, { type: 'build', ids: client.latest.units.filter((u) => u[1] === team && u[5] === 'worker').map((u) => u[0]),
      buildingType: 'house', x: team === 0 ? -14.5 : 14.5, z: -8.5 });
  }
  await clients[0].wait((m) => m.type === 'state' && m.buildings.filter((b) => b.type === 'house').length === 2
    && m.buildings.filter((b) => b.type === 'house').every((b) => b.complete));
  for (const [team, client] of clients.entries()) {
    await client.wait((m) => m.type === 'state' && m.population[team].capacity === 23);
    const house = client.latest.buildings.find((b) => b.team === team && b.type === 'house');
    assert.equal(house.maxHp, 800);
    send(client, { type: 'trainUnit', kind: 'infantry', buildingId: house.id });
    await client.wait((m) => m.type === 'notice' && m.message.startsWith('TRAINING REJECTED · SELECT A COMPLETED BUILDING'));
    for (let count = 0; count < 4; count++) send(client, { type: 'trainWorker' });
  }
  await checkpointWith(checkpointPath, (s) => s.state.workerProduction.every((p) => p.queue === 4));
  await stop();
  const saved = JSON.parse(await readFile(checkpointPath, 'utf8'));
  assert.deepEqual(saved.state.teamFood, [620, 620], 'three Spearmen and four Workers charged once; blocked and unsupported training charge nothing');
  assert.deepEqual(saved.state.teamWood, [690, 690], 'Barracks, House and three Spearmen charged once');
  saved.state.seatSessions = [];
  await writeFile(checkpointPath, JSON.stringify(saved));
  await start();
  for (const [team, client] of clients.entries()) assert.equal(client.latest.population[team].capacity, 23, 'House capacity recovers after restart');
  await stop();
  const doomed = JSON.parse(await readFile(checkpointPath, 'utf8')); doomed.state.seatSessions = [];
  for (const house of doomed.state.buildings.filter((b) => b.type === 'house')) {
    house.hp = 1;
    const attacker = doomed.state.units.find((u) => u.team !== house.team && u.kind === 'infantry');
    Object.assign(attacker, { x: house.x - 2, z: house.z, path: [], pathIndex: 0,
      attackTargetId: -1, attackBuildingTargetId: house.id, attackCooldown: 0, movePlanningPending: false });
  }
  await writeFile(checkpointPath, JSON.stringify(doomed)); await start();
  const destroyed = await checkpointWith(checkpointPath, (s) => s.state.buildings.every((b) => b.type !== 'house'));
  assert.deepEqual(destroyed.state.teamFood, saved.state.teamFood);
  assert.deepEqual(destroyed.state.teamWood, saved.state.teamWood);
  for (const [team, client] of clients.entries()) {
    await client.wait((m) => m.type === 'state' && m.population[team].capacity === 15);
    assert.equal(client.latest.population[team].available, 0);
    assert.equal(client.latest.population[team].used + client.latest.population[team].reserved, 19, 'House loss retains living units and paid reservations above capacity');
    client.clearMessages(); send(client, { type: 'trainWorker' });
    await client.wait((m) => m.type === 'notice' && m.message.includes('POPULATION FULL'));
  }
  console.log('Population passed: both seats reserve atomically, hit and relieve a population block, recover House capacity, reject House production, and preserve units/resources/reservations when Houses are destroyed.');
} finally { await stop(); await rm(temp, { recursive: true, force: true }); }
