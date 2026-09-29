import { UNIT_DEFINITIONS, BUILDING_DEFINITIONS } from './gameplay-definitions.mjs';

export function teamPopulation(state, team) {
  const used = state.units.reduce((sum, unit) => sum + (unit.team === team && unit.hp > 0
    ? UNIT_DEFINITIONS[unit.kind].population : 0), 0);
  let reserved = (state.workerProduction[team]?.queue || 0) * UNIT_DEFINITIONS.worker.population;
  let capacity = Math.max(15, Math.ceil(state.openingArmySize / 2));
  for (const building of state.buildings) {
    if (building.team !== team) continue;
    if (building.complete) capacity += BUILDING_DEFINITIONS[building.type].populationCapacity || 0;
    for (const kind of building.productionQueue) reserved += UNIT_DEFINITIONS[kind].population;
  }
  capacity = Math.min(1000, capacity);
  return { used, reserved, capacity, available: Math.max(0, capacity - used - reserved) };
}
