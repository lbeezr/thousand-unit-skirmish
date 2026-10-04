import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import path from 'node:path';
import os from 'node:os';

// node packed-entry-reproduction.mjs /absolute/packed-release-directory
const root = path.resolve(process.argv[2]);
const manifest = JSON.parse(await readFile(path.join(root, 'release-manifest.json')));
const temp = await mkdtemp(path.join(os.tmpdir(), 'rts-packed-tiny-'));
const listener = createServer(); listener.listen(0, '127.0.0.1'); await once(listener, 'listening');
const port = listener.address().port; await new Promise(resolve => listener.close(resolve));
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('RTS_')));
Object.assign(env, { PORT: String(port), RTS_HOST: '127.0.0.1', RTS_SOLO_PRACTICE: '1',
  RTS_CUSTOM_MAP_DIRECTORY: path.join(temp, 'custom'), RTS_MATCH_STATE_PATH: path.join(temp, 'match.json') });
const child = spawn(process.execPath, ['server.mjs'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
let logs = ''; child.stdout.on('data', chunk => { logs += chunk; }); child.stderr.on('data', chunk => { logs += chunk; });
let socket;
const receive = (predicate, timeoutMs = 10000) => new Promise((resolve, reject) => {
  const timeout = setTimeout(() => finish(new Error('Packed entry response timeout')), timeoutMs);
  const onMessage = event => { const data = JSON.parse(event.data); if (predicate(data)) finish(null, data); };
  function finish(error, value) { clearTimeout(timeout); socket.removeEventListener('message', onMessage);
    error ? reject(error) : resolve(value); }
  socket.addEventListener('message', onMessage);
});
const report = { sourceRevision: manifest.sourceRevision, releaseDigest: manifest.digest,
  startedAt: new Date().toISOString(), browserVerified: false, hostedVerified: false };
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error(logs);
    try { if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal(ready, true);
  socket = new WebSocket(`ws://127.0.0.1:${port}/ws`, ['rts-v1']);
  const welcome = await receive(row => row.type === 'welcome');
  assert.ok(welcome.maps.some(row => row.id === 'veyrholds-terraced-vale'));
  const changed = receive(row => row.type === 'mapChange' && row.map.id === 'veyrholds-terraced-vale');
  socket.send(JSON.stringify({ type: 'selectMap', mapId: 'veyrholds-terraced-vale' }));
  const mapChange = await changed, state = mapChange.state;
  assert.equal(mapChange.map.width, 160); assert.equal(mapChange.map.height, 160);
  assert.equal(state.practice, true); assert.equal(state.armySize, 24);
  assert.equal(state.units.filter(row => row[1] !== 0).length, 0);
  const fogBytes = Buffer.from(state.visibility.data, 'base64').length; assert.equal(fogBytes, 6400);
  const id = state.units.find(row => row[5] === 'worker')[0];
  const arrival = receive(row => row.type === 'state' && row.tick > state.tick
    && row.units.some(unit => unit[0] === id && Math.hypot(unit[2] + 48.5, unit[3] - 0.5) <= 0.8));
  socket.send(JSON.stringify({ type: 'move', ids: [id], x: -48.5, z: 0.5 }));
  const arrived = await arrival; assert.equal(arrived.scenarioClockStarted, true);
  Object.assign(report, { passed: true, normalCatalog: true, selectedMapId: state.mapId,
    dimensions: [mapChange.map.width, mapChange.map.height], fogBytes,
    oneHumanPractice: true, workerArrivalGameSeconds: (arrived.tick - state.tick) / 30 });
} catch (error) { Object.assign(report, { passed: false, error: error.message }); process.exitCode = 1; }
finally {
  if (socket && socket.readyState !== WebSocket.CLOSED) {
    const closed = once(socket, 'close'); socket.close(); await closed;
  }
  if (child.exitCode === null && child.signalCode === null) {
    const exited = once(child, 'exit'); child.kill('SIGINT'); await exited;
  }
  await rm(temp, { recursive: true, force: true }); report.finishedAt = new Date().toISOString();
}
console.log(JSON.stringify(report, null, 2));
