import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { bootGameEntry } from '../src/game-entry.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporary = await mkdtemp(path.join(os.tmpdir(), 'rts-room-lifecycle-'));
const data = path.join(temporary, 'data');
const password = 'disposable-room-lifecycle-test';
const authorization = `Basic ${Buffer.from(`players:${password}`).toString('base64')}`;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let supervisor, origin, output = '', dom;
const clients = [];

async function until(predicate, label) {
  const end = Date.now() + 15_000;
  while (Date.now() < end) {
    const result = await predicate();
    if (result) return result;
    await delay(25);
  }
  throw new Error(`Timed out: ${label}\n${output}`);
}
async function start() {
  output = '';
  supervisor = spawn(process.execPath, ['room-supervisor.mjs'], { cwd: ROOT,
    env: { ...process.env, PORT: '0', RTS_HOST: '127.0.0.1', RTS_ROOM_DATA_DIRECTORY: data,
      RTS_CUSTOM_MAP_DIRECTORY: path.join(temporary, 'maps'), RTS_MAX_ROOMS: '1',
      RTS_ROOM_IDLE_TTL_MS: '60000', RTS_ACCESS_USER: 'players', RTS_ACCESS_PASSWORD: password,
      RTS_PUBLIC_GAMEPLAY: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  supervisor.stdout.on('data', value => { output += value; });
  supervisor.stderr.on('data', value => { output += value; });
  const port = await until(() => output.match(/listening at http:\/\/127\.0\.0\.1:(\d+)/)?.[1], 'listen');
  origin = `http://127.0.0.1:${port}`;
  await until(async () => (await fetch(`${origin}/ready`)).ok, 'ready');
}
async function stop() {
  if (!supervisor || supervisor.exitCode !== null) return;
  const exited = once(supervisor, 'exit');
  supervisor.kill('SIGTERM');
  const timer = setTimeout(() => supervisor.kill('SIGKILL'), 10_000);
  try { await exited; } finally { clearTimeout(timer); }
}
const admin = (route = '', options = {}) => fetch(`${origin}/api/admin/rooms${route}`, {
  ...options, headers: { authorization, origin, ...options.headers },
});
const manage = (id, action) => admin(`/${id}/${action}`, { method: 'POST' });
const status = async () => (await fetch(`${origin}/api/rooms/status`)).json();
const inventory = async () => (await admin()).json();
const index = async () => JSON.parse(await readFile(path.join(data, 'rooms.json'), 'utf8'));
const lookup = id => fetch(`${origin}/api/rooms/${id}`);
async function create() {
  return fetch(`${origin}/api/rooms`, { method: 'POST', headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify({ mode: 'pvp', practice: true, matchModeId: 'authored', matchModeVersion: 1 }) });
}
async function join(id, token) {
  const client = { messages: [] };
  client.socket = new WebSocket(`${origin.replace('http:', 'ws:')}/ws?room=${id}`,
    ['rts-v1', ...(token ? [`rts-resume.${token}`] : [])]);
  client.socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    client.messages.push(message);
    if (message.type === 'welcome') client.welcome = message;
  });
  client.socket.addEventListener('error', () => {});
  clients.push(client);
  await until(() => client.welcome, 'welcome');
  return client;
}
async function close(client) {
  if (client.socket.readyState === WebSocket.CLOSED) return;
  const closed = new Promise(resolve => client.socket.addEventListener('close', resolve, { once: true }));
  client.socket.close();
  await closed;
}
async function missing(file) {
  await assert.rejects(readFile(file), { code: 'ENOENT' });
}

try {
  await start();
  assert.equal((await fetch(`${origin}/api/admin/rooms`)).status, 401, 'inventory is operator-only');
  const first = await create();
  assert.equal(first.status, 201);
  const { roomId } = await first.json();
  assert.equal((await fetch(`${origin}/api/admin/rooms/${roomId}/archive`, { method: 'POST' })).status, 401);
  assert.equal((await admin(`/${roomId}/archive`, { method: 'POST', headers: { origin: 'https://foreign.example' } })).status, 403);
  const active = path.join(data, 'rooms', roomId);
  const archived = path.join(data, 'archived-rooms', roomId);
  await writeFile(path.join(active, 'custom-maps', 'sentinel.txt'), 'preserve authored source');
  const player = await join(roomId);
  const token = player.welcome.player.sessionToken;
  assert.equal(player.welcome.state.practice, true);
  assert.equal((await manage(roomId, 'archive')).status, 409, 'connected rooms cannot be archived');
  const refusal = await create();
  assert.equal(refusal.status, 429);
  assert.match((await refusal.json()).error, /Resume or join an existing room/);
  assert.equal((await lookup(roomId)).status, 200, 'full capacity never blocks an existing invite');
  await close(player);
  await until(async () => (await inventory()).rooms[0].activeConnections === 0, 'disconnect');
  const lastActiveAt = (await inventory()).rooms[0].lastActiveAt;
  await delay(100);
  await stop();
  assert.equal((await index()).rooms[0].lastActiveAt, lastActiveAt, 'deployment shutdown must not renew an idle room');

  // Session checks can boot a worker but do not keep a departed match alive.
  await start();
  assert.equal((await fetch(`${origin}/api/session?room=${roomId}`, {
    headers: { 'x-rts-resume-token': token },
  })).status, 200);
  await until(async () => (await inventory()).rooms[0].pendingConnections === 0, 'session response released');
  const matchBefore = JSON.parse(await readFile(path.join(active, 'match-state.json'), 'utf8')).matchId;
  const competing = await Promise.all([manage(roomId, 'archive'), manage(roomId, 'archive')]);
  assert.deepEqual(competing.map(value => value.status).sort(), [200, 409], 'one archive wins while the worker flushes');
  assert.equal((await status()).roomCount, 0);
  await missing(path.join(active, 'match-state.json'));
  const checkpoint = await readFile(path.join(archived, 'match-state.json'));
  assert.equal(JSON.parse(checkpoint).matchId, matchBefore);
  assert.equal(await readFile(path.join(archived, 'custom-maps', 'sentinel.txt'), 'utf8'), 'preserve authored source');
  const archivedEntry = (await inventory()).archives[0];
  assert.equal(archivedEntry.lastActiveAt, lastActiveAt, 'archiving a worker does not renew activity');
  assert.equal(archivedEntry.launchOptions.practice, true);
  assert.equal((await lookup(roomId)).status, 404);
  assert.equal((await fetch(`${origin}/api/session?room=${roomId}`, { headers: { 'x-rts-resume-token': token } })).status, 404);

  // Exercise the actual menu's Practice action against the capacity just freed.
  dom = new JSDOM(await readFile(path.join(ROOT, 'index.html'), 'utf8'), { url: origin, pretendToBeVisual: true });
  let target;
  await bootGameEntry({ win: dom.window, fetchImpl: (url, options) => fetch(new URL(url, origin), options),
    navigate: url => { target = new URL(url); }, loadGame: async () => { throw new Error('menu must not load the renderer'); } });
  dom.window.document.querySelector('#menu-practice').click();
  await until(() => target, 'ordinary Practice menu creates a room');
  const secondId = target.searchParams.get('room');
  const second = await join(secondId);
  assert.equal(second.welcome.state.practice, true);
  assert.equal((await manage(roomId, 'restore')).status, 429, 'restoring cannot exceed the cap');
  await close(second);
  await until(async () => (await inventory()).rooms[0].activeConnections === 0, 'Practice leaves');
  assert.equal((await manage(secondId, 'archive')).status, 200);
  const restores = await Promise.all([manage(roomId, 'restore'), manage(roomId, 'restore'), create()]);
  assert.equal(restores.filter(value => value.status === 200 || value.status === 201).length, 1, 'restore/create race reserves one slot');
  // Creation is allowed to win; put the original room back deterministically.
  if (restores[0].status !== 200 && restores[1].status !== 200) {
    const winner = (await inventory()).rooms[0];
    assert.equal((await manage(winner.id, 'archive')).status, 200);
    assert.equal((await manage(roomId, 'restore')).status, 200);
  }
  assert.deepEqual(await readFile(path.join(active, 'match-state.json')), checkpoint, 'restore does not rewrite checkpoint bytes');
  const resumed = await join(roomId, token);
  assert.equal(resumed.welcome.recoveredFromCheckpoint, true);
  assert.equal(resumed.welcome.matchId, matchBefore);
  assert.equal(resumed.welcome.player.resumed, true);
  assert.equal(resumed.welcome.state.practice, true);
  await close(resumed);
  await until(async () => (await inventory()).rooms[0].activeConnections === 0, 'restored room leaves');
  await stop();

  // Loss of the index after a restore preserves the archived launch identity.
  // The restore marker may be older than the last genuine gameplay activity.
  const restoreMetadataPath = path.join(active, 'room-archive.json');
  const restoreMetadata = JSON.parse(await readFile(restoreMetadataPath, 'utf8'));
  restoreMetadata.index.rooms[0].lastActiveAt = Date.now() - 90_000;
  await writeFile(restoreMetadataPath, JSON.stringify(restoreMetadata));
  await rm(path.join(data, 'rooms.json'));
  await start();
  assert.equal((await inventory()).rooms[0].launchOptions.practice, true);
  assert.equal((await lookup(roomId)).status, 200, 'index rebuild never expires recent gameplay from a stale restore marker');
  assert.equal((await status()).roomCount, 1, 'archives do not reappear during index rebuild');
  assert.equal((await manage(roomId, 'archive')).status, 200);
  assert.equal((await status()).roomCount, 0);
  await stop();

  // Startup expiry archives rather than deletes; fresh admission sweeps overdue
  // entries immediately, without waiting for the periodic minute sweep.
  const expired = 'e'.repeat(32), due = 'd'.repeat(32);
  for (const id of [expired, due]) {
    await mkdir(path.join(data, 'rooms', id, 'custom-maps'), { recursive: true });
    await writeFile(path.join(data, 'rooms', id, 'custom-maps', 'sentinel.txt'), id);
  }
  const now = Date.now();
  await writeFile(path.join(data, 'rooms.json'), JSON.stringify({ version: 3, rooms: [
    { id: expired, createdAt: now - 90_000, lastActiveAt: now - 90_000, launchOptions: { mode: 'pvp' } },
    { id: due, createdAt: now - 57_000, lastActiveAt: now - 57_000, launchOptions: { mode: 'pvp' } },
  ] }));
  await start();
  assert.equal((await status()).roomCount, 1);
  assert.equal(await readFile(path.join(data, 'archived-rooms', expired, 'custom-maps', 'sentinel.txt'), 'utf8'), expired);
  await delay(Math.max(0, now + 3200 - Date.now()));
  assert.equal((await create()).status, 201, 'creation reclaims an expired slot before periodic sweep');
  assert.equal(await readFile(path.join(data, 'archived-rooms', due, 'custom-maps', 'sentinel.txt'), 'utf8'), due);
  console.log(JSON.stringify({ passed: [
    'operator authentication and origin policy', 'connected protection and archive races',
    'idle shutdown/session probes do not renew activity', 'ordinary menu Practice after capacity release',
    'bounded restore/create race', 'checkpoint bytes, maps, match identity and seat recovery',
    'restored launch identity after index loss', 'archives stay out of rebuild',
    'startup expiry and admission-time expiry preserve data',
  ] }));
} finally {
  dom?.window.close();
  for (const client of clients) client.socket.close();
  await stop();
  await rm(temporary, { recursive: true, force: true });
}
