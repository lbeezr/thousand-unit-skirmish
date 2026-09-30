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
const temp = await mkdtemp(path.join(os.tmpdir(), 'rts-storehouse-'));
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
  const map = { id: 'storehouse-audit', name: 'Storehouse Audit', width: 64, height: 64,
    terrainSeed: 19, fogOfWar: false, startingArmySize: 24, startingResources: { food: 1000, wood: 1000 },
    spawnPoints: [{ team: 0, x: -20, z: 0 }, { team: 1, x: 20, z: 0 }],
    obstacles: [], resourceNodes: [{ id: 'food-west', type: 'food', x: -6.5, z: 8.5, stock: 1000 },
      { id: 'wood-east', type: 'wood', x: 6.5, z: 8.5, stock: 1000 }], triggers: [], scenarioEvents: [] };
  send(clients[0], { type: 'publishMap', map });
  await Promise.all(clients.map((client) => client.wait((m) => m.type === 'mapChange' && m.state.mapId === map.id)));
  for (const [team, client] of clients.entries()) {
    send(client, { type: 'build', ids: client.latest.units.filter((u) => u[1] === team && u[5] === 'worker').map((u) => u[0]),
      buildingType: 'storehouse', x: team === 0 ? -10.5 : 10.5, z: 8.5 });
  }
  await clients[0].wait((m) => m.type === 'state' && m.buildings.length === 2 && m.buildings.every((b) => b.complete));
  await stop();
  let saved = JSON.parse(await readFile(checkpointPath, 'utf8')); saved.state.seatSessions = [];
  assert.deepEqual(saved.state.teamWood, [900, 900], 'both completed drop-offs cost 100 wood');
  const workers = [];
  for (const team of [0, 1]) {
    const worker = saved.state.units.find((u) => u.team === team && u.kind === 'worker'); workers.push(worker.id);
    const node = map.resourceNodes[team];
    Object.assign(worker, { x: node.x, z: node.z, path: [], pathIndex: 0, cargo: 10,
      cargoType: node.type, gatherNodeId: node.id, gatherPhase: 'to-base', buildingTargetId: null,
      dropoffBuildingId: null, dropoffNavigationRevision: -1, moveGoalCell: -1 });
  }
  await writeFile(checkpointPath, JSON.stringify(saved)); await start();
  const returning = await checkpointWith(checkpointPath, (s) => workers.every((id) => s.state.units[id].dropoffBuildingId !== null));
  for (const id of workers) assert.equal(returning.state.units[id].dropoffBuildingId,
    returning.state.buildings.find((b) => b.team === returning.state.units[id].team).id, 'nearest completed friendly drop-off selected after restart');
  const deposited = await checkpointWith(checkpointPath, (s) => s.state.teamFood[0] === 1010 && s.state.teamWood[1] === 910);
  for (const id of workers) assert.ok(deposited.state.units[id].cargo < 10, 'the deposited load is consumed and a new gathering trip may already have started');
  await stop();
  saved = JSON.parse(await readFile(checkpointPath, 'utf8')); saved.state.seatSessions = [];
  for (const team of [0, 1]) {
    const worker = saved.state.units[workers[team]]; const node = map.resourceNodes[team];
    const storehouse = saved.state.buildings.find((b) => b.team === team);
    Object.assign(worker, { x: node.x, z: node.z, cargo: 10, cargoType: node.type,
      gatherPhase: 'to-base', path: [], pathIndex: 0, dropoffBuildingId: storehouse.id,
      dropoffNavigationRevision: saved.state.navigationRevision, moveGoalCell: -1 });
    storehouse.hp = 1;
    const attacker = saved.state.units.find((u) => u.team !== team && u.kind === 'infantry');
    Object.assign(attacker, { x: storehouse.x - 2, z: storehouse.z, path: [], pathIndex: 0,
      attackTargetId: -1, attackBuildingTargetId: storehouse.id, attackCooldown: 0, movePlanningPending: false });
  }
  const before = { food: [...saved.state.teamFood], wood: [...saved.state.teamWood] };
  await writeFile(checkpointPath, JSON.stringify(saved)); await start();
  const destroyed = await checkpointWith(checkpointPath, (s) => s.state.buildings.length === 0);
  assert.equal(destroyed.state.units[workers[0]].cargo, 10, 'destroyed drop-off preserves carried food');
  assert.equal(destroyed.state.units[workers[1]].cargo, 10, 'destroyed drop-off preserves carried wood');
  await checkpointWith(checkpointPath, (s) => s.state.teamFood[0] >= before.food[0] + 10 && s.state.teamWood[1] >= before.wood[1] + 10);
  console.log('Storehouse passed: both-seat construction and costs, nearest friendly drop-off after restart, exact food/wood deposits, destruction rerouting and retained cargo.');
} finally { await stop(); await rm(temp, { recursive: true, force: true }); }
