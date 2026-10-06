// Source-only priority hypothesis. No production module imports this contract.
import { classifyQueueGeometry } from '../src/crowd-moving-entitlement.mjs';
import { ordinaryCrowdBodyRadius } from '../src/unit-crowd-steering.mjs';

const EPSILON = 1e-9;
const finite = point => point && Number.isFinite(point.x) && Number.isFinite(point.z);

// Call only after complete original claimant enumeration and actual admission.
// Desired waypoint alignment is not a promise about the peer's executed step.
export function soleFollowingContinuation({ unit, claims, best, progressTarget, travelDirection,
  directionOf, stateOf, tick, navigationRevision, epoch, physicalAdmitted, claimsComplete, overflow = false }) {
  if (!physicalAdmitted || !claimsComplete || overflow || !Array.isArray(claims) || claims.length !== 1 || !best
    || ![tick, navigationRevision, epoch].every(value => Number.isInteger(value) && value >= 0)
    || ![unit, best, progressTarget, travelDirection].every(finite)
    || !(best.stepDistance > 0 && best.stepDistance <= .25)
    || Math.abs(Math.hypot(best.x, best.z) - 1) > EPSILON) return false;
  const peer = claims[0]; if (!finite(peer)) return false;
  const radius = ordinaryCrowdBodyRadius(unit), peerRadius = ordinaryCrowdBodyRadius(peer);
  if (!radius || !peerRadius || peer.id >= unit.id || unit.pathIndex >= unit.path.length - 1) return false;
  for (const actor of [unit, peer]) {
    const state = stateOf(actor);
    if (!state || state.generation !== actor.generation || state.revision !== actor.orderRevision
      || state.path !== actor.path || state.pathIndex !== actor.pathIndex
      || state.navigationRevision !== navigationRevision || state.epoch !== epoch
      || state.lastTick < tick - 1 || state.lastTick > tick
      || state.detour || state.lease || state.contour) return false;
  }
  const own = unit.path.slice(unit.pathIndex, unit.pathIndex + 3);
  if (own.length !== 3 || new Set(own).size !== 3 || !own.every(cell => Number.isInteger(cell) && cell >= 0)
    || ![peer.pathIndex, peer.pathIndex - 1].some(index => index >= 0
      && own.every((cell, offset) => peer.path[index + offset] === cell))) return false;
  const to = { x: unit.x + best.x * best.stepDistance, z: unit.z + best.z * best.stepDistance };
  if (classifyQueueGeometry({ from: unit, to, peer, routeDirection: travelDirection,
    progressTarget, radius, peerRadius }) !== 'queue-following'
    || best.x * travelDirection.x + best.z * travelDirection.z <= EPSILON
    || Math.hypot(progressTarget.x - to.x, progressTarget.z - to.z)
      >= Math.hypot(progressTarget.x - unit.x, progressTarget.z - unit.z) - EPSILON) return false;
  const direction = directionOf(peer);
  return Boolean(finite(direction) && direction.x * best.x + direction.z * best.z
    > .9 * Math.hypot(direction.x, direction.z));
}
