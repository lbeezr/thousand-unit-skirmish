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
const temp = await mkdtemp(path.join(os.tmpdir(), 'rts-watchtower-'));
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
  const map = { id: 'watchtower-audit', name: 'Watchtower Audit', width: 64, height: 64,
    terrainSeed: 19, fogOfWar: false, startingArmySize: 24, startingResources: { food: 1000, wood: 1000 },
    spawnPoints: [{ team: 0, x: -20, z: 0 }, { team: 1, x: 20, z: 0 }],
    obstacles: [], resourceNodes: [], triggers: [], scenarioEvents: [] };
  send(clients[0], { type: 'publishMap', map });
  await Promise.all(clients.map((client) => client.wait((m) => m.type === 'mapChange' && m.state.mapId === map.id)));
  for (const [team, client] of clients.entries()) send(client, { type: 'build',
    ids: client.latest.units.filter((u) => u[1] === team && u[5] === 'worker').map((u) => u[0]),
    buildingType: 'watchtower', x: team === 0 ? -10.5 : 10.5, z: 8.5 });
  await checkpointWith(checkpointPath, (s) => s.state.buildings.length === 2);
  await stop();
  let saved = JSON.parse(await readFile(checkpointPath, 'utf8')); saved.state.seatSessions = [];
  assert.deepEqual(saved.state.teamFood, [950, 950]); assert.deepEqual(saved.state.teamWood, [850, 850]);
  const attackers = [];
  for (const building of saved.state.buildings) {
    const enemy = saved.state.units.find((u) => u.team !== building.team && u.kind === 'infantry'); attackers.push(enemy.id);
    Object.assign(enemy, { x: building.x + (building.team ? -6 : 6), z: building.z, path: [], pathIndex: 0,
      moveGoalCell: -1, attackTargetId: -1, attackBuildingTargetId: -1, movePlanningPending: false });
  }
  for (const unit of saved.state.units) if (unit.kind === 'worker') Object.assign(unit, {
    buildingTargetId: null, repairing: false, path: [], pathIndex: 0, movePlanningPending: false, moveGoalCell: -1 });
  const tick = saved.state.tickNumber;
  await writeFile(checkpointPath, JSON.stringify(saved)); await start();
  const unfinished = await checkpointWith(checkpointPath, (s) => s.state.tickNumber >= tick + 30);
  assert.ok(attackers.every((id) => unfinished.state.units[id].hp === 100), 'unfinished defenses never fire');
  await stop(); saved = JSON.parse(await readFile(checkpointPath, 'utf8')); saved.state.seatSessions = [];
  for (const building of saved.state.buildings) { building.complete = true; building.progress = 1; }
  await writeFile(checkpointPath, JSON.stringify(saved)); await start();
  const fired = await checkpointWith(checkpointPath, (s) => attackers.every((id) => s.state.units[id].hp === 92));
  assert.ok(fired.state.buildings.every((building) => building.attackCooldown > 0 && building.lastAttackTick >= 0));
  assert.ok(fired.state.units.filter((u) => u.kind === 'worker').every((u) => u.hp === 100), 'friendly builders are never targets');
  await stop(); saved = JSON.parse(await readFile(checkpointPath, 'utf8')); saved.state.seatSessions = [];
  for (const building of saved.state.buildings) building.attackCooldown = 0.8;
  for (const id of attackers) saved.state.units[id].hp = 92;
  const restartTick = saved.state.tickNumber;
  await writeFile(checkpointPath, JSON.stringify(saved)); await start();
  const cooling = await clients[0].wait((message) => message.type === 'state' && message.tick >= restartTick + 5);
  assert.ok(cooling.buildings.every((building) => building.lastAttackTick >= restartTick + 24
    && building.lastAttackTick <= restartTick + 25), 'restart waits the saved 0.8 seconds before the next shot');
  await checkpointWith(checkpointPath, (s) => attackers.every((id) => s.state.units[id].hp === 84));
  await stop(); saved = JSON.parse(await readFile(checkpointPath, 'utf8')); saved.state.seatSessions = [];
  for (const [index, building] of saved.state.buildings.entries()) {
    building.hp = 1; building.attackCooldown = 0;
    Object.assign(saved.state.units[attackers[index]], { hp: 8, x: building.x + (building.team ? -2.5 : 2.5),
      attackBuildingTargetId: building.id, attackCooldown: 0, repathTimer: 0 });
  }
  await writeFile(checkpointPath, JSON.stringify(saved)); await start();
  const traded = await checkpointWith(checkpointPath, (s) => s.state.buildings.length === 0);
  assert.ok(attackers.every((id) => traded.state.units[id].hp === 0), 'lethal unit and defense hits resolve simultaneously');
  assert.deepEqual(traded.state.teamFood, [950, 950]); assert.deepEqual(traded.state.teamWood, [850, 850]);
  console.log('Watchtower: both-seat construction costs, unfinished suppression, 8-damage ranged fire, friendly exclusion, persisted cooldown, and simultaneous lethal building/unit trade.');
} finally { await stop(); await rm(temp, { recursive: true, force: true }); }
