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
// Observe only executed land-admission branches in the private replay copy.
// The focused executor controls use this same instrumentation as the consumer.
export function instrumentReplayMovementAdmissions(source) {
  const start = source.indexOf('  const blockedRouteRepairs = [];');
  const end = source.indexOf('  enqueueRouteRepairs(blockedRouteRepairs);', start);
  assert.ok(start >= 0 && end > start, 'land admission observation boundaries changed');
  let movement = source.slice(start, end);
  for (const [before, after, count = 1] of [
    ['if (!move) break;', "if (!move) { observeReplayMovementAdmission(unit, 'no-proposal'); break; }"],
    ['if (move.waitingForCrowd) break;', "if (move.waitingForCrowd) { observeReplayMovementAdmission(unit, 'crowd-wait'); break; }"],
    ['break; // Keep this route/pose/intent;', "observeReplayMovementAdmission(unit, 'detour-deferred');\n          break; // Keep this route/pose/intent;"],
    ['        || (move.reachedWaypoint && clearanceRadius && !canTraverseStaticBodySegment(unit, move.target,\n          clearanceRadius, MAP_WIDTH, MAP_HEIGHT, isWalkable, { allowEscape: true }))) {',
      "        || (move.reachedWaypoint && clearanceRadius && !canTraverseStaticBodySegment(unit, move.target,\n          clearanceRadius, MAP_WIDTH, MAP_HEIGHT, isWalkable, { allowEscape: true }))) {\n        observeReplayMovementAdmission(unit, 'static-rejected');"],
    ['if (!automaticPositionAllowed(unit, move.target.x, move.target.z)) {',
      "if (!automaticPositionAllowed(unit, move.target.x, move.target.z)) {\n          observeReplayMovementAdmission(unit, 'automatic-rejected');"],
    ['if (!automaticPositionAllowed(unit, nextX, nextZ)) {',
      "if (!automaticPositionAllowed(unit, nextX, nextZ)) {\n        observeReplayMovementAdmission(unit, 'automatic-rejected');"],
    ['        unit.pathIndex++;', "        unit.pathIndex++;\n        observeReplayMovementAdmission(unit, 'waypoint-admitted');"],
    ['        unit.z = nextZ;', "        unit.z = nextZ;\n        observeReplayMovementAdmission(unit, 'steering-admitted', false);"],
    ['          unit.z = fallbackZ;', "          unit.z = fallbackZ;\n          observeReplayMovementAdmission(unit, 'fallback-admitted', false);"],
    ['          // A legal crowd deflection can leave the old next waypoint behind',
      "          observeReplayMovementAdmission(unit, 'fallback-rejected');\n          // A legal crowd deflection can leave the old next waypoint behind"],
    ['      unit.z = Math.max(-MAP_HALF_Z + 0.5, Math.min(MAP_HALF_Z - 0.5, unit.z));',
      '      unit.z = Math.max(-MAP_HALF_Z + 0.5, Math.min(MAP_HALF_Z - 0.5, unit.z));\n      observeReplayMovementAdmission(unit);'],
  ]) movement = replaceExactly(movement, before, after, count);
  return source.slice(0, start) + movement + source.slice(end);
}
export async function createPathingReplayFixture(map, { traceLandSteps = false, traceRouteRejoins = false,
  traceCrowdSteps = false, traceActorIds = [], observeMovement = false } = {}) {
  assert.ok(Array.isArray(traceActorIds) && traceActorIds.length <= 64 && traceActorIds.every(Number.isInteger));
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
    if (traceRouteRejoins) {
      source = replaceExactly(source, 'rejoinSelectedUnitRoute(', 'recordReplayRouteRejoin(', 6);
    }
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
    if (traceActorIds.length) source = replaceExactly(source,
      '  for (const { unit, destination: requestedDestination } of repairs) {',
      '  for (const { unit, destination: requestedDestination } of repairs) {\n    recordReplayActorTrace(unit, "repair", { mode, requestedDestination });');
    if (traceCrowdSteps || traceActorIds.length || observeMovement) source = replaceExactly(source,
      'const move = getMoveVector(unit, remainingStep, allowLocalDetour);',
      'const move = recordReplayCrowdStep(unit, remainingStep, allowLocalDetour);');
    if (observeMovement) source = instrumentReplayMovementAdmissions(source);
    const listen = source.lastIndexOf('\nserver.listen(PORT, HOST, () => {');
    assert.ok(listen > 0 && source.slice(listen).endsWith('});\n'), 'server listen entrypoint changed');
    source = source.slice(0, listen) + `
const replayPlanningCallbacks = [];
const replayLandSteps = [];
const replayCrowdSteps = [];
const replayActorTrace = [];
const replayTraceActorIds = new Set(${JSON.stringify(traceActorIds)});
const replayRouteRejoins = [];
let replayMovementTeam = null;
const replayMovementActors = new Map();
const replayMovementDecisions = new Map();
function observeReplayMovementDecision(unit, result) {
  // Ownership precedes movement/identity reads; never inspect enemy internals.
  if (!unit || unit.team !== replayMovementTeam || unit.hp <= 0) return;
  const binding = replayMovementActors.get(unit.id);
  if (!binding || binding.unit !== unit || binding.generation !== unit.generation) return;
  replayMovementDecisions.set(unit.id, { unit, generation: unit.generation,
    revision: unit.orderRevision, tick: tickNumber, navigationRevision,
    x: unit.x, z: unit.z, admission: 'unobserved', positionChanged: null,
    cause: !result ? 'no-vector-proposal' : result.waitingForCrowd ? 'vector-wait'
      : result.rejectedStaticProposal ? 'static-proposal-rejected' : 'vector-proposal' });
}
function observeReplayMovementAdmission(unit, admission, finalized = true) {
  if (!unit || unit.team !== replayMovementTeam || unit.hp <= 0) return;
  const binding = replayMovementActors.get(unit.id);
  if (!binding || binding.unit !== unit || binding.generation !== unit.generation) return;
  const decision = replayMovementDecisions.get(unit.id);
  if (!decision || decision.unit !== unit || decision.generation !== unit.generation
    || decision.revision !== unit.orderRevision || decision.tick !== tickNumber
    || decision.navigationRevision !== navigationRevision) return;
  if (admission) decision.admission = admission;
  if (finalized && decision.admission !== 'unobserved')
    decision.positionChanged = unit.x !== decision.x || unit.z !== decision.z;
}
function recordReplayRouteRejoin(route, options) {
  const result = rejoinSelectedUnitRoute(route, options);
  replayRouteRejoins.push({ id: options.position.id, radius: options.radius,
    position: { x: options.position.x, z: options.position.z },
    selected: [...route.path], path: [...result.route.path], rejoin: result.rejoin });
  return result;
}
function recordReplayActorTrace(unit, type, extra = {}) {
  if (!unit || !replayTraceActorIds.has(unit.id)) return;
  replayActorTrace.push({ type, tick: tickNumber, navigationRevision, id: unit.id,
    generation: unit.generation, revision: unit.orderRevision, x: unit.x, z: unit.z,
    cell: worldToCell(unit.x, unit.z), pathIndex: unit.pathIndex, path: [...unit.path],
    rawWaypoint: unit.pathIndex < unit.path.length ? cellToWorld(unit.path[unit.pathIndex]) : null,
    goal: unit.moveGoalCell, point: structuredClone(unit.moveGoalPoint),
    queue: structuredClone(unit.queuedWaypoints), pending: unit.movePlanningPending,
    neighbours: units.filter(o => o !== unit && o.hp > 0 && Math.hypot(o.x - unit.x, o.z - unit.z) <= 2.1)
      .map(o => ({ id: o.id, kind: o.kind, x: o.x, z: o.z, pathIndex: o.pathIndex, pathLength: o.path.length })),
    ...extra });
}
function recordReplayCrowdStep(unit, remainingStep, allowLocalDetour) {
  const result = getMoveVector(unit, remainingStep, allowLocalDetour);
  if (${observeMovement}) observeReplayMovementDecision(unit, result);
  if (replayTraceActorIds.has(unit.id)) recordReplayActorTrace(unit, "vector", { remainingStep, result: structuredClone(result) });
  if (${Boolean(traceCrowdSteps || traceActorIds.length)} && result?.crowd) replayCrowdSteps.push({ id: unit.id, tick: tickNumber,
    ...result.crowd, ...result.crowdControl, complete: Boolean(result.crowdControl) });
  return result;
}
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
    replayMovementActors.clear(); replayMovementDecisions.clear(); replayMovementTeam = null;
    replayLandSteps.length = 0;
    replayCrowdSteps.length = 0;
    replayActorTrace.length = 0;
    replayRouteRejoins.length = 0;
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
    else if (command.type === 'gather') assignGatherWithRouteAdmission(player, command);
    else if (command.type === 'returnCargo') assignReturnCargo(player, command);
    else if (command.type === 'build') buildBuilding(player, command);
    else if (command.type === 'resumeConstruction') resumeBuildingConstruction(player, command);
    else if (command.type === 'repairBuilding') repairBuilding(player, command);
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
    replayMovementDecisions.clear();
    replayLandSteps.length = 0;
    replayCrowdSteps.length = 0;
    replayActorTrace.length = 0;
    replayRouteRejoins.length = 0;
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
  observeMovement(team, ids) {
    if (!${observeMovement}) throw new Error('movement observation must be explicitly enabled');
    if (!([0, 1].includes(team) && Array.isArray(ids) && ids.length <= 8
      && ids.every(id => Number.isSafeInteger(id) && id >= 0) && new Set(ids).size === ids.length))
      throw new Error('movement observation requires a seat and at most eight distinct actor IDs');
    replayMovementActors.clear(); replayMovementDecisions.clear(); replayMovementTeam = team;
    for (const id of ids) {
      const unit = units[id];
      if (!unit || unit.team !== team || unit.hp <= 0) continue;
      replayMovementActors.set(id, { unit, generation: unit.generation });
    }
  },
  movementObservations() {
    const rows = [];
    for (const [id, binding] of replayMovementActors) {
      const unit = units[id];
      if (!unit || unit.team !== replayMovementTeam || unit.hp <= 0
        || unit !== binding.unit || unit.generation !== binding.generation) continue;
      const decision = replayMovementDecisions.get(id);
      const current = decision && decision.unit === unit && decision.generation === unit.generation
        && decision.revision === unit.orderRevision && decision.tick === tickNumber
        && decision.navigationRevision === navigationRevision;
      rows.push({ id, holding: unit.holdingPosition === true, planningPending: unit.movePlanningPending === true,
        performingAction: unit.kind === 'worker' ? workerPerformingAction(unit) : null,
        routeActive: unit.pathIndex < unit.path.length, decision: current ? decision.cause : 'unobserved',
        admission: current ? decision.admission : 'unobserved',
        positionChanged: current ? decision.positionChanged : null });
    }
    return rows;
  },
  buildingDistance(position, buildingId) { return distanceToBuildingEdge(position, buildingsById.get(buildingId)); },
  attackApproach(id, targetId, continueWaypoint = false) {
    const approach = getUnitAttackPath(units[id], units[targetId], null, continueWaypoint);
    return approach && { ...approach, path: [...approach.path] };
  },
  automaticAttackApproach(id, targetId, continueWaypoint = false) {
    const approach = boundedAutomaticApproach(units[id], units[targetId],
      getUnitAttackPath(units[id], units[targetId], null, continueWaypoint));
    return approach && { ...approach, path: [...approach.path] };
  },
  checkpoint() { return captureMatchCheckpoint(1); },
  restore(snapshot) {
    replayMovementActors.clear(); replayMovementDecisions.clear(); replayMovementTeam = null;
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
  get actorTrace() { return structuredClone(replayActorTrace); },
  get crowdSteps() { return replayCrowdSteps.map(step => ({ ...step })); },
  get routeRejoins() { return replayRouteRejoins.map(join => ({ ...join, position: { ...join.position },
    selected: [...join.selected], path: [...join.path] })); },
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
