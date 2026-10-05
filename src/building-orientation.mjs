// The existing Complete packs have eight camera views, not eight grid footprints.
// Quarter turns preserve today's square occupancy; non-square definitions must
// supply a geometry contract before they can opt in here.
export const ROTATABLE_BUILDINGS = Object.freeze([
  'town-center', 'house', 'storehouse', 'stable', 'workshop', 'watchtower', 'barracks', 'archery-range',
  'mill', 'farm', 'dock',
]);

export function buildingCanRotate(type, definitions) {
  const size = definitions[type]?.footprint;
  return ROTATABLE_BUILDINGS.includes(type) && Number.isInteger(size) && size > 0 && size % 2 === 1;
}

// Orientation is an integer quarter turn about +Y, with the authored front at +Z.
// Omitted orientation retains the historical zero facing. Never coerce payloads.
export function validBuildingOrientation(type, value, definitions) {
  return value === undefined || Number.isInteger(value) && value >= 0
    && value < (buildingCanRotate(type, definitions) ? 4 : 1);
}

export function buildingOrientationAngle(orientation = 0) {
  return orientation * Math.PI / 2;
}

export function turnBuildingOrientation(orientation, direction) {
  return (orientation + direction + 4) % 4;
}

export function buildingEntranceDirection(orientation = 0) {
  return [[0, 1], [1, 0], [0, -1], [-1, 0]][orientation];
}

// Rank the existing legal perimeter cells from the rotated front threshold.
// The caller retains walkability, elevation/component and occupancy authority.
// No entrance-only collision or door animation is invented by this preference.
export function orderedBuildingExitCells(building, cells, width, height) {
  const [dx, dz] = buildingEntranceDirection(building.orientation);
  const column = Math.floor(building.x + width / 2);
  const row = Math.floor(building.z + height / 2);
  const front = Math.max(...building.footprint.map(cell =>
    ((cell % width) - column) * dx + (Math.floor(cell / width) - row) * dz)) + 1;
  const targetColumn = column + dx * front, targetRow = row + dz * front;
  const distance = cell => ((cell % width) - targetColumn) ** 2 + (Math.floor(cell / width) - targetRow) ** 2;
  return [...cells].sort((a, b) => distance(a) - distance(b) || a - b);
}

// An exit must be locally reachable from a side of the reserved footprint.
// A remote ramp joining global components cannot legalize a cliff threshold.
export function legalBuildingExitCells(footprint, access, width, canCross) {
  const occupied = new Set(footprint);
  return access.filter(cell => [cell - width, cell + width,
    ...(cell % width > 0 ? [cell - 1] : []), ...(cell % width < width - 1 ? [cell + 1] : [])]
    .some(inside => occupied.has(inside) && canCross(inside, cell)));
}

// Occupied thresholds may spill to nearby reachable cells. Walk the actual
// legal edges, instead of jumping a cliff to a globally connected free cell.
export function nearbyBuildingExitCell(starts, occupied, width, canTraverse, maxSteps = 4) {
  const seen = new Set(starts), queue = starts.map(cell => ({ cell, steps: 0 }));
  for (const { cell, steps } of queue) {
    if (!occupied.has(cell)) return cell;
    if (steps >= maxSteps) continue;
    for (const next of [cell - width, cell + width,
      ...(cell % width > 0 ? [cell - 1] : []), ...(cell % width < width - 1 ? [cell + 1] : [])]) {
      if (!seen.has(next) && canTraverse(cell, next)) {
        seen.add(next); queue.push({ cell: next, steps: steps + 1 });
      }
    }
  }
  return -1;
}
