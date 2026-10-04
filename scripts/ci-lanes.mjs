export const CI_USAGE = 'Usage: node scripts/ci.mjs [--lane=full|fast|simulation|visual|performance] [--shard=INDEX/COUNT] [--list] [--report=PATH] (1 <= INDEX <= COUNT <= 16)';

export function parseCiOptions(args) {
  const options = { lane: 'full', shardIndex: 0, shardCount: 1, list: false, report: null };
  const seen = new Set();
  for (const arg of args) {
    const key = arg.split('=', 1)[0];
    if (seen.has(key)) throw new Error(CI_USAGE);
    seen.add(key);
    if (arg === '--list') options.list = true;
    else if (arg.startsWith('--lane=') && ['full', 'fast', 'simulation', 'visual', 'performance'].includes(arg.slice(7))) {
      options.lane = arg.slice(7);
    } else if (/^--shard=\d+\/\d+$/.test(arg)) {
      const [index, count] = arg.slice(8).split('/').map(Number);
      if (index < 1 || index > count || count > 16) throw new Error(CI_USAGE);
      options.shardIndex = index - 1;
      options.shardCount = count;
    } else if (arg.startsWith('--report=') && arg.slice(9).trim()) options.report = arg.slice(9);
    else throw new Error(CI_USAGE);
  }
  if (seen.has('--shard') && ['visual', 'performance'].includes(options.lane)) throw new Error(CI_USAGE);
  return options;
}

// Unit/contract files and source guards need no live browser. Existing scenario
// registrations remain CPU simulation; syntax checks of scenario files are guards.
export function isFastCheck({ args }) {
  return args[0] === '--check'
    || args.some(arg => arg.endsWith('.test.mjs'))
    || args[0].startsWith('node_modules/typescript/')
    || ['scripts/check-runtime-imports.mjs', 'scripts/check-docs.mjs'].includes(args[0]);
}

export const EXTRA_LANES = {
  visual: [
    { args: ['scripts/renderer-capability.mjs', '--launch'], label: 'WebGL2 readback prerequisite', prerequisite: 'renderer' },
    { command: 'game-dev', args: ['scenario', 'run', 'renderer-environment-state-pilot', '--project', '.', '--confirm', '--allow-gpu', '--jsonl'],
      label: 'Four-frame rendered environment pilot' },
  ],
  performance: [
    { args: ['scripts/checkpoint-performance-scenario.mjs', '10', 'move', '1'],
      label: 'CPU checkpoint timing and recovery workload (10 seconds, one sample)' },
  ],
};

export function selectCiChecks(checks, options) {
  const laneChecks = options.lane === 'full' ? checks
    : options.lane === 'fast' ? checks.filter(isFastCheck)
    : options.lane === 'simulation' ? checks.filter(check => !isFastCheck(check))
    : EXTRA_LANES[options.lane];
  const selected = laneChecks.filter((_, index) => index % options.shardCount === options.shardIndex);
  if (!selected.length) throw new Error(`${CI_USAGE}\nSelected lane/shard has no checks.`);
  return { selected, laneCount: laneChecks.length };
}

export function rendererPrerequisite(result) {
  if (result.error || result.signal) return null;
  let report;
  try { report = JSON.parse(result.stdout); } catch { return null; }
  if (report?.schemaVersion !== 1 || report.scope !== 'renderer-capability-only') return null;
  if (result.status === 0 && report.status === 'ready' && report.webglReadbackPassed === true) {
    return { status: 'passed' };
  }
  if (result.status === 1 && report.status === 'blocked'
      && Array.isArray(report.issues) && report.issues.length
      && report.issues.every(issue => issue && typeof issue.code === 'string' && issue.code.trim()
        && typeof issue.message === 'string' && issue.message.trim())) {
    return { status: 'blocked', reason: report.issues.map(issue => `${issue.code}: ${issue.message}`).join('; ') };
  }
  return null;
}

export function runCiSelection({ selected, laneCount }, options, { execute, source = null } = {}) {
  const report = {
    schemaVersion: 1, lane: options.lane,
    shard: { index: options.shardIndex + 1, count: options.shardCount },
    source, status: options.list ? 'planned' : 'passed',
    selectedCount: selected.length, laneCount, passedCount: 0, unrunCount: selected.length,
    // This suite is CPU-only. Even full success does not establish rendered or
    // comparative performance acceptance; a shard is only its named selection.
    fullCpuSuitePassed: false,
    checks: [],
  };
  if (options.list) return { report, exitCode: 0 };
  for (const check of selected) {
    let result;
    try { result = execute(check); }
    catch (error) { result = { status: null, error }; }
    let status = 'failed', reason = null;
    if (result.error?.code === 'ENOENT' && check.command === 'game-dev') {
      status = 'blocked';
      reason = 'game-dev launcher is unavailable; use the existing adapter on an authorized renderer executor.';
    } else if (check.prerequisite === 'renderer') {
      const prerequisite = rendererPrerequisite(result);
      if (prerequisite) ({ status, reason = null } = prerequisite);
      else reason = 'Renderer preflight did not return a valid ready/blocked report.';
    } else if (!result.error && result.status === 0) status = 'passed';
    else reason = result.error ? `Check could not execute (${result.error.code ?? 'unknown'}).`
      : `Check exited ${result.status ?? 'unknown'}${result.signal ? ` (${result.signal})` : ''}.`;
    report.checks.push({ label: check.label, status, exitCode: result.status ?? null, reason });
    report.unrunCount--;
    if (status === 'passed') report.passedCount++;
    else {
      report.status = status;
      return { report, exitCode: status === 'blocked' ? 3 : 1, error: result.error };
    }
  }
  report.fullCpuSuitePassed = options.lane === 'full' && options.shardCount === 1
    && report.passedCount === laneCount;
  return { report, exitCode: 0 };
}
