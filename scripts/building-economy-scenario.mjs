import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

// Standalone online integration scenario for server-validated gathering,
// Archery Range and Barracks construction, Archer and Infantry production,
// Town Center worker training, and population-cap reservations. Requires
// Node 24's built-in WebSocket.
// Run only after the matching backend protocol is available:
//   node scripts/building-economy-scenario.mjs [port]
const port = Number(process.argv[2] || 4174);
const endpoint = `ws://127.0.0.1:${port}/ws`;
const BUILD_SITE = { x: -7.5, z: 0.5 };
const BARRACKS_SITE = { x: -2.5, z: -8.5 };
const CAP_BARRACKS_SITE = { x: 0.5, z: 29.5 };
const CAP_BLOCKER_STAGING_CELL = { column: 25, row: 61 };
const CAP_BLOCKER_SPAWN_CELL = { column: 30, row: 61 };
const ENEMY_BUILD_SITE = { x: 7.5, z: 0.5 };
const BUILD_COST_WOOD = 150;
const BARRACKS_COST_WOOD = 175;
const INFANTRY_COST_FOOD = 50;
const INFANTRY_TRAIN_SECONDS = 12;
const ARCHER_COST_FOOD = 25;
const ARCHER_COST_WOOD = 45;
const WORKER_COST_FOOD = 50;
const WORKER_TRAIN_SECONDS = 25;
const RUN_TIMEOUTS = {
  connect: 15_000,
  armyReset: 20_000,
  publishMap: 20_000,
  rejectedOrder: 8_000,
  gather: 240_000,
  stopGathering: 15_000,
  buildStart: 20_000,
  construction: 75_000,
  trainStart: 20_000,
  blockedProduction: 45_000,
  archerSpawn: 75_000,
  workerSpawn: 75_000,
  reset: 20_000,
};
let stage = 'initialize';

function buildingQueueDepth(queue) {
  if (Array.isArray(queue)) return queue.length;
  if (Number.isFinite(queue)) return queue;
  return 0;
}

function resourceSnapshot(state) {
  return {
    food: Array.isArray(state?.food) ? [...state.food] : null,
    wood: Array.isArray(state?.wood) ? [...state.wood] : null,
  };
}

function workerProductionForTeam(state, team) {
  const production = state?.workerProduction || [];
  return production.find((record) => record?.team === team) ?? production[team] ?? null;
}

function workerProductionSnapshot(state) {
  return (state?.workerProduction || []).map((production) => production ? ({
    team: production.team,
    queue: production.queue,
    trainingRemaining: production.trainingRemaining,
    productionBlocked: production.productionBlocked,
    trainingProgress: production.trainingProgress,
  }) : null);
}

function workerProductionQueueSnapshot(state) {
  return (state?.workerProduction || []).map((production) => production ? ({
    team: production.team,
    queue: production.queue,
    productionBlocked: production.productionBlocked,
  }) : null);
}

function buildingSnapshot(state) {
  return (state?.buildings || []).map((building) => ({
    id: building.id,
    team: building.team,
    type: building.type,
    x: building.x,
    z: building.z,
    progress: building.progress,
    complete: building.complete,
    queueDepth: buildingQueueDepth(building.queue),
    trainingRemaining: building.trainingRemaining,
    trainingProgress: building.trainingProgress,
    productionBlocked: building.productionBlocked === true,
  }));
}

function buildingQueueSnapshot(state) {
  return buildingSnapshot(state).map(({ id, team, type, queueDepth }) => ({ id, team, type, queueDepth }));
}

function clientDiagnostic(client) {
  const state = client?.feed.latest;
  return {
    team: client?.welcome?.player?.team ?? null,
    mapId: state?.mapId ?? null,
    tick: state?.tick ?? null,
    armySize: state?.armySize ?? null,
    unitCount: state?.units?.length ?? null,
    food: state?.food ?? null,
    wood: state?.wood ?? null,
    resourceNodes: (state?.resourceNodes || []).map(({ id, type, stock }) => ({ id, type, stock })),
    buildings: buildingSnapshot(state),
    workerProduction: workerProductionSnapshot(state),
    workerCargo: (state?.units || [])
      .filter((unit) => unit[5] === 'worker')
      .map((unit) => ({ id: unit[0], team: unit[1], cargo: unit[6], cargoType: unit[7] })),
    recentMessages: (client?.feed.messages || []).slice(-8).map(({ type, message, mapId }) => ({
      type, message, mapId,
    })),
  };
}

function timeoutError(client, description, timeoutMs) {
  return new Error(
    `Timed out during "${stage}" waiting ${timeoutMs} ms for ${description}. `
    + `Latest client state: ${JSON.stringify(clientDiagnostic(client))}`,
  );
}

function createFeed(socket, clientRef) {
  const feed = { latest: null, messages: [], stateWaiters: [], messageWaiters: [] };
  socket.addEventListener('message', (event) => {
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    feed.messages.push(message);

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
      if (!waiter.predicate(message, feed.messages.length - 1)) continue;
      feed.messageWaiters.splice(index, 1);
      clearTimeout(waiter.timeout);
      waiter.resolve(message);
    }
  });
  return feed;
}

function waitForState(client, predicate, description, timeoutMs = RUN_TIMEOUTS[stage] || 20_000) {
  const { feed } = client;
  if (feed.latest && predicate(feed.latest)) return Promise.resolve(feed.latest);
  return new Promise((resolve, reject) => {
    const waiter = { predicate, resolve, timeout: null };
    waiter.timeout = setTimeout(() => {
      feed.stateWaiters.splice(feed.stateWaiters.indexOf(waiter), 1);
      reject(timeoutError(client, description, timeoutMs));
    }, timeoutMs);
    feed.stateWaiters.push(waiter);
  });
}

function waitForMessage(client, predicate, description, afterIndex = -1,
  timeoutMs = RUN_TIMEOUTS[stage] || 20_000) {
  const { feed } = client;
  const found = feed.messages.find((message, index) => index > afterIndex && predicate(message));
  if (found) return Promise.resolve(found);
  return new Promise((resolve, reject) => {
    const waiter = { predicate: (message, index) => index > afterIndex && predicate(message), resolve, timeout: null };
    waiter.timeout = setTimeout(() => {
      feed.messageWaiters.splice(feed.messageWaiters.indexOf(waiter), 1);
      reject(timeoutError(client, description, timeoutMs));
    }, timeoutMs);
    feed.messageWaiters.push(waiter);
  });
}

function send(socket, message) {
  socket.send(JSON.stringify(message));
}

function unitById(state, id) {
  return state.units.find((row) => row[0] === id);
}

function unitAtCell(state, id, column, row, dimension = 64) {
  const unit = unitById(state, id);
  return Boolean(unit)
    && Math.floor(unit[2] + dimension / 2) === column
    && Math.floor(unit[3] + dimension / 2) === row;
}

function workersForTeam(state, team) {
  return state.units.filter((unit) => unit[1] === team && unit[4] > 0 && unit[5] === 'worker');
}

function allWorkersHaveTask(state, ids, tasks) {
  return ids.every((id) => tasks.includes(unitById(state, id)?.[9]));
}

function idleWorkerIds(state, team) {
  return workersForTeam(state, team).filter((unit) => unit[9] === 'idle').map((unit) => unit[0]);
}

function sameBalances(left, right) {
  return JSON.stringify(resourceSnapshot(left)) === JSON.stringify(resourceSnapshot(right));
}

function sameBuildings(left, right) {
  return JSON.stringify(buildingSnapshot(left)) === JSON.stringify(buildingSnapshot(right));
}

function sameWorkerProduction(left, right) {
  return JSON.stringify(workerProductionSnapshot(left)) === JSON.stringify(workerProductionSnapshot(right));
}

function assertStateContract(state, label) {
  assert.ok(Array.isArray(state.food) && state.food.length === 2,
    `${label} state must expose food balances for both teams`);
  assert.ok(Array.isArray(state.wood) && state.wood.length === 2,
    `${label} state must expose wood balances for both teams`);
  assert.ok(Array.isArray(state.resourceNodes), `${label} state must expose resourceNodes`);
  assert.ok(Array.isArray(state.buildings), `${label} state must expose buildings`);
  assert.ok(Array.isArray(state.workerProduction) && state.workerProduction.length === 2,
    `${label} state must expose Town Center production for both teams`);
  for (const [team, production] of state.workerProduction.entries()) {
    assert.ok(production && production.team === team,
      `${label} state must expose a worker production record for team ${team}`);
    assert.ok(Number.isInteger(production.queue) && production.queue >= 0,
      `${label} team ${team} worker queue must be a nonnegative integer`);
    assert.ok(Number.isFinite(production.trainingRemaining) && production.trainingRemaining >= 0,
      `${label} team ${team} worker queue must expose remaining training time`);
    assert.ok(Number.isFinite(production.trainingProgress) && production.trainingProgress >= 0
      && production.trainingProgress <= 1,
    `${label} team ${team} worker queue must expose normalized progress`);
  }
  for (const node of state.resourceNodes) {
    assert.ok(typeof node.type === 'string' && Number.isFinite(node.stock),
      `${label} resource node ${node.id} must include type and stock`);
  }
  for (const unit of state.units) {
    assert.ok(unit.length >= (unit[5] === 'worker' ? 10 : 9),
      `${label} unit ${unit[0]} must include generation and worker task when applicable`);
    assert.ok(Number.isInteger(unit[8]) && unit[8] > 0,
      `${label} unit ${unit[0]} must include a positive slot generation`);
    if (unit[5] === 'worker') {
      assert.ok(['idle', 'moving', 'gathering', 'returning', 'building', 'attacking'].includes(unit[9]),
        `${label} visible worker ${unit[0]} must expose a valid task status`);
    }
  }
}

async function connectClient(clientName) {
  const socket = new WebSocket(endpoint);
  const client = { name: clientName, socket, feed: null, welcome: null };
  client.feed = createFeed(socket, client);
  const welcome = await waitForMessage(client, (message) => message.type === 'welcome',
    `${clientName} welcome`);
  client.welcome = welcome;
  return client;
}

async function close(client) {
  if (!client || client.socket.readyState === WebSocket.CLOSED) return;
  await new Promise((resolve) => {
    const done = () => resolve();
    client.socket.addEventListener('close', done, { once: true });
    if (client.socket.readyState === WebSocket.CONNECTING) {
      client.socket.addEventListener('open', () => client.socket.close(1000, 'scenario complete'), { once: true });
    } else {
      client.socket.close(1000, 'building-economy scenario complete');
    }
    setTimeout(resolve, 1_000).unref();
  });
}

async function expectRejectedWithoutDebit({
  issuer, observers, command, label, expectedPrefix, stableBuildingQueuesOnly = false,
}) {
  const before = new Map(observers.map((client) => [client.name, client.feed.latest]));
  assert.ok(before.get(issuer.name), `${label}: issuer needs a current baseline state`);
  const messageIndex = issuer.feed.messages.length - 1;
  const rejection = waitForMessage(issuer, (message) => message.type === 'notice'
    && (!expectedPrefix || message.message?.startsWith(expectedPrefix)),
    `${label} rejection notice`, messageIndex, RUN_TIMEOUTS.rejectedOrder);
  send(issuer.socket, command);
  await rejection;

  // Rejected-order replies are emitted synchronously, while a mistaken accepted
  // order may dirty state on the next simulation tick. Allow that state frame
  // to arrive before comparing balances and structures on both clients.
  await new Promise((resolve) => setTimeout(resolve, 700));
  for (const client of observers) {
    const baseline = before.get(client.name);
    const current = client.feed.latest;
    assert.ok(current, `${label}: ${client.name} state remains available`);
    assert.deepEqual(resourceSnapshot(current), resourceSnapshot(baseline),
      `${label} must not debit either team's resources for ${client.name}`);
    const currentBuildings = stableBuildingQueuesOnly
      ? buildingQueueSnapshot(current) : buildingSnapshot(current);
    const baselineBuildings = stableBuildingQueuesOnly
      ? buildingQueueSnapshot(baseline) : buildingSnapshot(baseline);
    assert.deepEqual(currentBuildings, baselineBuildings,
      `${label} must not change building ownership, construction, or queues for ${client.name}`);
    assert.deepEqual(workerProductionQueueSnapshot(current), workerProductionQueueSnapshot(baseline),
      `${label} must not change Town Center queues for ${client.name}`);
  }
}

function snapCellCenter(value, dimension = 64) {
  return Math.floor(value + dimension / 2) - dimension / 2 + 0.5;
}

function cellCenter(column, row, dimension = 64) {
  return { x: column - dimension / 2 + 0.5, z: row - dimension / 2 + 0.5 };
}

function normalizedQueueDepth(building) {
  return buildingQueueDepth(building?.queue);
}

function assertBuildingShape(building, { team, type = 'archery-range', site, label }) {
  assert.ok(building, `${label} building should be present`);
  assert.equal(building.team, team, `${label} building should have the correct owner`);
  assert.equal(building.type, type, `${label} should be a ${type}`);
  assert.equal(building.x, snapCellCenter(site.x), `${label} x should be the snapped cell center`);
  assert.equal(building.z, snapCellCenter(site.z), `${label} z should be the snapped cell center`);
  assert.ok(Number.isFinite(building.progress), `${label} should expose construction progress`);
  assert.equal(typeof building.complete, 'boolean', `${label} should expose completion state`);
  assert.ok(Number.isFinite(building.trainingProgress), `${label} should expose training progress`);
}

function assertSyncedBuilding(leftState, rightState, label) {
  assert.deepEqual(buildingSnapshot(leftState), buildingSnapshot(rightState),
    `${label}: both online clients should have identical authoritative building state`);
  assert.deepEqual(resourceSnapshot(leftState), resourceSnapshot(rightState),
    `${label}: both online clients should have identical team resources`);
}

function assertSyncedWorkerProduction(leftState, rightState, label) {
  assert.deepEqual(workerProductionSnapshot(leftState), workerProductionSnapshot(rightState),
    `${label}: both online clients should have identical authoritative Town Center queues`);
  assert.deepEqual(resourceSnapshot(leftState), resourceSnapshot(rightState),
    `${label}: both online clients should have identical team resources`);
}

const clients = [];
try {
  stage = 'connect Azure and Ember';
  const azure = await connectClient('Azure');
  clients.push(azure);
  const ember = await connectClient('Ember');
  clients.push(ember);
  assert.equal(azure.welcome.player.team, 0, 'first client should claim Azure');
  assert.equal(ember.welcome.player.team, 1, 'second client should claim Ember');

  stage = 'reset to 250 units';
  const resetToSmallArmy = Promise.all([
    waitForState(azure, (state) => state.armySize === 250 && state.units.length === 250,
      'Azure 250-unit reset'),
    waitForState(ember, (state) => state.armySize === 250 && state.units.length === 250,
      'Ember 250-unit reset'),
  ]);
  send(azure.socket, { type: 'selectArmySize', count: 250 });
  await resetToSmallArmy;

  stage = 'publish the disposable two-resource map';
  const mapId = `building-economy-${randomBytes(4).toString('hex')}`;
  const capBarracksObstacles = [];
  for (let row = 57; row <= 63; row++) {
    for (let column = 26; column <= 34; column++) {
      const inBarracksFootprint = column >= 31 && column <= 33 && row >= 60 && row <= 62;
      const inWestCorridor = row === CAP_BLOCKER_SPAWN_CELL.row
        && column >= 26 && column <= CAP_BLOCKER_SPAWN_CELL.column;
      if (inBarracksFootprint || inWestCorridor) continue;
      capBarracksObstacles.push({ column, row, width: 1, height: 1, material: 'stone' });
    }
  }
  const map = {
    id: mapId,
    name: 'Building Economy Integration Check',
    summary: '64 × 64 · single-cell Barracks production corridor',
    width: 64,
    height: 64,
    terrainSeed: 29,
    spawnPoints: [
      { team: 0, x: -20, z: 0 },
      { team: 1, x: 20, z: 0 },
    ],
    obstacles: capBarracksObstacles,
    resourceNodes: [
      { id: 'azure-wood', type: 'wood', x: -13, z: -4, stock: 800 },
      { id: 'azure-food', type: 'food', x: -13, z: 4, stock: 500 },
      { id: 'ember-wood', type: 'wood', x: 13, z: -4, stock: 800 },
      { id: 'ember-food', type: 'food', x: 13, z: 4, stock: 500 },
      ...[26, 27, 28, 29].map((column) => ({
        id: `barracks-reserve-${column}`,
        type: 'wood',
        ...cellCenter(column, CAP_BLOCKER_SPAWN_CELL.row),
        stock: 1,
      })),
    ],
    triggers: [],
  };
  const published = waitForMessage(azure, (message) => message.type === 'mapPublished'
    && message.mapId === mapId, 'Azure mapPublished acknowledgement');
  const azureMapState = waitForState(azure, (state) => state.mapId === mapId,
    'Azure disposable map state');
  const emberMapState = waitForState(ember, (state) => state.mapId === mapId,
    'Ember disposable map state');
  send(azure.socket, { type: 'publishMap', map });
  const [publishedMessage, initialAzureState, initialEmberState] = await Promise.all([
    published, azureMapState, emberMapState,
  ]);
  assert.equal(publishedMessage.mapId, mapId);
  assertStateContract(initialAzureState, 'Azure');
  assertStateContract(initialEmberState, 'Ember');
  assert.deepEqual(resourceSnapshot(initialAzureState), resourceSnapshot(initialEmberState),
    'both clients should see the same initial economy');
  assert.deepEqual(workerProductionSnapshot(initialAzureState), [
    { team: 0, queue: 0, trainingRemaining: 0, productionBlocked: false, trainingProgress: 0 },
    { team: 1, queue: 0, trainingRemaining: 0, productionBlocked: false, trainingProgress: 0 },
  ], 'a fresh map should start with empty Town Center queues');
  assert.deepEqual(initialAzureState.buildings, [], 'a fresh map should have no buildings');
  assert.deepEqual(initialAzureState.food, [0, 0], 'a fresh map should start without food');
  assert.deepEqual(initialAzureState.wood, [0, 0], 'a fresh map should start without wood');

  const azureWorkers = workersForTeam(initialAzureState, 0);
  const emberWorkers = workersForTeam(initialEmberState, 1);
  assert.equal(azureWorkers.length, 4, 'Azure should have four starting workers');
  assert.equal(emberWorkers.length, 4, 'Ember should have four starting workers');
  const azureWorkerIds = azureWorkers.map((unit) => unit[0]);
  const emberWorkerIds = emberWorkers.map((unit) => unit[0]);

  stage = 'reject an unaffordable build';
  await expectRejectedWithoutDebit({
    issuer: azure,
    observers: clients,
    command: { type: 'build', buildingType: 'archery-range', ids: azureWorkerIds, ...BUILD_SITE },
    label: 'insufficient-wood build',
    expectedPrefix: 'BUILD REJECTED · NEED 150 WOOD',
  });

  stage = 'gather wood and food for both teams';
  const gatherOrders = [
    { client: azure, ids: azureWorkerIds.slice(0, 3), nodeId: 'azure-wood' },
    { client: azure, ids: azureWorkerIds.slice(3), nodeId: 'azure-food' },
    { client: ember, ids: emberWorkerIds.slice(0, 3), nodeId: 'ember-wood' },
    { client: ember, ids: emberWorkerIds.slice(3), nodeId: 'ember-food' },
  ];
  const gatherAcks = gatherOrders.map(({ client }) => {
    const index = client.feed.messages.length - 1;
    return waitForMessage(client, (message) => message.type === 'notice'
      && message.message?.startsWith('GATHER ORDER'), `${client.name} gather order acknowledgement`, index);
  });
  for (const order of gatherOrders) {
    send(order.client.socket, { type: 'gather', ids: order.ids, nodeId: order.nodeId });
  }
  await Promise.all(gatherAcks);
  const workersGathering = (state, ids) => state.mapId === mapId
    && allWorkersHaveTask(state, ids, ['gathering', 'returning']);
  const [azureGathering, emberGathering] = await Promise.all([
    waitForState(azure, (state) => workersGathering(state, azureWorkerIds),
      'Azure worker gathering status'),
    waitForState(ember, (state) => workersGathering(state, emberWorkerIds),
      'Ember worker gathering status'),
  ]);
  assert.ok(azureWorkerIds.every((id) => ['gathering', 'returning'].includes(unitById(azureGathering, id)[9])),
    'Azure worker tasks should be synchronized to both clients');
  assert.ok(emberWorkerIds.every((id) => ['gathering', 'returning'].includes(unitById(emberGathering, id)[9])),
    'Ember worker tasks should be synchronized to both clients');
  const resourceGoal = (team) => (state) => state.mapId === mapId
    && state.wood?.[team] >= BUILD_COST_WOOD + ARCHER_COST_WOOD + BARRACKS_COST_WOOD
    && state.food?.[team] >= ARCHER_COST_FOOD + INFANTRY_COST_FOOD;
  const [azureFunded, emberFunded] = await Promise.all([
    waitForState(azure, resourceGoal(0), 'Azure enough food and wood for both buildings and queues', RUN_TIMEOUTS.gather),
    waitForState(ember, resourceGoal(1), 'Ember enough food and wood for enemy-order checks', RUN_TIMEOUTS.gather),
  ]);
  assert.ok(azureFunded.resourceNodes.some((node) => node.id === 'azure-wood' && node.type === 'wood'),
    'the map state should identify the wood node type');
  assert.ok(azureFunded.resourceNodes.some((node) => node.id === 'azure-food' && node.type === 'food'),
    'the map state should identify the food node type');

  stage = 'stop gathering before order-rejection checks';
  const stopAcks = clients.map((client) => {
    const index = client.feed.messages.length - 1;
    return waitForMessage(client, (message) => message.type === 'notice'
      && message.message?.startsWith('MOVE ORDER'), `${client.name} stop-gather movement acknowledgement`, index);
  });
  send(azure.socket, { type: 'move', ids: azureWorkerIds, x: -20, z: 0 });
  send(ember.socket, { type: 'move', ids: emberWorkerIds, x: 20, z: 0 });
  await Promise.all(stopAcks);
  const workersIdle = (state, ids) => state.mapId === mapId
    && allWorkersHaveTask(state, ids, ['idle']);
  const [azureIdle, emberIdle] = await Promise.all([
    waitForState(azure, (state) => workersIdle(state, azureWorkerIds),
      'Azure workers to finish moving and become idle', RUN_TIMEOUTS.stopGathering),
    waitForState(ember, (state) => workersIdle(state, emberWorkerIds),
      'Ember workers to finish moving and become idle', RUN_TIMEOUTS.stopGathering),
  ]);
  assert.deepEqual(idleWorkerIds(azureIdle, 0), azureWorkerIds,
    'Azure idle-worker selection set should include only its four friendly workers');
  assert.deepEqual(idleWorkerIds(emberIdle, 1), emberWorkerIds,
    'Ember idle-worker selection set should include only its four friendly workers');
  assert.deepEqual(resourceSnapshot(azureIdle), resourceSnapshot(emberIdle),
    'both clients should agree after gathering has stopped');

  stage = 'reject invalid and enemy construction orders';
  await expectRejectedWithoutDebit({
    issuer: azure,
    observers: clients,
    command: { type: 'build', buildingType: 'invalid-building', ids: azureWorkerIds, ...BUILD_SITE },
    label: 'invalid building type',
    expectedPrefix: 'BUILD REJECTED · UNKNOWN BUILDING TYPE',
  });
  await expectRejectedWithoutDebit({
    issuer: ember,
    observers: clients,
    command: { type: 'build', buildingType: 'archery-range', ids: azureWorkerIds, ...ENEMY_BUILD_SITE },
    label: 'enemy workers used for construction',
    expectedPrefix: 'BUILD REJECTED · SELECT A WORKER',
  });

  stage = 'start Azure archery-range construction';
  const beforeBuild = azure.feed.latest;
  const beforeBuildWood = beforeBuild.wood[0];
  const beforeBuildFood = beforeBuild.food[0];
  const buildAckIndex = azure.feed.messages.length - 1;
  const buildAck = waitForMessage(azure, (message) => message.type === 'notice',
    'Azure build order acknowledgement', buildAckIndex, RUN_TIMEOUTS.buildStart);
  const acceptedBuilding = (state) => state.mapId === mapId && state.buildings?.length === 1
    && state.buildings[0].team === 0 && state.buildings[0].type === 'archery-range'
    && state.buildings[0].x === snapCellCenter(BUILD_SITE.x)
    && state.buildings[0].z === snapCellCenter(BUILD_SITE.z)
    && state.wood?.[0] === beforeBuildWood - BUILD_COST_WOOD;
  const buildStates = Promise.all([
    waitForState(azure, acceptedBuilding, 'Azure accepted building and wood debit', RUN_TIMEOUTS.buildStart),
    waitForState(ember, acceptedBuilding, 'Ember synchronized building and wood debit', RUN_TIMEOUTS.buildStart),
  ]);
  send(azure.socket, {
    type: 'build', buildingType: 'archery-range', ids: azureWorkerIds, ...BUILD_SITE,
  });
  const [[buildAckMessage], [buildingState, mirroredBuildingState]] = await Promise.all([
    Promise.all([buildAck]), buildStates,
  ]);
  assert.ok(buildAckMessage.type === 'notice');
  assert.ok(azureWorkerIds.every((id) => unitById(buildingState, id)?.[9] === 'building'),
    'Azure builders should expose the building task to both players');
  assertBuildingShape(buildingState.buildings[0], { team: 0, site: BUILD_SITE, label: 'Azure' });
  assert.equal(buildingState.food[0], beforeBuildFood, 'construction should cost wood only');
  assertSyncedBuilding(buildingState, mirroredBuildingState, 'construction start');

  stage = 'observe construction progress';
  const hasVisibleProgress = (state) => state.mapId === mapId && state.buildings?.length === 1
    && state.buildings[0].progress > 0 && !state.buildings[0].complete;
  const [progressState, mirroredProgressState] = await Promise.all([
    waitForState(azure, hasVisibleProgress, 'in-progress construction frame', RUN_TIMEOUTS.construction),
    waitForState(ember, hasVisibleProgress, 'synchronized in-progress construction frame', RUN_TIMEOUTS.construction),
  ]);
  assert.ok(progressState.buildings[0].progress < 1,
    'construction should be observable before it completes');
  assertSyncedBuilding(progressState, mirroredProgressState, 'construction progress');

  stage = 'wait for archery range completion';
  const isComplete = (state) => state.mapId === mapId && state.buildings?.length === 1
    && state.buildings[0].complete === true;
  const [completeState, mirroredCompleteState] = await Promise.all([
    waitForState(azure, isComplete, 'completed Azure archery range', RUN_TIMEOUTS.construction),
    waitForState(ember, isComplete, 'completed archery range mirrored to Ember', RUN_TIMEOUTS.construction),
  ]);
  assert.ok(completeState.buildings[0].progress >= 1,
    'completed building progress should be at least one');
  assertBuildingShape(completeState.buildings[0], { team: 0, site: BUILD_SITE, label: 'completed Azure' });
  assertSyncedBuilding(completeState, mirroredCompleteState, 'construction completion');
  const buildingId = completeState.buildings[0].id;

  stage = 'reject overlapping build without debit';
  await expectRejectedWithoutDebit({
    issuer: azure,
    observers: clients,
    command: { type: 'build', buildingType: 'archery-range', ids: azureWorkerIds, ...BUILD_SITE },
    label: 'overlapping archery range',
    expectedPrefix: 'BUILD REJECTED · SPACE BLOCKED',
  });

  stage = 'reject enemy training without debit';
  await expectRejectedWithoutDebit({
    issuer: ember,
    observers: clients,
    command: { type: 'trainArcher', buildingId },
    label: 'Ember training at Azure archery range',
    expectedPrefix: 'ARCHER TRAINING REJECTED · SELECT A COMPLETED ARCHERY RANGE',
  });

  stage = 'queue Azure archer training';
  const beforeTraining = azure.feed.latest;
  const expectedFood = beforeTraining.food[0] - ARCHER_COST_FOOD;
  const expectedWood = beforeTraining.wood[0] - ARCHER_COST_WOOD;
  const preTrainingUnitIds = new Set(beforeTraining.units.map((unit) => unit[0]));
  const trainIndex = azure.feed.messages.length - 1;
  const trainAck = waitForMessage(azure, (message) => message.type === 'notice',
    'Azure trainArcher acknowledgement', trainIndex, RUN_TIMEOUTS.trainStart);
  const queued = (state) => {
    const building = state.buildings?.find((row) => row.id === buildingId);
    return state.mapId === mapId && state.food?.[0] === expectedFood
      && state.wood?.[0] === expectedWood && normalizedQueueDepth(building) >= 1;
  };
  const queuedStates = Promise.all([
    waitForState(azure, queued, 'Azure archer queue and resource debit', RUN_TIMEOUTS.trainStart),
    waitForState(ember, queued, 'Ember sees Azure archer queue and resource debit', RUN_TIMEOUTS.trainStart),
  ]);
  send(azure.socket, { type: 'trainArcher', buildingId });
  await Promise.all([trainAck, queuedStates]);

  stage = 'wait for synchronized 70-HP archer';
  const archerSpawned = (state) => state.mapId === mapId && state.units.some((unit) => (
    !preTrainingUnitIds.has(unit[0]) && unit[1] === 0 && unit[4] === 70 && unit[5] === 'archer'
  ));
  const [archerState, mirroredArcherState] = await Promise.all([
    waitForState(azure, archerSpawned, 'new Azure 70-HP archer', RUN_TIMEOUTS.archerSpawn),
    waitForState(ember, archerSpawned, 'new Azure 70-HP archer mirrored to Ember', RUN_TIMEOUTS.archerSpawn),
  ]);
  const archer = archerState.units.find((unit) => (
    !preTrainingUnitIds.has(unit[0]) && unit[1] === 0 && unit[4] === 70 && unit[5] === 'archer'
  ));
  const mirroredArcher = unitById(mirroredArcherState, archer[0]);
  assert.deepEqual(mirroredArcher, archer, 'both clients should receive the same produced archer');
  assert.equal(archer[4], 70, 'a trained archer should have 70 HP');
  assert.deepEqual(resourceSnapshot(archerState), resourceSnapshot(mirroredArcherState),
    'both clients should observe the same post-training debit');
  assert.equal(archerState.food[0], expectedFood);
  assert.equal(archerState.wood[0], expectedWood);

  stage = 'verify Archer ranged combat';
  const enemyTarget = archerState.units
    .filter((unit) => unit[1] === 1 && unit[4] > 0)
    .map((unit) => ({ unit, distance: Math.hypot(unit[2] - archer[2], unit[3] - archer[3]) }))
    .sort((left, right) => left.distance - right.distance)[0]?.unit;
  assert.ok(enemyTarget, 'an enemy unit should be available for the new Archer');
  const targetHpBefore = enemyTarget[4];
  const targetId = enemyTarget[0];
  const enemyDamaged = (state) => state.units.find((unit) => unit[0] === targetId)?.[4] < targetHpBefore;
  const rangedDamageStates = Promise.all([
    waitForState(azure, enemyDamaged, 'the Archer to damage an enemy at ranged distance', 45_000),
    waitForState(ember, enemyDamaged, 'the ranged damage synchronized to Ember', 45_000),
  ]);
  send(azure.socket, { type: 'attack', ids: [archer[0]], targetId });
  const [damagedAzure, damagedEmber] = await rangedDamageStates;
  const targetHpAfter = damagedAzure.units.find((unit) => unit[0] === targetId)[4];
  assert.ok(targetHpAfter < targetHpBefore, 'Archer attack should reduce enemy HP');
  assert.deepEqual(unitById(damagedEmber, targetId), unitById(damagedAzure, targetId),
    'both online clients should receive the same ranged combat damage');

  stage = 'start Azure Barracks construction';
  const beforeBarracksBuild = azure.feed.latest;
  const beforeBarracksWood = beforeBarracksBuild.wood[0];
  const beforeBarracksFood = beforeBarracksBuild.food[0];
  const barracksAckIndex = azure.feed.messages.length - 1;
  const barracksBuildAck = waitForMessage(azure, (message) => message.type === 'notice',
    'Azure Barracks build order acknowledgement', barracksAckIndex, RUN_TIMEOUTS.buildStart);
  const barracksAccepted = (state) => {
    const barracks = state.buildings?.find((row) => row.type === 'barracks' && row.team === 0);
    return state.mapId === mapId && state.buildings?.length === 2
      && barracks && barracks.x === snapCellCenter(BARRACKS_SITE.x)
      && barracks.z === snapCellCenter(BARRACKS_SITE.z)
      && state.wood?.[0] === beforeBarracksWood - BARRACKS_COST_WOOD;
  };
  const barracksBuildStates = Promise.all([
    waitForState(azure, barracksAccepted, 'Azure Barracks placement and wood debit', RUN_TIMEOUTS.buildStart),
    waitForState(ember, barracksAccepted, 'Ember sees Azure Barracks placement and wood debit', RUN_TIMEOUTS.buildStart),
  ]);
  send(azure.socket, {
    type: 'build', buildingType: 'barracks', ids: azureWorkerIds, ...BARRACKS_SITE,
  });
  await Promise.all([barracksBuildAck, barracksBuildStates]);
  const acceptedBarracksId = azure.feed.latest.buildings.find((row) => row.type === 'barracks').id;
  assert.equal(azure.feed.latest.food[0], beforeBarracksFood,
    'Barracks construction should cost wood only');

  stage = 'reject Infantry queue before Barracks completion';
  const beforeEarlyInfantryQueue = azure.feed.latest;
  const earlyQueueIndex = azure.feed.messages.length - 1;
  const earlyQueueRejected = waitForMessage(azure, (message) => message.type === 'notice'
    && message.message?.startsWith('INFANTRY TRAINING REJECTED · SELECT A COMPLETED BARRACKS'),
  'training rejection for an unfinished Barracks', earlyQueueIndex, RUN_TIMEOUTS.rejectedOrder);
  send(azure.socket, { type: 'train', buildingId: acceptedBarracksId });
  await earlyQueueRejected;
  await new Promise((resolve) => setTimeout(resolve, 350));
  for (const client of clients) {
    const current = client.feed.latest;
    const barracks = current.buildings.find((row) => row.id === acceptedBarracksId);
    assert.equal(current.food[0], beforeEarlyInfantryQueue.food[0],
      `${client.name} should see no debit for Infantry rejected during construction`);
    assert.equal(normalizedQueueDepth(barracks), 0,
      `${client.name} should see no Infantry queued before Barracks completion`);
  }

  stage = 'observe Barracks construction progress';
  const barracksHasProgress = (state) => state.mapId === mapId
    && state.buildings?.some((row) => row.id === acceptedBarracksId
      && row.progress > 0 && !row.complete);
  const [barracksProgressAzure, barracksProgressEmber] = await Promise.all([
    waitForState(azure, barracksHasProgress, 'in-progress Barracks construction frame', RUN_TIMEOUTS.construction),
    waitForState(ember, barracksHasProgress, 'synchronized Barracks construction progress', RUN_TIMEOUTS.construction),
  ]);
  const barracksProgress = barracksProgressAzure.buildings.find((row) => row.id === acceptedBarracksId);
  assertBuildingShape(barracksProgress, {
    team: 0, type: 'barracks', site: BARRACKS_SITE, label: 'Azure Barracks under construction',
  });
  assert.ok(barracksProgress.progress < 1,
    'Barracks progress should be visible before construction completes');
  assertSyncedBuilding(barracksProgressAzure, barracksProgressEmber, 'Barracks construction progress');

  stage = 'wait for Barracks completion';
  const barracksComplete = (state) => state.mapId === mapId
    && state.buildings?.some((row) => row.id === acceptedBarracksId && row.complete === true);
  const [completeBarracksAzure, completeBarracksEmber] = await Promise.all([
    waitForState(azure, barracksComplete, 'completed Azure Barracks', RUN_TIMEOUTS.construction),
    waitForState(ember, barracksComplete, 'Barracks completion mirrored to Ember', RUN_TIMEOUTS.construction),
  ]);
  const completeBarracks = completeBarracksAzure.buildings.find((row) => row.id === acceptedBarracksId);
  assertBuildingShape(completeBarracks, {
    team: 0, type: 'barracks', site: BARRACKS_SITE, label: 'completed Azure Barracks',
  });
  assertSyncedBuilding(completeBarracksAzure, completeBarracksEmber, 'Barracks construction completion');

  stage = 'queue Azure Infantry training';
  const beforeInfantryTraining = azure.feed.latest;
  const expectedInfantryFood = beforeInfantryTraining.food[0] - INFANTRY_COST_FOOD;
  const preInfantryTrainingUnitIds = new Set(beforeInfantryTraining.units.map((unit) => unit[0]));
  const infantryTrainIndex = azure.feed.messages.length - 1;
  const infantryTrainAck = waitForMessage(azure, (message) => message.type === 'notice'
    && message.message?.startsWith('INFANTRY QUEUED'),
  'Azure Infantry queue acknowledgement', infantryTrainIndex, RUN_TIMEOUTS.trainStart);
  const infantryQueued = (state) => {
    const barracks = state.buildings?.find((row) => row.id === acceptedBarracksId);
    return state.mapId === mapId && state.food?.[0] === expectedInfantryFood
      && normalizedQueueDepth(barracks) === 1;
  };
  const infantryQueuedStates = Promise.all([
    waitForState(azure, infantryQueued, 'Azure Infantry queue and food debit', RUN_TIMEOUTS.trainStart),
    waitForState(ember, infantryQueued, 'Ember sees Azure Infantry queue and food debit', RUN_TIMEOUTS.trainStart),
  ]);
  send(azure.socket, { type: 'train', buildingId: acceptedBarracksId });
  await Promise.all([infantryTrainAck, infantryQueuedStates]);

  stage = 'observe Infantry training progress';
  const infantryInProgress = (state) => {
    const barracks = state.buildings?.find((row) => row.id === acceptedBarracksId);
    return infantryQueued(state) && barracks?.trainingProgress > 0
      && barracks?.trainingRemaining > 0
      && barracks.trainingRemaining < INFANTRY_TRAIN_SECONDS;
  };
  const [infantryProgressAzure, infantryProgressEmber] = await Promise.all([
    waitForState(azure, infantryInProgress, 'Azure Barracks training progress', RUN_TIMEOUTS.trainStart),
    waitForState(ember, infantryInProgress, 'Ember sees Barracks training progress', RUN_TIMEOUTS.trainStart),
  ]);
  for (const state of [infantryProgressAzure, infantryProgressEmber]) {
    assert.equal(state.units.some((unit) => !preInfantryTrainingUnitIds.has(unit[0])
      && unit[1] === 0 && unit[5] === 'infantry'), false,
    'queued Infantry must not spawn before its 12-second training completes');
  }
  assertSyncedBuilding(infantryProgressAzure, infantryProgressEmber, 'Infantry training progress');

  stage = 'wait for synchronized Infantry';
  const infantrySpawned = (state) => state.mapId === mapId
    && state.units.some((unit) => !preInfantryTrainingUnitIds.has(unit[0])
      && unit[1] === 0 && unit[4] > 0 && unit[5] === 'infantry')
    && normalizedQueueDepth(state.buildings?.find((row) => row.id === acceptedBarracksId)) === 0;
  const [infantryState, mirroredInfantryState] = await Promise.all([
    waitForState(azure, infantrySpawned, 'new Azure Infantry', RUN_TIMEOUTS.archerSpawn),
    waitForState(ember, infantrySpawned, 'new Azure Infantry mirrored to Ember', RUN_TIMEOUTS.archerSpawn),
  ]);
  const producedInfantry = infantryState.units.find((unit) => !preInfantryTrainingUnitIds.has(unit[0])
    && unit[1] === 0 && unit[4] > 0 && unit[5] === 'infantry');
  assert.ok(producedInfantry, 'Barracks production should add one live Azure Infantry');
  assert.equal(producedInfantry[4], 100, 'trained Infantry should have 100 HP');
  assert.deepEqual(unitById(mirroredInfantryState, producedInfantry[0]), producedInfantry,
    'both clients should receive the same produced Infantry');
  assert.equal(infantryState.food[0], expectedInfantryFood,
    'Infantry production should charge exactly 50 food once');
  assert.deepEqual(resourceSnapshot(infantryState), resourceSnapshot(mirroredInfantryState),
    'both online clients should observe the same Infantry debit');
  assertSyncedBuilding(infantryState, mirroredInfantryState, 'Infantry production completion');

  stage = 'gather food for Town Center worker production';
  const gatherFoodIndex = azure.feed.messages.length - 1;
  const gatherFoodAck = waitForMessage(azure, (message) => message.type === 'notice'
    && message.message?.startsWith('GATHER ORDER'), 'Azure worker-production food-gather acknowledgement', gatherFoodIndex);
  const fundedForWorker = waitForState(azure,
    (state) => state.mapId === mapId && state.food?.[0] >= WORKER_COST_FOOD,
    'Azure food for a Town Center worker', RUN_TIMEOUTS.gather);
  send(azure.socket, { type: 'gather', ids: azureWorkerIds, nodeId: 'azure-food' });
  await Promise.all([gatherFoodAck, fundedForWorker]);
  const stopWorkerProductionGatherIndex = azure.feed.messages.length - 1;
  const stopWorkerProductionGatherAck = waitForMessage(azure, (message) => message.type === 'notice'
    && message.message?.startsWith('MOVE ORDER'), 'Azure return-to-base acknowledgement', stopWorkerProductionGatherIndex);
  const idleForWorkerProduction = waitForState(azure, (state) => workersIdle(state, azureWorkerIds),
    'Azure starting workers idle before Town Center production', RUN_TIMEOUTS.stopGathering);
  send(azure.socket, { type: 'move', ids: azureWorkerIds, x: -20, z: 0 });
  await Promise.all([stopWorkerProductionGatherAck, idleForWorkerProduction]);

  stage = 'queue Azure Town Center worker training';
  const beforeWorkerTraining = azure.feed.latest;
  const expectedWorkerFood = beforeWorkerTraining.food[0] - WORKER_COST_FOOD;
  const preWorkerTrainingUnitIds = new Set(beforeWorkerTraining.units.map((unit) => unit[0]));
  const workerTrainIndex = azure.feed.messages.length - 1;
  const workerTrainAck = waitForMessage(azure, (message) => message.type === 'notice',
    'Azure trainWorker acknowledgement', workerTrainIndex, RUN_TIMEOUTS.trainStart);
  const workerQueued = (state) => {
    const production = workerProductionForTeam(state, 0);
    return state.mapId === mapId && state.food?.[0] === expectedWorkerFood
      && production?.queue === 1 && production.trainingRemaining > 0;
  };
  const workerQueuedStates = Promise.all([
    waitForState(azure, workerQueued, 'Azure Town Center queue and food debit', RUN_TIMEOUTS.trainStart),
    waitForState(ember, workerQueued, 'Ember sees Azure Town Center queue and food debit', RUN_TIMEOUTS.trainStart),
  ]);
  send(azure.socket, { type: 'trainWorker' });
  await Promise.all([workerTrainAck, workerQueuedStates]);

  stage = 'observe Town Center worker training progress';
  const workerInProgress = (state) => {
    const production = workerProductionForTeam(state, 0);
    return workerQueued(state) && production.trainingProgress > 0
      && production.trainingRemaining < WORKER_TRAIN_SECONDS;
  };
  const [workerProgressAzure, workerProgressEmber] = await Promise.all([
    waitForState(azure, workerInProgress, 'Azure Town Center worker progress', RUN_TIMEOUTS.trainStart),
    waitForState(ember, workerInProgress, 'Ember observes Town Center worker progress', RUN_TIMEOUTS.trainStart),
  ]);
  for (const state of [workerProgressAzure, workerProgressEmber]) {
    assert.equal(state.units.some((unit) => !preWorkerTrainingUnitIds.has(unit[0])
      && unit[1] === 0 && unit[5] === 'worker'), false,
    'a queued Town Center worker must not spawn before its 25-second training completes');
  }
  assertSyncedWorkerProduction(workerProgressAzure, workerProgressEmber, 'worker training progress');

  stage = 'wait for synchronized Town Center worker';
  const workerSpawned = (state) => state.mapId === mapId
    && state.units.some((unit) => !preWorkerTrainingUnitIds.has(unit[0])
      && unit[1] === 0 && unit[4] > 0 && unit[5] === 'worker')
    && workerProductionForTeam(state, 0)?.queue === 0;
  const [workerState, mirroredWorkerState] = await Promise.all([
    waitForState(azure, workerSpawned, 'new Azure Town Center worker', RUN_TIMEOUTS.workerSpawn),
    waitForState(ember, workerSpawned, 'new Azure Town Center worker mirrored to Ember', RUN_TIMEOUTS.workerSpawn),
  ]);
  const producedWorker = workerState.units.find((unit) => !preWorkerTrainingUnitIds.has(unit[0])
    && unit[1] === 0 && unit[4] > 0 && unit[5] === 'worker');
  assert.ok(producedWorker, 'Town Center production should add one live Azure worker');
  assert.equal(producedWorker[4], 100, 'a trained worker should have 100 HP');
  assert.deepEqual(unitById(mirroredWorkerState, producedWorker[0]), producedWorker,
    'both online clients should receive the same produced worker');
  assert.equal(workerState.food[0], expectedWorkerFood,
    'Town Center worker production should charge exactly 50 food once');
  assert.deepEqual(resourceSnapshot(workerState), resourceSnapshot(mirroredWorkerState),
    'both online clients should observe the same worker-training debit');
  assertSyncedWorkerProduction(workerState, mirroredWorkerState, 'worker production completion');

  stage = 'verify trained worker can gather';
  const producedWorkerGatherIndex = azure.feed.messages.length - 1;
  const producedWorkerGatherAck = waitForMessage(azure, (message) => message.type === 'notice'
    && message.message?.startsWith('GATHER ORDER'), 'trained worker gather acknowledgement', producedWorkerGatherIndex);
  const trainedWorkerGathering = (state) => state.mapId === mapId
    && ['gathering', 'returning'].includes(unitById(state, producedWorker[0])?.[9]);
  const trainedWorkerGatherStates = Promise.all([
    waitForState(azure, trainedWorkerGathering, 'trained worker begins gathering'),
    waitForState(ember, trainedWorkerGathering, 'trained worker gather task is synchronized'),
  ]);
  send(azure.socket, { type: 'gather', ids: [producedWorker[0]], nodeId: 'azure-food' });
  await producedWorkerGatherAck;
  const [workerGatherAzure, workerGatherEmber] = await trainedWorkerGatherStates;
  assert.deepEqual(unitById(workerGatherEmber, producedWorker[0]),
    unitById(workerGatherAzure, producedWorker[0]), 'both clients should synchronize the trained worker gather task');
  const producedWorkerGatherTask = unitById(workerGatherAzure, producedWorker[0])[9];

  stage = 'reset and verify buildings clear';
  const resetStates = Promise.all([
    waitForState(azure, (state) => state.mapId === mapId && state.buildings?.length === 0,
      'Azure reset with no buildings', RUN_TIMEOUTS.reset),
    waitForState(ember, (state) => state.mapId === mapId && state.buildings?.length === 0,
      'Ember reset with no buildings', RUN_TIMEOUTS.reset),
  ]);
  send(azure.socket, { type: 'reset' });
  const [resetAzure, resetEmber] = await resetStates;
  assert.deepEqual(resetAzure.buildings, [], 'reset should clear all buildings for Azure');
  assert.deepEqual(resetEmber.buildings, [], 'reset should clear all buildings for Ember');
  assert.deepEqual(workerProductionSnapshot(resetAzure).map((production) => production.queue), [0, 0],
    'reset should clear all Town Center worker queues for Azure');
  assert.deepEqual(workerProductionSnapshot(resetEmber).map((production) => production.queue), [0, 0],
    'reset should clear all Town Center worker queues for Ember');
  assert.deepEqual(resourceSnapshot(resetAzure), resourceSnapshot(resetEmber),
    'both clients should see the same reset economy');

  stage = 'fill the 2,000-unit living population cap';
  const fullPopulation = (state) => state.mapId === mapId && state.armySize === 2000
    && state.rosterSize === 2000 && state.alive?.[0] === 1000 && state.alive?.[1] === 1000;
  const fullPopulationStates = Promise.all([
    waitForState(azure, fullPopulation, '2,000 living units at the population cap'),
    waitForState(ember, fullPopulation, '2,000 living units synchronized at the population cap'),
  ]);
  send(azure.socket, { type: 'selectArmySize', count: 2000 });
  const [fullAzureState, fullEmberState] = await fullPopulationStates;
  assert.deepEqual(fullAzureState.alive, [1000, 1000]);
  assert.deepEqual(fullEmberState.alive, [1000, 1000]);
  stage = 'gather food and wood for an Ember Barracks at the population cap';
  const emberFoodWorkers = workersForTeam(fullEmberState, 1).map((unit) => unit[0]);
  const emberWoodWorkers = emberFoodWorkers.slice(0, 3);
  const emberFoodGatherers = emberFoodWorkers.slice(3);
  const capGatherAckIndex = ember.feed.messages.length - 1;
  const capWoodGatherAck = waitForMessage(ember, (message) => message.type === 'notice'
    && message.message?.startsWith('GATHER ORDER · 3 WORKERS'), 'Ember Barracks-wood gather acknowledgement', capGatherAckIndex);
  const capFoodGatherAck = waitForMessage(ember, (message) => message.type === 'notice'
    && message.message?.startsWith('GATHER ORDER · 1 WORKERS'), 'Ember replacement-food gather acknowledgement', capGatherAckIndex);
  const emberFundedForBarracks = Promise.all(clients.map((client) => waitForState(client,
    (state) => state.mapId === mapId && state.food?.[1] >= INFANTRY_COST_FOOD
      && state.wood?.[1] >= BARRACKS_COST_WOOD,
    `${client.name} Ember food and wood for capped Barracks production`, RUN_TIMEOUTS.gather)));
  send(ember.socket, { type: 'gather', ids: emberWoodWorkers, nodeId: 'ember-wood' });
  send(ember.socket, { type: 'gather', ids: emberFoodGatherers, nodeId: 'ember-food' });
  await Promise.all([capWoodGatherAck, capFoodGatherAck, emberFundedForBarracks]);

  const stopCapGatherAckIndex = ember.feed.messages.length - 1;
  const stopCapGatherAck = waitForMessage(ember, (message) => message.type === 'notice'
    && message.message?.startsWith('MOVE ORDER'), 'Ember stop-gathering acknowledgement', stopCapGatherAckIndex);
  const capGatherersIdle = Promise.all(clients.map((client) => waitForState(client,
    (state) => state.mapId === mapId && workersIdle(state, emberFoodWorkers),
    client.name + ' Ember gatherers become idle before cap checks', RUN_TIMEOUTS.stopGathering)));
  send(ember.socket, { type: 'move', ids: emberFoodWorkers, x: 20, z: 0 });
  await Promise.all([stopCapGatherAck, capGatherersIdle]);

  stage = 'construct an Ember Barracks at the living-unit cap';
  const beforeCapBarracks = ember.feed.latest;
  const expectedCapBarracksWood = beforeCapBarracks.wood[1] - BARRACKS_COST_WOOD;
  const capBarracksBuildIndex = ember.feed.messages.length - 1;
  const capBarracksBuildAck = waitForMessage(ember, (message) => message.type === 'notice'
    && message.message?.startsWith('BARRACKS PLACED'), 'Ember capped Barracks build acknowledgement',
  capBarracksBuildIndex, RUN_TIMEOUTS.buildStart);
  const capBarracksAccepted = (state) => {
    const barracks = state.buildings?.find((row) => row.type === 'barracks' && row.team === 1);
    return state.mapId === mapId && state.buildings?.length === 1
      && barracks?.x === snapCellCenter(CAP_BARRACKS_SITE.x)
      && barracks?.z === snapCellCenter(CAP_BARRACKS_SITE.z)
      && state.wood?.[1] === expectedCapBarracksWood;
  };
  const capBarracksBuildStates = Promise.all(clients.map((client) => waitForState(client,
    capBarracksAccepted, `${client.name} sees Ember Barracks and wood debit`, RUN_TIMEOUTS.buildStart)));
  send(ember.socket, {
    type: 'build', buildingType: 'barracks', ids: emberFoodWorkers, ...CAP_BARRACKS_SITE,
  });
  await Promise.all([capBarracksBuildAck, capBarracksBuildStates]);
  const capBarracksId = ember.feed.latest.buildings.find((row) => row.type === 'barracks').id;
  const capBarracksComplete = (state) => state.mapId === mapId
    && state.buildings?.some((row) => row.id === capBarracksId && row.complete);
  const [capBarracksCompleteAzure, capBarracksCompleteEmber] = await Promise.all(clients.map((client) => (
    waitForState(client, capBarracksComplete, `${client.name} sees completed Ember Barracks`, RUN_TIMEOUTS.construction)
  )));
  assertBuildingShape(capBarracksCompleteEmber.buildings.find((row) => row.id === capBarracksId), {
    team: 1, type: 'barracks', site: CAP_BARRACKS_SITE, label: 'completed Ember capped Barracks',
  });
  assertSyncedBuilding(capBarracksCompleteAzure, capBarracksCompleteEmber,
    'capped Barracks construction completion');

  stage = 'reject training at the living-unit cap';
  const foodBeforeCapReject = ember.feed.latest.food[1];
  await expectRejectedWithoutDebit({
    issuer: ember,
    observers: clients,
    command: { type: 'train', buildingId: capBarracksId },
    label: 'Infantry training at the 1,000-living-unit team cap',
    expectedPrefix: 'UNIT CAP REACHED · TRAINING BLOCKED',
  });
  assert.equal(ember.feed.latest.food[1], foodBeforeCapReject,
    'a capped training request must not debit food');
  await expectRejectedWithoutDebit({
    issuer: ember,
    observers: clients,
    command: { type: 'trainWorker' },
    label: 'Town Center worker training at the 1,000-living-unit team cap',
    expectedPrefix: 'WORKER TRAINING REJECTED · UNIT CAP REACHED',
  });
  assert.equal(ember.feed.latest.food[1], foodBeforeCapReject,
    'a Town Center worker request at the cap must not debit food');

  stage = 'clear Barracks access and stage one spawn blocker';
  const capBlockerId = emberFoodWorkers[0];
  const clearBuildersOrderIndex = ember.feed.messages.length - 1;
  const clearBuildersAck = waitForMessage(ember, (message) => message.type === 'notice'
    && message.message?.startsWith('MOVE ORDER'), 'Ember builders clear the Barracks access tile', clearBuildersOrderIndex);
  const buildersClear = Promise.all(clients.map((client) => waitForState(client,
    (state) => state.mapId === mapId && workersIdle(state, emberFoodWorkers)
      && emberFoodWorkers.filter((id) => id !== capBlockerId).every((id) => {
        const worker = unitById(state, id);
        return worker && Math.abs(worker[2] - 20) < 5 && Math.abs(worker[3]) < 5;
      }),
    `${client.name} sees Ember builders clear the Barracks`, RUN_TIMEOUTS.construction)));
  send(ember.socket, { type: 'move', ids: emberFoodWorkers, x: 20, z: 0 });
  await Promise.all([clearBuildersAck, buildersClear]);

  const blockerStagingPosition = cellCenter(
    CAP_BLOCKER_STAGING_CELL.column, CAP_BLOCKER_STAGING_CELL.row,
  );
  const stageBlockerOrderIndex = ember.feed.messages.length - 1;
  const stageBlockerAck = waitForMessage(ember, (message) => message.type === 'notice'
    && message.message?.startsWith('MOVE ORDER'), 'Ember worker stages outside the Barracks spawn search', stageBlockerOrderIndex);
  const blockerStaged = Promise.all(clients.map((client) => waitForState(client,
    (state) => state.mapId === mapId && unitAtCell(state, capBlockerId,
      CAP_BLOCKER_STAGING_CELL.column, CAP_BLOCKER_STAGING_CELL.row)
      && unitById(state, capBlockerId)?.[9] === 'idle',
    `${client.name} sees the Barracks blocker staged outside spawn range`, RUN_TIMEOUTS.construction)));
  send(ember.socket, { type: 'move', ids: [capBlockerId], ...blockerStagingPosition });
  await Promise.all([stageBlockerAck, blockerStaged]);

  stage = 'kill one unit and free its bounded production slot';
  const casualtyTarget = fullAzureState.units.find((unit) => unit[1] === 1 && unit[4] > 0 && unit[5] === 'infantry');
  assert.ok(casualtyTarget, 'the full army should contain an Ember infantry target');
  const azureAttackers = fullAzureState.units.filter((unit) => unit[1] === 0 && unit[4] > 0).map((unit) => unit[0]);
  const deadStates = Promise.all(clients.map((client) => waitForState(client,
    (state) => state.mapId === mapId && unitById(state, casualtyTarget[0])?.[4] === 0,
    `${client.name} sees a unit die and population capacity free`, RUN_TIMEOUTS.construction)));
  send(azure.socket, { type: 'attack', ids: azureAttackers, targetId: casualtyTarget[0] });
  const deadState = await deadStates;
  const deadUnit = unitById(deadState[0], casualtyTarget[0]);
  const deadGeneration = deadUnit[8];
  assert.equal(deadState[0].rosterSize, 1999, 'a casualty should reduce the living roster by one');

  stage = 'queue Infantry into the freed unit slot';
  const beforeQueuedReplacement = ember.feed.latest;
  const expectedReplacementFood = beforeQueuedReplacement.food[1] - INFANTRY_COST_FOOD;
  const queuedReplacement = (state) => state.mapId === mapId
    && state.food?.[1] === expectedReplacementFood
    && state.alive?.[1] === 999
    && normalizedQueueDepth(state.buildings?.find((building) => building.id === capBarracksId)) === 1
    && state.buildings.find((building) => building.id === capBarracksId)?.trainingRemaining > 0;
  const queuedReplacementStates = Promise.all(clients.map((client) => waitForState(client,
    queuedReplacement, `${client.name} sees Ember Infantry queue and food debit`, RUN_TIMEOUTS.trainStart)));
  send(ember.socket, { type: 'train', buildingId: capBarracksId });
  const [queuedReplacementAzure, queuedReplacementEmber] = await queuedReplacementStates;
  assertSyncedBuilding(queuedReplacementAzure, queuedReplacementEmber,
    'Ember Infantry reservation after casualty');

  stage = 'move worker into the only Barracks spawn cell';
  const blockerSpawnPosition = cellCenter(CAP_BLOCKER_SPAWN_CELL.column, CAP_BLOCKER_SPAWN_CELL.row);
  const blockerMoveOrderIndex = ember.feed.messages.length - 1;
  const blockerMoveAck = waitForMessage(ember, (message) => message.type === 'notice'
    && message.message?.startsWith('MOVE ORDER'), 'Ember worker occupies the sole Barracks spawn cell', blockerMoveOrderIndex);
  const blockerArrivals = Promise.all(clients.map((client) => waitForState(client,
    (state) => state.mapId === mapId && unitAtCell(state, capBlockerId,
      CAP_BLOCKER_SPAWN_CELL.column, CAP_BLOCKER_SPAWN_CELL.row),
    `${client.name} sees the blocker on the sole Barracks spawn cell`, RUN_TIMEOUTS.blockedProduction)));
  send(ember.socket, { type: 'move', ids: [capBlockerId], ...blockerSpawnPosition });
  await blockerMoveAck;
  const [blockerAzure, blockerEmber] = await blockerArrivals;
  for (const state of [blockerAzure, blockerEmber]) {
    const blockerArrivalBuilding = state.buildings.find((building) => building.id === capBarracksId);
    assert.equal(normalizedQueueDepth(blockerArrivalBuilding), 1,
      'the queued Infantry should still be waiting when its only spawn cell becomes occupied');
    assert.ok(blockerArrivalBuilding.trainingRemaining > 0,
      'the blocker should reach the sole spawn cell before the Infantry countdown ends');
    assert.equal(state.alive?.[1], 999);
    assert.equal(unitById(state, casualtyTarget[0])?.[4], 0,
      'the queued replacement should remain unspawned while the blocker is moving into place');
    assert.ok(unitAtCell(state, capBlockerId,
      CAP_BLOCKER_SPAWN_CELL.column, CAP_BLOCKER_SPAWN_CELL.row));
  }

  stage = 'wait for Barracks production to block on occupied spawn cells';
  const infantryBlocked = (state) => {
    const barracks = state.buildings?.find((building) => building.id === capBarracksId);
    return state.mapId === mapId && normalizedQueueDepth(barracks) === 1
      && barracks?.trainingRemaining === 0 && barracks.productionBlocked === true
      && state.alive?.[1] === 999 && unitById(state, casualtyTarget[0])?.[4] === 0;
  };
  const blockedStates = Promise.all(clients.map((client) => waitForState(client,
    infantryBlocked, `${client.name} sees Infantry waiting for Barracks spawn space`, RUN_TIMEOUTS.blockedProduction)));
  const [blockedAzure, blockedEmber] = await blockedStates;
  assertSyncedBuilding(blockedAzure, blockedEmber, 'blocked Infantry production');
  assert.equal(blockedEmber.food[1], expectedReplacementFood,
    'waiting for spawn space must not debit Infantry food a second time');

  stage = 'verify queued Infantry reserves the final team slot';
  await expectRejectedWithoutDebit({
    issuer: ember,
    observers: clients,
    command: { type: 'train', buildingId: capBarracksId },
    label: 'second Infantry queue while a queued Infantry reserves the final team slot',
    expectedPrefix: 'UNIT CAP REACHED · TRAINING BLOCKED',
    stableBuildingQueuesOnly: true,
  });
  await expectRejectedWithoutDebit({
    issuer: ember,
    observers: clients,
    command: { type: 'trainWorker' },
    label: 'Town Center queue while a queued Infantry reserves the final team slot',
    expectedPrefix: 'WORKER TRAINING REJECTED · UNIT CAP REACHED',
    stableBuildingQueuesOnly: true,
  });

  stage = 'open the sole Barracks production cell';
  const clearSpawnAckIndex = ember.feed.messages.length - 1;
  const clearSpawnAck = waitForMessage(ember, (message) => message.type === 'notice'
    && message.message?.startsWith('MOVE ORDER'), 'Ember worker clears the sole Barracks spawn cell', clearSpawnAckIndex);
  const productionResumes = Promise.all(clients.map((client) => waitForState(client,
    (state) => state.mapId === mapId
      && normalizedQueueDepth(state.buildings?.find((building) => building.id === capBarracksId)) === 0
      && state.buildings.find((building) => building.id === capBarracksId)?.productionBlocked === false
      && unitById(state, casualtyTarget[0])?.[4] > 0
      && unitById(state, casualtyTarget[0])?.[5] === 'infantry'
      && unitAtCell(state, casualtyTarget[0], CAP_BLOCKER_SPAWN_CELL.column, CAP_BLOCKER_SPAWN_CELL.row)
      && unitAtCell(state, capBlockerId, CAP_BLOCKER_STAGING_CELL.column, CAP_BLOCKER_STAGING_CELL.row),
    `${client.name} sees Barracks production resume after the spawn area opens`, RUN_TIMEOUTS.archerSpawn)));
  send(ember.socket, { type: 'move', ids: [capBlockerId], ...blockerStagingPosition });
  await clearSpawnAck;
  const [replacementAzure, replacementEmber] = await productionResumes;
  assert.equal(replacementAzure.rosterSize, 2000);
  assert.equal(replacementAzure.alive[1], 1000);

  const replacement = unitById(replacementAzure, casualtyTarget[0]);
  assert.ok(replacement && replacement[4] > 0, 'Barracks production should reuse the dead unit slot');
  assert.equal(replacement[1], 1, 'the replacement Infantry must remain on Ember');
  assert.equal(replacement[5], 'infantry', 'the queued replacement should be Infantry');
  assert.deepEqual([replacement[2], replacement[3]], [
    blockerSpawnPosition.x, blockerSpawnPosition.z,
  ], 'Infantry should spawn on the only available Barracks cell');
  assert.equal(replacementAzure.food[1], expectedReplacementFood,
    'the blocked queue should not charge Infantry food again when it spawns');
  assert.notEqual(replacement[8], deadGeneration,
    'reusing a dead unit slot for production must change its generation');
  assertSyncedBuilding(replacementAzure, replacementEmber, 'Ember Infantry production completion');
  assert.deepEqual(unitById(replacementEmber, casualtyTarget[0]), replacement,
    'both online clients should agree on the recycled Infantry slot');

  stage = 'reject an old-generation order after slot reuse';
  const replacementPosition = [replacement[2], replacement[3]];
  const staleRejectionIndex = ember.feed.messages.length - 1;
  const staleGenerationRejected = waitForMessage(ember, (message) => message.type === 'notice'
    && message.message === 'MOVE REJECTED · NO VALID UNITS',
  'stale-generation move rejection', staleRejectionIndex);
  send(ember.socket, {
    type: 'move', ids: [casualtyTarget[0]], unitGenerations: [deadGeneration], x: 8, z: 0,
  });
  await staleGenerationRejected;
  await new Promise((resolve) => setTimeout(resolve, 500));
  const afterStaleOrder = unitById(ember.feed.latest, casualtyTarget[0]);
  assert.deepEqual([afterStaleOrder[2], afterStaleOrder[3]], replacementPosition,
    'an order from the dead unit generation must not move its produced Infantry');

  console.log(JSON.stringify({
    workload: 'two-client server-authoritative economy, construction, and production',
    mapId,
    teams: ['azure', 'ember'],
    gathered: {
      azureFood: azureFunded.food[0], azureWood: azureFunded.wood[0],
      emberFood: emberFunded.food[1], emberWood: emberFunded.wood[1],
    },
    rejectedOrders: [
      'insufficient wood', 'invalid building type', 'enemy workers',
      'overlapping building', 'enemy training', 'unfinished Barracks training',
      'Infantry and worker training at cap',
    ],
    building: {
      id: buildingId,
      site: { x: completeState.buildings[0].x, z: completeState.buildings[0].z },
      visibleProgress: progressState.buildings[0].progress,
      completedProgress: completeState.buildings[0].progress,
      woodCost: BUILD_COST_WOOD,
      synchronizedConstructionAndCompletion: true,
    },
    archer: {
      id: archer[0], hp: archer[4], foodCost: ARCHER_COST_FOOD, woodCost: ARCHER_COST_WOOD,
      rangedAttackTarget: targetId, targetHpBefore, targetHpAfter,
    },
    barracks: {
      id: acceptedBarracksId,
      site: { x: completeBarracks.x, z: completeBarracks.z },
      visibleProgress: barracksProgress.progress,
      completedProgress: completeBarracks.progress,
      woodCost: BARRACKS_COST_WOOD,
      synchronizedConstructionAndCompletion: true,
    },
    infantry: {
      id: producedInfantry[0], hp: producedInfantry[4], foodCost: INFANTRY_COST_FOOD,
      trainingSeconds: INFANTRY_TRAIN_SECONDS,
      progressObserved: infantryProgressAzure.buildings.find((row) => row.id === acceptedBarracksId).trainingProgress,
    },
    worker: {
      id: producedWorker[0], hp: producedWorker[4], foodCost: WORKER_COST_FOOD,
      trainingSeconds: WORKER_TRAIN_SECONDS, progressObserved: workerProductionForTeam(workerProgressAzure, 0).trainingProgress,
      gatherTaskAfterSpawn: producedWorkerGatherTask,
    },
    resetClearedBuildings: true,
    populationCap: {
      testedLivingLimit: [1000, 1000], deathFreedCapacity: true,
      queuedInfantryReservedLastSlot: true, workerTrainingRejectedAgainstReservation: true,
      blockedSpawnWaitAndResume: true,
      recycledUnitId: replacement[0], previousGeneration: deadGeneration, currentGeneration: replacement[8],
      staleGenerationOrderRejected: true,
    },
  }, null, 2));
} catch (error) {
  error.message += `\nScenario stage: ${stage}\nClient diagnostics: ${JSON.stringify(clients.map(clientDiagnostic))}`;
  throw error;
} finally {
  await Promise.all(clients.map(close));
}
