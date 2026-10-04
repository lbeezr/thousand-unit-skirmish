import { BASE_ELEVATION_PATH_COST, canTraverseElevation, elevationPathCost } from './elevation.mjs';

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

export function activeMoveGoalPoint(unit) {
  const point = unit.moveGoalPoint;
  return point?.version === 1 && point.generation === unit.generation
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
  const fields = ['version', 'generation', 'revision', 'requestedX', 'requestedZ', 'cell', 'x', 'z'];
  const expected = createMoveGoalPoint(unit, point.requestedX, point.requestedZ, point.cell, width, height);
  return typeof point === 'object' && !Array.isArray(point)
    && Object.keys(point).length === fields.length && fields.every(key => Object.hasOwn(point, key))
    && point.version === 1 && point.generation === unit.generation
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
