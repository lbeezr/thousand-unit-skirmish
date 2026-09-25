import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Isolated two-client integration for focus-fire against a production building.
// Requires Node 24's built-in WebSocket. Run with:
//   node scripts/building-attack-scenario.mjs
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SERVER_PATH = path.join(ROOT, 'server.mjs');
const READY_TIMEOUT_MS = 20_000;
const SCENARIO_TIMEOUT_MS = 100_000;
const BUILDING_MAX_HP = 1800;
const TEST_FOG_OF_WAR = process.env.RTS_ATTACK_TEST_FOG === '1';
const TEST_ARMY_SIZE = 1000;
const BUILD_SITE = { x: 0.5, z: 0.5 };
let stage = 'startup';
let serverLogs = '';
let child;
const clients = [];

async function reservePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function startServer(port, checkpointPath, customMapDirectory) {
  const processHandle = spawn(process.execPath, [SERVER_PATH], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      RTS_HOST: '127.0.0.1',
      RTS_MAP: 'maps/stone-pass.json',
      RTS_MATCH_STATE_PATH: checkpointPath,
      RTS_CUSTOM_MAP_DIRECTORY: customMapDirectory,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  let spawnError = null;
  processHandle.stdout.on('data', (chunk) => { output += chunk.toString(); serverLogs += chunk.toString(); });
  processHandle.stderr.on('data', (chunk) => { output += chunk.toString(); serverLogs += chunk.toString(); });
  processHandle.on('error', (error) => {
    spawnError = error;
    output += `${String(error?.stack || error)}\n`;
    serverLogs += `${String(error?.stack || error)}\n`;
  });
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (spawnError) throw new Error(`Could not start the match server:\n${output}`);
    if (processHandle.exitCode !== null) throw new Error(`Server exited during startup:\n${output}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`, { cache: 'no-store' });
      if (response.ok) return processHandle;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  processHandle.kill('SIGKILL');
  throw new Error(`Server did not become healthy within ${READY_TIMEOUT_MS} ms:\n${output}`);
}

async function stopServer(processHandle) {
  if (!processHandle || processHandle.exitCode !== null) return;
  const exited = once(processHandle, 'exit');
  processHandle.kill('SIGINT');
  await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 3000))]);
  if (processHandle.exitCode === null) {
    const killed = once(processHandle, 'exit');
    processHandle.kill('SIGKILL');
    await killed;
  }
}

function createClient(port) {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`, ['rts-v1']);
  const client = { socket, messages: [], latest: null, stateWaiters: [], messageWaiters: [], welcome: null };
  socket.addEventListener('message', (event) => {
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    client.messages.push(message);
    const state = message.type === 'state' ? message
      : message.type === 'welcome' || message.type === 'mapChange' ? message.state : null;
    if (state?.type === 'state') {
      client.latest = state;
      for (let index = client.stateWaiters.length - 1; index >= 0; index--) {
        const waiter = client.stateWaiters[index];
        if (!waiter.predicate(state)) continue;
        client.stateWaiters.splice(index, 1);
        clearTimeout(waiter.timeout);
        waiter.resolve(state);
      }
    }
    if (message.type === 'welcome') client.welcome = message;
    for (let index = client.messageWaiters.length - 1; index >= 0; index--) {
      const waiter = client.messageWaiters[index];
      if (!waiter.predicate(message)) continue;
      client.messageWaiters.splice(index, 1);
      clearTimeout(waiter.timeout);
      waiter.resolve(message);
    }
  });
  client.waitForState = (predicate, description, timeoutMs = SCENARIO_TIMEOUT_MS) => (
    waitForState(client, predicate, description, timeoutMs)
  );
  client.waitForMessage = (predicate, description, timeoutMs = SCENARIO_TIMEOUT_MS) => (
    waitForMessage(client, predicate, description, timeoutMs)
  );
  return client;
}

async function connectClient(port) {
  const client = createClient(port);
  const opened = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out opening a WebSocket.')), READY_TIMEOUT_MS);
    client.socket.addEventListener('open', () => { clearTimeout(timeout); resolve(); }, { once: true });
    client.socket.addEventListener('error', () => { clearTimeout(timeout); reject(new Error('WebSocket connection failed.')); }, { once: true });
  });
  client.welcome = await Promise.all([
    opened,
    waitForMessage(client, (message) => message.type === 'welcome', 'welcome', READY_TIMEOUT_MS),
  ]).then(([, welcome]) => welcome);
  client.latest = client.welcome.state;
  return client;
}

function waitForMessage(client, predicate, description, timeoutMs = SCENARIO_TIMEOUT_MS) {
  const existing = client.messages.find(predicate);
  if (existing) return Promise.resolve(existing);
  return new Promise((resolve, reject) => {
    const waiter = { predicate, resolve, timeout: setTimeout(() => {
      client.messageWaiters.splice(client.messageWaiters.indexOf(waiter), 1);
      const notices = client.messages.filter((message) => message.type === 'notice')
        .slice(-5).map((message) => message.message);
      reject(new Error(`Timed out waiting for ${description} at stage "${stage}" `
        + `(tick ${client.latest?.tick ?? 'unknown'}; recent notices: ${notices.join(' | ') || 'none'}).`));
    }, timeoutMs) };
    client.messageWaiters.push(waiter);
  });
}

function waitForState(client, predicate, description, timeoutMs = SCENARIO_TIMEOUT_MS) {
  if (client.latest && predicate(client.latest)) return Promise.resolve(client.latest);
  return new Promise((resolve, reject) => {
    const waiter = { predicate, resolve, timeout: setTimeout(() => {
      client.stateWaiters.splice(client.stateWaiters.indexOf(waiter), 1);
      reject(new Error(`Timed out waiting for ${description} at stage "${stage}" (tick ${client.latest?.tick ?? 'unknown'}).`));
    }, timeoutMs) };
    client.stateWaiters.push(waiter);
  });
}

async function closeClient(client) {
  if (!client || client.socket.readyState === WebSocket.CLOSED) return;
  await new Promise((resolve) => {
    client.socket.addEventListener('close', resolve, { once: true });
    client.socket.close(1000, 'building attack scenario complete');
    setTimeout(resolve, 1000).unref();
  });
}

function send(client, message) {
  client.socket.send(JSON.stringify(message));
}

function unitById(state, id) {
  return state.units.find((row) => row[0] === id);
}

function buildingById(state, id) {
  return state.buildings.find((building) => building.id === id);
}

async function waitForCheckpoint(checkpointPath, predicate, description) {
  const deadline = Date.now() + SCENARIO_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const checkpoint = JSON.parse(await readFile(checkpointPath, 'utf8'));
      if (predicate(checkpoint)) return checkpoint;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 35));
  }
  throw new Error(`Timed out waiting for ${description} at stage "${stage}".`);
}

const port = await reservePort();
const dataDirectory = await mkdtemp(path.join(os.tmpdir(), 'rts-building-attack-'));
const checkpointPath = path.join(dataDirectory, 'match.json');
const customMapDirectory = path.join(dataDirectory, 'custom-maps');

try {
  child = await startServer(port, checkpointPath, customMapDirectory);
  const azure = await connectClient(port);
  const ember = await connectClient(port);
  clients.push(azure, ember);
  assert.equal(azure.welcome.player.team, 0, 'first client should own Azure');
  assert.equal(ember.welcome.player.team, 1, 'second client should own Ember');

  stage = 'publish the isolated attack map';
  const mapId = `building-attack-${randomBytes(4).toString('hex')}`;
  const map = {
    id: mapId,
    name: 'Building Attack Integration Check',
    width: 64,
    height: 64,
    terrainSeed: 41,
    fogOfWar: TEST_FOG_OF_WAR,
    obstacles: [],
    spawnPoints: [
      { team: 0, x: -14, z: 0 },
      { team: 1, x: 14, z: TEST_FOG_OF_WAR ? 5 : 14 },
    ],
    resourceNodes: [],
    triggers: [],
    scenarioEvents: [{
      id: 'siege-supply', name: 'Siege supply', type: 'timed-supply',
      afterSeconds: 0.5, team: '0', foodReward: 500, woodReward: 200,
      message: 'SIEGE SUPPLY READY',
    }],
  };
  const mapPublished = azure.waitForMessage((message) => message.type === 'mapPublished' && message.mapId === mapId,
    'custom map publish acknowledgement');
  const azureMap = azure.waitForState((state) => state.mapId === mapId, 'Azure custom map state');
  const emberMap = ember.waitForState((state) => state.mapId === mapId, 'Ember custom map state');
  send(azure, { type: 'publishMap', map });
  await Promise.all([mapPublished, azureMap, emberMap]);

  stage = `set a ${TEST_ARMY_SIZE.toLocaleString()}-unit army and wait for test resources`;
  const azureArmy = azure.waitForState((state) => state.armySize === TEST_ARMY_SIZE,
    `${TEST_ARMY_SIZE.toLocaleString()}-unit army`);
  const emberArmy = ember.waitForState((state) => state.armySize === TEST_ARMY_SIZE,
    `synchronized ${TEST_ARMY_SIZE.toLocaleString()}-unit army`);
  send(azure, { type: 'selectArmySize', count: TEST_ARMY_SIZE });
  await Promise.all([azureArmy, emberArmy]);
  await Promise.all([
    azure.waitForState((state) => state.food?.[0] >= 250 && state.wood?.[0] >= 175,
      'Azure building and training resources'),
    ember.waitForState((state) => state.mapId === mapId, 'Ember remains in the custom map'),
  ]);

  stage = 'construct the Azure Barracks';
  const azureWorkers = azure.latest.units.filter((unit) => unit[1] === 0 && unit[5] === 'worker');
  const workerIds = azureWorkers.map((unit) => unit[0]);
  assert.equal(workerIds.length, 4, 'Azure should have four starting builders');
  const buildResponse = azure.waitForMessage((message) => message.type === 'notice'
    && (message.message?.startsWith('BARRACKS PLACED')
      || message.message?.startsWith('BUILD REJECTED')), 'Barracks placement result');
  send(azure, {
    type: 'build', buildingType: 'barracks', ids: workerIds,
    unitGenerations: azureWorkers.map((unit) => unit[8]), ...BUILD_SITE,
  });
  const buildResult = await buildResponse;
  assert.ok(buildResult.message.startsWith('BARRACKS PLACED'),
    `Barracks placement should be accepted: ${buildResult.message}`);
  const completed = (state) => buildingById(state, state.buildings[0]?.id)?.complete === true;
  const [completeAzure, completeEmber] = await Promise.all([
    azure.waitForState(completed, 'Barracks completion'),
    ember.waitForState(completed, 'synchronized Barracks completion'),
  ]);
  const barracks = buildingById(completeAzure, completeAzure.buildings[0].id);
  assert.ok(barracks && barracks.complete, 'Barracks should be completed before the attack');
  assert.equal(barracks.hp, BUILDING_MAX_HP, 'new structures should expose full health');
  assert.equal(buildingById(completeEmber, barracks.id)?.hp, BUILDING_MAX_HP,
    'both clients should receive the same structure health');

  stage = 'fill the Barracks queue';
  for (let index = 0; index < 5; index++) send(azure, { type: 'train', buildingId: barracks.id });
  const queuedAzure = await azure.waitForState((state) => buildingById(state, barracks.id)?.queue === 5,
    'five reserved Barracks units');
  const queuedEmber = await ember.waitForState((state) => buildingById(state, barracks.id)?.queue === 5,
    'synchronized five-unit Barracks queue');
  assert.equal(buildingById(queuedAzure, barracks.id)?.queue, 5);
  assert.equal(buildingById(queuedEmber, barracks.id)?.queue, 5);

  stage = 'order Ember military to attack the building';
  assert.ok(buildingById(ember.latest, barracks.id),
    'Ember scouts should have the enemy Barracks in sight before ordering the attack');
  const military = ember.latest.units.filter((unit) => unit[1] === 1 && unit[5] !== 'worker' && unit[4] > 0);
  assert.ok(military.length > 450,
    'the scenario should exercise a large synchronized focus-fire order');
  const attackStartTick = ember.latest.tick;
  const attackAck = ember.waitForMessage((message) => message.type === 'notice'
    && message.message?.startsWith('ATTACK BUILDING ORDER'), 'server attack-building acknowledgement');
  send(ember, {
    type: 'attackBuilding', buildingId: barracks.id,
    ids: military.map((unit) => unit[0]),
    unitGenerations: military.map((unit) => unit[8]),
    clientOrderToken: 1,
  });
  await attackAck;
  const azureTargetCount = TEST_FOG_OF_WAR ? 0 : military.length;
  const [orderedAzure, orderedEmber] = await Promise.all([
    azure.waitForState((state) => state.tick > attackStartTick
      && buildingById(state, barracks.id)?.attackers === azureTargetCount,
    TEST_FOG_OF_WAR ? 'Azure fog view hides enemy building attack orders'
      : 'Azure sees the synchronized building target count'),
    ember.waitForState((state) => state.tick > attackStartTick
      && buildingById(state, barracks.id)?.attackers === military.length,
      'Ember sees the synchronized building target count'),
  ]);
  assert.equal(buildingById(orderedAzure, barracks.id)?.attackers, azureTargetCount,
    TEST_FOG_OF_WAR ? 'Azure fog view should not reveal the opposing attack count'
      : 'Azure should receive the synchronized target count when fog is off');
  assert.equal(buildingById(orderedEmber, barracks.id)?.attackers, military.length,
    'Ember should receive the authoritative count of its units focused on the Barracks');
  const [damagedAzure, damagedEmber] = await Promise.all([
    azure.waitForState((state) => (buildingById(state, barracks.id)?.hp ?? BUILDING_MAX_HP) < BUILDING_MAX_HP,
      'Azure observes structure damage'),
    ember.waitForState((state) => (buildingById(state, barracks.id)?.hp ?? BUILDING_MAX_HP) < BUILDING_MAX_HP,
      'Ember observes synchronized structure damage'),
  ]);
  const damagedAzureBarracks = buildingById(damagedAzure, barracks.id);
  const damagedEmberBarracks = buildingById(damagedEmber, barracks.id);
  assert.ok(damagedAzureBarracks.hp < BUILDING_MAX_HP, 'server should apply damage to Barracks');
  assert.equal(damagedAzureBarracks.hp, damagedEmberBarracks.hp,
    'structure health should be synchronized to both clients');

  stage = 'verify checkpointed building target';
  const checkpointWithTarget = await waitForCheckpoint(checkpointPath, (checkpoint) => (
    checkpoint.schemaVersion === 9
      && checkpoint.state?.units?.some((unit) => unit.team === 1
        && unit.attackBuildingTargetId === barracks.id)
      && (checkpoint.state?.buildings?.find((building) => building.id === barracks.id)?.hp
        ?? BUILDING_MAX_HP) < BUILDING_MAX_HP
  ), 'a saved unit targeting the Barracks');
  assert.ok(checkpointWithTarget.state.buildings.find((building) => building.id === barracks.id)?.hp < BUILDING_MAX_HP,
    'checkpoint should preserve the structure damage');

  stage = 'destroy the Barracks and clear the occupied footprint';
  const [destroyedAzure, destroyedEmber] = await Promise.all([
    azure.waitForState((state) => !buildingById(state, barracks.id), 'Barracks destruction'),
    ember.waitForState((state) => !buildingById(state, barracks.id), 'synchronized Barracks destruction'),
  ]);
  assert.ok(!buildingById(destroyedAzure, barracks.id) && !buildingById(destroyedEmber, barracks.id),
    'destroyed production building should be removed for both clients');
  const clearedCheckpoint = await waitForCheckpoint(checkpointPath, (checkpoint) => (
    !checkpoint.state?.buildings?.some((building) => building.id === barracks.id)
      && checkpoint.state?.units?.every((unit) => unit.attackBuildingTargetId !== barracks.id)
  ), 'destroyed building and cleared attacker targets in the checkpoint');

  let finalUnit = null;
  if (!TEST_FOG_OF_WAR) {
    stage = 'move through the former building footprint';
    const attacker = destroyedEmber.units.find((unit) => unit[1] === 1 && unit[5] === 'infantry' && unit[4] > 0);
    assert.ok(attacker, 'a surviving Ember Infantry should be available for the route check');
    const moveAck = ember.waitForMessage((message) => message.type === 'notice'
      && message.clientOrderToken === 2 && message.message?.startsWith('MOVE ORDER'), 'move acknowledgement');
    send(ember, {
      type: 'move', ids: [attacker[0]], unitGenerations: [attacker[8]],
      x: BUILD_SITE.x, z: BUILD_SITE.z, clientOrderToken: 2,
    });
    await moveAck;
    const reachedFootprint = await ember.waitForState((state) => {
      const unit = unitById(state, attacker[0]);
      return unit && Math.floor(unit[2] + 32) === Math.floor(BUILD_SITE.x + 32)
        && Math.floor(unit[3] + 32) === Math.floor(BUILD_SITE.z + 32);
    }, 'movement onto the former Barracks footprint');
    finalUnit = unitById(reachedFootprint, attacker[0]);
  }

  console.log(JSON.stringify({
    workload: `two-client focus-fire at ${TEST_ARMY_SIZE.toLocaleString()} units${TEST_FOG_OF_WAR ? ' with fog of war' : ''}`,
    mapId,
    totalUnits: destroyedEmber.armySize,
    building: { id: barracks.id, type: barracks.type, hpBefore: BUILDING_MAX_HP,
      hpAtFirstDamageSnapshot: damagedAzureBarracks.hp, destroyed: true, queueAtAttackStart: 5 },
    attackers: military.length,
    fogPrivateTargetCue: TEST_FOG_OF_WAR
      ? buildingById(orderedAzure, barracks.id)?.attackers === 0
        && buildingById(orderedEmber, barracks.id)?.attackers === military.length
      : null,
    synchronizedDamage: damagedAzureBarracks.hp === damagedEmberBarracks.hp,
    checkpointVersion: checkpointWithTarget.schemaVersion,
    checkpointTargetClearedAfterDestruction: clearedCheckpoint.state.units.every(
      (unit) => unit.attackBuildingTargetId !== barracks.id,
    ),
    formerFootprintReached: finalUnit ? [finalUnit[2], finalUnit[3]] : null,
  }, null, 2));
} catch (error) {
  let health = null;
  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`, { cache: 'no-store' });
    if (response.ok) health = await response.json();
  } catch {}
  const azureState = clients[0]?.latest;
  const emberState = clients[1]?.latest;
  const diagnostics = {
    azureTick: azureState?.tick,
    barracks: azureState?.buildings?.map(({ id, team, type, progress, complete }) => (
      { id, team, type, progress, complete }
    )),
    azureWorkers: azureState?.units?.filter((unit) => unit[1] === 0 && unit[5] === 'worker')
      .map((unit) => ({ id: unit[0], x: unit[2], z: unit[3], task: unit[9] })),
    emberCanSeeBarracks: emberState?.buildings?.some((building) => building.type === 'barracks'),
    emberBuildingVisibility: emberState?.visibility?.data
      ? (Buffer.from(emberState.visibility.data, 'base64')[520] >> 0) & 3 : null,
    nearestEmberUnitToBarracks: emberState?.units?.filter((unit) => unit[1] === 1)
      .map((unit) => Math.hypot(unit[2] - BUILD_SITE.x, unit[3] - BUILD_SITE.z))
      .sort((left, right) => left - right)[0],
    tickTiming: health?.tickTiming,
  };
  error.message += `\nScenario stage: ${stage}\nServer logs: ${serverLogs}`;
  error.message += `\nDiagnostics: ${JSON.stringify(diagnostics)}`;
  throw error;
} finally {
  await Promise.all(clients.map(closeClient));
  await stopServer(child);
  await rm(dataDirectory, { recursive: true, force: true });
}
