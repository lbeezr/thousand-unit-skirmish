// Ordinary military Move only. These saved scalar witnesses survive route-array
// and internal repair revisions; they grant no movement rights or body exceptions.
import { LAND_CLEARANCE_PROFILE, pointSegmentDistanceSquared } from './unit-movement.mjs';
import { CROWD_LEASE_TICKS } from './crowd-wait-lease.mjs';
export const ORDINARY_RECOVERY_EPISODE_TICKS = 3 * CROWD_LEASE_TICKS;
export const ORDINARY_RECOVERY_MAX_EPISODES = 3;
const EPSILON = 1e-9;
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export function beginOrdinaryMoveRecovery(unit, tick) {
  delete unit.ordinaryMoveRecovery;
  if (unit.kind === 'worker' || unit.movementDomain === 'water' || unit.attackMove
    || unit.persistentOrder || unit.stanceCombat || unit.stanceReturning
    || unit.gatherNodeId != null || unit.gatherForestCell >= 0 || unit.gatherPhase
    || unit.buildingTargetId !== null) return;
  unit.ordinaryMoveRecovery = { version: 1, generation: unit.generation,
    intentRevision: unit.orderRevision, goalCell: unit.moveGoalCell,
    progressTick: tick, portals: 0, portal: null, completedPortal: null, episodeTick: null,
    recoverySteps: 0, blockedTick: null, episodes: 0, dependency: null, failedScenes: [] };
}
function setPortal(state, unit, point, navigationRevision, direction) {
  const length = distance(unit, point), axis = direction ?? { x: point.x - unit.x, z: point.z - unit.z };
  const axisLength = Math.hypot(axis.x, axis.z);
  state.portal = { x: point.x, z: point.z,
    dx: axisLength ? axis.x / axisLength : 0,
    dz: axisLength ? axis.z / axisLength : 0,
    best: length, navigationRevision, fromX: unit.x, fromZ: unit.z };
}
const scene = bodies => bodies === null ? 'query-overflow' : JSON.stringify(bodies.map(b => [b.id, b.generation,
  Math.round(b.x * 10), Math.round(b.z * 10)]));
function dependency(unit, point, neighbors, radius, queryOverflow) {
  const length = distance(unit, point) || 1, step = Math.min(length, .75);
  const from = { x: unit.x, z: unit.z }, to = {
    x: unit.x + (point.x - unit.x) / length * step,
    z: unit.z + (point.z - unit.z) / length * step };
  const bodies = queryOverflow ? null : neighbors.filter(b => pointSegmentDistanceSquared(b, from, to)
    < (radius + LAND_CLEARANCE_PROFILE.radiusByKind[b.kind]) ** 2)
    .slice(0, 4).map(b => ({ id: b.id, generation: b.generation, x: b.x, z: b.z, kind: b.kind }));
  return { from, to, bodies };
}
function dependencyChanged(state, bodyById, radius, queryOverflow) {
  const d = state.dependency;
  if (d?.bodies === null) return !queryOverflow;
  if (queryOverflow) return false;
  if (!d?.bodies.length) return false;
  return d.bodies.some(w => {
    const body = bodyById(w.id);
    if (!body || body.hp <= 0 || body.generation !== w.generation) return true;
    return distance(body, w) >= .15 && pointSegmentDistanceSquared(body, d.from, d.to)
      >= (radius + LAND_CLEARANCE_PROFILE.radiusByKind[body.kind]) ** 2;
  });
}
// Selection is only a proposal. Progress is recorded separately after the actual
// guarded position write. A new portal caused by static invalidation is a phase
// change and preserves both the task clock and an exhausted episode.
export function ordinaryMoveRecoveryDecision(unit, move, { tick, navigationRevision,
  point, radius, direction, portalInvalid = false, neighbors = [], bodyById = () => null, queryOverflow = false }) {
  const state = unit.ordinaryMoveRecovery;
  if (!state || state.generation !== unit.generation || !move) return { move, changed: false };
  const { admittedForward, ...preferred } = move;
  move = preferred;
  let changed = false;
  if (!state.portal || (portalInvalid && state.portal.navigationRevision !== navigationRevision)) {
    setPortal(state, unit, point, navigationRevision, direction);
    changed = true;
  } else if (state.portal.navigationRevision !== navigationRevision) {
    // The host checked the fixed approach only once for this new revision.
    state.portal.navigationRevision = navigationRevision; changed = true;
  }
  const portal = state.portal;
  const to = move.reachedWaypoint ? move.target : move.waitingForCrowd ? unit
    : { x: unit.x + move.x * move.stepDistance, z: unit.z + move.z * move.stepDistance };
  const gain = distance(unit, portal) - distance(to, portal);
  const rawGain = distance(unit, point) - distance(to, point);
  const phase = Boolean(move.recoveryPhase || move.yieldingForCrowd || move.noProgressTicks >= 30);
  if (phase && state.episodeTick === null) {
    state.episodeTick = tick; state.episodes++;
    state.dependency = dependency(unit, point, neighbors, radius, queryOverflow); changed = true;
  }
  if (state.episodeTick !== null && tick - state.episodeTick >= ORDINARY_RECOVERY_EPISODE_TICKS
    && !move.rejectedStaticProposal) {
    const exhausted = scene(state.dependency.bodies);
    if (!state.failedScenes.includes(exhausted)) state.failedScenes.push(exhausted);
    const current = dependency(unit, point, neighbors, radius, queryOverflow);
    if (state.episodes < ORDINARY_RECOVERY_MAX_EPISODES && dependencyChanged(state, bodyById, radius, queryOverflow)
      && !state.failedScenes.includes(scene(current.bodies))) {
      state.episodeTick = tick; state.episodes++; state.dependency = current;
      state.blockedTick = null; changed = true;
    } else if (gain <= EPSILON && rawGain <= EPSILON) {
      // This alternative survived selector arbitration and was already checked
      // in its existing proposal budget. It grants no new recovery episode or
      // task credit; the unchanged host still guards its actual position write.
      if (admittedForward && Number.isFinite(admittedForward.x) && Number.isFinite(admittedForward.z)
        && admittedForward.stepDistance > 0 && admittedForward.stepDistance <= .25
        && Math.abs(Math.hypot(admittedForward.x, admittedForward.z) - 1) < EPSILON
        && distance(unit, point) - distance({ x: unit.x + admittedForward.x * admittedForward.stepDistance,
          z: unit.z + admittedForward.z * admittedForward.stepDistance }, point) > EPSILON) {
        if (phase) state.recoverySteps++;
        return { changed, move: { ...admittedForward, noProgressTicks: move.noProgressTicks,
          crowdControl: move.crowdControl, ordinaryRawWaypoint: point, ordinaryMoveOutcome: 'forward-resumption' } };
      }
      if (state.blockedTick === null) { state.blockedTick = tick; changed = true; }
      return { changed, move: { ...move, reachedWaypoint: false, waitingForCrowd: true,
        stepDistance: 0, ordinaryMoveOutcome: 'recovery-unresolved' } };
    }
  }
  if (phase) state.recoverySteps++;
  return { move: { ...move, ordinaryRawWaypoint: point }, changed };
}
export function finalizeOrdinaryMoveProgress(unit, from, tick, arrived = false, admittedWaypoint = null) {
  const state = unit.ordinaryMoveRecovery, portal = state?.portal;
  if (!portal) return;
  const inside = p => Math.abs(p.x - portal.x) <= .5 + EPSILON && Math.abs(p.z - portal.z) <= .5 + EPSILON;
  const approachInside = inside({ x: portal.fromX, z: portal.fromZ });
  const matchingWaypoint = admittedWaypoint?.x === portal.x && admittedWaypoint?.z === portal.z;
  if (distance(from, unit) <= EPSILON) {
    // An already occupied start/rejoin prefix is phase closure, not progress.
    if (matchingWaypoint && approachInside && inside(unit)) state.portal = null;
    return;
  }
  // Resumption is an admitted physical write, separately from task progress.
  state.blockedTick = null;
  const remaining = distance(unit, portal);
  if (remaining < portal.best - .05) {
    portal.best = remaining;
  }
  const before = (from.x - portal.x) * portal.dx + (from.z - portal.z) * portal.dz;
  const after = (unit.x - portal.x) * portal.dx + (unit.z - portal.z) * portal.dz;
  const lateral = Math.abs((unit.x - portal.x) * portal.dz - (unit.z - portal.z) * portal.dx);
  // This is a progress aperture in the raw waypoint's tile, not an occupancy
  // inset. The unchanged host guards have already proved the body's clearance.
  const aperture = .5 / Math.max(Math.abs(portal.dx), Math.abs(portal.dz), EPSILON);
  const repeated = state.completedPortal?.x === portal.x && state.completedPortal?.z === portal.z;
  // Projected lanes can finish a raw waypoint just before or beside its plane.
  // This witness requires the matching waypoint's actual guarded write, never
  // an index/publication change or a zero-motion proposal.
  const waypointArrival = matchingWaypoint && inside(unit);
  const tileEntry = !inside(from) && inside(unit) && after > before + EPSILON;
  if ((!repeated && !approachInside && ((before < -.02 && after >= -.02 && after > before + EPSILON
    && lateral <= aperture + EPSILON) || remaining < .02 || waypointArrival || tileEntry)) || arrived) {
    state.portals++; state.progressTick = tick; state.completedPortal = { x: portal.x, z: portal.z }; state.portal = null;
    state.episodeTick = null; state.recoverySteps = 0; state.blockedTick = null;
    state.episodes = 0; state.dependency = null; state.failedScenes = [];
  } else if (admittedWaypoint && Math.abs(unit.x - admittedWaypoint.x) <= .5 + EPSILON
    && Math.abs(unit.z - admittedWaypoint.z) <= .5 + EPSILON
    && (!matchingWaypoint || approachInside || repeated)) {
    // A guarded completion on the accepted replacement route retires a missed
    // old aperture. This changes the next phase witness, never the task clock,
    // exhausted scenes or remaining budget. Renumbering/publication cannot do it.
    state.portal = null;
  }
}
export function ordinaryMoveBlockedStatus(unit) {
  const state = unit.ordinaryMoveRecovery;
  return state?.blockedTick !== null && state?.blockedTick !== undefined
    && unit.hp > 0 && !unit.holdingPosition && !unit.movePlanningPending
    && unit.kind !== 'worker' && !unit.attackMove && !unit.persistentOrder
    && unit.movementDomain !== 'water' && !unit.stanceCombat && !unit.stanceReturning
    && unit.gatherNodeId == null && !(unit.gatherForestCell >= 0) && !unit.gatherPhase
    && unit.buildingTargetId == null
    && unit.attackTargetId < 0 && unit.attackBuildingTargetId < 0
    && unit.pathIndex < unit.path.length
    ? [unit.id, unit.generation, 'temporarily-blocked', 'recovery-unresolved', state.blockedTick] : null;
}
export function validOrdinaryMoveRecovery(unit, tick, width, height) {
  const state = unit.ordinaryMoveRecovery;
  if (state === undefined) return true;
  const keys = ['version', 'generation', 'intentRevision', 'goalCell', 'progressTick',
    'portals', 'portal', 'completedPortal', 'episodeTick', 'recoverySteps', 'blockedTick',
    'episodes', 'dependency', 'failedScenes'];
  const integer = (n, max = tick) => Number.isSafeInteger(n) && n >= 0 && n <= max;
  if (!state || typeof state !== 'object' || Array.isArray(state)
    || Object.keys(state).length !== keys.length || !keys.every(k => Object.hasOwn(state, k))
    || state.version !== 1 || unit.kind === 'worker' || unit.movementDomain === 'water'
    || state.generation !== unit.generation || !integer(state.intentRevision, unit.orderRevision)
    || !integer(state.goalCell, width * height - 1) || !integer(state.progressTick)
    || !integer(state.portals, Number.MAX_SAFE_INTEGER) || !integer(state.recoverySteps, Number.MAX_SAFE_INTEGER)
    || !integer(state.episodes, ORDINARY_RECOVERY_MAX_EPISODES)
    || !Array.isArray(state.failedScenes) || state.failedScenes.length > ORDINARY_RECOVERY_MAX_EPISODES
    || !state.failedScenes.every(s => typeof s === 'string' && s.length <= 512)
    || new Set(state.failedScenes).size !== state.failedScenes.length
    || ![state.episodeTick, state.blockedTick].every(n => n === null || integer(n))
    || ((state.episodeTick === null) !== (state.episodes === 0))
    || ((state.dependency === null) !== (state.episodeTick === null))
    || (state.blockedTick !== null && (state.episodeTick === null
      || state.blockedTick - state.episodeTick < ORDINARY_RECOVERY_EPISODE_TICKS))) return false;
  const c = state.completedPortal;
  if (c !== null && (!c || typeof c !== 'object' || Array.isArray(c) || Object.keys(c).length !== 2
    || !['x', 'z'].every(k => Object.hasOwn(c, k) && Number.isFinite(c[k]))
    || Math.abs(c.x) > width / 2 || Math.abs(c.z) > height / 2)) return false;
  const d = state.dependency;
  const boundedPoint = p => p && typeof p === 'object' && !Array.isArray(p)
    && Object.keys(p).length === 2 && ['x', 'z'].every(k => Object.hasOwn(p, k) && Number.isFinite(p[k]))
    && Math.abs(p.x) <= width / 2 && Math.abs(p.z) <= height / 2;
  if (d !== null && (!d || typeof d !== 'object' || Array.isArray(d) || Object.keys(d).length !== 3
    || !['from', 'to', 'bodies'].every(k => Object.hasOwn(d, k)) || !boundedPoint(d.from) || !boundedPoint(d.to)
    || (d.bodies !== null && (!Array.isArray(d.bodies) || d.bodies.length > 4 || !d.bodies.every(b => b && typeof b === 'object'
      && !Array.isArray(b) && Object.keys(b).length === 5 && ['id', 'generation', 'x', 'z', 'kind'].every(k => Object.hasOwn(b, k))
      && integer(b.id, Number.MAX_SAFE_INTEGER) && integer(b.generation, Number.MAX_SAFE_INTEGER)
      && Number.isFinite(b.x) && Number.isFinite(b.z) && Math.abs(b.x) <= width / 2 && Math.abs(b.z) <= height / 2
      && LAND_CLEARANCE_PROFILE.radiusByKind[b.kind] > 0)
    || new Set(d.bodies.map(b => b.id)).size !== d.bodies.length)))) return false;
  const p = state.portal;
  return p === null || (typeof p === 'object' && !Array.isArray(p)
    && Object.keys(p).length === 8 && ['x', 'z', 'dx', 'dz', 'best', 'navigationRevision', 'fromX', 'fromZ'].every(k => Object.hasOwn(p, k))
    && [p.x, p.z, p.dx, p.dz, p.best, p.fromX, p.fromZ].every(Number.isFinite)
    && Math.abs(p.x) <= width / 2 && Math.abs(p.z) <= height / 2 && p.best >= 0
    && Math.abs(p.fromX) <= width / 2 && Math.abs(p.fromZ) <= height / 2
    && (Math.hypot(p.dx, p.dz) < EPSILON || Math.abs(Math.hypot(p.dx, p.dz) - 1) < EPSILON)
    && integer(p.navigationRevision, Number.MAX_SAFE_INTEGER));
}
export function cloneOrdinaryMoveRecovery(state) {
  return state && { ...state, portal: state.portal && { ...state.portal },
    completedPortal: state.completedPortal && { ...state.completedPortal },
    failedScenes: [...state.failedScenes], dependency: state.dependency && {
      from: { ...state.dependency.from }, to: { ...state.dependency.to },
      bodies: state.dependency.bodies?.map(b => ({ ...b })) ?? null } };
}
