import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { normalizeMatchMode } from '../src/match-modes.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
const optionalRead = filename => readFile(filename, 'utf8').catch(() => null);
const numeric = value => value !== null && /^\d+$/.test(value.trim()) ? Number(value.trim()) : null;

async function sourceFiles(root, relative = 'src') {
  const entries = await readdir(path.join(root, relative), { withFileTypes: true });
  const files = await Promise.all(entries.map(entry => entry.isDirectory()
    ? sourceFiles(root, `${relative}/${entry.name}`)
    : /\.(?:mjs|js)$/.test(entry.name) ? [`${relative}/${entry.name}`] : []));
  return files.flat().sort();
}

export async function performanceIdentity(root, mapRelativePath, { ownedTemporaryMapPath = null } = {}) {
  const files = ['server.mjs', 'package-lock.json', ...await sourceFiles(root)];
  const contents = await Promise.all(files.map(async filename => [filename, sha(await readFile(path.join(root, filename)))]));
  let sourceRevision = null, sourceDirty = null;
  try {
    sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const status = execFileSync('git', ['status', '--porcelain', '-z', '--untracked-files=all'],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    // Ignore only this runner's exact untracked fixture, never tracked changes or other files.
    const ownedMap = ownedTemporaryMapPath === mapRelativePath
      && ownedTemporaryMapPath === `maps/.perf-checkpoint-${process.pid}.json`;
    sourceDirty = status.split('\0').some(entry => entry && !(ownedMap && entry === `?? ${ownedTemporaryMapPath}`));
  } catch { /* A packed directory has no checkout identity. */ }
  const manifestText = await optionalRead(path.join(root, 'release-manifest.json'));
  const manifest = manifestText ? JSON.parse(manifestText) : null;
  const mapBytes = await readFile(path.join(root, mapRelativePath));
  const map = JSON.parse(mapBytes);
  const driverFiles = ['scripts/checkpoint-performance-scenario.mjs', 'scripts/performance-scenario.mjs', 'scripts/performance-run-evidence.mjs'];
  const driver = await Promise.all(driverFiles.map(async filename => [filename, sha(await readFile(path.join(root, filename)))]));
  return {
    build: { kind: sourceRevision ? 'source-checkout' : manifest ? 'declared-release' : 'unidentified',
      sourceRevision: sourceRevision ?? manifest?.sourceRevision ?? null,
      sourceDirty: sourceRevision ? sourceDirty : manifest?.sourceDirty ?? null, declaredDigest: manifest?.digest ?? null,
      declaredRelease: manifest ? { sourceRevision: manifest.sourceRevision ?? null,
        sourceDirty: manifest.sourceDirty ?? null, digest: manifest.digest ?? null } : null,
      runtimeSha256: sha(JSON.stringify(contents)), driverSha256: sha(JSON.stringify(driver)) },
    map: { id: map.id, sha256: sha(mapBytes), terrainSeed: map.terrainSeed ?? null,
      width: map.width, height: map.height, fogOfWar: map.fogOfWar ?? null },
  };
}

export function checkpointAttackMap(openField) {
  return { ...openField, id: 'perf-checkpoint-attack-move', name: 'PERF CHECKPOINT BATTLE',
    summary: '64 × 64 · OPEN COMBAT TEST · NO FOG',
    spawnPoints: [{ team: 0, x: -16, z: 0 }, { team: 1, x: 16, z: 0 }],
    fogOfWar: false, resourceNodes: [], obstacles: [], triggers: [], scenarioEvents: [] };
}

export async function resourceSnapshot(serverPid) {
  const [status, meminfo, vmstat, current, maximum, events, cgroup] = await Promise.all([
    optionalRead(`/proc/${serverPid}/status`), optionalRead('/proc/meminfo'), optionalRead('/proc/vmstat'),
    optionalRead('/sys/fs/cgroup/memory.current'), optionalRead('/sys/fs/cgroup/memory.max'),
    optionalRead('/sys/fs/cgroup/memory.events'),
    optionalRead(`/proc/${serverPid}/cgroup`),
  ]);
  const kb = (text, key) => {
    const value = text?.match(new RegExp(`^${key}:\\s+(\\d+) kB$`, 'm'))?.[1];
    return value === undefined ? null : Number(value) * 1024;
  };
  const counter = (text, key) => {
    const value = text?.match(new RegExp(`^${key} (\\d+)$`, 'm'))?.[1];
    return value === undefined ? null : Number(value);
  };
  return { monotonicMs: performance.now(), serverRssBytes: kb(status, 'VmRSS'), serverHighWaterRssBytes: kb(status, 'VmHWM'),
    serverAtRootCgroup: cgroup === null ? null : cgroup.split('\n').includes('0::/'),
    hostAvailableBytes: kb(meminfo, 'MemAvailable'), hostTotalBytes: kb(meminfo, 'MemTotal'),
    swapInPages: counter(vmstat, 'pswpin'), swapOutPages: counter(vmstat, 'pswpout'),
    cgroupCurrentBytes: numeric(current), cgroupLimitBytes: numeric(maximum),
    cgroupLimitKind: maximum?.trim() === 'max' ? 'unlimited' : numeric(maximum) === null ? 'unavailable' : 'finite',
    cgroupEvents: Object.fromEntries(['high', 'max', 'oom', 'oom_kill'].map(key => [key, counter(events, key)])) };
}

export function resourceValidity(samples) {
  if (!Array.isArray(samples)) samples = [];
  const first = samples[0], last = samples.at(-1);
  const reasons = [], deltas = {};
  const nonnegative = value => Number.isFinite(value) && value >= 0;
  const validCounter = value => Number.isSafeInteger(value) && value >= 0;
  const counterValue = (sample, key) => key.startsWith('swap') ? sample?.[key] : sample?.cgroupEvents?.[key];
  for (const key of ['high', 'max', 'oom', 'oom_kill', 'swapInPages', 'swapOutPages']) {
    const start = counterValue(first, key), end = counterValue(last, key);
    deltas[key] = validCounter(start) && validCounter(end) ? end - start : null;
    if (deltas[key] === null || samples.some(sample => !validCounter(counterValue(sample, key)))) reasons.push(`unavailable:${key}`);
    else if (deltas[key] < 0) reasons.push(`counter-reset:${key}`);
    else if (deltas[key] > 0) reasons.push(`resource-pressure:${key}`);
    if (samples.some((sample, index) => index > 0 && validCounter(counterValue(sample, key))
      && validCounter(counterValue(samples[index - 1], key))
      && counterValue(sample, key) < counterValue(samples[index - 1], key))) reasons.push(`counter-reset:${key}`);
  }
  if (!samples.length || samples.some(sample => !nonnegative(sample?.serverRssBytes)
    || !nonnegative(sample?.serverHighWaterRssBytes))) reasons.push('unavailable:server-rss');
  if (samples.length < 2 || samples.some((sample, index) => !nonnegative(sample?.monotonicMs)
    || (index > 0 && sample.monotonicMs <= samples[index - 1]?.monotonicMs))) reasons.push('unavailable:measurement-boundaries');
  if (samples.some(sample => !nonnegative(sample?.hostAvailableBytes) || !nonnegative(sample?.hostTotalBytes)
    || !nonnegative(sample?.cgroupCurrentBytes)
    || !(sample?.cgroupLimitKind === 'finite' && Number.isFinite(sample.cgroupLimitBytes) && sample.cgroupLimitBytes > 0
      || sample?.cgroupLimitKind === 'unlimited' && sample.cgroupLimitBytes === null))) reasons.push('unavailable:memory-context');
  if (samples.some(sample => sample?.serverAtRootCgroup !== true)) reasons.push('unavailable:target-cgroup-scope');
  if (samples.some(sample => sample?.cgroupLimitKind !== first?.cgroupLimitKind
    || sample?.cgroupLimitBytes !== first?.cgroupLimitBytes)) reasons.push('resource-pressure:limit-changed');
  const status = deltas.oom > 0 || deltas.oom_kill > 0 ? 'invalid'
    : reasons.some(reason => reason.startsWith('resource-pressure:') || reason.startsWith('counter-reset:')) ? 'not-comparable'
      : reasons.length ? 'unknown' : 'observed-without-disruption';
  return { status, reasons, counterDeltas: deltas };
}

export async function observePerformanceResources(serverPid, { sample = resourceSnapshot, intervalMs = 1000 } = {}) {
  const samples = [await sample(serverPid)];
  let pending = Promise.resolve();
  const timer = setInterval(() => { pending = pending.then(async () => samples.push(await sample(serverPid))); }, intervalMs);
  timer.unref();
  return async () => {
    clearInterval(timer);
    await pending;
    samples.push(await sample(serverPid));
    return { sampleIntervalMs: intervalMs, scope: 'server process RSS; host swap and shared root-cgroup counters',
      samples, validity: resourceValidity(samples),
      limitations: ['RSS peaks between samples may be missed; high-water RSS includes startup.',
        'Linux VmRSS/VmHWM are kernel-reported estimates, not precise allocation totals.',
        'Shared host/cgroup events cannot be attributed to this server; unavailable counters stay unknown.',
        'The root-mounted cgroup must match the server; nested or unavailable membership leaves validity unknown.',
        'No free-memory ratio threshold, GPU memory measurement or consumer hardware capacity claim.'] };
  };
}

export async function performanceEnvironment() {
  const boot = await optionalRead('/proc/sys/kernel/random/boot_id');
  return { platform: process.platform, architecture: process.arch, node: process.version,
    cpuModel: os.cpus()[0]?.model ?? null, logicalCpuCount: os.availableParallelism(),
    machineSessionSha256: boot ? sha(boot.trim()) : null,
    nodeOptionsSha256: sha(process.env.NODE_OPTIONS ?? ''),
    powerState: 'unobserved', renderer: 'none', camera: 'not-applicable', resolution: 'not-applicable' };
}

export function comparePerformanceReports(baseline, candidate, expectedSources) {
  const reports = [baseline, candidate], reasons = [];
  const evidence = reports.map(report => report?.measurementEvidence);
  for (const [index, item] of evidence.entries()) {
    const name = index ? 'candidate' : 'baseline';
    if (!item || item.schemaVersion !== 1) { reasons.push(`${name}:missing-evidence`); continue; }
    if (typeof item.runId !== 'string' || !item.runId) reasons.push(`${name}:missing-run-identity`);
    const build = item.identity?.build;
    const map = item.identity?.map;
    if (typeof map?.id !== 'string' || !map.id || /^(unknown|unavailable)$/i.test(map.id)
      || !Number.isInteger(map.width) || map.width <= 0 || !Number.isInteger(map.height) || map.height <= 0
      || typeof map.fogOfWar !== 'boolean') reasons.push(`${name}:incomplete-map-controls`);
    if (!/^[0-9a-f]{40}$/.test(build?.sourceRevision ?? '')
      || build.sourceRevision !== expectedSources?.[index]) reasons.push(`${name}:unexpected-source`);
    if (build?.sourceDirty !== false) reasons.push(`${name}:dirty-or-unknown-source`);
    if (!/^[0-9a-f]{64}$/.test(build?.runtimeSha256 ?? '')
      || !/^[0-9a-f]{64}$/.test(build?.driverSha256 ?? '')) reasons.push(`${name}:missing-runtime-identity`);
    if (build?.kind !== 'source-checkout' && (build?.kind !== 'declared-release'
      || !/^sha256:[0-9a-f]{64}$/.test(build.declaredDigest ?? ''))) reasons.push(`${name}:unknown-build-kind-or-digest`);
    if (build?.kind === 'source-checkout' && build.declaredRelease
      && (build.declaredRelease.sourceRevision !== build.sourceRevision
        || build.declaredRelease.sourceDirty !== false)) reasons.push(`${name}:declared-source-mismatch`);
    if (item.identityUnchanged !== true) reasons.push(`${name}:identity-changed-or-unknown`);
    const validity = resourceValidity(item.resources?.samples ?? []);
    if (validity.status !== 'observed-without-disruption') reasons.push(`${name}:resources-${validity.status}`);
    const environment = item.environment;
    if (item.configuration?.scope !== 'native-cpu' || environment?.renderer !== 'none'
      || environment?.camera !== 'not-applicable' || environment?.resolution !== 'not-applicable') reasons.push(`${name}:unsupported-timing-scope`);
    if (environment?.platform !== 'linux' || !['x64', 'arm64', 'arm', 'ia32', 'ppc64', 's390x', 'riscv64', 'loong64'].includes(environment?.architecture)
      || !/^v\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(environment?.node ?? '')
      || typeof environment?.cpuModel !== 'string' || !environment.cpuModel.trim()
      || /^(unknown|unavailable|unobserved)$/i.test(environment.cpuModel.trim())
      || !Number.isInteger(environment?.logicalCpuCount) || environment.logicalCpuCount < 1
      || !/^[0-9a-f]{64}$/.test(environment?.nodeOptionsSha256 ?? '')
      || !/^[0-9a-f]{64}$/.test(environment?.machineSessionSha256 ?? '')
      || environment?.powerState !== 'unobserved') reasons.push(`${name}:incomplete-environment`);
    const config = item.configuration;
    let supportedMatchMode = false;
    try { normalizeMatchMode({ matchModeId: config?.matchModeId, matchModeVersion: config?.matchModeVersion }); supportedMatchMode = true; } catch {}
    if (!['idle', 'move', 'attack-move'].includes(config?.workloadMode) || !Number.isInteger(config?.durationSeconds)
      || config.durationSeconds < 10 || config.durationSeconds > 120
      || !Number.isInteger(config?.requestedRepeatCount) || config.requestedRepeatCount < 1 || config.requestedRepeatCount > 5
      || config.repeatCount !== (config.workloadMode === 'idle' ? 1 : config.requestedRepeatCount)
      || config.durationKind !== 'requested workload duration; server timing is a rolling 300-tick window'
      || config.requestedUnitCount !== 2000 || config.verifiedUnitCount !== 2000
      || config.formation !== 'box' || config.connectedTeams !== 2
      || ![0, 1, 4, 8].includes(config.planningTurnsPerTick)
      || !supportedMatchMode
      || !Number.isFinite(config.checkpointIntervalMs) || config.checkpointIntervalMs <= 0
      || !Number.isFinite(config.tickRate) || config.tickRate <= 0
      || config.diagnostics !== 'RTS_TICK_DIAGNOSTICS=1'
      || config.window !== 'rolling 300 server ticks after orders'
      || config.warmup !== 'no dedicated warmup; first full window'
      || config.acceptedCommandReplay !== 'not-recorded; map seed and authored workload are controls') reasons.push(`${name}:incomplete-controls`);
    if (item.servedBuildIdentity?.sourceRevision && item.servedBuildIdentity.sourceRevision !== build?.sourceRevision) reasons.push(`${name}:served-source-mismatch`);
    if (!Array.isArray(reports[index]?.samples) || reports[index].samples.length !== item.configuration?.repeatCount
      || reports[index].samples.some(sample => sample?.tickTiming?.sampleCount !== 300
        || !['p95Ms', 'maxMs', 'startLagP95Ms', 'startLagMaxMs', 'budgetMs'].every(key => Number.isFinite(sample?.tickTiming?.[key]) && sample.tickTiming[key] >= 0)
        || sample.tickTiming.budgetMs <= 0)) reasons.push(`${name}:incomplete-timing-window`);
    if (item.outcome !== 'passed') reasons.push(`${name}:failed-run-retained`);
  }
  if (evidence.every(Boolean)) {
    if (evidence[0].runId && evidence[0].runId === evidence[1].runId) reasons.push('same-run');
    for (const [name, values] of [
      ['map', evidence.map(item => item.identity?.map)], ['configuration', evidence.map(item => item.configuration)],
      ['environment', evidence.map(item => item.environment)], ['driver', evidence.map(item => item.identity?.build?.driverSha256)],
      ['build-kind', evidence.map(item => item.identity?.build?.kind)],
      ['resource-limit', evidence.map(item => [item.resources?.samples?.[0]?.cgroupLimitKind, item.resources?.samples?.[0]?.cgroupLimitBytes])],
      ['timing-budgets', reports.map(report => Array.isArray(report?.samples) ? report.samples.map(sample => sample?.tickTiming?.budgetMs) : null)],
    ]) if (JSON.stringify(values[0]) !== JSON.stringify(values[1])) reasons.push(`mismatched:${name}`);
    if (evidence.some(item => !/^[0-9a-f]{64}$/.test(item.environment?.machineSessionSha256 ?? '')
      || !/^[0-9a-f]{64}$/.test(item.identity?.map?.sha256 ?? '')
      || !Number.isInteger(item.identity?.map?.terrainSeed))) reasons.push('unknown:machine-or-seed');
  }
  return { status: reasons.length ? 'not-comparable' : 'comparable-diagnostics', reasons,
    baselineFailure: evidence[0]?.failure ?? null, candidateFailure: evidence[1]?.failure ?? null,
    hardwareCapacityEstablished: false, controlledHardwarePerformanceEstablished: false, causalImprovementEstablished: false };
}
