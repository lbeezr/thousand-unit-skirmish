function queueLength(queue) {
  if (Array.isArray(queue)) return queue.length;
  if (Number.isFinite(queue)) return Math.max(0, Math.floor(queue));
  return 0;
}

export function getBuildingProductionCueState(building) {
  if (!building || building.complete !== true || queueLength(building.queue) <= 0) return 'hidden';
  return building.productionBlocked === true ? 'blocked' : 'active';
}
