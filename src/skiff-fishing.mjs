import { UNIT_DEFINITIONS, BUILDING_DEFINITIONS } from './gameplay-definitions.mjs';
import { isShoreFish } from './shore-fishing.mjs';
import { shoreFishSitePositions } from './shore-fishing-placement.mjs';
import { createDockPlacementContext } from './dock-placement.mjs';
import { creditResourceBalance } from './economy-ledger.mjs';

const at = (unit, point) => point && Math.hypot(unit.x - point.x, unit.z - point.z) < 1e-7;
const moving = unit => unit.pathIndex < unit.path.length;
const clearRoute = unit => { unit.path = []; unit.pathIndex = 0; unit.moveGoalCell = -1; unit.waterMoveBlocked = false; };
const applyRoute = (unit, route) => {
  unit.orderRevision++; unit.path = route.cells; unit.pathIndex = 0;
  unit.moveGoalCell = route.cells.at(-1); unit.waterMoveBlocked = false;
};
const finish = unit => { clearRoute(unit); unit.gatherNodeId = null; unit.gatherPhase = ''; unit.dropoffBuildingId = null; };

// Derive boat approaches from the SAME school visual/stock as shore Workers.
// Bank x/z remains land authority. There is no authored second fish inventory.
export function createSkiffFishingContext(map, water) {
  const graph = water.graph, rules = UNIT_DEFINITIONS.skiff.fishing;
  const docks = createDockPlacementContext(map, BUILDING_DEFINITIONS.dock);
  const sites = new Map(shoreFishSitePositions(map).map(site => {
    const cell = site.water.row * map.width + site.water.column;
    const column = cell % map.width, row = Math.floor(cell / map.width);
    const candidates = [cell, column > 0 ? cell - 1 : -1, column + 1 < map.width ? cell + 1 : -1,
      row > 0 ? cell - map.width : -1, row + 1 < map.height ? cell + map.width : -1];
    return [site.nodeId, Object.freeze({ ...site, land: Object.freeze(site.land), water: Object.freeze(site.water),
      cells: Object.freeze(candidates.filter(next => graph.isNavigable(next)).sort((a, b) => a - b)) })];
  }));
  const dockCell = building => {
    if (building?.type !== 'dock' || !building.complete || !(building.hp > 0)) return -1;
    const access = docks.accessAt(graph.cellAt(building.x, building.z));
    return access.valid ? access.spawnCell : -1;
  };
  function fishRoute(unit, node, units) {
    const site = sites.get(node?.id);
    if (!isShoreFish(node) || node.type !== 'food' || !site?.cells.length) return null;
    let best = null;
    for (const cell of site.cells) {
      const point = graph.pointAt(cell), route = water.plan(unit, point.x, point.z, units);
      if (route.status === 'found' && (!best || route.cells.length < best.cells.length)) best = route;
    }
    return best;
  }
  function deliveryRoute(unit, buildings, units) {
    const component = graph.componentAt(graph.cellAt(unit.x, unit.z));
    const candidates = buildings.filter(building => building.team === unit.team)
      .map(building => ({ building, cell: dockCell(building) }))
      .filter(candidate => candidate.cell >= 0 && graph.componentAt(candidate.cell) === component)
      .sort((a, b) => {
        const pa = graph.pointAt(a.cell), pb = graph.pointAt(b.cell);
        return (pa.x - unit.x) ** 2 + (pa.z - unit.z) ** 2
          - (pb.x - unit.x) ** 2 - (pb.z - unit.z) ** 2 || a.building.id - b.building.id;
      });
    for (const { building, cell } of candidates) {
      const point = graph.pointAt(cell), route = water.plan(unit, point.x, point.z, units);
      if (route.status === 'found') return { ...route, buildingId: building.id };
    }
    return null;
  }
  const atFish = (unit, node) => sites.get(node?.id)?.cells.some(cell => at(unit, graph.pointAt(cell))) === true;
  return Object.freeze({
    siteAt: id => sites.get(id) ?? null,
    fishRoute, deliveryRoute, dockCell,
    start(unit, nodeId, phase, route) {
      unit.gatherNodeId = nodeId; unit.gatherPhase = phase; unit.repathTimer = 1;
      unit.dropoffBuildingId = phase === 'to-base' ? route.buildingId : null;
      applyRoute(unit, route);
    },
    validState(unit, nodes, buildings) {
      if (!Number.isFinite(unit.cargo) || unit.cargo < 0 || unit.cargo > rules.carryCapacity
        || unit.cargoType !== (unit.cargo > 0 ? 'food' : null) || unit.gatherForestCell !== -1) return false;
      const node = nodes.get(unit.gatherNodeId);
      if (unit.gatherNodeId !== null && (!isShoreFish(node) || !sites.get(node.id)?.cells.length
        || !sites.get(node.id).cells.some(cell => graph.componentAt(cell) === graph.componentAt(graph.cellAt(unit.x, unit.z))))) return false;
      const dock = buildings.find(building => building.id === unit.dropoffBuildingId);
      if (unit.dropoffBuildingId != null && (!dock || dock.team !== unit.team || dockCell(dock) < 0)) return false;
      if (unit.gatherPhase === '') return unit.gatherNodeId === null;
      if (unit.holdingPosition) return false;
      if (unit.gatherPhase === 'gathering') return node && atFish(unit, node) && !moving(unit) && unit.moveGoalCell === -1;
      if (unit.gatherPhase === 'to-node') return Boolean(node) && (!moving(unit) || sites.get(node.id).cells.includes(unit.moveGoalCell));
      if (unit.gatherPhase === 'to-base') return unit.cargo > 0 && (!moving(unit) || (dock && unit.moveGoalCell === dockCell(dock)));
      return false;
    },
    update({ units, nodes, buildings, teamFood }, seconds) {
      let changed = false;
      const routeTo = (unit, phase, node) => {
        unit.gatherPhase = phase; unit.repathTimer = 1;
        const route = phase === 'to-base' ? deliveryRoute(unit, buildings, units) : fishRoute(unit, node, units);
        if (route) { applyRoute(unit, route); if (phase === 'to-base') unit.dropoffBuildingId = route.buildingId; }
        else { clearRoute(unit); if (phase === 'to-base') unit.dropoffBuildingId = null; }
        changed = true;
      };
      for (const unit of units) {
        if (unit.hp <= 0 || unit.movementDomain !== 'water' || unit.gatherPhase === '') continue;
        const node = nodes.get(unit.gatherNodeId);
        unit.repathTimer = Math.max(0, unit.repathTimer - seconds);
        if (unit.gatherPhase === 'to-node') {
          if (!isShoreFish(node) || node.stock <= 0) {
            if (unit.cargo > 0) routeTo(unit, 'to-base', node); else { finish(unit); changed = true; }
          } else if (atFish(unit, node)) {
            clearRoute(unit); unit.gatherPhase = 'gathering'; changed = true;
          } else if (!moving(unit) && unit.repathTimer === 0) routeTo(unit, 'to-node', node);
        }
        if (unit.gatherPhase === 'gathering') {
          if (!isShoreFish(node) || !atFish(unit, node)) {
            if (unit.cargo > 0) routeTo(unit, 'to-base', node); else { finish(unit); changed = true; }
          } else {
            const amount = Math.min(rules.gatherRate * seconds, rules.carryCapacity - unit.cargo, node.stock);
            if (amount > 0) {
              const emptied = amount >= node.stock;
              unit.cargo = Math.min(rules.carryCapacity, unit.cargo + amount);
              unit.cargoType = 'food'; node.stock = emptied ? 0 : node.stock - amount;
              changed = true;
            }
            if (unit.cargo >= rules.carryCapacity || node.stock <= 0) {
              if (unit.cargo > 0) routeTo(unit, 'to-base', node); else { finish(unit); changed = true; }
            }
          }
        }
        if (unit.gatherPhase === 'to-base') {
          const dock = buildings.find(building => building.id === unit.dropoffBuildingId);
          const cell = dock?.team === unit.team ? dockCell(dock) : -1;
          if (cell >= 0 && at(unit, graph.pointAt(cell))) {
            teamFood[unit.team] = creditResourceBalance(teamFood[unit.team], unit.cargo);
            unit.cargo = 0; unit.cargoType = null; changed = true;
            if (isShoreFish(node) && node.stock > 0) routeTo(unit, 'to-node', node); else finish(unit);
          } else if (cell < 0 || (!moving(unit) && unit.repathTimer === 0)) {
            if (cell < 0 && (moving(unit) || unit.dropoffBuildingId !== null)) {
              clearRoute(unit); unit.dropoffBuildingId = null; changed = true;
            }
            if (unit.repathTimer === 0) routeTo(unit, 'to-base', node);
          }
        }
      }
      return changed;
    },
  });
}
