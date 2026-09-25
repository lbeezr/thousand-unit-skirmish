import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Isolated two-client regression for a building placed on an attack-move
// route during combat. Requires Node 24's built-in WebSocket.
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SERVER_PATH = path.join(ROOT, 'server.mjs');
const READY_TIMEOUT_MS = 10_000;
const SCENARIO_TIMEOUT_MS = 35_000;
const MAP_WIDTH = 64;
const MAP_HEIGHT = 64;
const ATTACKER_ID = 4;
const TARGET_ID = 125;
const BLOCKED_GOAL = { x: -2, z: -10 };
const QUEUED_GOAL = { x: 4, z: -10 };

let serverLogs = '';
let stage = 'startup';
let child;
let clients = [];

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
      RTS_MAP: 'maps/open-field.json',
      RTS_MATCH_STATE_PATH: checkpointPath,
      RTS_CUSTOM_MAP_DIRECTORY: customMapDirectory,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  processHandle.stdout.on('data', (chunk) => { output += chunk.toString(); serverLogs += chunk.toString(); });
  processHandle.stderr.on('data', (chunk) => { output += chunk.toString(); serverLogs += chunk.toString(); });
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
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
    const state = message.type === 'state' || message.type === 'welcome' || message.type === 'mapChange'
      ? (message.type === 'state' ? message : message.state) : null;
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
  client.waitForState = (predicate, timeoutMs) => waitForState(client, predicate, timeoutMs);
  client.waitForMessage = (predicate, timeoutMs) => waitForMessage(client, predicate, timeoutMs);
  return client;
}

async function connectClient(port) {
  const client = createClient(port);
  const opened = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out opening a WebSocket.')), READY_TIMEOUT_MS);
    client.socket.addEventListener('open', () => { clearTimeout(timeout); resolve(); }, { once: true });
    client.socket.addEventListener('error', () => { clearTimeout(timeout); reject(new Error('WebSocket connection failed.')); }, { once: true });
  });
  const welcome = waitForMessage(client, (message) => message.type === 'welcome');
  await opened;
  client.welcome = await welcome;
  client.latest = client.welcome.state;
  return client;
}

function waitForMessage(client, predicate, timeoutMs = SCENARIO_TIMEOUT_MS) {
  const existing = client.messages.find(predicate);
  if (existing) return Promise.resolve(existing);
  return new Promise((resolve, reject) => {
    const waiter = { predicate, resolve, timeout: setTimeout(() => {
      client.messageWaiters.splice(client.messageWaiters.indexOf(waiter), 1);
      reject(new Error(`Timed out waiting for a message at stage "${stage}".`));
    }, timeoutMs) };
    client.messageWaiters.push(waiter);
  });
}

function waitForState(client, predicate, timeoutMs = SCENARIO_TIMEOUT_MS) {
  if (client.latest && predicate(client.latest)) return Promise.resolve(client.latest);
  return new Promise((resolve, reject) => {
    const waiter = { predicate, resolve, timeout: setTimeout(() => {
      client.stateWaiters.splice(client.stateWaiters.indexOf(waiter), 1);
      reject(new Error(`Timed out waiting for state at stage "${stage}" (tick ${client.latest?.tick ?? 'unknown'}).`));
    }, timeoutMs) };
    client.stateWaiters.push(waiter);
  });
}

async function closeClient(client) {
  if (!client || client.socket.readyState === WebSocket.CLOSED) return;
  await new Promise((resolve) => {
    client.socket.addEventListener('close', resolve, { once: true });
    client.socket.close(1000, 'live attack-move repair scenario complete');
  });
}

function send(client, message) {
  client.socket.send(JSON.stringify(message));
}

function unitById(state, id) {
  return state.units.find((row) => row[0] === id);
}

function cellFor(point) {
  const column = Math.floor(point.x + MAP_WIDTH / 2);
  const row = Math.floor(point.z + MAP_HEIGHT / 2);
  return row * MAP_WIDTH + column;
}

function cellCenter(cell) {
  return {
    x: (cell % MAP_WIDTH) - MAP_WIDTH / 2 + 0.5,
    z: Math.floor(cell / MAP_WIDTH) - MAP_HEIGHT / 2 + 0.5,
  };
}

function waitForNotice(client, prefix, token) {
  return waitForMessage(client, (message) => message.type === 'notice'
    && message.clientOrderToken === token && message.message?.startsWith(prefix));
}

function issueMove(client, id, point, token, type = 'move', queue = false) {
  const unit = unitById(client.latest, id);
  assert.ok(unit, `unit ${id} should be in the current snapshot`);
  send(client, {
    type, ids: [id], unitGenerations: [unit[8]],
    x: point.x, z: point.z, formation: 'box',
    ...(queue ? { queue: true } : {}), clientOrderToken: token,
  });
}

async function waitForCheckpoint(checkpointPath, predicate, timeoutMs = SCENARIO_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const checkpoint = JSON.parse(await readFile(checkpointPath, 'utf8'));
      if (predicate(checkpoint)) return checkpoint;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 35));
  }
  throw new Error(`Timed out waiting for a checkpoint at stage "${stage}".`);
}

async function readHealth(port) {
  const response = await fetch(`http://127.0.0.1:${port}/health`, { cache: 'no-store' });
  assert.ok(response.ok, 'isolated server health endpoint should be available');
  return response.json();
}

async function waitForPlannerSample(port, predicate, timeoutMs = SCENARIO_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const health = await readHealth(port);
    const sample = health.movePlanning.find(predicate);
    if (sample) return sample;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error(`Timed out waiting for a move-planner sample at stage "${stage}".`);
}

const port = await reservePort();
const dataDirectory = await mkdtemp(path.join(os.tmpdir(), 'rts-live-repair-'));
const checkpointPath = path.join(dataDirectory, 'match.json');
const customMapDirectory = path.join(dataDirectory, 'custom-maps');

try {
  child = await startServer(port, checkpointPath, customMapDirectory);
  const azure = await connectClient(port);
  const ember = await connectClient(port);
  clients = [azure, ember];
  assert.equal(azure.welcome.player.team, 0, 'first client should own Azure');
  assert.equal(ember.welcome.player.team, 1, 'second client should own Ember');

  stage = 'publish isolated combat map';
  const map = {
    id: 'live-route-repair-check',
    name: 'Live Route Repair Check',
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrainSeed: 17,
    fogOfWar: false,
    obstacles: [],
    spawnPoints: [
      { team: 0, x: -8, z: 0 },
      { team: 1, x: -6, z: -4 },
    ],
    resourceNodes: [],
    triggers: [],
    scenarioEvents: [{
      id: 'route-repair-wood', name: 'Route repair test wood', type: 'timed-supply',
      afterSeconds: 0.5, team: '0', foodReward: 0, woodReward: 200,
      message: 'ROUTE REPAIR TEST READY',
    }],
  };
  const mapChangedAzure = waitForState(azure, (state) => state.mapId === map.id);
  const mapChangedEmber = waitForState(ember, (state) => state.mapId === map.id);
  const mapPublished = waitForMessage(azure, (message) => message.type === 'mapPublished' && message.mapId === map.id);
  send(azure, { type: 'publishMap', map });
  await Promise.all([mapChangedAzure, mapChangedEmber, mapPublished]);

  stage = 'prepare 250-unit match';
  const armyResetAzure = waitForState(azure, (state) => state.armySize === 250 && state.units.length === 250);
  const armyResetEmber = waitForState(ember, (state) => state.armySize === 250 && state.units.length === 250);
  send(azure, { type: 'selectArmySize', count: 250 });
  await Promise.all([armyResetAzure, armyResetEmber]);

  stage = 'isolate one Ember target';
  const emberExtras = ember.latest.units.filter((row) => row[1] === 1 && row[0] !== TARGET_ID);
  const extraIds = emberExtras.map((row) => row[0]);
  const extraGenerations = emberExtras.map((row) => row[8]);
  assert.equal(extraIds.length, 124);
  const emberOtherAway = waitForState(azure, (state) => {
    const attacker = unitById(state, ATTACKER_ID);
    return attacker && extraIds.every((id) => {
      const other = unitById(state, id);
      return other && Math.hypot(attacker[2] - other[2], attacker[3] - other[3]) > 10;
    });
  });
  send(ember, {
    type: 'move', ids: extraIds, unitGenerations: extraGenerations,
    x: 14, z: 0, formation: 'box', clientOrderToken: 1,
  });
  await ember.waitForMessage((message) => message.type === 'notice'
    && message.clientOrderToken === 1 && message.message?.startsWith('MOVE ORDER'));
  await emberOtherAway;
  assert.ok(unitById(ember.latest, TARGET_ID)?.[4] > 0,
    'the intended enemy target should remain alive');

  const attackerStart = unitById(azure.latest, ATTACKER_ID);
  const targetStart = unitById(azure.latest, TARGET_ID);
  assert.ok(attackerStart && targetStart, 'attacker and intended target should exist');
  const initialTargetDistance = Math.hypot(attackerStart[2] - targetStart[2], attackerStart[3] - targetStart[3]);
  assert.ok(initialTargetDistance < 4.8 && initialTargetDistance > 1.28,
    `target should be inside acquisition range but outside melee range (distance ${initialTargetDistance})`);

  stage = 'attack-move and queue waypoint';
  const attackMoveDone = waitForNotice(azure, 'ATTACK MOVE ORDER · 1 UNITS', 2);
  issueMove(azure, ATTACKER_ID, BLOCKED_GOAL, 2, 'attackMove');
  await attackMoveDone;
  const queueAck = waitForNotice(azure, 'WAYPOINT QUEUED · 1 UNITS', 3);
  issueMove(azure, ATTACKER_ID, QUEUED_GOAL, 3, 'move', true);
  await queueAck;

  stage = 'acquire and damage the target';
  const damaged = await waitForState(azure, (state) => unitById(state, TARGET_ID)?.[4] < 100);
  const damagedCheckpoint = await waitForCheckpoint(checkpointPath, (checkpoint) => {
    const attacker = checkpoint.state?.units?.[ATTACKER_ID];
    if (!attacker || attacker.attackTargetId !== TARGET_ID || attacker.attackMove !== true
      || attacker.attackMoveResumePath === null || attacker.attackMoveResumePath.length === 0
      || attacker.queuedWaypoints?.length !== 1) return false;
    const blockedCell = cellFor(BLOCKED_GOAL);
    return attacker.attackMoveResumePath.slice(attacker.attackMoveResumePathIndex)
      .includes(blockedCell);
  });
  const preRepairUnit = damagedCheckpoint.state.units[ATTACKER_ID];
  assert.ok(unitById(damaged, TARGET_ID)[4] < 100, 'the intended target should have taken combat damage');
  assert.equal(preRepairUnit.attackTargetId, TARGET_ID);
  assert.equal(preRepairUnit.attackMove, true);

  stage = 'place a building across the saved route during combat';
  const buildingReply = waitForMessage(azure, (message) => message.type === 'notice'
    && message.clientOrderToken === 4
    && (message.message?.startsWith('ARCHERY RANGE PLACED')
      || message.message?.startsWith('BUILD REJECTED')));
  await waitForState(azure, (state) => Array.isArray(state.wood) && state.wood[0] >= 150);
  const builder = unitById(azure.latest, 0);
  send(azure, {
    type: 'build', ids: [0], unitGenerations: [builder[8]],
    buildingType: 'archery-range', x: BLOCKED_GOAL.x, z: BLOCKED_GOAL.z,
    clientOrderToken: 4,
  });
  const buildingAck = await buildingReply;
  assert.ok(buildingAck.message?.startsWith('ARCHERY RANGE PLACED · WORKERS BUILDING'),
    `building should be accepted on the live attack-move route (server replied: ${buildingAck.message})`);
  const buildingPlaced = await waitForState(azure, (state) => state.buildings?.some((building) => (
    building.team === 0 && building.type === 'archery-range'
      && Math.hypot(building.x - BLOCKED_GOAL.x, building.z - BLOCKED_GOAL.z) < 1.1
  )));
  assert.equal(buildingPlaced.buildings.length, 1, 'the test building should block the saved route');

  const invalidatedCombatRoute = await waitForCheckpoint(checkpointPath, (checkpoint) => {
    const attacker = checkpoint.state?.units?.[ATTACKER_ID];
    return attacker?.attackTargetId === TARGET_ID && attacker.attackMove === true
      && attacker.attackMoveRouteReady === false && attacker.attackMoveResumePath === null
      && attacker.queuedWaypoints?.length === 1;
  });
  const invalidatedUnit = invalidatedCombatRoute.state.units[ATTACKER_ID];
  assert.notEqual(invalidatedUnit.moveGoalCell, cellFor(BLOCKED_GOAL),
    'the blocked move goal should be replaced with a walkable neighboring cell');

  stage = 'finish combat and rebuild the interrupted move route';
  const defeated = await waitForState(azure, (state) => unitById(state, TARGET_ID)?.[4] === 0, 18_000);
  assert.ok(defeated.tick > damaged.tick, 'combat should continue after the saved route was invalidated');
  const repairSample = await waitForPlannerSample(port, (sample) => (
    sample.mode === 'blocked-route-repair' && sample.unitCount >= 1
      && sample.routeFailures === 0
  ));
  const repaired = await waitForCheckpoint(checkpointPath, (checkpoint) => {
    const attacker = checkpoint.state?.units?.[ATTACKER_ID];
    return attacker && attacker.hp > 0 && attacker.attackTargetId < 0
      && attacker.attackMove === true && attacker.attackMoveRouteReady === true
      && attacker.movePlanningPending === false && attacker.attackMoveResumePath === null
      && attacker.queuedWaypoints?.length === 1;
  });
  const repairedUnit = repaired.state.units[ATTACKER_ID];
  assert.notEqual(repairedUnit.moveGoalCell, cellFor(BLOCKED_GOAL));

  stage = 'reach repaired goal and dispatch queued destination';
  const repairedGoal = cellCenter(repairedUnit.moveGoalCell);
  await azure.waitForState((state) => {
    const unit = unitById(state, ATTACKER_ID);
    return unit && Math.hypot(unit[2] - repairedGoal.x, unit[3] - repairedGoal.z) < 1.2;
  });
  const queuedRouteStarted = await waitForCheckpoint(checkpointPath, (checkpoint) => {
    const attacker = checkpoint.state?.units?.[ATTACKER_ID];
    return attacker && attacker.queuedWaypoints?.length === 0
      && attacker.moveGoalCell === cellFor(QUEUED_GOAL);
  });
  const finalGoal = cellCenter(cellFor(QUEUED_GOAL));
  const finalState = await azure.waitForState((state) => {
    const unit = unitById(state, ATTACKER_ID);
    return unit && Math.hypot(unit[2] - finalGoal.x, unit[3] - finalGoal.z) < 1.2;
  }, 20_000);
  const completedCheckpoint = await waitForCheckpoint(checkpointPath, (checkpoint) => {
    const attacker = checkpoint.state?.units?.[ATTACKER_ID];
    return attacker && attacker.attackTargetId < 0 && attacker.queuedWaypoints?.length === 0
      && attacker.moveGoalCell === cellFor(QUEUED_GOAL)
      && attacker.pathIndex >= attacker.path.length;
  });

  console.log(JSON.stringify({
    workload: 'live attack-move route repair during combat with queued destination',
    mapId: map.id,
    attackerId: ATTACKER_ID,
    targetId: TARGET_ID,
    targetHealthAfterEngagement: unitById(damaged, TARGET_ID)[4],
    targetDefeated: unitById(defeated, TARGET_ID)[4] === 0,
    savedRouteIntersectedBuilding: true,
    routeInvalidatedDuringCombat: invalidatedUnit.attackMoveRouteReady === false
      && invalidatedUnit.attackMoveResumePath === null,
    repairedMoveGoalCell: repairedUnit.moveGoalCell,
    repairPlanner: {
      mode: repairSample.mode,
      unitCount: repairSample.unitCount,
      routeFailures: repairSample.routeFailures,
      elapsedMs: repairSample.elapsedMs,
      queueWaitMs: repairSample.queueWaitMs,
    },
    queuedRouteStarted: queuedRouteStarted.state.units[ATTACKER_ID].moveGoalCell === cellFor(QUEUED_GOAL),
    queuedDestinationReached: Math.hypot(
      unitById(finalState, ATTACKER_ID)[2] - finalGoal.x,
      unitById(finalState, ATTACKER_ID)[3] - finalGoal.z,
    ) < 1.2,
    queuedDestinationCompleted: completedCheckpoint.state.units[ATTACKER_ID].pathIndex
      >= completedCheckpoint.state.units[ATTACKER_ID].path.length,
  }, null, 2));
} catch (error) {
  console.error(error);
  const latest = clients[0]?.latest;
  console.error(JSON.stringify({ stage, serverLogs, state: latest && {
    tick: latest.tick,
    unitCount: latest.units?.length,
    attacker: unitById(latest, ATTACKER_ID),
    target: unitById(latest, TARGET_ID),
    buildings: latest.buildings,
  } }, null, 2));
  process.exitCode = 1;
} finally {
  await Promise.allSettled(clients.map(closeClient));
  await stopServer(child);
  await rm(dataDirectory, { recursive: true, force: true });
}
