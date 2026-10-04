// Real authority/socket regression. No browser visibility or rendered claim.
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stopChild } from './temporary-resources.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const data = await mkdtemp(path.join(os.tmpdir(), 'rts-state-refresh-'));
const clients = [];
let server;
async function connect(port, token) {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`, ['rts-v1', ...(token ? [`rts-resume.${token}`] : [])]);
  const messages = [];
  socket.addEventListener('error', () => {});
  socket.addEventListener('message', ({ data }) => messages.push(JSON.parse(data)));
  const client = { socket, messages, send: command => socket.send(JSON.stringify(command)),
    async wait(predicate, start = 0) {
      const deadline = Date.now() + 10000;
      while (Date.now() < deadline) {
        const found = messages.slice(start).find(predicate); if (found) return found;
        await sleep(10);
      }
      throw new Error('Native state refresh deadline exceeded');
    } };
  clients.push(client);
  client.welcome = await client.wait(message => message.type === 'welcome');
  return client;
}
try {
  const reservation = createServer();
  await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  server = spawn(process.execPath, ['server.mjs'], { cwd: root,
    env: { PATH: process.env.PATH, PORT: String(port), RTS_HOST: '127.0.0.1', RTS_GAME_MODE: 'pvp',
      RTS_MAP: 'maps/veyrholds-terraced-vale.json', RTS_CUSTOM_MAP_DIRECTORY: path.join(data, 'maps'),
      RTS_MATCH_STATE_PATH: path.join(data, 'match.json') }, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.resume(); server.stderr.resume();
  const deadline = Date.now() + 15000;
  while (!(await fetch(`http://127.0.0.1:${port}/health`).catch(() => null))?.ok) {
    assert.equal(server.exitCode, null); assert.ok(Date.now() < deadline); await sleep(25);
  }
  const seats = [await connect(port), await connect(port)];
  const refreshes = [];
  for (const team of [0, 1]) {
    const client = seats[team], other = seats[1 - team];
    assert.equal(client.welcome.player.team, team);
    const before = other.messages.length;
    client.send({ type: 'stateRefresh', stateRefreshId: team + 1 });
    const snapshot = await client.wait(message => message.type === 'stateRefresh' && message.stateRefreshId === team + 1);
    assert.equal(snapshot.fogOfWar, true);
    assert.equal(snapshot.serverInstanceId, client.welcome.serverInstanceId);
    assert.equal(snapshot.matchId, client.welcome.matchId);
    assert.ok(snapshot.tick >= client.welcome.state.tick);
    assert.ok(snapshot.units.some(row => row[1] === team));
    for (const field of ['food', 'wood', 'population', 'teamResearch']) assert.equal(snapshot[field][1 - team], null);
    assert.ok(snapshot.queuedWaypointCounts.every(([id]) => snapshot.units.find(row => row[0] === id)?.[1] === team));
    assert.equal(other.messages.slice(before).some(message => message.type === 'stateRefresh'), false);
    const sentAt = client.messages.length;
    client.send({ type: 'stateRefresh', stateRefreshId: -1 });
    client.send({ type: 'stateRefresh', stateRefreshId: 0 });
    client.send({ type: 'stateRefresh', stateRefreshId: 'bad' });
    client.send({ type: 'stateRefresh', stateRefreshId: 100 + team });
    const next = await client.wait(message => message.type === 'stateRefresh' && message.stateRefreshId === 100 + team, sentAt);
    assert.equal(client.messages.slice(sentAt).filter(message => message.type === 'stateRefresh').length, 1);
    assert.equal(next.matchId, snapshot.matchId);
    assert.deepEqual(next.food, snapshot.food); assert.deepEqual(next.wood, snapshot.wood);
    assert.equal(next.winner, snapshot.winner);
    refreshes.push({ team, tick: next.tick, seatPrivate: true, completeWaypointProjection: true });
  }
  const token = seats[0].welcome.player.sessionToken;
  const closed = new Promise(resolve => seats[0].socket.addEventListener('close', resolve, { once: true }));
  seats[0].socket.close(); await closed;
  const resumed = await connect(port, token);
  assert.equal(resumed.welcome.player.team, 0); assert.equal(resumed.welcome.player.resumed, true);
  resumed.send({ type: 'stateRefresh', stateRefreshId: 999 });
  const restored = await resumed.wait(message => message.type === 'stateRefresh' && message.stateRefreshId === 999);
  assert.equal(restored.matchId, seats[0].welcome.matchId);
  assert.equal(restored.food[1], null);
  console.log(JSON.stringify({ scope: 'native-state-refresh', passed: true,
    source: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    dirty: execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim() !== '',
    refreshes, resumedSeat: 0, matchPolicyUnchanged: true }));
} finally {
  for (const client of clients) client.socket.close();
  await stopChild(server);
  await rm(data, { recursive: true, force: true });
}
