// Test-only entrypoint adapter: production function bodies stay intact. Planning
// callbacks drain between fixed ticks; timers/listening are disabled in the copy.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('..', import.meta.url));
function replaceExactly(source, before, after, count = 1) {
  assert.equal(source.split(before).length - 1, count, `server entrypoint changed: ${before}`);
  return source.split(before).join(after);
}
export async function createPathingReplayFixture(map) {
  const directory = await mkdtemp(path.join(tmpdir(), 'rts-pathing-replay-'));
  try {
    const original = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
    let source = original.replace(/from '(\.\/?[^']+)'/g,
      (_, name) => `from '${pathToFileURL(path.resolve(root, name)).href}'`);
    source = replaceExactly(source, 'const ROOT = path.dirname(fileURLToPath(import.meta.url));', `const ROOT = ${JSON.stringify(root)};`);
    source = replaceExactly(source, 'setImmediate(() => processMovePlanningSlice(job));', 'replayPlanningCallbacks.push(() => processMovePlanningSlice(job));');
    source = replaceExactly(source, 'scheduleSimulationTick();', '/* fixed-tick replay driver */', 2);
    source = replaceExactly(source, "process.on('SIGTERM', () => shutdown('SIGTERM'));", '');
    source = replaceExactly(source, "process.on('SIGINT', () => shutdown('SIGINT'));", '');
    const listen = source.lastIndexOf('\nserver.listen(PORT, HOST, () => {');
    assert.ok(listen > 0 && source.slice(listen).endsWith('});\n'), 'server listen entrypoint changed');
    source = source.slice(0, listen) + `
const replayPlanningCallbacks = [];
export const replay = {
  prepare(map) {
    activateMap(validateMapDefinition(map, 'pathing replay'));
    tickNumber = 0; navigationRevision = 0; nextMoveOrderId = 1;
    resetArmy(map.startingArmySize);
  },
  order(team, command) {
    const notices = [];
    const player = { team, sendJson: notice => notices.push(notice) };
    if (command.type === 'move') assignFormationMove(player, command);
    else if (command.type === 'attackMove') assignFormationMove(player, command);
    else if (command.type === 'setStance') assignCombatStance(player, command);
    else if (command.type === 'patrol') assignPatrolOrder(player, command);
    else if (command.type === 'follow') assignFollowOrder(player, command);
    else if (command.type === 'attack') assignAttack(player, command);
    else if (command.type === 'attackBuilding') assignAttackBuilding(player, command);
    else if (command.type === 'trainUnit') trainUnit(player, command);
    else if (command.type === 'gather') assignGather(player, command);
    else if (command.type === 'returnCargo') assignReturnCargo(player, command);
    else if (command.type === 'build') buildBuilding(player, command);
    else if (command.type === 'buildWall') buildWallLine(player, command);
    else if (command.type === 'setGateOpen') setGateOpen(player, command);
    else if (command.type === 'stop' || command.type === 'holdPosition') assignStationaryOrder(player, command);
    else if (command.type === 'cancelConstruction') cancelConstruction(player, command);
    else throw new Error('Unsupported replay command: ' + command.type);
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
  get units() { return units; }, get buildings() { return buildings; },
  get wood() { return teamWood; },
  get food() { return teamFood; }, get resources() { return resourceNodeStates; },
  snapshot(team) { return roomPayload(team); },
  checkpoint() { return captureMatchCheckpoint(1); },
  restore(snapshot) {
    const migrated = migrateEconomyCheckpoint(migrateMatchCheckpoint(snapshot));
    migrateWildlifeMotionCheckpoint(migrated);
    migrateCombatStanceCheckpoint(migrated, UNIT_DEFINITIONS);
    migrateWildlifeClaimsCheckpoint(migrated);
    restoreMatchCheckpoint(migrated);
  },
  validate(snapshot) {
    const migrated = migrateEconomyCheckpoint(migrateMatchCheckpoint(snapshot));
    migrateWildlifeMotionCheckpoint(migrated);
    migrateCombatStanceCheckpoint(migrated, UNIT_DEFINITIONS);
    migrateWildlifeClaimsCheckpoint(migrated);
    return validateMatchCheckpoint(migrated);
  },
  get tick() { return tickNumber; }, get navigationRevision() { return navigationRevision; },
  point: cellToWorld, cell: worldToCell, isWalkable,
  get levels() { return elevationLevelByCell; },
  get components() { return walkableComponents; },
  get planning() { return movePlanningSamples; },
  get diagnostic() { return tickDiagnosticSamples[(tickDurationCursor - 1 + TICK_SAMPLE_WINDOW) % TICK_SAMPLE_WINDOW]; },
  get separation() { return separationWorkPayload(); },
  dispose() { clearInterval(heartbeatTimer); if (pveOpponentTimer) clearInterval(pveOpponentTimer); }
};
`;
    const filename = path.join(directory, 'server-replay.mjs');
    await writeFile(filename, source);
    const { replay } = await import(pathToFileURL(filename).href);
    replay.prepare(map);
    return { replay, sourceSha256: createHash('sha256').update(original).digest('hex'),
      async dispose() { replay.dispose(); await rm(directory, { recursive: true, force: true }); } };
  } catch (error) { await rm(directory, { recursive: true, force: true }); throw error; }
}
