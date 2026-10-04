// Terrain discovery only. Candidates already passed the source's sight-radius
// bounds and were occluded by a forest as their first LOS blocker. Never use
// the returned cells for current visibility, targeting or stock disclosure.
export function exploredForestFringe(visibleCells, candidates, forestCells, columns) {
  const seenForest = new Set();
  for (const cell of visibleCells) if (forestCells[cell]) seenForest.add(cell);
  const fringe = [];
  for (const cell of candidates) {
    const column = cell % columns;
    const row = Math.floor(cell / columns);
    let adjacent = false;
    for (let dz = -1; dz <= 1 && !adjacent; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const neighborColumn = column + dx;
        if (neighborColumn < 0 || neighborColumn >= columns || row + dz < 0) continue;
        if (seenForest.has((row + dz) * columns + neighborColumn)) {
          adjacent = true;
          break;
        }
      }
    }
    if (adjacent) fringe.push(cell);
  }
  // This is intentionally one nonrecursive ring around LOS-visible forest.
  return Uint32Array.from(fringe);
}
