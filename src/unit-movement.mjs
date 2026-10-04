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
