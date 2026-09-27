export const RESOURCE_VISUAL_STAGES = Object.freeze(['full', 'worked', 'low', 'depleted']);
const FALLBACK_STAGE_SCALES = Object.freeze({ full: 1, worked: 0.84, low: 0.62, depleted: 0.22 });

export function resourceVisualStage(stock, startingStock) {
  const amount = Number.isFinite(stock) ? stock : 0;
  const initial = Number.isFinite(startingStock) && startingStock > 0 ? startingStock : 0;
  const percent = initial > 0 ? Math.floor(Math.max(0, Math.min(amount / initial, 1)) * 100) : 0;
  if (percent >= 67) return 'full';
  if (percent >= 34) return 'worked';
  if (percent > 0) return 'low';
  return 'depleted';
}

export function resourceVisualTransitionStages(previousStage, currentStage) {
  if (previousStage === currentStage) return [];
  const stages = [];
  if (RESOURCE_VISUAL_STAGES.includes(previousStage)) stages.push(previousStage);
  if (RESOURCE_VISUAL_STAGES.includes(currentStage)) stages.push(currentStage);
  return stages;
}

// These restrained size cues keep the generic base sprite usable until the
// manifest-backed stage art is available. They are not an art-pack preview.
export function resourceVisualScale(stage) {
  return FALLBACK_STAGE_SCALES[stage] || FALLBACK_STAGE_SCALES.depleted;
}
