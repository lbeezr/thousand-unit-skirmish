import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { capturedBudgetEnvelope, capturedTickAttribution, capturedInnerAttribution } from './map-capacity-report-check.mjs';
import { createTickAttributionAdapter } from './tick-attribution-adapter.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const options = { map: 'veyrholds-threefold-basin', loads: '24,250,500,1000', seconds: '10', 'rss-stop-mib': '512', attribution: 'off' };
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i].replace(/^--/, '');
  assert.ok(['map', 'loads', 'seconds', 'output', 'rss-stop-mib', 'attribution'].includes(key) && process.argv[i + 1], 'Use --map ID --loads CSV --seconds N --output DIR --rss-stop-mib N --attribution off|on.');
  options[key] = process.argv[i + 1];
}
assert.ok(['veyrholds-terraced-vale', 'veyrholds-threefold-basin', 'veyrholds-riven-escarpment', 'veyrholds-crownroads'].includes(options.map));
const loads = options.loads.split(',').map(Number), seconds = Number(options.seconds), rssStop = Number(options['rss-stop-mib']) * 1024 ** 2;
assert.ok(loads.length >= 1 && loads.length <= 5 && new Set(loads).size === loads.length && loads.every(n => [24, 250, 500, 1000, 2000].includes(n)));
assert.ok(Number.isInteger(seconds) && seconds >= 10 && seconds <= 60);
assert.ok(Number.isFinite(rssStop) && rssStop >= 128 * 1024 ** 2 && rssStop <= 2048 * 1024 ** 2);
assert.ok(['off', 'on'].includes(options.attribution));
const innerAttribution = options.attribution === 'on';
assert.ok(!innerAttribution || (options.map === 'veyrholds-crownroads' && loads.length === 1 && loads[0] === 24 && seconds === 10),
  'Inner attribution is bounded to Crownroads, 24 units and ten-second waves');
const output = options.output ? path.resolve(options.output) : await mkdtemp(path.join(os.tmpdir(), 'rts-map-capacity-report-'));
await mkdir(output, { recursive: true });
const temp = await mkdtemp(path.join(os.tmpdir(), 'rts-map-capacity-'));
const mapBytes = await readFile(path.join(ROOT, 'maps', `${options.map}.json`)), map = JSON.parse(mapBytes);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const report = { schemaVersion: 1, sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
  sourceDirty: Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).trim()),
  mapId: map.id, mapSHA256: hash(mapBytes), scriptSHA256: hash(await readFile(fileURLToPath(import.meta.url))),
  reportCheckSHA256: hash(await readFile(new URL('./map-capacity-report-check.mjs', import.meta.url))),
  serverSHA256: hash(await readFile(path.join(ROOT, 'server.mjs'))),
  attributionMode: options.attribution,
  attributionSources: innerAttribution ? {
    adapterSHA256: hash(await readFile(new URL('./tick-attribution-adapter.mjs', import.meta.url))),
    observerSHA256: hash(await readFile(new URL('./tick-attribution-observer.mjs', import.meta.url))) } : null,
  startedAt: new Date().toISOString(), host: { platform: process.platform, arch: process.arch, cpus: os.cpus().length,
    cpuModel: os.cpus()[0]?.model, memoryBytes: os.totalmem(), loadBefore: os.loadavg(), isolated: false },
  workload: { loads, wavesPerLoad: 3, minimumWallSecondsPerWave: seconds, minimumGameTicksAfterAcceptance: 300, fog: true, opening: '4 Workers per seat plus Infantry; existing selectArmySize diagnostics above 24',
    memoryStopBytes: rssStop, capacityClaim: false, fullArmyArrival: false, paidEconomy: false, browser: false, hosted: false,
    clockMethod: 'checkpoint game seconds divided by checkpoint capture savedAt wall timestamps within each wave',
    noticeMethod: 'clientOrderToken final notice receipt; first observed movement from an authoritative stopped checkpoint baseline, neither is exact server application' }, loads: [] };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const round = value => Number(value.toFixed(3));
const own = (state, team) => state.units.filter(u => u[1] === team && u[4] > 0);
const moved = (before, after, team) => { const starts = new Map(own(before, team).map(u => [u[0], u]));
  return own(after, team).filter(u => starts.has(u[0]) && Math.hypot(u[2] - starts.get(u[0])[2], u[3] - starts.get(u[0])[3]) > .1).length; };
async function processRss(pid) {
  if (process.platform === 'linux') {
    const text = await readFile(`/proc/${pid}/status`, 'utf8'); return Number(text.match(/^VmRSS:\s+(\d+)\s+kB/m)?.[1]) * 1024;
  }
  if (process.platform === 'darwin') return Number(execFileSync('ps', ['-o', 'rss=', '-p', String(pid)], { encoding: 'utf8' }).trim()) * 1024;
  return null;
}
async function port() { const listener = createServer(); listener.listen(0, '127.0.0.1'); await once(listener, 'listening');
  const value = listener.address().port; await new Promise(resolve => listener.close(resolve)); return value; }
async function stop(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, 'exit'); child.kill('SIGINT'); let timer;
  const done = await Promise.race([exited.then(() => true), new Promise(resolve => { timer = setTimeout(() => resolve(false), 5000); })]);
  clearTimeout(timer); if (!done) { child.kill('SIGKILL'); await exited; }
}
async function client(portNumber, team, token = null) {
  const socket = new WebSocket(`ws://127.0.0.1:${portNumber}/ws`, ['rts-v1', ...(token ? [`rts-resume.${token}`] : [])]);
  const waiters = [], c = { team, socket, current: null, welcome: null };
  c.wait = (predicate, timeoutMs = 20000) => new Promise((resolve, reject) => {
    const waiter = { predicate, resolve, reject, timer: setTimeout(() => finish(waiter, new Error(`Team ${team} response timeout`)), timeoutMs) };
    waiters.push(waiter);
  });
  function finish(w, error, row) { const i = waiters.indexOf(w); if (i < 0) return; waiters.splice(i, 1); clearTimeout(w.timer); error ? w.reject(error) : w.resolve(row); }
  socket.addEventListener('message', event => {
    const row = JSON.parse(event.data); if (row.type === 'state') c.current = row; if (row.state) c.current = row.state;
    for (const w of [...waiters]) if (w.predicate(row)) finish(w, null, row);
  });
  for (const event of ['close', 'error']) socket.addEventListener(event, () => {
    for (const w of [...waiters]) finish(w, new Error(`Team ${team} socket ${event}`));
  });
  c.send = command => socket.send(JSON.stringify(command));
  c.close = async () => { if (socket.readyState === WebSocket.CLOSED) return;
    const closed = once(socket, 'close'); socket.close(); await closed; };
  try { c.welcome = await c.wait(row => row.type === 'welcome'); assert.equal(c.welcome.player.team, team); return c; }
  catch (error) { await c.close(); throw error; }
}
let nextToken = 1;
async function order(c, command, prefix) {
  const token = nextToken++, began = performance.now();
  const receipt = c.wait(row => row.type === 'notice' && row.clientOrderToken === token && !row.message?.startsWith('PLANNING '));
  c.send({ ...command, clientOrderToken: token }); const row = await receipt;
  assert.ok(row.message.startsWith(prefix), row.message); return round(performance.now() - began);
}
async function checkGridBoundaries(clients, health) {
  const c = clients[0];
  const results = [];
  for (const [width, height] of [[257, 256], [256, 257], [320, 320], [256, 256]]) {
    const definition = { id: 'lab-grid-limit-boundary', name: 'Grid limit probe', width, height,
      fogOfWar: true, startingArmySize: 24, spawnPoints: [{ team: 0, x: -80.5, z: .5 }, { team: 1, x: 80.5, z: .5 }],
      obstacles: [], resourceNodes: [], triggers: [], scenarioEvents: [] };
    const before = await health(); const response = c.wait(row => ['mapRejected', 'mapPublished'].includes(row.type));
    c.send({ type: 'publishMap', map: definition }); const row = await response;
    const accepted = width === 256 && height === 256;
    assert.equal(row.type, accepted ? 'mapPublished' : 'mapRejected');
    if (!accepted) { assert.match(row.message, /between 16 and 256/); assert.equal((await health()).map, before.map); }
    results.push({ width, height, accepted, message: row.message ?? null });
  }
  // Both peers must receive the selected map's authoritative mapChange state.
  // Pregame need not broadcast a later periodic state before an order.
  const changed = clients.map(peer => peer.wait(row => row.type === 'mapChange' && row.map.id === map.id));
  c.send({ type: 'selectMap', mapId: map.id }); await Promise.all(changed);
  return results;
}
async function runLoad(count) {
  const record = { armySize: count, waves: [], samples: [], passed: false }; report.loads.push(record);
  const tickRows = new Map(); let workerRun = 0;
  const adapter = innerAttribution ? await createTickAttributionAdapter({ simulation: true }) : null;
  if (adapter) record.attributionRuns = [];
  const checkpoint = path.join(temp, String(count), 'match.json'), portNumber = await port();
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('RTS_')));
  Object.assign(env, { PORT: String(portNumber), RTS_HOST: '127.0.0.1', RTS_MAP: `maps/${map.id}.json`,
    RTS_CUSTOM_MAP_DIRECTORY: path.join(temp, String(count), 'custom'), RTS_MATCH_STATE_PATH: checkpoint,
    RTS_TICK_DIAGNOSTICS: '1', RTS_SEPARATION_DIAGNOSTICS: '1' });
  let child, clients = [], logs = '', attributionStart = null;
  const controlAttribution = async action => {
    const response = await fetch(`http://127.0.0.1:${portNumber}/__attribution/${action}`, { signal: AbortSignal.timeout(15000) });
    assert.equal(response.status, 200); return response.json();
  };
  const finishAttribution = async () => {
    if (!attributionStart) return;
    const observed = await controlAttribution('stop');
    record.attributionRuns.push({ workerRun, originalSha256: adapter.originalSha256,
      adapterSha256: adapter.adapterSha256, start: attributionStart, ...observed });
    attributionStart = null;
  };
  const launch = async () => {
    workerRun++;
    child = spawn(process.execPath, [adapter?.filename ?? 'server.mjs'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', chunk => { logs += chunk; }); child.stderr.on('data', chunk => { logs += chunk; });
    for (let attempt = 0; attempt < 150; attempt++) {
      if (child.exitCode !== null) throw new Error(`Server exited: ${logs.slice(-2000)}`);
      let ready = false;
      try { ready = (await health()).ok; } catch {}
      if (ready) { if (adapter) attributionStart = await controlAttribution('start'); return; }
      await sleep(100);
    }
    throw new Error('Server readiness timeout');
  };
  const health = async () => { const response = await fetch(`http://127.0.0.1:${portNumber}/health?tickSamples=1`, { signal: AbortSignal.timeout(5000) });
    assert.equal(response.status, 200); return response.json(); };
  const capture = async () => {
    const data = await health(), rss = await processRss(child.pid);
    assert.ok(Array.isArray(data.tickTiming.samples), 'Opt-in raw tick diagnostics must be available');
    for (const diagnostic of data.tickTiming.samples) {
      const row = { workerRun, ...diagnostic };
      const key = JSON.stringify([workerRun, row.matchId, row.mapId, row.tickNumber]);
      assert.ok(!tickRows.has(key) || JSON.stringify(tickRows.get(key)) === JSON.stringify(row),
        'Repeated diagnostic tick identity must preserve its values');
      tickRows.set(key, row);
    }
    // Preserve unique rows once, rather than duplicating rolling arrays in every sample.
    delete data.tickTiming.samples;
    let clock = null, pathStorage = null;
    try { const saved = JSON.parse(await readFile(checkpoint, 'utf8')); clock = { tick: saved.state.tickNumber,
      gameSeconds: saved.state.matchElapsedSeconds, savedAt: saved.savedAt, sequence: saved.sequence, armySize: saved.state.currentArmySize };
      const paths = saved.state.units.flatMap(u => [u.path, ...(u.attackMoveResumePath ? [u.attackMoveResumePath] : [])]);
      pathStorage = { totalIndices: paths.reduce((sum, p) => sum + p.length, 0), maxPathIndices: Math.max(0, ...paths.map(p => p.length)) };
    } catch {}
    const sample = { observedAt: new Date().toISOString(), workerRun, serverRssBytes: rss, collectorRssBytes: process.memoryUsage().rss, health: data, clock, pathStorage };
    record.samples.push(sample);
    if (rss !== null) assert.ok(Number.isFinite(rss) && rss <= rssStop, `Server RSS ${rss} exceeds probe stop ${rssStop}`);
    return sample;
  };
  try {
    await launch(); clients.push(await client(portNumber, 0)); clients.push(await client(portNumber, 1));
    assert.ok(clients[0].welcome.maps.some(m => m.id === map.id && !m.name.startsWith('Lab')));
    if (!report.gridBoundaryProtocol) report.gridBoundaryProtocol = await checkGridBoundaries(clients, health);
    if (count !== 24) {
      const waits = clients.map(c => c.wait(row => row.type === 'state' && row.armySize === count));
      clients[0].send({ type: 'selectArmySize', count }); await Promise.all(waits);
    }
    for (const c of clients) {
      assert.equal(c.current.mapId, map.id);
      assert.equal(c.current.armySize, count); assert.equal(own(c.current, c.team).length, count / 2);
      assert.equal(Buffer.from(c.current.visibility.data, 'base64').length, Math.ceil(map.width * map.height / 4));
      await order(c, { type: 'setStance', ids: own(c.current, c.team).map(u => u[0]), stance: 'noAttack' }, 'STANCE ORDER');
    }
    const targets = map.id === 'veyrholds-crownroads' ? [['north-pass', -34.5, 20], ['high-flank', -96.5, 20], ['causeway', 94.5, 20]]
      : map.id === 'veyrholds-riven-escarpment' ? [['north-pass', -24.5, 18], ['high-flank', -79.5, 18], ['causeway', 73.5, 18]]
      : map.width === 192 ? [['north-pass', -15.5, 24], ['high-flank', -55.5, 12], ['causeway', 56.5, 24]]
      : [['north-pass', -15.5, 24], ['high-flank', -40.5, 12], ['south-pass', 16.5, 24]];
    for (const [name, z, offset] of targets) {
      // Stop prior waves and wait for a captured stopped baseline. Otherwise an
      // old route's movement could be misattributed to the new order's latency.
      await Promise.all(clients.map(c => order(c, { type: 'stop', ids: own(c.current, c.team).map(u => u[0]) }, 'STOP ORDER')));
      const stoppedAt = Date.now(), stopDeadline = performance.now() + 5000;
      let stopped;
      do {
        try { const saved = JSON.parse(await readFile(checkpoint, 'utf8'));
          if (saved.savedAt >= stoppedAt && saved.state.units.every(u => u.path.length === 0)) stopped = saved; } catch {}
        if (!stopped) await sleep(100);
      } while (!stopped && performance.now() < stopDeadline);
      assert.ok(stopped, 'Each wave needs an authoritative post-Stop baseline');
      const before = await capture();
      const starts = clients.map(() => ({ tick: stopped.state.tickNumber,
        units: stopped.state.units.map(u => [u.id, u.team, u.x, u.z, u.hp, u.kind]) }));
      const priorOrder = Math.max(0, ...before.health.movePlanning.map(p => p.orderId)), began = performance.now(), phaseWall = Date.now();
      const movement = clients.map((c, i) => {
        const p = c.wait(row => row.type === 'state' && row.tick > starts[i].tick && moved(starts[i], row, c.team) > 0)
          .then(() => round(performance.now() - began)); p.catch(() => {}); return p;
      });
      let noticesFinished = false;
      const notices = Promise.all(clients.map(c => order(c, { type: 'move', ids: own(c.current, c.team).map(u => u[0]),
        x: c.team === 0 ? offset : -offset, z, formation: 'box' }, 'MOVE ORDER'))).finally(() => { noticesFinished = true; });
      notices.catch(() => {});
      while (!noticesFinished) {
        await Promise.race([notices.catch(() => {}), sleep(1000)]); await capture();
      }
      const noticeMs = await notices;
      // Final notices have no tick. A later captured checkpoint supplies a
      // conservative post-acceptance tick, excluding all preparation ticks.
      const acceptedAt = Date.now(), acceptanceDeadline = performance.now() + 5000;
      let acceptedWindowStart;
      do {
        try { const saved = JSON.parse(await readFile(checkpoint, 'utf8'));
          if (saved.savedAt >= acceptedAt) acceptedWindowStart = { tick: saved.state.tickNumber, savedAt: saved.savedAt }; } catch {}
        if (!acceptedWindowStart) await sleep(100);
      } while (!acceptedWindowStart && performance.now() < acceptanceDeadline);
      assert.ok(acceptedWindowStart, 'Each wave needs a conservative post-acceptance tick');
      while (performance.now() - began < seconds * 1000) { await sleep(Math.min(1000, seconds * 1000 - (performance.now() - began))); await capture(); }
      // Fill the actual 300-tick sample window even if the scheduler skipped slots.
      let after = await capture(); const deadline = performance.now() + 5000;
      while ((after.health.tickTiming.sampleCount < 300 || clients[0].current.tick - acceptedWindowStart.tick < 300) && performance.now() < deadline) {
        await sleep(100); after = await capture();
      }
      const plans = after.health.movePlanning.filter(p => p.orderId > priorOrder);
      const counts = clients.map((c, i) => moved(starts[i], c.current, c.team));
      const clockSamples = record.samples.filter(s => s.clock?.armySize === count && s.clock.savedAt >= (before.clock?.savedAt ?? phaseWall));
      const firstClock = clockSamples[0]?.clock, lastClock = clockSamples.at(-1)?.clock;
      const clock = firstClock && lastClock && lastClock.savedAt > firstClock.savedAt ? {
        gameSeconds: lastClock.gameSeconds - firstClock.gameSeconds, wallSeconds: (lastClock.savedAt - firstClock.savedAt) / 1000,
        factor: (lastClock.gameSeconds - firstClock.gameSeconds) / ((lastClock.savedAt - firstClock.savedAt) / 1000) } : null;
      const wave = { targetRegion: name, targetZ: z, finalNoticeReceiptMs: noticeMs, firstObservedMovementReceiptMs: await Promise.all(movement),
        stoppedBaseline: { tick: stopped.state.tickNumber, savedAt: stopped.savedAt, unitsWithEmptyPaths: stopped.state.units.length },
        acceptedWindowStart, observedGameTicksAfterAcceptance: clients[0].current.tick - acceptedWindowStart.tick,
        exactServerApplicationMs: null, movedBySeat: counts, fullArmyArrival: false, planning: plans, clock,
        tickTiming: after.health.tickTiming, separationWork: after.health.separationWork, checkpoint: after.health.checkpoint,
        transport: { compressedPeers: after.health.transport.compressionPeers,
          wallSeconds: round((performance.now() - began) / 1000),
          jsonPayloadDelta: after.health.transport.jsonPayloadBytesSent - before.health.transport.jsonPayloadBytesSent,
          jsonWireDelta: after.health.transport.jsonWireBytesSent - before.health.transport.jsonWireBytesSent,
          compressedPayloadDelta: after.health.transport.compressedPayloadBytesSent - before.health.transport.compressedPayloadBytesSent,
          compressedWireDelta: after.health.transport.compressedWireBytesSent - before.health.transport.compressedWireBytesSent,
          queuedBytes: after.health.transport.queuedBytes, peakQueuedBytes: after.health.transport.peakQueuedBytes,
          coalescedStateSnapshots: after.health.transport.coalescedStateSnapshots },
        skippedSlotDelta: after.health.tickTiming.scheduler.skippedTickSlotsTotal - before.health.tickTiming.scheduler.skippedTickSlotsTotal };
      record.waves.push(wave);
      assert.equal(plans.length, 2); assert.equal(after.health.tickTiming.sampleCount, 300);
      assert.ok(Number.isFinite(after.health.tickTiming.p99Ms)
        && after.health.tickTiming.p95Ms <= after.health.tickTiming.p99Ms
        && after.health.tickTiming.p99Ms <= after.health.tickTiming.maxMs);
      assert.ok(Number.isInteger(after.health.tickTiming.overBudgetTickCount)
        && after.health.tickTiming.overBudgetTickCount >= 0
        && after.health.tickTiming.overBudgetTickCount <= after.health.tickTiming.sampleCount);
      assert.ok(clients[0].current.tick - acceptedWindowStart.tick >= 300, 'Each wave must include 300 game ticks after acceptance');
      assert.equal(after.health.connected, 2); assert.equal(after.health.checkpoint.failures, 0);
      for (const p of plans) { assert.equal(p.unitCount, count / 2); assert.equal(p.routeFailures, 0);
        assert.equal(p.nonEmptyPaths + p.alreadyInDestinationCell, p.unitCount); }
      assert.ok(counts.every(n => n >= count / 2 * .95), 'At least 95% of both seats must move in each wave window');
      assert.ok(after.health.tickTiming.p95Ms <= 1000 / 30 && after.health.tickTiming.maxMs <= 100);
      assert.ok(after.health.tickTiming.startLagP95Ms <= 1000 / 30 && after.health.tickTiming.startLagMaxMs <= 100);
      record.capturedBudgetEnvelope = capturedBudgetEnvelope(record.samples, record.waves.flatMap(w => w.planning));
      assert.ok(record.capturedBudgetEnvelope.passed, 'All captured windows and planning slices must meet the diagnostic budgets');
      console.log(JSON.stringify({ armySize: count, targetRegion: name, movedBySeat: counts,
        tickP95Ms: after.health.tickTiming.p95Ms, tickP99Ms: after.health.tickTiming.p99Ms,
        overBudgetTickCount: after.health.tickTiming.overBudgetTickCount, skippedSlotDelta: wave.skippedSlotDelta }));
    }
    const tokens = clients.map(c => c.welcome.player.sessionToken), matchId = clients[0].current.matchId;
    await finishAttribution();
    await Promise.all(clients.map(c => c.close())); clients = []; await stop(child); await launch();
    clients.push(await client(portNumber, 0, tokens[0])); clients.push(await client(portNumber, 1, tokens[1]));
    const recovery = await health();
    assert.equal(recovery.checkpoint.recovered, true); assert.equal(recovery.map, map.id); assert.equal(recovery.armySize, count);
    for (const c of clients) { assert.equal(c.welcome.player.resumed, true); assert.equal(c.current.matchId, matchId); }
    await capture(); record.coldRecovery = true;
    await finishAttribution();
    record.capturedBudgetEnvelope = capturedBudgetEnvelope(record.samples, record.waves.flatMap(w => w.planning));
    assert.ok(record.capturedBudgetEnvelope.passed, 'All captured windows, including cold recovery, must meet the diagnostic budgets');
    record.tickRows = [...tickRows.values()];
    record.tickAttribution = capturedTickAttribution(record.tickRows, map.id);
    assert.equal(record.tickAttribution.status, 'valid-observations', 'Retained raw ticks must have identified, consistent phase fields');
    if (adapter) {
      record.innerAttribution = capturedInnerAttribution(record.attributionRuns, record.tickRows, map.id);
      assert.equal(record.innerAttribution.status, 'valid-observations', 'Inner rows must retain valid unique identities and bounded capture');
    }
    console.log(JSON.stringify({ armySize: count, uniqueAttributedTicks: record.tickAttribution.uniqueObservedTicks,
      overBudgetTicks: record.tickAttribution.overBudgetTicks, dominantPhaseCounts: record.tickAttribution.overrunDominantPhaseCounts }));
    record.peakServerRssBytes = Math.max(...record.samples.map(s => s.serverRssBytes ?? 0)); record.passed = true;
  } finally {
    record.tickRows = [...tickRows.values()];
    record.tickAttribution = capturedTickAttribution(record.tickRows, map.id);
    try { await finishAttribution(); }
    finally { await Promise.all(clients.map(c => c.close())); await stop(child); await adapter?.dispose(); }
    await writeFile(path.join(output, `${count}-server.log`), logs);
  }
}
try { for (const count of loads) await runLoad(count); report.passed = true; }
catch (error) { report.passed = false; report.error = { name: error.name, message: error.message, stack: error.stack }; process.exitCode = 1; }
finally {
  report.finishedAt = new Date().toISOString(); report.host.loadAfter = os.loadavg();
  try { await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n'); }
  finally { await rm(temp, { recursive: true, force: true }); }
}
console.log(JSON.stringify({ output, passed: report.passed, error: report.error ?? null }));
