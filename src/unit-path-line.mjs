// Coordinates are in grid space, before flooring. Visit the supercover of a
// segment, including both sides of exact corners and lines on tile boundaries.
// Returning false from visit stops early. Work is bounded by the map dimensions.
export function visitGridSegmentCells(x, z, targetX, targetZ, width, cellCount, visit, cornerStep = 0) {
  const height = cellCount / width;
  if (![x,z,targetX,targetZ].every(Number.isFinite) || !Number.isInteger(width) || width <= 0
    || !Number.isInteger(height) || height <= 0
    || Math.min(x,targetX) < 0 || Math.max(x,targetX) >= width
    || Math.min(z,targetZ) < 0 || Math.max(z,targetZ) >= height) return false;
  let column = Math.floor(x), row = Math.floor(z);
  const endColumn = Math.floor(targetX), endRow = Math.floor(targetZ);
  const dx = targetX-x, dz = targetZ-z, sx = Math.sign(dx), sz = Math.sign(dz);
  const distance = Math.hypot(dx,dz);
  const parallelX = dx === 0 && Number.isInteger(x) && column > 0;
  const parallelZ = dz === 0 && Number.isInteger(z) && row > 0;
  const at = (c,r) => visit(r*width+c) !== false
    && (!parallelX || visit(r*width+c-1) !== false)
    && (!parallelZ || visit((r-1)*width+c) !== false)
    && (!(parallelX && parallelZ) || visit((r-1)*width+c-1) !== false);
  if (!at(column,row)) return false;
  const deltaX = dx === 0 ? Infinity : 1/Math.abs(dx);
  const deltaZ = dz === 0 ? Infinity : 1/Math.abs(dz);
  let nextX = dx === 0 ? Infinity : ((sx > 0 ? column+1 : column)-x)/dx;
  let nextZ = dz === 0 ? Infinity : ((sz > 0 ? row+1 : row)-z)/dz;
  for (let count = 0; count < width+height; count++) {
    if (column === endColumn && row === endRow) return true;
    // One physical tick can cross two nearby boundaries even when the line
    // misses their exact corner. Its diagonal step guard requires both sides.
    if (nextX <= 1 && nextZ <= 1 && Math.abs(nextX-nextZ)*distance <= cornerStep
      && (!at(column+sx,row) || !at(column,row+sz))) return false;
    if (Math.abs(nextX-nextZ) < 1e-10) {
      if (!at(column+sx,row) || !at(column,row+sz)) return false;
      column += sx; row += sz; nextX += deltaX; nextZ += deltaZ;
    } else if (nextX < nextZ) {
      column += sx; nextX += deltaX;
    } else {
      row += sz; nextZ += deltaZ;
    }
    if (!at(column,row)) return false;
  }
  return false;
}

// Only shortcut a uniform level. Existing weighted cardinal routing still
// chooses slopes and terrain detours; a straight line cannot skip their cost.
export function canTraverseFlatUnitSegment(x,z,targetX,targetZ,width,levels,isWalkable,cornerStep = 0) {
  const level = levels[Math.floor(z)*width+Math.floor(x)];
  return visitGridSegmentCells(x,z,targetX,targetZ,width,levels.length,
    cell => isWalkable(cell) && levels[cell] === level, cornerStep);
}
