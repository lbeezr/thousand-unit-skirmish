import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SERVER_PATH = path.join(ROOT, 'server.mjs');
const TIMEOUT_MS = 15_000;

async function reservePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function startServer(port, customMapDirectory, checkpointPath) {
  const child = spawn(process.execPath, [SERVER_PATH], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      RTS_HOST: '127.0.0.1',
      RTS_CUSTOM_MAP_DIRECTORY: customMapDirectory,
      RTS_MATCH_STATE_PATH: checkpointPath,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Server exited during startup:\n${output}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`, { cache: 'no-store' });
      if (response.ok) return child;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  child.kill('SIGKILL');
  throw new Error(`Server did not become healthy within 10,000 ms:\n${output}`);
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

function createClient(port, token = null) {
  const protocols = token ? ['rts-v1', `rts-resume.${token}`] : ['rts-v1'];
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`, protocols);
  const messages = [];
  const messageWaiters = [];
  const stateWaiters = [];
  let latestState = null;
  socket.addEventListener('message', (event) => {
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    messages.push(message);
    const state = message.type === 'mapChange' ? message.state : message;
    if ((message.type === 'state' || message.type === 'mapChange') && state?.type === 'state') {
      latestState = state;
      for (let index = stateWaiters.length - 1; index >= 0; index--) {
        const waiter = stateWaiters[index];
        if (!waiter.predicate(state)) continue;
        stateWaiters.splice(index, 1);
        clearTimeout(waiter.timeout);
        waiter.resolve(state);
      }
    }
    for (let index = messageWaiters.length - 1; index >= 0; index--) {
      const waiter = messageWaiters[index];
      if (messages.length - 1 < waiter.afterIndex || !waiter.predicate(message)) continue;
      messageWaiters.splice(index, 1);
      clearTimeout(waiter.timeout);
      waiter.resolve(message);
    }
  });
  function waitForMessage(predicate, afterIndex = -1) {
    const existing = messages.find((message, index) => index > afterIndex && predicate(message));
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const waiter = { predicate, afterIndex, resolve, timeout: setTimeout(() => {
        messageWaiters.splice(messageWaiters.indexOf(waiter), 1);
        reject(new Error('Timed out waiting for a server message.'));
      }, TIMEOUT_MS) };
      messageWaiters.push(waiter);
    });
  }
  function waitForState(predicate) {
    if (latestState && predicate(latestState)) return Promise.resolve(latestState);
    return new Promise((resolve, reject) => {
      const waiter = { predicate, resolve, timeout: setTimeout(() => {
        stateWaiters.splice(stateWaiters.indexOf(waiter), 1);
        reject(new Error('Timed out waiting for authoritative match state.'));
      }, TIMEOUT_MS) };
      stateWaiters.push(waiter);
    });
  }
  const opened = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out opening WebSocket.')), TIMEOUT_MS);
    socket.addEventListener('open', () => { clearTimeout(timeout); resolve(); }, { once: true });
    socket.addEventListener('error', () => { clearTimeout(timeout); reject(new Error('WebSocket connection failed.')); }, { once: true });
  });
  return { socket, opened, messages, waitForMessage, waitForState };
}

function send(client, message) {
  client.socket.send(JSON.stringify(message));
}

async function publishMap(azure, ember, map) {
  const azureChanged = azure.waitForMessage((message) => message.type === 'mapChange' && message.map.id === map.id);
  const emberChanged = ember.waitForMessage((message) => message.type === 'mapChange' && message.map.id === map.id);
  const published = azure.waitForMessage((message) => message.type === 'mapPublished' && message.mapId === map.id);
  send(azure, { type: 'publishMap', map, persist: true });
  const [changeForAzure, changeForEmber, publishedNotice] = await Promise.all([azureChanged, emberChanged, published]);
  assert.deepEqual(changeForAzure.map.timedVictory, map.timedVictory);
  assert.equal(changeForAzure.map.victoryHoldSeconds, map.victoryHoldSeconds);
  assert.deepEqual(changeForEmber.map.timedVictory, map.timedVictory,
    'both clients should receive the deadline rule');
  assert.equal(changeForEmber.map.victoryHoldSeconds, map.victoryHoldSeconds,
    'both clients should receive the victory hold rule');
  assert.equal(publishedNotice.mapId, map.id);
  await Promise.all([azure, ember].map((client) => client.waitForState((state) => (
    state.mapId === map.id && state.winner === -1
  ))));
}

function scenarioMap(baseMap, { id, afterSeconds, captureVictory = false, zone = null, holdSeconds = 0 }) {
  const captureZone = zone || { column: 12, row: 22, width: 12, height: 20 };
  const objective = {
    id: 'decisive-zone', name: 'Decisive Zone', type: 'capture-zone',
    zone: captureZone, requiredUnits: 1, captureSeconds: 0.5,
    ...(captureVictory ? { victory: true } : {}),
  };
  return {
    ...baseMap,
    id,
    name: id.replaceAll('-', ' ').toUpperCase(),
    fogOfWar: false,
    victoryMode: 'any',
    ...(holdSeconds > 0 ? { victoryHoldSeconds: holdSeconds } : {}),
    obstacles: [],
    resourceNodes: [],
    spawnPoints: [{ team: 0, x: -14, z: 0 }, { team: 1, x: 14, z: 0 }],
    triggers: [objective],
    scenarioEvents: [],
    timedVictory: { afterSeconds, objectiveId: objective.id },
  };
}

const port = await reservePort();
const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'rts-timed-victory-'));
const customMapDirectory = path.join(tempRoot, 'custom-maps');
const checkpointPath = path.join(tempRoot, 'match-state.json');
const clients = [];
let server = null;

try {
  server = await startServer(port, customMapDirectory, checkpointPath);
  let azure = createClient(port);
  clients.push(azure);
  await azure.opened;
  const azureWelcome = await azure.waitForMessage((message) => message.type === 'welcome');
  assert.equal(azureWelcome.player.team, 0);
  let ember = createClient(port);
  clients.push(ember);
  await ember.opened;
  const emberWelcome = await ember.waitForMessage((message) => message.type === 'welcome');
  assert.equal(emberWelcome.player.team, 1);

  const armySizeStates = Promise.all([azure, ember].map((client) => client.waitForState((state) => state.armySize === 250)));
  send(azure, { type: 'selectArmySize', count: 250 });
  await armySizeStates;

  const baseMap = JSON.parse(await readFile(new URL('../maps/stone-pass.json', import.meta.url), 'utf8'));
  for (const [id, rule] of [
    ['deadline-invalid-time', { afterSeconds: 0.4, objectiveId: 'decisive-zone' }],
    ['deadline-missing-zone', { afterSeconds: 1, objectiveId: 'missing-zone' }],
  ]) {
    const rejectedAfter = azure.messages.length;
    const rejected = azure.waitForMessage((message) => message.type === 'mapRejected', rejectedAfter - 1);
    send(azure, { type: 'publishMap', map: {
      ...scenarioMap(baseMap, { id, afterSeconds: 1 }), timedVictory: rule,
    } });
    assert.match((await rejected).message, /invalid timed victory rule/i,
      'server validation should reject malformed deadline rules');
  }

  const capturePriority = scenarioMap(baseMap, {
    id: 'deadline-capture-priority', afterSeconds: 0.5, captureVictory: true,
  });
  await publishMap(azure, ember, capturePriority);
  const captureVictoryStates = await Promise.all([azure, ember].map((client) => client.waitForState((state) => (
    state.mapId === capturePriority.id && state.winner === 0 && state.winnerReason === 'capture'
  ))));
  assert.ok(captureVictoryStates.every((state) => state.winnerTriggerId === 'decisive-zone'),
    'a capture victory resolved on the deadline evaluation should win first');
  assert.equal(azure.messages.some((message) => message.type === 'victory'
    && message.reason === 'timed-control'), false,
  'the same match must not emit a second timed-victory result');

  const ownerDeadline = scenarioMap(baseMap, { id: 'deadline-owned-zone', afterSeconds: 1.2 });
  await publishMap(azure, ember, ownerDeadline);
  const ownerVictoryMessages = [azure, ember].map((client) => client.waitForMessage((message) => (
    message.type === 'victory' && message.reason === 'timed-control' && message.team === 0
  )));
  const ownerVictoryStates = await Promise.all([azure, ember].map((client) => client.waitForState((state) => (
    state.mapId === ownerDeadline.id && state.winner === 0 && state.winnerReason === 'timed-control'
  ))));
  const ownerNotices = await Promise.all(ownerVictoryMessages);
  assert.ok(ownerVictoryStates.every((state) => state.objectives.find((item) => item.id === 'decisive-zone')?.owner === 0),
    'deadline ownership should use the authoritative capture-zone owner');
  assert.ok(ownerNotices.every((message) => /AZURE WINS · CONTROLLED DECISIVE ZONE AT 0:02/.test(message.message)),
    'timed-victory announcements should report the configured deadline');

  const azureToken = azureWelcome.player.sessionToken;
  const emberToken = emberWelcome.player.sessionToken;
  await stopServer(server);
  server = null;
  const checkpoint = JSON.parse(await readFile(checkpointPath, 'utf8'));
  assert.equal(checkpoint.state.matchWinnerReason, 'timed-control',
    'checkpoints should retain the timed result reason');
  assert.deepEqual(checkpoint.mapDefinition.timedVictory, ownerDeadline.timedVictory,
    'checkpoints should retain the authored deadline rule');

  server = await startServer(port, customMapDirectory, checkpointPath);
  azure = createClient(port, azureToken);
  ember = createClient(port, emberToken);
  clients.push(azure, ember);
  await Promise.all([azure.opened, ember.opened]);
  const [recoveredAzure, recoveredEmber] = await Promise.all([
    azure.waitForMessage((message) => message.type === 'welcome'),
    ember.waitForMessage((message) => message.type === 'welcome'),
  ]);
  assert.equal(recoveredAzure.recoveredFromCheckpoint, true);
  assert.equal(recoveredEmber.recoveredFromCheckpoint, true);
  assert.equal(recoveredAzure.state.winnerReason, 'timed-control');
  assert.equal(recoveredEmber.state.winner, 0);
  assert.deepEqual(recoveredAzure.map.timedVictory, ownerDeadline.timedVictory,
    'reconnecting clients should receive the deadline map rule');

  const unclaimedDeadline = scenarioMap(baseMap, {
    id: 'deadline-unclaimed-draw', afterSeconds: 0.7,
    zone: { column: 30, row: 28, width: 4, height: 8 },
  });
  await publishMap(azure, ember, unclaimedDeadline);
  const drawMessages = [azure, ember].map((client) => client.waitForMessage((message) => (
    message.type === 'victory' && message.reason === 'timed-control' && message.team === 2
  )));
  const drawStates = await Promise.all([azure, ember].map((client) => client.waitForState((state) => (
    state.mapId === unclaimedDeadline.id && state.winner === 2 && state.winnerReason === 'timed-control'
  ))));
  const drawNotices = await Promise.all(drawMessages);
  assert.ok(drawStates.every((state) => state.objectives.find((item) => item.id === 'decisive-zone')?.owner === -1),
    'an unclaimed decisive zone should remain neutral at the deadline');
  assert.ok(drawNotices.every((message) => /DRAW · DECISIVE ZONE UNCLAIMED AT 0:01/.test(message.message)),
    'an unclaimed zone should announce a draw at its deadline');

  for (const [id, holdSeconds] of [
    ['victory-hold-too-short', 0.25],
    ['victory-hold-too-long', 3600.5],
    ['victory-hold-no-zone', 2],
  ]) {
    const rejectedAfter = azure.messages.length;
    const rejected = azure.waitForMessage((message) => message.type === 'mapRejected', rejectedAfter - 1);
    const invalidMap = scenarioMap(baseMap, {
      id, afterSeconds: 600, captureVictory: id !== 'victory-hold-no-zone',
    });
    invalidMap.victoryHoldSeconds = holdSeconds;
    send(azure, { type: 'publishMap', map: invalidMap });
    assert.match((await rejected).message, /victory hold/i,
      'server validation should reject malformed or unusable victory-hold rules');
  }

  const holdMap = scenarioMap(baseMap, {
    id: 'capture-hold-reset-recovery', afterSeconds: 60, captureVictory: true, holdSeconds: 12,
    zone: { column: 28, row: 28, width: 8, height: 8 },
  });
  holdMap.scenarioEvents = [{
    id: 'crown-cache', name: 'Crown Cache', type: 'timed-supply', afterSeconds: 1,
    team: 'capturing', foodReward: 25,
    trigger: { type: 'capture', objectiveId: 'decisive-zone' },
  }];
  await publishMap(azure, ember, holdMap);
  const holdDropNotice = azure.waitForMessage((message) => (
    message.type === 'scenarioEvent' && message.eventId === 'crown-cache'
  ));
  send(azure, { type: 'move', ids: [0], x: -0.5, z: -0.5, clientOrderToken: 501 });
  const firstCapture = await Promise.all([azure, ember].map((client) => client.waitForState((state) => (
    state.mapId === holdMap.id && state.objectives.find((item) => item.id === 'decisive-zone')?.owner === 0
  ))));
  assert.ok(firstCapture.every((state) => state.winner === -1),
    'a marked-zone capture should start the hold instead of winning immediately');
  const azureHold = await azure.waitForState((state) => state.mapId === holdMap.id
    && state.victoryHold?.activeTeams?.[0] === true
    && state.victoryHold.progressSeconds[0] >= 0.5);
  assert.equal(azureHold.winner, -1,
    'the team should remain in the match while its hold timer is incomplete');
  const holdDrop = await holdDropNotice;
  const deliveredHoldDrop = await azure.waitForState((state) => state.mapId === holdMap.id
    && state.food?.[0] === 25 && state.scenarioEvents?.some((event) => event.id === 'crown-cache' && event.fired));
  assert.match(holdDrop.message, /Crown Cache/,
    'a held victory zone should be able to arm a delayed capture supply drop');
  assert.equal(deliveredHoldDrop.food[0], 25,
    'a delayed drop should deliver before the hold ends the match');

  send(ember, { type: 'move', ids: [125, 126], x: -0.5, z: -0.5, clientOrderToken: 502 });
  const emberRetake = await Promise.all([azure, ember].map((client) => client.waitForState((state) => (
    state.mapId === holdMap.id
    && state.objectives.find((item) => item.id === 'decisive-zone')?.owner === 1
    && state.victoryHold?.activeTeams?.[0] === false
    && state.victoryHold.progressSeconds[0] === 0
  ))));
  assert.ok(emberRetake.every((state) => state.winner === -1),
    'retaking the zone should reset Azure progress without ending the match');
  const emberHold = await azure.waitForState((state) => state.mapId === holdMap.id
    && state.victoryHold?.activeTeams?.[1] === true
    && state.victoryHold.progressSeconds[1] >= 3);
  assert.equal(emberHold.winner, -1,
    'the retaking team should start its own hold from zero');
  await new Promise((resolve) => setTimeout(resolve, 1100));

  const holdAzureToken = azureWelcome.player.sessionToken;
  const holdEmberToken = emberWelcome.player.sessionToken;
  await stopServer(server);
  server = null;
  const holdCheckpoint = JSON.parse(await readFile(checkpointPath, 'utf8'));
  assert.equal(holdCheckpoint.state.matchWinner, -1,
    'a partial victory hold must remain active through checkpoint recovery');
  assert.equal(holdCheckpoint.state.victoryHoldState.activeTeams[1], true);
  assert.ok(holdCheckpoint.state.victoryHoldState.progressSeconds[1] >= 1);

  server = await startServer(port, customMapDirectory, checkpointPath);
  azure = createClient(port, holdAzureToken);
  ember = createClient(port, holdEmberToken);
  clients.push(azure, ember);
  await Promise.all([azure.opened, ember.opened]);
  const [holdAzureWelcome, holdEmberWelcome] = await Promise.all([
    azure.waitForMessage((message) => message.type === 'welcome'),
    ember.waitForMessage((message) => message.type === 'welcome'),
  ]);
  assert.ok(holdAzureWelcome.recoveredFromCheckpoint && holdEmberWelcome.recoveredFromCheckpoint,
    'both seats should reconnect to the in-progress hold');
  assert.ok(holdAzureWelcome.state.victoryHold.progressSeconds[1] >= 1,
    'reconnect snapshots should retain the in-progress hold');
  const holdVictoryMessages = [azure, ember].map((client) => client.waitForMessage((message) => (
    message.type === 'victory' && message.reason === 'capture-hold' && message.team === 1
  )));
  const holdVictoryStates = await Promise.all([azure, ember].map((client) => client.waitForState((state) => (
    state.mapId === holdMap.id && state.winner === 1 && state.winnerReason === 'capture-hold'
  ))));
  const holdVictoryNotices = await Promise.all(holdVictoryMessages);
  assert.ok(holdVictoryStates.every((state) => state.victoryHold.progressSeconds[1] === holdMap.victoryHoldSeconds),
    'the hold should resolve exactly at its configured duration');
  assert.ok(holdVictoryNotices.every((message) => /EMBER WINS · HELD A VICTORY ZONE FOR 12S/.test(message.message)),
    'the final announcement should explain the held victory condition');

  const allHoldMap = scenarioMap(baseMap, {
    id: 'all-objective-hold', afterSeconds: 60, captureVictory: true, holdSeconds: 1.5,
    zone: { column: 28, row: 20, width: 8, height: 8 },
  });
  allHoldMap.victoryMode = 'all';
  allHoldMap.triggers = [
    { ...allHoldMap.triggers[0], id: 'north-crown', name: 'North Crown' },
    { ...allHoldMap.triggers[0], id: 'south-crown', name: 'South Crown',
      zone: { column: 28, row: 36, width: 8, height: 8 } },
  ];
  allHoldMap.timedVictory.objectiveId = 'north-crown';
  await publishMap(azure, ember, allHoldMap);
  send(azure, { type: 'move', ids: [0], x: -0.5, z: -8, clientOrderToken: 503 });
  send(azure, { type: 'move', ids: [1], x: -0.5, z: 8, clientOrderToken: 504 });
  const allZonesHeld = await Promise.all([azure, ember].map((client) => client.waitForState((state) => (
    state.mapId === allHoldMap.id
    && state.objectives.find((item) => item.id === 'north-crown')?.owner === 0
    && state.objectives.find((item) => item.id === 'south-crown')?.owner === 0
  ))));
  assert.ok(allZonesHeld.every((state) => state.winner === -1),
    'owning every marked zone should begin, rather than skip, the all-mode hold');
  const allHoldVictory = await azure.waitForState((state) => state.mapId === allHoldMap.id
    && state.winner === 0 && state.winnerReason === 'capture-hold');
  assert.ok(allHoldVictory.objectives.filter((objective) => objective.victory)
    .every((objective) => objective.owner === 0),
  'all mode should resolve only while one team still owns every marked zone');

  console.log(JSON.stringify({
    passed: [
      'invalid deadline duration and missing objective are rejected',
      'same-tick capture victory takes priority over deadline victory',
      'the current owner wins when the deadline expires',
      'timed-victory rule and result survive checkpoint restart and seat reconnect',
      'an unclaimed decisive zone produces an authoritative draw',
      'invalid victory-hold values and missing victory zones are rejected',
      'capturing a victory zone starts a contestable hold instead of an instant win',
      'a held victory zone can trigger a delayed scenario supply drop',
      'an opposing recapture resets the prior team and starts the new team at zero',
      'victory-hold progress and its final result survive checkpoint recovery and reconnect',
      'all mode requires a team to hold every marked objective for the configured duration',
    ],
  }, null, 2));
} finally {
  await Promise.all(clients.map(async (client) => {
    if (!client || client.socket.readyState === WebSocket.CLOSED) return;
    await new Promise((resolve) => {
      client.socket.addEventListener('close', resolve, { once: true });
      client.socket.close(1000, 'timed victory scenario complete');
    });
  }));
  await stopServer(server);
  await rm(tempRoot, { recursive: true, force: true });
}
