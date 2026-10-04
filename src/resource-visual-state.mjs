/** @typedef {'full' | 'worked' | 'low' | 'depleted'} ResourceVisualStage */

/** @type {ReadonlyArray<ResourceVisualStage>} */
export const RESOURCE_VISUAL_STAGES = Object.freeze(['full', 'worked', 'low', 'depleted']);
/** @type {Readonly<Record<ResourceVisualStage, number>>} */
const FALLBACK_STAGE_SCALES = Object.freeze({ full: 1, worked: 0.84, low: 0.62, depleted: 0.22 });

/** @param {number} stock @param {number} startingStock @returns {ResourceVisualStage} */
export function resourceVisualStage(stock, startingStock) {
  const amount = Number.isFinite(stock) ? stock : 0;
  const initial = Number.isFinite(startingStock) && startingStock > 0 ? startingStock : 0;
  const percent = initial > 0 ? Math.floor(Math.max(0, Math.min(amount / initial, 1)) * 100) : 0;
  if (percent >= 67) return 'full';
  if (percent >= 34) return 'worked';
  if (percent > 0) return 'low';
  return 'depleted';
}

/** @param {unknown} stage @returns {stage is ResourceVisualStage} */
function isResourceVisualStage(stage) {
  // Widen a readonly view for membership checking; keep the canonical list typed above.
  /** @type {ReadonlyArray<unknown>} */
  const stages = RESOURCE_VISUAL_STAGES;
  return stages.includes(stage);
}

/** @param {unknown} previousStage @param {unknown} currentStage @returns {ResourceVisualStage[]} */
export function resourceVisualTransitionStages(previousStage, currentStage) {
  if (previousStage === currentStage) return [];
  /** @type {ResourceVisualStage[]} */
  const stages = [];
  if (isResourceVisualStage(previousStage)) stages.push(previousStage);
  if (isResourceVisualStage(currentStage)) stages.push(currentStage);
  return stages;
}

// These restrained size cues keep the generic base sprite usable until the
// manifest-backed stage art is available. They are not an art-pack preview.
/** @param {ResourceVisualStage} stage @returns {number} */
export function resourceVisualScale(stage) {
  return FALLBACK_STAGE_SCALES[stage] || FALLBACK_STAGE_SCALES.depleted;
}
