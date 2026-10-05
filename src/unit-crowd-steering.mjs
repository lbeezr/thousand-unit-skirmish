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
const steeringStates = new WeakMap();

function steeringState(unit, tick, navigationRevision) {
  let state = steeringStates.get(unit);
  if (!state || state.generation !== unit.generation || state.revision !== unit.orderRevision
    || state.navigationRevision !== navigationRevision || state.path !== unit.path || state.pathIndex !== unit.pathIndex) {
    state = { generation: unit.generation, revision: unit.orderRevision, navigationRevision,
      path: unit.path, pathIndex: unit.pathIndex, detour: null, lastProgressTick: tick, bestDistance: Infinity };
    steeringStates.set(unit, state);
  }
  return state;
}

export function ordinaryCrowdBodyRadius(unit) {
  return unit.hp > 0 && unit.kind !== 'worker' && unit.movementDomain !== 'water' && !unit.holdingPosition
    && !unit.movePlanningPending
    && unit.moveGoalCell >= 0 && unit.pathIndex < unit.path.length
    && !unit.attackMove && !unit.stanceCombat && !unit.stanceReturning && !unit.persistentOrder
    && !(unit.attackTargetId >= 0) && !(unit.attackBuildingTargetId >= 0)
    && unit.gatherNodeId == null && !(unit.gatherForestCell >= 0)
    && !unit.gatherPhase && unit.buildingTargetId == null
    ? LAND_CLEARANCE_PROFILE.radiusByKind[unit.kind] ?? 0 : 0;
}

export function crowdPassagePoint(center, direction, unit, neighbors, pointAllowed) {
  const radius = ordinaryCrowdBodyRadius(unit), inset = .5 - radius;
  const horizontal = Math.abs(direction.x) >= Math.abs(direction.z);
  const forward = horizontal ? Math.sign(direction.x) : Math.sign(direction.z);
  const preferred = horizontal ? { x: center.x, z: center.z + forward * inset }
    : { x: center.x - forward * inset, z: center.z };
  const closest = { x: Math.max(center.x - .499, Math.min(center.x + .499, unit.x)),
    z: Math.max(center.z - .499, Math.min(center.z + .499, unit.z)) };
  const narrow = horizontal
    ? !pointAllowed({ x: center.x, z: center.z + .75 }) && !pointAllowed({ x: center.x, z: center.z - .75 })
    : !pointAllowed({ x: center.x + .75, z: center.z }) && !pointAllowed({ x: center.x - .75, z: center.z });
  if (narrow) { if (horizontal) closest.z = preferred.z; else closest.x = preferred.x; }
  const candidates = [closest, preferred, ...[inset, .499].flatMap(offset => [-1, 0, 1].flatMap(x => [-1, 0, 1]
    .map(z => ({ x: center.x + x * offset, z: center.z + z * offset }))))];
  let best = center, score = Infinity;
  for (const point of candidates) {
    if (!pointAllowed(point) || neighbors.some(other => !ordinaryCrowdBodyRadius(other)
      && Math.hypot(point.x - other.x, point.z - other.z)
        < radius + LAND_CLEARANCE_PROFILE.radiusByKind[other.kind] - EPSILON)) continue;
    const distance = (point.x - closest.x) ** 2 + (point.z - closest.z) ** 2
      + .01 * ((point.x - preferred.x) ** 2 + (point.z - preferred.z) ** 2);
    if (distance < score) { best = point; score = distance; }
  }
  return best;
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

// At most 72 short proposals: 26 headings, four lane-boundary proposals,
// 32 tangents around eight closest bodies, and ten recovery headings. Each
// checks all 64 bodies and the host's terrain oracle. A clear terminal step
// keeps the exact point. Transient detour/progress state resets with identity,
// order, navigation or waypoint changes and never enters durable unit state.
// A crowd-only wait is not a static route failure and must not trigger repair.
export function selectCrowdStep({ unit, target, stepDistance, neighbors, canTraverse, cellCenter,
  pointAllowed = canTraverse, progressTarget = target, targetOf = other => other.target,
  travelDirection = null, tick = 0, navigationRevision = 0 }) {
  const radius = ordinaryCrowdBodyRadius(unit);
  if (!radius || !finitePoint(target) || !(stepDistance > 0 && stepDistance <= .25)) return null;
  if (neighbors.length > CROWD_NEIGHBOR_LIMIT)
    return { target, waitingForCrowd: true, stepDistance: 0 };
  const dx = target.x - unit.x, dz = target.z - unit.z, distance = Math.hypot(dx, dz);
  const state = steeringState(unit, tick, navigationRevision);
  const remaining = Math.hypot(progressTarget.x - unit.x, progressTarget.z - unit.z);
  if (remaining < state.bestDistance - .02) { state.bestDistance = remaining; state.lastProgressTick = tick; }
  const noProgressTicks = tick - state.lastProgressTick;
  if (neighbors.some(other => !ordinaryCrowdBodyRadius(other)
    && Math.hypot(target.x - other.x, target.z - other.z)
      < radius + LAND_CLEARANCE_PROFILE.radiusByKind[other.kind] - EPSILON))
    return { target, waitingForCrowd: true, stepDistance: 0, noProgressTicks };
  if (!distance) return { target, reachedWaypoint: true, stepDistance: 0 };
  const clear = to => canTraverse(to)
    && canTraverseCrowdBodySegment(unit, to, radius, neighbors, { allowEscape: true });
  if (distance <= stepDistance && clear(target)) return { target, reachedWaypoint: true, stepDistance: distance };
  const headingX = dx / distance, headingZ = dz / distance;
  const directionLength = finitePoint(travelDirection) && Math.hypot(travelDirection.x, travelDirection.z);
  const routeX = directionLength ? travelDirection.x / directionLength : headingX;
  const routeZ = directionLength ? travelDirection.z / directionLength : headingZ;
  const opposed = neighbors.some(other => {
    const goal = targetOf(other);
    if (!finitePoint(goal) || Math.hypot(other.x - unit.x, other.z - unit.z) > 2) return false;
    const ox = goal.x - other.x, oz = goal.z - other.z;
    return ox * routeX + oz * routeZ < 0;
  });
  const laneAxis = Math.abs(routeX) >= Math.abs(routeZ) ? 'z' : 'x';
  const laneSign = laneAxis === 'z' ? Math.sign(routeX) : -Math.sign(routeZ);
  const lane = finitePoint(cellCenter) ? cellCenter[laneAxis] + laneSign * (.5 - radius) : null;
  let separationX = 0, separationZ = 0;
  for (const other of neighbors) {
    const sx = unit.x - other.x, sz = unit.z - other.z, separation = Math.hypot(sx, sz);
    const reach = radius + LAND_CLEARANCE_PROFILE.radiusByKind[other.kind] + .3;
    if (separation <= EPSILON || separation >= reach) continue;
    const force = (reach - separation) / reach;
    separationX += sx / separation * force; separationZ += sz / separation * force;
  }
  const separationScale = .62 / Math.max(1, Math.hypot(separationX, separationZ));
  let preferredX = headingX + separationX * separationScale, preferredZ = headingZ + separationZ * separationScale;
  const preferredLength = Math.hypot(preferredX, preferredZ);
  preferredX /= preferredLength; preferredZ /= preferredLength;
  const directLength = Math.min(stepDistance, distance);
  const direct = { x: unit.x + headingX * directLength, z: unit.z + headingZ * directLength };
  const blocking = neighbors.filter(other => !ordinaryCrowdBodyRadius(other)
    && (other.x - unit.x) * headingX + (other.z - unit.z) * headingZ > 0
    && !canTraverseCrowdBodySegment(unit, direct, radius, [other], { allowEscape: true }));
  if (blocking.length && !state.detour) {
    const other = blocking.toSorted((a, b) => Math.hypot(a.x - unit.x, a.z - unit.z)
      - Math.hypot(b.x - unit.x, b.z - unit.z) || a.id - b.id)[0];
    const clearance = radius + LAND_CLEARANCE_PROFILE.radiusByKind[other.kind] + .12;
    const sides = [90, -90, 135, -135, 45, -45].map(angle => {
      const radians = angle * Math.PI / 180;
      return { x: other.x + (headingX * Math.cos(radians) - headingZ * Math.sin(radians)) * clearance,
        z: other.z + (headingZ * Math.cos(radians) + headingX * Math.sin(radians)) * clearance };
    });
    const legal = sides.filter(p => pointAllowed(p)
      && canTraverseCrowdBodySegment(p, p, radius, neighbors));
    if (legal.length) state.detour = { ...legal[0], alternatives: legal.slice(1), distance,
      bestDistance: Infinity, lastProgressTick: tick };
  }
  if (state.detour) {
    const detourDistance = Math.hypot(state.detour.x - unit.x, state.detour.z - unit.z);
    if (detourDistance < state.detour.bestDistance - .02) {
      state.detour.bestDistance = detourDistance; state.detour.lastProgressTick = tick;
    }
    if (!pointAllowed(state.detour) || tick - state.detour.lastProgressTick >= 30) {
      const alternative = state.detour.alternatives.shift();
      if (alternative && pointAllowed(alternative)) Object.assign(state.detour, alternative,
        { bestDistance: Infinity, lastProgressTick: tick });
      else state.detour = null;
    }
    if (state.detour && (detourDistance < .03 || (clear(direct) && distance < state.detour.distance - .05))) state.detour = null;
    if (state.detour) {
      const length = Math.hypot(state.detour.x - unit.x, state.detour.z - unit.z);
      preferredX = (state.detour.x - unit.x) / length;
      preferredZ = (state.detour.z - unit.z) / length;
    }
  }
  if ((!opposed || lane === null) && Math.hypot(separationX, separationZ) < EPSILON && clear(direct))
    return { x: headingX, z: headingZ, target, stepDistance: directLength };
  let best = null, bestScore = -Infinity;
  const consider = to => {
    const length = Math.hypot(to.x - unit.x, to.z - unit.z);
    if (length <= EPSILON || length > stepDistance + EPSILON || !clear(to)) return;
    const progress = distance - Math.hypot(target.x - to.x, target.z - to.z);
    const cross = headingX * (to.z - unit.z) - headingZ * (to.x - unit.x);
    const laneProgress = opposed && lane !== null
      ? Math.abs(unit[laneAxis] - lane) - Math.abs(to[laneAxis] - lane) : 0;
    const directed = (to.x - unit.x) * preferredX + (to.z - unit.z) * preferredZ;
    const score = state.detour ? .1 * progress + .9 * directed : progress + laneProgress + (cross > 0 ? 1e-7 : 0);
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
  // Near-contact tangents avoid angular quantization at a queued merge. Limit
  // proposals to eight closest bodies; admission still checks every neighbour.
  const closest = neighbors.toSorted((a, b) =>
    ((a.x - unit.x) ** 2 + (a.z - unit.z) ** 2) - ((b.x - unit.x) ** 2 + (b.z - unit.z) ** 2)
    || a.id - b.id).slice(0, 8);
  for (const other of closest) {
    const sx = unit.x - other.x, sz = unit.z - other.z, separation = Math.hypot(sx, sz);
    if (separation <= EPSILON) continue;
    for (const sign of [1, -1]) for (const scale of [1, .5])
      consider({ x: unit.x - sign * sz / separation * stepDistance * scale,
        z: unit.z + sign * sx / separation * stepDistance * scale });
  }
  // A moving lower-priority actor may yield its own position when a live route
  // claimant blocks every forward/lateral candidate. Parked actors never yield.
  // The tie uses durable actor identity; each retreat is still a short physical
  // admission and leaves route/order/queue unchanged.
  const yieldingToPeer = noProgressTicks >= 30 && neighbors.some(other => other.id < unit.id && finitePoint(targetOf(other))
    && (targetOf(other).x - other.x) * routeX + (targetOf(other).z - other.z) * routeZ
      < 0
    && Math.hypot(other.x - unit.x, other.z - unit.z)
      < radius + LAND_CLEARANCE_PROFILE.radiusByKind[other.kind] + stepDistance + .1);
  if (!best || yieldingToPeer || (state.detour && noProgressTicks >= 30)) {
    if (yieldingToPeer) { best = null; bestScore = -Infinity; }
    for (const scale of [1, .5]) for (const angle of [105, -105, 135, -135, 180]) {
      const radians = angle * Math.PI / 180, length = stepDistance * scale;
      consider({ x: unit.x + (headingX * Math.cos(radians) - headingZ * Math.sin(radians)) * length,
        z: unit.z + (headingZ * Math.cos(radians) + headingX * Math.sin(radians)) * length });
    }
    if (best) best.yieldingForCrowd = true;
  }
  return best ? { ...best, noProgressTicks } : { target, waitingForCrowd: true, stepDistance: 0, noProgressTicks };
}
