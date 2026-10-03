// Fixed-tick AI regression adapter. Authoritative command, snapshot, simulation
// and checkpoint function bodies remain intact; only I/O scheduling is replaced.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
function replaceExactly(source, before, after, count = 1) {
  assert.equal(source.split(before).length - 1, count, `server entrypoint changed: ${before}`);
  return source.split(before).join(after);
}

export async function createPveHeadlessFixture(map) {
  const directory = await mkdtemp(path.join(tmpdir(), 'rts-pve-headless-'));
  let replay;
  try {
    const original = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
    let source = original.replace(/from '(\.\/?[^']+)'/g,
      (_, name) => `from '${pathToFileURL(path.resolve(root, name)).href}'`);
    source = replaceExactly(source, 'const ROOT = path.dirname(fileURLToPath(import.meta.url));', `const ROOT = ${JSON.stringify(root)};`);
    source = replaceExactly(source, 'setImmediate(() => processMovePlanningSlice(job));', 'replayPlanningCallbacks.push(() => processMovePlanningSlice(job));');
    source = replaceExactly(source, 'scheduleSimulationTick();', '/* fixed-tick AI driver */', 2);
    source = replaceExactly(source, "process.on('SIGTERM', () => shutdown('SIGTERM'));", '');
    source = replaceExactly(source, "process.on('SIGINT', () => shutdown('SIGINT'));", '');
    const listen = source.lastIndexOf('\nserver.listen(PORT, HOST, () => {');
    assert.ok(listen > 0 && source.slice(listen).endsWith('});\n'), 'server listen entrypoint changed');
    source = source.slice(0, listen) + `
const replayPlanningCallbacks = [];
export const replay = {
  prepare(map) { activateMap(validateMapDefinition(map, 'PvE replay')); resetArmy(map.startingArmySize); },
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
  observe(team) { return roomPayload(team); },
  checkpoint() { return captureMatchCheckpoint(1, 1); },
  restore(snapshot) { restoreMatchCheckpoint(snapshot); },
  dispose() { clearInterval(heartbeatTimer); if (pveOpponentTimer) clearInterval(pveOpponentTimer); }
};
`;
    const filename = path.join(directory, 'server-replay.mjs');
    await writeFile(filename, source);
    ({ replay } = await import(pathToFileURL(filename).href));
    replay.prepare(map);
    return { replay, async dispose() { replay.dispose(); await rm(directory, { recursive: true, force: true }); } };
  } catch (error) {
    replay?.dispose();
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}
