import { authoredWildlifeBodyHeading, authoredWildlifeNoseHeading } from './wildlife-heading.mjs';

// Neutral Sheep take continuous, bounded steps; this owns no food or team state.
export const SHEEP_WANDER_RADIUS = 0.35;
export const SHEEP_WANDER_SPEED = 0.18;
export const SHEEP_OCCUPANCY_RADIUS = 0.45;
const TAU = Math.PI * 2;
const ACTIVITIES = new Set(['idle', 'grazing', 'wandering']);

function seed(id, sequence = 0) {
  let value = 2166136261;
  for (const character of `${id}:${sequence}`) value = Math.imul(value ^ character.charCodeAt(0), 16777619) >>> 0;
  return value;
}
function nearAnchor(x, z, definition) {
  return Number.isFinite(x) && Number.isFinite(z)
    && Math.hypot(x - definition.x, z - definition.z) <= SHEEP_WANDER_RADIUS + 1e-9;
}
export function createWildlifeMotion(definition) {
  const waitTicks = 60 + seed(definition.id) % 120;
  return { sequence: 0, targetX: definition.x, targetZ: definition.z, waitTicks,
    activity: 'grazing', heading: authoredWildlifeBodyHeading(definition) };
}
export function validWildlifePosition(node, definition) {
  return nearAnchor(node.x, node.z, definition);
}
export function wildlifeCell(point, map) {
  const column = Math.floor(point.x + map.width / 2), row = Math.floor(point.z + map.height / 2);
  return Number.isFinite(point.x) && Number.isFinite(point.z)
    && column >= 0 && column < map.width && row >= 0 && row < map.height
    ? row * map.width + column : -1;
}
export function sameWildlifeCell(point, definition, map) {
  const cell = wildlifeCell(point, map);
  return cell >= 0 && cell === wildlifeCell(definition, map);
}
export function wildlifeStepUnoccupied(from, to, actors) {
  const dx = to.x - from.x, dz = to.z - from.z, lengthSquared = dx * dx + dz * dz;
  return actors.every(actor => {
    const along = lengthSquared ? Math.max(0, Math.min(1,
      ((actor.x - from.x) * dx + (actor.z - from.z) * dz) / lengthSquared)) : 0;
    return Math.hypot(actor.x - from.x - along * dx, actor.z - from.z - along * dz) >= SHEEP_OCCUPANCY_RADIUS;
  });
}
export function validWildlifeMotion(node, definition) {
  const motion = node.wildlifeMotion;
  return validWildlifePosition(node, definition) && motion && typeof motion === 'object'
    && Number.isInteger(motion.sequence) && motion.sequence >= 0 && motion.sequence <= 0xffffffff
    && Number.isInteger(motion.waitTicks) && motion.waitTicks >= 0 && motion.waitTicks <= 210
    && nearAnchor(motion.targetX, motion.targetZ, definition) && ACTIVITIES.has(motion.activity)
    && Number.isFinite(motion.heading) && motion.heading >= 0 && motion.heading < TAU
    && (node.wildlifeState === 'alive' || (motion.activity === 'idle' && motion.waitTicks === 0
      && motion.targetX === node.x && motion.targetZ === node.z));
}
export function freezeWildlifeMotion(node) {
  if (!node.wildlifeMotion) return;
  Object.assign(node.wildlifeMotion, { targetX: node.x, targetZ: node.z, waitTicks: 0, activity: 'idle' });
}

// One authoritative 30 Hz step. The caller checks the complete swept segment
// against the actual terrain/cell, buildings and living-unit occupancy.
export function stepWildlifeMotion(node, definition, { paused = false, canStep }) {
  if (node.wildlifeState !== 'alive' || !node.wildlifeMotion) return false;
  const motion = node.wildlifeMotion, previousActivity = motion.activity;
  if (paused) { motion.activity = 'idle'; return previousActivity !== motion.activity; }
  if (motion.waitTicks > 0) {
    motion.waitTicks--;
    motion.activity = motion.waitTicks > 30 ? 'grazing' : 'idle';
    return previousActivity !== motion.activity;
  }
  if (Math.hypot(motion.targetX - node.x, motion.targetZ - node.z) <= 1e-9) {
    motion.sequence = (motion.sequence + 1) >>> 0;
    const value = seed(definition.id, motion.sequence), angle = (value % 8) * Math.PI / 4;
    const radius = 0.2 + ((value >>> 8) % 151) / 1000;
    motion.targetX = definition.x + Math.sin(angle) * radius;
    motion.targetZ = definition.z + Math.cos(angle) * radius;
    // Persist only legal goals, including off-center authored meadow anchors.
    if (!canStep({ x: node.x, z: node.z }, { x: motion.targetX, z: motion.targetZ })) {
      motion.targetX = node.x; motion.targetZ = node.z;
      motion.waitTicks = 90; motion.activity = 'idle';
      return previousActivity !== motion.activity;
    }
  }
  const dx = motion.targetX - node.x, dz = motion.targetZ - node.z, distance = Math.hypot(dx, dz);
  const amount = Math.min(distance, SHEEP_WANDER_SPEED / 30);
  const next = { x: node.x + dx / distance * amount, z: node.z + dz / distance * amount };
  if (!Number.isFinite(next.x) || !Number.isFinite(next.z)
    || !nearAnchor(next.x, next.z, definition) || !canStep({ x: node.x, z: node.z }, next)) {
    motion.targetX = node.x; motion.targetZ = node.z;
    motion.waitTicks = 90; motion.activity = 'idle';
    return previousActivity !== motion.activity;
  }
  node.x = next.x; node.z = next.z;
  motion.heading = (Math.atan2(dx, dz) + TAU) % TAU;
  motion.activity = 'wandering';
  if (amount >= distance) {
    motion.waitTicks = 90 + seed(definition.id, motion.sequence) % 121;
    motion.activity = 'grazing';
  }
  return true;
}

// Old stationary checkpoints have no motion to replay. Initialize only that
// exact shape; full checkpoint validation still rejects malformed stock/IDs.
export function migrateWildlifeMotionCheckpoint(snapshot) {
  if (snapshot?.schemaVersion !== 23 || !Array.isArray(snapshot.state?.resourceNodes)
    || !Array.isArray(snapshot.mapDefinition?.resourceNodes)) return false;
  const definitions = new Map(snapshot.mapDefinition.resourceNodes.map(node => [node.id, node]));
  for (const node of snapshot.state.resourceNodes) {
    const definition = definitions.get(node?.id);
    if (!definition || node.wildlifeMotion !== undefined
      || (node.x !== undefined && node.x !== definition.x)
      || (node.z !== undefined && node.z !== definition.z)) return false;
  }
  for (const node of snapshot.state.resourceNodes) {
    const definition = definitions.get(node.id);
    node.x = definition.x; node.z = definition.z;
    if (node.wildlifeSpecies === 'bellweather-sheep') {
      // This intermediate schema24 still uses nose yaw. The later exact
      // schema28→29 migration converts it once after claims/mode/Herd migrate.
      node.wildlifeMotion = { ...createWildlifeMotion(definition), heading: authoredWildlifeNoseHeading(definition) };
      if (node.wildlifeState !== 'alive') freezeWildlifeMotion(node);
    }
  }
  snapshot.schemaVersion = 24;
  return true;
}
