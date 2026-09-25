import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporary = await mkdtemp(path.join(os.tmpdir(), 'rts-starting-army-'));
const listener = createServer();
listener.listen(0, '127.0.0.1');
await once(listener, 'listening');
const port = listener.address().port;
await new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));

const server = spawn(process.execPath, ['server.mjs'], {
  cwd: root,
  env: {
    ...process.env,
    PORT: String(port),
    RTS_HOST: '127.0.0.1',
    RTS_MAP: 'maps/open-field.json',
    RTS_MATCH_STATE_PATH: path.join(temporary, 'checkpoint.json'),
    RTS_CUSTOM_MAP_DIRECTORY: path.join(temporary, 'custom-maps'),
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', chunk => { serverLog += chunk.toString(); });
server.stderr.on('data', chunk => { serverLog += chunk.toString(); });
let socket;
let secondSocket;

try {
  const deadline = Date.now() + 15_000;
  let healthy = false;
  while (Date.now() < deadline) {
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

  socket = new WebSocket(`ws://127.0.0.1:${port}/ws`, ['rts-v1']);
  const messages = [];
  const waiters = [];
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
  function waitFor(predicate, after = 0) {
    const found = messages.slice(after).find(predicate);
    if (found) return Promise.resolve(found);
    return new Promise((resolve, reject) => {
      const waiter = {
        predicate, after, resolve,
        timeout: setTimeout(() => reject(new Error(`message timeout: ${JSON.stringify(messages.slice(-4))}`)), 15_000),
      };
      waiters.push(waiter);
    });
  }
  function sendAndWait(command, predicate) {
    const after = messages.length;
    socket.send(JSON.stringify(command));
    return waitFor(predicate, after);
  }
  function checkRoster(state, total, food, wood, team = 0) {
    assert.equal(state.armySize, total);
    assert.deepEqual(state.food, team === 0 ? [food, null] : [null, food]);
    assert.deepEqual(state.wood, team === 0 ? [wood, null] : [null, wood]);
    const friendly = state.units.filter(unit => unit[1] === team);
    assert.equal(friendly.length, total / 2);
    assert.equal(friendly.filter(unit => unit[5] === 'worker').length, 4);
    assert.equal(friendly.filter(unit => unit[5] === 'infantry').length, total / 2 - 4);
  }

  const welcome = await waitFor(message => message.type === 'welcome');
  assert.equal(welcome.player.team, 0);
  checkRoster(welcome.state, 1000, 0, 0);

  const map = JSON.parse(await readFile(path.join(root, 'maps/open-field.json'), 'utf8'));
  map.id = 'test-opening';
  map.name = 'TEST OPENING';
  map.startingArmySize = 24;
  map.startingResources = { food: 150, wood: 250 };
  const published = await sendAndWait(
    { type: 'publishMap', map },
    message => message.type === 'mapChange' && message.map?.id === map.id,
  );
  checkRoster(published.state, 24, 150, 250);

  secondSocket = new WebSocket(`ws://127.0.0.1:${port}/ws`, ['rts-v1']);
  const secondWelcome = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('second seat welcome timed out')), 15_000);
    secondSocket.addEventListener('message', event => {
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      if (message.type !== 'welcome') return;
      clearTimeout(timeout);
      resolve(message);
    });
  });
  assert.equal(secondWelcome.player.team, 1);
  checkRoster(secondWelcome.state, 24, 150, 250, 1);

  const reset = await sendAndWait(
    { type: 'reset' },
    message => message.type === 'state' && message.armySize === 24,
  );
  checkRoster(reset, 24, 150, 250);

  const stress = await sendAndWait(
    { type: 'selectArmySize', count: 250 },
    message => message.type === 'state' && message.armySize === 250,
  );
  checkRoster(stress, 250, 150, 250);
  const stressReset = await sendAndWait(
    { type: 'reset' },
    message => message.type === 'state' && message.armySize === 250,
  );
  checkRoster(stressReset, 250, 150, 250);

  const defaultMap = await sendAndWait(
    { type: 'selectMap', mapId: 'open-field' },
    message => message.type === 'mapChange' && message.map?.id === 'open-field',
  );
  checkRoster(defaultMap.state, 1000, 0, 0);

  const restored = await sendAndWait(
    { type: 'selectMap', mapId: map.id },
    message => message.type === 'mapChange' && message.map?.id === map.id,
  );
  checkRoster(restored.state, 24, 150, 250);

  for (const invalid of [7, 23, 2002, 24.5, '24']) {
    const rejected = await sendAndWait(
      { type: 'publishMap', map: { ...map, id: `invalid-${String(invalid).replace('.', '-')}`, startingArmySize: invalid } },
      message => message.type === 'mapRejected',
    );
    assert.match(rejected.message, /startingArmySize/);
  }

  console.log(JSON.stringify({
    map: map.id,
    opening: { total: 24, workersPerTeam: 4, infantryPerTeam: 8, food: 150, wood: 250 },
    manualStressTotal: 250,
    defaultTotal: 1000,
    invalidSizesRejected: 5,
  }));
} catch (error) {
  console.error(serverLog);
  throw error;
} finally {
  socket?.close();
  secondSocket?.close();
  if (server.exitCode === null && server.signalCode === null) {
    server.kill('SIGTERM');
    await once(server, 'exit').catch(() => {});
  }
  await rm(temporary, { recursive: true, force: true });
}
