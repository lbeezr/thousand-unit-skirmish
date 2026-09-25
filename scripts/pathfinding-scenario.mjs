#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer as createNetServer } from 'node:net';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const [mapKind = 'open', repeatsText = '2', durationText = '10', flowMode = 'standard'] = process.argv.slice(2);
const repeatCount = Number(repeatsText);
const durationSeconds = Number(durationText);
const measureChokeFlow = flowMode === 'choke-flow';
const FIRST_MOVE_VISIBLE_DISTANCE = 0.04;
const pathfindingMode = JSON.parse(await readFile(path.join(PROJECT_ROOT, '.game-dev/pathfinding-mode.json'), 'utf8')).mode;
const mode = pathfindingMode || 'shared-start';
assert.ok(['open', 'choke'].includes(mapKind), 'map must be open or choke');
assert.ok(['per-unit', 'shared-start'].includes(mode), 'mode must be per-unit or shared-start');
assert.ok(Number.isInteger(repeatCount) && repeatCount >= 1 && repeatCount <= 5,
  'repeats must be an integer from 1 to 5');
assert.ok(Number.isInteger(durationSeconds) && durationSeconds >= 10 && durationSeconds <= 60,
  'duration must be an integer from 10 to 60 seconds');
assert.ok(['standard', 'choke-flow'].includes(flowMode), 'flow mode must be standard or choke-flow');
assert.ok(!measureChokeFlow || mapKind === 'choke', 'choke-flow requires the choke map');

const runDir = process.env.GAME_DEV_RUN_DIR;
const runId = process.env.GAME_DEV_RUN_ID;
const adapterId = process.env.GAME_DEV_ADAPTER_ID;
const scenarioId = process.env.GAME_DEV_SCENARIO_ID;
if (!runDir || !runId || !adapterId || !scenarioId) throw new Error('game-dev run context is required');

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const capturePath = path.join(runDir, 'capture.json');
const mapFilename = `.perf-${process.pid}-${Date.now()}.json`;
const mapRelativePath = `maps/${mapFilename}`;
const mapPath = path.join(PROJECT_ROOT, mapRelativePath);
const width = 256;
const height = 256;
const gateRows = { start: 124, end: 132 };
const mapDefinition = {
  id: `perf-${mapKind}`,
  name: `PERF ${mapKind.toUpperCase()}`,
  summary: `256 × 256 · ${mapKind === 'choke' ? '8-cell centered gate' : 'open field'}`,
  width,
  height,
  terrainSeed: 2026,
  spawnPoints: [{ team: 0, x: -96, z: 0 }, { team: 1, x: 96, z: 0 }],
  obstacles: mapKind === 'choke' ? [
    { id: 'north-wall', column: 127, row: 0, width: 2, height: gateRows.start, material: 'stone' },
    { id: 'south-wall', column: 127, row: gateRows.end, width: 2, height: height - gateRows.end, material: 'stone' },
  ] : [],
  triggers: [],
};

const serverEnv = {
  ...process.env,
  PORT: '0',
  RTS_HOST: '127.0.0.1',
  RTS_MAP: mapRelativePath,
  RTS_SHARED_MOVE_PATHS: mode === 'shared-start' ? '1' : '0',
};

async function unusedPort() {
  const reservation = createNetServer();
  reservation.listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const port = reservation.address().port;
  await new Promise((resolve, reject) => reservation.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function waitForHealth(child, url, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`RTS server exited early (${child.exitCode}): ${child.stderrText}`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(500) });
      if (response.ok) return response.json();
    } catch (error) { lastError = error; }
    await delay(80);
  }
  const serverOutput = [child.stderrText, child.stdoutText].filter(Boolean).join('\n').trim();
  throw new Error(`RTS server did not become healthy: ${lastError?.message || 'health endpoint timed out'}${
    serverOutput ? `\nRTS server output:\n${serverOutput}` : ''
  }`);
}

async function closeServer(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, 'exit').catch(() => {});
  child.kill('SIGTERM');
  await Promise.race([exited, delay(2000)]);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL');
    await Promise.race([exited, delay(1000)]);
  }
}

function openClient(endpoint) {
  return new WebSocket(endpoint);
}

function waitForMessage(socket, predicate, timeoutMs = 10_000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => finish(new Error('Timed out waiting for server message')), timeoutMs);
    const onError = () => finish(new Error('WebSocket connection failed'));
    const onClose = () => finish(new Error('WebSocket closed unexpectedly'));
    const onMessage = (event) => {
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      if (predicate(message)) finish(null, message);
    };
    const finish = (error, message) => {
      clearTimeout(timeout);
      socket.removeEventListener('error', onError);
      socket.removeEventListener('close', onClose);
      socket.removeEventListener('message', onMessage);
      if (error) reject(error);
      else resolve(message);
    };
    socket.addEventListener('error', onError, { once: true });
    socket.addEventListener('close', onClose, { once: true });
    socket.addEventListener('message', onMessage);
  });
}

function send(socket, message) {
  if (socket.readyState !== WebSocket.OPEN) throw new Error('Client socket is not open');
  socket.send(JSON.stringify(message));
}

async function closeClient(socket) {
  if (!socket || socket.readyState === WebSocket.CLOSED) return;
  await new Promise((resolve) => {
    const timeout = setTimeout(resolve, 1000);
    socket.addEventListener('close', () => { clearTimeout(timeout); resolve(); }, { once: true });
    socket.close(1000, 'pathfinding scenario complete');
  });
}

function percentile(values, quantile) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * quantile) - 1];
}

let serverProcess = null;
const clients = [];
const allMoveOrders = [];
const clientNoticeTimes = [];
const firstMovementSnapshotTimes = [];
const tickSamples = [];
const flowSamples = [];
let cleanupPromise = null;
async function cleanupScenario() {
  if (!cleanupPromise) {
    cleanupPromise = (async () => {
      await Promise.all(clients.map((client) => closeClient(client).catch(() => {})));
      await closeServer(serverProcess);
      await rm(mapPath, { force: true });
    })();
  }
  return cleanupPromise;
}
const terminateScenario = (signal) => {
  void cleanupScenario()
    .catch((error) => process.stderr.write(`Scenario cleanup failed: ${error.message}\n`))
    .finally(() => process.exit(signal === 'SIGINT' ? 130 : 143));
};
const onSigterm = () => terminateScenario('SIGTERM');
const onSigint = () => terminateScenario('SIGINT');
process.once('SIGTERM', onSigterm);
process.once('SIGINT', onSigint);
try {
  await writeFile(mapPath, JSON.stringify(mapDefinition, null, 2));
  const port = await unusedPort();
  serverEnv.PORT = String(port);
  serverProcess = spawn(process.execPath, ['server.mjs'], {
    cwd: PROJECT_ROOT,
    env: serverEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  serverProcess.stdoutText = '';
  serverProcess.stderrText = '';
  serverProcess.stdout.setEncoding('utf8').on('data', (chunk) => { serverProcess.stdoutText = (serverProcess.stdoutText + chunk).slice(-4000); });
  serverProcess.stderr.setEncoding('utf8').on('data', (chunk) => { serverProcess.stderrText = (serverProcess.stderrText + chunk).slice(-4000); });

  const healthEndpoint = `http://127.0.0.1:${port}/health`;
  const endpoint = `ws://127.0.0.1:${port}/ws`;
  const initialHealth = await waitForHealth(serverProcess, healthEndpoint);
  assert.equal(initialHealth.map, mapDefinition.id, 'server must load the generated 256×256 map');

  const azure = openClient(endpoint);
  clients.push(azure);
  const azureWelcome = await waitForMessage(azure, (message) => message.type === 'welcome');
  assert.equal(azureWelcome.player.team, 0, 'first client should be Azure');
  const ember = openClient(endpoint);
  clients.push(ember);
  const emberWelcome = await waitForMessage(ember, (message) => message.type === 'welcome');
  assert.equal(emberWelcome.player.team, 1, 'second client should be Ember');

  const permuteSelectionOrder = (ids, multiplier, offset) => ids.slice().sort((left, right) => (
    ((left * multiplier + offset) % 1009) - ((right * multiplier + offset) % 1009)
  ));
  const azureIds = permuteSelectionOrder(Array.from({ length: 1000 }, (_, index) => index), 373, 17);
  const emberIds = permuteSelectionOrder(Array.from({ length: 1000 }, (_, index) => index + 1000), 619, 43);
  for (let repeat = 0; repeat < repeatCount; repeat++) {
    const azureReset = waitForMessage(azure, (message) => message.type === 'state'
      && message.armySize === 2000 && message.units?.length === 2000);
    const emberReset = waitForMessage(ember, (message) => message.type === 'state'
      && message.armySize === 2000 && message.units?.length === 2000);
    send(azure, { type: 'selectArmySize', count: 2000 });
    const [resetState] = await Promise.all([azureReset, emberReset]);

    const before = await (await fetch(healthEndpoint, { cache: 'no-store' })).json();
    const lastOrderId = Math.max(0, ...before.movePlanning.map((sample) => sample.orderId));
    const startingPositions = new Array(2000);
    for (const row of resetState.units) startingPositions[row[0]] = [row[2], row[3]];
    const orderStartedAt = performance.now();
    const firstMovementByTeam = [null, null];
    const movementListeners = [];
    let resolveFirstMovement;
    let movementTimeout;
    const firstMovementVisible = new Promise((resolve) => {
      movementTimeout = setTimeout(() => resolve(false), 5000);
      resolveFirstMovement = () => {
        clearTimeout(movementTimeout);
        resolve(true);
      };
    });
    for (const [team, socket] of [[0, azure], [1, ember]]) {
      const onState = (event) => {
        let message;
        try { message = JSON.parse(event.data); } catch { return; }
        if (firstMovementByTeam[team] !== null || message.type !== 'state'
          || !Array.isArray(message.units)) return;
        const moved = message.units.some((row) => row[1] === team
          && startingPositions[row[0]]
          && Math.hypot(row[2] - startingPositions[row[0]][0],
            row[3] - startingPositions[row[0]][1]) > FIRST_MOVE_VISIBLE_DISTANCE);
        if (moved) {
          firstMovementByTeam[team] = Number((performance.now() - orderStartedAt).toFixed(3));
          if (firstMovementByTeam.every((sample) => sample !== null)) resolveFirstMovement(true);
        }
      };
      socket.addEventListener('message', onState);
      movementListeners.push([socket, onState]);
    }
    const azureOrder = waitForMessage(azure, (message) => message.type === 'notice'
      && message.message?.startsWith('MOVE ORDER'));
    const emberOrder = waitForMessage(ember, (message) => message.type === 'notice'
      && message.message?.startsWith('MOVE ORDER'));
    send(azure, { type: 'move', ids: azureIds, x: 96, z: 0 });
    send(ember, { type: 'move', ids: emberIds, x: -96, z: 0 });
    await Promise.all([azureOrder, emberOrder]);
    const movementVisible = await firstMovementVisible;
    for (const [socket, listener] of movementListeners) socket.removeEventListener('message', listener);
    assert.ok(movementVisible, 'each team should have a moving unit visible in a state snapshot');
    assert.ok(firstMovementByTeam.every((sample) => sample !== null),
      'each team should have a moving unit visible in a state snapshot');
    firstMovementSnapshotTimes.push(...firstMovementByTeam.map((value, team) => ({
      team, value,
    })));
    clientNoticeTimes.push(Number((performance.now() - orderStartedAt).toFixed(3)));
    await delay(200);
    const movementState = await waitForMessage(azure, (message) => message.type === 'state'
      && message.tick >= resetState.tick + 3 && message.units?.length === 2000);
    const movedUnitsAfterBothOrders = movementState.units.reduce((count, row) => (
      count + (Math.hypot(row[2] - startingPositions[row[0]][0], row[3] - startingPositions[row[0]][1]) > 0.1 ? 1 : 0)
    ), 0);
    assert.equal(movedUnitsAfterBothOrders, 2000,
      'every unit should move after both teams receive their move orders');
    const movementSignature = createHash('sha256').update(JSON.stringify(movementState.units)).digest('hex');

    const orderHealth = await (await fetch(healthEndpoint, { cache: 'no-store' })).json();
    const newOrders = orderHealth.movePlanning.filter((sample) => sample.orderId > lastOrderId);
    assert.equal(newOrders.length, 2, 'both teams should produce one move-order measurement');
    assert.ok(newOrders.every((sample) => sample.mode === mode), 'server should run the requested path mode');
    assert.ok(newOrders.every((sample) => sample.unitCount === 1000), 'each order should select 1,000 units');
    assert.ok(newOrders.every((sample) => sample.nonEmptyPaths === 1000), 'each selected unit should receive a path');
    assert.ok(newOrders.every((sample) => sample.uniqueDestinationCells === 1000),
      'all units in each formation should receive distinct walkable destination cells');
    allMoveOrders.push(...newOrders.map((sample) => ({
      ...sample, repeat: repeat + 1, movedUnitsAfterBothOrders, movementSignature,
    })));

    const finalFlowState = measureChokeFlow
      ? waitForMessage(azure, (message) => message.type === 'state'
        && message.tick >= movementState.tick + durationSeconds * 30 && message.units?.length === 2000,
      durationSeconds * 1000 + 10_000)
      : null;
    await delay(Math.max(10_300, durationSeconds * 1000 + 300));
    if (finalFlowState) {
      const settledState = await finalFlowState;
      const startById = new Array(2000);
      for (const row of movementState.units) startById[row[0]] = [row[1], row[2], row[3]];
      let azureCrossedCenter = 0;
      let emberCrossedCenter = 0;
      let azureInPassage = 0;
      let emberInPassage = 0;
      let azureBelowForwardProgress = 0;
      let emberBelowForwardProgress = 0;
      let totalForwardProgress = 0;
      let progressSamples = 0;
      for (const row of settledState.units) {
        const start = startById[row[0]];
        if (!start) continue;
        const team = row[1];
        const crossed = team === 0 ? start[1] < 0 && row[2] >= 0
          : team === 1 && start[1] > 0 && row[2] <= 0;
        const forwardProgress = team === 0 ? row[2] - start[1] : start[1] - row[2];
        const inPassage = Math.abs(row[2]) < 1.5 && row[3] >= -4 && row[3] < 4;
        totalForwardProgress += forwardProgress;
        progressSamples++;
        if (team === 0 && crossed) azureCrossedCenter++;
        if (team === 1 && crossed) emberCrossedCenter++;
        if (team === 0 && inPassage) azureInPassage++;
        if (team === 1 && inPassage) emberInPassage++;
        if (team === 0 && forwardProgress < 24) azureBelowForwardProgress++;
        if (team === 1 && forwardProgress < 24) emberBelowForwardProgress++;
      }
      flowSamples.push({
        azureCrossedCenter,
        emberCrossedCenter,
        totalCrossedCenter: azureCrossedCenter + emberCrossedCenter,
        azureInPassage,
        emberInPassage,
        totalInPassage: azureInPassage + emberInPassage,
        azureBelowForwardProgress,
        emberBelowForwardProgress,
        totalBelowForwardProgress: azureBelowForwardProgress + emberBelowForwardProgress,
        meanForwardProgress: progressSamples > 0 ? totalForwardProgress / progressSamples : 0,
        durationSeconds,
        finalTick: settledState.tick,
      });
      assert.ok(azureCrossedCenter >= 950,
        `Azure should route at least 95% of its army through the passage in ${durationSeconds}s; observed ${azureCrossedCenter}/1000 (Ember ${emberCrossedCenter}/1000)`);
      assert.ok(emberCrossedCenter >= 950,
        `Ember should route at least 95% of its army through the passage in ${durationSeconds}s; observed ${emberCrossedCenter}/1000 (Azure ${azureCrossedCenter}/1000)`);
      assert.ok(Math.abs(azureCrossedCenter - emberCrossedCenter) <= 50,
        `opposing teams should have similar passage throughput; observed Azure ${azureCrossedCenter}/1000 and Ember ${emberCrossedCenter}/1000`);
    }
    const settledHealth = await (await fetch(healthEndpoint, { cache: 'no-store' })).json();
    assert.equal(settledHealth.connected, 2, 'both clients should remain connected');
    assert.equal(settledHealth.armySize, 2000, 'simulation should retain 2,000 units');
    assert.equal(settledHealth.tickTiming.sampleCount, 300, 'collect a full 10-second tick window');
    assert.ok(settledHealth.movePlanning.some((sample) => sample.orderId === newOrders[0].orderId),
      'server should retain order-planning diagnostics');
    tickSamples.push(settledHealth.tickTiming);
  }

  const measurements = [];
  for (const sample of allMoveOrders) {
    measurements.push(
      { metric: 'pathfinding.order_planning_ms', value: sample.elapsedMs, unit: 'ms', aggregation: 'sample' },
      { metric: 'pathfinding.planning_work_ms', value: sample.planningWorkMs, unit: 'ms', aggregation: 'sample' },
      { metric: 'pathfinding.max_planning_slice_ms', value: sample.maxPlanningSliceMs, unit: 'ms', aggregation: 'sample' },
      { metric: 'pathfinding.planning_slice_count', value: sample.planningSliceCount, unit: 'slices', aggregation: 'sample' },
      { metric: 'pathfinding.bfs_searches', value: sample.searchCount, unit: 'searches', aggregation: 'sample' },
      { metric: 'pathfinding.expanded_cells', value: sample.expandedCells, unit: 'cells', aggregation: 'sample' },
      { metric: 'pathfinding.discovered_cells', value: sample.discoveredCells, unit: 'cells', aggregation: 'sample' },
      { metric: 'pathfinding.unique_start_cells', value: sample.uniqueStartCells, unit: 'cells', aggregation: 'sample' },
      { metric: 'pathfinding.unique_destination_cells', value: sample.uniqueDestinationCells, unit: 'cells', aggregation: 'sample' },
      { metric: 'pathfinding.units', value: sample.unitCount, unit: 'units', aggregation: 'sample' },
      { metric: 'pathfinding.non_empty_paths', value: sample.nonEmptyPaths, unit: 'paths', aggregation: 'sample' },
      { metric: 'pathfinding.moved_units_after_both_orders', value: sample.movedUnitsAfterBothOrders, unit: 'units', aggregation: 'sample' },
    );
  }
  for (const sample of clientNoticeTimes) {
    measurements.push({ metric: 'pathfinding.client_notice_ms', value: sample, unit: 'ms', aggregation: 'sample' });
  }
  for (const sample of firstMovementSnapshotTimes) {
    measurements.push({
      metric: `pathfinding.${sample.team === 0 ? 'azure' : 'ember'}_first_movement_snapshot_ms`,
      value: sample.value,
      unit: 'ms',
      aggregation: 'sample',
    });
  }
  for (const sample of tickSamples) {
    measurements.push(
      { metric: 'simulation.tick_p50_ms', value: sample.p50Ms, unit: 'ms', aggregation: 'sample' },
      { metric: 'simulation.tick_p95_ms', value: sample.p95Ms, unit: 'ms', aggregation: 'sample' },
      { metric: 'simulation.tick_max_ms', value: sample.maxMs, unit: 'ms', aggregation: 'sample' },
    );
  }
  for (const sample of flowSamples) {
    measurements.push(
      { metric: 'choke.units_crossed_center', value: sample.totalCrossedCenter, unit: 'units', aggregation: 'sample' },
      { metric: 'choke.azure_units_crossed_center', value: sample.azureCrossedCenter, unit: 'units', aggregation: 'sample' },
      { metric: 'choke.ember_units_crossed_center', value: sample.emberCrossedCenter, unit: 'units', aggregation: 'sample' },
      { metric: 'choke.units_in_passage', value: sample.totalInPassage, unit: 'units', aggregation: 'sample' },
      { metric: 'choke.azure_units_in_passage', value: sample.azureInPassage, unit: 'units', aggregation: 'sample' },
      { metric: 'choke.ember_units_in_passage', value: sample.emberInPassage, unit: 'units', aggregation: 'sample' },
      { metric: 'choke.units_below_24_forward_progress', value: sample.totalBelowForwardProgress, unit: 'units', aggregation: 'sample' },
      { metric: 'choke.mean_forward_progress', value: sample.meanForwardProgress, unit: 'world_units', aggregation: 'sample' },
      { metric: 'choke.crossing_rate', value: sample.totalCrossedCenter / sample.durationSeconds, unit: 'units_per_second', aggregation: 'sample' },
    );
  }

  await mkdir(runDir, { recursive: true });
  await writeFile(capturePath, JSON.stringify({
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
        revision: `pathfinding-${mode}-cooperative`,
        mapKind, width, height, units: 2000, unitsPerTeam: 1000, repeats: repeatCount,
        durationSeconds, flowMode,
      },
      notes: [
        'CPU-only local diagnostic on the current machine; not a target-hardware guarantee.',
        `Path search variant: ${mode}.`,
        'Move planning yields between short batches of start-cell searches so simulation ticks and network messages can continue.',
        mapKind === 'choke'
          ? `Map has a vertical two-cell wall with a centered ${gateRows.end - gateRows.start}-cell passage.`
          : 'Map is open terrain with no obstacles.',
        'Both full-army move commands use deterministic permuted unit-ID order to exercise selection-order-independent formation assignment.',
        'Two clients issue simultaneous full-army move orders; server planning time excludes network transport.',
        `First-movement timing is dispatch-to-first-visible-state-snapshot per player after ${FIRST_MOVE_VISIBLE_DISTANCE} world units of displacement, and includes local WebSocket delivery.`,
        ...(measureChokeFlow ? [
          `After ${durationSeconds} seconds of movement, the scenario counts units that crossed the map center, units inside the eight-cell passage, and units with less than 24 world units of forward progress.`,
          'Both teams issue ordinary move orders; the scenario measures passage flow without combat damage.',
        ] : []),
      ],
    },
  }, null, 2));
  console.log(JSON.stringify({
    map: mapKind,
    mode,
    repeats: repeatCount,
    orderPlanningMs: allMoveOrders.map((sample) => sample.elapsedMs),
    bfsSearches: allMoveOrders.map((sample) => sample.searchCount),
    expandedCells: allMoveOrders.map((sample) => sample.expandedCells),
    uniqueStartCells: allMoveOrders.map((sample) => sample.uniqueStartCells),
    uniqueDestinationCells: allMoveOrders.map((sample) => sample.uniqueDestinationCells),
    nonEmptyPaths: allMoveOrders.map((sample) => sample.nonEmptyPaths),
    movedUnitsAfterBothOrders: allMoveOrders.map((sample) => sample.movedUnitsAfterBothOrders),
    flowSamples,
    movementSignatures: [...new Set(allMoveOrders.map((sample) => sample.movementSignature))],
    clientNoticeMs: clientNoticeTimes,
    firstMovementSnapshotMs: firstMovementSnapshotTimes,
    tickP95Ms: tickSamples.map((sample) => sample.p95Ms),
    capturePath,
  }));
} catch (error) {
  const serverOutput = [serverProcess?.stderrText, serverProcess?.stdoutText].filter(Boolean).join('\n').trim();
  if (!serverOutput) throw error;
  const message = error instanceof Error ? error.message : String(error);
  throw new Error(`${message}\nRTS server output:\n${serverOutput}`, { cause: error });
} finally {
  process.removeListener('SIGTERM', onSigterm);
  process.removeListener('SIGINT', onSigint);
  await cleanupScenario();
}
