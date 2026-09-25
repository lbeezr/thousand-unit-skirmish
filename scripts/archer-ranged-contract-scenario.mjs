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
const serverRoot = process.env.RTS_SERVER_ROOT || root;
const mapPath = process.env.RTS_ARCHER_MAP || path.join(serverRoot, 'maps/open-field.json');
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
const fixtureMapId = 'archer-ranged-contract';
const temporary = await mkdtemp(path.join(os.tmpdir(), 'rts-archer-range-'));
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

const clients = [];
const EVENT_TIMEOUT_MS = 90_000;
const MELEE_ATTACK_RANGE = 1.28;
const ARCHER_ATTACK_RANGE = 4.5;
const EXPECTED_ARCHER_DAMAGE = 7;
const STARTING_FOOD = 600;
const STARTING_WOOD = 600;
const ARCHERY_RANGE_WOOD_COST = 150;
const ARCHER_FOOD_COST = 25;
const ARCHER_WOOD_COST = 45;
let nextOrderToken = 1;

function createClient() {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`, ['rts-v1']);
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
            reject(new Error(`message timeout: ${JSON.stringify(this.messages.slice(-6))}`));
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
            reject(new Error(`state timeout: ${JSON.stringify(this.states.slice(-6))}`));
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
            reject(new Error(`post-order state timeout: ${JSON.stringify(this.states.slice(-6))}`));
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
    const state = message.type === 'state'
      ? message
      : ['welcome', 'mapChange'].includes(message.type) ? message.state : null;
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

function ownUnits(state, team, kind) {
  return state.units.filter(unit => unit[1] === team && unit[4] > 0
    && (kind === undefined || unit[5] === kind));
}

function unitById(state, id) {
  return state.units.find(unit => unit[0] === id) ?? null;
}

function buildingForTeam(state, team) {
  return state.buildings.find(building => building.team === team
    && building.type === 'archery-range') ?? null;
}

function distance(x1, z1, x2, z2) {
  return Math.hypot(x1 - x2, z1 - z2);
}

async function issueTrackedOrder(client, command, expectedPrefix) {
  const afterMessageIndex = client.messages.length - 1;
  const token = nextOrderToken++;
  client.send({ ...command, clientOrderToken: token });
  const notice = await client.waitForMessage(message => message.type === 'notice'
    && message.clientOrderToken === token, afterMessageIndex);
  assert.ok(notice.message.startsWith(expectedPrefix),
    `expected ${expectedPrefix} order acknowledgement, received ${notice.message}`);
  assert.ok(!/REJECTED|UNREACHABLE|FAILED|SUPERSEDED/i.test(notice.message),
    `order failed: ${notice.message}`);
  return {
    token,
    message: notice.message,
    noticeMessageIndex: client.messages.indexOf(notice),
  };
}

async function waitForHealthyServer() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`server exited: ${serverLog}`);
    try {
      if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`server did not become healthy: ${serverLog}`);
}

function latestFailureState() {
  return clients.map((client, team) => {
    const state = client.latestState();
    return {
      team,
      matchClockSeconds: state?.matchElapsedSeconds ?? null,
      tick: state?.tick ?? null,
      food: state?.food?.[team] ?? null,
      wood: state?.wood?.[team] ?? null,
      units: state ? ownUnits(state, team).map(unit => ({
        id: unit[0], kind: unit[5], x: unit[2], z: unit[3], hp: unit[4],
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

try {
  await waitForHealthyServer();
  const azure = createClient();
  const azureWelcome = await azure.waitForMessage(message => message.type === 'welcome');
  const ember = createClient();
  const emberWelcome = await ember.waitForMessage(message => message.type === 'welcome');
  assert.equal(azureWelcome.player.team, 0);
  assert.equal(emberWelcome.player.team, 1);

  const map = JSON.parse(mapSourceText);
  assert.equal(map.id, 'open-field', 'ranged combat fixture uses Open Field geometry');
  map.id = fixtureMapId;
  map.name = 'ARCHER RANGED CONTRACT';
  map.summary = 'Mirrored Archer shots against idle infantry at controlled ranged distance.';
  map.fogOfWar = false;
  map.startingArmySize = 24;
  map.startingResources = { food: STARTING_FOOD, wood: STARTING_WOOD };
  map.spawnPoints = [
    { team: 0, x: -20, z: 0 },
    { team: 1, x: 20, z: 0 },
  ];
  map.resourceNodes = [];
  map.obstacles = [];
  map.triggers = [];
  map.scenarioEvents = [];

  const publicationBoundaries = clients.map(client => client.messages.length - 1);
  azure.send({ type: 'publishMap', map });
  const mapChanges = await Promise.all(clients.map((client, team) => client.waitForMessage(
    message => message.type === 'mapChange' && message.map?.id === fixtureMapId,
    publicationBoundaries[team],
  )));
  for (const [team, change] of mapChanges.entries()) {
    assert.equal(change.state.armySize, 24);
    assert.equal(ownUnits(change.state, team, 'worker').length, 4);
    assert.equal(ownUnits(change.state, team, 'infantry').length, 8);
    assert.equal(ownUnits(change.state, team, 'archer').length, 0);
    assert.equal(ownUnits(change.state, team).length, 12);
    assert.equal(change.state.food[team], STARTING_FOOD);
    assert.equal(change.state.wood[team], STARTING_WOOD);
  }

  const buildSiteByTeam = [
    { x: -15.5, z: 0.5 },
    { x: 15.5, z: 0.5 },
  ];
  const openings = clients.map((client, team) => {
    const state = client.latestState();
    const workers = ownUnits(state, team, 'worker');
    const site = buildSiteByTeam[team];
    const builderIds = [...workers]
      .sort((left, right) => distance(left[2], left[3], site.x, site.z)
        - distance(right[2], right[3], site.x, site.z))
      .slice(0, 2)
      .map(worker => worker[0]);
    assert.equal(builderIds.length, 2);
    return { team, site, builderIds, startTick: state.tick };
  });

  const buildOrders = await Promise.all(openings.map(opening => issueTrackedOrder(
    clients[opening.team],
    {
      type: 'build',
      buildingType: 'archery-range',
      ids: opening.builderIds,
      x: opening.site.x,
      z: opening.site.z,
    },
    'ARCHERY RANGE PLACED',
  )));
  const buildOrderByTeam = new Map(openings.map((opening, index) => [opening.team, buildOrders[index]]));
  const completedRanges = await Promise.all(openings.map(async opening => {
    const state = await clients[opening.team].waitForState(candidate => {
      const building = buildingForTeam(candidate, opening.team);
      return building?.complete === true;
    }, opening.startTick);
    const building = buildingForTeam(state, opening.team);
    assert.ok(building);
    assert.equal(state.food[opening.team], STARTING_FOOD,
      `team ${opening.team} should not spend food to place an Archery Range`);
    assert.equal(state.wood[opening.team], STARTING_WOOD - ARCHERY_RANGE_WOOD_COST,
      `team ${opening.team} should pay the Archery Range wood cost once`);
    return { opening, state, building };
  }));

  const production = await Promise.all(completedRanges.map(async ({ opening, state, building }) => {
    const client = clients[opening.team];
    const beforeMessageIndex = client.messages.length - 1;
    client.send({ type: 'trainArcher', buildingId: building.id });
    const queueNotice = await client.waitForMessage(message => message.type === 'notice'
      && (message.message.includes('ARCHER QUEUED')
        || /ARCHER TRAINING REJECTED/i.test(message.message)), beforeMessageIndex);
    assert.ok(queueNotice.message.includes('ARCHER QUEUED'),
      `team ${opening.team} Archer queue failed: ${queueNotice.message}`);
    const queueNoticeIndex = client.messages.indexOf(queueNotice);
    const queued = await client.waitForStateAfterMessage(candidate => {
      const current = candidate.buildings.find(row => row.id === building.id);
      return current?.queue > 0;
    }, queueNoticeIndex);
    assert.equal(queued.food[opening.team], STARTING_FOOD - ARCHER_FOOD_COST,
      `team ${opening.team} should pay the Archer food cost when queued`);
    assert.equal(queued.wood[opening.team], STARTING_WOOD - ARCHERY_RANGE_WOOD_COST - ARCHER_WOOD_COST,
      `team ${opening.team} should pay the Archer wood cost when queued`);
    const spawned = await client.waitForState(candidate => ownUnits(candidate, opening.team, 'archer').length === 1,
      queued.tick);
    const archer = ownUnits(spawned, opening.team, 'archer')[0];
    assert.ok(archer);
    assert.equal(spawned.food[opening.team], queued.food[opening.team],
      `team ${opening.team} food should not be charged again when the Archer spawns`);
    assert.equal(spawned.wood[opening.team], queued.wood[opening.team],
      `team ${opening.team} wood should not be charged again when the Archer spawns`);
    return {
      team: opening.team,
      buildingId: building.id,
      buildOrderToken: buildOrderByTeam.get(opening.team).token,
      buildOrder: buildOrderByTeam.get(opening.team).message,
      buildingCompleteAt: { tick: state.tick, matchClockSeconds: state.matchElapsedSeconds },
      resourcesAfterBuilding: { food: state.food[opening.team], wood: state.wood[opening.team] },
      queueNotice: queueNotice.message,
      queuedAt: { tick: queued.tick, matchClockSeconds: queued.matchElapsedSeconds },
      resourcesAfterQueue: { food: queued.food[opening.team], wood: queued.wood[opening.team] },
      resourcesAfterSpawn: { food: spawned.food[opening.team], wood: spawned.wood[opening.team] },
      archer,
      archerSpawnedAt: { tick: spawned.tick, matchClockSeconds: spawned.matchElapsedSeconds },
    };
  }));

  const productionByTeam = new Map(production.map(result => [result.team, result]));
  const infantryByTeam = clients.map((client, team) => ownUnits(client.latestState(), team, 'infantry'));
  const attackLanes = [
    {
      team: 0,
      targetTeam: 1,
      archerId: productionByTeam.get(0).archer[0],
      targetId: infantryByTeam[1][0][0],
      archerDestination: { x: -2.5, z: 5.5 },
      targetDestination: { x: 0.5, z: 5.5 },
    },
    {
      team: 1,
      targetTeam: 0,
      archerId: productionByTeam.get(1).archer[0],
      targetId: infantryByTeam[0][0][0],
      archerDestination: { x: 3.5, z: -4.5 },
      targetDestination: { x: 0.5, z: -4.5 },
    },
  ];
  const movementOrders = [];
  for (const [laneIndex, lane] of attackLanes.entries()) {
    movementOrders.push({ laneIndex, role: 'archer', clientTeam: lane.team,
      unitId: lane.archerId, destination: lane.archerDestination });
    movementOrders.push({ laneIndex, role: 'target', clientTeam: lane.targetTeam,
      unitId: lane.targetId, destination: lane.targetDestination });
  }
  const acceptedMoves = await Promise.all(movementOrders.map((order, index) => issueTrackedOrder(
    clients[order.clientTeam],
    { type: 'move', ids: [order.unitId], x: order.destination.x, z: order.destination.z },
    'PLANNING MOVE',
  ).then(acknowledgement => ({ ...order, ...acknowledgement, index }))));

  const stagingStartTick = Math.max(...clients.map(client => client.latestState().tick));
  const staged = await azure.waitForState(state => movementOrders.every(order => {
    const unit = unitById(state, order.unitId);
    return unit && distance(unit[2], unit[3], order.destination.x, order.destination.z) <= 0.25;
  }), stagingStartTick);
  for (const lane of attackLanes) {
    const archer = unitById(staged, lane.archerId);
    const target = unitById(staged, lane.targetId);
    assert.ok(archer && target);
    assert.ok(target[4] > 0);
    const stagedSeparation = distance(archer[2], archer[3], target[2], target[3]);
    assert.ok(stagedSeparation > MELEE_ATTACK_RANGE + 0.5,
      `team ${lane.team} must start outside melee range: ${stagedSeparation}`);
    assert.ok(stagedSeparation <= ARCHER_ATTACK_RANGE,
      `team ${lane.team} target must start within Archer range: ${stagedSeparation}`);
  }

  const attackStarts = attackLanes.map(lane => {
    const archer = unitById(staged, lane.archerId);
    const target = unitById(staged, lane.targetId);
    return {
      ...lane,
      startTick: staged.tick,
      hpBefore: target[4],
      archerPositionBefore: { x: archer[2], z: archer[3] },
      targetPositionBefore: { x: target[2], z: target[3] },
    };
  });
  const hitWaiters = attackStarts.map(lane => clients[lane.team].waitForState(state => {
    const archer = unitById(state, lane.archerId);
    const target = unitById(state, lane.targetId);
    return target && target[4] < lane.hpBefore
      && Number.isInteger(archer?.[11]) && archer[11] > lane.startTick
      && Number.isFinite(archer[12]) && Number.isFinite(archer[13]);
  }, lane.startTick));
  const attackOrders = await Promise.all(attackStarts.map(lane => issueTrackedOrder(
    clients[lane.team],
    { type: 'attack', ids: [lane.archerId], targetId: lane.targetId },
    'ATTACK ORDER',
  )));
  const firstHits = await Promise.all(hitWaiters);

  const results = attackStarts.map((lane, index) => {
    const state = firstHits[index];
    const archer = unitById(state, lane.archerId);
    const target = unitById(state, lane.targetId);
    assert.ok(archer && target);
    assert.ok(Number.isInteger(archer[11]) && archer[11] > lane.startTick,
      `team ${lane.team} hit must include a new server attack tick`);
    assert.ok(Number.isFinite(archer[12]) && Number.isFinite(archer[13]),
      `team ${lane.team} hit must expose its target position to the attacking seat`);
    const separationAtHit = distance(archer[2], archer[3], archer[12], archer[13]);
    assert.ok(separationAtHit > MELEE_ATTACK_RANGE + 0.5,
      `team ${lane.team} must damage from outside melee range: ${separationAtHit}`);
    assert.ok(separationAtHit <= ARCHER_ATTACK_RANGE + 0.05,
      `team ${lane.team} hit must remain within Archer range: ${separationAtHit}`);
    assert.equal(target[4], lane.hpBefore - EXPECTED_ARCHER_DAMAGE,
      `team ${lane.team} first shot should apply one base Archer hit`);
    return {
      team: lane.team,
      targetTeam: lane.targetTeam,
      archerId: lane.archerId,
      targetId: lane.targetId,
      attackOrder: {
        token: attackOrders[index].token,
        message: attackOrders[index].message,
      },
      firstHit: {
        tick: archer[11],
        matchClockSeconds: state.matchElapsedSeconds,
        archerPosition: { x: archer[2], z: archer[3] },
        recordedTargetPosition: { x: archer[12], z: archer[13] },
        separation: separationAtHit,
        meleeRange: MELEE_ATTACK_RANGE,
        archerRange: ARCHER_ATTACK_RANGE,
        targetHpBefore: lane.hpBefore,
        targetHpAfter: target[4],
      },
    };
  });

  for (const result of results) {
    const peerState = await clients[1 - result.team].waitForState(state => {
      const target = unitById(state, result.targetId);
      const archer = unitById(state, result.archerId);
      return target && target[4] < result.firstHit.targetHpBefore
        && Number.isInteger(archer?.[11]) && archer[11] === result.firstHit.tick;
    }, staged.tick);
    assert.equal(unitById(peerState, result.targetId)[4], result.firstHit.targetHpAfter,
      'both seats must observe the same first-hit damage');
  }

  console.log(JSON.stringify({
    baselineCommit,
    harnessCommit,
    scenario: 'archer-ranged-contract',
    fixtureMap: fixtureMapId,
    baseMap: path.relative(serverRoot, mapPath),
    mapSourceSha256,
    startingArmySize: 24,
    startingResources: { food: STARTING_FOOD, wood: STARTING_WOOD },
    fogOfWar: false,
    triggers: 'disabled',
    scenarioEvents: 'disabled',
    constructionAndProduction: production.map(({ archer, ...result }) => result),
    acceptedMoves: acceptedMoves.map(({ index, role, clientTeam, unitId, destination, token, message }) => ({
      index, role, clientTeam, unitId, destination, token, message,
    })),
    firstHits: results,
  }));
} catch (error) {
  console.error(JSON.stringify({
    baselineCommit,
    harnessCommit,
    scenario: 'archer-ranged-contract',
    mapSourceSha256,
    error: { name: error.name, message: error.message, stack: error.stack },
    latestTeamState: latestFailureState(),
  }));
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
