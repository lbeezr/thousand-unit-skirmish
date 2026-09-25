import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverRoot = process.env.RTS_SERVER_ROOT || root;
const mapPath = process.env.RTS_SEAT_MAP || path.join(serverRoot, 'maps/forked-vale.json');
const temporary = await mkdtemp(path.join(os.tmpdir(), 'rts-infantry-seat-'));
const listener = createServer();
listener.listen(0, '127.0.0.1');
await once(listener, 'listening');
const port = listener.address().port;
await new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
const server = spawn(process.execPath, ['server.mjs'], {
  cwd: serverRoot,
  env: {
    ...process.env,
    PORT: String(port), RTS_HOST: '127.0.0.1', RTS_MAP: 'maps/forked-vale.json',
    RTS_MATCH_STATE_PATH: path.join(temporary, 'checkpoint.json'),
    RTS_CUSTOM_MAP_DIRECTORY: path.join(temporary, 'custom-maps'),
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', chunk => { serverLog += chunk.toString(); });
server.stderr.on('data', chunk => { serverLog += chunk.toString(); });
const clients = [];

async function connect() {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`, ['rts-v1']);
  const messages = [];
  const waiters = [];
  const client = {
    socket, messages,
    send(command) { socket.send(JSON.stringify(command)); },
    waitFor(predicate, after = 0, timeoutMs = 60_000) {
      const found = messages.slice(after).find(predicate);
      if (found) return Promise.resolve(found);
      return new Promise((resolve, reject) => {
        const waiter = { predicate, after, resolve,
          timeout: setTimeout(() => {
            waiters.splice(waiters.indexOf(waiter), 1);
            reject(new Error(`message timeout: ${JSON.stringify(messages.slice(-2))}`));
          }, timeoutMs) };
        waiters.push(waiter);
      });
    },
  };
  socket.addEventListener('message', event => {
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    messages.push(message);
    for (let index = waiters.length - 1; index >= 0; index--) {
      const waiter = waiters[index];
      if (messages.length <= waiter.after || !waiter.predicate(message)) continue;
      waiters.splice(index, 1);
      clearTimeout(waiter.timeout);
      waiter.resolve(message);
    }
  });
  clients.push(client);
  const welcome = await client.waitFor(message => message.type === 'welcome');
  client.team = welcome.player.team;
  return client;
}

function latestState(client) {
  const recent = [...client.messages].reverse().find(message =>
    message.type === 'state' || message.type === 'mapChange');
  return recent?.type === 'mapChange' ? recent.state : recent;
}

function military(state, team) {
  return state.units.filter(row => row[1] === team && row[5] === 'infantry');
}

try {
  const healthDeadline = Date.now() + 15_000;
  let healthy = false;
  while (Date.now() < healthDeadline) {
    if (server.exitCode !== null) throw new Error(`server exited: ${serverLog}`);
    try {
      if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) {
        healthy = true;
        break;
      }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal(healthy, true, `server did not become healthy: ${serverLog}`);
  const azure = await connect();
  const ember = await connect();
  assert.equal(azure.team, 0);
  assert.equal(ember.team, 1);
  const template = JSON.parse(await readFile(mapPath, 'utf8'));
  const results = [];

  async function fight(teamZeroX, commandOrder) {
    const state = latestState(azure);
    const infantry = [0, 1].map(team => military(state, team));
    assert.deepEqual(infantry.map(group => group.length), [8, 8]);
    const parking = [0, 1].map(team => ({
      team,
      units: state.units.filter(row => row[1] === team && row[5] === 'worker'),
      x: team === 0 ? Math.sign(teamZeroX) * 25 : -Math.sign(teamZeroX) * 25,
      z: team === 0 ? 15 : -15,
    }));
    assert.deepEqual(parking.map(group => group.units.length), [4, 4]);
    const parkAfter = azure.messages.length;
    for (const group of parking) clients[group.team].send({
      type: 'move', ids: group.units.map(row => row[0]), x: group.x, z: group.z,
    });
    const parked = await azure.waitFor(message => message.type === 'state'
      && parking.every(group => group.units.every(row => {
        const unit = message.units.find(candidate => candidate[0] === row[0]);
        return unit && Math.hypot(unit[2] - group.x, unit[3] - group.z) < 3;
      })), parkAfter);

    const battleAfter = azure.messages.length;
    for (const team of commandOrder) clients[team].send({
      type: 'attackMove', ids: infantry[team].map(row => row[0]), x: 0, z: 0,
    });
    const resolved = await azure.waitFor(message => message.type === 'state'
      && [0, 1].some(team => military(message, team).filter(row => row[4] > 0).length <= 3),
    battleAfter, 60_000);
    const squads = [0, 1].map(team => military(resolved, team));
    const result = {
      teamZeroX, commandOrder,
      battleSeconds: Number((resolved.matchElapsedSeconds - parked.matchElapsedSeconds).toFixed(1)),
      teams: squads.map((group, team) => ({
        team, survivors: group.filter(row => row[4] > 0).length,
        remainingHp: group.reduce((sum, row) => sum + row[4], 0),
      })),
    };
    assert.ok(result.teams.every(row => row.remainingHp < 800),
      'both teams should take damage before the battle resolves');
    results.push(result);
  }

  const orientations = process.argv.includes('--single') ? [-7] : [-7, 7];
  const commandOrders = process.argv.includes('--single') ? [[0, 1]] : [[0, 1], [1, 0]];
  for (const teamZeroX of orientations) {
    const map = structuredClone(template);
    map.id = teamZeroX < 0 ? 'infantry-seat-left' : 'infantry-seat-right';
    map.name = teamZeroX < 0 ? 'INFANTRY SEAT LEFT' : 'INFANTRY SEAT RIGHT';
    map.fogOfWar = false;
    map.startingArmySize = 24;
    map.spawnPoints = [
      { team: 0, x: teamZeroX, z: 0 },
      { team: 1, x: -teamZeroX, z: 0 },
    ];
    const after = clients.map(client => client.messages.length);
    azure.send({ type: 'publishMap', map });
    await Promise.all(clients.map((client, team) => client.waitFor(
      message => message.type === 'mapChange' && message.map?.id === map.id, after[team])));
    for (const [index, order] of commandOrders.entries()) {
      if (index > 0) {
        const resetAfter = azure.messages.length;
        azure.send({ type: 'reset' });
        await azure.waitFor(message => message.type === 'state' && message.mapId === map.id
          && message.armySize === 24 && message.units.every(row => row[4] === 100), resetAfter);
      }
      await fight(teamZeroX, order);
    }
  }
  console.log(JSON.stringify({ results }));
  if (process.argv.includes('--expect-parity')) {
    for (const result of results) {
      const [azure, ember] = result.teams;
      assert.ok(Math.abs(azure.survivors - ember.survivors) <= 1,
        `infantry survivors differ by seat: ${JSON.stringify(result)}`);
      assert.ok(Math.abs(azure.remainingHp - ember.remainingHp) <= 100,
        `infantry health differs by seat: ${JSON.stringify(result)}`);
    }
  }
} catch (error) {
  console.error(serverLog);
  throw error;
} finally {
  for (const client of clients) client.socket.close();
  if (server.exitCode === null && server.signalCode === null) {
    server.kill('SIGTERM');
    await once(server, 'exit').catch(() => {});
  }
  await rm(temporary, { recursive: true, force: true });
}
