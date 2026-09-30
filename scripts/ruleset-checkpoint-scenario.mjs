import { GAMEPLAY_RULESET_REVISION, DEFAULT_FACTION_ID, UNIT_WIRE_IDS } from '../src/gameplay-definitions.mjs';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Exercise mixed roster production and restart recovery through the authoritative runtime.
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
const temp = await mkdtemp(path.join(os.tmpdir(), 'rts-ruleset-'));
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
  for (const client of clients) {
    assert.equal(client.latest.rulesetRevision, GAMEPLAY_RULESET_REVISION);
    assert.equal(client.latest.factionId, DEFAULT_FACTION_ID);
    assert.deepEqual(client.latest.unitWireIds, UNIT_WIRE_IDS);
  }
  await stop();
  const original = JSON.parse(await readFile(checkpointPath, 'utf8'));
  assert.equal(original.schemaVersion, 17); assert.equal(original.rulesetRevision, GAMEPLAY_RULESET_REVISION);
  assert.equal(original.factionId, DEFAULT_FACTION_ID);
  const legacy = structuredClone(original); legacy.schemaVersion = 11; delete legacy.rulesetRevision; delete legacy.factionId;
  legacy.state.seatSessions = [];
  await writeFile(checkpointPath, JSON.stringify(legacy)); await start(); await stop();
  const restored = JSON.parse(await readFile(checkpointPath, 'utf8'));
  assert.equal(restored.matchId, original.matchId, 'supported legacy saves migrate without replacing the match');
  assert.equal(restored.rulesetRevision, GAMEPLAY_RULESET_REVISION);
  const priorContent = structuredClone(restored);
  priorContent.schemaVersion = 12;
  priorContent.rulesetRevision = 'v1:4a8f7db2ce7f694407489bee0923c19c20c52126176f57f972906aa1dd1dc254';
  priorContent.state.seatSessions = [];
  await writeFile(checkpointPath, JSON.stringify(priorContent)); await start(); await stop();
  const contentMigrated = JSON.parse(await readFile(checkpointPath, 'utf8'));
  assert.equal(contentMigrated.matchId, original.matchId, 'the explicitly compatible Storehouse addition retains the existing match');
  assert.equal(contentMigrated.rulesetRevision, GAMEPLAY_RULESET_REVISION);
  const incompatible = structuredClone(restored); incompatible.rulesetRevision = 'v1:' + '0'.repeat(64); incompatible.state.seatSessions = [];
  const incompatibleSource = JSON.stringify(incompatible);
  await writeFile(checkpointPath, incompatibleSource); await start(); await stop();
  const fresh = JSON.parse(await readFile(checkpointPath, 'utf8'));
  assert.notEqual(fresh.matchId, original.matchId, 'an incompatible ruleset cannot silently resume');
  const rejected = (await readdir(temp)).find((name) => name.startsWith('match.json.rejected-'));
  assert.ok(rejected, 'rejected checkpoint is preserved for recovery');
  assert.equal(await readFile(path.join(temp, rejected), 'utf8'), incompatibleSource);
  assert.match(logs, /gameplay ruleset revision mismatch/);
  console.log('Ruleset pinning passed: both-seat metadata, compact stable wire IDs, schema-11 migration, mismatched revision rejection and exact preservation of the rejected save.');
} finally { await stop(); await rm(temp, { recursive: true, force: true }); }
