#!/usr/bin/env node
import assert from 'node:assert/strict';

const port = Number(process.argv[2] || 4178);
const endpoint = `ws://127.0.0.1:${port}/ws`;
const TIMEOUT_MS = 15_000;

function createFeed(socket) {
  const messages = [];
  const waiters = [];
  socket.addEventListener('message', (event) => {
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    messages.push(message);
    for (let index = waiters.length - 1; index >= 0; index--) {
      const waiter = waiters[index];
      if (!waiter.predicate(message)) continue;
      waiters.splice(index, 1);
      clearTimeout(waiter.timeout);
      waiter.resolve(message);
    }
  });
  return {
    wait(predicate, timeoutMs = TIMEOUT_MS) {
      const previous = messages.find(predicate);
      if (previous) return Promise.resolve(previous);
      return new Promise((resolve, reject) => {
        const waiter = {
          predicate,
          resolve,
          timeout: setTimeout(() => {
            waiters.splice(waiters.indexOf(waiter), 1);
            reject(new Error('Timed out waiting for the expected server message'));
          }, timeoutMs),
        };
        waiters.push(waiter);
      });
    },
  };
}

async function connectClient() {
  const socket = new WebSocket(endpoint);
  const feed = createFeed(socket);
  const welcome = await feed.wait((message) => message.type === 'welcome');
  return { socket, feed, welcome };
}

function orderNotice(feed, token, prefix) {
  return feed.wait((message) => message.type === 'notice'
    && message.clientOrderToken === token
    && message.message?.startsWith(prefix));
}

function send(socket, message) {
  socket.send(JSON.stringify(message));
}

async function close(socket) {
  if (socket.readyState === WebSocket.CLOSED) return;
  await new Promise((resolve) => {
    socket.addEventListener('close', resolve, { once: true });
    socket.close(1000, 'order-status scenario complete');
  });
}

const clients = [];
try {
  const azure = await connectClient();
  clients.push(azure.socket);
  const ember = await connectClient();
  clients.push(ember.socket);
  assert.equal(azure.welcome.player.team, 0);
  assert.equal(ember.welcome.player.team, 1);

  const azureWorker = azure.welcome.state.units.find((unit) => unit[1] === 0 && unit[5] === 'worker');
  const emberUnit = ember.welcome.state.units.find((unit) => unit[1] === 1 && unit[4] > 0);
  assert.ok(azureWorker, 'Azure should have a worker');
  assert.ok(emberUnit, 'Ember should have a living target');

  const moveToken = 501;
  const movePlanning = orderNotice(azure.feed, moveToken, 'PLANNING MOVE ·');
  const moveApplied = orderNotice(azure.feed, moveToken, 'MOVE ORDER ·');
  send(azure.socket, {
    type: 'move', clientOrderToken: moveToken, ids: [azureWorker[0]],
    x: azureWorker[2] + 2, z: azureWorker[3] + 2,
  });
  assert.equal((await movePlanning).clientOrderToken, moveToken);
  assert.equal((await moveApplied).clientOrderToken, moveToken);

  const attackToken = 502;
  const attackApplied = orderNotice(azure.feed, attackToken, 'ATTACK ORDER ·');
  send(azure.socket, {
    type: 'attack', clientOrderToken: attackToken,
    ids: [azureWorker[0]], targetId: emberUnit[0], targetGeneration: emberUnit[8],
  });
  assert.equal((await attackApplied).clientOrderToken, attackToken);

  const gatherToken = 503;
  const gatherApplied = orderNotice(azure.feed, gatherToken, 'GATHER ORDER ·');
  send(azure.socket, {
    type: 'gather', clientOrderToken: gatherToken, ids: [azureWorker[0]], nodeId: 'azure-berries',
  });
  assert.equal((await gatherApplied).clientOrderToken, gatherToken);

  const rejectedBuildToken = 504;
  const rejectedBuild = orderNotice(azure.feed, rejectedBuildToken, 'BUILD REJECTED ·');
  send(azure.socket, {
    type: 'build', clientOrderToken: rejectedBuildToken,
    buildingType: 'unknown', ids: [azureWorker[0]],
  });
  assert.equal((await rejectedBuild).clientOrderToken, rejectedBuildToken);

  const staleMoveToken = 505;
  const latestAttackToken = 506;
  const staleMovePlanning = orderNotice(azure.feed, staleMoveToken, 'PLANNING MOVE ·');
  const staleMoveCompletion = azure.feed.wait((message) => message.type === 'notice'
    && message.clientOrderToken === staleMoveToken
    && (message.message?.startsWith('MOVE ORDER ·') || message.message?.startsWith('ORDER SUPERSEDED ·')));
  const latestAttack = orderNotice(azure.feed, latestAttackToken, 'ATTACK ORDER ·');
  const selectedIds = azure.welcome.state.units
    .filter((unit) => unit[1] === 0 && unit[4] > 0)
    .slice(0, 300)
    .map((unit) => unit[0]);
  send(azure.socket, {
    type: 'move', clientOrderToken: staleMoveToken, ids: selectedIds, x: -4, z: 12,
  });
  send(azure.socket, {
    type: 'attack', clientOrderToken: latestAttackToken,
    ids: selectedIds, targetId: emberUnit[0], targetGeneration: emberUnit[8],
  });
  assert.equal((await staleMovePlanning).clientOrderToken, staleMoveToken);
  assert.equal((await latestAttack).clientOrderToken, latestAttackToken);
  assert.equal((await staleMoveCompletion).clientOrderToken, staleMoveToken);

  console.log('Order-status scenario passed: move planning/completion, attack, gather, rejection, and overlapping-order correlation.');
} finally {
  await Promise.all(clients.map(close));
}
