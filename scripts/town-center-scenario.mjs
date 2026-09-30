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
const temp = await mkdtemp(path.join(os.tmpdir(), 'rts-town-center-'));
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
  const map = { id: 'town-center-audit', name: 'Town Center Audit', width: 64, height: 64,
    terrainSeed: 19, fogOfWar: false, startingArmySize: 24, startingResources: { food: 1000, wood: 1000 },
    spawnPoints: [{ team: 0, x: -20, z: 0 }, { team: 1, x: 20, z: 0 }],
    obstacles: [], resourceNodes: [], triggers: [], scenarioEvents: [] };
  send(clients[0], { type: 'publishMap', map });
  await Promise.all(clients.map((client) => client.wait((m) => m.type === 'mapChange' && m.state.mapId === map.id)));
  for (const [team, client] of clients.entries()) {
    assert.equal(client.latest.homeTownCenters.length, 2);
    assert.equal(client.latest.homeTownCenters.find((b) => b.team === team).productionOptions[0].kind, 'worker');
    assert.deepEqual(client.latest.homeTownCenters.find((b) => b.team !== team).productionOptions, []);
    send(client, { type: 'build', ids: client.latest.units.filter((u) => u[1] === team && u[5] === 'worker').map((u) => u[0]),
      buildingType: 'town-center', x: team === 0 ? -10.5 : 10.5, z: 8.5 });
  }
  await checkpointWith(checkpointPath, (s) => s.state.buildings.length === 2);
  await stop();
  let saved = JSON.parse(await readFile(checkpointPath, 'utf8')); saved.state.seatSessions = [];
  assert.deepEqual(saved.state.teamFood, [900, 900]); assert.deepEqual(saved.state.teamWood, [600, 600]);
  for (const building of saved.state.buildings) { assert.equal(building.footprint.length, 25); building.progress = 1; building.complete = true; }
  for (const unit of saved.state.units) if (unit.kind === 'worker') Object.assign(unit, {
    buildingTargetId: null, repairing: false, path: [], pathIndex: 0, movePlanningPending: false, moveGoalCell: -1 });
  await writeFile(checkpointPath, JSON.stringify(saved)); await start();
  for (const [team, client] of clients.entries()) {
    assert.equal(client.latest.population[team].capacity, 20);
    const center = client.latest.buildings.find((b) => b.team === team);
    send(client, { type: 'trainUnit', kind: 'worker', buildingId: center.id });
    send(client, { type: 'trainUnit', kind: 'worker', buildingId: 1_000_000_000 + team });
  }
  await checkpointWith(checkpointPath, (s) => s.state.workerProduction.every((p) => p.queue === 1)
    && s.state.buildings.every((b) => b.queue === 1));
  await stop(); saved = JSON.parse(await readFile(checkpointPath, 'utf8')); saved.state.seatSessions = [];
  assert.deepEqual(saved.state.teamFood, [800, 800]);
  for (const building of saved.state.buildings) building.trainingRemaining = 0.05;
  for (const production of saved.state.workerProduction) production.trainingRemaining = 0.05;
  const before = saved.state.units.length;
  await writeFile(checkpointPath, JSON.stringify(saved)); await start();
  const produced = await checkpointWith(checkpointPath, (s) => s.state.units.length === before + 4);
  assert.ok(produced.state.buildings.every((b) => b.queue === 0));
  await stop(); saved = JSON.parse(await readFile(checkpointPath, 'utf8')); saved.state.seatSessions = [];
  for (const team of [0, 1]) {
    saved.state.homeTownCenters[team].hp = 1;
    const enemy = saved.state.units.find((u) => u.team !== team && u.kind === 'infantry');
    const center = map.spawnPoints[team];
    Object.assign(enemy, { x: center.x, z: center.z, path: [], pathIndex: 0, moveGoalCell: -1,
      attackTargetId: -1, attackBuildingTargetId: 1_000_000_000 + team, attackCooldown: 0, movePlanningPending: false });
  }
  await writeFile(checkpointPath, JSON.stringify(saved)); await start();
  const destroyed = await checkpointWith(checkpointPath, (s) => s.state.homeTownCenters.every((b) => b.hp === 0));
  assert.equal(destroyed.state.matchWinner, -1, 'surviving armies and expansions keep both teams in play');
  for (const [team, client] of clients.entries()) {
    send(client, { type: 'trainUnit', kind: 'worker', buildingId: client.latest.buildings.find((b) => b.team === team).id });
  }
  await checkpointWith(checkpointPath, (s) => s.state.buildings.every((b) => b.queue === 1));
  console.log('Town Centers: both-seat five-cell expansions, atomic food/wood costs, capacity, private options, simultaneous home/expansion Worker queues, restart completion, home destruction and surviving expansion recovery.');
} finally { await stop(); await rm(temp, { recursive: true, force: true }); }
