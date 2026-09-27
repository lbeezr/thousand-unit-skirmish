export function buildingProductionCueState(complete, queueLength, productionBlocked) {
  if (complete !== true || !Number.isFinite(queueLength) || queueLength <= 0) return 'idle';
  return productionBlocked === true ? 'blocked' : 'active';
}

export function buildingFinishedDetailsVisible(progress, complete) {
  return complete === true || (Number.isFinite(progress) && progress >= 0.9);
}

export function constructionGroundStage(progress, complete) {
  if (complete === true || !Number.isFinite(progress)) return 'clear';
  const amount = Math.max(0, Math.min(progress, 1));
  if (amount >= 1) return 'clear';
  return amount < 0.4 ? 'earthwork' : 'foundation';
}
