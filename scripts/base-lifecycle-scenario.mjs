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
const temp = await mkdtemp(path.join(os.tmpdir(), 'rts-base-lifecycle-'));
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
  const map = { id: 'base-lifecycle-audit', name: 'Base Lifecycle Audit', width: 64, height: 64,
    terrainSeed: 19, fogOfWar: false, startingArmySize: 24, startingResources: { food: 1000, wood: 1000 },
    spawnPoints: [{ team: 0, x: -20, z: 0 }, { team: 1, x: 20, z: 0 }],
    obstacles: [], resourceNodes: [], triggers: [], scenarioEvents: [] };
  send(clients[0], { type: 'publishMap', map });
  await Promise.all(clients.map((client) => client.wait((m) => m.type === 'mapChange' && m.state.mapId === map.id)));
  for (const [team, client] of clients.entries()) send(client, { type: 'build',
    ids: client.latest.units.filter((u) => u[1] === team && u[5] === 'worker').map((u) => u[0]),
    buildingType: 'barracks', x: team === 0 ? -14.5 : 14.5, z: 8.5 });
  await clients[0].wait((m) => m.type === 'state' && m.buildings.length === 2 && m.buildings.every((b) => b.complete));
  for (const [team, client] of clients.entries()) send(client, { type: 'build',
    ids: client.latest.units.filter((u) => u[1] === team && u[5] === 'worker').map((u) => u[0]),
    buildingType: 'house', x: team === 0 ? -14.5 : 14.5, z: -8.5 });
  await checkpointWith(checkpointPath, (s) => s.state.buildings.length === 4);
  await stop();
  let saved = JSON.parse(await readFile(checkpointPath, 'utf8')); saved.state.seatSessions = [];
  for (const building of saved.state.buildings) {
    if (building.type === 'house') { building.progress = 0.5; building.complete = false; }
    else building.hp = 900;
  }
  for (const unit of saved.state.units) if (unit.kind === 'worker') Object.assign(unit, {
    buildingTargetId: null, repairing: false, path: [], pathIndex: 0, movePlanningPending: false, moveGoalCell: -1 });
  await writeFile(checkpointPath, JSON.stringify(saved)); await start();
  for (const [team, client] of clients.entries()) {
    const house = client.latest.buildings.find((b) => b.team === team && b.type === 'house');
    client.clearMessages(); send(client, { type: 'cancelConstruction', buildingId: house.id });
    await client.wait((m) => m.type === 'notice' && m.message.startsWith('CONSTRUCTION CANCELLED'));
    send(client, { type: 'cancelConstruction', buildingId: house.id });
    await client.wait((m) => m.type === 'notice' && m.message.startsWith('CANCEL REJECTED'));
  }
  const cancelled = await checkpointWith(checkpointPath, (s) => s.state.buildings.length === 2);
  assert.deepEqual(cancelled.state.teamWood, [787.5, 787.5], 'half-finished Houses refund exactly their unbuilt half once');
  for (const [team, client] of clients.entries()) {
    const barracks = client.latest.buildings.find((b) => b.team === team && b.type === 'barracks');
    send(client, { type: 'repairBuilding', buildingId: barracks.id,
      ids: client.latest.units.filter((u) => u[1] === team && u[5] === 'worker').map((u) => u[0]) });
  }
  await checkpointWith(checkpointPath, (s) => s.state.buildings.every((b) => b.hp > 900 && b.hp < 1800));
  await stop();
  saved = JSON.parse(await readFile(checkpointPath, 'utf8')); saved.state.seatSessions = [];
  assert.ok(saved.state.units.some((unit) => unit.repairing), 'repair orders persist while work is unfinished');
  await writeFile(checkpointPath, JSON.stringify(saved)); await start();
  const repaired = await checkpointWith(checkpointPath, (s) => s.state.buildings.every((b) => b.hp === 1800));
  for (const wood of repaired.state.teamWood) assert.ok(Math.abs(wood - 761.25) < 1e-6, 'wood is charged only for the missing half of Barracks HP');
  for (const [team, client] of clients.entries()) {
    const barracks = client.latest.buildings.find((b) => b.team === team && b.type === 'barracks');
    client.clearMessages();
    for (const kind of ['spearman', 'infantry', 'spearman']) send(client, { type: 'trainUnit', kind, buildingId: barracks.id });
    await client.wait((m) => m.type === 'state' && m.buildings.find((b) => b.id === barracks.id)?.queue === 3);
    send(client, { type: 'cancelTraining', buildingId: barracks.id });
    await client.wait((m) => m.type === 'notice' && m.message.startsWith('TRAINING CANCELLED'));
    client.clearMessages(); send(client, { type: 'cancelTraining', buildingId: barracks.id, queueIndex: 0 });
    await client.wait((m) => m.type === 'notice' && m.message.startsWith('TRAINING CANCELLED'));
    send(client, { type: 'researchUpgrade', upgrade: 'infantry-attack', buildingId: barracks.id });
    await client.wait((m) => m.type === 'notice' && m.message.startsWith('INFANTRY FORGING STARTED'));
    send(client, { type: 'cancelResearch', buildingId: barracks.id });
    await client.wait((m) => m.type === 'notice' && m.message.startsWith('RESEARCH CANCELLED'));
    send(client, { type: 'trainWorker' }); send(client, { type: 'trainWorker' });
    await client.wait((m) => m.type === 'state' && m.workerProduction[team]?.queue === 2);
    client.clearMessages(); send(client, { type: 'cancelTraining', kind: 'worker' });
    await client.wait((m) => m.type === 'notice' && m.message.startsWith('TRAINING CANCELLED'));
  }
  const settled = await checkpointWith(checkpointPath, (s) => s.state.workerProduction.every((p) => p.queue === 1)
    && s.state.buildings.every((b) => b.productionQueue.length === 1 && b.productionQueue[0] === 'infantry')
    && s.state.teamResearch.every((research) => research === null));
  for (const team of [0, 1]) {
    assert.ok(settled.state.teamFood[team] > 890 && settled.state.teamFood[team] <= 900, 'unfinished work is refunded; one Infantry and Worker remain paid');
    assert.ok(settled.state.teamWood[team] > 750 && settled.state.teamWood[team] <= 761.25);
  }
  await stop(); saved = JSON.parse(await readFile(checkpointPath, 'utf8')); saved.state.seatSessions = [];
  await writeFile(checkpointPath, JSON.stringify(saved)); await start();
  for (const [team, client] of clients.entries()) {
    assert.equal(client.latest.population[team].reserved, 2, 'only the surviving queues reserve population after restart');
    assert.equal(client.latest.teamResearch[team].active, null, 'cancelled research does not resume');
  }
  await stop();
  const paused = JSON.parse(await readFile(checkpointPath, 'utf8')); paused.state.seatSessions = [];
  for (const team of [0, 1]) {
    const building = paused.state.buildings.find((b) => b.team === team);
    building.hp = 900; paused.state.teamWood[team] = 0;
    const worker = paused.state.units.find((unit) => unit.team === team && unit.kind === 'worker');
    Object.assign(worker, { x: building.x - 2, z: building.z, path: [], pathIndex: 0,
      buildingTargetId: building.id, repairing: true, movePlanningPending: false });
  }
  await writeFile(checkpointPath, JSON.stringify(paused)); await start();
  const waiting = await checkpointWith(checkpointPath, (s) => s.state.tickNumber >= paused.state.tickNumber + 30);
  assert.ok(waiting.state.buildings.every((b) => b.hp === 900), 'repair pauses without wood and cannot create free HP');
  assert.ok(waiting.state.units.filter((unit) => unit.repairing).length >= 2, 'paused orders remain recoverable');
  await stop(); const funded = JSON.parse(await readFile(checkpointPath, 'utf8')); funded.state.seatSessions = [];
  funded.state.teamWood = [100, 100]; await writeFile(checkpointPath, JSON.stringify(funded)); await start();
  const resumed = await checkpointWith(checkpointPath, (s) => s.state.buildings.every((b) => b.hp === 1800));
  for (const wood of resumed.state.teamWood) assert.ok(Math.abs(wood - 73.75) < 1e-6, 'funding the paused order resumes the same proportional repair');
  console.log('Base lifecycle passed: both-seat construction refunds, repair costs and interrupted restart, mixed active/pending queue cancellation, research/Worker cancellation and persisted reservations.');
} finally { await stop(); await rm(temp, { recursive: true, force: true }); }
