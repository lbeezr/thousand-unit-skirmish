import { canTraverseElevation } from './elevation.mjs';

// Simulation steps are shorter than one tile. Separation can deflect them away
// from a planned cardinal route, so check the crossed boundaries as well as the
// destination. Both sides of a diagonal must be open to avoid cutting a corner.
export function canTraverseUnitStep(from, to, width, levels, isWalkable) {
  if (!Number.isInteger(width) || width <= 0 || levels.length === 0
    || levels.length % width !== 0
    || !Number.isInteger(from) || !Number.isInteger(to)
    || from < 0 || to < 0 || from >= levels.length || to >= levels.length
    || !isWalkable(to) || !canTraverseElevation(levels, from, to)) return false;
  const dx = to % width - from % width;
  const dz = Math.floor(to / width) - Math.floor(from / width);
  if (Math.abs(dx) > 1 || Math.abs(dz) > 1) return false;
  if (dx === 0 || dz === 0) return true;
  const acrossX = from + dx;
  const acrossZ = from + dz * width;
  return isWalkable(acrossX) && isWalkable(acrossZ)
    && canTraverseElevation(levels, from, acrossX)
    && canTraverseElevation(levels, acrossX, to)
    && canTraverseElevation(levels, from, acrossZ)
    && canTraverseElevation(levels, acrossZ, to);
}
