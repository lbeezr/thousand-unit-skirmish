import { createWaterRouteGraph, canTraverseWaterEdge } from './water-route-graph.mjs';
import { waterRaster } from './water-contours.mjs';
import { buildElevationGrid } from './map-utils.mjs';

// This land foundation reserves no pier or boat. Rebuild with current water
// reservations before a future producer admits a vessel to the derived berth.
export function createDockPlacementContext(definition, buildingDefinition, { reservedCells = [] } = {}) {
  const profile = buildingDefinition?.placement;
  if (buildingDefinition?.footprint !== 3 || profile?.kind !== 'shoreline'
    || profile.waterClearanceCells !== 1) throw new TypeError('Unsupported Dock placement profile');
  const graph = createWaterRouteGraph(definition, { reservedCells, clearanceCells: profile.waterClearanceCells });
  const wet = waterRaster(definition);
  const levels = buildElevationGrid(graph.width, graph.height, definition.elevationPatches);
  const directions = [['north', 0, -1], ['east', 1, 0], ['south', 0, 1], ['west', -1, 0]];
  const cellAt = (column, row) => column >= 0 && row >= 0 && column < graph.width && row < graph.height
    ? row * graph.width + column : -1;
  return Object.freeze({
    accessAt(centerCell) {
      if (!Number.isInteger(centerCell) || centerCell < 0 || centerCell >= graph.cellCount) {
        return { valid: false, reason: 'INVALID DOCK CENTER' };
      }
      const column = centerCell % graph.width, row = Math.floor(centerCell / graph.width);
      // Other terrain, resources, units, buildings and Worker reachability remain
      // the ordinary authoritative land-placement caller's responsibility.
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const cell = cellAt(column + dx, row + dz);
        if (cell < 0 || wet[cell] || levels[cell] !== 0) {
          return { valid: false, reason: 'DOCK NEEDS LEVEL-ZERO LAND' };
        }
      }
      for (const [side, dx, dz] of directions) {
        const spawnCell = cellAt(column + dx * 3, row + dz * 3);
        const exitCell = cellAt(column + dx * 4, row + dz * 4);
        if (!graph.isNavigable(spawnCell) || !graph.isNavigable(exitCell)) continue;
        if (!canTraverseWaterEdge(graph, spawnCell, exitCell)) continue;
        const spawnFootprint = [];
        const spawnColumn = spawnCell % graph.width, spawnRow = Math.floor(spawnCell / graph.width);
        for (let z = -1; z <= 1; z++) for (let x = -1; x <= 1; x++) {
          spawnFootprint.push(cellAt(spawnColumn + x, spawnRow + z));
        }
        return { valid: true, side, spawnCell, exitCell, spawnFootprint,
          route: [spawnCell, exitCell], waterComponent: graph.componentAt(spawnCell) };
      }
      return { valid: false, reason: 'DOCK NEEDS CLEAR WATER BERTH' };
    },
  });
}
