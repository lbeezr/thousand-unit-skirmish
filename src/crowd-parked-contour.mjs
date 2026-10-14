import { LAND_CLEARANCE_PROFILE, pointSegmentDistanceSquared } from './unit-movement.mjs';

// A bounded local steering contour, reconstructed from observed physical
// bodies. It publishes only the actor's next short step, never a route/order.
export function crowdParkedContour({ unit, state, tick, neighbors, radius, radiusOf, parked, yieldedTo,
  target, progressTarget = target, heading, stepDistance, admit, pointAllowed, stats }) {
  let contour = state.contour;
  const stationarySet = neighbors.every(parked);
  // Moving crowds retain their existing arbitration. A parked-row passage
  // must yield back to that policy when any current neighbor starts moving.
  if (contour?.terminal && !stationarySet) state.contour = contour = null;
  if (contour && (tick >= contour.until || contour.bodies.some(({ body, x, z, generation, revision }) =>
    !neighbors.includes(body) || !parked(body) || body.x !== x || body.z !== z
    || body.generation !== generation || body.orderRevision !== revision))) state.contour = contour = null;
  // Rejoin the admitted projected waypoint, which can differ from a raw cell
  // center occupied by a parked unit. A blocked raw center cannot end a detour.
  const lineFree = () => neighbors.every(body => {
    stats.bodyVisits++;
    return Math.sqrt(pointSegmentDistanceSquared(body, unit, contour?.terminal ? target : progressTarget))
      >= radius + LAND_CLEARANCE_PROFILE.radiusByKind[body.kind] - 1e-9;
  });
  const passageFree = (from, to) => neighbors.every(body => {
    stats.bodyVisits++;
    return Math.sqrt(pointSegmentDistanceSquared(body, from, to))
      >= radius + LAND_CLEARANCE_PROFILE.radiusByKind[body.kind] - 1e-9;
  });
  if (contour && lineFree()) state.contour = contour = null;
  // A fully clear aligned passage may start as soon as direct steering fails.
  // Keep the existing net-stall delay for perimeter retreats.
  const allowPerimeter = yieldedTo || tick - state.lastProgressTick >= 90;
  if (!contour && (stationarySet || allowPerimeter) && tick >= (state.contourCooldown ?? -Infinity)) {
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
    const exits = allowPerimeter ? faces.flatMap((face, index) => {
      const distance = Math.hypot(face.x - unit.x, face.z - unit.z);
      return [0, -.5, .5].map(side => index % 2 === 0
        ? { ...face, x: face.x + distance * side } : { ...face, z: face.z + distance * side });
    }) : [];
    // Parked rows can leave a passage only at an exact shared tangent. First
    // align beside the row, then traverse that lane; a diagonal to its far end
    // clips a body even when its first short step happens to be clear.
    // Eight observed bodies give at most 28 pairs per axis, within the same
    // point/proposal budgets supplied by the caller. All bodies still veto.
    const lanes = { x: [], z: [] };
    for (const axis of stationarySet ? ['x', 'z'] : []) {
      const lateral = axis === 'x' ? 'z' : 'x';
      for (let i = 0; i < parkedBodies.length; i++) for (let j = i + 1; j < parkedBodies.length; j++) {
        stats.arbitrationVisits++;
        const [a, b] = [parkedBodies[i], parkedBodies[j]].sort((a, b) => a[lateral] - b[lateral]);
        if (Math.abs(a[axis] - b[axis]) > 1e-9) continue;
        const low = a[lateral] + radius + LAND_CLEARANCE_PROFILE.radiusByKind[a.kind];
        const high = b[lateral] - radius - LAND_CLEARANCE_PROFILE.radiusByKind[b.kind];
        if (high < low - 1e-9 || high - low > .3) continue;
        const alignment = (low + high) / 2;
        if (!lanes[axis].some(value => Math.abs(value - alignment) < 1e-9)) lanes[axis].push(alignment);
      }
      // Four closest lanes per axis bound connected passage proposals to 32.
      lanes[axis].sort((a, b) => Math.abs(a - unit[lateral]) - Math.abs(b - unit[lateral]));
      lanes[axis] = lanes[axis].slice(0, 4);
    }
    for (const axis of ['x', 'z']) {
      const lateral = axis === 'x' ? 'z' : 'x', sign = Math.sign(heading[axis]);
      if (!sign) continue;
      for (const alignment of lanes[axis]) {
        const entry = { x: unit.x, z: unit.z, [lateral]: alignment };
        if (!passageFree(unit, entry)) continue;
        const rejoin = { ...entry, [axis]: target[axis], entry, terminal: true };
        if (passageFree(rejoin, target)) exits.push(rejoin);
        // A diagonal destination can require a turn between two clear row
        // passages. Preview both legs; short execution still checks all bodies.
        for (const crossing of lanes[lateral]) {
          const bend = { ...entry, [axis]: crossing };
          const turn = { ...bend, [lateral]: target[lateral] };
          if (passageFree(entry, bend) && passageFree(bend, turn) && passageFree(turn, target))
            exits.push({ ...bend, entry, turn, terminal: true });
        }
        if (allowPerimeter) exits.push({ ...entry,
          [axis]: bounds[`${sign > 0 ? 'max' : 'min'}${axis.toUpperCase()}`], entry,
          corners: axis === 'x' ? sign > 0 ? [2, 3] : [0, 1] : sign > 0 ? [0, 3] : [1, 2] });
      }
    }
    let selected = null;
    for (const exit of exits) {
      const entry = exit.entry ?? unit;
      const approach = Math.hypot(entry.x - unit.x, entry.z - unit.z);
      const distance = approach + Math.hypot(exit.x - entry.x, exit.z - entry.z);
      if (distance < .02 || (exit.entry && !pointAllowed(entry)) || (exit.turn && !pointAllowed(exit.turn)) || !pointAllowed(exit)
        || (stationarySet && !passageFree(entry, exit))) continue;
      const first = approach > 1e-9 ? entry : exit;
      const firstDistance = Math.hypot(first.x - unit.x, first.z - unit.z), length = Math.min(firstDistance, stepDistance);
      if (!admit({ x: unit.x + (first.x - unit.x) / firstDistance * length,
        z: unit.z + (first.z - unit.z) / firstDistance * length })) continue;
      const corner = exit.terminal ? null : exit.corners.filter(index => pointAllowed(corners[index])).toSorted((a, b) =>
        Math.hypot(corners[a].x - progressTarget.x, corners[a].z - progressTarget.z)
          - Math.hypot(corners[b].x - progressTarget.x, corners[b].z - progressTarget.z))[0];
      if (corner === undefined) continue;
      const score = exit.terminal ? distance + (exit.turn
        ? Math.hypot(exit.x - exit.turn.x, exit.z - exit.turn.z) + Math.hypot(exit.turn.x - target.x, exit.turn.z - target.z)
        : Math.hypot(exit.x - target.x, exit.z - target.z))
        : distance;
      if (!selected || score < selected.score) selected = { exit, corner, score };
    }
    if (!selected) return yieldedTo ? { target, waitingForCrowd: true, stepDistance: 0 } : null;
    const { exit, corner } = selected;
    const next = exit.corners?.find(index => index !== corner);
    const increment = exit.terminal ? 0 : (corner - next + 4) % 4 === 1 ? 1 : -1;
    state.contour = contour = { point: exit.entry ?? exit, exit: exit.entry ? exit : null, turn: exit.turn, terminal: exit.terminal, corners, corner, increment, turns: 0,
      bodies: cluster.map(body => ({ body, x: body.x, z: body.z, generation: body.generation, revision: body.orderRevision })),
      since: tick, until: tick + 90, blockedSince: null };
    state.contourCooldown = tick + 120;
  }
  if (!contour) return null;
  stats.contourAge = tick - contour.since;
  if (!pointAllowed(contour.point)) { state.contour = null; state.contourCooldown = tick + 30; return null; }
  let distance = Math.hypot(contour.point.x - unit.x, contour.point.z - unit.z);
  if (distance < (contour.exit || contour.turn ? 1e-9 : .015)) {
    if (contour.exit) { contour.point = contour.exit; contour.exit = null; }
    else if (contour.turn) { contour.point = contour.turn; contour.turn = null; }
    else {
      if (contour.terminal) { state.contour = null; return null; }
      if (contour.turns++ >= 4) { state.contour = null; return null; }
      contour.point = contour.corners[contour.corner];
      contour.corner = (contour.corner + contour.increment + 4) % 4;
    }
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
