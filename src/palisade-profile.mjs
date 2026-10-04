// Provisional test tuning, configurable through the shared gameplay registry.
// Changing gameplay values changes the match ruleset identity; this is not final balance.
export const PALISADE_TUNING_PROPOSAL = Object.freeze({
  cost: Object.freeze({ food: 0, wood: 15 }), buildSeconds: 5, maxHp: 300, footprint: 1,
});

export function palisadeDraftDefinition(tuning) {
  if (!tuning || Object.keys(tuning).some(k => !['cost', 'buildSeconds', 'maxHp', 'footprint'].includes(k))
    || !tuning.cost || Object.keys(tuning.cost).some(k => !['food', 'wood'].includes(k))
    || tuning.cost.food !== 0 || !Number.isFinite(tuning.cost.wood) || tuning.cost.wood < 0
    || ![tuning.buildSeconds, tuning.maxHp].every(n => Number.isFinite(n) && n > 0)
    || tuning.footprint !== 1) throw new TypeError('Explicit wood-only, one-cell palisade tuning is required.');
  return { id: 'palisade-wall', label: 'Palisade', tags: ['structure'],
    armor: { melee: 0, pierce: 0, siege: 0 }, cost: { ...tuning.cost },
    buildSeconds: tuning.buildSeconds, maxHp: tuning.maxHp, footprint: 1,
    products: [], presentation: 'building.palisade' };
}

export function palisadeConnections(cell, width, height, wallCells) {
  const column = cell % width, row = Math.floor(cell / width);
  return [['north', 0, -1], ['east', 1, 0], ['south', 0, 1], ['west', -1, 0]]
    .filter(([, dx, dz]) => column + dx >= 0 && column + dx < width
      && row + dz >= 0 && row + dz < height && wallCells.has(cell + dz * width + dx))
    .map(([direction]) => direction);
}
