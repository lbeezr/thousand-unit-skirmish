// A Sheep remains its existing finite food node. Navigation, sight and epoch
// authorization belong to the room; this module owns only validated herd intent.
export const SHEEP_HERD_SPEED = 0.6;
export const SHEEP_GRAZE_RADIUS = 0.35;
const STEP_SECONDS = 1 / 30, EPSILON = 1e-9, TAU = Math.PI * 2;
const teamValid = team => team === 0 || team === 1;
const sheep = node => node?.wildlifeSpecies === 'bellweather-sheep' && node.type === 'food';
const alive = node => sheep(node) && node.wildlifeState === 'alive'
  && Number.isFinite(node.stock) && node.stock > 0;

export function herdCell(point, map) {
  if (!Number.isSafeInteger(map?.width) || map.width <= 0
    || !Number.isSafeInteger(map.height) || map.height <= 0
    || !Number.isSafeInteger(map.width * map.height)
    || !Number.isFinite(point?.x) || !Number.isFinite(point.z)) return -1;
  const column = Math.floor(point.x + map.width / 2), row = Math.floor(point.z + map.height / 2);
  return column >= 0 && column < map.width && row >= 0 && row < map.height
    ? row * map.width + column : -1;
}
const cellValid = (cell, map) => Number.isSafeInteger(cell) && cell >= 0 && cell < map.width * map.height;
const adjacent = (from, to, map) => Math.abs(from % map.width - to % map.width)
  + Math.abs(Math.floor(from / map.width) - Math.floor(to / map.width)) === 1;
function pointForCell(cell, map) {
  return { x: cell % map.width - map.width / 2 + .5,
    z: Math.floor(cell / map.width) - map.height / 2 + .5 };
}
function routeValid(path, start, goal, { map, isWalkable, canTraverse }) {
  if (!Array.isArray(path) || path.length > map.width * map.height) return false;
  let previous = start;
  const seen = new Set([start]);
  for (const cell of path) {
    if (!cellValid(cell, map) || seen.has(cell) || !adjacent(previous, cell, map)
      || !isWalkable(cell) || !canTraverse(previous, cell)) return false;
    seen.add(cell); previous = cell;
  }
  return previous === goal;
}

export function createWildlifeHerdState(point) {
  return { wildlifeHerd: null, wildlifeGrazeAnchor: { x: point.x, z: point.z } };
}

// Pure admission: importantly, endpoints and sight are checked before findPath.
// The caller supplies the existing cardinal land path, without snapped endpoints.
export function planWildlifeHerd(node, command, {
  team, map, isVisible, isWalkable, canTraverse, findPath, gatherPending = false,
}) {
  const reject = reason => ({ status: 'rejected', reason });
  if (!teamValid(team) || !alive(node) || node.wildlifeTeam !== team
    || command?.nodeId !== node.id) return reject('owned-alive-sheep-required');
  if (!node.wildlifeMotion || !Number.isFinite(node.wildlifeMotion.heading)
    || node.wildlifeMotion.heading < 0 || node.wildlifeMotion.heading >= TAU) return reject('invalid-motion');
  if (command.queue === true) return reject('queued-herding-unavailable');
  const start = herdCell(node, map), goal = herdCell(command, map);
  if (start < 0 || goal < 0) return reject('invalid-endpoint');
  if (!isVisible(team, start) || !isVisible(team, goal)) return reject('visible-endpoints-required');
  if (!isWalkable(start) || !isWalkable(goal)) return reject('legal-land-endpoints-required');
  if (gatherPending) return reject('gather-in-progress');
  const path = findPath(start, goal);
  if (!routeValid(path, start, goal, { map, isWalkable, canTraverse })) return reject('unreachable');
  return { status: 'accepted', herd: { team, goalX: command.x, goalZ: command.z,
    goalCell: goal, path: [...path], pathIndex: 0 } };
}

// Cancellation changes neither ownership nor lifecycle nor stock. Call for Stop,
// any accepted shared Gather, recapture, harvest or depletion. Idle grazing must
// subsequently use this persisted anchor, rather than the authored definition.
export function cancelWildlifeHerd(node) {
  if (!sheep(node) || !Number.isFinite(node.x) || !Number.isFinite(node.z)) return false;
  const motion = node.wildlifeMotion;
  const changed = node.wildlifeHerd !== null || node.wildlifeGrazeAnchor?.x !== node.x
    || node.wildlifeGrazeAnchor?.z !== node.z || (motion && (motion.targetX !== node.x
      || motion.targetZ !== node.z || motion.waitTicks !== 0 || motion.activity !== 'idle'));
  Object.assign(node, createWildlifeHerdState(node));
  if (motion) Object.assign(motion, { targetX: node.x, targetZ: node.z, waitTicks: 0, activity: 'idle' });
  return Boolean(changed);
}

export function startWildlifeHerd(node, command, context) {
  const plan = planWildlifeHerd(node, command, context);
  if (plan.status !== 'accepted') return plan;
  cancelWildlifeHerd(node);
  node.wildlifeHerd = plan.herd;
  return { status: 'accepted', changed: true };
}

// Checkpoint admission; no mutation or repair. Ordinary lifecycle/stock ceilings
// and complete wildlifeMotion validation remain the existing caller's guards.
// Only unconsumed route cells need stay open: gates can close behind the Sheep.
export function validWildlifeHerdState(node, { map, isWalkable, canTraverse }) {
  if (!sheep(node) || herdCell(node, map) < 0 || herdCell(node.wildlifeGrazeAnchor, map) < 0) return false;
  const herd = node.wildlifeHerd, current = herdCell(node, map);
  if (herd === null) {
    const distance = Math.hypot(node.x - node.wildlifeGrazeAnchor.x, node.z - node.wildlifeGrazeAnchor.z);
    return node.wildlifeState === 'alive' ? alive(node) && isWalkable(current)
      && current === herdCell(node.wildlifeGrazeAnchor, map) && distance <= SHEEP_GRAZE_RADIUS + EPSILON
      : ((node.wildlifeState === 'carcass' && node.stock > 0 && Number.isFinite(node.stock) && isWalkable(current))
        || (node.wildlifeState === 'depleted' && node.stock === 0))
        && distance === 0 && node.wildlifeMotion?.activity === 'idle' && node.wildlifeMotion.waitTicks === 0
        && node.wildlifeMotion.targetX === node.x && node.wildlifeMotion.targetZ === node.z;
  }
  if (!alive(node) || !teamValid(herd?.team) || herd.team !== node.wildlifeTeam
    || !isWalkable(current) || !cellValid(herd.goalCell, map)
    || !node.wildlifeMotion || node.wildlifeMotion.targetX !== node.x || node.wildlifeMotion.targetZ !== node.z
    || node.wildlifeMotion.waitTicks !== 0 || !['idle', 'wandering'].includes(node.wildlifeMotion.activity)
    || herdCell({ x: herd.goalX, z: herd.goalZ }, map) !== herd.goalCell
    || !Array.isArray(herd.path) || herd.path.length > map.width * map.height
    || !Number.isSafeInteger(herd.pathIndex) || herd.pathIndex < 0
    || (herd.path.length ? herd.pathIndex >= herd.path.length : herd.pathIndex !== 0)) return false;
  const seen = new Set();
  for (let index = 0; index < herd.path.length; index++) {
    const cell = herd.path[index];
    if (!cellValid(cell, map) || seen.has(cell)
      || (index && !adjacent(herd.path[index - 1], cell, map))) return false;
    seen.add(cell);
  }
  if (herd.path.length === 0) return current === herd.goalCell;
  if (herd.path.at(-1) !== herd.goalCell) return false;
  const next = herd.path[herd.pathIndex];
  if (herd.pathIndex && current !== next && current !== herd.path[herd.pathIndex - 1]) return false;
  let previous = current;
  for (let index = herd.pathIndex; index < herd.path.length; index++) {
    const cell = herd.path[index];
    if ((previous !== cell && !adjacent(previous, cell, map))
      || !isWalkable(cell) || !canTraverse(previous, cell)) return false;
    previous = cell;
  }
  return true;
}

// Exactly one 30 Hz simulation tick. Each segment, including waypoint arrival,
// passes the authoritative swept terrain/building/elevation/occupancy predicate.
// A blocked segment stops at the current pose and returns a notice-worthy result;
// the caller may replan on navigation changes before invoking this step.
export function stepWildlifeHerd(node, { map, canStep, gatherPending = false }) {
  const herd = node.wildlifeHerd;
  if (!alive(node)) return { status: 'frozen', changed: cancelWildlifeHerd(node) };
  if (herd == null) return { status: 'idle', changed: false };
  if (herd.team !== node.wildlifeTeam || gatherPending) {
    return { status: 'cancelled', reason: gatherPending ? 'gather' : 'ownership-changed', changed: cancelWildlifeHerd(node) };
  }
  let remaining = SHEEP_HERD_SPEED * STEP_SECONDS, changed = false;
  while (remaining > EPSILON) {
    const final = herd.path.length === 0 || herd.pathIndex === herd.path.length - 1;
    const target = final ? { x: herd.goalX, z: herd.goalZ } : pointForCell(herd.path[herd.pathIndex], map);
    const dx = target.x - node.x, dz = target.z - node.z, distance = Math.hypot(dx, dz);
    if (distance <= EPSILON) {
      if (final) { cancelWildlifeHerd(node); return { status: 'arrived', changed: true }; }
      herd.pathIndex++; changed = true; continue;
    }
    const amount = Math.min(remaining, distance);
    const next = amount === distance ? target : { x: node.x + dx / distance * amount, z: node.z + dz / distance * amount };
    if (herdCell(next, map) < 0 || canStep({ x: node.x, z: node.z }, next) !== true) {
      cancelWildlifeHerd(node); return { status: 'blocked', changed: true };
    }
    node.x = next.x; node.z = next.z;
    Object.assign(node.wildlifeMotion, { targetX: node.x, targetZ: node.z, waitTicks: 0,
      heading: (Math.atan2(dx, dz) + TAU) % TAU, activity: 'wandering' });
    changed = true; remaining -= amount;
    if (amount === distance) {
      if (final) { cancelWildlifeHerd(node); return { status: 'arrived', changed: true }; }
      herd.pathIndex++;
    }
  }
  return { status: 'moving', changed };
}

// Schema26 has bounded authored grazing and no Herd/anchor fields. Preserve
// live motion's original anchor, and frozen current poses without repairing food.
export function migrateWildlifeHerdCheckpoint(snapshot) {
  if (snapshot?.schemaVersion !== 26 || !Array.isArray(snapshot.state?.resourceNodes)
    || !Array.isArray(snapshot.mapDefinition?.resourceNodes)
    || snapshot.state.resourceNodes.some(node => !node || node.wildlifeHerd !== undefined
      || node.wildlifeGrazeAnchor !== undefined)) return false;
  const definitions = new Map(snapshot.mapDefinition.resourceNodes.map(node => [node.id, node]));
  for (const node of snapshot.state.resourceNodes) if (!definitions.has(node.id)) return false;
  for (const node of snapshot.state.resourceNodes) if (sheep(node)) {
    Object.assign(node, createWildlifeHerdState(node.wildlifeState === 'alive' ? definitions.get(node.id) : node));
  }
  snapshot.schemaVersion = 27;
  return true;
}
