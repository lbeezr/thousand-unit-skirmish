export function buildingProductionCueState(complete, queueLength, productionBlocked) {
  if (complete !== true || !Number.isFinite(queueLength) || queueLength <= 0) return 'idle';
  return productionBlocked === true ? 'blocked' : 'active';
}

export function buildingFinishedDetailsVisible(progress, complete) {
  return complete === true || (Number.isFinite(progress) && progress >= 0.9);
}
