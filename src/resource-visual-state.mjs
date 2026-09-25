export const RESOURCE_VISUAL_STAGES = Object.freeze(['full', 'worked', 'low', 'depleted']);

export function resourceVisualStage(stock, startingStock) {
  const amount = Number.isFinite(stock) ? stock : 0;
  const initial = Number.isFinite(startingStock) && startingStock > 0 ? startingStock : 0;
  const percent = initial > 0 ? Math.floor(Math.max(0, Math.min(amount / initial, 1)) * 100) : 0;
  if (percent >= 67) return 'full';
  if (percent >= 34) return 'worked';
  if (percent > 0) return 'low';
  return 'depleted';
}

export function constructionGroundStage(progress, complete) {
  if (complete === true || !Number.isFinite(progress)) return 'clear';
  const amount = Math.max(0, Math.min(progress, 1));
  if (amount >= 1) return 'clear';
  return amount < 0.4 ? 'earthwork' : 'foundation';
}
