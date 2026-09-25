#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer as createNetServer } from 'node:net';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERVER_ENTRY = path.join(ROOT, 'server.mjs');
const LOAD_SCENARIO = path.join(ROOT, 'scripts', 'performance-scenario.mjs');
const durationSeconds = Number(process.argv[2] || 12);
const workloadMode = process.argv[3] || 'move';
const repeatCount = Number(process.argv[4] || 1);
assert.ok(Number.isInteger(durationSeconds) && durationSeconds >= 10 && durationSeconds <= 120,
  'duration must be an integer between 10 and 120 seconds');
assert.ok(['idle', 'move', 'attack-move'].includes(workloadMode),
  'workload must be "idle", "move", or "attack-move"');
assert.ok(Number.isInteger(repeatCount) && repeatCount >= 1 && repeatCount <= 5,
  'repeats must be an integer between 1 and 5');

function startChild(name, args, env) {
  const child = spawn(process.execPath, args, { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString('utf8'); });
  child.stderr.on('data', (chunk) => { output += chunk.toString('utf8'); });
  child.outputText = () => output;
  child.label = name;
  return child;
}

async function reservePort() {
  const server = createNetServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function waitForHealth(port, child, timeoutMs = 15_000) {
  const endpoint = `http://127.0.0.1:${port}/health`;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Server exited early: ${child.outputText()}`);
    try {
      const response = await fetch(endpoint, { cache: 'no-store', signal: AbortSignal.timeout(1000) });
      if (response.ok) return response.json();
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Server did not become healthy: ${child.outputText()}`);
}

function waitForMessage(socket, predicate, timeoutMs = 10_000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => finish(new Error('Timed out waiting for worker state')), timeoutMs);
    const onError = () => finish(new Error('WebSocket connection failed'));
    const onMessage = (event) => {
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      if (predicate(message)) finish(null, message);
    };
    const finish = (error, message) => {
      clearTimeout(timeout);
      socket.removeEventListener('error', onError);
      socket.removeEventListener('message', onMessage);
      if (error) reject(error);
      else resolve(message);
    };
    socket.addEventListener('error', onError, { once: true });
    socket.addEventListener('message', onMessage);
  });
}

async function closeSocket(socket) {
  if (socket.readyState === WebSocket.CLOSED) return;
  await new Promise((resolve) => {
    socket.addEventListener('close', resolve, { once: true });
    socket.close(1000, 'checkpoint benchmark complete');
  });
}

async function exitChild(child, timeoutMs = 5000) {
  if (child.exitCode !== null) return;
  child.kill('SIGINT');
  let timeout;
  await Promise.race([
    once(child, 'exit'),
    new Promise((resolve) => { timeout = setTimeout(resolve, timeoutMs); }),
  ]);
  clearTimeout(timeout);
  if (child.exitCode === null) {
    child.kill('SIGKILL');
    await once(child, 'exit');
  }
}

const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'rts-checkpoint-performance-'));
let mapRelativePath = 'maps/open-field.json';
let tempMapPath = null;
if (workloadMode === 'attack-move') {
  const mapFilename = `.perf-checkpoint-${process.pid}.json`;
  tempMapPath = path.join(ROOT, 'maps', mapFilename);
  const openField = JSON.parse(await readFile(path.join(ROOT, 'maps/open-field.json'), 'utf8'));
  await writeFile(tempMapPath, JSON.stringify({
    ...openField,
    id: `perf-checkpoint-${process.pid}`,
    name: 'PERF CHECKPOINT BATTLE',
    summary: '64 × 64 · OPEN COMBAT TEST · NO FOG',
    spawnPoints: [{ team: 0, x: -16, z: 0 }, { team: 1, x: 16, z: 0 }],
    fogOfWar: false,
    resourceNodes: [],
    obstacles: [],
    triggers: [],
    scenarioEvents: [],
  }, null, 2));
  mapRelativePath = `maps/${mapFilename}`;
}
const port = await reservePort();
const checkpointPath = path.join(tempRoot, 'match-state.json');
const server = startChild('checkpointed server', [SERVER_ENTRY], {
  ...process.env,
  PORT: String(port),
  RTS_HOST: '127.0.0.1',
  RTS_MAP: mapRelativePath,
  RTS_CUSTOM_MAP_DIRECTORY: path.join(tempRoot, 'custom-maps'),
  RTS_MATCH_STATE_PATH: checkpointPath,
});
let load = null;
const clients = [];
try {
  const initialHealth = await waitForHealth(port, server);
  assert.equal(initialHealth.checkpoint?.enabled, true, 'worker should have checkpointing enabled');
  let measuredSamples;
  if (workloadMode !== 'idle') {
    load = startChild(`2,000-unit ${workloadMode} scenario`, [LOAD_SCENARIO, String(port), String(durationSeconds), String(repeatCount), workloadMode, 'box'], process.env);
    const [exitCode] = await once(load, 'exit');
    if (exitCode !== 0) {
      throw new Error(`${load.label} failed (${exitCode}): ${load.outputText()}\nServer log: ${server.outputText()}`);
    }
    const result = JSON.parse(load.outputText());
    assert.ok(Array.isArray(result.measurements) && result.measurements.length === repeatCount,
      `expected ${repeatCount} measured load runs`);
    measuredSamples = result.measurements;
  } else {
    const endpoint = `ws://127.0.0.1:${port}/ws`;
    const azure = new WebSocket(endpoint, ['rts-v1']);
    clients.push(azure);
    const azureWelcome = await waitForMessage(azure, (message) => message.type === 'welcome');
    const ember = new WebSocket(endpoint, ['rts-v1']);
    clients.push(ember);
    const emberWelcome = await waitForMessage(ember, (message) => message.type === 'welcome');
    assert.equal(azureWelcome.player.team, 0);
    assert.equal(emberWelcome.player.team, 1);
    const azureStateWait = waitForMessage(azure, (message) => message.type === 'state' && message.armySize === 2000);
    const emberStateWait = waitForMessage(ember, (message) => message.type === 'state' && message.armySize === 2000);
    azure.send(JSON.stringify({ type: 'selectArmySize', count: 2000 }));
    await Promise.all([azureStateWait, emberStateWait]);
    const healthEndpoint = `http://127.0.0.1:${port}/health`;
    const deadline = Date.now() + Math.max(40_000, durationSeconds * 1000 + 10_000);
    let health;
    while (Date.now() < deadline) {
      const response = await fetch(healthEndpoint, { cache: 'no-store' });
      health = await response.json();
      if (health.tickTiming?.sampleCount === 300 && health.checkpoint?.sequence >= 2) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.equal(health?.connected, 2, 'both idle-load clients should remain connected');
    assert.equal(health?.armySize, 2000, 'idle-load should exercise 2,000 units');
    assert.equal(health?.tickTiming?.sampleCount, 300, 'timing report should include a full ten-second window');
    measuredSamples = [{ checkpoint: health.checkpoint, tickTiming: health.tickTiming }];
  }
  for (const measured of measuredSamples) {
    assert.equal(measured.checkpoint?.enabled, true, 'checkpointing should remain enabled during load');
    assert.equal(measured.checkpoint?.failures, 0, 'checkpoint writes should succeed during load');
    assert.ok(measured.checkpoint.sequence >= 1, 'at least one checkpoint should be durable');
    assert.ok(measured.checkpoint.lastBytes > 0, 'serialized snapshot size should be available');
    assert.ok(Number.isFinite(measured.checkpoint.lastCaptureMs), 'tick-boundary capture duration should be available');
    assert.ok(Number.isFinite(measured.checkpoint.lastSerializeMs), 'deferred serializer duration should be available');
    assert.ok(Number.isFinite(measured.checkpoint.lastWriteMs), 'atomic filesystem write duration should be available');
    assert.equal(measured.tickTiming.sampleCount, 300, 'timing report should include a full ten-second window');
    assert.ok(Number.isFinite(measured.tickTiming.maxMs), 'tick maximum should be available');
  }

  const workloadSamples = measuredSamples.map((measured, index) => ({
    run: index + 1,
    unitsMovedAfterFirstSnapshot: measured.unitsMovedAfterFirstSnapshot ?? 0,
    damagedUnits: measured.damagedUnits ?? 0,
    checkpoint: {
      sequence: measured.checkpoint.sequence,
      intervalMs: measured.checkpoint.intervalMs,
      serializedBytes: measured.checkpoint.lastBytes,
      captureMsOnTickBoundary: measured.checkpoint.lastCaptureMs,
      serializeMsDeferred: measured.checkpoint.lastSerializeMs,
      atomicWriteMs: measured.checkpoint.lastWriteMs,
      failures: measured.checkpoint.failures,
    },
    tickTiming: measured.tickTiming,
  }));
  const runDir = process.env.GAME_DEV_RUN_DIR;
  const runId = process.env.GAME_DEV_RUN_ID;
  const adapterId = process.env.GAME_DEV_ADAPTER_ID;
  const scenarioId = process.env.GAME_DEV_SCENARIO_ID;
  if ([runDir, runId, adapterId, scenarioId].some(Boolean)) {
    assert.ok(runDir && runId && adapterId && scenarioId, 'game-dev run context must be complete');
    const measurements = [];
    for (const sample of workloadSamples) {
      measurements.push(
        { metric: 'simulation.tick_p95_ms', value: sample.tickTiming.p95Ms, unit: 'ms', aggregation: 'sample' },
        { metric: 'simulation.tick_max_ms', value: sample.tickTiming.maxMs, unit: 'ms', aggregation: 'sample' },
        { metric: 'simulation.tick_start_lag_max_ms', value: sample.tickTiming.startLagMaxMs, unit: 'ms', aggregation: 'sample' },
        { metric: 'combat.damaged_units', value: sample.damagedUnits, unit: 'units', aggregation: 'sample' },
        { metric: 'checkpoint.capture_ms', value: sample.checkpoint.captureMsOnTickBoundary, unit: 'ms', aggregation: 'sample' },
        { metric: 'checkpoint.serialize_ms', value: sample.checkpoint.serializeMsDeferred, unit: 'ms', aggregation: 'sample' },
        { metric: 'checkpoint.atomic_write_ms', value: sample.checkpoint.atomicWriteMs, unit: 'ms', aggregation: 'sample' },
        { metric: 'checkpoint.serialized_bytes', value: sample.checkpoint.serializedBytes, unit: 'bytes', aggregation: 'sample' },
      );
    }
    await mkdir(runDir, { recursive: true });
    await writeFile(path.join(runDir, 'capture.json'), JSON.stringify({
      schema: 'game_dev.capture.v1',
      runId,
      adapterId,
      scenarioId,
      sourceFormat: 'game-dev-capture-v1',
      frames: [],
      measurements,
      adapterEvidence: {
        hardware: { platform: process.platform, architecture: process.arch, nodeVersion: process.version },
        build: {
          revision: `checkpoint-enabled-box-${workloadMode}`,
          map: workloadMode === 'attack-move' ? 'open-field-no-fog-close-spawns' : 'open-field',
          width: 64, height: 64, units: 2000, unitsPerTeam: 1000,
          repeats: measuredSamples.length, durationSeconds,
        },
        notes: [
          'CPU-only local diagnostic on the current machine; not a target-hardware guarantee.',
          'Checkpointing is enabled with a one-second interval during every measured action window.',
          `Two localhost clients issue simultaneous 1,000-unit box-formation ${workloadMode} orders over WebSockets.`,
          'Each tick metric is measured over a full 300-tick window after the orders.',
          ...(workloadMode === 'attack-move'
            ? ['Fog and map triggers are disabled for this diagnostic so the armies can engage on an unobstructed field.']
            : []),
        ],
      },
    }, null, 2));
  }

  const lastSample = workloadSamples.at(-1);
  console.log(JSON.stringify({
    workload: workloadMode === 'idle'
      ? '2,000 stationary units in two connected teams'
      : `2,000 units in two connected teams (${workloadMode}, box formation)`,
    repeats: measuredSamples.length,
    samples: workloadSamples,
    tickTimingWithSnapshotsEnabled: lastSample.tickTiming,
  }, null, 2));
} finally {
  if (load && load.exitCode === null) {
    load.kill('SIGKILL');
    await once(load, 'exit');
  }
  await Promise.all(clients.map(closeSocket));
  await exitChild(server);
  if (tempMapPath) await rm(tempMapPath, { force: true });
  await rm(tempRoot, { recursive: true, force: true });
}
