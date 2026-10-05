import { LAND_CLEARANCE_PROFILE, pointSegmentDistanceSquared } from './unit-movement.mjs';

// A bounded local steering contour, reconstructed from observed physical
// bodies. It publishes only the actor's next short step, never a route/order.
export function crowdParkedContour({ unit, state, tick, neighbors, radius, radiusOf, parked, yieldedTo,
  target, progressTarget = target, heading, stepDistance, admit, pointAllowed, stats }) {
  let contour = state.contour;
  if (contour && (tick >= contour.until || contour.bodies.some(({ body, x, z, generation, revision }) =>
    !neighbors.includes(body) || !parked(body) || body.x !== x || body.z !== z
    || body.generation !== generation || body.orderRevision !== revision))) state.contour = contour = null;
  const lineFree = () => neighbors.every(body => {
    stats.bodyVisits++;
    return Math.sqrt(pointSegmentDistanceSquared(body, unit, progressTarget))
      >= radius + LAND_CLEARANCE_PROFILE.radiusByKind[body.kind] - 1e-9;
  });
  if (contour && lineFree()) state.contour = contour = null;
  if (!contour && (yieldedTo || tick - state.lastProgressTick >= 90) && tick >= (state.contourCooldown ?? -Infinity)) {
    const parkedBodies = neighbors.filter(parked).toSorted((a, b) =>
      Math.hypot(a.x - unit.x, a.z - unit.z) - Math.hypot(b.x - unit.x, b.z - unit.z) || a.id - b.id).slice(0, 8);
    const seed = parkedBodies.find(body => {
      stats.bodyVisits++;
      return Math.sqrt(pointSegmentDistanceSquared(body, unit, progressTarget))
        < radius + LAND_CLEARANCE_PROFILE.radiusByKind[body.kind] + .02;
    });
    if (!seed) return null;
    const cluster = [seed];
    // Eight bodies, eight closure passes, at most 512 pair observations.
    for (let pass = 0; pass < 8; pass++) for (const body of parkedBodies) {
      if (cluster.includes(body)) continue;
      if (cluster.some(other => {
        stats.arbitrationVisits++;
        return Math.hypot(body.x - other.x, body.z - other.z)
          < 2 * radius + LAND_CLEARANCE_PROFILE.radiusByKind[body.kind]
            + LAND_CLEARANCE_PROFILE.radiusByKind[other.kind] + .04;
      })) cluster.push(body);
    }
    const bounds = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
    for (const body of cluster) {
      const padding = radius + LAND_CLEARANCE_PROFILE.radiusByKind[body.kind] + .02;
      bounds.minX = Math.min(bounds.minX, body.x - padding); bounds.maxX = Math.max(bounds.maxX, body.x + padding);
      bounds.minZ = Math.min(bounds.minZ, body.z - padding); bounds.maxZ = Math.max(bounds.maxZ, body.z + padding);
    }
    const corners = [{ x: bounds.minX, z: bounds.maxZ }, { x: bounds.minX, z: bounds.minZ },
      { x: bounds.maxX, z: bounds.minZ }, { x: bounds.maxX, z: bounds.maxZ }];
    const faces = [{ x: unit.x, z: bounds.maxZ, corners: [0, 3] },
      { x: bounds.minX, z: unit.z, corners: [0, 1] },
      { x: unit.x, z: bounds.minZ, corners: [1, 2] }, { x: bounds.maxX, z: unit.z, corners: [2, 3] }];
    // Three approach headings per observed face allow a tangent entry when a
    // straight projection is boxed by a current body. These are proposals;
    // every point and executed short step still uses the full physical set.
    const exits = faces.flatMap((face, index) => {
      const distance = Math.hypot(face.x - unit.x, face.z - unit.z);
      return [0, -.5, .5].map(side => index % 2 === 0
        ? { ...face, x: face.x + distance * side } : { ...face, z: face.z + distance * side });
    });
    let selected = null;
    for (const exit of exits) {
      const distance = Math.hypot(exit.x - unit.x, exit.z - unit.z);
      if (distance < .02 || !pointAllowed(exit)) continue;
      const length = Math.min(distance, stepDistance);
      if (!admit({ x: unit.x + (exit.x - unit.x) / distance * length,
        z: unit.z + (exit.z - unit.z) / distance * length })) continue;
      const corner = exit.corners.filter(index => pointAllowed(corners[index])).toSorted((a, b) =>
        Math.hypot(corners[a].x - progressTarget.x, corners[a].z - progressTarget.z)
          - Math.hypot(corners[b].x - progressTarget.x, corners[b].z - progressTarget.z))[0];
      if (corner === undefined) continue;
      if (!selected || distance < selected.distance) selected = { exit, corner, distance };
    }
    if (!selected) return yieldedTo ? { target, waitingForCrowd: true, stepDistance: 0 } : null;
    const { exit, corner } = selected;
    const next = exit.corners.find(index => index !== corner);
    const increment = (corner - next + 4) % 4 === 1 ? 1 : -1;
    state.contour = contour = { point: exit, corners, corner, increment, turns: 0,
      bodies: cluster.map(body => ({ body, x: body.x, z: body.z, generation: body.generation, revision: body.orderRevision })),
      since: tick, until: tick + 90, blockedSince: null };
    state.contourCooldown = tick + 120;
  }
  if (!contour) return null;
  stats.contourAge = tick - contour.since;
  if (!pointAllowed(contour.point)) { state.contour = null; state.contourCooldown = tick + 30; return null; }
  let distance = Math.hypot(contour.point.x - unit.x, contour.point.z - unit.z);
  if (distance < .015) {
    if (contour.turns++ >= 4) { state.contour = null; return null; }
    contour.point = contour.corners[contour.corner];
    contour.corner = (contour.corner + contour.increment + 4) % 4;
    distance = Math.hypot(contour.point.x - unit.x, contour.point.z - unit.z);
    if (!pointAllowed(contour.point)) { state.contour = null; state.contourCooldown = tick + 30; return null; }
  }
  if (!distance) return { target, waitingForCrowd: true, stepDistance: 0 };
  const length = Math.min(distance, stepDistance), x = (contour.point.x - unit.x) / distance,
    z = (contour.point.z - unit.z) / distance;
  if (!admit({ x: unit.x + x * length, z: unit.z + z * length })) {
    contour.blockedSince ??= tick;
    if (tick - contour.blockedSince >= 8) { state.contour = null; state.contourCooldown = tick + 30; return null; }
    return { target, waitingForCrowd: true, stepDistance: 0 };
  }
  contour.blockedSince = null;
  return { x, z, target, stepDistance: length };
}
