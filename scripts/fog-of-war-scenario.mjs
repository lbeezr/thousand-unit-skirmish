import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const port = Number(process.argv[2] || 4178);
const endpoint = `ws://127.0.0.1:${port}/ws`;
const TIMEOUT_MS = 120_000;

function createClient() {
  const socket = new WebSocket(endpoint, ['rts-v1']);
  const messages = [];
  const messageWaiters = [];
  const stateWaiters = [];
  let latestState = null;
  socket.addEventListener('message', (event) => {
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    messages.push(message);
    if (message.type === 'welcome') latestState = message.state;
    else if (message.type === 'state') latestState = message;
    else if (message.type === 'mapChange') latestState = message.state;
    if (latestState) {
      for (let index = stateWaiters.length - 1; index >= 0; index--) {
        const waiter = stateWaiters[index];
        if (!waiter.predicate(latestState)) continue;
        stateWaiters.splice(index, 1);
        clearTimeout(waiter.timeout);
        waiter.resolve(latestState);
      }
    }
    for (let index = messageWaiters.length - 1; index >= 0; index--) {
      const waiter = messageWaiters[index];
      if (!waiter.predicate(message)) continue;
      messageWaiters.splice(index, 1);
      clearTimeout(waiter.timeout);
      waiter.resolve(message);
    }
  });
  function waitForMessage(predicate) {
    const existing = messages.find(predicate);
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const waiter = { predicate, resolve, reject, timeout: setTimeout(() => {
        messageWaiters.splice(messageWaiters.indexOf(waiter), 1);
        reject(new Error('Timed out waiting for a server message.'));
      }, TIMEOUT_MS) };
      messageWaiters.push(waiter);
    });
  }
  function waitForState(predicate) {
    if (latestState && predicate(latestState)) return Promise.resolve(latestState);
    return new Promise((resolve, reject) => {
      const waiter = { predicate, resolve, reject, timeout: setTimeout(() => {
        stateWaiters.splice(stateWaiters.indexOf(waiter), 1);
        reject(new Error('Timed out waiting for an authoritative state.'));
      }, TIMEOUT_MS) };
      stateWaiters.push(waiter);
    });
  }
  function waitForStateWithin(predicate, timeoutMs) {
    if (latestState && predicate(latestState)) return Promise.resolve(latestState);
    return new Promise((resolve) => {
      const waiter = { predicate, resolve, timeout: setTimeout(() => {
        const index = stateWaiters.indexOf(waiter);
        if (index >= 0) stateWaiters.splice(index, 1);
        resolve(null);
      }, timeoutMs) };
      stateWaiters.push(waiter);
    });
  }
  return { socket, waitForMessage, waitForState, waitForStateWithin, getLatestState: () => latestState };
}

function send(socket, message) {
  socket.send(JSON.stringify(message));
}

function unitById(state, id) {
  return state.units.find((unit) => unit[0] === id);
}

async function close(socket) {
  if (socket.readyState === WebSocket.CLOSED) return;
  await new Promise((resolve) => {
    socket.addEventListener('close', resolve, { once: true });
    socket.close(1000, 'fog of war scenario complete');
  });
}

const clients = [];
try {
  const azure = createClient();
  clients.push(azure);
  const azureWelcome = await azure.waitForMessage((message) => message.type === 'welcome');
  assert.equal(azureWelcome.player.team, 0);
  const ember = createClient();
  clients.push(ember);
  const emberWelcome = await ember.waitForMessage((message) => message.type === 'welcome');
  assert.equal(emberWelcome.player.team, 1);

  const base = JSON.parse(await readFile(new URL('../maps/open-field.json', import.meta.url), 'utf8'));
  const map = {
    ...base,
    id: 'fog-visibility-scenario',
    name: 'FOG VISIBILITY SCENARIO',
    spawnPoints: [{ team: 0, x: -14, z: 0 }, { team: 1, x: 14, z: 0 }],
    resourceNodes: [{ id: 'vision-wood', type: 'wood', x: -14, z: 4, stock: 600 }],
    obstacles: [
      {
        id: 'sight-blocking-ridge', column: 31, row: 25, width: 2, height: 14,
        elevation: 1.2, material: 'stone',
      },
      { id: 'low-outcrop', column: 37, row: 32, width: 1, height: 1, elevation: 0.72, material: 'stone' },
      { id: 'clear-water-channel', column: 38, row: 29, width: 1, height: 6, material: 'water' },
    ],
    triggers: [],
    fogOfWar: true,
  };
  const mapPublished = azure.waitForMessage((message) => message.type === 'mapPublished'
    && message.mapId === map.id);
  const mapChanges = [azure, ember].map((client) => client.waitForMessage((message) => (
    message.type === 'mapChange' && message.map.id === map.id
  )));
  send(azure.socket, { type: 'publishMap', map });
  await Promise.all([mapPublished, ...mapChanges]);

  const initialStates = [azure, ember].map((client) => client.waitForState((state) => (
    state.mapId === map.id && state.armySize === 250 && state.winner === -1
  )));
  send(azure.socket, { type: 'selectArmySize', count: 250 });
  const [azureInitial, emberInitial] = await Promise.all(initialStates);
  assert.equal(azureInitial.fogOfWar, true);
  assert.equal(emberInitial.fogOfWar, true);
  assert.equal(azureInitial.visibility.columns, 64);
  assert.match(azureInitial.visibility.data, /^[A-Za-z0-9+/]+=*$/);
  assert.ok(azureInitial.units.every((unit) => unit[1] === 0),
    'Azure receives its own units but no enemies outside sight');
  assert.ok(emberInitial.units.every((unit) => unit[1] === 1),
    'Ember receives its own units but no enemies outside sight');
  assert.deepEqual(azureInitial.alive, [125, null], 'hidden enemy survival count is withheld');
  assert.deepEqual(emberInitial.alive, [null, 125]);
  assert.deepEqual(azureInitial.food, [0, null], 'enemy resource totals are withheld');
  assert.equal(azureInitial.workerProduction[0]?.team, 0, 'Azure can inspect its Town Center queue');
  assert.equal(azureInitial.workerProduction[1], null, 'Azure cannot inspect Ember Town Center production');
  assert.equal(emberInitial.workerProduction[0], null, 'Ember cannot inspect Azure Town Center production');
  assert.equal(emberInitial.workerProduction[1]?.team, 1, 'Ember can inspect its Town Center queue');

  const hiddenTargetRejected = azure.waitForMessage((message) => message.type === 'notice'
    && message.message === 'ATTACK REJECTED · TARGET UNAVAILABLE' && message.clientOrderToken === 1);
  send(azure.socket, { type: 'attack', ids: [0], targetId: 125, clientOrderToken: 1 });
  await hiddenTargetRejected;
  const nonexistentTargetRejected = azure.waitForMessage((message) => message.type === 'notice'
    && message.message === 'ATTACK REJECTED · TARGET UNAVAILABLE' && message.clientOrderToken === 2);
  send(azure.socket, { type: 'attack', ids: [0], targetId: 9999, clientOrderToken: 2 });
  await nonexistentTargetRejected;

  const azureAtRidge = azure.waitForState((state) => {
    const scout = unitById(state, 0);
    return state.mapId === map.id && scout && Math.abs(scout[2] + 4) < 1
      && !state.units.some((unit) => unit[1] === 1);
  });
  const emberAtRidge = ember.waitForState((state) => {
    const scout = unitById(state, 125);
    return state.mapId === map.id && scout && Math.abs(scout[2] - 2) < 1
      && !state.units.some((unit) => unit[1] === 0);
  });
  const azureInfantryAtRidge = azure.waitForState((state) => {
    const infantry = unitById(state, 4);
    return state.mapId === map.id && infantry && Math.abs(infantry[2] + 2) < 1;
  });
  send(ember.socket, { type: 'move', ids: [125], x: 2, z: 0, clientOrderToken: 3 });
  send(azure.socket, { type: 'move', ids: [0], x: -4, z: 0, clientOrderToken: 4 });
  send(azure.socket, { type: 'move', ids: [4], x: -2, z: 0, clientOrderToken: 11 });
  const [azureHiddenByRidge, emberHiddenByRidge] = await Promise.all([
    azureAtRidge, emberAtRidge, azureInfantryAtRidge,
  ]);
  assert.equal(azureHiddenByRidge.units.some((unit) => unit[1] === 1), false,
    'a stone ridge blocks sight even when an enemy is within the normal radius');
  assert.equal(emberHiddenByRidge.units.some((unit) => unit[1] === 0), false,
    'shared vision respects the same terrain line-of-sight blocker');

  const targetHpBeforeHiddenAttackMove = unitById(ember.getLatestState(), 125)[4];
  const hiddenAttackMoveApplied = azure.waitForMessage((message) => message.type === 'notice'
    && message.message.startsWith('ATTACK MOVE ORDER') && message.clientOrderToken === 12);
  const noDamageWhileOccluded = ember.waitForStateWithin((state) => (
    unitById(state, 125)?.[4] < targetHpBeforeHiddenAttackMove
  ), 2500);
  send(azure.socket, { type: 'attackMove', ids: [4], x: -2, z: 0, clientOrderToken: 12 });
  await hiddenAttackMoveApplied;
  const hiddenAttackDamage = await noDamageWhileOccluded;
  assert.equal(hiddenAttackDamage, null,
    'attack-move must not acquire or damage an enemy hidden behind a ridge inside its acquisition radius');
  assert.equal(unitById(ember.getLatestState(), 125)[4], targetHpBeforeHiddenAttackMove,
    'the hidden target keeps its health while the attack-move unit remains on the other side of the ridge');

  const cancelHiddenAttackMove = azure.waitForMessage((message) => message.type === 'notice'
    && message.message.startsWith('MOVE ORDER') && message.clientOrderToken === 13);
  send(azure.socket, { type: 'move', ids: [4], x: -14, z: 0, clientOrderToken: 13 });
  await cancelHiddenAttackMove;

  const azureSeesEnemy = azure.waitForState((state) => state.mapId === map.id
    && state.units.some((unit) => unit[1] === 1));
  const emberSeesAzure = ember.waitForState((state) => state.mapId === map.id
    && state.units.some((unit) => unit[1] === 0));
  send(azure.socket, { type: 'move', ids: [0], x: 4, z: 0 });
  const [azureRevealed, emberRevealed] = await Promise.all([azureSeesEnemy, emberSeesAzure]);
  assert.ok(azureRevealed.units.some((unit) => unit[1] === 1),
    'moving an Azure scout into range reveals Ember units to Azure');
  assert.ok(emberRevealed.units.some((unit) => unit[1] === 0),
    'vision is shared with the opposing team when the Azure scout is within Ember sight');
  assert.equal(azureRevealed.alive[1], null, 'seeing some enemies does not reveal the hidden total');
  assert.ok(azureRevealed.units.filter((unit) => unit[1] === 1).length < 125,
    'only currently visible enemy units are sent');

  const emberScoutAtBuildDistance = ember.waitForState((state) => {
    const scout = unitById(state, 125);
    return state.mapId === map.id && scout && Math.abs(scout[2] - 8) < 1;
  });
  const emberStillVisibleAcrossWater = azure.waitForState((state) => {
    const scout = state.units.find((unit) => unit[0] === 125 && unit[1] === 1);
    return state.mapId === map.id && scout && Math.abs(scout[2] - 8) < 1;
  });
  send(ember.socket, { type: 'move', ids: [125], x: 8, z: 0 });
  await Promise.all([emberScoutAtBuildDistance, emberStillVisibleAcrossWater]);

  const gatherOrder = azure.waitForMessage((message) => message.type === 'notice'
    && message.message === 'GATHER ORDER · 4 WORKERS' && message.clientOrderToken === 5);
  const enoughWood = azure.waitForState((state) => state.mapId === map.id && state.wood?.[0] >= 150);
  send(azure.socket, { type: 'gather', ids: [0, 1, 2, 3], nodeId: 'vision-wood', clientOrderToken: 5 });
  await Promise.all([gatherOrder, enoughWood]);

  const rangePlaced = azure.waitForMessage((message) => message.type === 'notice'
    && message.message === 'ARCHERY RANGE PLACED · WORKERS BUILDING' && message.clientOrderToken === 6);
  const rangeComplete = azure.waitForState((state) => state.mapId === map.id
    && state.buildings.some((building) => building.team === 0
      && building.type === 'archery-range' && building.complete));
  send(azure.socket, {
    type: 'build', ids: [0, 1, 2, 3], buildingType: 'archery-range', x: 2, z: 0, clientOrderToken: 6,
  });
  await Promise.all([rangePlaced, rangeComplete]);

  const workersReturnedToBase = azure.waitForState((state) => {
    const workers = [0, 1, 2, 3].map((id) => unitById(state, id));
    const range = state.buildings.find((building) => building.team === 0
      && building.type === 'archery-range' && building.complete);
    return state.mapId === map.id && range
      && workers.every((worker) => worker && Math.hypot(worker[2] + 14, worker[3]) < 5)
      && state.units.some((unit) => unit[0] === 125 && unit[1] === 1);
  });
  const workersReturnOrder = azure.waitForMessage((message) => message.type === 'notice'
    && message.message.startsWith('MOVE ORDER') && message.clientOrderToken === 7);
  send(azure.socket, { type: 'move', ids: [0, 1, 2, 3], x: -14, z: 0, clientOrderToken: 7 });
  const [buildingVisionState] = await Promise.all([workersReturnedToBase, workersReturnOrder]);
  assert.ok(buildingVisionState.units.some((unit) => unit[0] === 125 && unit[1] === 1),
    'a completed archery range continues revealing nearby enemies after its builders leave');
  assert.equal(buildingVisionState.alive[1], null, 'building vision still does not reveal enemy force totals');

  const enemyWorkerMoving = ember.waitForMessage((message) => message.type === 'notice'
    && message.message.startsWith('MOVE ORDER') && message.clientOrderToken === 8);
  const azureSeesEnemyWorker = azure.waitForState((state) => state.mapId === map.id
    && state.units.some((unit) => unit[0] === 126 && unit[1] === 1 && unit[5] === 'worker'));
  send(ember.socket, { type: 'move', ids: [126], x: 4, z: 5, clientOrderToken: 8 });
  const [enemyWorkerMoveAck, enemyWorkerVisibleState] = await Promise.all([
    enemyWorkerMoving, azureSeesEnemyWorker,
  ]);
  assert.equal(enemyWorkerMoveAck.type, 'notice');
  const visibleEnemyWorker = unitById(enemyWorkerVisibleState, 126);
  assert.equal(visibleEnemyWorker?.[9], null,
    'fog-of-war snapshots must withhold the visible enemy worker task');
  const friendlyWorkerTasks = enemyWorkerVisibleState.units
    .filter((unit) => unit[1] === 0 && unit[5] === 'worker');
  assert.ok(friendlyWorkerTasks.length > 0
    && friendlyWorkerTasks.every((unit) => ['idle', 'moving', 'gathering', 'returning', 'building', 'attacking'].includes(unit[9])),
  'fog-of-war snapshots should retain task status for friendly workers');

  console.log(JSON.stringify({
    passed: ['team-specific snapshots', 'enemy count/resource redaction', 'Town Center production privacy', 'hidden-target rejection without ID probing', 'tall ridge occlusion', 'shared sight reveal', 'attack-move fog filtering', 'low outcrop visibility', 'water transparency', 'building sight after builders retreat', 'worker task status privacy'],
    visibleEmberUnits: azureRevealed.units.filter((unit) => unit[1] === 1).length,
    totalEmberUnits: 125,
  }, null, 2));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await Promise.all(clients.map((client) => close(client.socket).catch(() => {})));
}
