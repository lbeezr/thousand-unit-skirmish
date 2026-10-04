import { BUILDING_DEFINITIONS, UNIT_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { orderedBuildingExitCells } from '../src/building-orientation.mjs';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Paid orientation, exit preference and real process restart; no rendered claim.
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
const temp = await mkdtemp(path.join(os.tmpdir(), 'rts-building-orientation-'));
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
  const map = { id: 'building-orientation-audit', name: 'Building Orientation Audit', width: 64, height: 64,
    terrainSeed: 19, fogOfWar: false, startingArmySize: 24, startingResources: { food: 1000, wood: 1000 },
    spawnPoints: [{ team: 0, x: -20, z: 0 }, { team: 1, x: 20, z: 0 }],
    obstacles: [], resourceNodes: [], triggers: [], scenarioEvents: [] };
  send(clients[0], { type: 'publishMap', map });
  await Promise.all(clients.map(client => client.wait(m => m.type === 'mapChange' && m.state.mapId === map.id)));
  for (const [team, client] of clients.entries()) {
    const ids = client.latest.units.filter(u => u[1] === team && u[5] === 'worker').map(u => u[0]);
    for (let orientation = 0; orientation < 4; orientation++) send(client, { type: 'build', ids,
      buildingType: 'barracks', orientation, x: (team ? 7.5 : -19.5) + orientation * 4, z: 10.5 });
    send(client, { type: 'build', ids, buildingType: 'house', x: team ? 20.5 : -25.5, z: 18.5 });
  }
  const admitted = await checkpointWith(checkpointPath, s => s.state.buildings.length === 10);
  for (const team of [0, 1]) {
    const rows = admitted.state.buildings.filter(b => b.team === team && b.type === 'barracks');
    assert.deepEqual(rows.map(b => b.orientation).sort(), [0, 1, 2, 3]);
    assert.ok(rows.every(b => b.footprint.length === 9));
    assert.equal(admitted.state.teamWood[team], 1000 - 4 * BUILDING_DEFINITIONS.barracks.cost.wood - BUILDING_DEFINITIONS.house.cost.wood);
    assert.equal(admitted.state.buildings.find(b => b.team === team && b.type === 'house').orientation, 0);
    const client = clients[team]; client.clearMessages();
    send(client, { type: 'build', ids: client.latest.units.filter(u => u[1] === team && u[5] === 'worker').map(u => u[0]),
      buildingType: 'barracks', orientation: 4, x: 0.5, z: 20.5 });
    await client.wait(m => m.type === 'notice' && /INVALID BUILDING ORIENTATION/.test(m.message));
  }
  // A paid wall blocks Azure's orientation-zero central front threshold.
  const ids = clients[0].latest.units.filter(u => u[1] === 0 && u[5] === 'worker').map(u => u[0]);
  send(clients[0], { type: 'build', ids, buildingType: 'palisade-wall', x: -19.5, z: 12.5 });
  await checkpointWith(checkpointPath, s => s.state.buildings.length === 11);
  for (const [team, client] of clients.entries()) send(client, { type: 'stop', ids: client.latest.units.filter(u => u[1] === team && u[5] === 'worker').map(u => u[0]) });
  await stop();
  let saved = JSON.parse(await readFile(checkpointPath, 'utf8')); saved.state.seatSessions = [];
  const orientations = saved.state.buildings.map(b => [b.id, b.orientation ?? 0]);
  assert.equal(saved.state.buildings.length, 11);
  assert.equal(saved.state.teamWood[0], admitted.state.teamWood[0] - BUILDING_DEFINITIONS['palisade-wall'].cost.wood);
  assert.equal(saved.state.teamWood[1], admitted.state.teamWood[1]);
  for (const building of saved.state.buildings) { building.progress = 1; building.complete = true; }
  // Controlled complete-state/clearance setup; the original paid sites and facing
  // are retained. Move stopped Workers away from thresholds before queue tests.
  for (const unit of saved.state.units) if (unit.kind === 'worker') {
    Object.assign(unit, { x: unit.team ? 24.5 : -24.5, z: -14.5 - (unit.id % 3),
      workIntent: null, buildingTargetId: null, repairing: false, path: [], pathIndex: 0,
      movePlanningPending: false, moveGoalCell: -1 });
  }
  const paid = saved.state.buildings.filter(b => b.type === 'barracks');
  // Legacy records omit orientation; recovery exposes exactly the zero default.
  for (const house of saved.state.buildings.filter(b => b.type === 'house')) delete house.orientation;
  await writeFile(checkpointPath, JSON.stringify(saved)); await start();
  for (const client of clients) {
    assert.deepEqual(client.latest.buildings.map(b => [b.id, b.orientation]), orientations);
    assert.ok(client.latest.buildings.filter(b => b.type === 'house').every(b => b.orientation === 0));
  }
  for (const building of paid) send(clients[building.team], { type: 'trainUnit', kind: 'infantry', buildingId: building.id });
  await checkpointWith(checkpointPath, s => s.state.buildings.filter(b => b.type === 'barracks').every(b => b.queue === 1));
  await stop(); saved = JSON.parse(await readFile(checkpointPath, 'utf8')); saved.state.seatSessions = [];
  for (const team of [0, 1]) {
    assert.equal(saved.state.teamFood[team], 1000 - UNIT_DEFINITIONS.infantry.cost.food * 4);
    assert.equal(saved.state.teamWood[team], admitted.state.teamWood[team]
      - (team === 0 ? BUILDING_DEFINITIONS['palisade-wall'].cost.wood : 0) - UNIT_DEFINITIONS.infantry.cost.wood * 4);
  }
  for (const building of saved.state.buildings) if (building.queue) building.trainingRemaining = 0.05;
  const before = saved.state.units.length;
  await writeFile(checkpointPath, JSON.stringify(saved)); await start();
  const produced = await checkpointWith(checkpointPath, s => s.state.units.length === before + 8);
  const born = produced.state.units.slice(before), exits = [];
  const wallCell = produced.state.buildings.find(b => b.type === 'palisade-wall').footprint[0];
  for (const [index, building] of paid.entries()) {
    const centerColumn = Math.floor(building.x + 32), centerRow = Math.floor(building.z + 32), access = [];
    for (let row = centerRow - 2; row <= centerRow + 2; row++) for (let column = centerColumn - 2; column <= centerColumn + 2; column++) {
      const cell = row * 64 + column;
      if ((Math.abs(row - centerRow) === 2 || Math.abs(column - centerColumn) === 2) && cell !== wallCell) access.push(cell);
    }
    const cell = orderedBuildingExitCells(building, access, 64, 64)[0];
    const expected = { x: cell % 64 - 31.5, z: Math.floor(cell / 64) - 31.5 }, unit = born[index];
    assert.equal(unit.team, building.team);
    assert.ok(Math.hypot(unit.x - expected.x, unit.z - expected.z) < 0.4, 'produced unit uses rotated legal threshold');
    assert.ok(!building.footprint.includes(Math.floor(unit.z + 32) * 64 + Math.floor(unit.x + 32)));
    exits.push({ team: building.team, orientation: building.orientation, buildingId: building.id, expected, actual: { x: unit.x, z: unit.z } });
  }
  const report = { scope: 'native-paid-orientation-process-recovery', mapId: map.id,
    paidBarracks: 8, facingsPerSeat: 4, realProcessRestarts: 2, malformedRequestRejections: 2,
    legacyDefaultRecovery: true, paidWallFrontObstruction: true, exits, renderedFrames: 0 };
  const output = process.argv.find(arg => arg.startsWith('--report='));
  if (output) await writeFile(output.slice(9), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
} finally { await stop(); await rm(temp, { recursive: true, force: true }); }
