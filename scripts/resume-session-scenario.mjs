import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SERVER_PATH = path.join(ROOT, 'server.mjs');
const READY_TIMEOUT_MS = 10_000;
const SESSION_GRACE_MS = 1_500;

async function reservePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function startServer(port, customMapDirectory) {
  const child = spawn(process.execPath, [SERVER_PATH], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      RTS_HOST: '127.0.0.1',
      RTS_CUSTOM_MAP_DIRECTORY: customMapDirectory,
      RTS_SESSION_GRACE_MS: String(SESSION_GRACE_MS),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Server exited during startup:\n${output}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`, { cache: 'no-store' });
      if (response.ok) return child;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  child.kill('SIGKILL');
  throw new Error(`Server did not become healthy within ${READY_TIMEOUT_MS} ms:\n${output}`);
}

async function stopServer(child) {
  if (!child || child.exitCode !== null) return;
  const exited = once(child, 'exit');
  child.kill('SIGINT');
  await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 3000))]);
  if (child.exitCode === null) {
    const forcedExit = once(child, 'exit');
    child.kill('SIGKILL');
    await forcedExit;
  }
}

function createClient(port, protocols = ['rts-v1']) {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`, protocols);
  const messages = [];
  const waiters = [];
  socket.addEventListener('message', (event) => {
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    messages.push(message);
    for (let index = waiters.length - 1; index >= 0; index--) {
      const waiter = waiters[index];
      if (!waiter.predicate(message)) continue;
      waiters.splice(index, 1);
      clearTimeout(waiter.timeout);
      waiter.resolve(message);
    }
  });
  function waitForMessage(predicate) {
    const existing = messages.find(predicate);
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const waiter = { predicate, resolve, reject, timeout: setTimeout(() => {
        waiters.splice(waiters.indexOf(waiter), 1);
        reject(new Error('Timed out waiting for a server message.'));
      }, READY_TIMEOUT_MS) };
      waiters.push(waiter);
    });
  }
  const opened = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out opening a WebSocket.')), READY_TIMEOUT_MS);
    socket.addEventListener('open', () => { clearTimeout(timeout); resolve(); }, { once: true });
    socket.addEventListener('error', () => { clearTimeout(timeout); reject(new Error('WebSocket connection failed.')); }, { once: true });
  });
  return { socket, opened, waitForMessage };
}

async function closeClient(client) {
  if (!client || client.socket.readyState === WebSocket.CLOSED) return;
  await new Promise((resolve) => {
    client.socket.addEventListener('close', resolve, { once: true });
    client.socket.close(1000, 'resume session scenario complete');
  });
}

const port = await reservePort();
const customMapDirectory = await mkdtemp(path.join(os.tmpdir(), 'rts-resume-session-'));
let child;
const clients = [];

try {
  child = await startServer(port, customMapDirectory);

  const owner = createClient(port);
  clients.push(owner);
  await owner.opened;
  const ownerWelcome = await owner.waitForMessage((message) => message.type === 'welcome');
  assert.equal(ownerWelcome.player.team, 0, 'the first connection should own Azure');
  const token = ownerWelcome.player.sessionToken;
  assert.match(token, /^[A-Za-z0-9_-]{43}$/, 'the owner should receive a resume token');

  const duplicate = createClient(port, ['rts-v1', `rts-resume.${token}`]);
  clients.push(duplicate);
  await duplicate.opened;
  const duplicateWelcome = await duplicate.waitForMessage((message) => message.type === 'welcome');
  assert.equal(duplicateWelcome.player.team, null, 'a duplicate active token must not take a team');
  assert.equal(duplicateWelcome.player.resumePending, true, 'the duplicate should be told the seat is still active');
  assert.equal(duplicateWelcome.player.sessionToken, null, 'the waiting peer must not create or replace a seat token');

  const opponent = createClient(port);
  clients.push(opponent);
  await opponent.opened;
  const opponentWelcome = await opponent.waitForMessage((message) => message.type === 'welcome');
  assert.equal(opponentWelcome.player.team, 1, 'the unclaimed opponent seat should remain available');

  const seatAvailable = duplicate.waitForMessage((message) => message.type === 'resumeAvailable');
  await closeClient(owner);
  await seatAvailable;
  await closeClient(duplicate);
  await new Promise((resolve) => setTimeout(resolve, 300));

  const resumed = createClient(port, ['rts-v1', `rts-resume.${token}`]);
  clients.push(resumed);
  await resumed.opened;
  const resumedWelcome = await resumed.waitForMessage((message) => message.type === 'welcome');
  assert.equal(resumedWelcome.player.team, 0, 'the waiting player should reclaim the original team');
  assert.equal(resumedWelcome.player.resumed, true, 'the reclaimed seat should use the original session');
  await closeClient(resumed);

  await new Promise((resolve) => setTimeout(resolve, SESSION_GRACE_MS + 100));
  const replacement = createClient(port);
  clients.push(replacement);
  await replacement.opened;
  const replacementWelcome = await replacement.waitForMessage((message) => message.type === 'welcome');
  assert.equal(replacementWelcome.player.team, 0, 'a new player should claim the seat after its grace period expires');
  assert.equal(replacementWelcome.player.resumed, false, 'the replacement should receive a fresh session');

  const expiredToken = createClient(port, ['rts-v1', `rts-resume.${token}`]);
  clients.push(expiredToken);
  await expiredToken.opened;
  const expiredTokenWelcome = await expiredToken.waitForMessage((message) => message.type === 'welcome');
  assert.equal(expiredTokenWelcome.player.team, null, 'an expired token must not reclaim a seat held by a replacement');
  assert.equal(expiredTokenWelcome.player.resumed, false, 'an expired token must not restore the old session');

  console.log(JSON.stringify({
    passed: [
      'duplicate active token joins as spectator',
      'duplicate cannot claim the opponent seat',
      'waiting peer is signalled when the original seat is released',
      'original team and identity can be reclaimed inside the grace period',
      'new player can claim the seat after the grace period expires',
      'expired resume token cannot reclaim the replacement seat',
    ],
    originalTeam: ownerWelcome.player.team,
    opponentTeam: opponentWelcome.player.team,
    resumedTeam: resumedWelcome.player.team,
    replacementTeam: replacementWelcome.player.team,
    expiredTokenTeam: expiredTokenWelcome.player.team,
  }, null, 2));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await Promise.allSettled(clients.map(closeClient));
  await stopServer(child);
  await rm(customMapDirectory, { recursive: true, force: true });
}
