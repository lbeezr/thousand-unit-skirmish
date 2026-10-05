// Fixed-tick AI regression adapter. Authoritative command, snapshot, simulation
// and checkpoint function bodies remain intact; only I/O scheduling is replaced.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// All authority must survive restart; presentation receipts intentionally do not.
// Keep full snapshot equality and change only the documented transient slot.
export function assertRecoveredWorkerObservation(actual, expected, message) {
  const cleared = structuredClone(expected);
  for (const row of cleared.units) {
    if (row[5] === 'worker' && Object.hasOwn(row, 17)) {
      const restored = actual.units.find(unit => unit[0] === row[0]);
      assert.equal(restored?.[17], null, 'recovery clears disclosed Worker activity before new work');
      row[17] = null;
    }
  }
  assert.deepEqual(actual, cleared, message);
}

const root = fileURLToPath(new URL('..', import.meta.url));
function replaceExactly(source, before, after, count = 1) {
  assert.equal(source.split(before).length - 1, count, `server entrypoint changed: ${before}`);
  return source.split(before).join(after);
}

export async function createPveHeadlessFixture(map, identity = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), 'rts-pve-headless-'));
  let replay;
  try {
    const original = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
    let source = original.replace(/from '(\.\/?[^']+)'/g,
      (_, name) => `from '${pathToFileURL(path.resolve(root, name)).href}'`);
    source = `import { validateCheckpointEnvelope as validatePreparedCheckpointEnvelope } from ${JSON.stringify(new URL('../src/server/checkpoint-envelope.mjs', import.meta.url).href)};\n` + source;
    source = replaceExactly(source, 'const ROOT = path.dirname(fileURLToPath(import.meta.url));', `const ROOT = ${JSON.stringify(root)};`);
    // Replay controls process identity as an input, rather than stripping packet
    // fields during equality checks. Native restart uses the unchanged entropy.
    source = replaceExactly(source, "const SERVER_INSTANCE_ID = randomBytes(16).toString('base64url');",
      `const SERVER_INSTANCE_ID = ${JSON.stringify(identity.serverInstanceId ?? 'headless-replay-instance')};`);
    source = replaceExactly(source, 'setImmediate(() => processMovePlanningSlice(job));', 'replayPlanningCallbacks.push(() => processMovePlanningSlice(job));');
    source = replaceExactly(source, 'scheduleSimulationTick();', '/* fixed-tick AI driver */', 2);
    source = replaceExactly(source, "process.on('SIGTERM', () => shutdown('SIGTERM'));", '');
    source = replaceExactly(source, "process.on('SIGINT', () => shutdown('SIGINT'));", '');
    const listen = source.lastIndexOf('\nserver.listen(PORT, HOST, () => {');
    assert.ok(listen > 0 && source.slice(listen).endsWith('});\n'), 'server listen entrypoint changed');
    source = source.slice(0, listen) + `
const replayPlanningCallbacks = [];
export const replay = {
  prepare(map, identity) {
    matchMode = normalizeMatchMode(identity);
    activateMap(validateMapDefinition(map, 'PvE replay')); resetArmy(map.startingArmySize);
  },
  async order(team, command) {
    const notices = [];
    await handleCommand({ team, sendJson: notice => notices.push(notice) }, command);
    return notices;
  },
  drain() {
    let count = 0;
    while (replayPlanningCallbacks.length) {
      if (++count > 10000) throw new Error('Planning callback limit');
      replayPlanningCallbacks.shift()();
    }
  },
  step() { this.drain(); runSimulationTick(); },
  advanceToStateBoundary() {
    const steps = (STATE_EVERY_TICKS - tickNumber % STATE_EVERY_TICKS) % STATE_EVERY_TICKS;
    for (let index = 0; index < steps; index++) this.step();
    if (tickNumber % STATE_EVERY_TICKS !== 0) throw new Error('Simulation did not reach its state boundary');
    return steps;
  },
  observe(team) { return roomPayload(team); },
  checkpoint() { return captureMatchCheckpoint(1, 1); },
  validateCheckpoint(snapshot) { return validateMatchCheckpoint(snapshot); },
  checkpointEnvelope(snapshot) {
    return validatePreparedCheckpointEnvelope(snapshot, {
      checkpointSchemaVersion: MATCH_CHECKPOINT_SCHEMA_VERSION, gameRulesVersion: MATCH_RULES_VERSION,
      maxUnits: MAX_UNITS, maxBuildings: MAX_BUILDINGS, maxResourceNodes: MAX_RESOURCE_NODES,
      validateMapDefinition, matchMapHash, launchMode: pveLaunchOptions ? 'pve' : 'pvp', practice: soloPractice,
    });
  },
  visionCacheMetrics() { return visionCoverageBySourceCell.metrics(); },
  restore(snapshot) { restoreMatchCheckpoint(snapshot); },
  dispose() { clearInterval(heartbeatTimer); if (pveOpponentTimer) clearInterval(pveOpponentTimer); }
};
`;
    const filename = path.join(directory, 'server-replay.mjs');
    await writeFile(filename, source);
    ({ replay } = await import(pathToFileURL(filename).href));
    replay.prepare(map, identity);
    return { replay, async dispose() { replay.dispose(); await rm(directory, { recursive: true, force: true }); } };
  } catch (error) {
    replay?.dispose();
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}
