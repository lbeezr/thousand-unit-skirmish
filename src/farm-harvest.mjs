// Provisional one-planting values. Registry changes pin them in the ruleset;
// there is no environment override or implicit regrowth.
export const FARM_TUNING_PROPOSAL = Object.freeze({
  wood: 60, buildSeconds: 15, maxHp: 600, footprint: 3, foodStock: 200,
});

// ':' is forbidden in authored node IDs, keeping the two identities disjoint.
export const farmHarvestNodeId = id => `farm:${id}`;
export function farmBuildingId(nodeId) {
  if (typeof nodeId !== 'string' || !/^farm:[1-9][0-9]*$/.test(nodeId)) return null;
  const id = Number(nodeId.slice(5));
  return Number.isSafeInteger(id) ? id : null;
}

export function validFarmStock(building, definitions) {
  if (building?.type !== 'farm') return building?.harvestStock === undefined;
  const capacity = definitions.farm?.harvest?.stock;
  return Number.isFinite(building.harvestStock) && building.harvestStock >= 0
    && building.harvestStock <= capacity && (building.complete || building.harvestStock === 0)
    && building.complete === (building.progress === 1);
}

// The building is the only persisted stock owner. This ordinary food-target
// adapter shares generic harvest/cargo code without editing authored map nodes.
export function farmHarvestNode(building) {
  if (building?.type !== 'farm' || !building.complete || building.hp <= 0) return null;
  return { id: farmHarvestNodeId(building.id), type: 'food', x: building.x, z: building.z,
    sourceBuildingId: building.id, team: building.team,
    get stock() { return building.harvestStock; },
    set stock(value) { building.harvestStock = value; },
  };
}

// Manual renewal never recruits unselected or busy Workers. Cargo alone is
// eligible: construction retains it and normal Gather delivers it afterwards.
export function eligibleFarmReplantWorker(unit, team, plotId) {
  const ownPlotJob = unit?.gatherNodeId === farmHarvestNodeId(plotId)
    && ['to-node', 'gathering'].includes(unit.gatherPhase);
  return unit?.hp > 0 && unit.team === team && unit.kind === 'worker'
    && unit.movementDomain !== 'water' && !unit.holdingPosition && !unit.persistentOrder
    && !unit.attackMove && !unit.repairing && unit.buildingTargetId == null
    && !(unit.attackTargetId >= 0) && !(unit.attackBuildingTargetId >= 0)
    && !(unit.queuedWaypoints?.length > 0)
    && (!unit.workIntent || ownPlotJob)
    && (ownPlotJob || (!unit.gatherPhase && unit.gatherNodeId == null
      && !(unit.gatherForestCell >= 0) && !unit.movePlanningPending
      && !(unit.pathIndex < unit.path?.length)));
}
