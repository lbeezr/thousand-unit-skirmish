import { GAMEPLAY_DEFINITIONS } from './gameplay-definitions.mjs';

/** Derive a legal production choice without spending or querying private world geometry. */
export function productionAction(building, kind, state, definitions = GAMEPLAY_DEFINITIONS) {
  const unit = Object.hasOwn(definitions.units, kind) ? definitions.units[kind] : null;
  const producer = definitions.buildings[building?.type];
  const missingPrerequisites = (unit?.requires || []).filter((id) => !state.upgrades?.[definitions.technologies[id].upgradeKey]);
  const reason = !unit ? 'UNKNOWN UNIT TYPE'
    : !building || building.team !== state.team || !building.complete || !producer?.products.includes(kind)
      ? 'SELECT A COMPLETED BUILDING THAT PRODUCES THIS UNIT'
    : state.matchOver ? 'MATCH FINISHED'
    : building.queue >= state.queueLimit ? `QUEUE FULL ${state.queueLimit}/${state.queueLimit}`
    : state.seatUnits + state.seatReservedUnits >= state.seatLimit
      || state.totalUnits + state.totalReservedUnits >= state.totalLimit ? 'UNIT CAP REACHED'
    : missingPrerequisites.length ? `REQUIRES ${missingPrerequisites.map((id) => definitions.technologies[id].label).join(' + ')}`
    : state.populationAvailable < unit.population ? 'POPULATION FULL · BUILD A HOUSE'
    : state.food + 1e-9 < unit.cost.food || state.wood + 1e-9 < unit.cost.wood
      ? `NEED ${unit.cost.food} FOOD + ${unit.cost.wood} WOOD`
    : building.productionBlocked ? 'NO SPAWN ROOM' : '';
  return {
    type: 'trainUnit', buildingId: building?.id ?? null, kind,
    cost: unit ? { ...unit.cost } : null, trainSeconds: unit?.trainSeconds ?? 0,
    population: unit?.population ?? 0, missingPrerequisites,
    available: !reason, reason,
  };
}
