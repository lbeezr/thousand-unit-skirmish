// Authored four-neighbor membership is immutable: cutting trees never splits
// the forest the player chose. Live stock and visibility are separate inputs.
export function forestGatherGroups(mask, width) {
  const height = mask.length / width;
  const byCell = new Int32Array(mask.length).fill(-1), groups = [];
  for (let seed = 0; seed < mask.length; seed++) {
    if (!mask[seed] || byCell[seed] >= 0) continue;
    const group = groups.length, cells = [seed]; byCell[seed] = group;
    for (let index = 0; index < cells.length; index++) {
      const cell = cells[index], column = cell % width, row = Math.floor(cell / width);
      const neighbors = [column > 0 ? cell - 1 : -1, column + 1 < width ? cell + 1 : -1,
        row > 0 ? cell - width : -1, row + 1 < height ? cell + width : -1];
      for (const next of neighbors) if (next >= 0 && mask[next] && byCell[next] < 0) {
        byCell[next] = group; cells.push(next);
      }
    }
    groups.push(cells);
  }
  return { byCell, groups };
}

export function authoredForestAnchorCell(anchor, map) {
  if (!anchor || !Number.isFinite(anchor.x) || !Number.isFinite(anchor.z)) return -1;
  const column = Math.floor(anchor.x + map.width / 2), row = Math.floor(anchor.z + map.height / 2);
  if (column < 0 || column >= map.width || row < 0 || row >= map.height
    || anchor.x !== column - map.width / 2 + .5 || anchor.z !== row - map.height / 2 + .5) return -1;
  return map.obstacles?.some(o => o.material === 'forest' && column >= o.column && column < o.column + o.width
    && row >= o.row && row < o.row + o.height) ? row * map.width + column : -1;
}

export function visibleForestCandidates(cells, position, { visible, remaining, point, reservations }) {
  // Check disclosure before reading stock. A remembered or unknown cut must
  // not influence the destination, ordering, availability or error feedback.
  return cells.filter(cell => visible(cell) && remaining(cell) > 0)
    .map(cell => ({ cell, score: Math.hypot(point(cell).x - position.x, point(cell).z - position.z)
      + 2 * (reservations.get(cell) ?? 0) }))
    .sort((a, b) => a.score - b.score || a.cell - b.cell).map(candidate => candidate.cell);
}
