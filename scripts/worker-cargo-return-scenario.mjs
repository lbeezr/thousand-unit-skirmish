import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Construction must preserve reachable harvesting positions on authored terrain.
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SERVER_PATH = path.join(ROOT, 'server.mjs');
const TIMEOUT_MS = 45_000;

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
  return { socket, wait, get latest() { return latest; } };
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
  const last = JSON.parse(await readFile(checkpointPath, 'utf8'));
  throw new Error(`Timed out waiting for checkpoint: ${JSON.stringify(last.state.units.filter(u => u.id === 0 || u.id === 125))}`);
}

const mapId = process.argv[2] || 'highland-grove';
const map = JSON.parse(await readFile(path.join(ROOT, 'maps', `${mapId}.json`), 'utf8'));
const port = await freePort();
const temp = await mkdtemp(path.join(os.tmpdir(), 'rts-cargo-return-'));
const checkpointPath = path.join(temp, 'match.json');
const child = spawn(process.execPath, [SERVER_PATH], { cwd: ROOT, env: { ...process.env,
  PORT: String(port), RTS_HOST: '127.0.0.1', RTS_MAP: `maps/${mapId}.json`,
  RTS_MATCH_STATE_PATH: checkpointPath, RTS_CUSTOM_MAP_DIRECTORY: path.join(temp, 'maps') },
  stdio: ['ignore', 'pipe', 'pipe'] });
let logs = ''; child.stdout.on('data', x => logs += x); child.stderr.on('data', x => logs += x);
const clients = [];
try {
  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    try { if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) break; } catch {}
    await new Promise(r => setTimeout(r, 50));
  }
  assert.ok(Date.now() < deadline, `Server did not start: ${logs}`);
  clients.push(connect(port), connect(port));
  await Promise.all(clients.map(c => c.wait(m => m.type === 'welcome')));
  send(clients[0], { type: 'publishMap', map: { ...map, id: `${map.id}-cargo-regression`, startingArmySize: 250, startingResources: { food: 0, wood: 175 } } });
  await Promise.all(clients.map(c => c.wait(m => m.type === 'mapChange' && m.state.armySize === 250)));
  const frontier = mapId === 'frontier-160';
  if (frontier) {
    for (const [team, client] of clients.entries()) {
      const worker = client.latest.units.find(u => u[1] === team && u[5] === 'worker');
      send(client, { type: 'move', ids: [worker[0]], x: map.spawnPoints[team].x, z: -33 });
    }
    await checkpointWith(checkpointPath, cp => [0, 125].every(id => cp.state.units[id].z < -32));
  }
  const targets = [];
  for (const [team, client] of clients.entries()) {
    const workers = client.latest.units.filter(u => u[1] === team && u[5] === 'worker');
    const column = frontier ? (team ? 133 : 26) : (team ? 112 : 16);
    const row = frontier ? 41 : 37;
    const cell = row * map.width + column;
    targets[team] = cell;
    send(client, { type: 'gather', ids: [workers[0][0]], forestCell: cell, clientOrderToken: 1 });
    assert.match((await client.wait(m => m.type === 'notice' && m.clientOrderToken === 1)).message, /^GATHER ORDER/);
    send(client, { type: 'build', buildingType: 'barracks', ids: [workers[1][0]],
      x: (frontier ? column : (team ? 110 : 18)) - map.width / 2 + .5,
      z: (frontier ? 43 : 38) - map.height / 2 + .5, clientOrderToken: 2 });
    const placement = await client.wait(m => m.type === 'notice' && m.clientOrderToken === 2 && !m.message.startsWith('PLANNING'));
    assert.match(placement.message, frontier ? /BUILD REJECTED · WOULD BLOCK A ROUTE/ : /BARRACKS PLACED/);
  }
  await checkpointWith(checkpointPath, cp => targets.every(cell =>
    cp.state.forestStocks.some(([id, stock]) => id === cell && stock === 0)));
  // Explicit replacement now ends an area job; depletion alone continues it.
  for (const [team, client] of clients.entries()) {
    for (const [type, token, expected] of [['stop', 3, /^STOP ORDER/], ['returnCargo', 4, /^RETURN CARGO ORDER/]]) {
      send(client, { type, ids: [team * 125], clientOrderToken: token });
      assert.match((await client.wait(m => m.type === 'notice' && m.clientOrderToken === token)).message, expected);
    }
  }
  const checkpoint = await checkpointWith(checkpointPath, cp =>
    [0, 125].every(id => cp.state.units[id].cargo === 0 && cp.state.units[id].gatherPhase === ''));
  const sourceDraw = checkpoint.state.forestStocks.reduce((sum, [, stock]) => sum + 6 - stock, 0)
    + checkpoint.state.resourceNodes.filter(n => n.type === 'wood').reduce((sum, n) =>
      sum + map.resourceNodes.find(source => source.id === n.id).stock - n.stock, 0);
  const paidWood = frontier ? 0 : 2 * 175;
  assert.ok(Math.abs(sourceDraw - (checkpoint.state.teamWood.reduce((sum, wood) => sum + wood, 0) - 350 + paidWood)) < 1e-4,
    'all drawn Wood is delivered once, including partial continuation, after the registered construction debit');
  assert.ok(checkpoint.state.teamWood.every(wood => wood >= (frontier ? 181 : 6)));
  for (const id of [0, 125]) {
    const worker = checkpoint.state.units[id];
    assert.equal(worker.cargo, 0, 'all harvested cargo must be deposited once');
    assert.equal(worker.gatherPhase, '', 'explicit return must finish');
    assert.equal(worker.workIntent, null, 'explicit replacement ends the Wood job');
  }
  console.log(`${mapId}: both seats preserve harvesting access and bank all ${sourceDraw} drawn Wood exactly once`);
} finally {
  clients.forEach(c => c.socket.close());
  child.kill('SIGINT'); await once(child, 'exit'); await rm(temp, { recursive: true, force: true });
}
