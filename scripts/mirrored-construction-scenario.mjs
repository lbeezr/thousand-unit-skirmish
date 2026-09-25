import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.RTS_SCENARIO_ROOT || path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const TIMEOUT_MS = Number(process.env.RTS_SCENARIO_TIMEOUT_MS || 45_000);
const sites = [{ x: -10.5, z: 0.5 }, { x: 10.5, z: 0.5 }];
let stage = 'startup';

async function reservePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

function client(port) {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`, ['rts-v1']);
  const messages = [];
  const waiters = [];
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    messages.push(message);
    for (let index = waiters.length - 1; index >= 0; index--) {
      const waiter = waiters[index];
      if (!waiter.predicate(message)) continue;
      waiters.splice(index, 1);
      clearTimeout(waiter.timer);
      waiter.resolve(message);
    }
  });
  return {
    socket,
    send(command) { socket.send(JSON.stringify(command)); },
    wait(predicate) {
      const existing = messages.find(predicate);
      if (existing) return Promise.resolve(existing);
      return new Promise((resolve, reject) => {
        const waiter = { predicate, resolve, timer: setTimeout(() => {
          waiters.splice(waiters.indexOf(waiter), 1);
          reject(new Error(`Timed out during ${stage}; latest message: ${messages.at(-1)?.type}`));
        }, TIMEOUT_MS) };
        waiters.push(waiter);
      });
    },
  };
}

function buildingFor(state, team) {
  return state.buildings?.find((building) => building.team === team && building.type === 'barracks');
}

function distanceToEdge(unit, building) {
  return Math.hypot(
    Math.max(0, Math.abs(building.x - unit[2]) - 1.5),
    Math.max(0, Math.abs(building.z - unit[3]) - 1.5),
  );
}

const port = await reservePort();
const temp = await mkdtemp(path.join(os.tmpdir(), 'rts-mirrored-construction-'));
const server = spawn(process.execPath, [path.join(ROOT, 'server.mjs')], {
  cwd: ROOT,
  env: {
    ...process.env, PORT: String(port), RTS_HOST: '127.0.0.1',
    RTS_MAP: 'maps/open-field.json', RTS_CUSTOM_MAP_DIRECTORY: path.join(temp, 'maps'),
    RTS_MATCH_STATE_PATH: path.join(temp, 'checkpoint.json'),
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let logs = '';
server.stdout.on('data', (chunk) => { logs += chunk; });
server.stderr.on('data', (chunk) => { logs += chunk; });
const clients = [];

try {
  const deadline = Date.now() + 12_000;
  let ready = false;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Server exited: ${logs}`);
    try {
      if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) { ready = true; break; }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.ok(ready, `Server did not start: ${logs}`);

  const azure = client(port);
  const ember = client(port);
  clients.push(azure, ember);
  const welcomes = await Promise.all(clients.map((entry) => entry.wait((message) => message.type === 'welcome')));
  assert.deepEqual(welcomes.map((welcome) => welcome.player.team), [0, 1]);
  const map = {
    id: 'mirrored-construction-test', name: 'Mirrored Construction Test',
    width: 64, height: 64, terrainSeed: 23, fogOfWar: false,
    startingResources: { food: 150, wood: 250 },
    spawnPoints: [{ team: 0, x: -20, z: 0 }, { team: 1, x: 20, z: 0 }],
    obstacles: [], resourceNodes: [], triggers: [], scenarioEvents: [],
  };
  azure.send({ type: 'publishMap', map });
  await azure.wait((message) => message.type === 'mapPublished' && message.mapId === map.id);
  azure.send({ type: 'selectArmySize', count: 250 });
  const initial = await azure.wait((message) => message.type === 'state'
    && message.mapId === map.id && message.armySize === 250);
  const builders = [0, 1].map((team) => initial.units
    .filter((unit) => unit[1] === team && unit[5] === 'worker').slice(0, 2).map((unit) => unit[0]));
  assert.deepEqual(builders.map((ids) => ids.length), [2, 2]);
  const initialInfantry = [0, 1].map((team) => new Set(initial.units
    .filter((unit) => unit[1] === team && unit[5] === 'infantry').map((unit) => unit[0])));

  clients.forEach((entry, team) => entry.send({
    type: 'build', buildingType: 'barracks', ids: builders[team], ...sites[team],
  }));
  stage = 'mirrored building placement';
  const accepted = await azure.wait((message) => message.type === 'state'
    && message.mapId === map.id && buildingFor(message, 0) && buildingFor(message, 1));
  assert.equal(accepted.wood[0], 75);
  assert.equal(accepted.wood[1], 75);

  stage = 'both builders reaching each building';
  const arrived = await azure.wait((message) => message.type === 'state'
    && message.mapId === map.id && [0, 1].every((team) => {
      const building = buildingFor(message, team);
      return building && builders[team].every((id) => {
        const unit = message.units.find((row) => row[0] === id);
        return unit && distanceToEdge(unit, building) <= 1.4;
      });
    }));
  stage = 'six seconds of two-builder progress';
  const later = await azure.wait((message) => message.type === 'state'
    && message.mapId === map.id && message.matchElapsedSeconds >= arrived.matchElapsedSeconds + 6);
  for (const team of [0, 1]) {
    const progress = buildingFor(later, team).progress - buildingFor(arrived, team).progress;
    assert.ok(progress >= 0.45, `both team ${team} builders should contribute; six-second progress was ${progress}`);
  }

  stage = 'mirrored building completion';
  const completed = await Promise.all([0, 1].map((team) => azure.wait((message) => message.type === 'state'
    && message.mapId === map.id && buildingFor(message, team)?.complete)));
  const completionTimes = completed.map((state, team) => state.matchElapsedSeconds);
  assert.ok(Math.abs(completionTimes[0] - completionTimes[1]) <= 1.5,
    `mirrored buildings should finish together: ${completionTimes}`);

  clients.forEach((entry, team) => entry.send({ type: 'train', buildingId: buildingFor(completed[team], team).id }));
  stage = 'mirrored first-infantry production';
  const trained = await Promise.all([0, 1].map((team) => azure.wait((message) => message.type === 'state'
    && message.mapId === map.id && message.units.some((unit) => unit[1] === team
      && unit[5] === 'infantry' && !initialInfantry[team].has(unit[0])))));
  const firstUnitTimes = trained.map((state) => state.matchElapsedSeconds);
  assert.ok(Math.abs(firstUnitTimes[0] - firstUnitTimes[1]) <= 1.5,
    `mirrored first infantry should train together: ${firstUnitTimes}`);
  console.log(JSON.stringify({ completionTimes, firstUnitTimes, progressAfterSixSeconds: [0, 1]
    .map((team) => buildingFor(later, team).progress - buildingFor(arrived, team).progress) }));
} catch (error) {
  error.message += `\nServer logs:\n${logs}`;
  throw error;
} finally {
  await Promise.all(clients.map((entry) => new Promise((resolve) => {
    if (entry.socket.readyState === WebSocket.CLOSED) return resolve();
    entry.socket.addEventListener('close', resolve, { once: true });
    entry.socket.close();
  })));
  if (server.exitCode === null) {
    const exited = once(server, 'exit');
    server.kill('SIGINT');
    await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 3000))]);
    if (server.exitCode === null) server.kill('SIGKILL');
  }
  await rm(temp, { recursive: true, force: true });
}
