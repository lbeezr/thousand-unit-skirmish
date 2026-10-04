import { LAND_CLEARANCE_PROFILE, pointSegmentDistanceSquared } from './unit-movement.mjs';

// The host supplies current serial-executor neighbours and its terrain/static
// admission predicate. This module never moves a neighbour or changes an order.
export const CROWD_NEIGHBOR_LIMIT = 64;
const EPSILON = 1e-9;
const ANGLES = [0, 15, 30, 45, 60, 75, 90, -15, -30, -45, -60, -75, -90];
const DIRECTIONS = ANGLES.map(angle => {
  const radians = angle * Math.PI / 180;
  return { cosine: Math.cos(radians), sine: Math.sin(radians) };
});
const finitePoint = p => p && Number.isFinite(p.x) && Number.isFinite(p.z);

export function ordinaryCrowdBodyRadius(unit) {
  return unit.hp > 0 && unit.movementDomain !== 'water' && !unit.holdingPosition
    && unit.moveGoalCell >= 0 && unit.pathIndex < unit.path.length
    && !unit.attackMove && !unit.stanceCombat && !unit.stanceReturning && !unit.persistentOrder
    && !(unit.attackTargetId >= 0) && !(unit.attackBuildingTargetId >= 0)
    && unit.gatherNodeId == null && !(unit.gatherForestCell >= 0)
    && !unit.gatherPhase && unit.buildingTargetId == null
    ? LAND_CLEARANCE_PROFILE.radiusByKind[unit.kind] ?? 0 : 0;
}

// An inherited overlapping pose may escape monotonically, within the same short
// bound as static recovery. It cannot deepen that contact or enter a new body.
export function canTraverseCrowdBodySegment(from, to, radius, neighbors, { allowEscape = false } = {}) {
  if (!finitePoint(from) || !finitePoint(to) || !(radius > 0 && radius <= .5)
    || neighbors.length > CROWD_NEIGHBOR_LIMIT
    || Math.hypot(to.x - from.x, to.z - from.z) > .25 + EPSILON) return false;
  let escaping = false, improved = false;
  for (const other of neighbors) {
    const otherRadius = LAND_CLEARANCE_PROFILE.radiusByKind[other.kind];
    if (!finitePoint(other) || !Number.isFinite(otherRadius)) return false;
    const required = radius + otherRadius;
    const swept = Math.sqrt(pointSegmentDistanceSquared(other, from, to));
    if (swept >= required - EPSILON) continue;
    const start = Math.hypot(from.x - other.x, from.z - other.z);
    const end = Math.hypot(to.x - other.x, to.z - other.z);
    if (!allowEscape || start >= required - EPSILON || swept < start - EPSILON || end < start - EPSILON) return false;
    escaping = true; improved ||= end > start + EPSILON;
  }
  return !escaping || improved;
}

// Thirteen fixed headings, two step lengths and at most 64 bodies. A clear
// terminal step keeps the exact point. Otherwise maximize waypoint progress,
// with a stable right-hand preference when the two sides are equivalent.
// A crowd-only wait is not a static route failure and must not trigger repair.
export function selectCrowdStep({ unit, target, stepDistance, neighbors, canTraverse, cellCenter }) {
  const radius = ordinaryCrowdBodyRadius(unit);
  if (!radius || !finitePoint(target) || !(stepDistance > 0 && stepDistance <= .25)) return null;
  if (neighbors.length > CROWD_NEIGHBOR_LIMIT)
    return { target, waitingForCrowd: true, stepDistance: 0 };
  const dx = target.x - unit.x, dz = target.z - unit.z, distance = Math.hypot(dx, dz);
  if (!distance) return { target, reachedWaypoint: true, stepDistance: 0 };
  const clear = to => canTraverse(to)
    && canTraverseCrowdBodySegment(unit, to, radius, neighbors, { allowEscape: true });
  if (distance <= stepDistance && clear(target)) return { target, reachedWaypoint: true, stepDistance: distance };
  const headingX = dx / distance, headingZ = dz / distance;
  const directLength = Math.min(stepDistance, distance);
  const direct = { x: unit.x + headingX * directLength, z: unit.z + headingZ * directLength };
  if (clear(direct)) return { x: headingX, z: headingZ, target, stepDistance: directLength };
  let best = null, bestScore = -Infinity;
  const consider = to => {
    const length = Math.hypot(to.x - unit.x, to.z - unit.z);
    if (length <= EPSILON || length > stepDistance + EPSILON || !clear(to)) return;
    const progress = distance - Math.hypot(target.x - to.x, target.z - to.z);
    const cross = headingX * (to.z - unit.z) - headingZ * (to.x - unit.x);
    const score = progress + (cross > 0 ? 1e-7 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = { x: (to.x - unit.x) / length, z: (to.z - unit.z) / length, target, stepDistance: length };
    }
  };
  // Exact inset candidates avoid quantized-angle starvation in a corridor that
  // fits two mixed circles only at tangency. Cell bounds are candidate locations,
  // never the clearance oracle: both physical predicates must still accept them.
  if (finitePoint(cellCenter)) for (const side of [1, -1]) {
    if (Math.abs(headingX) >= Math.abs(headingZ)) {
      const z = cellCenter.z + Math.sign(headingX) * side * (.5 - radius);
      const lateral = z - unit.z;
      if (Math.abs(lateral) <= stepDistance) {
        consider({ x: unit.x, z });
        consider({ x: unit.x + Math.sign(headingX) * Math.sqrt(Math.max(0, stepDistance ** 2 - lateral ** 2)), z });
      }
    } else {
      const x = cellCenter.x - Math.sign(headingZ) * side * (.5 - radius);
      const lateral = x - unit.x;
      if (Math.abs(lateral) <= stepDistance) {
        consider({ x, z: unit.z });
        consider({ x, z: unit.z + Math.sign(headingZ) * Math.sqrt(Math.max(0, stepDistance ** 2 - lateral ** 2)) });
      }
    }
  }
  for (const scale of [1, .5]) {
    const length = Math.min(stepDistance * scale, distance);
    for (const { cosine, sine } of DIRECTIONS) {
      const x = headingX * cosine - headingZ * sine, z = headingZ * cosine + headingX * sine;
      const to = { x: unit.x + x * length, z: unit.z + z * length };
      consider(to);
    }
  }
  return best ?? { target, waitingForCrowd: true, stepDistance: 0 };
}
