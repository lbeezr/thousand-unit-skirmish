import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const port = Number(process.argv[2] || 4174);
const endpoint = `ws://127.0.0.1:${port}/ws`;
const TIMEOUT_MS = 15_000;
let stage = 'connecting clients';

function createClient() {
  const socket = new WebSocket(endpoint);
  const messages = [];
  const messageWaiters = [];
  const stateWaiters = [];
  let latestState = null;
  socket.addEventListener('message', (event) => {
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    messages.push(message);
    if (message.type === 'state' || message.type === 'mapChange') {
      const state = message.type === 'mapChange' ? message.state : message;
      if (state?.type === 'state') {
        latestState = state;
        for (let index = stateWaiters.length - 1; index >= 0; index--) {
          const waiter = stateWaiters[index];
          if (!waiter.predicate(state)) continue;
          stateWaiters.splice(index, 1);
          clearTimeout(waiter.timeout);
          waiter.resolve(state);
        }
      }
    }
    for (let index = messageWaiters.length - 1; index >= 0; index--) {
      const waiter = messageWaiters[index];
      if (!waiter.predicate(message, messages.length - 1)) continue;
      messageWaiters.splice(index, 1);
      clearTimeout(waiter.timeout);
      waiter.resolve(message);
    }
  });
  function waitForMessage(predicate, afterIndex = -1) {
    const existing = messages.find((message, index) => index > afterIndex && predicate(message));
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const waiter = { predicate: (message, index) => index > afterIndex && predicate(message), resolve, timeout: setTimeout(() => {
        messageWaiters.splice(messageWaiters.indexOf(waiter), 1);
        reject(new Error(`Timed out waiting for a server message while ${stage}. Recent non-state messages: ${JSON.stringify(messages.filter(({ type }) => type !== 'state').slice(-8).map(({ type, message, mapId, triggerId, team }) => ({ type, message, mapId, triggerId, team })))}. Latest state: ${JSON.stringify(latestState && { mapId: latestState.mapId, tick: latestState.tick, winner: latestState.winner, units: latestState.units.length, objectives: latestState.objectives })}`));
      }, TIMEOUT_MS) };
      messageWaiters.push(waiter);
    });
  }
  function waitForState(predicate) {
    if (latestState && predicate(latestState)) return Promise.resolve(latestState);
    return new Promise((resolve, reject) => {
      const waiter = { predicate, resolve, timeout: setTimeout(() => {
        stateWaiters.splice(stateWaiters.indexOf(waiter), 1);
        reject(new Error('Timed out waiting for an authoritative state.'));
      }, TIMEOUT_MS) };
      stateWaiters.push(waiter);
    });
  }
  return {
    socket, waitForMessage, waitForState,
    getLatestState: () => latestState,
    getMessageCount: () => messages.length,
  };
}

function send(socket, message) {
  socket.send(JSON.stringify(message));
}

async function close(socket) {
  if (socket.readyState === WebSocket.CLOSED) return;
  await new Promise((resolve) => {
    socket.addEventListener('close', resolve, { once: true });
    socket.close(1000, 'trigger scenario complete');
  });
}

function findObjective(state, id) {
  return state.objectives.find((objective) => objective.id === id);
}

function unitsInZone(state, team, zone, width = 64, height = 64) {
  return state.units.filter((unit) => {
    if (unit[1] !== team || unit[4] <= 0) return false;
    const column = Math.floor(unit[2] + width / 2);
    const row = Math.floor(unit[3] + height / 2);
    return column >= zone.column && column < zone.column + zone.width
      && row >= zone.row && row < zone.row + zone.height;
  });
}

async function moveTeamOutOfZone({ clients, client, team, mapId, triggerId, zone }) {
  const current = client.getLatestState();
  const unitIds = unitsInZone(current, team, zone).map((unit) => unit[0]);
  if (unitIds.length === 0) return;
  const cleared = clients.map((observer) => observer.waitForState((state) => (
    state.mapId === mapId && findObjective(state, triggerId)?.owner === team
      && findObjective(state, triggerId)?.unitCounts?.[team] === 0
  )));
  send(client.socket, {
    type: 'move', ids: unitIds, x: team === 0 ? -10 : 10, z: 0,
  });
  await Promise.all(cleared);
}

function worldCenter(zone, width, height) {
  return {
    x: zone.column - width / 2 + zone.width / 2,
    z: zone.row - height / 2 + zone.height / 2,
  };
}

async function publishMap(azure, ember, map) {
  const published = azure.waitForMessage((message) => message.type === 'mapPublished'
    && message.mapId === map.id);
  const azureChanged = azure.waitForMessage((message) => message.type === 'mapChange'
    && message.map.id === map.id);
  const emberChanged = ember.waitForMessage((message) => message.type === 'mapChange'
    && message.map.id === map.id);
  send(azure.socket, { type: 'publishMap', map });
  const [publishedMessage, azureChange, emberChange] = await Promise.all([
    published, azureChanged, emberChanged,
  ]);
  assert.equal(publishedMessage.mapId, map.id);
  assert.equal(azureChange.map.victoryMode, map.victoryMode);
  assert.equal(emberChange.map.victoryMode, map.victoryMode,
    'the other client should receive the configured victory mode');
  const [azureState, emberState] = await Promise.all([
    azure.waitForState((state) => state.mapId === map.id && state.winner === -1),
    ember.waitForState((state) => state.mapId === map.id && state.winner === -1),
  ]);
  assert.equal(azureState.winnerTriggerId, null, 'a fresh match has no winning trigger');
  assert.equal(emberState.winnerTriggerId, null, 'the other client sees no winning trigger');
  assert.equal(azureState.winnerReason, null, 'a fresh match has no winner reason');
  assert.equal(emberState.winnerReason, null, 'the other client sees no winner reason');
  return { azureChange, emberChange, azureState, emberState };
}

async function moveAndCapture({ clients, mapId, orderClient, unitId, triggerId, zone, team, type }) {
  const beforeStates = clients.map((client) => client.getLatestState());
  const beforeMessageCounts = clients.map((client) => client.getMessageCount());
  assert.ok(beforeStates.every(Boolean), 'both clients need a current pre-capture state');
  const messageWaits = clients.map((client, index) => client.waitForMessage((message) => (
    message.type === type && message.triggerId === triggerId && message.team === team
  ), beforeMessageCounts[index] - 1));
  const stateWaits = clients.map((client) => client.waitForState((state) => {
    const objective = findObjective(state, triggerId);
    return state.mapId === mapId && objective?.owner === team
      && (type !== 'victory' || (state.winner === team && state.winnerTriggerId === triggerId
        && state.winnerReason === 'capture'));
  }));
  const target = worldCenter(zone, 64, 64);
  send(orderClient.socket, { type: 'move', ids: [unitId], ...target });
  const [messages, states] = await Promise.all([
    Promise.all(messageWaits), Promise.all(stateWaits),
  ]);
  return { messages, states, beforeStates };
}

const clients = [];
try {
  const azure = createClient();
  clients.push(azure);
  const welcome = await azure.waitForMessage((message) => message.type === 'welcome');
  assert.equal(welcome.player.team, 0, 'first client should claim Azure');
  const ember = createClient();
  clients.push(ember);
  const emberWelcome = await ember.waitForMessage((message) => message.type === 'welcome');
  assert.equal(emberWelcome.player.team, 1, 'second client should claim Ember');

  const sizeChanged = Promise.all([
    azure.waitForState((state) => state.armySize === 250),
    ember.waitForState((state) => state.armySize === 250),
  ]);
  send(azure.socket, { type: 'selectArmySize', count: 250 });
  await sizeChanged;

  const baseMap = JSON.parse(await readFile(new URL('../maps/stone-pass.json', import.meta.url), 'utf8'));
  const mapBase = {
    ...baseMap,
    obstacles: [],
    spawnPoints: [{ team: 0, x: -10, z: 0 }, { team: 1, x: 10, z: 0 }],
  };
  const zones = {
    north: { column: 30, row: 24, width: 1, height: 2 },
    center: { column: 30, row: 31, width: 1, height: 2 },
    south: { column: 30, row: 39, width: 1, height: 2 },
  };
  const trigger = (id, name, zone, options = {}) => ({
    id, name, type: 'capture-zone', zone: { ...zone }, requiredUnits: 1,
    captureSeconds: 0.5, ...options,
  });

  stage = 'rejecting a capture zone isolated from one team';
  const unreachableMap = {
    ...mapBase,
    id: 'trigger-unreachable-zone',
    name: 'TRIGGER UNREACHABLE ZONE',
    resourceNodes: [],
    obstacles: [{ column: 32, row: 0, width: 1, height: 64 }],
    triggers: [trigger('one-sided-zone', 'One-sided Zone', { column: 20, row: 30, width: 2, height: 2 })],
  };
  const unreachableRejected = azure.waitForMessage((message) => message.type === 'mapRejected'
    && /one-sided-zone.*team 1/i.test(message.message));
  send(azure.socket, { type: 'publishMap', map: unreachableMap });
  const unreachableRejection = await unreachableRejected;
  assert.match(unreachableRejection.message, /one-sided-zone/i,
    'the server should identify the inaccessible capture zone');
  assert.match(unreachableRejection.message, /team 1/i,
    'the server should identify which team cannot reach the zone');

  stage = 'rejecting an invalid victory mode';
  const invalidModeMap = {
    ...mapBase,
    id: 'trigger-invalid-mode',
    name: 'TRIGGER INVALID MODE',
    victoryMode: 'first',
    triggers: [trigger('mode-check', 'Mode Check', zones.center)],
  };
  const invalidMode = azure.waitForMessage((message) => message.type === 'mapRejected'
    && /victoryMode/i.test(message.message));
  send(azure.socket, { type: 'publishMap', map: invalidModeMap });
  const modeRejection = await invalidMode;
  assert.match(modeRejection.message, /victoryMode/i,
    'the server should reject an unsupported victory mode');

  stage = 'rejecting an invalid food reward';
  const invalidRewardMap = {
    ...mapBase,
    id: 'trigger-invalid-reward',
    name: 'TRIGGER INVALID REWARD',
    victoryMode: 'any',
    triggers: [trigger('invalid-reward', 'Invalid Reward', zones.center, { foodReward: 10001 })],
  };
  const invalidReward = azure.waitForMessage((message) => message.type === 'mapRejected'
    && /invalid scenario trigger/i.test(message.message));
  send(azure.socket, { type: 'publishMap', map: invalidRewardMap });
  await invalidReward;

  stage = 'rejecting an invalid wood reward';
  const invalidWoodMap = {
    ...mapBase,
    id: 'trigger-invalid-wood-reward',
    name: 'TRIGGER INVALID WOOD REWARD',
    victoryMode: 'any',
    triggers: [trigger('invalid-wood-reward', 'Invalid Wood Reward', zones.center, { woodReward: 10001 })],
  };
  const invalidWoodReward = azure.waitForMessage((message) => message.type === 'mapRejected'
    && /invalid scenario trigger/i.test(message.message));
  send(azure.socket, { type: 'publishMap', map: invalidWoodMap });
  await invalidWoodReward;

  for (const [invalidId, invalidTriggers, expectedMessage] of [
    ['missing-prerequisite', [
      trigger('gated-zone', 'Gated Zone', zones.center, { requires: 'missing-zone' }),
    ], /requires missing capture zone missing-zone/i],
    ['self-prerequisite', [
      trigger('self-zone', 'Self Zone', zones.center, { requires: 'self-zone' }),
    ], /cannot require itself/i],
    ['cyclic-prerequisites', [
      trigger('cycle-a', 'Cycle A', zones.center, { requires: 'cycle-b' }),
      trigger('cycle-b', 'Cycle B', zones.south, { requires: 'cycle-a' }),
    ], /prerequisite cycle/i],
    ['missing-multi-prerequisite', [
      trigger('multi-first', 'Multi First', zones.north),
      trigger('multi-child', 'Multi Child', zones.center, { requiresAll: ['multi-first', 'missing-zone'] }),
    ], /requires missing capture zone missing-zone/i],
    ['duplicate-multi-prerequisite', [
      trigger('multi-first', 'Multi First', zones.north),
      trigger('multi-child', 'Multi Child', zones.center, { requiresAll: ['multi-first', 'multi-first'] }),
    ], /same prerequisite more than once/i],
    ['short-multi-prerequisite', [
      trigger('multi-first', 'Multi First', zones.north),
      trigger('multi-child', 'Multi Child', zones.center, { requiresAll: ['multi-first'] }),
    ], /invalid scenario trigger/i],
    ['oversized-multi-prerequisite', [
      trigger('multi-child', 'Multi Child', zones.center, {
        requiresAll: Array.from({ length: 32 }, (_, index) => `gate-${index}`),
      }),
    ], /invalid scenario trigger/i],
    ['mixed-prerequisite-fields', [
      trigger('multi-first', 'Multi First', zones.north),
      trigger('multi-second', 'Multi Second', zones.south),
      trigger('multi-child', 'Multi Child', zones.center, {
        requires: 'multi-first', requiresAll: ['multi-first', 'multi-second'],
      }),
    ], /invalid scenario trigger/i],
    ['cycle-through-multi-prerequisite', [
      trigger('cycle-a', 'Cycle A', zones.center, { requiresAll: ['cycle-b', 'cycle-c'] }),
      trigger('cycle-b', 'Cycle B', zones.south, { requires: 'cycle-a' }),
      trigger('cycle-c', 'Cycle C', zones.north),
    ], /prerequisite cycle/i],
  ]) {
    stage = `rejecting ${invalidId}`;
    const rejected = azure.waitForMessage((message) => message.type === 'mapRejected'
      && expectedMessage.test(message.message));
    send(azure.socket, {
      type: 'publishMap',
      map: {
        ...mapBase,
        id: `trigger-${invalidId}`,
        name: `TRIGGER ${invalidId.toUpperCase()}`,
        triggers: invalidTriggers,
      },
    });
    await rejected;
  }

  stage = 'publishing a chained capture map';
  const chainMap = {
    ...mapBase,
    id: 'trigger-capture-chain',
    name: 'TRIGGER CAPTURE CHAIN',
    victoryMode: 'any',
    triggers: [
      trigger('chain-first', 'First Gate', zones.north),
      trigger('chain-second', 'Second Gate', zones.center, { requires: 'chain-first' }),
    ],
  };
  const chainPublished = await publishMap(azure, ember, chainMap);
  assert.equal(chainPublished.azureChange.map.triggers[1].requires, 'chain-first',
    'the server should synchronize a zone prerequisite to the publisher');
  assert.equal(chainPublished.emberChange.map.triggers[1].requires, 'chain-first',
    'the other client should receive the same zone prerequisite');
  assert.equal(chainPublished.azureChange.map.triggers[1].requiresAll, undefined,
    'legacy single prerequisites should keep the original map shape');
  assert.equal(findObjective(chainPublished.azureState, 'chain-second').requires, 'chain-first');
  assert.equal(findObjective(chainPublished.azureState, 'chain-second').requiredOwner, -1);

  stage = 'holding a locked zone without its prerequisite';
  const lockedTarget = worldCenter(zones.center, 64, 64);
  const beforeLockedOrder = azure.getLatestState().tick;
  send(azure.socket, { type: 'move', ids: [71], ...lockedTarget });
  const [azureLockedState, emberLockedState] = await Promise.all(clients.map((client) => client.waitForState((state) => (
    state.mapId === chainMap.id && state.tick > beforeLockedOrder
      && findObjective(state, 'chain-second')?.unitCounts?.[0] === 1
      && findObjective(state, 'chain-second')?.owner === -1
      && findObjective(state, 'chain-second')?.progress === 0
  ))));
  await new Promise((resolve) => setTimeout(resolve, 800));
  for (const state of [azureLockedState, emberLockedState, azure.getLatestState(), ember.getLatestState()]) {
    assert.equal(findObjective(state, 'chain-second').owner, -1,
      'a team cannot capture a gated zone before taking its prerequisite');
    assert.equal(findObjective(state, 'chain-second').progress, 0,
      'locked presence must not build capture progress');
  }

  stage = 'capturing the first gate to unlock the chain';
  await moveAndCapture({
    clients, mapId: chainMap.id, orderClient: azure, unitId: 71,
    triggerId: 'chain-first', zone: zones.north, team: 0, type: 'trigger',
  });
  assert.equal(findObjective(azure.getLatestState(), 'chain-second').requiredOwner, 0,
    'the second gate should unlock for the team that owns the first gate');

  stage = 'capturing the unlocked second gate';
  const chainedCapture = await moveAndCapture({
    clients, mapId: chainMap.id, orderClient: azure, unitId: 71,
    triggerId: 'chain-second', zone: zones.center, team: 0, type: 'trigger',
  });
  assert.ok(chainedCapture.states.every((state) => findObjective(state, 'chain-second').owner === 0),
    'the team holding the prerequisite can capture the next zone');

  stage = 'switching prerequisite control to Ember';
  await moveAndCapture({
    clients, mapId: chainMap.id, orderClient: ember, unitId: 125,
    triggerId: 'chain-first', zone: zones.north, team: 1, type: 'trigger',
  });
  assert.equal(findObjective(azure.getLatestState(), 'chain-second').owner, 0,
    'losing the prerequisite must not silently remove an already captured child zone');
  assert.equal(findObjective(azure.getLatestState(), 'chain-second').requiredOwner, 1,
    'the child zone should now be gated to Ember');

  stage = 'blocking Azure recapture without prerequisite control';
  await moveTeamOutOfZone({ clients, client: azure, team: 0,
    mapId: chainMap.id, triggerId: 'chain-second', zone: zones.center });
  send(azure.socket, { type: 'move', ids: [71], ...lockedTarget });
  const azureStillLocked = await Promise.all(clients.map((client) => client.waitForState((state) => (
    state.mapId === chainMap.id
      && findObjective(state, 'chain-second')?.unitCounts?.[0] === 1
      && findObjective(state, 'chain-second')?.owner === 0
      && findObjective(state, 'chain-second')?.requiredOwner === 1
      && findObjective(state, 'chain-second')?.progress === 0
  ))));
  await new Promise((resolve) => setTimeout(resolve, 800));
  for (const state of [...azureStillLocked, azure.getLatestState(), ember.getLatestState()]) {
    assert.equal(findObjective(state, 'chain-second').owner, 0,
      'the previous owner keeps control while the opponent holds its prerequisite');
    assert.equal(findObjective(state, 'chain-second').progress, 0,
      'the previous owner cannot progress a recapture without the prerequisite');
  }
  await moveTeamOutOfZone({ clients, client: azure, team: 0,
    mapId: chainMap.id, triggerId: 'chain-second', zone: zones.center });

  stage = 'capturing the gated zone as its prerequisite owner';
  const emberChainedCapture = await moveAndCapture({
    clients, mapId: chainMap.id, orderClient: ember, unitId: 125,
    triggerId: 'chain-second', zone: zones.center, team: 1, type: 'trigger',
  });
  assert.ok(emberChainedCapture.states.every((state) => findObjective(state, 'chain-second').owner === 1),
    'the new prerequisite owner should be able to capture the gated zone');

  stage = 'publishing a capture zone with two simultaneous prerequisites';
  const multiGateMap = {
    ...mapBase,
    id: 'trigger-capture-multi-gate',
    name: 'TRIGGER CAPTURE MULTI GATE',
    victoryMode: 'any',
    triggers: [
      trigger('multi-north', 'North Gate', zones.north),
      trigger('multi-south', 'South Gate', zones.south),
      trigger('multi-center', 'Central Stronghold', zones.center, {
        requiresAll: ['multi-north', 'multi-south'],
      }),
    ],
  };
  const multiGatePublished = await publishMap(azure, ember, multiGateMap);
  assert.deepEqual(multiGatePublished.azureChange.map.triggers[2].requiresAll, ['multi-north', 'multi-south'],
    'the server should synchronize every multi-zone prerequisite');
  assert.equal(multiGatePublished.azureChange.map.triggers[2].requires, undefined,
    'new multi-gates should not also emit the legacy single-gate field');
  for (const state of [multiGatePublished.azureState, multiGatePublished.emberState]) {
    assert.deepEqual(findObjective(state, 'multi-center').requiresAll, ['multi-north', 'multi-south']);
    assert.deepEqual(findObjective(state, 'multi-center').requiredOwners, [-1, -1],
      'the initial objective state should expose an owner for each required gate');
  }

  stage = 'holding a multi-gate zone while neither prerequisite is owned';
  const multiLockedTarget = worldCenter(zones.center, 64, 64);
  const beforeMultiLockedOrder = azure.getLatestState().tick;
  send(azure.socket, { type: 'move', ids: [71], ...multiLockedTarget });
  const [multiLockedAzure, multiLockedEmber] = await Promise.all(clients.map((client) => client.waitForState((state) => (
    state.mapId === multiGateMap.id && state.tick > beforeMultiLockedOrder
      && findObjective(state, 'multi-center')?.unitCounts?.[0] === 1
      && findObjective(state, 'multi-center')?.owner === -1
      && findObjective(state, 'multi-center')?.progress === 0
  ))));
  for (const state of [multiLockedAzure, multiLockedEmber]) {
    assert.deepEqual(findObjective(state, 'multi-center').requiredOwners, [-1, -1]);
  }
  await new Promise((resolve) => setTimeout(resolve, 800));
  assert.equal(findObjective(azure.getLatestState(), 'multi-center').progress, 0,
    'presence cannot progress an objective when no prerequisite is owned');

  stage = 'capturing the first prerequisite of a multi-gate zone';
  await moveAndCapture({
    clients, mapId: multiGateMap.id, orderClient: azure, unitId: 71,
    triggerId: 'multi-north', zone: zones.north, team: 0, type: 'trigger',
  });
  const ownersAfterFirstMultiGate = findObjective(azure.getLatestState(), 'multi-center').requiredOwners;
  assert.deepEqual(ownersAfterFirstMultiGate, [0, -1],
    'the objective snapshot should update just the first prerequisite owner');

  stage = 'capturing the second prerequisite of a multi-gate zone';
  await moveAndCapture({
    clients, mapId: multiGateMap.id, orderClient: azure, unitId: 71,
    triggerId: 'multi-south', zone: zones.south, team: 0, type: 'trigger',
  });
  assert.deepEqual(findObjective(azure.getLatestState(), 'multi-center').requiredOwners, [0, 0],
    'both prerequisites should be owned before the child becomes capturable');

  stage = 'capturing a multi-gate zone after both prerequisites are owned';
  const multiCapture = await moveAndCapture({
    clients, mapId: multiGateMap.id, orderClient: azure, unitId: 71,
    triggerId: 'multi-center', zone: zones.center, team: 0, type: 'trigger',
  });
  assert.ok(multiCapture.states.every((state) => findObjective(state, 'multi-center').owner === 0),
    'the team holding all prerequisites can capture the child zone');

  stage = 'blocking recapture after losing one prerequisite';
  await moveAndCapture({
    clients, mapId: multiGateMap.id, orderClient: ember, unitId: 125,
    triggerId: 'multi-north', zone: zones.north, team: 1, type: 'trigger',
  });
  await moveTeamOutOfZone({ clients, client: azure, team: 0,
    mapId: multiGateMap.id, triggerId: 'multi-center', zone: zones.center });
  send(azure.socket, { type: 'move', ids: [71], ...multiLockedTarget });
  const azureMissingFirstGate = await Promise.all(clients.map((client) => client.waitForState((state) => (
    state.mapId === multiGateMap.id
      && findObjective(state, 'multi-center')?.unitCounts?.[0] === 1
      && findObjective(state, 'multi-center')?.owner === 0
      && findObjective(state, 'multi-center')?.requiredOwners?.[0] === 1
      && findObjective(state, 'multi-center')?.requiredOwners?.[1] === 0
      && findObjective(state, 'multi-center')?.progress === 0
  ))));
  await new Promise((resolve) => setTimeout(resolve, 800));
  assert.ok([...azureMissingFirstGate, azure.getLatestState(), ember.getLatestState()].every((state) => (
    findObjective(state, 'multi-center').owner === 0 && findObjective(state, 'multi-center').progress === 0
  )), 'losing one of two prerequisites blocks a recapture even while the other remains held');
  await moveTeamOutOfZone({ clients, client: azure, team: 0,
    mapId: multiGateMap.id, triggerId: 'multi-center', zone: zones.center });

  stage = 'blocking the new prerequisite owner until the second gate is also theirs';
  const beforeEmberLockedChild = ember.getLatestState().tick;
  send(ember.socket, { type: 'move', ids: [125], ...multiLockedTarget });
  const emberMissingSecondGate = await Promise.all(clients.map((client) => client.waitForState((state) => (
    state.mapId === multiGateMap.id && state.tick > beforeEmberLockedChild
      && findObjective(state, 'multi-center')?.unitCounts?.[1] === 1
      && findObjective(state, 'multi-center')?.owner === 0
      && findObjective(state, 'multi-center')?.requiredOwners?.[0] === 1
      && findObjective(state, 'multi-center')?.requiredOwners?.[1] === 0
      && findObjective(state, 'multi-center')?.progress === 0
  ))));
  await new Promise((resolve) => setTimeout(resolve, 800));
  assert.ok([...emberMissingSecondGate, azure.getLatestState(), ember.getLatestState()].every((state) => (
    findObjective(state, 'multi-center').owner === 0 && findObjective(state, 'multi-center').progress === 0
  )), 'the new owner of one prerequisite still cannot capture the child without the other');

  stage = 'unlocking the multi-gate zone after Ember owns both prerequisites';
  await moveAndCapture({
    clients, mapId: multiGateMap.id, orderClient: ember, unitId: 125,
    triggerId: 'multi-south', zone: zones.south, team: 1, type: 'trigger',
  });
  assert.deepEqual(findObjective(azure.getLatestState(), 'multi-center').requiredOwners, [1, 1]);
  const emberMultiCapture = await moveAndCapture({
    clients, mapId: multiGateMap.id, orderClient: ember, unitId: 125,
    triggerId: 'multi-center', zone: zones.center, team: 1, type: 'trigger',
  });
  assert.ok(emberMultiCapture.states.every((state) => findObjective(state, 'multi-center').owner === 1),
    'the team that takes every prerequisite can recapture the child zone');

  for (const [invalidId, fields] of [
    ['too-many-units', { unitCount: 26, unitKind: 'infantry' }],
    ['invalid-unit-kind', { unitCount: 2, unitKind: 'cavalry' }],
  ]) {
    stage = `rejecting invalid trigger unit reward ${invalidId}`;
    const beforeInvalidUnitMap = azure.getMessageCount();
    const invalidUnits = azure.waitForMessage((message) => message.type === 'mapRejected'
      && /invalid scenario trigger/i.test(message.message), beforeInvalidUnitMap - 1);
    send(azure.socket, {
      type: 'publishMap',
      map: {
        ...mapBase,
        id: `trigger-${invalidId}`,
        name: `TRIGGER ${invalidId.toUpperCase()}`,
        triggers: [trigger(invalidId, 'Invalid Unit Reward', zones.center, fields)],
      },
    });
    await invalidUnits;
  }

  stage = 'resolving simultaneous any-mode captures';
  const simultaneousMap = {
    ...mapBase,
    id: 'trigger-victory-simultaneous',
    name: 'TRIGGER VICTORY SIMULTANEOUS',
    victoryMode: 'any',
    triggers: [
      trigger('azure-start-win', 'Azure Starting Zone',
        { column: 15, row: 27, width: 13, height: 10 }, { victory: true, captureSeconds: 1 }),
      trigger('ember-start-win', 'Ember Starting Zone',
        { column: 36, row: 27, width: 13, height: 10 }, { victory: true, captureSeconds: 1 }),
    ],
  };
  const simultaneousPublished = await publishMap(azure, ember, simultaneousMap);
  assert.ok(simultaneousPublished.azureState.objectives.every((objective) => objective.owner === -1),
    'simultaneous-capture objectives should begin neutral');
  const simultaneousMessages = await Promise.all(clients.map(async (client) => Promise.all([
    client.waitForMessage((message) => message.type === 'trigger'
      && message.triggerId === 'azure-start-win' && message.team === 0),
    client.waitForMessage((message) => message.type === 'trigger'
      && message.triggerId === 'ember-start-win' && message.team === 1),
  ])));
  const simultaneousStates = await Promise.all(clients.map((client) => client.waitForState((state) => (
    state.mapId === simultaneousMap.id && state.winner === -1
      && findObjective(state, 'azure-start-win')?.owner === 0
      && findObjective(state, 'ember-start-win')?.owner === 1
  ))));
  for (const messages of simultaneousMessages) {
    assert.deepEqual(messages.map((message) => message.type), ['trigger', 'trigger'],
      'opposing any-mode captures completing on the same tick should both be ordinary captures');
  }
  for (const state of simultaneousStates) {
    assert.equal(state.winner, -1, 'simultaneous opposing captures should not award a winner');
    assert.equal(state.winnerTriggerId, null);
    assert.equal(findObjective(state, 'azure-start-win').owner, 0);
    assert.equal(findObjective(state, 'ember-start-win').owner, 1);
  }

  stage = 'resolving simultaneous all-mode captures';
  const simultaneousAllMap = {
    ...simultaneousMap,
    id: 'trigger-victory-all-simultaneous',
    name: 'TRIGGER VICTORY ALL SIMULTANEOUS',
    victoryMode: 'all',
    triggers: [
      trigger('all-azure-start-win', 'Azure Starting Zone',
        { column: 15, row: 27, width: 13, height: 10 }, { victory: true, captureSeconds: 1 }),
      trigger('all-ember-start-win', 'Ember Starting Zone',
        { column: 36, row: 27, width: 13, height: 10 }, { victory: true, captureSeconds: 1 }),
    ],
  };
  const simultaneousAllPublished = await publishMap(azure, ember, simultaneousAllMap);
  const simultaneousAllMessages = await Promise.all(clients.map(async (client) => Promise.all([
    client.waitForMessage((message) => message.type === 'trigger'
      && message.triggerId === 'all-azure-start-win' && message.team === 0),
    client.waitForMessage((message) => message.type === 'trigger'
      && message.triggerId === 'all-ember-start-win' && message.team === 1),
  ])));
  const simultaneousAllStates = await Promise.all(clients.map((client) => client.waitForState((state) => (
    state.mapId === simultaneousAllMap.id && state.winner === -1
      && findObjective(state, 'all-azure-start-win')?.owner === 0
      && findObjective(state, 'all-ember-start-win')?.owner === 1
  ))));
  assert.equal(simultaneousAllPublished.azureChange.map.victoryMode, 'all');
  for (const messages of simultaneousAllMessages) {
    assert.deepEqual(messages.map((message) => message.type), ['trigger', 'trigger'],
      'mixed opposing captures should remain non-terminal in all mode');
  }
  for (const state of simultaneousAllStates) {
    assert.equal(state.winner, -1, 'mixed ownership after simultaneous all-mode captures is not a win');
    assert.equal(state.winnerTriggerId, null);
  }

  stage = 'capturing the any-mode victory zone';
  const anyMap = {
    ...mapBase,
    id: 'trigger-victory-any',
    name: 'TRIGGER VICTORY ANY',
    victoryMode: 'any',
    triggers: [
      trigger('north-win', 'North Objective', zones.north, { victory: true }),
      trigger('wood-cache', 'Wood Cache', zones.center, { woodReward: 15 }),
      trigger('south-win', 'South Objective', zones.south, { victory: true, foodReward: 25 }),
    ],
  };
  const anyPublished = await publishMap(azure, ember, anyMap);
  assert.deepEqual(anyPublished.azureChange.map.triggers.map((row) => row.victory), [true, undefined, true],
    'marked objectives and the wood reward trigger should be accepted and synchronized');
  assert.deepEqual(anyPublished.azureState.objectives.map((objective) => objective.id),
    ['north-win', 'wood-cache', 'south-win'], 'both clients should receive each objective in state');
  assert.deepEqual(anyPublished.azureState.objectives.map((objective) => objective.victory), [true, false, true]);
  assert.ok(anyPublished.azureState.objectives.every((objective) => objective.owner === -1),
    'the test zones should start neutral');

  stage = 'capturing a wood-only objective';
  const woodOnlyCapture = await moveAndCapture({
    clients, mapId: anyMap.id, orderClient: azure, unitId: 71,
    triggerId: 'wood-cache', zone: zones.center, team: 0, type: 'trigger',
  });
  assert.equal(woodOnlyCapture.messages[0].message, 'AZURE SECURED Wood Cache · +15 WOOD',
    'wood-only capture should show its default wood announcement');
  assert.deepEqual(woodOnlyCapture.states[0].food, [0, 0]);
  assert.deepEqual(woodOnlyCapture.states[0].wood, [15, 0]);
  assert.ok(woodOnlyCapture.states.every((state) => state.winner === -1),
    'a non-victory wood objective should not end the match');

  const anyCapture = await moveAndCapture({
    clients, mapId: anyMap.id, orderClient: azure, unitId: 71,
    triggerId: 'south-win', zone: zones.south, team: 0, type: 'victory',
  });
  assert.equal(anyCapture.messages[0].message, 'AZURE SECURED South Objective · +25 FOOD',
    'the first marked capture should award its food before ending the match');
  assert.equal(anyCapture.states[0].winner, 0);
  assert.equal(anyCapture.states[1].winner, 0);
  assert.equal(anyCapture.states[0].winnerReason, 'capture');
  assert.equal(anyCapture.states[1].winnerReason, 'capture');
  assert.equal(anyCapture.states[0].winnerTriggerId, 'south-win',
    'any mode should name the first marked trigger captured, even when it is not first in the map');
  assert.equal(anyCapture.states[1].winnerTriggerId, 'south-win');
  assert.equal(findObjective(anyCapture.states[0], 'north-win').owner, -1,
    'any mode should not require the other marked objective');
  assert.deepEqual(anyCapture.states[0].food, [25, 0]);
  assert.deepEqual(anyCapture.states[1].food, [25, 0]);

  stage = 'capturing the non-victory reinforcement zone';
  const allMap = {
    ...mapBase,
    id: 'trigger-victory-all',
    name: 'TRIGGER VICTORY ALL',
    victoryMode: 'all',
    triggers: [
      trigger('all-north-win', 'North Objective', zones.north, { victory: true }),
      trigger('all-supply-cache', 'Supply Cache', zones.center, {
        foodReward: 40, woodReward: 65, unitCount: 2, unitKind: 'worker',
        message: '{team} took {objective} · {reward} · {wood} · {units} {kind}',
      }),
      trigger('all-south-win', 'South Objective', zones.south, { victory: true }),
    ],
  };
  const allPublished = await publishMap(azure, ember, allMap);
  assert.deepEqual(allPublished.azureChange.map.triggers.map((row) => row.victory), [true, undefined, true],
    'all mode should support multiple victory objectives alongside a reward objective');
  assert.deepEqual(allPublished.azureState.objectives.map((objective) => objective.victory), [true, false, true]);

  stage = 'capturing the all-mode supply cache with Azure';
  const rewardCapture = await moveAndCapture({
    clients, mapId: allMap.id, orderClient: azure, unitId: 71,
    triggerId: 'all-supply-cache', zone: zones.center, team: 0, type: 'trigger',
  });
  assert.equal(rewardCapture.messages[0].message, 'AZURE took Supply Cache · +40 FOOD · +65 WOOD · 2 WORKER');
  assert.deepEqual(rewardCapture.states[0].food, [40, 0], 'the non-victory reward should reach Azure');
  assert.deepEqual(rewardCapture.states[1].food, [40, 0], 'both clients should see the reward');
  assert.deepEqual(rewardCapture.states[0].wood, [65, 0], 'capture should award wood to Azure');
  assert.deepEqual(rewardCapture.states[1].wood, [65, 0], 'both clients should see capture wood');
  const azureCaptureUnits = rewardCapture.states[0].units.filter((unit) => unit[0] >= 250);
  const emberCaptureUnits = rewardCapture.states[1].units.filter((unit) => unit[0] >= 250);
  assert.equal(azureCaptureUnits.length, 2, 'the capture should grant exactly two units');
  assert.ok(azureCaptureUnits.every((unit) => unit[1] === 0 && unit[5] === 'worker'),
    'capture reinforcements should have the configured team and unit kind');
  assert.deepEqual(emberCaptureUnits, azureCaptureUnits,
    'the other player should receive the same authoritative reinforcement units');
  const reinforcementCells = azureCaptureUnits.map((unit) => `${Math.floor(unit[2] + 32)},${Math.floor(unit[3] + 32)}`);
  assert.equal(new Set(reinforcementCells).size, 2, 'capture reinforcements should use unique cells');
  for (const unit of azureCaptureUnits) {
    const column = Math.floor(unit[2] + 32);
    const row = Math.floor(unit[3] + 32);
    assert.ok(Math.max(Math.abs(column - 22), Math.abs(row - 32)) <= 12,
      'capture reinforcements should spawn near the capturing team base');
    assert.equal(allMap.obstacles.some((obstacle) => column >= obstacle.column
      && column < obstacle.column + obstacle.width && row >= obstacle.row
      && row < obstacle.row + obstacle.height), false,
    'capture reinforcements should use walkable cells');
  }
  assert.ok(rewardCapture.states.every((state) => state.winner === -1),
    'a non-victory reward objective must not end the match');
  await new Promise((resolve) => setTimeout(resolve, 750));
  assert.equal(azure.getLatestState().units.filter((unit) => unit[0] >= 250).length, 2,
    'holding a captured zone should not repeat its unit reward');

  stage = 'clearing Azure from the reward zone for Ember recapture';
  await moveTeamOutOfZone({ clients, client: azure, team: 0,
    mapId: allMap.id, triggerId: 'all-supply-cache', zone: zones.center });
  const emberRewardRecapture = await moveAndCapture({
    clients, mapId: allMap.id, orderClient: ember, unitId: 125,
    triggerId: 'all-supply-cache', zone: zones.center, team: 1, type: 'trigger',
  });
  assert.equal(emberRewardRecapture.messages[0].message, 'EMBER took Supply Cache · +40 FOOD · +65 WOOD · 2 WORKER');
  assert.deepEqual(emberRewardRecapture.states[0].wood, [65, 65],
    'recapturing should pay the wood reward to Ember');
  const emberGrantedUnits = emberRewardRecapture.states[0].units.filter((unit) => unit[0] >= 250 && unit[1] === 1);
  assert.equal(emberGrantedUnits.length, 2, 'recapturing should grant the same unit reward to Ember');
  assert.deepEqual(emberRewardRecapture.states[0].units, emberRewardRecapture.states[1].units,
    'both clients should see identical units after recapture');

  stage = 'clearing Ember from the reward zone for Azure recapture';
  await moveTeamOutOfZone({ clients, client: ember, team: 1,
    mapId: allMap.id, triggerId: 'all-supply-cache', zone: zones.center });
  const azureRewardRecapture = await moveAndCapture({
    clients, mapId: allMap.id, orderClient: azure, unitId: 71,
    triggerId: 'all-supply-cache', zone: zones.center, team: 0, type: 'trigger',
  });
  assert.equal(azureRewardRecapture.messages[0].message, 'AZURE took Supply Cache · +40 FOOD · +65 WOOD · 2 WORKER');
  const secondAzureReward = azureRewardRecapture.states[0].units
    .filter((unit) => unit[0] >= 250 && unit[1] === 0 && unit[5] === 'worker');
  assert.equal(secondAzureReward.length, 4,
    'Azure should receive one reward per ownership transition, including recapture');
  assert.deepEqual(azureRewardRecapture.states[0].food, [80, 40],
    'each capture and recapture should award food exactly once to its capturing team');
  assert.deepEqual(azureRewardRecapture.states[0].wood, [130, 65],
    'each capture and recapture should award wood exactly once to its capturing team');
  assert.ok(azureRewardRecapture.states.every((state) => state.winner === -1),
    'capturing a reward-only zone should remain non-terminal');

  stage = 'capturing one all-mode victory zone';
  const northCapture = await moveAndCapture({
    clients, mapId: allMap.id, orderClient: azure, unitId: 71,
    triggerId: 'all-north-win', zone: zones.north, team: 0, type: 'trigger',
  });
  assert.ok(northCapture.states.every((state) => state.winner === -1 && state.winnerTriggerId === null),
    'capturing only one marked objective must not end an all-mode match');

  stage = 'capturing the all-mode victory zone with Ember';
  const emberCapture = await moveAndCapture({
    clients, mapId: allMap.id, orderClient: ember, unitId: 125,
    triggerId: 'all-south-win', zone: zones.south, team: 1, type: 'trigger',
  });
  assert.ok(emberCapture.states.every((state) => state.winner === -1 && state.winnerTriggerId === null),
    'different teams owning the marked objectives must not satisfy all mode');
  assert.equal(findObjective(emberCapture.states[0], 'all-north-win').owner, 0);
  assert.equal(findObjective(emberCapture.states[0], 'all-south-win').owner, 1);

  const clearWaits = clients.map((client) => client.waitForState((state) => {
    const objective = findObjective(state, 'all-south-win');
    return state.mapId === allMap.id && objective?.owner === 1 && objective.unitCounts[1] === 0;
  }));
  const southExitX = zones.south.column - 64 / 2 - 0.5;
  const southExitZ = zones.south.row - 64 / 2 + zones.south.height / 2;
  send(ember.socket, { type: 'move', ids: [125], x: southExitX, z: southExitZ });
  await Promise.all(clearWaits);

  stage = 'capturing the all-mode victory zone with Azure';
  const finalCapture = await moveAndCapture({
    clients, mapId: allMap.id, orderClient: azure, unitId: 71,
    triggerId: 'all-south-win', zone: zones.south, team: 0, type: 'victory',
  });
  assert.equal(finalCapture.messages[0].message, 'AZURE SECURED South Objective',
    'the final same-team victory capture should announce normally');
  for (const state of finalCapture.states) {
    assert.equal(state.winner, 0);
    assert.equal(state.winnerReason, 'capture');
    assert.equal(state.winnerTriggerId, 'all-south-win',
      'all mode should record the final required marked trigger');
    assert.equal(findObjective(state, 'all-north-win').owner, 0);
    assert.equal(findObjective(state, 'all-south-win').owner, 0);
    assert.deepEqual(state.food, [80, 40]);
  }

  console.log(JSON.stringify({
    twoClients: ['azure', 'ember'],
    rejectedInvalidVictoryMode: modeRejection.message,
    rejectedInvalidFoodReward: true,
    rejectedInvalidWoodReward: true,
    rejectedInvalidUnitRewards: true,
    rejectedInvalidPrerequisites: [
      'missing reference', 'self reference', 'cycle', 'duplicate multi-link',
      'short and oversized multi-lists', 'mixed single/multi fields', 'multi-link cycle',
    ],
    capturePrerequisites: {
      lockedZoneStayedNeutral: true,
      firstGateTransferredTo: 1,
      retainedAfterGateLoss: 0,
      recapturedByGateOwner: findObjective(emberChainedCapture.states[0], 'chain-second').owner,
    },
    captureMultiPrerequisites: {
      blockedWithNeitherGate: findObjective(multiLockedAzure, 'multi-center').progress === 0,
      initialOwners: findObjective(multiLockedAzure, 'multi-center').requiredOwners,
      ownersAfterOneGate: ownersAfterFirstMultiGate,
      blockedAfterLosingFirstGate: azureMissingFirstGate.every((state) => findObjective(state, 'multi-center').progress === 0),
      blockedWhileEmberHeldOnlyOneGate: emberMissingSecondGate.every((state) => findObjective(state, 'multi-center').progress === 0),
      capturedAfterBothGates: multiCapture.states.every((state) => findObjective(state, 'multi-center').owner === 0),
      recapturedAfterEmberTookBoth: emberMultiCapture.states.every((state) => findObjective(state, 'multi-center').owner === 1),
    },
    simultaneousAnyMode: {
      captures: ['azure-start-win', 'ember-start-win'],
      bothNormalTriggerMessages: true,
      winner: simultaneousStates[0].winner,
    },
    simultaneousAllMode: {
      captures: ['all-azure-start-win', 'all-ember-start-win'],
      mixedOwnershipDidNotWin: simultaneousAllStates[0].winner === -1,
    },
    anyMode: {
      markedTriggers: ['north-win', 'south-win'],
      capturedFirst: 'south-win',
      winnerTriggerId: anyCapture.states[0].winnerTriggerId,
      teamFood: anyCapture.states[0].food,
      teamWood: anyCapture.states[0].wood,
    },
    allMode: {
      markedTriggers: ['all-north-win', 'all-south-win'],
      nonVictoryRewardTrigger: 'all-supply-cache',
      differentTeamOwnershipDidNotWin: true,
      capturesGrantedUnits: {
        azureWorkersAfterRecapture: secondAzureReward.length,
        emberWorkersAfterCapture: emberGrantedUnits.length,
        noRepeatedGrantWhileOwned: true,
      },
      finalTriggerId: finalCapture.states[0].winnerTriggerId,
      teamFood: finalCapture.states[0].food,
      teamWood: finalCapture.states[0].wood,
    },
  }, null, 2));
} finally {
  await Promise.all(clients.map(({ socket }) => close(socket)));
}
