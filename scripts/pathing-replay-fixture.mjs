// Test-only entrypoint adapter: production function bodies stay intact. Planning
// callbacks drain between fixed ticks by default; candidate service runs in the
// real tick body. Timers/listening are disabled in the copy.
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
export async function createPathingReplayFixture(map, { traceLandSteps = false } = {}) {
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
    if (traceLandSteps) {
      // Observe admitted substeps before their unchanged position assignments.
      // Tick chords can miss a turn when the executor consumes two waypoints.
      for (const [reason, assignments] of [
        ['waypoint', '        unit.x = move.target.x;\n        unit.z = move.target.z;'],
        ['steering', '        unit.x = nextX;\n        unit.z = nextZ;'],
        ['fallback', '          unit.x = fallbackX;\n          unit.z = fallbackZ;'],
        ['same-cell-combat', '            unit.x = x;\n            unit.z = z;'],
        ['interaction-separation', '    unit.x = x;\n    unit.z = z;'],
      ]) {
        const coordinates = reason === 'waypoint' ? 'move.target.x, move.target.z'
          : reason === 'steering' ? 'nextX, nextZ' : reason === 'fallback' ? 'fallbackX, fallbackZ' : 'x, z';
        source = replaceExactly(source, assignments,
          `recordReplayLandStep(unit, ${coordinates}, ${JSON.stringify(reason)});\n${assignments}`);
      }
    }
    const listen = source.lastIndexOf('\nserver.listen(PORT, HOST, () => {');
    assert.ok(listen > 0 && source.slice(listen).endsWith('});\n'), 'server listen entrypoint changed');
    source = source.slice(0, listen) + `
const replayPlanningCallbacks = [];
const replayLandSteps = [];
function recordReplayLandStep(unit, x, z, reason) {
  if (unit.movementDomain === 'water' || (unit.x === x && unit.z === z)) return;
  replayLandSteps.push({ id: unit.id, generation: unit.generation, revision: unit.orderRevision,
    team: unit.team, kind: unit.kind, tick: tickNumber, navigationRevision,
    from: { x: unit.x, z: unit.z }, to: { x, z }, reason,
    neighbours: units.filter(other => other !== unit && other.hp > 0 && other.movementDomain !== 'water')
      .map(other => ({ id: other.id, generation: other.generation, kind: other.kind, x: other.x, z: other.z })) });
}
export const replay = {
  prepare(map) {
    replayLandSteps.length = 0;
    // Custom trusted replay maps exercise their authored simulation rules;
    // ordinary default Skirmish admission is covered by the launch fixtures.
    matchMode = normalizeMatchMode({ matchModeId: 'authored', matchModeVersion: 1 });
    activateMap(validateMapDefinition(map, 'pathing replay'));
    tickNumber = 0; navigationRevision = 0; nextMoveOrderId = 1;
    resetArmy(map.startingArmySize);
  },
  order(team, command) {
    const notices = [];
    const player = { team, sendJson: notice => notices.push(notice) };
    if (command.type === 'move') assignFormationMove(player, command);
    else if (command.type === 'attackMove') assignFormationMove(player, command);
    else if (command.type === 'herd') assignWildlifeHerd(player, command);
    else if (command.type === 'stopWildlife') stopWildlifeHerd(player, command);
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
  planningTurn() {
    const callback = replayPlanningCallbacks.shift();
    if (!callback) return false;
    callback();
    return true;
  },
  step({ planningTurns } = {}) {
    replayLandSteps.length = 0;
    if (planningTurns === undefined && MOVE_PLANNING_TURNS_PER_TICK === 0) this.drain();
    else if (planningTurns === undefined) { /* candidate uses the real tick hook */ }
    else {
      if (!Number.isInteger(planningTurns) || planningTurns < 0 || planningTurns > 10000) {
        throw new Error('Invalid replay planning turn count');
      }
      for (let turn = 0; turn < planningTurns; turn++) {
        if (!this.planningTurn()) break;
      }
    }
    runSimulationTick();
  },
  get units() { return units; }, get buildings() { return buildings; },
  get wood() { return teamWood; },
  get food() { return teamFood; }, get resources() { return resourceNodeStates; },
  snapshot(team) { return roomPayload(team); },
  checkpoint() { return captureMatchCheckpoint(1); },
  restore(snapshot) {
    const migrated = migrateEconomyCheckpoint(migrateMatchCheckpoint(migrateFoodToolsCheckpoint(snapshot)));
    migrateWildlifeMotionCheckpoint(migrated);
    migrateCombatStanceCheckpoint(migrated, UNIT_DEFINITIONS);
    migrateWildlifeClaimsCheckpoint(migrated);
    migrateMatchModeCheckpoint(migrated);
    migrateWildlifeHerdCheckpoint(migrated);
    migrateWildlifeHeadingCheckpoint(migrated);
    migrateVoluntaryEndingCheckpoint(migrated);
    restoreMatchCheckpoint(migrated);
  },
  validate(snapshot) {
    const migrated = migrateEconomyCheckpoint(migrateMatchCheckpoint(migrateFoodToolsCheckpoint(snapshot)));
    migrateWildlifeMotionCheckpoint(migrated);
    migrateCombatStanceCheckpoint(migrated, UNIT_DEFINITIONS);
    migrateWildlifeClaimsCheckpoint(migrated);
    migrateMatchModeCheckpoint(migrated);
    migrateWildlifeHerdCheckpoint(migrated);
    migrateWildlifeHeadingCheckpoint(migrated);
    migrateVoluntaryEndingCheckpoint(migrated);
    return validateMatchCheckpoint(migrated);
  },
  get tick() { return tickNumber; }, get navigationRevision() { return navigationRevision; },
  point: cellToWorld, cell: worldToCell, isWalkable,
  get levels() { return elevationLevelByCell; },
  get components() { return walkableComponents; },
  get planning() { return movePlanningSamples; },
  get planningJobs() {
    return [...(activeMovePlanningJob ? [activeMovePlanningJob] : []), ...movePlanningQueue];
  },
  get diagnostic() { return tickDiagnosticSamples[(tickDurationCursor - 1 + TICK_SAMPLE_WINDOW) % TICK_SAMPLE_WINDOW]; },
  get separation() { return separationWorkPayload(); },
  get landSteps() { return replayLandSteps.map(step => ({ ...step, from: { ...step.from }, to: { ...step.to },
    neighbours: step.neighbours.map(other => ({ ...other })) })); },
  dispose() { clearInterval(heartbeatTimer); if (pveOpponentTimer) clearInterval(pveOpponentTimer); }
};
`;
    const filename = path.join(directory, 'server-replay.mjs');
    await writeFile(filename, source);
    const { replay } = await import(pathToFileURL(filename).href);
    replay.prepare(map);
    const identity = replay.checkpoint();
    assert.deepEqual([identity.matchModeId, identity.matchModeVersion], ['authored', 1]);
    return { replay, sourceSha256: createHash('sha256').update(original).digest('hex'),
      async dispose() { replay.dispose(); await rm(directory, { recursive: true, force: true }); } };
  } catch (error) { await rm(directory, { recursive: true, force: true }); throw error; }
}
