import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

const port = Number(process.argv[2] || 4174);
const durationSeconds = Number(process.argv[3] || 10);
assert.ok(Number.isInteger(durationSeconds) && durationSeconds >= 10 && durationSeconds <= 120,
  'duration must be an integer between 10 and 120 seconds');
const endpoint = `ws://127.0.0.1:${port}/ws`;
const healthEndpoint = `http://127.0.0.1:${port}/health`;
const TIMEOUT_MS = 15_000;
const clients = [];

async function readServerHealth() {
  const response = await fetch(healthEndpoint, { cache: 'no-store' });
  assert.ok(response.ok, `health endpoint returned ${response.status}`);
  return response.json();
}

function openClient() {
  const client = { socket: new WebSocket(endpoint), samples: [] };
  client.socket.addEventListener('message', (event) => {
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    if (message.type === 'state') {
      client.samples.push({
        bytes: Buffer.byteLength(event.data, 'utf8'),
        tick: message.tick,
        unitCount: message.units?.length ?? 0,
      });
    }
  });
  clients.push(client);
  return client;
}

function waitForMessage(client, predicate) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => finish(new Error('Timed out waiting for a server message')), TIMEOUT_MS);
    const onMessage = (event) => {
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      if (predicate(message)) finish(null, message);
    };
    const finish = (error, message) => {
      clearTimeout(timeout);
      client.socket.removeEventListener('message', onMessage);
      error ? reject(error) : resolve(message);
    };
    client.socket.addEventListener('message', onMessage);
  });
}

function send(client, message) {
  client.socket.send(JSON.stringify(message));
}

function webSocketHeaderBytes(payloadBytes) {
  return payloadBytes < 126 ? 2 : payloadBytes <= 0xffff ? 4 : 10;
}

function summarizeClient(client, index, elapsedSeconds) {
  const samples = client.samples.filter((sample) => sample.unitCount === 2000);
  const payloadSizes = samples.map((sample) => sample.bytes).sort((a, b) => a - b);
  const payloadBytes = samples.reduce((total, sample) => total + sample.bytes, 0);
  const framedBytes = samples.reduce((total, sample) => (
    total + sample.bytes + webSocketHeaderBytes(sample.bytes)
  ), 0);
  return {
    team: index === 0 ? 'Azure' : 'Ember',
    snapshots: samples.length,
    snapshotsPerSecond: Number((samples.length / elapsedSeconds).toFixed(2)),
    averagePayloadBytes: Math.round(payloadBytes / Math.max(1, samples.length)),
    p50PayloadBytes: payloadSizes[Math.ceil(payloadSizes.length * 0.5) - 1] ?? 0,
    p95PayloadBytes: payloadSizes[Math.ceil(payloadSizes.length * 0.95) - 1] ?? 0,
    maxPayloadBytes: payloadSizes.at(-1) ?? 0,
    uncompressedSnapshotKiBPerSecond: Number((framedBytes / elapsedSeconds / 1024).toFixed(2)),
  };
}

try {
  const [azure, ember] = [openClient(), openClient()];
  const [azureWelcome, emberWelcome] = await Promise.all([
    waitForMessage(azure, (message) => message.type === 'welcome'),
    waitForMessage(ember, (message) => message.type === 'welcome'),
  ]);
  assert.equal(azureWelcome.player.team, 0,
    'first client should claim Azure; run this benchmark against a fresh disposable server');
  assert.equal(emberWelcome.player.team, 1,
    'second client should claim Ember; run this benchmark against a fresh disposable server');

  const mapId = `wire-snapshot-${Date.now()}`;
  const testMap = {
    id: mapId,
    name: 'WIRE SNAPSHOT MEASURE',
    width: 64,
    height: 64,
    terrainSeed: 1,
    spawnPoints: [{ team: 0, x: -24, z: 0 }, { team: 1, x: 24, z: 0 }],
    resourceNodes: [],
    obstacles: [],
    triggers: [],
    scenarioEvents: [],
    victoryMode: 'any',
    fogOfWar: false,
  };
  const publication = waitForMessage(azure, (message) => message.type === 'mapPublished' && message.mapId === mapId);
  const mapChanges = clients.map((client) => waitForMessage(client,
    (message) => message.type === 'mapChange' && message.map.id === mapId));
  send(azure, { type: 'publishMap', map: testMap });
  await Promise.all([publication, ...mapChanges]);

  const fullArmyStates = clients.map((client) => waitForMessage(client, (message) => (
    message.type === 'state' && message.mapId === mapId && message.armySize === 2000
      && message.units.length === 2000 && message.fogOfWar === false
  )));
  send(azure, { type: 'selectArmySize', count: 2000 });
  await Promise.all(fullArmyStates);

  const azureOrderApplied = waitForMessage(azure, (message) => (
    message.type === 'notice' && message.message?.startsWith('MOVE ORDER')
  ));
  const emberOrderApplied = waitForMessage(ember, (message) => (
    message.type === 'notice' && message.message?.startsWith('MOVE ORDER')
  ));
  send(azure, { type: 'move', ids: Array.from({ length: 1000 }, (_, index) => index), x: 28, z: 0, formation: 'box' });
  send(ember, { type: 'move', ids: Array.from({ length: 1000 }, (_, index) => index + 1000), x: -28, z: 0, formation: 'box' });
  await Promise.all([azureOrderApplied, emberOrderApplied]);

  for (const client of clients) client.samples.length = 0;
  const healthBefore = await readServerHealth();
  const transportBefore = healthBefore.transport;
  const startedAt = performance.now();
  await new Promise((resolve) => setTimeout(resolve, durationSeconds * 1000));
  const elapsedSeconds = (performance.now() - startedAt) / 1000;
  const healthAfter = await readServerHealth();
  const transportAfter = healthAfter.transport;
  const measuredWireBytes = transportAfter.jsonWireBytesSent - transportBefore.jsonWireBytesSent;
  const measuredPayloadBytes = transportAfter.jsonPayloadBytesSent - transportBefore.jsonPayloadBytesSent;
  const measuredCompressedFrames = transportAfter.compressedFramesSent - transportBefore.compressedFramesSent;
  const measuredCompressedPayloadBytes = transportAfter.compressedPayloadBytesSent
    - transportBefore.compressedPayloadBytesSent;
  const measuredCompressedWireBytes = transportAfter.compressedWireBytesSent
    - transportBefore.compressedWireBytesSent;
  const measuredUncompressedWireBytes = transportAfter.jsonUncompressedWireBytesSent
    - transportBefore.jsonUncompressedWireBytesSent;
  const measurements = clients.map((client, index) => summarizeClient(client, index, elapsedSeconds));
  assert.ok(measurements.every((measurement) => measurement.snapshotsPerSecond >= 7.5),
    `expected near-10 Hz full snapshots during movement: ${JSON.stringify(measurements)}`);
  assert.ok(measurements.every((measurement) => measurement.maxPayloadBytes > 65_535),
    'the full-visibility match should exercise large WebSocket frames');
  assert.ok(healthAfter.tickTiming.p95Ms <= healthAfter.tickTiming.budgetMs,
    `server tick p95 exceeded its ${healthAfter.tickTiming.budgetMs} ms budget: ${JSON.stringify(healthAfter.tickTiming)}`);
  assert.ok(transportBefore.compressionPeers >= 2 && transportAfter.compressionPeers >= 2,
    `both benchmark clients must negotiate per-message compression: ${JSON.stringify({
      before: transportBefore.compressionPeers, after: transportAfter.compressionPeers,
    })}`);
  const receivedStateFrames = measurements.reduce((total, measurement) => total + measurement.snapshots, 0);
  assert.ok(measuredCompressedFrames >= receivedStateFrames,
    `expected at least one compressed outbound frame per received state: ${JSON.stringify({
      measuredCompressedFrames, receivedStateFrames,
    })}`);
  console.log(JSON.stringify({
    workload: '2,000 visible units; both 1,000-unit armies moving across an open 64 × 64 map',
    elapsedSeconds: Number(elapsedSeconds.toFixed(2)),
    measurements,
    serverTickTiming: healthAfter.tickTiming,
    transport: {
      compressionPeers: transportAfter.compressionPeers,
      compressedFrames: measuredCompressedFrames,
      originalJsonBytes: measuredPayloadBytes,
      websocketWireBytes: measuredWireBytes,
      compressedOriginalBytes: measuredCompressedPayloadBytes,
      compressedWireBytes: measuredCompressedWireBytes,
      actualServerEgressKiBPerSecond: Number((measuredWireBytes / elapsedSeconds / 1024).toFixed(2)),
      uncompressedEquivalentWireBytes: measuredUncompressedWireBytes,
      uncompressedEquivalentKiBPerSecond: Number((measuredUncompressedWireBytes / elapsedSeconds / 1024).toFixed(2)),
      reductionPercent: Number((100 * (1 - measuredWireBytes / Math.max(1, measuredUncompressedWireBytes))).toFixed(1)),
      note: 'Server-side JSON WebSocket bytes include frame headers and exclude control frames, TCP/IP, and TLS. Uncompressed-equivalent bytes count the same JSON frames with the original payload sizes.',
    },
  }, null, 2));
} finally {
  await Promise.all(clients.map((client) => new Promise((resolve) => {
    if (client.socket.readyState === WebSocket.CLOSED) return resolve();
    client.socket.addEventListener('close', resolve, { once: true });
    client.socket.close(1000, 'network snapshot scenario complete');
  })));
}
