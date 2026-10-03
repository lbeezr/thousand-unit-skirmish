import { waterRaster } from './water-contours.mjs';
import { buildElevationGrid } from './map-utils.mjs';

const graphStates = new WeakMap();
const validCell = (cell, count) => Number.isInteger(cell) && cell >= 0 && cell < count;
function stateFor(graph) {
  const state = graphStates.get(graph);
  if (!state) throw new TypeError('Expected a water route graph created by createWaterRouteGraph.');
  return state;
}
function neighbours(cell, width, height) {
  const column = cell % width, row = Math.floor(cell / width);
  // Ascending cell index fixes ties independently of input rectangle order.
  return [row > 0 ? cell - width : -1, column > 0 ? cell - 1 : -1,
    column + 1 < width ? cell + 1 : -1, row + 1 < height ? cell + width : -1];
}

// This is an isolated topology snapshot, not a live movement domain or boat.
// Static reservations and square clearance are explicit future-adapter inputs.
export function createWaterRouteGraph(definition, { reservedCells = [], clearanceCells = 0 } = {}) {
  const { width, height, obstacles } = definition || {};
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1
    || width > 256 || height > 256 || !Array.isArray(obstacles) || obstacles.length > 4096
    || !Number.isInteger(clearanceCells) || clearanceCells < 0 || clearanceCells > 4
    || !Array.isArray(reservedCells) || reservedCells.length > width * height
    || Array.from(reservedCells).some(cell => !validCell(cell, width * height))) {
    throw new TypeError('Water routes need bounded geometry, cell reservations and integer clearance from 0 to 4.');
  }
  const cellCount = width * height, occupied = new Uint8Array(cellCount);
  for (const rect of obstacles) {
    if (!rect || ![rect.column, rect.row, rect.width, rect.height].every(Number.isInteger)
      || rect.column < 0 || rect.row < 0 || rect.width < 1 || rect.height < 1
      || rect.column + rect.width > width || rect.row + rect.height > height
      || (rect.material !== undefined && !['water', 'forest', 'stone'].includes(rect.material))) throw new TypeError('Invalid water-route obstacle geometry.');
    for (let row = rect.row; row < rect.row + rect.height; row++) for (let column = rect.column; column < rect.column + rect.width; column++) {
      const cell = row * width + column;
      if (occupied[cell]) throw new TypeError('Water-route obstacle rectangles cannot overlap.');
      occupied[cell] = 1;
    }
  }
  const levels = buildElevationGrid(width, height, definition.elevationPatches);
  const wet = waterRaster(definition), reserved = new Set(reservedCells);
  const admitted = wet.map((value, cell) => value && levels[cell] === 0 && !reserved.has(cell) ? 1 : 0);
  const blocked = new Uint8Array(cellCount).fill(1);
  for (let cell = 0; cell < cellCount; cell++) {
    if (!admitted[cell]) continue;
    const column = cell % width, row = Math.floor(cell / width);
    let clear = true;
    for (let dz = -clearanceCells; dz <= clearanceCells && clear; dz++) for (let dx = -clearanceCells; dx <= clearanceCells; dx++) {
      const x = column + dx, z = row + dz;
      if (x < 0 || z < 0 || x >= width || z >= height || !admitted[z * width + x]) { clear = false; break; }
    }
    if (clear) blocked[cell] = 0;
  }
  const components = new Int32Array(cellCount).fill(-1), queue = new Int32Array(cellCount);
  let componentCount = 0, navigableCellCount = 0;
  for (let start = 0; start < cellCount; start++) {
    if (blocked[start] || components[start] >= 0) continue;
    let head = 0, tail = 1; queue[0] = start; components[start] = componentCount;
    while (head < tail) {
      const current = queue[head++]; navigableCellCount++;
      for (const next of neighbours(current, width, height)) if (next >= 0 && !blocked[next] && components[next] < 0) {
        components[next] = componentCount; queue[tail++] = next;
      }
    }
    componentCount++;
  }
  const graph = Object.freeze({ domain: 'water', width, height, cellCount, clearanceCells,
    componentCount, navigableCellCount,
    cellAt(x, z) {
      if (!Number.isFinite(x) || !Number.isFinite(z)
        || x < -width / 2 || z < -height / 2 || x >= width / 2 || z >= height / 2) return -1;
      return Math.floor(z + height / 2) * width + Math.floor(x + width / 2);
    },
    pointAt(cell) { return validCell(cell, cellCount)
      ? { x: cell % width - width / 2 + .5, z: Math.floor(cell / width) - height / 2 + .5 } : null; },
    isNavigable(cell) { return validCell(cell, cellCount) && blocked[cell] === 0; },
    componentAt(cell) { return validCell(cell, cellCount) ? components[cell] : -1; },
  });
  graphStates.set(graph, { width, height, cellCount, blocked, components });
  return graph;
}

export function canTraverseWaterEdge(graph, from, to) {
  const { width, cellCount, blocked } = stateFor(graph);
  return validCell(from, cellCount) && validCell(to, cellCount) && !blocked[from] && !blocked[to]
    && Math.abs(from % width - to % width) + Math.abs(Math.floor(from / width) - Math.floor(to / width)) === 1;
}

// Routes include BOTH endpoints. Invalid/disconnected/budget-exhausted results
// are explicit; endpoints are never clamped or snapped across land to water.
export function findWaterCellRoute(graph, start, goal, { maxExpandedCells = graph?.cellCount } = {}) {
  const { width, height, cellCount, blocked, components } = stateFor(graph);
  if (!Number.isInteger(maxExpandedCells) || maxExpandedCells < 1 || maxExpandedCells > cellCount) {
    throw new TypeError('Water-route expansion budget must be between 1 and the graph cell count.');
  }
  const result = (status, expandedCells = 0, cells = []) => ({ status, expandedCells, cells });
  if (!validCell(start, cellCount) || !validCell(goal, cellCount) || blocked[start] || blocked[goal]) return result('invalid-endpoints');
  if (components[start] !== components[goal]) return result('disconnected');
  if (start === goal) return result('found', 0, [start]);
  const previous = new Int32Array(cellCount).fill(-1), queue = new Int32Array(cellCount);
  let head = 0, tail = 1, expanded = 0; queue[0] = start; previous[start] = start;
  while (head < tail && expanded < maxExpandedCells) {
    const current = queue[head++]; expanded++;
    if (current === goal) {
      const cells = [goal];
      while (cells.at(-1) !== start) cells.push(previous[cells.at(-1)]);
      return result('found', expanded, cells.reverse());
    }
    for (const next of neighbours(current, width, height)) if (next >= 0 && !blocked[next] && previous[next] < 0) {
      previous[next] = current; queue[tail++] = next;
    }
  }
  return result(head < tail ? 'budget-exhausted' : 'disconnected', expanded);
}

// Rebuilding with changed geometry/reservations lets a future caller reject a
// stale route. No navigation revision, path or domain is checkpointed here.
export function isWaterCellRouteValid(graph, cells, { startCell = cells?.[0], goalCell = Array.isArray(cells) ? cells[cells.length - 1] : undefined } = {}) {
  const { cellCount, blocked } = stateFor(graph);
  if (!Array.isArray(cells) || cells.length === 0 || cells.length > cellCount
    || cells[0] !== startCell || cells[cells.length - 1] !== goalCell) return false;
  for (let index = 0; index < cells.length; index++) {
    if (!validCell(cells[index], cellCount) || blocked[cells[index]]
      || (index > 0 && !canTraverseWaterEdge(graph, cells[index - 1], cells[index]))) return false;
  }
  return true;
}
