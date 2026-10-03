import { createWaterRouteGraph, canTraverseWaterEdge, findWaterCellRoute, isWaterCellRouteValid } from './water-route-graph.mjs';

export const SKIFF_OCCUPANCY_RADIUS = 0.4;

// Conservative cell occupancy for the explicitly provisional 0.8-cell hull.
export function waterUnitOccupiedCells(graph, unit) {
  const cells = [];
  const minColumn = Math.floor(unit.x - SKIFF_OCCUPANCY_RADIUS + graph.width / 2);
  const maxColumn = Math.floor(unit.x + SKIFF_OCCUPANCY_RADIUS + graph.width / 2);
  const minRow = Math.floor(unit.z - SKIFF_OCCUPANCY_RADIUS + graph.height / 2);
  const maxRow = Math.floor(unit.z + SKIFF_OCCUPANCY_RADIUS + graph.height / 2);
  for (let row = minRow; row <= maxRow; row++) for (let column = minColumn; column <= maxColumn; column++) {
    if (column >= 0 && row >= 0 && column < graph.width && row < graph.height) cells.push(row * graph.width + column);
  }
  return cells;
}

export function createWaterUnitRuntime(definition) {
  const geometry = { width: definition.width, height: definition.height,
    obstacles: definition.obstacles.map(obstacle => ({ ...obstacle })),
    ...(definition.elevationPatches ? { elevationPatches: definition.elevationPatches.map(patch => ({ ...patch })) } : {}) };
  const graph = createWaterRouteGraph(geometry, { clearanceCells: 1 });
  const staticReservations = [];
  for (let cell = 0; cell < graph.cellCount; cell++) if (!graph.isNavigable(cell)) staticReservations.push(cell);
  const counts = new Uint16Array(graph.cellCount);
  const waterActors = units => units.filter(unit => unit.hp > 0 && unit.movementDomain === 'water');
  const occupiedCells = (units, except = null) => [...new Set(waterActors(units)
    .filter(unit => unit !== except).flatMap(unit => waterUnitOccupiedCells(graph, unit)))];
  return Object.freeze({
    graph,
    reservations: occupiedCells,
    plan(unit, x, z, units, maxExpandedCells = Math.min(4096, graph.cellCount)) {
      const start = graph.cellAt(unit.x, unit.z), goal = graph.cellAt(x, z);
      if (!graph.isNavigable(start) || !graph.isNavigable(goal)) return { status: 'invalid-endpoints', cells: [] };
      // Shore clearance belongs to the static mask. Expanding live reservations
      // again would strand two independently routed boats that finish adjacent.
      const reservedCells = [...new Set([...staticReservations, ...occupiedCells(units, unit)])];
      const current = createWaterRouteGraph(geometry, { reservedCells });
      return findWaterCellRoute(current, start, goal, { maxExpandedCells });
    },
    validRoute(unit) {
      const cell = graph.cellAt(unit.x, unit.z);
      if (!Array.isArray(unit.path) || !graph.isNavigable(cell) || !Number.isInteger(unit.pathIndex)
        || unit.pathIndex < 0 || unit.pathIndex > unit.path.length) return false;
      const center = graph.pointAt(cell);
      if (unit.path.length === 0) return unit.pathIndex === 0 && unit.moveGoalCell === -1
        && (Math.abs(unit.x - center.x) < 1e-7 || Math.abs(unit.z - center.z) < 1e-7);
      if (!isWaterCellRouteValid(graph, unit.path, { goalCell: unit.moveGoalCell })) return false;
      if (unit.pathIndex === unit.path.length) return cell === unit.moveGoalCell
        && Math.abs(unit.x - center.x) < 1e-7 && Math.abs(unit.z - center.z) < 1e-7;
      const next = unit.path[unit.pathIndex], target = graph.pointAt(next);
      return (cell === next || canTraverseWaterEdge(graph, cell, next))
        && (Math.abs(unit.x - target.x) < 1e-7 || Math.abs(unit.z - target.z) < 1e-7);
    },
    advance(units, seconds, speedForUnit) {
      const actors = waterActors(units);
      if (!actors.length) return false;
      counts.fill(0);
      for (const unit of actors) for (const cell of waterUnitOccupiedCells(graph, unit)) counts[cell]++;
      let changed = false;
      for (const unit of actors) {
        if (unit.holdingPosition || unit.pathIndex >= unit.path.length) continue;
        let remaining = speedForUnit(unit) * seconds;
        let blocked = false;
        while (remaining > 0 && unit.pathIndex < unit.path.length) {
          const next = unit.path[unit.pathIndex], target = graph.pointAt(next);
          const cell = graph.cellAt(unit.x, unit.z);
          if (!target || !graph.isNavigable(cell)
            || (cell !== next && !canTraverseWaterEdge(graph, cell, next))) { blocked = true; break; }
          const dx = target.x - unit.x, dz = target.z - unit.z, distance = Math.hypot(dx, dz);
          if (Math.abs(dx) > 1e-7 && Math.abs(dz) > 1e-7) { blocked = true; break; }
          if (distance < 1e-7) { unit.pathIndex++; changed = true; continue; }
          const step = Math.min(distance, remaining);
          const position = { x: unit.x + dx / distance * step, z: unit.z + dz / distance * step };
          const to = graph.cellAt(position.x, position.z);
          if (!graph.isNavigable(to) || (to !== cell && !canTraverseWaterEdge(graph, cell, to))) { blocked = true; break; }
          const oldCells = new Set(waterUnitOccupiedCells(graph, unit));
          const newCells = waterUnitOccupiedCells(graph, position);
          // Motion is axis-aligned and shorter than one cell; the union covers
          // its swept hull. Other water actors include both seats.
          if (newCells.some(occupied => counts[occupied] - (oldCells.has(occupied) ? 1 : 0) > 0)) { blocked = true; break; }
          for (const occupied of oldCells) counts[occupied]--;
          for (const occupied of newCells) counts[occupied]++;
          unit.x = position.x; unit.z = position.z;
          remaining -= step; changed = true;
          if (step === distance) unit.pathIndex++;
        }
        if (unit.waterMoveBlocked !== blocked) { unit.waterMoveBlocked = blocked; changed = true; }
        if (unit.pathIndex >= unit.path.length) {
          unit.path = []; unit.pathIndex = 0; unit.moveGoalCell = -1; changed = true;
        }
      }
      return changed;
    },
  });
}
