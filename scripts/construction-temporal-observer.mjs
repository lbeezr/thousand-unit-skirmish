// Test-only copies observe existing decisions; no production import or hook.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
function replace(source, before, after, count = 1) {
  assert.equal(source.split(before).length - 1, count, `observation boundary changed: ${before}`);
  return source.split(before).join(after);
}

export function observedCrowdSource(source, actorId = 75) {
  source = replace(source, 'export function selectCrowdStep(', 'function productionSelectCrowdStep(');
  source = replace(source,
    '  const sweep = (from, to, bodies) => canTraverseCrowdBodySegment(from, to, radius, bodies,\n    { allowEscape: true, onVisit: () => stats.bodyVisits++ });',
    `  const sweep = (from, to, bodies) => {
    const visited = [];
    const allowed = canTraverseCrowdBodySegment(from, to, radius, bodies,
      { allowEscape: true, onVisit: () => { stats.bodyVisits++; if (replayActive) visited.push(bodies[visited.length].id); } });
    replayNote('sweep', { from: { x: from.x, z: from.z }, to, allowed, visited });
    return allowed;
  };`);
  source = replace(source,
    '    stats.proposals++; return canTraverse(to) && sweep(unit, to, neighbors);',
    `    stats.proposals++;
    const terrain = canTraverse(to), allowed = terrain && sweep(unit, to, neighbors);
    replayNote('proposal', { to, terrain, allowed, number: stats.proposals });
    return allowed;`);
  source = replace(source,
    '    stats.pointProposals++; return pointAllowed(to) && sweep(to, to, neighbors);',
    `    stats.pointProposals++;
    const terrain = pointAllowed(to), allowed = terrain && sweep(to, to, neighbors);
    replayNote('point-proposal', { to, terrain, allowed, number: stats.pointProposals });
    return allowed;`);
  for (const [before, phase] of [
    ['  if (!state.lease && !state.contour && distance <= stepDistance', 'terminal'],
    ['  if (blocking.length && !state.detour)', 'detour'],
    ['  if (!state.lease && !state.contour && (!opposed', 'direct'],
    ['  if (finitePoint(cellCenter)) for', 'inset'],
    ['  for (const scale of [1, .5]) {', 'ordinary-headings'],
    ['  const closest = neighbors.toSorted', 'tangents'],
    ['  const lease = activePeers <= 1', 'lease'],
    ['  const contour = crowdParkedContour', 'contour'],
    ['  if (!best || yieldingToPeer ||', 'recovery'],
  ]) source = replace(source, before, `  replayPhase = '${phase}';\n${before}`);
  source = replace(source, '    if (score > bestScore) {',
    `    replayNote('score', { to, ordinaryProposal, score, bestScore, progress, rankingProgress, laneProgress });
    if (score > bestScore) {`);
  source = replace(source, '  if (!best || yieldingToPeer ||',
    `  replayNote('priority', { best, bestScore, noProgressTicks, yieldingToPeer, followingOnly,
    advancingWaypoint, projectedRouteFeedback, opposed, lane, routeX, routeZ });
  if (!best || yieldingToPeer ||`);
  return source + `
let replayActive = null, replayPhase = 'host';
let replayFrames = [];
const replayPathIds = new WeakMap(); let replayNextPathId = 1;
function replayPathId(value) {
  if (!replayPathIds.has(value)) replayPathIds.set(value, replayNextPathId++);
  return replayPathIds.get(value);
}
function replayEncode(value, key = '') {
  if (value === undefined) return { $undefined: true };
  if (typeof value === 'number' && !Number.isFinite(value)) return { $number: String(value) };
  if (!value || typeof value !== 'object') return value;
  if (['peer', 'obstacle', 'body', 'blocker', 'approachBody'].includes(key))
    return { $actor: value.id, generation: value.generation };
  if (key === 'path') return { $path: replayPathId(value), cells: [...value] };
  if (Array.isArray(value)) return value.map(v => replayEncode(v));
  return Object.fromEntries(Object.entries(value).map(([k,v]) => [k,replayEncode(v,k)]));
}
export function replayActor(unit) {
  const fields = ['id','generation','team','kind','movementDomain','hp','x','z','orderRevision','path','pathIndex',
    'moveGoalCell','moveGoalPoint','movePlanningPending','queuedWaypoints','holdingPosition','attackMove',
    'attackTargetId','attackBuildingTargetId','stanceCombat','stanceReturning','persistentOrder',
    'gatherNodeId','gatherForestCell','gatherPhase','buildingTargetId','combatStance'];
  return Object.fromEntries(fields.map(k => [k,replayEncode(unit[k],k)]));
}
export function replayHostStart(unit, tick, navigationRevision, epoch) {
  if (unit.id !== ${actorId}) return;
  assertReplayIdle(); replayPhase = 'host';
  replayActive = { tick, navigationRevision, epoch, actor: replayActor(unit), events: [], queryVisits: [] };
}
function assertReplayIdle() { if (replayActive) throw Error('nested observed actor decision'); }
export function replayQueryVisit(unit, other, bucket) {
  if (replayActive && unit.id === ${actorId}) replayActive.queryVisits.push({ bucket, actor: replayActor(other) });
}
export function replayQuery(unit, query) {
  if (replayActive && unit.id === ${actorId}) replayActive.query = {
    visits: query.visits, overflow: query.overflow, ids: query.neighbors.map(other => other.id) };
}
export function replayNote(type, details) {
  if (replayActive) replayActive.events.push({ type, phase: replayPhase, ...replayEncode(details) });
}
export function replayHostEnd(unit, result) {
  if (unit.id !== ${actorId}) return result;
  if (!replayActive) throw Error('missing observed host entry');
  replayActive.result = replayEncode(result);
  replayFrames.push(replayActive); replayActive = null;
  return result;
}
export function drainReplayFrames() { const frames = replayFrames; replayFrames = []; return frames; }
export function seedReplayStates(rows) { for (const [unit, state] of rows) {
  if (state) steeringStates.set(unit, state); else steeringStates.delete(unit);
} }
export function seedReplayPaths(rows) { for (const [id, value] of rows) {
  replayPathIds.set(value, id); replayNextPathId = Math.max(replayNextPathId, id + 1);
} }
export function selectCrowdStep(args) {
  const own = replayActive && args.unit.id === ${actorId};
  if (own) {
    const fields = ['target','progressTarget','stepDistance','cellCenter','travelDirection','tick',
      'navigationRevision','epoch','overflow','radius','diagnostics','approachBody'];
    replayActive.input = Object.fromEntries(fields.map(k => [k,replayEncode(args[k],k)]));
    replayActive.bodies = [args.unit, ...args.neighbors].map(other => ({ actor: replayActor(other),
      state: replayEncode(steeringStates.get(other) ?? null), target: replayEncode(args.targetOf?.(other)),
      direction: replayEncode(args.directionOf?.(other)) }));
  }
  const result = productionSelectCrowdStep(args);
  if (own) { replayActive.selection = replayEncode(result);
    replayActive.afterState = replayEncode(steeringStates.get(args.unit) ?? null); }
  return result;
}
`;
}

export async function createTemporalObserver(map, { actorId = 75, prepareOnly = false } = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), 'rts-temporal-observer-'));
  try {
    const crowd = await readFile(path.join(root, 'src/unit-crowd-steering.mjs'), 'utf8');
    const modulePath = path.join(directory, 'observed-crowd.mjs');
    const absolutize = s => s.replace(/from '(\.\/?[^']+)'/g,
      (_, name) => `from '${pathToFileURL(path.resolve(root, 'src', name)).href}'`);
    await writeFile(modulePath, absolutize(observedCrowdSource(crowd, actorId)));
    const moduleUrl = pathToFileURL(modulePath).href;
    const observed = await import(moduleUrl);
    let adapter = await readFile(path.join(root, 'scripts/pathing-replay-fixture.mjs'), 'utf8');
    adapter = replace(adapter, "const root = fileURLToPath(new URL('..', import.meta.url));", `const root = ${JSON.stringify(root)};`);
    adapter = replace(adapter, "await readFile(new URL('../server.mjs', import.meta.url), 'utf8')",
      "await readFile(path.join(root, 'server.mjs'), 'utf8')");
    adapter = replace(adapter, '    let source = original.replace', '    let source = instrumentHost(original).replace');
    // Keep only the requested actor's actual committed substeps, with no global
    // roster copy or claim of a second physical query at admission.
    adapter = replace(adapter, 'function recordReplayLandStep(unit, x, z, reason) {',
      `function recordReplayLandStep(unit, x, z, reason) {\n  if (unit.id !== ${actorId}) return;`);
    adapter = replace(adapter,
      "    neighbours: units.filter(other => other !== unit && other.hp > 0 && other.movementDomain !== 'water')\n      .map(other => ({ id: other.id, generation: other.generation, kind: other.kind, x: other.x, z: other.z })) });",
      '    neighbours: [] });');
    adapter += `
function instrumentHost(source) {
  const once = (before, after) => {
    if (source.split(before).length - 1 !== 1) throw Error('host observation boundary: ' + before);
    source = source.replace(before, after);
  };
  once("from './src/unit-crowd-steering.mjs'", "from '${moduleUrl}'");
  source = "import { replayActor, replayHostStart, replayHostEnd, replayQueryVisit, replayQuery, replayNote } from '${moduleUrl}';\\n" + source;
  once('function getMoveVector(', 'function productionGetMoveVector(');
  once('    const query = crowdNeighborsNear(unit);\\n    const progressTarget = target;',
    '    const query = crowdNeighborsNear(unit);\\n    replayQuery(unit, query);\\n    const progressTarget = target;');
  const queryStart = source.indexOf('function crowdNeighborsNear('), queryEnd = source.indexOf('function stationaryWorkerCellsNear(', queryStart);
  const beforeQuery = source.slice(0, queryStart), afterQuery = source.slice(queryEnd);
  let query = source.slice(queryStart, queryEnd);
  const beforeVisit = '        const other = units[id]; id = spatialBucketNext[id];';
  if (query.split(beforeVisit).length !== 2) throw Error('actual query visit boundary changed');
  query = query.replace(beforeVisit, beforeVisit + '\\n        replayQueryVisit(unit, other, row * spatialBucketColumns + column);');
  source = beforeQuery + query + afterQuery;
  const originalOracle = '      canTraverse: to => to.x >= -MAP_HALF_X + .5 && to.x <= MAP_HALF_X - .5\\n        && to.z >= -MAP_HALF_Z + .5 && to.z <= MAP_HALF_Z - .5\\n        && canTraverseUnitStep(currentCell, worldToCell(to.x, to.z), MAP_WIDTH, elevationLevelByCell, isWalkable)\\n        && canTraverseStaticBodySegment(unit, to, crowdRadius, MAP_WIDTH, MAP_HEIGHT, isWalkable, { allowEscape: true }) });';
  once(originalOracle, '      canTraverse: to => replayTraverse(unit, to, currentCell, crowdRadius) });');
  const functions = '\\nfunction getMoveVector(unit, remainingStep, allowLocalDetour) {\\n'
    + '  replayHostStart(unit, tickNumber, navigationRevision, movePlanningEpoch);\\n'
    + '  return replayHostEnd(unit, productionGetMoveVector(unit, remainingStep, allowLocalDetour));\\n}\\n'
    + 'function replayTraverse(unit, to, currentCell, radius) {\\n'
    + '  const bounds = to.x >= -MAP_HALF_X + .5 && to.x <= MAP_HALF_X - .5 && to.z >= -MAP_HALF_Z + .5 && to.z <= MAP_HALF_Z - .5;\\n'
    + '  const cell = bounds && canTraverseUnitStep(currentCell, worldToCell(to.x, to.z), MAP_WIDTH, elevationLevelByCell, isWalkable);\\n'
    + '  const terrain = cell && canTraverseStaticBodySegment(unit, to, radius, MAP_WIDTH, MAP_HEIGHT, isWalkable, { allowEscape: true });\\n'
    + '  if (unit.id === ${actorId}) replayNote("host-oracle", { to, bounds, cell, terrain });\\n'
    + '  return terrain;\\n}\\n';
  const listen = source.lastIndexOf('\\nserver.listen(PORT, HOST, () => {');
  if (listen < 0) throw Error('host listen boundary changed');
  return source.slice(0, listen) + functions + source.slice(listen);
}
export { instrumentHost };
`;
    const { createPathingReplayFixture, instrumentHost } = await import(`data:text/javascript,${encodeURIComponent(adapter)}`);
    if (prepareOnly) return { observed,
      host: instrumentHost(await readFile(path.join(root, 'server.mjs'), 'utf8')),
      async dispose() { await rm(directory, { recursive: true, force: true }); } };
    const fixture = await createPathingReplayFixture(map, { traceLandSteps: true, observeMovement: true });
    return { ...fixture, observed, async dispose() { await fixture.dispose(); await rm(directory, { recursive: true, force: true }); } };
  } catch (error) { await rm(directory, { recursive: true, force: true }); throw error; }
}
