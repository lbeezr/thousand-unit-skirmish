import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const port = Number(process.argv[2] || 4178);
const endpoint = `ws://127.0.0.1:${port}/ws`;
const TIMEOUT_MS = 90_000;

function createClient(sessionToken = null) {
  const protocols = ['rts-v1'];
  if (sessionToken) protocols.push(`rts-resume.${sessionToken}`);
  const socket = new WebSocket(endpoint, protocols);
  const messages = [];
  const messageWaiters = [];
  const stateWaiters = [];
  let latestState = null;

  function acceptState(state) {
    if (!state || state.type !== 'state') return;
    latestState = state;
    for (let index = stateWaiters.length - 1; index >= 0; index--) {
      const waiter = stateWaiters[index];
      if (!waiter.predicate(state)) continue;
      stateWaiters.splice(index, 1);
      clearTimeout(waiter.timeout);
      waiter.resolve(state);
    }
  }

  socket.addEventListener('message', (event) => {
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    messages.push(message);
    if (message.type === 'welcome') acceptState(message.state);
    else if (message.type === 'state') acceptState(message);
    else if (message.type === 'mapChange') acceptState(message.state);
    for (let index = messageWaiters.length - 1; index >= 0; index--) {
      const waiter = messageWaiters[index];
      if (!waiter.predicate(message)) continue;
      messageWaiters.splice(index, 1);
      clearTimeout(waiter.timeout);
      waiter.resolve(message);
    }
  });

  function waitForMessage(predicate, timeoutMs = TIMEOUT_MS) {
    const existing = messages.find(predicate);
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const waiter = { predicate, resolve, reject, timeout: setTimeout(() => {
        messageWaiters.splice(messageWaiters.indexOf(waiter), 1);
        reject(new Error('Timed out waiting for a server message.'));
      }, timeoutMs) };
      messageWaiters.push(waiter);
    });
  }

  function waitForState(predicate, timeoutMs = TIMEOUT_MS) {
    if (latestState && predicate(latestState)) return Promise.resolve(latestState);
    return new Promise((resolve, reject) => {
      const waiter = { predicate, resolve, reject, timeout: setTimeout(() => {
        stateWaiters.splice(stateWaiters.indexOf(waiter), 1);
        reject(new Error('Timed out waiting for an authoritative state.'));
      }, timeoutMs) };
      stateWaiters.push(waiter);
    });
  }

  return { socket, waitForMessage, waitForState };
}

function send(socket, message) {
  socket.send(JSON.stringify(message));
}

async function close(socket) {
  if (socket.readyState === WebSocket.CLOSED) return;
  await new Promise((resolve) => {
    socket.addEventListener('close', resolve, { once: true });
    socket.close(1000, 'elimination scenario complete');
  });
}

const clients = [];
try {
  const azure = createClient();
  clients.push(azure);
  const azureWelcome = await azure.waitForMessage((message) => message.type === 'welcome');
  assert.equal(azureWelcome.player.team, 0);
  assert.ok(azureWelcome.player.sessionToken, 'Azure receives a resumable session token');

  const ember = createClient();
  clients.push(ember);
  const emberWelcome = await ember.waitForMessage((message) => message.type === 'welcome');
  assert.equal(emberWelcome.player.team, 1);

  const base = JSON.parse(await readFile(new URL('../maps/open-field.json', import.meta.url), 'utf8'));
  const map = {
    ...base,
    id: 'elimination-scenario',
    name: 'ELIMINATION SCENARIO',
    summary: 'NO CAPTURE VICTORY · ELIMINATION',
    spawnPoints: [{ team: 0, x: -5, z: 0 }, { team: 1, x: 5, z: 0 }],
    resourceNodes: [],
    obstacles: [],
    triggers: [],
    fogOfWar: false,
  };
  const mapPublished = azure.waitForMessage((message) => message.type === 'mapPublished'
    && message.mapId === map.id);
  const mapChanges = [azure, ember].map((client) => client.waitForMessage((message) => (
    message.type === 'mapChange' && message.map.id === map.id
  )));
  send(azure.socket, { type: 'publishMap', map });
  await Promise.all([mapPublished, ...mapChanges]);

  const armySizeChanges = [azure, ember].map((client) => client.waitForState((state) => (
    state.mapId === map.id && state.armySize === 250 && state.winner === -1
  )));
  send(azure.socket, { type: 'selectArmySize', count: 250 });
  const [azureState, emberState] = await Promise.all(armySizeChanges);
  assert.deepEqual(azureState.alive, [125, 125]);
  assert.deepEqual(emberState.alive, [125, 125]);
  assert.equal(azureState.winnerReason, null);
  assert.equal(emberState.winnerReason, null);

  const resultStates = [azure, ember].map((client) => client.waitForState((state) => (
    state.mapId === map.id && state.winner !== -1
  )));
  const victoryMessages = [azure, ember].map((client) => client.waitForMessage((message) => (
    message.type === 'victory' && message.reason === 'elimination'
  )));
  send(azure.socket, {
    type: 'attackMove', ids: Array.from({ length: 125 }, (_, index) => index),
    x: 5, z: 0, formation: 'line',
  });
  const [states, victories] = await Promise.all([
    Promise.all(resultStates), Promise.all(victoryMessages),
  ]);
  for (const state of states) {
    assert.equal(state.winner, 0, 'Azure should win after eliminating Ember');
    assert.equal(state.winnerReason, 'elimination');
    assert.equal(state.winnerTriggerId, null);
    assert.equal(state.alive[1], 0);
  }
  assert.ok(victories.every((message) => message.team === 0));
  assert.match(victories[0].message, /EMBER ELIMINATED/);

  const rejectedOrder = azure.waitForMessage((message) => message.type === 'notice'
    && message.message === 'MATCH OVER · RESET TO PLAY AGAIN');
  send(azure.socket, { type: 'move', ids: [0], x: 0, z: 0 });
  await rejectedOrder;

  const sessionToken = azureWelcome.player.sessionToken;
  await close(azure.socket);
  const resumedAzure = createClient(sessionToken);
  clients.push(resumedAzure);
  const resumedWelcome = await resumedAzure.waitForMessage((message) => message.type === 'welcome');
  assert.equal(resumedWelcome.player.team, 0);
  assert.equal(resumedWelcome.player.resumed, true);
  assert.equal(resumedWelcome.state.winner, 0);
  assert.equal(resumedWelcome.state.winnerReason, 'elimination');

  console.log(JSON.stringify({
    passed: ['no-objective elimination victory', 'terminal order rejection', 'reconnect winner persistence'],
    winner: 'Azure', reason: 'elimination', remainingEmberUnits: states[0].alive[1],
  }, null, 2));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await Promise.all(clients.map((client) => close(client.socket).catch(() => {})));
}
