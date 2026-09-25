import assert from 'node:assert/strict';

const port = Number(process.argv[2] || 4174);
const endpoint = `ws://127.0.0.1:${port}/ws`;
const TIMEOUT_MS = 35_000;

function createFeed(socket) {
  const feed = { latest: null, waiters: [] };
  socket.addEventListener('message', (event) => {
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    if (message.type === 'state') {
      feed.latest = message;
      for (let index = feed.waiters.length - 1; index >= 0; index--) {
        const waiter = feed.waiters[index];
        if (!waiter.predicate(message)) continue;
        feed.waiters.splice(index, 1);
        clearTimeout(waiter.timeout);
        waiter.resolve(message);
      }
    }
    for (const waiter of socket._scenarioMessageWaiters || []) {
      if (!waiter.predicate(message)) continue;
      socket._scenarioMessageWaiters.splice(socket._scenarioMessageWaiters.indexOf(waiter), 1);
      clearTimeout(waiter.timeout);
      waiter.resolve(message);
      break;
    }
  });
  socket._scenarioMessageWaiters = [];
  return feed;
}

function waitForState(feed, predicate, timeoutMs = TIMEOUT_MS) {
  if (feed.latest && predicate(feed.latest)) return Promise.resolve(feed.latest);
  return new Promise((resolve, reject) => {
    const waiter = {
      predicate,
      resolve,
      timeout: setTimeout(() => {
        feed.waiters.splice(feed.waiters.indexOf(waiter), 1);
        reject(new Error(`Timed out waiting for an authoritative state after tick ${feed.latest?.tick ?? 'unknown'}`));
      }, timeoutMs),
    };
    feed.waiters.push(waiter);
  });
}

function waitForMessage(socket, predicate, timeoutMs = 10_000) {
  return new Promise((resolve, reject) => {
    const waiter = {
      predicate,
      resolve,
      timeout: setTimeout(() => {
        socket._scenarioMessageWaiters.splice(socket._scenarioMessageWaiters.indexOf(waiter), 1);
        reject(new Error('Timed out waiting for a server message'));
      }, timeoutMs),
    };
    socket._scenarioMessageWaiters.push(waiter);
  });
}

function send(socket, message) {
  socket.send(JSON.stringify(message));
}

function unitById(state, id) {
  return state.units.find((row) => row[0] === id);
}

function waitForOrder(socket, prefix) {
  return waitForMessage(socket, (message) => message.type === 'notice'
    && message.message?.startsWith(prefix));
}

async function connectClient() {
  const socket = new WebSocket(endpoint);
  const state = createFeed(socket);
  const welcome = await waitForMessage(socket, (message) => message.type === 'welcome');
  return { socket, state, welcome };
}

async function close(socket) {
  if (socket.readyState === WebSocket.CLOSED) return;
  await new Promise((resolve) => {
    socket.addEventListener('close', resolve, { once: true });
    socket.close(1000, 'attack-move scenario complete');
  });
}

const clients = [];
try {
  const azure = await connectClient();
  clients.push(azure.socket);
  const ember = await connectClient();
  clients.push(ember.socket);
  assert.equal(azure.welcome.player.team, 0, 'first client should claim Azure');
  assert.equal(ember.welcome.player.team, 1, 'second client should claim Ember');

  const azureSmallArmy = waitForState(azure.state, (state) => state.armySize === 250);
  const emberSmallArmy = waitForState(ember.state, (state) => state.armySize === 250);
  send(azure.socket, { type: 'selectArmySize', count: 250 });
  const [resetState] = await Promise.all([azureSmallArmy, emberSmallArmy]);
  assert.equal(resetState.units.length, 250);

  const firstEnemyMove = waitForOrder(ember.socket, 'MOVE ORDER');
  send(ember.socket, { type: 'move', ids: [125], x: -8, z: 12 });
  await firstEnemyMove;
  await waitForState(azure.state, (state) => {
    const enemy = unitById(state, 125);
    return enemy && Math.hypot(enemy[2] + 7.5, enemy[3] - 12.5) < 1;
  });

  const firstDestination = { x: -5, z: 12 };
  const firstOrder = waitForOrder(azure.socket, 'ATTACK MOVE ORDER');
  const firstOrderStartedAt = Date.now();
  send(azure.socket, { type: 'attackMove', ids: [0], ...firstDestination });
  await firstOrder;
  const damagedState = await waitForState(azure.state, (state) => unitById(state, 125)?.[4] < 100);
  const damagedTargetIds = [125];
  assert.ok(unitById(damagedState, 125)[4] < 100,
    'attack-move should acquire and damage a reachable enemy');

  const destroyedState = await waitForState(azure.state, (state) => damagedTargetIds.some(
    (id) => unitById(state, id)?.[4] === 0,
  ));
  const resumedState = await waitForState(azure.state, (state) => {
    const unit = unitById(state, 0);
    return unit && Math.hypot(unit[2] + 4.5, unit[3] - 12.5) < 1.4
      && damagedTargetIds.some((id) => unitById(state, id)?.[4] === 0);
  });
  assert.ok(resumedState.tick > destroyedState.tick,
    'the unit should keep advancing after its acquired target dies');
  const firstOrderSeconds = Number(((Date.now() - firstOrderStartedAt) / 1000).toFixed(2));

  const secondEnemyMove = waitForOrder(ember.socket, 'MOVE ORDER');
  send(ember.socket, { type: 'move', ids: [126], x: -8, z: -12 });
  await secondEnemyMove;
  await waitForState(azure.state, (state) => {
    const enemy = unitById(state, 126);
    return enemy && Math.hypot(enemy[2] + 7.5, enemy[3] + 11.5) < 1;
  });

  const secondOrder = waitForOrder(azure.socket, 'ATTACK MOVE ORDER');
  send(azure.socket, { type: 'attackMove', ids: [1], x: -5, z: -12 });
  await secondOrder;
  const cancelledTargetState = await waitForState(azure.state, (state) => unitById(state, 126)?.[4] > 0
    && unitById(state, 126)?.[4] < 100);
  const manualMove = waitForOrder(azure.socket, 'MOVE ORDER');
  send(azure.socket, { type: 'move', ids: [1], x: -26, z: 8 });
  await manualMove;
  const stateAfterOverride = azure.state.latest;
  const targetHpAtOverride = new Map(stateAfterOverride.units
    .filter((row) => row[1] === 1).map((row) => [row[0], row[4]]));
  const unitAtOverride = unitById(stateAfterOverride, 1);
  const settledOverrideState = await waitForState(azure.state, (state) => (
    state.tick >= stateAfterOverride.tick + 45
  ));
  for (const [id, hp] of targetHpAtOverride) {
    assert.equal(unitById(settledOverrideState, id)?.[4], hp,
      'a manual move should cancel attack-move combat immediately');
  }
  const movedUnit = unitById(settledOverrideState, 1);
  assert.ok(movedUnit[2] < unitAtOverride[2] - 1,
    'the manually reordered unit should move toward its new destination');

  const thirdOrder = waitForOrder(azure.socket, 'ATTACK MOVE ORDER');
  send(azure.socket, { type: 'attackMove', ids: [2], x: -5, z: -12 });
  await thirdOrder;
  const hpBeforeLeashEngagement = unitById(azure.state.latest, 126)[4];
  await waitForState(azure.state, (state) => unitById(state, 126)?.[4] < hpBeforeLeashEngagement);
  const fleeingEnemyMove = waitForOrder(ember.socket, 'MOVE ORDER');
  send(ember.socket, { type: 'move', ids: [126], x: -26, z: -12 });
  await fleeingEnemyMove;
  const leashResumedState = await waitForState(azure.state, (state) => {
    const attacker = unitById(state, 2);
    return attacker && Math.hypot(attacker[2] + 4.5, attacker[3] + 11.5) < 1.5;
  });

  console.log(JSON.stringify({
    workload: 'attack-move behavior with two online clients',
    armySize: resetState.armySize,
    acquiredAndDestroyedEnemyIds: damagedTargetIds,
    resumedAtDestination: {
      x: unitById(resumedState, 0)[2], z: unitById(resumedState, 0)[3],
      ticksAfterTargetDeath: resumedState.tick - destroyedState.tick,
    },
    firstOrderSeconds,
    manualMoveCancelledCombat: true,
    manualMovePosition: { x: movedUnit[2], z: movedUnit[3] },
    manualMoveTargetHpUnchanged: true,
    leashBreakResumedOriginalRoute: true,
    leashBreakRoutePosition: {
      x: unitById(leashResumedState, 2)[2], z: unitById(leashResumedState, 2)[3],
    },
  }, null, 2));
} finally {
  await Promise.all(clients.map(close));
}
