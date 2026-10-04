import { pointSegmentDistanceSquared, segmentRectangleDistanceSquared } from '../src/unit-movement.mjs';
export { pointSegmentDistanceSquared, segmentRectangleDistanceSquared };
// Diagnostic hypotheses only: no runtime imports or production radius adoption.
// World units equal tiles. Each circle is centered on the authoritative x/z.
// These authored sizes are not inferred from sprite bounds or soft separation.
export const LAND_BODY_STUDY = Object.freeze({ id: 'candidate-land-circles-v1',
  radiusByKind: Object.freeze({ worker: .18, infantry: .22, spearman: .22, archer: .22,
    scout: .28, rider: .28, 'siege-engine': .35 }) });
const EPSILON = 1e-9;
const MAX_STUDY_STEP = .25; // Current largest production land step is .15.
const finitePoint = p => p && Number.isFinite(p.x) && Number.isFinite(p.z);
function validateSegment(a, b) {
  if (!finitePoint(a) || !finitePoint(b)) throw new TypeError('finite movement segment required');
}
export function sweptStaticBodyContacts(a, b, radius, width, height, isWalkable) {
  validateSegment(a, b);
  if (Math.hypot(b.x - a.x, b.z - a.z) > MAX_STUDY_STEP + EPSILON)
    throw new RangeError('short authoritative substep required');
  if (!Number.isFinite(radius) || radius < 0 || radius > .5
    || !Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1)
    throw new TypeError('bounded circle radius and grid required');
  const halfX = width / 2, halfZ = height / 2;
  const minColumn = Math.max(0, Math.floor(Math.min(a.x, b.x) - radius + halfX) - 1);
  const maxColumn = Math.min(width - 1, Math.floor(Math.max(a.x, b.x) + radius + halfX) + 1);
  const minRow = Math.max(0, Math.floor(Math.min(a.z, b.z) - radius + halfZ) - 1);
  const maxRow = Math.min(height - 1, Math.floor(Math.max(a.z, b.z) + radius + halfZ) + 1);
  const boundaryMargin = Math.min(halfX - Math.max(a.x, b.x), halfX + Math.min(a.x, b.x),
    halfZ - Math.max(a.z, b.z), halfZ + Math.min(a.z, b.z)) - radius;
  const contacts = [];
  if (boundaryMargin < -EPSILON) contacts.push({ cell: null, margin: boundaryMargin });
  let queries = 0;
  for (let row = minRow; row <= maxRow; row++) for (let column = minColumn; column <= maxColumn; column++) {
    const cell = row * width + column; queries++;
    if (isWalkable(cell)) continue;
    const minX = column - halfX, minZ = row - halfZ;
    const margin = Math.sqrt(segmentRectangleDistanceSquared(a, b,
      { minX, minZ, maxX: minX + 1, maxZ: minZ + 1 })) - radius;
    if (margin < -EPSILON) contacts.push({ cell, margin });
  }
  return { contacts, queries };
}
export function sweptBodyPairMargin(step, radius, neighbour, neighbourRadius) {
  validateSegment(step.from, step.to);
  if (Math.hypot(step.to.x - step.from.x, step.to.z - step.from.z) > MAX_STUDY_STEP + EPSILON)
    throw new RangeError('short authoritative substep required');
  if (![radius, neighbourRadius].every(r => Number.isFinite(r) && r >= 0 && r <= .5))
    throw new TypeError('bounded circle radii required');
  return Math.sqrt(pointSegmentDistanceSquared(neighbour, step.from, step.to)) - radius - neighbourRadius;
}
