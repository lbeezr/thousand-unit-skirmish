export function buildingProductionCueState(complete, queueLength, productionBlocked) {
  if (complete !== true || !Number.isFinite(queueLength) || queueLength <= 0) return 'idle';
  return productionBlocked === true ? 'blocked' : 'active';
}

export function buildingFinishedDetailsVisible(progress, complete) {
  return complete === true || (Number.isFinite(progress) && progress >= 0.9);
}

const BARRACKS_PROGRESS_STAGES = Object.freeze(['foundation', 'frame', 'walls', 'roof']);

export function barracksModelStage(progress, complete) {
  if (complete === true) return 'complete';
  if (!Number.isFinite(progress)) return null;
  const amount = Math.max(0, Math.min(progress, 1));
  if (amount >= 1) return 'complete';
  return BARRACKS_PROGRESS_STAGES[Math.floor(amount * BARRACKS_PROGRESS_STAGES.length)];
}

export function barracksModelVisualState(progress, complete) {
  const stage = barracksModelStage(progress, complete);
  if (stage === null) return null;
  const wallsVisible = ['walls', 'roof', 'complete'].includes(stage);
  const roofVisible = ['roof', 'complete'].includes(stage);
  return {
    stage,
    frameVisible: stage === 'frame',
    wallsVisible,
    roofVisible,
    finishedDetailsVisible: buildingFinishedDetailsVisible(progress, complete),
  };
}

export function constructionGroundStage(progress, complete) {
  if (complete === true || !Number.isFinite(progress)) return 'clear';
  const amount = Math.max(0, Math.min(progress, 1));
  if (amount >= 1) return 'clear';
  return amount < 0.4 ? 'earthwork' : 'foundation';
}
