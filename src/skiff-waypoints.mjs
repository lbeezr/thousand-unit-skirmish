import { planSkiffGroupMove, SKIFF_GROUP_ORDER_LIMIT } from './skiff-group-orders.mjs';

const moving = unit => unit.pathIndex < unit.path.length;
const working = unit => unit.gatherPhase !== '' || unit.gatherNodeId !== null;

// Reuse the existing {destination, attackMove} queue, never the land planner.
// Preflight from each boat's accepted tail; commit still belongs to the caller.
export function planSkiffWaypoints(water, selected, x, z, units, queueLimit = 8) {
  if (selected.some(working)) return { status: 'finish-or-stop-fishing-first', assignments: [] };
  if (selected.some(unit => (moving(unit) || unit.queuedWaypoints.length > 0) && unit.queuedWaypoints.length >= queueLimit)) {
    return { status: 'queue-limit', assignments: [] };
  }
  const projected = new Map();
  for (const unit of selected) {
    const append = moving(unit) || unit.queuedWaypoints.length > 0;
    const tail = unit.queuedWaypoints.at(-1)?.destination ?? unit.moveGoalCell;
    const point = append ? water.graph.pointAt(tail) : unit;
    if (!point) return { status: 'invalid-endpoints', assignments: [] };
    projected.set(unit.id, { ...unit, x: point.x, z: point.z, path: [], pathIndex: 0, moveGoalCell: -1 });
  }
  const actors = units.map(unit => projected.get(unit.id) ?? unit);
  const retainedRouteIds = new Set(selected.filter(unit => moving(unit) || unit.queuedWaypoints.length > 0).map(unit => unit.id));
  const plan = planSkiffGroupMove(water, selected.map(unit => projected.get(unit.id)), x, z, actors,
    { reserveQueuedGoals: true, liveUnits: units, retainedRouteIds });
  if (plan.status !== 'found') return plan;
  const originals = new Map(selected.map(unit => [unit.id, unit]));
  return { status: 'found', assignments: plan.assignments.map(({ unit, route }) => {
    const original = originals.get(unit.id);
    return { unit: original, route, destination: route.cells.at(-1), append: moving(original) || original.queuedWaypoints.length > 0 };
  }) };
}

export function validSkiffWaypoints(water, unit, queueLimit = 8) {
  const queue = unit.queuedWaypoints;
  return Array.isArray(queue) && queue.length <= queueLimit
    && (!queue.length || (!working(unit) && !unit.holdingPosition))
    && queue.every(waypoint => waypoint?.attackMove === false && Number.isInteger(waypoint.destination)
      && water.graph.isNavigable(waypoint.destination)
      && water.graph.componentAt(waypoint.destination) === water.graph.componentAt(water.graph.cellAt(unit.x, unit.z)));
}

// A blocked accepted waypoint stays at the head and retries; it is never
// silently relocated to land or consumed before a water route is available.
export function advanceSkiffWaypoints(water, units, seconds) {
  let changed = false, remaining = 16384, attempts = 0;
  for (const unit of units) {
    if (unit.hp <= 0 || unit.movementDomain !== 'water' || !unit.queuedWaypoints.length
      || working(unit) || unit.holdingPosition || moving(unit)) continue;
    unit.repathTimer = Math.max(0, unit.repathTimer - seconds);
    if (unit.repathTimer > 0 || remaining <= 0 || attempts >= SKIFF_GROUP_ORDER_LIMIT) continue;
    attempts++;
    const point = water.graph.pointAt(unit.queuedWaypoints[0].destination);
    const route = water.planReserved(unit, point.x, point.z, units,
      { maxExpandedCells: Math.min(4096, water.graph.cellCount, remaining) });
    remaining -= route.expandedCells;
    if (route.status !== 'found') { unit.repathTimer = 1; changed = true; continue; }
    unit.queuedWaypoints.shift(); unit.path = route.cells; unit.pathIndex = 0;
    unit.moveGoalCell = route.cells.at(-1); unit.waterMoveBlocked = false;
    unit.orderRevision++; unit.repathTimer = 0; changed = true;
  }
  return changed;
}
