// One bounded lease lives in the caller's transient actor record. Neighbours
// only supply observations; every actor executes and admits its own step.
export const CROWD_LEASE_TICKS = 60;
const ESCAPE_ANGLES = [90, -90, 105, -105, 135, -135, 180];
const EPSILON = 1e-9;

export function crowdWaitLease({ unit, state, tick, neighbors, radius, radiusOf, parked,
  readState, admit, escapeAllowed = () => true, blockedBy, blockedByFrom = () => true,
  peerNeedsRoom = () => false, failedBlocker = () => null,
  heading, stepDistance, target, stats }) {
  if (state.lease?.kind === 'ingress-obligation') return null;
  const active = other => radiusOf(other) > 0;
  const failure = (lease, blocker = null) => ({ peer: lease.peer, generation: lease.generation,
    revision: lease.revision, path: lease.path, pathIndex: lease.pathIndex,
    ownBest: state.bestDistance, peerBest: readState(lease.peer)?.bestDistance ?? Infinity,
    blocker, blockerX: blocker?.x, blockerZ: blocker?.z, blockerGeneration: blocker?.generation });
  let lease = state.lease;
  if (lease && (tick >= lease.until || !neighbors.includes(lease.peer) || !active(lease.peer)
    || lease.generation !== lease.peer.generation || lease.revision !== lease.peer.orderRevision
    || lease.path !== lease.peer.path || !readState(lease.peer)
    || !neighbors.includes(lease.obstacle) || !parked(lease.obstacle)
    || lease.obstacle.x !== lease.obstacleX || lease.obstacle.z !== lease.obstacleZ
    || (!blockedByFrom(lease.start, lease.originalDirection, lease.peer) && !peerNeedsRoom(lease.peer)))) {
    if (tick >= lease.until) state.failedLease = failure(lease);
    state.lease = lease = null;
  }
  if (lease) {
    stats.leaseAge = tick - lease.since;
    const advanced = lease.peer.pathIndex !== lease.pathIndex
      || readState(lease.peer).bestDistance < lease.peerBest - .15;
    if (advanced) state.lease = lease = null;
  }
  if (lease) {
    const gap = Math.hypot(unit.x - lease.peer.x, unit.z - lease.peer.z);
    if (gap >= radius + radiusOf(lease.peer) + .5 || lease.holding) {
      lease.holding = true;
      return { target, waitingForCrowd: true, stepDistance: 0, yieldingForCrowd: true };
    }
    const to = { x: unit.x + lease.direction.x * stepDistance, z: unit.z + lease.direction.z * stepDistance };
    if (admit(to)) return { ...lease.direction, target, stepDistance, yieldingForCrowd: true };
    // A fresh obstacle terminates this motion; it cannot retain an unchecked
    // heading or publish an order/repair. Later calls may offer another lease.
    state.lease = null;
    state.failedLease = failure(lease, failedBlocker(to));
    return { target, waitingForCrowd: true, stepDistance: 0, yieldingForCrowd: true };
  }
  if (tick - state.lastProgressTick < 120 || tick < state.leaseCooldown) return null;
  // Established opposing-lane steering owns moving-only queues. A lease is
  // needed here only for a stalled body dependency beside immutable bodies.
  const obstacle = neighbors.find(other => { stats.arbitrationVisits++;
    return parked(other) && Math.hypot(unit.x - other.x, unit.z - other.z) < 1.2; });
  if (!obstacle) return null;
  let peer = null;
  for (const other of neighbors) {
    stats.arbitrationVisits++;
    if (!active(other) || Math.hypot(unit.x - other.x, unit.z - other.z) > radius + radiusOf(other) + .4) continue;
    const observed = readState(other);
    if (!observed || tick - observed.lastProgressTick < 90) continue;
    if (!blockedBy(other)) continue;
    const failed = state.failedLease;
    const changedBlocker = failed?.blocker && (!neighbors.includes(failed.blocker)
      || failed.blocker.generation !== failed.blockerGeneration
      || Math.hypot(failed.blocker.x - failed.blockerX, failed.blocker.z - failed.blockerZ) >= .15);
    if (failed?.peer === other && failed.generation === other.generation && failed.revision === other.orderRevision
      && failed.path === other.path && failed.pathIndex === other.pathIndex && !changedBlocker
      && state.bestDistance >= failed.ownBest - .15 && observed.bestDistance >= failed.peerBest - .15) continue;
    if (observed.lease && tick < observed.lease.until) return null;
    if (!peer || other.id < peer.id) peer = other;
  }
  if (!peer) return null;
  let offer = null, best = -Infinity;
  const before = Math.hypot(unit.x - peer.x, unit.z - peer.z);
  for (const scale of [1, .5]) for (const angle of ESCAPE_ANGLES) {
    const radians = angle * Math.PI / 180;
    const x = heading.x * Math.cos(radians) - heading.z * Math.sin(radians);
    const z = heading.z * Math.cos(radians) + heading.x * Math.sin(radians);
    const length = stepDistance * scale, to = { x: unit.x + x * length, z: unit.z + z * length };
    if (!admit(to)) continue;
    // A one-step opening cannot justify a passage lease. Observe the whole
    // short retreat corridor before granting it; each executed step is still
    // separately admitted against fresh serial positions.
    if (!escapeAllowed({ x: unit.x + x * .75, z: unit.z + z * .75 })) continue;
    const separation = Math.hypot(to.x - peer.x, to.z - peer.z) - before;
    if (separation > EPSILON && separation > best) { best = separation; offer = { x, z, length }; }
  }
  state.offerTick = tick;
  if (state.offer?.moving) state.offer.passage = offer;
  else state.offer = offer;
  if (!offer) return null;
  for (const other of neighbors) {
    stats.arbitrationVisits++;
    const observed = active(other) && readState(other);
    if (!(observed?.offer?.moving ? observed.offer.passage : observed?.offer) || observed.offerTick < tick - 1) continue;
    if (observed.lastGrantTick < state.lastGrantTick
      || (observed.lastGrantTick === state.lastGrantTick && other.id < unit.id)) return null;
  }
  state.lastGrantTick = tick; state.leaseCooldown = tick + CROWD_LEASE_TICKS + 30;
  state.lease = { peer, generation: peer.generation, revision: peer.orderRevision, path: peer.path,
    pathIndex: peer.pathIndex, peerBest: readState(peer).bestDistance,
    obstacle, obstacleX: obstacle.x, obstacleZ: obstacle.z,
    start: { x: unit.x, z: unit.z }, originalDirection: { ...heading, length: stepDistance },
    direction: { x: offer.x, z: offer.z }, holding: false, since: tick, until: tick + CROWD_LEASE_TICKS };
  return { x: offer.x, z: offer.z, target, stepDistance: offer.length, yieldingForCrowd: true };
}
