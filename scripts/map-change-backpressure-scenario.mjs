import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { connect } from 'node:net';

const port = Number(process.argv[2] || 4174);
const endpoint = `ws://127.0.0.1:${port}/ws`;
const healthEndpoint = `http://127.0.0.1:${port}/health`;
const timeoutMs = 10_000;
const normalClients = [];

function encodeMaskedFrame(opcode, payload) {
  const mask = randomBytes(4);
  let header;
  if (payload.length < 126) {
    header = Buffer.alloc(2);
    header[1] = 0x80 | payload.length;
  } else if (payload.length <= 0xffff) {
    header = Buffer.alloc(4);
    header[1] = 0x80 | 126;
    header.writeUInt16BE(payload.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[1] = 0x80 | 127;
    header.writeBigUInt64BE(BigInt(payload.length), 2);
  }
  header[0] = 0x80 | opcode;
  const masked = Buffer.allocUnsafe(payload.length);
  for (let index = 0; index < payload.length; index++) masked[index] = payload[index] ^ mask[index % 4];
  return Buffer.concat([header, mask, masked]);
}

function waitFor(messages, predicate, description, limitMs = timeoutMs) {
  const deadline = Date.now() + limitMs;
  return new Promise((resolve, reject) => {
    const check = () => {
      const message = messages.find(predicate);
      if (message) return resolve(message);
      if (Date.now() >= deadline) return reject(new Error(`Timed out waiting for ${description}`));
      setTimeout(check, 20);
    };
    check();
  });
}

async function readHealth() {
  const response = await fetch(healthEndpoint, { cache: 'no-store' });
  assert.ok(response.ok, `health endpoint returned ${response.status}`);
  return response.json();
}

async function waitForBackpressure(client) {
  const deadline = Date.now() + timeoutMs;
  const maxRefreshRequests = 200;
  let refreshRequests = 0;
  let coalescedAtPressure = null;
  let coalescedAfterSetup = null;
  let health;
  do {
    health = await readHealth();
    const transport = health.transport;
    assert.ok(transport, 'health should report native transport state');
    assert.equal(client.socket.destroyed, false, 'the paused peer must remain connected');
    assert.equal(transport.activePeers, 2, 'both scenario peers must remain connected');
    assert.equal(transport.outboundQueueLimitDisconnects, 0, 'setup must stay below the real output queue cap');
    assert.equal(transport.commandQueueLimitRejections, 0, 'setup commands must not be rejected');
    if (Date.now() >= deadline) break;

    if (coalescedAtPressure === null && transport.backpressuredPeers > 0) {
      // stateRefresh clears pending replaceable snapshots. Permanently stop
      // requesting it before testing fresh ordinary-state coalescing.
      coalescedAtPressure = transport.coalescedStateSnapshots;
    }
    if (coalescedAtPressure !== null) {
      if (coalescedAfterSetup === null && transport.pendingCommands === 0) {
        coalescedAfterSetup = transport.coalescedStateSnapshots;
      }
      if (coalescedAfterSetup !== null && transport.pendingCommands === 0
        && transport.backpressuredPeers > 0
        && transport.coalescedStateSnapshots > coalescedAfterSetup) {
        return { health, refreshRequests, coalescedAtPressure, coalescedAfterSetup };
      }
    } else if (health.armySize === 2000 && refreshRequests < maxRefreshRequests) {
      // One valid full snapshot per poll creates real socket pressure without
      // resetting simulation or exceeding the production inbound limits.
      client.send({ type: 'stateRefresh', stateRefreshId: ++refreshRequests });
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  } while (Date.now() < deadline);
  throw new Error(`Large army did not create a fresh coalesced backpressured state: ${JSON.stringify({
    refreshRequests, coalescedAtPressure, coalescedAfterSetup, transport: health?.transport,
  })}`);
}

async function openPausedPlayer() {
  const socket = connect({ host: '127.0.0.1', port });
  await once(socket, 'connect');
  socket.setNoDelay(true);
  const client = {
    socket,
    welcome: null,
    messages: [],
    buffer: Buffer.alloc(0),
    upgraded: false,
    capturing: false,
    send(message) {
      socket.write(encodeMaskedFrame(0x1, Buffer.from(JSON.stringify(message))));
    },
    startReading() {
      client.capturing = true;
      parseFrames();
      socket.resume();
    },
  };
  let resolveWelcome;
  let rejectWelcome;
  const welcomePromise = new Promise((resolve, reject) => {
    resolveWelcome = resolve;
    rejectWelcome = reject;
  });

  function parseFrames() {
    while (client.buffer.length >= 2) {
      const opcode = client.buffer[0] & 0x0f;
      let length = client.buffer[1] & 0x7f;
      let offset = 2;
      if (length === 126) {
        if (client.buffer.length < 4) return;
        length = client.buffer.readUInt16BE(2);
        offset = 4;
      } else if (length === 127) {
        if (client.buffer.length < 10) return;
        const longLength = client.buffer.readBigUInt64BE(2);
        if (longLength > 1_000_000n) throw new Error('Received an oversized WebSocket frame');
        length = Number(longLength);
        offset = 10;
      }
      if (client.buffer.length < offset + length) return;
      const payload = client.buffer.subarray(offset, offset + length);
      client.buffer = client.buffer.subarray(offset + length);
      if (opcode === 0x9) {
        socket.write(encodeMaskedFrame(0x0a, payload));
        continue;
      }
      if (opcode !== 0x1) continue;
      let message;
      try { message = JSON.parse(payload.toString('utf8')); } catch { continue; }
      if (!client.welcome && message.type === 'welcome') {
        client.welcome = message;
        socket.pause();
        resolveWelcome(message);
        return;
      }
      if (client.capturing) client.messages.push(message);
    }
  }

  socket.on('error', (error) => rejectWelcome(error));
  socket.on('data', (chunk) => {
    client.buffer = Buffer.concat([client.buffer, chunk]);
    if (!client.upgraded) {
      const headerEnd = client.buffer.indexOf('\r\n\r\n');
      if (headerEnd < 0) return;
      const header = client.buffer.subarray(0, headerEnd).toString('latin1');
      if (!header.startsWith('HTTP/1.1 101 ')) {
        rejectWelcome(new Error('Slow-reader WebSocket upgrade failed'));
        socket.destroy();
        return;
      }
      client.buffer = client.buffer.subarray(headerEnd + 4);
      client.upgraded = true;
    }
    try { parseFrames(); } catch (error) { rejectWelcome(error); }
  });
  const key = randomBytes(16).toString('base64');
  socket.write([
    'GET /ws HTTP/1.1',
    `Host: 127.0.0.1:${port}`,
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Key: ${key}`,
    'Sec-WebSocket-Version: 13',
    '\r\n',
  ].join('\r\n'));
  return { client, welcome: await welcomePromise };
}

function openPlayer() {
  const client = { socket: new WebSocket(endpoint), messages: [] };
  client.socket.addEventListener('message', (event) => {
    try { client.messages.push(JSON.parse(event.data)); } catch {}
  });
  normalClients.push(client);
  return client;
}

let pausedClient = null;
try {
  const opened = await openPausedPlayer();
  pausedClient = opened.client;
  assert.equal(opened.welcome.player.team, 0, 'first client should claim Azure');
  const ember = openPlayer();
  const emberWelcome = await waitFor(ember.messages, (message) => message.type === 'welcome', 'Ember welcome');
  assert.equal(emberWelcome.player.team, 1, 'second client should claim Ember');

  pausedClient.send({ type: 'selectArmySize', count: 2000 });
  pausedClient.send({
    type: 'move', ids: Array.from({ length: 1000 }, (_, index) => index), x: -10, z: 0, formation: 'box',
  });
  const pressure = await waitForBackpressure(pausedClient);
  const stalledHealth = pressure.health;
  assert.equal(stalledHealth.armySize, 2000, 'the backpressured peer should receive the full army workload');
  const oldMapId = opened.welcome.map.id;
  const nextMap = opened.welcome.maps.find((map) => map.id === 'dense-clash' && map.id !== oldMapId)
    || opened.welcome.maps.find((map) => map.id === 'open-field' && map.id !== oldMapId);
  assert.ok(nextMap, 'a different trigger-free map should be available for the ordering check');

  const emberMapChange = waitFor(ember.messages,
    (message) => message.type === 'mapChange' && message.map?.id === nextMap.id,
    'the normal client map change');
  pausedClient.send({ type: 'selectMap', mapId: nextMap.id });
  const mapChange = await emberMapChange;
  assert.equal(mapChange.state.mapId, nextMap.id, 'mapChange should carry matching authoritative state');

  pausedClient.startReading();
  await waitFor(pausedClient.messages,
    (message) => message.type === 'mapChange' && message.map?.id === nextMap.id,
    'the paused client map change');
  await new Promise((resolve) => setTimeout(resolve, 300));
  const mapChangeIndex = pausedClient.messages.findIndex((message) => (
    message.type === 'mapChange' && message.map?.id === nextMap.id
  ));
  const statesAfterMapChange = pausedClient.messages.slice(mapChangeIndex + 1)
    .filter((message) => message.type === 'state');
  const staleStates = statesAfterMapChange.filter((message) => message.mapId !== nextMap.id);
  assert.equal(staleStates.length, 0,
    `old-map snapshots must not arrive after mapChange: ${JSON.stringify(staleStates.map((state) => state.mapId))}`);

  console.log(JSON.stringify({
    scenario: 'coalesced state is discarded across map changes for a backpressured peer',
    oldMapId,
    newMapId: nextMap.id,
    refreshRequests: pressure.refreshRequests,
    coalescedAtPressure: pressure.coalescedAtPressure,
    coalescedAfterSetup: pressure.coalescedAfterSetup,
    backpressuredPeers: stalledHealth.transport.backpressuredPeers,
    coalescedStateSnapshots: stalledHealth.transport.coalescedStateSnapshots,
    statesAfterMapChange: statesAfterMapChange.map((state) => state.mapId),
  }, null, 2));
} finally {
  if (pausedClient) pausedClient.socket.destroy();
  await Promise.all(normalClients.map((client) => new Promise((resolve) => {
    if (client.socket.readyState === WebSocket.CLOSED) return resolve();
    client.socket.addEventListener('close', resolve, { once: true });
    client.socket.close(1000, 'map-change backpressure scenario complete');
  })));
}
