import { UNIT_DEFINITIONS } from './gameplay-definitions.mjs';

export const SKIFF_GROUP_ORDER_LIMIT = 16;
const PLANNING_BUDGET = 16384;
const validSelection = selected => selected.length > 0 && selected.length <= SKIFF_GROUP_ORDER_LIMIT
  && selected.every(unit => unit.hp > 0 && unit.kind === 'skiff' && unit.movementDomain === 'water' && unit.team === selected[0].team)
  && new Set(selected.map(unit => unit.id)).size === selected.length;
const optionsFor = selected => ({ ignoredGoalIds: new Set(selected.map(unit => unit.id)),
  reservedGoalCells: new Set(), forbiddenGoalCells: new Set(), budget: { remaining: PLANNING_BUDGET } });
const reserve = (options, route) => {
  options.reservedGoalCells.add(route.cells.at(-1));
  for (const cell of route.cells) { options.forbiddenGoalCells.add(cell); options.reservedTransitCells?.add(cell); }
};
const ordered = selected => [...selected].sort((a, b) => a.id - b.id);

// Preflight the whole controlled selection. The caller commits only a found
// result; no actor, cargo, order or source stock is mutated by these planners.
export function planSkiffGroupMove(water, selected, x, z, units) {
  if (!validSelection(selected)) return { status: 'invalid-skiff-group', assignments: [] };
  const graph = water.graph, target = graph.cellAt(x, z);
  if (!Number.isFinite(x) || !Number.isFinite(z) || !graph.isNavigable(target)) return { status: 'invalid-endpoints', assignments: [] };
  if (selected.some(unit => graph.componentAt(graph.cellAt(unit.x, unit.z)) !== graph.componentAt(target))) return { status: 'disconnected', assignments: [] };
  const column = target % graph.width, row = Math.floor(target / graph.width), candidates = [];
  const radius = selected.length === 1 ? 0 : 4;
  for (let dz = -radius; dz <= radius; dz++) for (let dx = -radius; dx <= radius; dx++) {
    const c = column + dx, r = row + dz, cell = r * graph.width + c;
    if (c >= 0 && c < graph.width && r >= 0 && r < graph.height && graph.isNavigable(cell)
      && graph.componentAt(cell) === graph.componentAt(target)) candidates.push({ cell, distance: dx * dx + dz * dz });
  }
  candidates.sort((a, b) => a.distance - b.distance || a.cell - b.cell);
  const options = optionsFor(selected), assignments = [];
  for (const unit of ordered(selected)) {
    const occupied = new Set(water.reservations(units, unit));
    let found = null;
    for (const { cell } of candidates) {
      if (occupied.has(cell) || options.reservedGoalCells.has(cell)) continue;
      if (options.budget.remaining <= 0) break;
      const point = graph.pointAt(cell), route = water.planReserved(unit, point.x, point.z, units,
        { ...options, maxExpandedCells: Math.min(4096, graph.cellCount, options.budget.remaining) });
      options.budget.remaining -= route.expandedCells;
      if (route.status === 'found') { found = route; break; }
    }
    if (!found) return { status: options.budget.remaining <= 0 ? 'budget-exhausted' : 'no-distinct-routes', assignments: [] };
    reserve(options, found); assignments.push({ unit, route: found });
  }
  return { status: 'found', assignments };
}

export function planSkiffGroupFishing(fishing, selected, node, buildings, units) {
  if (!validSelection(selected)) return { status: 'invalid-skiff-group', assignments: [] };
  const options = { ...optionsFor(selected), reservedTransitCells: new Set() }, assignments = [];
  for (const unit of ordered(selected)) {
    const fish = fishing.fishRoute(unit, node, units, options);
    const delivery = fishing.deliveryRoute(unit, buildings, units, options);
    if (!fish || !delivery) return { status: 'need-distinct-fish-and-owned-dock-routes', assignments: [] };
    const phase = unit.cargo >= UNIT_DEFINITIONS.skiff.fishing.carryCapacity ? 'to-base' : 'to-node';
    const route = phase === 'to-base' ? delivery : fish;
    reserve(options, route); assignments.push({ unit, route, phase, nodeId: node.id });
  }
  return { status: 'found', assignments };
}

export function planSkiffGroupReturn(fishing, selected, buildings, units) {
  if (!validSelection(selected)) return { status: 'invalid-skiff-group', assignments: [] };
  const carrying = selected.filter(unit => unit.cargo > 0 && unit.cargoType === 'food');
  if (!carrying.length) return { status: 'no-food-cargo', assignments: [] };
  const options = { ...optionsFor(carrying), reservedTransitCells: new Set() }, assignments = [];
  // Let the nearest delivery route leave first. Routing a farther boat around
  // a nearer boat can otherwise reserve every exit of the nearer boat, even
  // when this small group has disjoint berth routes in the opposite order.
  const candidates = [];
  for (const unit of ordered(carrying)) {
    const route = fishing.deliveryRoute(unit, buildings, units, options);
    if (!route) return { status: 'need-distinct-owned-dock-routes', assignments: [] };
    candidates.push({ unit, route });
  }
  candidates.sort((a, b) => a.route.cells.length - b.route.cells.length || a.unit.id - b.unit.id);
  for (const [index, candidate] of candidates.entries()) {
    const { unit } = candidate;
    const route = index === 0 ? candidate.route : fishing.deliveryRoute(unit, buildings, units, options);
    if (!route) return { status: 'need-distinct-owned-dock-routes', assignments: [] };
    reserve(options, route); assignments.push({ unit, route, phase: 'to-base', nodeId: null });
  }
  return { status: 'found', assignments: assignments.sort((a, b) => a.unit.id - b.unit.id) };
}
