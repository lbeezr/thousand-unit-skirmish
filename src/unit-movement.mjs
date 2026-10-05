import { BASE_ELEVATION_PATH_COST, canTraverseElevation, elevationPathCost } from './elevation.mjs';
import { visitGridSegmentCells } from './unit-path-line.mjs';
import { constructionMovementActive } from './construction-work-intent.mjs';
import { attackMoveObjectiveMovementActive, focusedUnitAttackMovementActive, focusedBuildingAttackMovementActive, attackMoveAcquiredMovementActive, stanceAcquiredMovementActive, patrolTravelMovementActive, patrolAcquiredMovementActive, followTravelMovementActive, workerFollowTravelMovementActive } from './combat-movement.mjs';

// Static land circles, in tiles/world units. Adopters are explicit: ordinary
// single-unit Move/queued points, Worker economy/construction and target-free
// explicit AttackMove objectives/acquired pursuit, focused unit/building Attack,
// acquired Aggressive/Defensive stance pursuit, Patrol travel/pursuit and
// target-free military Follow;
// other domains follow.
// These are authored collision sizes, not sprite bounds or soft-separation size.
export const LAND_CLEARANCE_PROFILE = Object.freeze({ id: 'land-static-circle-v1',
  radiusByKind: Object.freeze({ worker: .18, infantry: .22, spearman: .22, archer: .22,
    scout: .28, rider: .28, 'siege-engine': .35 }) });
const CLEARANCE_EPSILON = 1e-9;
const finitePoint = p => p && Number.isFinite(p.x) && Number.isFinite(p.z);
export function pointSegmentDistanceSquared(p, a, b) {
  if (!finitePoint(a) || !finitePoint(b)) throw new TypeError('finite movement segment required');
  if (!finitePoint(p)) throw new TypeError('finite body position required');
  const dx = b.x - a.x, dz = b.z - a.z, length = dx * dx + dz * dz;
  const t = length ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / length)) : 0;
  return (p.x - a.x - t * dx) ** 2 + (p.z - a.z - t * dz) ** 2;
}
export function segmentRectangleDistanceSquared(a, b, rectangle) {
  if (!finitePoint(a) || !finitePoint(b)) throw new TypeError('finite movement segment required');
  const { minX, minZ, maxX, maxZ } = rectangle;
  if (![minX, minZ, maxX, maxZ].every(Number.isFinite) || minX > maxX || minZ > maxZ)
    throw new TypeError('finite ordered rectangle required');
  let enter = 0, exit = 1;
  for (const [start, delta, low, high] of [[a.x, b.x - a.x, minX, maxX], [a.z, b.z - a.z, minZ, maxZ]]) {
    if (delta === 0) { if (start < low || start > high) { enter = Infinity; break; } }
    else {
      const t1 = (low - start) / delta, t2 = (high - start) / delta;
      enter = Math.max(enter, Math.min(t1, t2)); exit = Math.min(exit, Math.max(t1, t2));
    }
  }
  if (enter <= exit) return 0;
  const pointRectangle = p => Math.max(minX - p.x, 0, p.x - maxX) ** 2
    + Math.max(minZ - p.z, 0, p.z - maxZ) ** 2;
  return Math.min(pointRectangle(a), pointRectangle(b),
    ...[[minX, minZ], [minX, maxZ], [maxX, minZ], [maxX, maxZ]]
      .map(([x, z]) => pointSegmentDistanceSquared({ x, z }, a, b)));
}

// Visit only crossed cells and their one-cell neighborhoods: no rectangular
// whole-map scan for a long diagonal. The caller retains its terrain/cost guard.
// A legacy overlapped start may escape in a short monotone step, never deepen
// an existing penetration or introduce one against another footprint.
export function canTraverseStaticBodySegment(a, b, radius, width, height, isWalkable, { allowEscape = false } = {}) {
  if (!finitePoint(a) || !finitePoint(b) || !Number.isFinite(radius) || radius < 0 || radius > .5
    || !Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0
    || (allowEscape && Math.hypot(b.x - a.x, b.z - a.z) > .25 + CLEARANCE_EPSILON)) return false;
  const halfX = width / 2, halfZ = height / 2;
  let escaping = false, improved = false;
  const accepts = (swept, start, end) => {
    if (swept >= radius - CLEARANCE_EPSILON) return true;
    if (!allowEscape || start >= radius - CLEARANCE_EPSILON
      || swept < start - CLEARANCE_EPSILON || end < start - CLEARANCE_EPSILON) return false;
    escaping = true; improved ||= end > start + CLEARANCE_EPSILON;
    return true;
  };
  for (const [start, end] of [[halfX + a.x, halfX + b.x], [halfX - a.x, halfX - b.x],
    [halfZ + a.z, halfZ + b.z], [halfZ - a.z, halfZ - b.z]]) {
    if (!accepts(Math.min(start, end), start, end)) return false;
  }
  const clear = visitGridSegmentCells(a.x + halfX, a.z + halfZ, b.x + halfX, b.z + halfZ,
    width, width * height, cell => {
      const column = cell % width, row = Math.floor(cell / width);
      for (let z = Math.max(0, row - 1); z <= Math.min(height - 1, row + 1); z++)
        for (let x = Math.max(0, column - 1); x <= Math.min(width - 1, column + 1); x++) {
          if (isWalkable(z * width + x)) continue;
          const rectangle = { minX: x - halfX, minZ: z - halfZ, maxX: x - halfX + 1, maxZ: z - halfZ + 1 };
          const swept = Math.sqrt(segmentRectangleDistanceSquared(a, b, rectangle));
          if (!accepts(swept, allowEscape ? Math.sqrt(segmentRectangleDistanceSquared(a, a, rectangle)) : 0,
            allowEscape ? Math.sqrt(segmentRectangleDistanceSquared(b, b, rectangle)) : 0)) return false;
        }
      return true;
    });
  return clear && (!escaping || improved);
}

// Cost of the planner's original grid representation, before execution shortcuts.
// A distant waypoint is produced only by the existing flat direct-route check;
// its equivalent cardinal graph cost is Manhattan distance, not physical length.
export function unitRoutePathCost(startCell, path, width, levels) {
  if (path == null) return null;
  let previous = startCell, cost = 0;
  for (const cell of path) {
    const distance = Math.abs(cell % width - previous % width)
      + Math.abs(Math.floor(cell / width) - Math.floor(previous / width));
    cost += distance > 1 ? distance * BASE_ELEVATION_PATH_COST
      : distance === 1 ? elevationPathCost(levels, previous, cell) : 0;
    previous = cell;
  }
  return cost;
}

// Gameplay supplies goal membership and actual arrival separately. An exhausted
// path inside an access cell may still need its center before interaction range.
// These results live on planning assignments/stack frames, never on saved units.
export function createUnitRouteResult({ unit, revision = unit.orderRevision, epoch, navigationRevision,
  startCell, path, startIsGoal = false, arrived = false, originalCost = null }) {
  const status = path == null ? 'deferred' : path.length > 0 ? 'ready'
    : startIsGoal ? arrived ? 'arrived' : 'ready' : 'unreachable';
  const selectedGoalCell = status === 'deferred' ? -1
    : path.length ? path.at(-1) : startIsGoal ? startCell : -1;
  return { status, startCell, selectedGoalCell,
    originalPathLength: path?.length ?? null,
    originalCost: status === 'unreachable' || status === 'deferred' ? null : originalCost,
    path: status === 'ready' && path.length === 0 ? [startCell] : path ?? [],
    identity: { unit, generation: unit.generation, revision, epoch, navigationRevision } };
}

export function unitRouteResultIsCurrent(result, unit, epoch, navigationRevision) {
  const identity = result.identity;
  return identity.unit === unit && identity.generation === unit.generation
    && identity.revision === unit.orderRevision && identity.epoch === epoch
    && identity.navigationRevision === navigationRevision;
}

// Rejoin an already selected route from an actual fractional position. Preserve
// every selected waypoint and opaque metadata; this never selects/shortens a
// route or publishes intent. The caller retains terrain and prefix admissibility.
export function unitRouteRejoinDecision(route, { position, startCell, firstPoint, radius,
  width, height, isWalkable, cellToWorld, requiresRejoin = false, acceptPrefix = () => true }) {
  if (route == null || route.path == null || route.path.length === 0
    || (route.status != null && route.status !== 'ready')) return 'unchanged';
  if (!Array.isArray(route.path)) throw new TypeError('selected route path must be an array');
  if (!finitePoint(position) || !finitePoint(firstPoint) || !Number.isFinite(radius) || radius < 0 || radius > .5
    || !Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0
    || !Number.isInteger(startCell) || startCell < 0 || startCell >= width * height)
    return 'rejected';
  const needed = requiresRejoin || (radius > 0
    && !canTraverseStaticBodySegment(position, firstPoint, radius, width, height, isWalkable));
  if (!needed) return 'unchanged';
  const center = cellToWorld(startCell);
  if (!finitePoint(center) || !acceptPrefix(center, startCell)) return 'rejected';
  return 'prefixed';
}

export function rejoinSelectedUnitRoute(route, options) {
  const rejoin = unitRouteRejoinDecision(route, options);
  return { route: rejoin === 'prefixed' ? { ...route, path: [options.startCell, ...route.path] } : route, rejoin };
}

// One synchronous publication group/executor phase: metadata census, not a live registry.
// Count every saved field, including aliases and exhausted arrays. The host
// supplies the checkpoint quota. Legacy routes never read this census.
export function createUnitRoutePublicationLedger(width, height, units, nodes, limits) {
  if (Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0
    && width <= 256 && height <= 256) return null;
  const { maxUnits, maxResourceNodes, maxEntries } = limits;
  const cellCount = width * height;
  let valid = Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0
    && width <= 320 && height <= 320
    && Number.isSafeInteger(maxUnits) && maxUnits >= 0
    && Number.isSafeInteger(maxResourceNodes) && maxResourceNodes >= 0
    && Number.isSafeInteger(maxEntries) && maxEntries >= 0
    && Array.isArray(units) && units.length <= maxUnits
    && (Array.isArray(nodes) ? nodes.length <= maxResourceNodes : nodes instanceof Map && nodes.size <= maxResourceNodes);
  let routeEntries = 0, fieldVisits = 0;
  const count = path => {
    fieldVisits++;
    if (!Array.isArray(path) || path.length > cellCount) { valid = false; return; }
    routeEntries += path.length;
  };
  if (valid) {
    for (const actor of units) {
      if (!actor || typeof actor !== 'object' || Array.isArray(actor)) { valid = false; break; }
      count(actor.path);
      if (actor.attackMoveResumePath !== null) count(actor.attackMoveResumePath);
    }
    for (const node of nodes instanceof Map ? nodes.values() : nodes) {
      if (!node || typeof node !== 'object' || Array.isArray(node)) { valid = false; break; }
      if (node.wildlifeHerd != null) {
        if (typeof node.wildlifeHerd !== 'object' || Array.isArray(node.wildlifeHerd)) { valid = false; break; }
        count(node.wildlifeHerd.path);
      }
    }
  }
  const check = (unit, pathEntries, { clearResume = false } = {}) => {
    const oldEntries = Array.isArray(unit?.path) ? unit.path.length : NaN;
    // Credit a second saved field only when this synchronous caller actually
    // clears it. Aliased active/resume arrays remain two serialized fields.
    const oldResumeEntries = !clearResume || unit?.attackMoveResumePath === null ? 0
      : Array.isArray(unit?.attackMoveResumePath) ? unit.attackMoveResumePath.length : NaN;
    const prospectiveEntries = routeEntries - oldEntries - oldResumeEntries + pathEntries;
    const reason = !valid || !Number.isSafeInteger(oldEntries) || !Number.isSafeInteger(oldResumeEntries) ? 'invalid-live-route-envelope'
      : !Number.isSafeInteger(pathEntries) || pathEntries < 0 || pathEntries > cellCount ? 'path-entry-limit'
      : prospectiveEntries > maxEntries ? 'aggregate-entry-limit' : null;
    return { status: reason ? 'deferred' : 'ready', reason, routeEntries, prospectiveEntries,
      pathEntries, fieldVisits, maxEntries };
  };
  return { check, commit(unit, pathEntries, options) {
    const outcome = check(unit, pathEntries, options);
    if (outcome.status !== 'ready') throw new Error('unreserved route publication');
    routeEntries = outcome.prospectiveEntries;
    return outcome;
  } };
}

// Ordinary single-unit Move keeps the requested point apart from its legal
// arrival. Reprojection may change the cell without changing the user's intent.
export function createMoveGoalPoint(unit, requestedX, requestedZ, cell, width, height) {
  const halfX = width / 2, halfZ = height / 2;
  const column = Math.max(0, Math.min(width - 1, Math.floor(requestedX + halfX)));
  const row = Math.max(0, Math.min(height - 1, Math.floor(requestedZ + halfZ)));
  const exact = row * width + column === cell;
  return { version: 1, generation: unit.generation, revision: unit.orderRevision,
    requestedX, requestedZ, cell,
    x: exact ? Math.max(-halfX + .5, Math.min(halfX - .5, requestedX)) : cell % width - halfX + .5,
    z: exact ? Math.max(-halfZ + .5, Math.min(halfZ - .5, requestedZ)) : Math.floor(cell / width) - halfZ + .5 };
}

function insetMoveGoalPoint(point, kind, width, height) {
  const radius = LAND_CLEARANCE_PROFILE.radiusByKind[kind];
  const minX = point.cell % width - width / 2, minZ = Math.floor(point.cell / width) - height / 2;
  return { ...point, x: Math.max(minX + radius, Math.min(minX + 1 - radius, point.x)),
    z: Math.max(minZ + radius, Math.min(minZ + 1 - radius, point.z)) };
}
export function createClearanceMoveGoalPoint(unit, requestedX, requestedZ, cell, width, height, isWalkable) {
  const point = createMoveGoalPoint(unit, requestedX, requestedZ, cell, width, height);
  const radius = LAND_CLEARANCE_PROFILE.radiusByKind[unit.kind];
  if (!Number.isFinite(radius) || unit.movementDomain === 'water') throw new TypeError('known land clearance kind required');
  const exact = canTraverseStaticBodySegment(point, point, radius, width, height, isWalkable);
  return { ...(exact ? point : insetMoveGoalPoint(point, unit.kind, width, height)), version: 2,
    clearanceProfile: LAND_CLEARANCE_PROFILE.id, arrivalPolicy: exact ? 'exact' : 'cell-inset' };
}
export function ordinaryMoveBodyRadius(unit) {
  return activeMoveGoalPoint(unit) ? LAND_CLEARANCE_PROFILE.radiusByKind[unit.kind] ?? 0 : 0;
}

// Economy routes and productive separation share the Worker footprint. Derive
// this policy from the existing live intent; no new checkpoint/activation flag.
// Node-free explicit Return remains active through its to-base phase.
export function workerEconomyBodyRadius(unit) {
  return unit.kind === 'worker' && unit.hp > 0 && unit.movementDomain !== 'water'
    && !unit.holdingPosition && !unit.attackMove && !unit.stanceCombat && !unit.stanceReturning
    && !unit.persistentOrder && !(unit.attackTargetId >= 0) && !(unit.attackBuildingTargetId >= 0)
    && unit.buildingTargetId == null && ['to-node', 'to-base', 'gathering'].includes(unit.gatherPhase)
    && (unit.gatherNodeId != null || unit.gatherForestCell >= 0 || (unit.gatherPhase === 'to-base' && unit.cargo > 0))
    ? LAND_CLEARANCE_PROFILE.radiusByKind.worker : 0;
}
export function activeLandMovementBodyRadius(unit) {
  return ordinaryMoveBodyRadius(unit) || workerEconomyBodyRadius(unit)
    || (constructionMovementActive(unit) || workerFollowTravelMovementActive(unit) ? LAND_CLEARANCE_PROFILE.radiusByKind.worker : 0)
    || (attackMoveObjectiveMovementActive(unit) || focusedUnitAttackMovementActive(unit) || focusedBuildingAttackMovementActive(unit) || attackMoveAcquiredMovementActive(unit)
      || stanceAcquiredMovementActive(unit) || patrolTravelMovementActive(unit) || patrolAcquiredMovementActive(unit) || followTravelMovementActive(unit)
      ? LAND_CLEARANCE_PROFILE.radiusByKind[unit.kind] ?? 0 : 0);
}

export function activeMoveGoalPoint(unit) {
  const point = unit.moveGoalPoint;
  return (point?.version === 1 || (point?.version === 2 && point.clearanceProfile === LAND_CLEARANCE_PROFILE.id))
    && point.generation === unit.generation
    && point.revision === unit.orderRevision && point.cell === unit.moveGoalCell
    && unit.hp > 0 && unit.movementDomain !== 'water' && !unit.holdingPosition
    && !unit.attackMove && !unit.stanceCombat && !unit.stanceReturning && !unit.persistentOrder
    && !(unit.attackTargetId >= 0) && !(unit.attackBuildingTargetId >= 0)
    && unit.gatherNodeId == null && !(unit.gatherForestCell >= 0)
    && !unit.gatherPhase && unit.buildingTargetId == null ? point : null;
}

export function validMoveGoalPoint(point, unit, width, height,
  { destination = unit.moveGoalCell, queued = false } = {}) {
  if (point == null) return true; // Historical cell-centered saves have no point.
  const fields = ['version', 'generation', 'revision', 'requestedX', 'requestedZ', 'cell', 'x', 'z',
    ...(point.version === 2 ? ['clearanceProfile', 'arrivalPolicy'] : [])];
  let expected = createMoveGoalPoint(unit, point.requestedX, point.requestedZ, point.cell, width, height);
  if (point.version === 2 && point.arrivalPolicy === 'cell-inset') expected = insetMoveGoalPoint(expected, unit.kind, width, height);
  return typeof point === 'object' && !Array.isArray(point)
    && Object.keys(point).length === fields.length && fields.every(key => Object.hasOwn(point, key))
    && (point.version === 1 || (point.version === 2 && point.clearanceProfile === LAND_CLEARANCE_PROFILE.id
      && ['exact', 'cell-inset'].includes(point.arrivalPolicy) && Number.isFinite(LAND_CLEARANCE_PROFILE.radiusByKind[unit.kind])))
    && point.generation === unit.generation
    && Number.isSafeInteger(point.revision) && point.revision >= 0
    && (queued ? point.revision <= unit.orderRevision : point.revision === unit.orderRevision)
    && unit.movementDomain !== 'water' && Number.isInteger(point.cell)
    && point.cell >= 0 && point.cell < width * height && point.cell === destination
    && [point.requestedX, point.requestedZ, point.x, point.z].every(Number.isFinite)
    && point.x === expected.x && point.z === expected.z
    && Math.abs(point.x) <= width / 2 - .5 && Math.abs(point.z) <= height / 2 - .5
    && Math.floor(point.z + height / 2) * width + Math.floor(point.x + width / 2) === point.cell
    && (queued || activeMoveGoalPoint(unit) === point);
}

// Simulation steps are shorter than one tile. Separation can deflect them away
// from a planned cardinal route, so check the crossed boundaries as well as the
// destination. Both sides of a diagonal must be open to avoid cutting a corner.
export function canTraverseUnitStep(from, to, width, levels, isWalkable) {
  if (!Number.isInteger(width) || width <= 0 || levels.length === 0
    || levels.length % width !== 0
    || !Number.isInteger(from) || !Number.isInteger(to)
    || from < 0 || to < 0 || from >= levels.length || to >= levels.length
    || !isWalkable(to) || !canTraverseElevation(levels, from, to)) return false;
  const dx = to % width - from % width;
  const dz = Math.floor(to / width) - Math.floor(from / width);
  if (Math.abs(dx) > 1 || Math.abs(dz) > 1) return false;
  if (dx === 0 || dz === 0) return true;
  const acrossX = from + dx;
  const acrossZ = from + dz * width;
  return isWalkable(acrossX) && isWalkable(acrossZ)
    && canTraverseElevation(levels, from, acrossX)
    && canTraverseElevation(levels, acrossX, to)
    && canTraverseElevation(levels, from, acrossZ)
    && canTraverseElevation(levels, acrossZ, to);
}
