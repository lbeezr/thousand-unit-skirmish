import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';

// Disposable source-identifying diagnostic, not a controlled capacity benchmark.
// Usage: node reproduction.mjs /absolute/repository /absolute/output-directory
const root = path.resolve(process.argv[2]);
const output = path.resolve(process.argv[3]);
const temp = await mkdtemp(path.join(os.tmpdir(), 'rts-terraced-vale-scale-'));
await mkdir(output, { recursive: true });
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const digest = data => createHash('sha256').update(data).digest('hex');
const report = {
  schemaVersion: 1, startedAt: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  trackedDiff: execFileSync('git', ['diff', 'HEAD', '--'], { cwd: root, encoding: 'utf8' }),
  inputSHA256: Object.fromEntries(await Promise.all(['server.mjs', 'simulation-scheduler.mjs',
    'maps/veyrholds-terraced-vale.json', 'scripts/performance-scenario.mjs'].map(async file =>
    [file, digest(await readFile(path.join(root, file)))]))),
  host: { node: process.version, platform: os.platform(), release: os.release(), arch: os.arch(),
    cpuModel: os.cpus()[0]?.model, logicalCPUs: os.cpus().length, availableParallelism: os.availableParallelism(),
    totalMemoryBytes: os.totalmem(), freeMemoryBytes: os.freemem(), loadBefore: os.loadavg(),
    powerState: 'unavailable', isolatedHost: false },
  workload: { map: 'veyrholds-terraced-vale', dimensions: [160, 160], fogOfWar: true,
    seed: 93025, clockPhase: '24 starting units; two connected idle teams; 10 seconds',
    loadPhase: 'existing performance-scenario; 2000 units; two 1000-unit box moves toward x=-6/+6,z=0; 10 seconds; one window',
    tickDiagnostics: true, separationDiagnostics: false, checkpointEveryGameSeconds: 1,
    extraLoadInstrumentation: '1 Hz health request and local checkpoint parse; no extra observer peer',
    hardwarePerformanceEvidenceAdmitted: false },
  limits: { controlledComparison: false, fullArrivalMeasured: false, formationSpreadMeasured: false,
    browserMeasured: false, hostedMeasured: false, humanMatchMeasured: false,
    capacityClaim: false },
};
function start(args, env) {
  const child = spawn(process.execPath, args, { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.on('data', chunk => { stderr += chunk; });
  child.capture = () => ({ stdout, stderr });
  child.done = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });
  return child;
}
async function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGINT');
  const exited = await Promise.race([child.done.then(() => true), wait(3000).then(() => false)]);
  if (!exited) { child.kill('SIGKILL'); await child.done; }
}
async function port() {
  const server = createServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const value = server.address().port; await new Promise(resolve => server.close(resolve)); return value;
}
function message(socket, predicate, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => finish(new Error('State timeout')), timeoutMs);
    const onError = () => finish(new Error('WebSocket error'));
    const onMessage = event => { let data; try { data = JSON.parse(event.data); } catch { return; }
      if (predicate(data)) finish(null, { data, receivedAt: performance.now() }); };
    function finish(error, value) { clearTimeout(timeout); socket.removeEventListener('message', onMessage);
      socket.removeEventListener('error', onError); error ? reject(error) : resolve(value); }
    socket.addEventListener('message', onMessage); socket.addEventListener('error', onError);
  });
}
async function phase(name, action) {
  const portNumber = await port();
  const checkpoint = path.join(temp, name, 'checkpoint.json');
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('RTS_')));
  Object.assign(env, { PORT: String(portNumber), RTS_HOST: '127.0.0.1',
    RTS_MAP: 'maps/veyrholds-terraced-vale.json', RTS_CUSTOM_MAP_DIRECTORY: path.join(temp, name, 'custom-maps'),
    RTS_MATCH_STATE_PATH: checkpoint, RTS_TICK_DIAGNOSTICS: '1' });
  const server = start(['server.mjs'], env);
  const health = async () => { const response = await fetch(`http://127.0.0.1:${portNumber}/health`,
    { signal: AbortSignal.timeout(5000) }); assert.equal(response.status, 200); return response.json(); };
  try {
    let ready;
    for (let attempt = 0; attempt < 150; attempt++) {
      if (server.exitCode !== null) throw new Error(`Server exited: ${server.capture().stderr}`);
      try { ready = await health(); break; } catch { await wait(100); }
    }
    assert.equal(ready?.map, 'veyrholds-terraced-vale');
    report[name] = await action({ portNumber, health, checkpoint });
  } finally { await stop(server); const logs = server.capture();
    await writeFile(path.join(output, `${name}-server.log`), logs.stdout + logs.stderr); }
}
try {
  await phase('openingClock', async ({ portNumber, health, checkpoint }) => {
    const sockets = [];
    try {
      for (const team of [0, 1]) { const socket = new WebSocket(`ws://127.0.0.1:${portNumber}/ws`, ['rts-v1']);
        sockets.push(socket); const welcome = await message(socket, data => data.type === 'welcome');
        assert.equal(welcome.data.player.team, team); assert.equal(welcome.data.state.armySize, 24); }
      const readClock = async () => { const data = JSON.parse(await readFile(checkpoint, 'utf8'));
        return { tick: data.state.tickNumber, gameSeconds: data.state.matchElapsedSeconds,
          savedAt: data.savedAt, armySize: data.state.currentArmySize,
          started: data.state.scenarioClockStarted }; };
      let first;
      for (let attempt = 0; attempt < 150; attempt++) {
        try { first = await readClock(); if (first.started) break; } catch {}
        await wait(100);
      }
      assert.equal(first?.started, true); assert.equal(first.armySize, 24);
      await wait(10000);
      const last = await readClock();
      const wallSeconds = (last.savedAt - first.savedAt) / 1000;
      const gameSeconds = last.gameSeconds - first.gameSeconds;
      return { first, last,
        wallSeconds, gameSeconds, gameSecondsPerWallSecond: gameSeconds / wallSeconds,
        clockMethod: 'local checkpoint capture savedAt timestamps; idle network state may be suppressed',
        clockResolutionGameSeconds: 1 / 30, health: await health() };
    } finally { for (const socket of sockets) socket.close(); }
  });
  await phase('loadDiagnostic', async ({ portNumber, health, checkpoint }) => {
    const collector = start(['scripts/performance-scenario.mjs', String(portNumber), '10', '1', 'move', 'box'], process.env);
    const samples = []; let completed = false;
    const monitor = (async () => {
      while (!completed) {
        const healthSample = await health(); let clock = null;
        try { const data = JSON.parse(await readFile(checkpoint, 'utf8'));
          clock = { sequence: data.sequence, savedAt: data.savedAt, tick: data.state.tickNumber,
            armySize: data.state.currentArmySize, gameSeconds: data.state.matchElapsedSeconds,
            scenarioClockStarted: data.state.scenarioClockStarted }; } catch {}
        samples.push({ observedAt: new Date().toISOString(), health: healthSample, clock });
        await wait(1000);
      }
    })();
    let exit, timeout;
    try { exit = await Promise.race([collector.done, new Promise(resolve => {
      timeout = setTimeout(async () => { await stop(collector);
        resolve({ code: null, signal: 'diagnostic-timeout' }); }, 45000);
    })]); }
    finally { clearTimeout(timeout); completed = true; await monitor; await stop(collector); }
    const logs = collector.capture();
    await writeFile(path.join(output, 'collector.stdout.json'), logs.stdout);
    await writeFile(path.join(output, 'collector.stderr.log'), logs.stderr);
    const parsed = exit.code === 0 ? JSON.parse(logs.stdout) : null;
    const clocks = samples.filter(sample => sample.health.connected === 2).map(sample => sample.clock)
      .filter(clock => clock?.armySize === 2000 && clock.scenarioClockStarted)
      .filter((clock, index, all) => index === 0 || clock.sequence !== all[index - 1].sequence);
    const first = clocks[0], last = clocks.at(-1);
    const clock = first && last && last.savedAt > first.savedAt ? {
      first, last, gameSeconds: last.gameSeconds - first.gameSeconds,
      wallSeconds: (last.savedAt - first.savedAt) / 1000,
      gameSecondsPerWallSecond: (last.gameSeconds - first.gameSeconds) / ((last.savedAt - first.savedAt) / 1000),
      wallClockMethod: 'checkpoint capture savedAt timestamps, one game-second cadence; no post-disconnect sample',
    } : null;
    return { exit, passed: exit.code === 0, checkpointClock: clock,
      compressedTransportPeers: parsed?.measurements.at(-1)?.transport.compressionPeers ?? null,
      unitsMovedTotal: parsed?.measurements.at(-1)?.unitsMovedAfterFirstSnapshot ?? null,
      unitsMovedByTeam: parsed?.measurements.at(-1)?.unitsMovedByTeam ?? null,
      collectorLimit: 'Fog-enabled total spans disclosed snapshots; per-seat own-team movement fields are authoritative.',
      samples };
  });
} catch (error) { report.error = { name: error.name, message: error.message, stack: error.stack }; process.exitCode = 1; }
finally {
  report.finishedAt = new Date().toISOString(); report.host.loadAfter = os.loadavg();
  try { await writeFile(path.join(output, 'diagnostic.json'), JSON.stringify(report, null, 2) + '\n'); }
  finally { await rm(temp, { recursive: true, force: true }); }
}
console.log(JSON.stringify({ output, error: report.error ?? null,
  openingGameWallRatio: report.openingClock?.gameSecondsPerWallSecond,
  loadPassed: report.loadDiagnostic?.passed,
  loadGameWallRatio: report.loadDiagnostic?.checkpointClock?.gameSecondsPerWallSecond }, null, 2));
