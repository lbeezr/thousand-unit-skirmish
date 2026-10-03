// Pure grid authoring. This does not place buildings, debit resources, or change navigation.
const DIRECTIONS = [
  ['north', 0, -1], ['east', 1, 0], ['south', 0, 1], ['west', -1, 0],
];

function cellSet(values, cellCount, name) {
  if (!Array.isArray(values) && !(values instanceof Set)) {
    throw new TypeError(`${name} must be an array or Set of cell indices.`);
  }
  const cells = new Set(values);
  for (const cell of cells) if (!Number.isInteger(cell) || cell < 0 || cell >= cellCount) {
    throw new TypeError(`Invalid ${name} cell index.`);
  }
  return cells;
}

function resources(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).some(key => !['food', 'wood'].includes(key))
    || !['food', 'wood'].every(key => Number.isFinite(value[key]) && value[key] >= 0)) {
    throw new TypeError(`${name} needs explicit nonnegative food and wood values.`);
  }
  return { food: value.food, wood: value.wood };
}

/**
 * points are grid {column,row} waypoints; each leg uses the chosen axis first.
 * blockedCells and occupiedCells contain terrain/reserved and other-entity cells.
 * existingWallCells contains only compatible walls that may be reused/connected.
 * segmentCost uses the building registry's {food,wood} shape, with no default price.
 * balance is optional for authoring; authoritative callers must revalidate before use.
 */
export function planWallLine({ width, height, points, axisOrder = 'column-first',
  blockedCells = [], occupiedCells = [], existingWallCells = [],
  segmentCost = null, balance = null } = {}) {
  if (![width, height].every(n => Number.isInteger(n) && n >= 1 && n <= 256)
    || !Array.isArray(points) || points.length < 1 || points.length > 256
    || !['column-first', 'row-first'].includes(axisOrder)
    || points.some(p => !p || !Number.isSafeInteger(p.column) || !Number.isSafeInteger(p.row))) {
    throw new TypeError('Wall lines need grid dimensions, 1–256 integer waypoints and a valid axis order.');
  }
  const blocked = cellSet(blockedCells, width * height, 'blockedCells');
  const occupied = cellSet(occupiedCells, width * height, 'occupiedCells');
  const existing = cellSet(existingWallCells, width * height, 'existingWallCells');
  const price = segmentCost === null ? null : resources(segmentCost, 'segmentCost');
  const stock = balance === null ? null : resources(balance, 'balance');
  const errors = [];
  points.forEach(({ column, row }, waypoint) => {
    if (column < 0 || column >= width || row < 0 || row >= height) {
      errors.push({ code: 'outside-map', waypoint, column, row });
    }
  });
  // Never clamp or rasterize off-map waypoints: a bad endpoint rejects the entire line.
  if (errors.length) return { status: 'invalid', errors, preview: null, plan: null };

  const requested = new Set();
  let column = points[0].column, row = points[0].row;
  requested.add(row * width + column);
  for (const point of points.slice(1)) {
    for (const axis of axisOrder === 'column-first' ? ['column', 'row'] : ['row', 'column']) {
      while ((axis === 'column' ? column : row) !== point[axis]) {
        if (axis === 'column') column += Math.sign(point.column - column);
        else row += Math.sign(point.row - row);
        requested.add(row * width + column);
      }
    }
  }
  // Canonical row-major output is independent of duplicate points and Set insertion order.
  const cells = [...requested].sort((a, b) => a - b);
  for (const cell of cells) {
    if (blocked.has(cell)) errors.push({ code: 'blocked-cell', cell });
    if (occupied.has(cell)) errors.push({ code: 'occupied-cell', cell });
  }
  const neighbours = cell => DIRECTIONS.flatMap(([direction, dx, dz]) => {
    const x = cell % width + dx, z = Math.floor(cell / width) + dz;
    return x >= 0 && x < width && z >= 0 && z < height
      ? [{ direction, cell: z * width + x }] : [];
  });
  const allWalls = new Set([...existing, ...requested]);
  const piece = (cell, walls) => {
    const connections = neighbours(cell).filter(n => walls.has(n.cell)).map(n => n.direction);
    const kind = connections.length === 0 ? 'post' : connections.length === 1 ? 'end'
      : connections.length > 2 ? 'junction'
        : ((connections.includes('north') && connections.includes('south'))
          || (connections.includes('east') && connections.includes('west'))) ? 'straight' : 'corner';
    return { cell, column: cell % width, row: Math.floor(cell / width),
      kind, connections, existing: existing.has(cell) };
  };
  const pieces = cells.map(cell => piece(cell, allWalls));
  const added = pieces.filter(p => !p.existing);
  const affected = new Set(cells.filter(cell => existing.has(cell)));
  for (const cell of cells) for (const neighbour of neighbours(cell)) {
    if (existing.has(neighbour.cell)) affected.add(neighbour.cell);
  }
  const updated = [...affected].sort((a, b) => a - b)
    .filter(cell => piece(cell, existing).connections.join() !== piece(cell, allWalls).connections.join())
    .map(cell => piece(cell, allWalls));
  // A compatible existing wall cannot override terrain or another entity's occupancy.
  for (const { cell } of updated) if (!requested.has(cell)) {
    if (blocked.has(cell)) errors.push({ code: 'blocked-cell', cell });
    if (occupied.has(cell)) errors.push({ code: 'occupied-cell', cell });
  }
  const cost = price && { food: price.food * added.length, wood: price.wood * added.length };
  if (cost && !Object.values(cost).every(Number.isFinite)) {
    throw new TypeError('Wall line cost overflow.');
  }
  const affordable = cost && stock ? stock.food >= cost.food && stock.wood >= cost.wood : null;
  const status = errors.length ? 'invalid' : !price ? 'cost-required'
    : affordable === false ? 'insufficient-resources' : 'ready';
  return { status, errors,
    preview: { cells, pieces, newCount: added.length, reusedCount: pieces.length - added.length,
      updated, cost, affordable },
    plan: status === 'ready' ? { added, updated, cost } : null };
}
