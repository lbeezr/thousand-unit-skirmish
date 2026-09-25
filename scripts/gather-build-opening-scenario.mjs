import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverRoot = path.resolve(process.env.RTS_SERVER_ROOT || root);
const mapPath = path.resolve(serverRoot, process.env.RTS_OPENING_MAP || 'maps/forked-vale.json');
const fixtureMapId = 'gather-build-opening';
// Set this to the exact Git SHA of the server source before running the scenario.
const baselineCommit = process.env.RTS_BASELINE_COMMIT?.trim() || '';
if (!/^[0-9a-f]{40,64}$/i.test(baselineCommit)) {
  throw new Error('RTS_BASELINE_COMMIT must be the full 40- or 64-character server-source Git SHA.');
}
function cleanCheckoutCommit(directory, label) {
  let commit;
  try {
    commit = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: directory,
      encoding: 'utf8',
    }).trim();
  } catch (error) {
    throw new Error(`${label} must be a Git checkout: ${error.message}`);
  }
  const changes = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], {
    cwd: directory,
    encoding: 'utf8',
  }).trim();
  if (changes) throw new Error(`${label} has changes; evidence requires a clean checkout:\n${changes}`);
  return commit;
}
const harnessCommit = cleanCheckoutCommit(root, 'Scenario harness checkout');
const checkoutCommit = cleanCheckoutCommit(serverRoot, 'RTS_SERVER_ROOT');
if (checkoutCommit.toLowerCase() !== baselineCommit.toLowerCase()) {
  throw new Error(`RTS_BASELINE_COMMIT ${baselineCommit} does not match RTS_SERVER_ROOT HEAD ${checkoutCommit}.`);
}
const mapSourceBytes = await readFile(mapPath);
const mapSourceText = mapSourceBytes.toString('utf8');
const mapSourceSha256 = createHash('sha256').update(mapSourceBytes).digest('hex');
const temporary = await mkdtemp(path.join(os.tmpdir(), 'rts-gather-build-opening-'));
const listener = createServer();
listener.listen(0, '127.0.0.1');
await once(listener, 'listening');
const port = listener.address().port;
await new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));

const server = spawn(process.execPath, ['server.mjs'], {
  cwd: serverRoot,
  env: {
    ...process.env,
    PORT: String(port),
    RTS_HOST: '127.0.0.1',
    RTS_MAP: path.relative(serverRoot, mapPath),
    RTS_MATCH_STATE_PATH: path.join(temporary, 'checkpoint.json'),
    RTS_CUSTOM_MAP_DIRECTORY: path.join(temporary, 'custom-maps'),
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', chunk => { serverLog += chunk.toString(); });
server.stderr.on('data', chunk => { serverLog += chunk.toString(); });

const EVENT_TIMEOUT_MS = 120_000;
const RESOURCE_INTERACTION_RANGE = 1.5;
// Economy deposits run before movement; three-tick snapshots can observe a worker
// up to 0.26 world units into its return-to-node route after a valid deposit.
const DEPOSIT_SNAPSHOT_POSITION_TOLERANCE = 0.3;
const BUILDING_INTERACTION_RANGE = 1.4;
const CARGO_EPSILON = 0.0001;
const clients = [];
const completedRounds = [];
let nextOrderToken = 1;

function emitJsonLine(value) {
  return new Promise((resolve, reject) => {
    process.stdout.write(JSON.stringify(value) + '\n', error => error ? reject(error) : resolve());
  });
}

function failureSnapshots() {
  return clients.map((client, team) => {
    const state = client.latestState();
    return {
      team,
      matchClockSeconds: state?.matchElapsedSeconds ?? null,
      tick: state?.tick ?? null,
      stock: state ? { food: state.food?.[team], wood: state.wood?.[team] } : null,
      workers: state ? ownUnits(state, team, 'worker').map(unit => ({
        id: unit[0], x: unit[2], z: unit[3], cargo: unit[6], cargoType: unit[7],
      })) : [],
      buildings: state?.buildings?.filter(building => building.team === team).map(building => ({
        id: building.id, type: building.type, progress: building.progress,
        complete: building.complete, queue: building.queue,
      })) ?? [],
      recentNotices: client.messages.filter(message => message.type === 'notice')
        .slice(-8).map(message => message.message),
    };
  });
}

function createClient() {
  const socket = new WebSocket('ws://127.0.0.1:' + port + '/ws', ['rts-v1']);
  const client = {
    socket,
    messages: [],
    states: [],
    messageWaiters: [],
    stateWaiters: [],
    team: null,
    send(command) { socket.send(JSON.stringify(command)); },
    latestState() { return this.states.at(-1) ?? null; },
    waitForMessage(predicate, afterMessageIndex = this.messages.length - 1,
      timeoutMs = EVENT_TIMEOUT_MS) {
      const existing = this.messages.slice(afterMessageIndex + 1).find(predicate);
      if (existing) return Promise.resolve(existing);
      return new Promise((resolve, reject) => {
        const waiter = {
          predicate, afterMessageIndex, resolve, reject,
          timeout: setTimeout(() => {
            const index = this.messageWaiters.indexOf(waiter);
            if (index >= 0) this.messageWaiters.splice(index, 1);
            reject(new Error('message timeout: ' + JSON.stringify(this.messages.slice(-5))));
          }, timeoutMs),
        };
        this.messageWaiters.push(waiter);
      });
    },
    waitForState(predicate, afterTick = -1, timeoutMs = EVENT_TIMEOUT_MS) {
      const existing = this.states.find(state => state.tick > afterTick && predicate(state));
      if (existing) return Promise.resolve(existing);
      return new Promise((resolve, reject) => {
        const waiter = {
          predicate, afterTick, resolve, reject,
          timeout: setTimeout(() => {
            const index = this.stateWaiters.indexOf(waiter);
            if (index >= 0) this.stateWaiters.splice(index, 1);
            reject(new Error('state timeout: ' + JSON.stringify(this.states.slice(-5))));
          }, timeoutMs),
        };
        this.stateWaiters.push(waiter);
      });
    },
    waitForStateAfterMessage(predicate, afterMessageIndex, timeoutMs = EVENT_TIMEOUT_MS) {
      const existing = this.messages.slice(afterMessageIndex + 1)
        .find(message => message.type === 'state' && predicate(message));
      if (existing) return Promise.resolve(existing);
      return new Promise((resolve, reject) => {
        const waiter = {
          predicate, afterMessageIndex, resolve, reject,
          timeout: setTimeout(() => {
            const index = this.stateWaiters.indexOf(waiter);
            if (index >= 0) this.stateWaiters.splice(index, 1);
            reject(new Error('post-order state timeout: ' + JSON.stringify(this.states.slice(-5))));
          }, timeoutMs),
        };
        this.stateWaiters.push(waiter);
      });
    },
  };

  socket.addEventListener('message', event => {
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    const messageIndex = client.messages.length;
    client.messages.push(message);

    const nestedState = ['welcome', 'mapChange'].includes(message.type) ? message.state : null;
    const state = message.type === 'state' ? message : nestedState;
    if (state) {
      client.states.push(state);
      for (let index = client.stateWaiters.length - 1; index >= 0; index--) {
        const waiter = client.stateWaiters[index];
        const afterBoundary = waiter.afterMessageIndex === undefined
          ? state.tick > waiter.afterTick : messageIndex > waiter.afterMessageIndex;
        if (!afterBoundary || !waiter.predicate(state)) continue;
        client.stateWaiters.splice(index, 1);
        clearTimeout(waiter.timeout);
        waiter.resolve(state);
      }
    }

    for (let index = client.messageWaiters.length - 1; index >= 0; index--) {
      const waiter = client.messageWaiters[index];
      if (messageIndex <= waiter.afterMessageIndex || !waiter.predicate(message)) continue;
      client.messageWaiters.splice(index, 1);
      clearTimeout(waiter.timeout);
      waiter.resolve(message);
    }
  });
  const failWaiters = reason => {
    const error = reason instanceof Error ? reason : new Error('WebSocket closed before observation completed');
    for (const waiter of [...client.messageWaiters, ...client.stateWaiters]) {
      clearTimeout(waiter.timeout);
      waiter.reject(error);
    }
    client.messageWaiters.length = 0;
    client.stateWaiters.length = 0;
  };
  socket.addEventListener('close', () => failWaiters());
  socket.addEventListener('error', () => failWaiters(new Error('WebSocket error')));

  clients.push(client);
  return client;
}

function distance(x1, z1, x2, z2) {
  return Math.hypot(x1 - x2, z1 - z2);
}

function ownUnits(state, team, kind) {
  return state.units.filter(unit => unit[1] === team && unit[4] > 0
    && (kind === undefined || unit[5] === kind));
}

function unitById(state, id) {
  return state.units.find(unit => unit[0] === id) ?? null;
}

function buildingById(state, id) {
  return state.buildings.find(building => building.id === id) ?? null;
}

function buildingForTeam(state, team, type) {
  return state.buildings.find(building => building.team === team && building.type === type) ?? null;
}

function distanceToBuildingEdge(unit, building) {
  return Math.hypot(
    Math.max(0, Math.abs(building.x - unit[2]) - 1.5),
    Math.max(0, Math.abs(building.z - unit[3]) - 1.5),
  );
}

function nearestIds(workers, count, target) {
  return [...workers]
    .sort((left, right) => distance(left[2], left[3], target.x, target.z)
      - distance(right[2], right[3], target.x, target.z))
    .slice(0, count)
    .map(worker => worker[0]);
}

function rolePlan(state, team, map, role) {
  const workers = ownUnits(state, team, 'worker');
  assert.equal(workers.length, 4, 'each opening must start with four workers');
  assert.ok([1, 2].includes(role.builderCount), 'allocation must be one or two builders');
  const spawn = map.spawnPoints.find(point => point.team === team);
  const sign = spawn.x < 0 ? -1 : 1;
  const buildSite = { x: sign * 21.5, z: 0.5 };
  const nearestNode = type => map.resourceNodes
    .filter(node => node.type === type)
    .sort((left, right) => distance(left.x, left.z, spawn.x, spawn.z)
      - distance(right.x, right.z, spawn.x, spawn.z))[0];
  const foodNode = nearestNode('food');
  const woodNode = nearestNode('wood');
  assert.ok(foodNode && woodNode, 'Forked Vale must provide mirrored food and wood nodes');

  const builderIds = nearestIds(workers, role.builderCount, buildSite);
  const assigned = new Set(builderIds);
  const remaining = workers.filter(worker => !assigned.has(worker[0]));
  const foodGathererCount = remaining.length - 1;
  const foodGathererIds = nearestIds(remaining, foodGathererCount, foodNode);
  for (const id of foodGathererIds) assigned.add(id);
  const woodGathererIds = workers.filter(worker => !assigned.has(worker[0])).map(worker => worker[0]);

  assert.equal(builderIds.length, role.builderCount);
  assert.equal(foodGathererIds.length, role.builderCount === 1 ? 2 : 1);
  assert.equal(woodGathererIds.length, 1);
  assert.equal(new Set([...builderIds, ...foodGathererIds, ...woodGathererIds]).size, 4,
    'each worker must have exactly one opening assignment');
  return { team, buildingType: role.buildingType, builderCount: role.builderCount,
    gathererCount: 4 - role.builderCount, builderIds, foodGathererIds, woodGathererIds,
    foodNode, woodNode, buildSite, spawn };
}

async function issueTrackedOrder(client, command, acceptedText) {
  const before = client.latestState();
  assert.ok(before, 'order must be based on an observed match state');
  const afterMessageIndex = client.messages.length - 1;
  const token = nextOrderToken++;
  client.send({ ...command, clientOrderToken: token });
  const notice = await client.waitForMessage(message => message.type === 'notice'
    && message.clientOrderToken === token
    && (message.message.includes(acceptedText)
      || /REJECTED|UNREACHABLE|NO VALID|RESOURCE NODE EMPTY|NO REACHABLE WORKERS SELECTED|FAILED|SUPERSEDED|CANCELLED/i.test(message.message)), afterMessageIndex);
  assert.ok(notice.message.includes(acceptedText), 'expected order acceptance: ' + notice.message);
  assert.ok(!/REJECTED|UNREACHABLE|NO VALID/i.test(notice.message),
    'order was rejected: ' + notice.message);
  const noticeIndex = client.messages.indexOf(notice);
  const acknowledged = await client.waitForStateAfterMessage(
    () => true, noticeIndex,
  );
  return {
    clientOrderToken: token,
    acceptedNotice: notice.message,
    submittedAfterMatchClockSeconds: before.matchElapsedSeconds,
    acceptanceNoticeMessageIndex: noticeIndex,
    firstStateAfterAcceptanceMatchClockSeconds: acknowledged.matchElapsedSeconds,
    acknowledgementMessageIndex: client.messages.findIndex(message => message === acknowledged),
    acknowledgementTick: acknowledged.tick,
  };
}

function depositEventForState(client, state, team, type, gathererIds, spawn) {
  const stateIndex = client.states.indexOf(state);
  if (stateIndex <= 0) return null;
  const previous = client.states[stateIndex - 1];
  const stockBefore = previous[type]?.[team];
  const stockAfter = state[type]?.[team];
  if (!Number.isFinite(stockBefore) || !Number.isFinite(stockAfter)) return null;
  const amount = stockAfter - stockBefore;
  if (amount <= CARGO_EPSILON) return null;

  const cargoTransitionsAtBase = gathererIds.filter(id => {
    const previousUnit = unitById(previous, id);
    const currentUnit = unitById(state, id);
    return previousUnit && currentUnit
      && previousUnit[6] > CARGO_EPSILON && previousUnit[7] === type
      && currentUnit[6] <= CARGO_EPSILON
      && distance(currentUnit[2], currentUnit[3], spawn.x, spawn.z)
        <= RESOURCE_INTERACTION_RANGE + DEPOSIT_SNAPSHOT_POSITION_TOLERANCE;
  });
  if (cargoTransitionsAtBase.length === 0) return null;
  return {
    resourceType: type,
    matchClockSeconds: state.matchElapsedSeconds,
    tick: state.tick,
    bankedStockBefore: stockBefore,
    bankedStockAfter: stockAfter,
    bankedDelta: amount,
    cargoDelivered: cargoTransitionsAtBase.reduce((total, id) => total + unitById(previous, id)[6], 0),
    workersObservedDepositing: cargoTransitionsAtBase.map(id => {
      const previousUnit = unitById(previous, id);
      const currentUnit = unitById(state, id);
      return {
        id,
        cargoBefore: previousUnit[6],
        cargoTypeBefore: previousUnit[7],
        positionObservedAfterDeposit: { x: currentUnit[2], z: currentUnit[3] },
        distanceToSpawnAtObservation: distance(currentUnit[2], currentUnit[3], spawn.x, spawn.z),
        maxAcceptedDistanceAtObservation: RESOURCE_INTERACTION_RANGE + DEPOSIT_SNAPSHOT_POSITION_TOLERANCE,
      };
    }),
  };
}

async function collectGatherMilestones(client, plan, orderRecords) {
  const groups = [
    { type: 'food', node: plan.foodNode, workerIds: plan.foodGathererIds, order: orderRecords.foodGather },
    { type: 'wood', node: plan.woodNode, workerIds: plan.woodGathererIds, order: orderRecords.woodGather },
  ];
  const gatherers = [];
  for (const group of groups) {
    for (const id of group.workerIds) {
      const firstObservedInRange = await client.waitForStateAfterMessage(state => {
        const worker = unitById(state, id);
        return worker && distance(worker[2], worker[3], group.node.x, group.node.z)
          <= RESOURCE_INTERACTION_RANGE;
      }, group.order.acceptanceNoticeMessageIndex);
      const firstCargo = await client.waitForStateAfterMessage(state => {
        const worker = unitById(state, id);
        return worker && worker[6] > CARGO_EPSILON && worker[7] === group.type;
      }, group.order.acceptanceNoticeMessageIndex);
      const rangeWorker = unitById(firstObservedInRange, id);
      const cargoWorker = unitById(firstCargo, id);
      assert.ok(rangeWorker && cargoWorker);
      assert.ok(distance(rangeWorker[2], rangeWorker[3], group.node.x, group.node.z)
        <= RESOURCE_INTERACTION_RANGE);
      assert.equal(cargoWorker[7], group.type);
      gatherers.push({
        id,
        resourceType: group.type,
        nodeId: group.node.id,
        firstObservedInRange: {
          afterOrderAccepted: true,
          matchClockSeconds: firstObservedInRange.matchElapsedSeconds,
          tick: firstObservedInRange.tick,
          distance: distance(rangeWorker[2], rangeWorker[3], group.node.x, group.node.z),
          workerPosition: { x: rangeWorker[2], z: rangeWorker[3] },
          nodePosition: { x: group.node.x, z: group.node.z },
        },
        firstCargo: {
          matchClockSeconds: firstCargo.matchElapsedSeconds,
          tick: firstCargo.tick,
          amount: cargoWorker[6],
          cargoType: cargoWorker[7],
          workerPosition: { x: cargoWorker[2], z: cargoWorker[3] },
          nodePosition: { x: group.node.x, z: group.node.z },
        },
      });
    }
  }

  const deposits = await Promise.all(groups.map(async group => {
    const state = await client.waitForStateAfterMessage(candidate => depositEventForState(
      client, candidate, plan.team, group.type, group.workerIds, plan.spawn,
    ) !== null, group.order.acceptanceNoticeMessageIndex);
    return depositEventForState(client, state, plan.team, group.type, group.workerIds, plan.spawn);
  }));
  for (const deposit of deposits) {
    assert.ok(deposit && deposit.bankedDelta > CARGO_EPSILON,
      'each gathered resource must be credited to the team bank');
    assert.ok(deposit.workersObservedDepositing.length > 0,
      'banked stock increase must coincide with a gatherer deposit at the base');
    assert.ok(Math.abs(deposit.bankedDelta - deposit.cargoDelivered) <= CARGO_EPSILON,
      `${deposit.resourceType} bank credit must match cargo dropped off (${deposit.bankedDelta} vs ${deposit.cargoDelivered})`);
  }
  return { gatherers, firstDeposits: deposits };
}

async function collectConstructionAndProduction(client, plan, startState, orderRecords) {
  const team = plan.team;
  const buildAcceptanceMessageIndex = orderRecords.build.acceptanceNoticeMessageIndex;
  const buildingPlaced = await client.waitForStateAfterMessage(state => Boolean(
    buildingForTeam(state, team, plan.buildingType),
  ), buildAcceptanceMessageIndex);
  const placedBuilding = buildingForTeam(buildingPlaced, team, plan.buildingType);
  const buildingId = placedBuilding.id;

  const builderFirstObservedInRange = await Promise.all(plan.builderIds.map(async id => {
    const state = await client.waitForStateAfterMessage(candidate => {
      const unit = unitById(candidate, id);
      const building = buildingById(candidate, buildingId);
      return unit && building
        && distanceToBuildingEdge(unit, building) <= BUILDING_INTERACTION_RANGE;
    }, buildAcceptanceMessageIndex);
    const unit = unitById(state, id);
    const building = buildingById(state, buildingId);
    return {
      id,
      afterOrderAccepted: true,
      matchClockSeconds: state.matchElapsedSeconds,
      tick: state.tick,
      distanceToEdge: distanceToBuildingEdge(unit, building),
      workerPosition: { x: unit[2], z: unit[3] },
      buildingPosition: { x: building.x, z: building.z },
    };
  }));

  const [constructionStarted, completed] = await Promise.all([
    client.waitForStateAfterMessage(state => buildingById(state, buildingId)?.progress > 0,
      buildAcceptanceMessageIndex),
    client.waitForStateAfterMessage(state => buildingById(state, buildingId)?.complete === true,
      buildAcceptanceMessageIndex),
  ]);
  const startBuilding = buildingById(constructionStarted, buildingId);
  const completedBuilding = buildingById(completed, buildingId);
  assert.ok(startBuilding.progress > 0 && startBuilding.progress < 1,
    'construction must expose partial progress before completion');
  assert.equal(startBuilding.complete, false, 'an in-progress structure must remain incomplete');
  assert.equal(completedBuilding.complete, true, 'building must complete');
  assert.equal(completedBuilding.progress, 1,
    'authoritative completion must coincide with full normalized construction progress');

  const preQueueState = client.latestState();
  const trainedKind = plan.buildingType === 'barracks' ? 'infantry' : 'archer';
  const queuedText = trainedKind === 'infantry' ? 'INFANTRY QUEUED' : 'ARCHER QUEUED';
  const queueMessageStart = client.messages.length - 1;
  client.send(plan.buildingType === 'barracks'
    ? { type: 'train', buildingId }
    : { type: 'trainArcher', buildingId });
  const queueNotice = await client.waitForMessage(message => message.type === 'notice'
    && (message.message.includes(queuedText) || /TRAINING REJECTED|BLOCKED/i.test(message.message)),
  queueMessageStart);
  assert.ok(queueNotice.message.includes(queuedText)
    && !/REJECTED|BLOCKED/i.test(queueNotice.message),
  JSON.stringify({
    stage: 'first-production-queue',
    team,
    buildingId,
    rejectionNotice: queueNotice.message,
    stockBeforeQueueAttempt: { food: preQueueState.food[team], wood: preQueueState.wood[team] },
    stockAtLatestObservation: {
      food: client.latestState()?.food?.[team], wood: client.latestState()?.wood?.[team],
    },
    matchClockBeforeQueueAttempt: preQueueState.matchElapsedSeconds,
  }));
  const queueNoticeIndex = client.messages.indexOf(queueNotice);
  const queued = await client.waitForStateAfterMessage(state => {
    const building = buildingById(state, buildingId);
    return building && building.queue > 0;
  }, queueNoticeIndex);

  const initialUnitCount = ownUnits(startState, team, trainedKind).length;
  const spawned = await client.waitForState(state => ownUnits(state, team, trainedKind).length
    > initialUnitCount, queued.tick);
  assert.equal(ownUnits(spawned, team, trainedKind).length, initialUnitCount + 1,
    'first production item must spawn exactly one unit');

  return {
    building: {
      id: buildingId,
      type: plan.buildingType,
      site: { x: completedBuilding.x, z: completedBuilding.z },
      placementAccepted: orderRecords.build.acceptedNotice,
      matchClockAtPlacementObserved: orderRecords.build.firstStateAfterAcceptanceMatchClockSeconds,
      buildersFirstObservedInRange: builderFirstObservedInRange,
      firstProgress: {
        matchClockSeconds: constructionStarted.matchElapsedSeconds,
        tick: constructionStarted.tick,
        progress: startBuilding.progress,
      },
      complete: {
        matchClockSeconds: completed.matchElapsedSeconds,
        tick: completed.tick,
        progress: completedBuilding.progress,
        buildingComplete: completedBuilding.complete,
      },
    },
    production: {
      type: trainedKind,
      queuedNotice: queueNotice.message,
      matchClockBeforeQueue: preQueueState.matchElapsedSeconds,
      queuedAt: { matchClockSeconds: queued.matchElapsedSeconds, tick: queued.tick },
      stockBeforeQueue: { food: preQueueState.food[team], wood: preQueueState.wood[team] },
      stockAtQueue: { food: queued.food[team], wood: queued.wood[team] },
      firstUnitAt: { matchClockSeconds: spawned.matchElapsedSeconds, tick: spawned.tick },
      stockAfterFirstUnit: { food: spawned.food[team], wood: spawned.wood[team] },
    },
  };
}

const matrix = [
  [
    { buildingType: 'barracks', builderCount: 1 },
    { buildingType: 'archery-range', builderCount: 2 },
  ],
  [
    { buildingType: 'archery-range', builderCount: 2 },
    { buildingType: 'barracks', builderCount: 1 },
  ],
  [
    { buildingType: 'barracks', builderCount: 2 },
    { buildingType: 'archery-range', builderCount: 1 },
  ],
  [
    { buildingType: 'archery-range', builderCount: 1 },
    { buildingType: 'barracks', builderCount: 2 },
  ],
];

async function runRound(roundNumber, rolesByTeam, map) {
  const startStates = clients.map(client => client.latestState());
  const plans = clients.map((client, team) => rolePlan(startStates[team], team, map, rolesByTeam[team]));
  const orders = await Promise.all(clients.map(async (client, team) => {
    const plan = plans[team];
    const foodGather = await issueTrackedOrder(client, {
      type: 'gather', ids: plan.foodGathererIds, nodeId: plan.foodNode.id,
    }, 'GATHER ORDER');
    const woodGather = await issueTrackedOrder(client, {
      type: 'gather', ids: plan.woodGathererIds, nodeId: plan.woodNode.id,
    }, 'GATHER ORDER');
    const build = await issueTrackedOrder(client, {
      type: 'build', buildingType: plan.buildingType, ids: plan.builderIds,
      x: plan.buildSite.x, z: plan.buildSite.z,
    }, 'PLACED');
    return { foodGather, woodGather, build };
  }));

  const teamResults = await Promise.all(clients.map(async (client, team) => {
    const plan = plans[team];
    const gatherMilestones = collectGatherMilestones(client, plan, orders[team]);
    const constructionAndProduction = collectConstructionAndProduction(
      client, plan, startStates[team], orders[team],
    );
    const [gather, production] = await Promise.all([gatherMilestones, constructionAndProduction]);
    const endState = client.latestState();
    const groupOrders = {
      foodGather: orders[team].foodGather,
      woodGather: orders[team].woodGather,
      build: orders[team].build,
    };
    assert.equal(groupOrders.foodGather.acceptedNotice.startsWith('GATHER ORDER'), true);
    assert.equal(groupOrders.woodGather.acceptedNotice.startsWith('GATHER ORDER'), true);
    return {
      team,
      buildingType: plan.buildingType,
      workerAllocation: plan.builderCount === 1 ? '1-builder/3-gatherer' : '2-builder/2-gatherer',
      builderCount: plan.builderCount,
      gathererCount: plan.gathererCount,
      assignments: {
        builders: plan.builderIds,
        foodGatherers: plan.foodGathererIds,
        woodGatherers: plan.woodGathererIds,
        foodNode: { id: plan.foodNode.id, x: plan.foodNode.x, z: plan.foodNode.z },
        woodNode: { id: plan.woodNode.id, x: plan.woodNode.x, z: plan.woodNode.z },
      },
      spawnPosition: { x: plan.spawn.x, z: plan.spawn.z },
      startingStock: { food: startStates[team].food[team], wood: startStates[team].wood[team] },
      matchClockAtRoundStart: startStates[team].matchElapsedSeconds,
      orders: groupOrders,
      gathering: gather,
      construction: production.building,
      production: production.production,
      finalObservedStock: { food: endState.food[team], wood: endState.wood[team] },
    };
  }));

  for (const result of teamResults) {
    assert.equal(result.gathering.gatherers.length, result.gathererCount,
      'every assigned gatherer must be observed in range and carry its assigned resource');
    assert.equal(result.construction.buildersFirstObservedInRange.length, result.builderCount,
      'every assigned builder must be observed at the construction edge after order acceptance');
  }
  return { round: roundNumber, teamResults };
}

async function resetOpening(armySize) {
  const afterMessageIndexes = clients.map(client => client.messages.length - 1);
  clients[0].send({ type: 'reset' });
  await Promise.all(clients.map((client, team) => client.waitForStateAfterMessage(state => (
    state.mapId === fixtureMapId && state.armySize === armySize && state.winner === -1
      && state.buildings.length === 0 && state.food?.[team] === 150 && state.wood?.[team] === 250
      && ownUnits(state, team, 'worker').length === 4
      && ownUnits(state, team, 'infantry').length === 8
      && ownUnits(state, team, 'archer').length === 0
      && ownUnits(state, team).length === 12
  ), afterMessageIndexes[team])));
}

try {
  const healthDeadline = Date.now() + 15_000;
  let healthy = false;
  while (Date.now() < healthDeadline) {
    if (server.exitCode !== null) throw new Error('server exited: ' + serverLog);
    try {
      if ((await fetch('http://127.0.0.1:' + port + '/health')).ok) {
        healthy = true;
        break;
      }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal(healthy, true, 'server did not become healthy: ' + serverLog);
  const azure = createClient();
  const azureWelcome = await azure.waitForMessage(message => message.type === 'welcome');
  const ember = createClient();
  const emberWelcome = await ember.waitForMessage(message => message.type === 'welcome');
  assert.equal(azureWelcome.player.team, 0);
  assert.equal(emberWelcome.player.team, 1);

  const map = JSON.parse(mapSourceText);
  assert.equal(map.id, 'forked-vale', 'economy fixture must use Forked Vale geometry');
  map.id = fixtureMapId;
  map.name = 'GATHER BUILD OPENING';
  map.startingArmySize = 24;
  map.startingResources = { food: 150, wood: 250 };
  // Disable map-wide income while preserving Forked Vale's objective/timed-victory structure.
  map.triggers = map.triggers.map(trigger => ({ ...trigger, foodReward: 0, woodReward: 0 }));
  map.scenarioEvents = [];
  assert.ok(map.triggers.every(trigger => trigger.foodReward === 0 && trigger.woodReward === 0),
    'capture rewards must be disabled for bank-delta measurements');
  assert.equal(map.scenarioEvents.length, 0, 'scripted scenario events must be disabled');
  const afterPublish = clients.map(client => client.messages.length - 1);
  azure.send({ type: 'publishMap', map });
  const mapChanges = await Promise.all(clients.map((client, team) => client.waitForMessage(
    message => message.type === 'mapChange' && message.map?.id === fixtureMapId,
    afterPublish[team],
  )));
  for (const [team, change] of mapChanges.entries()) {
    assert.equal(change.state.armySize, 24);
    assert.equal(ownUnits(change.state, team, 'worker').length, 4);
    assert.equal(ownUnits(change.state, team, 'infantry').length, 8);
    assert.equal(ownUnits(change.state, team, 'archer').length, 0);
    assert.equal(ownUnits(change.state, team).length, 12);
    assert.equal(change.state.food[team], 150);
    assert.equal(change.state.wood[team], 250);
  }

  for (let index = 0; index < matrix.length; index++) {
    const round = await runRound(index + 1, matrix[index], map);
    completedRounds.push(round);
    await emitJsonLine({
      scenario: 'gather-build-opening',
      event: 'round-complete',
      baselineCommit,
      harnessCommit,
      mapSourceSha256,
      ...round,
    });
    if (index < matrix.length - 1) await resetOpening(24);
  }

  await emitJsonLine({
    scenario: 'gather-build-opening',
    event: 'complete',
    baselineCommit,
    harnessCommit,
    baseMap: path.relative(serverRoot, mapPath),
    mapSourceSha256,
    fixtureMap: fixtureMapId,
    startingArmySize: 24,
    startingResources: { food: 150, wood: 250 },
    builderGathererMatrix: 'counterbalanced across both teams and both building types',
    captureResourceRewardsDisabled: true,
    scriptedScenarioEventsDisabled: true,
    measurementNote: 'Raw match-clock milestones only; no balance timing threshold is asserted.',
    rounds: completedRounds,
  });
} catch (error) {
  await emitJsonLine({
    scenario: 'gather-build-opening',
    event: 'failed',
    baselineCommit,
    harnessCommit,
    mapSourceSha256,
    error: { name: error.name, message: error.message, stack: error.stack },
    completedRounds,
    latestTeamState: failureSnapshots(),
  }).catch(() => {});
  console.error(serverLog);
  throw error;
} finally {
  for (const client of clients) client.socket.close();
  if (server.exitCode === null && server.signalCode === null) {
    server.kill('SIGTERM');
    await once(server, 'exit').catch(() => {});
  }
  await rm(temporary, { recursive: true, force: true });
}
