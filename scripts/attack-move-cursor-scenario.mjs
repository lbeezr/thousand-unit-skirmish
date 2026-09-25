import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

const port = Number(process.argv[2] || 4174);
const endpoint = `ws://127.0.0.1:${port}/ws`;
const ACQUIRE_RADIUS = 4.8;
const BUCKET_SIZE = 1.2;
const ARMY_SIZE = 2000;
const TARGET_ID = 1499;
const DESTINATION = { x: -30.5, z: -31.5 };
const SAFE_POINT = { x: -8, z: -8 };
const RUN_TIMEOUT_MS = 60_000;
const deadline = Date.now() + RUN_TIMEOUT_MS;
let stage = 'connect clients';

function remainingMs() {
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new Error(`Attack-move fairness scenario exceeded ${RUN_TIMEOUT_MS} ms`);
  return remaining;
}

function createFeed(socket) {
  const feed = { latest: null, stateWaiters: [], messageWaiters: [] };
  socket.addEventListener('message', (event) => {
    let message;
    try { message = JSON.parse(event.data); } catch { return; }

    const state = message.type === 'state' ? message
      : message.type === 'welcome' || message.type === 'mapChange' ? message.state
        : null;
    if (state?.type === 'state') {
      feed.latest = state;
      for (let index = feed.stateWaiters.length - 1; index >= 0; index--) {
        const waiter = feed.stateWaiters[index];
        if (!waiter.predicate(state)) continue;
        feed.stateWaiters.splice(index, 1);
        clearTimeout(waiter.timeout);
        waiter.resolve(state);
      }
    }

    for (let index = feed.messageWaiters.length - 1; index >= 0; index--) {
      const waiter = feed.messageWaiters[index];
      if (!waiter.predicate(message)) continue;
      feed.messageWaiters.splice(index, 1);
      clearTimeout(waiter.timeout);
      waiter.resolve(message);
    }
  });
  return feed;
}

function waitForState(feed, predicate, timeoutMs = remainingMs()) {
  if (feed.latest && predicate(feed.latest)) return Promise.resolve(feed.latest);
  return new Promise((resolve, reject) => {
    const waiter = { predicate, resolve, timeout: null };
    waiter.timeout = setTimeout(() => {
      feed.stateWaiters.splice(feed.stateWaiters.indexOf(waiter), 1);
      reject(new Error(`Timed out during ${stage} waiting for authoritative state after tick ${feed.latest?.tick ?? 'unknown'}`));
    }, Math.min(timeoutMs, remainingMs()));
    feed.stateWaiters.push(waiter);
  });
}

function waitForMessage(feed, predicate, timeoutMs = remainingMs()) {
  return new Promise((resolve, reject) => {
    const waiter = { predicate, resolve, timeout: null };
    waiter.timeout = setTimeout(() => {
      feed.messageWaiters.splice(feed.messageWaiters.indexOf(waiter), 1);
      reject(new Error(`Timed out during ${stage} waiting for server message`));
    }, Math.min(timeoutMs, remainingMs()));
    feed.messageWaiters.push(waiter);
  });
}

function send(socket, message) {
  socket.send(JSON.stringify(message));
}

function unitById(state, id) {
  return state.units.find((row) => row[0] === id);
}

function distance(a, b) {
  return Math.hypot(a[2] - b.x, a[3] - b.z);
}

function distanceToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const lengthSquared = dx * dx + dz * dz || 1;
  const amount = Math.max(0, Math.min(1,
    ((point[2] - start.x) * dx + (point[3] - start.z) * dz) / lengthSquared));
  return Math.hypot(point[2] - (start.x + amount * dx), point[3] - (start.z + amount * dz));
}

function spatialBucket(point) {
  const columns = Math.floor((64 - 0.5) / BUCKET_SIZE) + 1;
  const rows = columns;
  const column = Math.max(0, Math.min(columns - 1, Math.floor((point[2] + 32) / BUCKET_SIZE)));
  const row = Math.max(0, Math.min(rows - 1, Math.floor((point[3] + 32) / BUCKET_SIZE)));
  return row * columns + column;
}

function waitForOrder(feed, prefix) {
  return waitForMessage(feed, (message) => message.type === 'notice'
    && message.message?.startsWith(prefix));
}

async function connectClient() {
  const socket = new WebSocket(endpoint);
  const feed = createFeed(socket);
  const welcome = await waitForMessage(feed, (message) => message.type === 'welcome');
  return { socket, feed, welcome };
}

async function close(socket) {
  if (socket.readyState === WebSocket.CLOSED) return;
  await new Promise((resolve) => {
    socket.addEventListener('close', resolve, { once: true });
    socket.close(1000, 'attack-move fairness scenario complete');
  });
}

const clients = [];
const startedAt = Date.now();
try {
  const azure = await connectClient();
  clients.push(azure.socket);
  const ember = await connectClient();
  clients.push(ember.socket);
  assert.equal(azure.welcome.player.team, 0, 'first client should claim Azure');
  assert.equal(ember.welcome.player.team, 1, 'second client should claim Ember');

  stage = 'reset to 2,000 units';
  const armyReset = Promise.all([
    waitForState(azure.feed, (state) => state.armySize === ARMY_SIZE && state.units.length === ARMY_SIZE),
    waitForState(ember.feed, (state) => state.armySize === ARMY_SIZE && state.units.length === ARMY_SIZE),
  ]);
  send(azure.socket, { type: 'selectArmySize', count: ARMY_SIZE });
  await armyReset;

  stage = 'publish crowded-bucket map';
  const mapId = `attack-move-fairness-${randomBytes(4).toString('hex')}`;
  const map = {
    id: mapId,
    name: 'Attack Move Fairness Check',
    width: 64,
    height: 64,
    terrainSeed: 17,
    obstacles: [],
    // The edge spawn intentionally puts many formation units outside the map.
    // Their server spatial buckets clamp to (0, 0), creating one crowded bucket
    // whose persistent per-bucket cursor must eventually reach the later target.
    spawnPoints: [
      { team: 0, x: -31.5, z: -31.5 },
      { team: 1, x: -31.5, z: -31.5 },
    ],
    triggers: [],
    resourceNodes: [],
  };
  const azureMapState = waitForState(azure.feed, (state) => state.mapId === mapId);
  const emberMapState = waitForState(ember.feed, (state) => state.mapId === mapId);
  const mapPublished = waitForMessage(azure.feed, (message) => message.type === 'mapPublished'
    && message.mapId === mapId);
  send(azure.socket, { type: 'publishMap', map });
  const [setupState] = await Promise.all([azureMapState, emberMapState, mapPublished]);
  assert.equal(setupState.armySize, ARMY_SIZE);
  assert.equal(setupState.units.length, ARMY_SIZE);
  assert.equal(setupState.connected, 2, 'both clients should receive the custom scenario map');

  const attacker = unitById(setupState, 0);
  const target = unitById(setupState, TARGET_ID);
  assert.ok(attacker && attacker[1] === 0, 'Azure attacker should exist');
  assert.ok(target && target[1] === 1 && target[4] === 100, 'reachable Ember target should be alive');
  const attackStart = { x: attacker[2], z: attacker[3] };
  const targetBucket = spatialBucket(target);
  assert.equal(spatialBucket(attacker), targetBucket,
    'the attacker and later reachable target should share the crowded edge bucket');
  assert.ok(distance(attacker, { x: target[2], z: target[3] }) < ACQUIRE_RADIUS,
    'the later target should be inside attack-move acquisition range');

  const unreachableCandidateIds = setupState.units
    .filter((row) => row[1] === 1 && row[0] < TARGET_ID
      && spatialBucket(row) === targetBucket
      && Math.hypot(row[2] - attackStart.x, row[3] - attackStart.z) > ACQUIRE_RADIUS
      && distanceToSegment(row, attackStart, DESTINATION) > ACQUIRE_RADIUS + 1)
    .sort((left, right) => left[0] - right[0])
    .slice(0, 65)
    .map((row) => row[0]);
  assert.equal(unreachableCandidateIds.length, 65,
    'at least 65 earlier enemy candidates should share the target bucket but be out of range');
  assert.ok(unreachableCandidateIds.every((id) => id < TARGET_ID),
    'the crowded-bucket candidates should precede the reachable target');

  const candidateIds = new Set(unreachableCandidateIds);
  const otherNearbyEnemyIds = setupState.units
    .filter((row) => row[1] === 1 && row[0] !== TARGET_ID && !candidateIds.has(row[0])
      && distanceToSegment(row, attackStart, DESTINATION) <= ACQUIRE_RADIUS + 1.25)
    .map((row) => row[0]);
  if (otherNearbyEnemyIds.length > 0) {
    stage = 'clear other enemy units from the attacker route';
    const movedEnemies = waitForOrder(ember.feed, 'MOVE ORDER');
    send(ember.socket, { type: 'move', ids: otherNearbyEnemyIds, x: SAFE_POINT.x, z: SAFE_POINT.z });
    await movedEnemies;
    await waitForState(azure.feed, (state) => otherNearbyEnemyIds.every((id) => {
      const unit = unitById(state, id);
      return unit && distanceToSegment(unit, attackStart, DESTINATION) > ACQUIRE_RADIUS + 1.25;
    }));
  }

  stage = 'wait for the 65 earlier out-of-range candidates';
  const readyState = await waitForState(azure.feed, (state) => {
    const currentTarget = unitById(state, TARGET_ID);
    const currentAttacker = unitById(state, 0);
    if (!currentTarget || !currentAttacker || currentTarget[4] !== 100) return false;
    const bucketPrefix = state.units.filter((row) => row[1] === 1 && row[0] < TARGET_ID
      && spatialBucket(row) === targetBucket);
    return bucketPrefix.length > 64
      && bucketPrefix.every((row) => Math.hypot(row[2] - currentAttacker[2], row[3] - currentAttacker[3]) > ACQUIRE_RADIUS);
  });
  stage = 'issue attack-move order';
  const order = waitForOrder(azure.feed, 'ATTACK MOVE ORDER');
  send(azure.socket, { type: 'attackMove', ids: [0], ...DESTINATION });
  await order;

  stage = 'acquire and damage the later target';
  const azureDamaged = waitForState(azure.feed, (state) => unitById(state, TARGET_ID)?.[4] < 100);
  const emberDamaged = waitForState(ember.feed, (state) => unitById(state, TARGET_ID)?.[4] < 100);
  const [damagedAzureState, damagedEmberState] = await Promise.all([azureDamaged, emberDamaged]);
  assert.equal(unitById(damagedAzureState, TARGET_ID)[4], unitById(damagedEmberState, TARGET_ID)[4],
    'both online clients should observe the same target damage');

  console.log(JSON.stringify({
    workload: 'two-client attack-move cursor fairness within a crowded clamped bucket',
    armySize: ARMY_SIZE,
    crowdedBucket: targetBucket,
    unreachableEarlierCandidates: unreachableCandidateIds.length,
    candidateIdRange: [unreachableCandidateIds[0], unreachableCandidateIds.at(-1)],
    reachableTargetId: TARGET_ID,
    targetHpAfterAcquisition: unitById(damagedAzureState, TARGET_ID)[4],
    reachableTargetDamaged: true,
    elapsedSeconds: Number(((Date.now() - startedAt) / 1000).toFixed(2)),
  }, null, 2));
} finally {
  await Promise.all(clients.map(close));
}
