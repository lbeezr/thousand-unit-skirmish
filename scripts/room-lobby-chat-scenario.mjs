import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = await mkdtemp(path.join(os.tmpdir(), 'rts-lobby-chat-'));
const listener = createServer().listen(0, '127.0.0.1');
await once(listener, 'listening');
const port = listener.address().port;
await new Promise(resolve => listener.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let supervisor, output = '';
const clients = [];
async function until(predicate, label) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await delay(25);
  }
  throw new Error(`Timed out: ${label}\n${output}`);
}
async function start() {
  supervisor = spawn(process.execPath, ['room-supervisor.mjs'], { cwd: root,
    env: { ...process.env, PORT: String(port), RTS_HOST: '127.0.0.1', RTS_MAX_ROOMS: '4',
      RTS_ROOM_DATA_DIRECTORY: directory, RTS_CUSTOM_MAP_DIRECTORY: path.join(directory, 'default-maps'), RTS_SESSION_GRACE_MS: '10000' },
    stdio: ['ignore', 'pipe', 'pipe'] });
  supervisor.stdout.on('data', chunk => { output += chunk; });
  supervisor.stderr.on('data', chunk => { output += chunk; });
  await until(async () => {
    if (supervisor.exitCode !== null) throw new Error(output);
    try { return (await fetch(`${origin}/api/rooms/status`, { signal: AbortSignal.timeout(500) })).ok; }
    catch { return false; }
  }, 'supervisor start');
}
async function stop() {
  if (!supervisor || supervisor.exitCode !== null) return;
  const exited = once(supervisor, 'exit');
  supervisor.kill('SIGINT');
  const timer = setTimeout(() => supervisor.kill('SIGKILL'), 8000);
  try { await exited; } finally { clearTimeout(timer); }
}
async function room(pregame = true) {
  const response = await fetch(`${origin}/api/rooms`, { method: 'POST', body: JSON.stringify(pregame ? { pregame: true } : {}) });
  assert.equal(response.status, 201);
  return (await response.json()).roomId;
}
function client(roomId, token) {
  const socket = new WebSocket(`${origin.replace('http', 'ws')}/ws?room=${roomId}`,
    ['rts-v1', ...(token ? [`rts-resume.${token}`] : [])]);
  const value = { socket, welcome: null, lobby: null, chat: [], messages: [] };
  clients.push(value);
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data); value.messages.push(message);
    if (message.type === 'welcome') { value.welcome = message; value.chat = message.lobbyChat || []; }
    if (message.lobby) value.lobby = message.lobby;
    else if (message.state?.lobby) value.lobby = message.state.lobby;
    if (message.type === 'lobbyChat') value.chat = message.messages;
  });
  value.send = command => socket.send(JSON.stringify(command));
  value.exchange = async (command, predicate) => {
    const cursor = value.messages.length; value.send(command);
    let reply;
    await until(() => Boolean(reply = value.messages.slice(cursor).find(predicate)), command.type);
    return reply;
  };
  value.close = async () => {
    if (socket.readyState === WebSocket.CLOSED) return;
    socket.close(1000, 'room chat scenario complete');
    await until(() => socket.readyState === WebSocket.CLOSED, 'client disconnect');
  };
  return value;
}
const chatCommand = (clientMessageId, text = 'Chat proof') => ({ type: 'sendLobbyChat', clientMessageId, text });
const ack = id => message => message.type === 'lobbyChat' && message.ack?.clientMessageId === id;
const rejected = id => message => message.type === 'lobbyChatRejected' && message.clientMessageId === id;
const ready = value => value.exchange({ type: 'setReady', ready: true, revision: value.lobby.revision },
  message => message.type === 'lobby' && message.lobby.seats.some(seat => seat.id === value.welcome.player.id && seat.ready));

try {
  await start();
  const roomId = await room();
  let host = client(roomId);
  await until(() => host.welcome, 'host seat');
  let guest = client(roomId);
  await until(() => host.welcome && guest.welcome && host.lobby.seats.length === 2, 'both seats');
  const hostIdentity = host.welcome.player, guestIdentity = guest.welcome.player;
  assert.deepEqual([hostIdentity.team, guestIdentity.team], [0, 1]);
  const otherHost = client(await room());
  const legacy = client(await room(false));
  await until(() => otherHost.welcome && legacy.welcome, 'other room welcomes');
  assert.equal(Object.hasOwn(legacy.welcome, 'lobbyChat'), false, 'legacy entry has no new chat history');
  await ready(host); await ready(guest);
  await until(() => host.lobby.canLaunch, 'ready gate');
  const revision = host.lobby.revision;
  await host.exchange(chatCommand('host-one', '  Chat proof <img src=x> 🌲  '), ack('host-one'));
  await until(() => guest.chat.length === 1, 'guest receives chat');
  assert.deepEqual(guest.chat[0], { id: 1, playerId: hostIdentity.id, team: 0,
    clientMessageId: 'host-one', text: 'Chat proof <img src=x> 🌲' });
  assert.equal(host.lobby.canLaunch, true);
  assert.equal(host.lobby.revision, revision, 'social chat cannot invalidate configuration readiness');
  const guestCursor = guest.messages.length;
  await host.exchange(chatCommand('host-one', 'Chat proof <img src=x> 🌲'), ack('host-one'));
  await guest.exchange(chatCommand('guest-one', 'Hello Azure'), ack('guest-one'));
  assert.equal(guest.messages.slice(guestCursor).filter(ack('host-one')).length, 0, 'a retry is acknowledged only to its sender');
  assert.equal(guest.chat.length, 2);
  await otherHost.exchange({ type: 'setReady', revision: otherHost.lobby.revision, ready: true }, message => message.type === 'lobby');
  await delay(50);
  assert.equal(otherHost.messages.some(message => message.type === 'lobbyChat'), false, 'separate workers never receive room chat');
  for (const [id, patch] of [
    ['empty', { text: ' ' }], ['long', { text: 'x'.repeat(241) }], ['control', { text: 'line\nbreak' }],
    ['spoof', { playerId: guestIdentity.id }], ['host-one', { text: 'different' }],
  ]) await host.exchange({ ...chatCommand(id), ...patch }, rejected(id));
  assert.equal(host.chat.length, 2, 'rejected messages do not enter history');
  const invalidId = await host.exchange(chatCommand('x'.repeat(1000)), rejected(null));
  assert.equal(invalidId.clientMessageId, null, 'invalid request IDs cannot enlarge an acknowledgement');
  const spectator = client(roomId), duplicate = client(roomId, hostIdentity.sessionToken);
  await until(() => spectator.welcome && duplicate.welcome, 'spectators');
  assert.equal(duplicate.welcome.player.resumePending, true);
  assert.equal(spectator.welcome.lobbyChat.length, 2);
  for (const value of [spectator, duplicate]) {
    await value.exchange(chatCommand('spectator'), rejected('spectator'));
    assert.equal(value.welcome.player.team, null);
  }
  await duplicate.close();
  for (let i = 2; i <= 5; i++) await host.exchange(chatCommand(`host-${i}`), ack(`host-${i}`));
  await host.exchange(chatCommand('too-fast'), rejected('too-fast'));
  await host.close();
  host = client(roomId, hostIdentity.sessionToken);
  await until(() => host.welcome, 'seat rejoin');
  assert.equal(host.welcome.player.id, hostIdentity.id);
  assert.equal(host.welcome.lobbyChat.length, 6, 'rejoin receives current bounded history');
  await host.exchange(chatCommand('too-fast-after-rejoin'), rejected('too-fast-after-rejoin'));
  await host.exchange(chatCommand('host-one', 'Chat proof <img src=x> 🌲'), ack('host-one'));
  await ready(host); await ready(guest);
  const raceCursor = guest.messages.length;
  guest.send(chatCommand('race', 'See you in the match'));
  host.send({ type: 'launchMatch', revision: host.lobby.revision });
  await until(() => host.lobby.phase === 'running' && guest.messages.slice(raceCursor).some(message => ack('race')(message) || rejected('race')(message)), 'send/launch serialization');
  const acceptedRace = guest.messages.slice(raceCursor).some(ack('race'));
  assert.equal(guest.chat.some(message => message.clientMessageId === 'race'), acceptedRace);
  await guest.exchange(chatCommand('running'), rejected('running'));
  const priorHistory = host.chat.length;
  await host.exchange({ type: 'reset' }, message => message.type === 'lobby' && message.lobby.phase === 'lobby');
  assert.equal(host.chat.length, priorHistory, 'rematch does not erase room communication');
  const checkpointPath = path.join(directory, 'rooms', roomId, 'match-state.json');
  await until(async () => {
    try { return JSON.parse(await readFile(checkpointPath, 'utf8')).state.pregame?.phase === 'lobby'; }
    catch { return false; }
  }, 'waiting checkpoint');
  assert.equal((await readFile(checkpointPath, 'utf8')).includes('Chat proof'), false, 'chat is not persisted in simulation checkpoints');
  await stop(); await start();
  host = client(roomId, hostIdentity.sessionToken); guest = client(roomId, guestIdentity.sessionToken);
  await until(() => host.welcome && guest.welcome, 'recovery');
  assert.equal(host.welcome.player.id, hostIdentity.id);
  assert.equal(guest.welcome.player.id, guestIdentity.id);
  assert.equal(host.lobby.phase, 'lobby');
  assert.deepEqual(host.welcome.lobbyChat, [], 'worker restart clears the ephemeral history');
  await host.exchange(chatCommand('after-restart'), ack('after-restart'));
  assert.equal(host.chat.length, 1);
  for (const [url, status] of [['/src/room-lobby-chat-ui.mjs', 200], ['/src/room-lobby-chat.mjs', 404]]) {
    assert.equal((await fetch(`${origin}${url}`)).status, status);
  }
  console.log(JSON.stringify({ passed: ['two-seat identity and read-only spectators', 'plain-text validation and atomic rejection',
    'room isolation and legacy admission', 'retry acknowledgement and rate limits across rejoin', 'readiness unchanged by chat',
    'chat/launch serialization and rematch', 'ephemeral recovery without checkpoint chat', 'public UI/private authority routes'] }));
} finally {
  const closing = Promise.allSettled(clients.map(value => value.close()));
  await stop();
  await closing;
  await rm(directory, { recursive: true, force: true });
}
