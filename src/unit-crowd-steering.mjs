import { LAND_CLEARANCE_PROFILE, pointSegmentDistanceSquared } from './unit-movement.mjs';
import { crowdWaitLease } from './crowd-wait-lease.mjs';
import { crowdParkedContour } from './crowd-parked-contour.mjs';

// The host supplies current serial-executor neighbours and its terrain/static
// admission predicate. An explicit radius admits another host-owned movement
// policy without changing ordinary military activation. This module never moves
// a neighbour or changes an order.
export const CROWD_NEIGHBOR_LIMIT = 64;
export const CROWD_PROPOSAL_LIMIT = 128;
export const CROWD_POINT_PROPOSAL_LIMIT = 64;
const EPSILON = 1e-9;
const ANGLES = [0, 15, 30, 45, 60, 75, 90, -15, -30, -45, -60, -75, -90];
const DIRECTIONS = ANGLES.map(angle => {
  const radians = angle * Math.PI / 180;
  return { cosine: Math.cos(radians), sine: Math.sin(radians) };
});
const finitePoint = p => p && Number.isFinite(p.x) && Number.isFinite(p.z);
const steeringStates = new WeakMap();

function steeringState(unit, tick, navigationRevision, epoch) {
  let state = steeringStates.get(unit);
  if (!state || state.generation !== unit.generation || state.revision !== unit.orderRevision
    || state.navigationRevision !== navigationRevision || state.epoch !== epoch || tick < state.lastTick
    || state.path !== unit.path || state.pathIndex !== unit.pathIndex) {
    state = { generation: unit.generation, revision: unit.orderRevision, navigationRevision, epoch,
      path: unit.path, pathIndex: unit.pathIndex, detour: null, lastProgressTick: tick, bestDistance: Infinity,
      lease: null, leaseCooldown: -Infinity, lastGrantTick: -Infinity, offer: null, offerTick: -Infinity };
    steeringStates.set(unit, state);
  }
  if (tick > state.lastTick + 1) { state.lease = null; state.contour = null; state.offer = null; }
  state.lastTick = tick;
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

export function stationaryCrowdObstacle(unit) {
  return unit.hp > 0 && !unit.movePlanningPending && unit.pathIndex >= unit.path.length
    && !(unit.attackTargetId >= 0) && !(unit.attackBuildingTargetId >= 0)
    && unit.gatherNodeId == null && !(unit.gatherForestCell >= 0)
    && !unit.gatherPhase && unit.buildingTargetId == null;
}

export function crowdPassagePoint(center, direction, unit, neighbors, pointAllowed, diagnostics = null,
  radius = ordinaryCrowdBodyRadius(unit)) {
  const observePoint = p => { if (diagnostics) diagnostics.passageProposals++; return pointAllowed(p); };
  const inset = .5 - radius;
  const horizontal = Math.abs(direction.x) >= Math.abs(direction.z);
  const forward = horizontal ? Math.sign(direction.x) : Math.sign(direction.z);
  const preferred = horizontal ? { x: center.x, z: center.z + forward * inset }
    : { x: center.x - forward * inset, z: center.z };
  const closest = { x: Math.max(center.x - .499, Math.min(center.x + .499, unit.x)),
    z: Math.max(center.z - .499, Math.min(center.z + .499, unit.z)) };
  const narrow = horizontal
    ? !observePoint({ x: center.x, z: center.z + .75 }) && !observePoint({ x: center.x, z: center.z - .75 })
    : !observePoint({ x: center.x + .75, z: center.z }) && !observePoint({ x: center.x - .75, z: center.z });
  if (narrow) { if (horizontal) closest.z = preferred.z; else closest.x = preferred.x; }
  const candidates = [closest, preferred, ...[inset, .499].flatMap(offset => [-1, 0, 1].flatMap(x => [-1, 0, 1]
    .map(z => ({ x: center.x + x * offset, z: center.z + z * offset }))))];
  let best = center, score = Infinity;
  for (const point of candidates) {
    if (!observePoint(point) || neighbors.some(other => {
      if (diagnostics) diagnostics.passageBodyVisits++;
      return !ordinaryCrowdBodyRadius(other) && Math.hypot(point.x - other.x, point.z - other.z)
        < radius + LAND_CLEARANCE_PROFILE.radiusByKind[other.kind] - EPSILON;
    })) continue;
    const distance = (point.x - closest.x) ** 2 + (point.z - closest.z) ** 2
      + .01 * ((point.x - preferred.x) ** 2 + (point.z - preferred.z) ** 2);
    if (distance < score) { best = point; score = distance; }
  }
  return best;
}

// An inherited overlapping pose may escape monotonically, within the same short
// bound as static recovery. It cannot deepen that contact or enter a new body.
export function canTraverseCrowdBodySegment(from, to, radius, neighbors, { allowEscape = false, onVisit = null } = {}) {
  if (!finitePoint(from) || !finitePoint(to) || !(radius > 0 && radius <= .5)
    || neighbors.length > CROWD_NEIGHBOR_LIMIT
    || Math.hypot(to.x - from.x, to.z - from.z) > .25 + EPSILON) return false;
  let escaping = false, improved = false;
  for (const other of neighbors) {
    onVisit?.();
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

// At most 128 admitted short proposals, including lease/contour proposals:
// 26 headings, four lane-boundary proposals, 32 tangents around eight closest
// bodies, ten recovery headings, fourteen lease offers and local contour exits. Each
// checks all 64 bodies and the host's terrain oracle. A clear terminal step
// keeps the exact point. Transient detour/progress state resets with identity,
// order, navigation or waypoint changes and never enters durable unit state.
// A crowd-only wait is not a static route failure and must not trigger repair.
export function selectCrowdStep({ unit, target, stepDistance, neighbors, canTraverse, cellCenter,
  pointAllowed = canTraverse, progressTarget = target, targetOf = other => other.target, approachBody = null,
  directionOf = other => { const goal = targetOf(other); return finitePoint(goal)
    ? { x: goal.x - other.x, z: goal.z - other.z } : null; },
  escapeAllowed = canTraverse, detourAllowed = () => true,
  travelDirection = null, tick = 0, navigationRevision = 0, epoch = 0, overflow = false, diagnostics = null,
  radius = ordinaryCrowdBodyRadius(unit) }) {
  if (!(radius > 0 && radius <= .5) || !finitePoint(target) || !(stepDistance > 0 && stepDistance <= .25)) {
    steeringStates.delete(unit); return null;
  }
  const state = steeringState(unit, tick, navigationRevision, epoch);
  const stats = { proposals: 0, pointProposals: 0, escapeProposals: 0, bodyVisits: 0, arbitrationVisits: 0, leaseAge: 0, contourAge: 0, waitAge: 0, detourTerrainProbes: 0, ...diagnostics };
  if (overflow || neighbors.length > CROWD_NEIGHBOR_LIMIT) {
    state.lease = null; state.contour = null; state.offer = null;
    return { target, waitingForCrowd: true, stepDistance: 0, crowdControl: stats };
  }
  const sweep = (from, to, bodies) => canTraverseCrowdBodySegment(from, to, radius, bodies,
    { allowEscape: true, onVisit: () => stats.bodyVisits++ });
  const remaining = Math.hypot(progressTarget.x - unit.x, progressTarget.z - unit.z);
  state.progressTarget = { x: progressTarget.x, z: progressTarget.z };
  if (remaining < state.bestDistance - .02) { state.bestDistance = remaining; state.lastProgressTick = tick; }
  const noProgressTicks = tick - state.lastProgressTick;
  stats.waitAge = noProgressTicks;
  // A contour or retreat can enter the projected waypoint's cell before it
  // finishes its own manoeuvre. That pose does not consume the waypoint.
  const aim = (state.lease || state.contour) && Math.hypot(target.x - unit.x, target.z - unit.z) < EPSILON
    && remaining > EPSILON ? progressTarget : target;
  const dx = aim.x - unit.x, dz = aim.z - unit.z, distance = Math.hypot(dx, dz);
  if (neighbors.some(other => { stats.bodyVisits++; return other !== approachBody && !ordinaryCrowdBodyRadius(other)
    && Math.hypot(target.x - other.x, target.z - other.z)
      < radius + LAND_CLEARANCE_PROFILE.radiusByKind[other.kind] - EPSILON; }))
    return { target, waitingForCrowd: true, stepDistance: 0, noProgressTicks, crowdControl: stats };
  if (!distance) { state.lease = null; state.contour = null; return { target, reachedWaypoint: true, stepDistance: 0, noProgressTicks, crowdControl: stats }; }
  const clear = to => {
    if (stats.proposals >= CROWD_PROPOSAL_LIMIT) return false;
    stats.proposals++; return canTraverse(to) && sweep(unit, to, neighbors);
  };
  const pointClear = to => {
    if (stats.pointProposals >= CROWD_POINT_PROPOSAL_LIMIT) return false;
    stats.pointProposals++; return pointAllowed(to) && sweep(to, to, neighbors);
  };
  const detourClear = to => { stats.detourTerrainProbes++; return detourAllowed(to); };
  if (!state.lease && !state.contour && distance <= stepDistance && clear(target)) return { target, reachedWaypoint: true, stepDistance: distance, noProgressTicks, crowdControl: stats };
  const headingX = dx / distance, headingZ = dz / distance;
  const directionLength = finitePoint(travelDirection) && Math.hypot(travelDirection.x, travelDirection.z);
  const routeX = directionLength ? travelDirection.x / directionLength : headingX;
  const routeZ = directionLength ? travelDirection.z / directionLength : headingZ;
  const opposed = neighbors.some(other => {
    stats.arbitrationVisits++;
    const goal = targetOf(other);
    if (!finitePoint(goal) || Math.hypot(other.x - unit.x, other.z - unit.z) > 2) return false;
    return (goal.x - other.x) * routeX + (goal.z - other.z) * routeZ < 0;
  });
  const laneAxis = Math.abs(routeX) >= Math.abs(routeZ) ? 'z' : 'x';
  const laneSign = laneAxis === 'z' ? Math.sign(routeX) : -Math.sign(routeZ);
  const lane = finitePoint(cellCenter) ? cellCenter[laneAxis] + laneSign * (.5 - radius) : null;
  // A closest intermediate point can follow the actor along the route axis.
  // Then projected-distance progress loses all credit for advancing that axis,
  // while the opposing lane can cancel lateral ingress. Rank ordinary proposals
  // against the fixed waypoint only in this perpendicular projection context.
  const projectedRouteFeedback = opposed && lane !== null && directionLength
    && unit.pathIndex < unit.path.length - 1 && finitePoint(progressTarget)
    && Math.abs(dx * routeX + dz * routeZ) < EPSILON
    && (progressTarget.x - unit.x) * routeX + (progressTarget.z - unit.z) * routeZ > EPSILON;
  let separationX = 0, separationZ = 0;
  for (const other of neighbors) {
    stats.bodyVisits++;
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
    && !sweep(unit, direct, [other]));
  if (blocking.length && !state.detour) {
    const other = blocking.toSorted((a, b) => Math.hypot(a.x - unit.x, a.z - unit.z)
      - Math.hypot(b.x - unit.x, b.z - unit.z) || a.id - b.id)[0];
    const clearance = radius + LAND_CLEARANCE_PROFILE.radiusByKind[other.kind] + .12;
    const sides = [90, -90, 135, -135, 45, -45].map(angle => {
      const radians = angle * Math.PI / 180;
      return { x: other.x + (headingX * Math.cos(radians) - headingZ * Math.sin(radians)) * clearance,
        z: other.z + (headingZ * Math.cos(radians) + headingX * Math.sin(radians)) * clearance };
    });
    const legal = sides.filter(pointClear).filter(detourClear);
    if (legal.length) state.detour = { ...legal[0], alternatives: legal.slice(1), distance,
      bestDistance: Infinity, lastProgressTick: tick };
  }
  if (state.detour) {
    const detourDistance = Math.hypot(state.detour.x - unit.x, state.detour.z - unit.z);
    if (detourDistance < state.detour.bestDistance - .02) {
      state.detour.bestDistance = detourDistance; state.detour.lastProgressTick = tick;
    }
    if (!pointAllowed(state.detour) || !detourClear(state.detour) || tick - state.detour.lastProgressTick >= 30) {
      const alternative = state.detour.alternatives.shift();
      if (alternative && pointAllowed(alternative) && detourClear(alternative)) Object.assign(state.detour, alternative,
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
  if (!state.lease && !state.contour && (!opposed || lane === null) && Math.hypot(separationX, separationZ) < EPSILON && clear(direct))
    return { x: headingX, z: headingZ, target, stepDistance: directLength, noProgressTicks, crowdControl: stats };
  let best = null, bestScore = -Infinity;
  const consider = (to, ordinaryProposal = true) => {
    const length = Math.hypot(to.x - unit.x, to.z - unit.z);
    if (length <= EPSILON || length > stepDistance + EPSILON || !clear(to)) return;
    const progress = distance - Math.hypot(target.x - to.x, target.z - to.z);
    const rankRawRoute = ordinaryProposal && projectedRouteFeedback && !state.detour && !state.lease && !state.contour;
    const rankingProgress = rankRawRoute
      ? remaining - Math.hypot(progressTarget.x - to.x, progressTarget.z - to.z) : progress;
    const cross = headingX * (to.z - unit.z) - headingZ * (to.x - unit.x);
    const laneProgress = opposed && lane !== null
      ? Math.abs(unit[laneAxis] - lane) - Math.abs(to[laneAxis] - lane) : 0;
    const directed = (to.x - unit.x) * preferredX + (to.z - unit.z) * preferredZ;
    const score = state.detour ? .1 * progress + .9 * directed : rankingProgress + laneProgress + (cross > 0 ? 1e-7 : 0);
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
  const readState = other => { const s = steeringStates.get(other); return ordinaryCrowdBodyRadius(other) > 0 && s && s.epoch === epoch
      && s.generation === other.generation && s.revision === other.orderRevision
      && s.navigationRevision === navigationRevision && s.path === other.path && s.pathIndex === other.pathIndex
      && s.lastTick >= tick - 1 && s.lastTick <= tick ? s : null; };
  // A passage lease arbitrates one observed body dependency, with a physically
  // clear retreat corridor; it never claims or rewrites a multi-actor route.
  const activePeers = neighbors.reduce((count, other) => {
    stats.arbitrationVisits++; return count + Number(ordinaryCrowdBodyRadius(other) > 0);
  }, 0);
  if (activePeers > 1) state.lease = null;
  const lease = activePeers <= 1 && !state.contour ? crowdWaitLease({ unit, state, tick, neighbors, radius, radiusOf: ordinaryCrowdBodyRadius,
    parked: stationaryCrowdObstacle, readState,
    blockedBy: other => !sweep(unit, direct, [other]),
    blockedByFrom: (from, direction, other) => !sweep(from,
      { x: from.x + direction.x * direction.length, z: from.z + direction.z * direction.length }, [other]),
    peerNeedsRoom: other => {
      const peerTarget = readState(other)?.progressTarget;
      return finitePoint(peerTarget) && neighbors.some(body => {
        if (!stationaryCrowdObstacle(body)) return false;
        stats.bodyVisits++;
        return Math.sqrt(pointSegmentDistanceSquared(body, other, peerTarget))
          < ordinaryCrowdBodyRadius(other) + LAND_CLEARANCE_PROFILE.radiusByKind[body.kind] - EPSILON;
      });
    },
    failedBlocker: to => neighbors.find(other => !sweep(unit, to, [other])) ?? null,
    escapeAllowed: to => {
      stats.escapeProposals = (stats.escapeProposals ?? 0) + 1;
      return escapeAllowed(to) && neighbors.every(body => {
        stats.bodyVisits++;
        return Math.sqrt(pointSegmentDistanceSquared(body, unit, to))
          >= radius + LAND_CLEARANCE_PROFILE.radiusByKind[body.kind] - EPSILON;
      });
    },
    admit: clear, heading: { x: headingX, z: headingZ }, stepDistance, target, stats }) : null;
  if (lease) return { ...lease, noProgressTicks, crowdControl: stats };
  const yieldedTo = neighbors.some(other => { stats.arbitrationVisits++;
    const observed = readState(other);
    return observed?.lease?.peer === unit && tick < observed.lease.until; });
  const contour = crowdParkedContour({ unit, state, tick, neighbors, radius, radiusOf: ordinaryCrowdBodyRadius,
    parked: stationaryCrowdObstacle, yieldedTo, target, progressTarget, heading: { x: headingX, z: headingZ }, stepDistance,
    admit: clear, pointAllowed: pointClear, stats });
  if (contour) return { ...contour, noProgressTicks, crowdControl: stats };
  // Retain an admitted oblique forward step only when every nearby body is
  // following this segment from behind. A parked or opposing body keeps the
  // existing stricter exemption and its own passage/contour arbitration.
  const followingOnly = noProgressTicks >= 30 && best && best.x * routeX + best.z * routeZ > 0
    && neighbors.every(other => {
      stats.arbitrationVisits++;
      const direction = directionOf(other);
      return ordinaryCrowdBodyRadius(other) > 0
        && (other.x - unit.x) * routeX + (other.z - unit.z) * routeZ <= 0
        && finitePoint(direction) && direction.x * routeX + direction.z * routeZ
          > .9 * Math.hypot(direction.x, direction.z);
    });
  // Crowd deflection can leave the actor beside the accepted segment. A peer's
  // far goal may then look opposed to that segment while both current waypoints
  // lead the same way. Keep already admitted progress in that shared direction;
  // a different opposing claimant still retains its ordinary priority.
  const advancingWaypoint = !state.detour && best && directionLength
    && unit.pathIndex < unit.path.length - 1 && finitePoint(progressTarget)
    && (progressTarget.x - unit.x) * routeX + (progressTarget.z - unit.z) * routeZ < -EPSILON
    && Math.abs(best.x * routeX + best.z * routeZ) < .1
    && Math.hypot(progressTarget.x - unit.x - best.x * best.stepDistance,
      progressTarget.z - unit.z - best.z * best.stepDistance) < remaining - EPSILON;
  const parallelWaypointStep = other => {
    if (!advancingWaypoint || !ordinaryCrowdBodyRadius(other)) return false;
    const direction = directionOf(other);
    return finitePoint(direction) && direction.x * best.x + direction.z * best.z
      > .9 * Math.hypot(direction.x, direction.z);
  };
  const yieldingToPeer = noProgressTicks >= 30 && neighbors.some(other => other.id < unit.id && finitePoint(targetOf(other))
    && (targetOf(other).x - other.x) * routeX + (targetOf(other).z - other.z) * routeZ < 0
    && !parallelWaypointStep(other)
    // A same-segment follower behind us cannot claim a clear forward step
    // merely because its distant final goal lies across the current segment.
    && !((other.x - unit.x) * routeX + (other.z - unit.z) * routeZ <= 0
      && best && (best.x * routeX + best.z * routeZ > .9 || followingOnly)
      && finitePoint(directionOf(other))
      && directionOf(other).x * routeX + directionOf(other).z * routeZ
        > .9 * Math.hypot(directionOf(other).x, directionOf(other).z))
    && Math.hypot(other.x - unit.x, other.z - unit.z)
      < radius + LAND_CLEARANCE_PROFILE.radiusByKind[other.kind] + stepDistance + .1);
  if (!best || yieldingToPeer || (state.detour && noProgressTicks >= 30)) {
    if (yieldingToPeer) { best = null; bestScore = -Infinity; }
    for (const scale of [1, .5]) for (const angle of [105, -105, 135, -135, 180]) {
      const radians = angle * Math.PI / 180, length = stepDistance * scale;
      consider({ x: unit.x + (headingX * Math.cos(radians) - headingZ * Math.sin(radians)) * length,
        z: unit.z + (headingZ * Math.cos(radians) + headingX * Math.sin(radians)) * length }, false);
    }
    if (best) best.yieldingForCrowd = true;
  }
  // Tight moving queues can reject every full/half recovery step while a
  // shorter prefix of the same heading is clear. Only displaced passage targets
  // may use it, and the admitted step must improve the fixed waypoint distance.
  // Preserve recovery order/priority and debit every probe from the same cap.
  if (!best && yieldingToPeer && finitePoint(progressTarget)
    && Math.hypot(target.x - progressTarget.x, target.z - progressTarget.z) > EPSILON
    && ordinaryCrowdBodyRadius(unit)
    && unit.pathIndex < unit.path.length - 1 && !state.detour && !state.lease && !state.contour) {
    const probeStart = stats.proposals, smallest = Math.min(stepDistance, distance) / 64;
    for (const angle of [105, -105, 135, -135, 180]) {
      if (smallest <= EPSILON || stats.proposals - probeStart >= 12 || stats.proposals >= CROWD_PROPOSAL_LIMIT) break;
      const radians = angle * Math.PI / 180;
      const x = headingX * Math.cos(radians) - headingZ * Math.sin(radians);
      const z = headingZ * Math.cos(radians) + headingX * Math.sin(radians);
      const point = length => ({ x: unit.x + x * length, z: unit.z + z * length });
      if (!clear(point(smallest))) continue;
      let lower = smallest, upper = Math.min(stepDistance * .5, distance);
      for (let probe = 0; probe < 5 && stats.proposals - probeStart < 11
        && stats.proposals < CROWD_PROPOSAL_LIMIT - 1; probe++) {
        const middle = (lower + upper) / 2;
        if (clear(point(middle))) lower = middle;
        else upper = middle;
      }
      const to = point(lower);
      if (stats.proposals - probeStart < 12
        && Math.hypot(progressTarget.x - to.x, progressTarget.z - to.z) < remaining - EPSILON)
        consider(to, false);
      if (best) { best.yieldingForCrowd = true; break; }
    }
  }
  return best ? { ...best, noProgressTicks, crowdControl: stats }
    : { target, waitingForCrowd: true, stepDistance: 0, noProgressTicks, crowdControl: stats };
}
