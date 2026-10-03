import { canTraverseUnitStep } from './unit-movement.mjs';
import { wildlifeCell } from './wildlife-motion.mjs';

// Automatic proximity claims change only a live Sheep's team label. The caller
// supplies validated resource/unit rows and the authoritative visibility,
// registry mobility and clear legal land-segment predicate.
export const SHEEP_CLAIM_RADIUS = 1.4;

function claimableSheep(node) {
  return node?.wildlifeSpecies === 'bellweather-sheep' && node.type === 'food'
    && node.wildlifeState === 'alive' && Number.isFinite(node.stock) && node.stock > 0
    && Number.isFinite(node.x) && Number.isFinite(node.z);
}

function livingLandUnit(unit) {
  return unit && Number.isSafeInteger(unit.id) && unit.id >= 0
    && (unit.team === 0 || unit.team === 1) && Number.isFinite(unit.hp) && unit.hp > 0
    && (unit.movementDomain === undefined || unit.movementDomain === 'land')
    && Number.isFinite(unit.x) && Number.isFinite(unit.z);
}

// Pure resolution. The last owner remains when nobody is eligible. Any eligible
// current-owner presence beats an opponent, regardless of relative distance.
// Otherwise the nearest eligible unit wins, with exact ties by stable unit ID.
export function resolveWildlifeClaim(node, units, { canClaim }) {
  const owner = node.wildlifeTeam ?? null;
  if (!claimableSheep(node)) return owner;
  if (typeof canClaim !== 'function') throw new TypeError('Wildlife claims require canClaim(unit, node)');
  let nearest = null, nearestDistance = Infinity;
  for (const unit of units) {
    if (!livingLandUnit(unit)) continue;
    const distance = Math.hypot(unit.x - node.x, unit.z - node.z);
    if (distance > SHEEP_CLAIM_RADIUS || !canClaim(unit, node)) continue;
    if (unit.team === owner) return owner;
    if (distance < nearestDistance || (distance === nearestDistance && unit.id < nearest.id)) {
      nearest = unit;
      nearestDistance = distance;
    }
  }
  return nearest?.team ?? owner;
}

// One authoritative update; nodes may be a resource Map's values() iterator.
// Units are the server's reusable array. Return whether the public label changed.
// No lifecycle, position, motion, stock, cargo, bank, sight or population changes.
export function stepWildlifeClaims(nodes, units, options) {
  let changed = false;
  for (const node of nodes) {
    if (!claimableSheep(node)) continue;
    const team = resolveWildlifeClaim(node, units, options);
    if (node.wildlifeTeam === team) continue;
    node.wildlifeTeam = team;
    changed = true;
  }
  return changed;
}


// A short claim segment cannot pass through walls, water, buildings, map edges
// or impassable elevations. Sampling is shorter than a tile and the ordinary
// unit-step predicate also checks both sides of each crossed diagonal.
export function clearWildlifeClaimSegment(unit, node, { map, levels, isWalkable }) {
  let previous = wildlifeCell(unit, map);
  if (previous < 0 || wildlifeCell(node, map) < 0 || !isWalkable(previous)) return false;
  const dx = node.x - unit.x, dz = node.z - unit.z;
  const count = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .1));
  for (let index = 1; index <= count; index++) {
    const fraction = index / count;
    const cell = wildlifeCell({ x: unit.x + dx * fraction, z: unit.z + dz * fraction }, map);
    if (!canTraverseUnitStep(previous, cell, map.width, levels, isWalkable)) return false;
    previous = cell;
  }
  return true;
}

// Schema25 never recorded a claim. Initialize only its exact absent-team shape;
// normal validation still owns identity, stock, lifecycle, position and motion.
export function migrateWildlifeClaimsCheckpoint(snapshot) {
  if (snapshot?.schemaVersion !== 25 || !Array.isArray(snapshot.state?.resourceNodes)
    || snapshot.state.resourceNodes.some(node => !node || node.wildlifeTeam !== undefined)) return false;
  for (const node of snapshot.state.resourceNodes) {
    if (node.wildlifeSpecies === 'bellweather-sheep') node.wildlifeTeam = null;
  }
  snapshot.schemaVersion = 26;
  return true;
}
