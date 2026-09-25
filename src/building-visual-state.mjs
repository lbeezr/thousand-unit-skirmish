export function buildingProductionCueState(complete, queueLength, productionBlocked) {
  if (complete !== true || !Number.isFinite(queueLength) || queueLength <= 0) return 'idle';
  return productionBlocked === true ? 'blocked' : 'active';
}
