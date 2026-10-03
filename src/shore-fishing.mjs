import { buildElevationGrid } from './map-utils.mjs';

export const SHORE_FISH_VARIANT = 'shore-fish';
export const isShoreFish = node => node?.resourceVariant === SHORE_FISH_VARIANT;

// Identity survives room state/checkpoint recovery; stock is the sole lifecycle.
export function validResourceVariantState(node, definition) {
  return node.resourceVariant === definition.resourceVariant;
}

// A fish node is a land-side interaction marker for the existing finite food
// pool. Its x/z is the bank access point, never a naval destination. Call after
// ordinary map/node bounds validation; reachability remains map-utils' contract.
export function findInvalidResourceVariant(definition) {
  const variants = (definition.resourceNodes || []).filter(node => node.resourceVariant !== undefined);
  if (!variants.length) return null;
  const { width, height } = definition;
  const blocked = new Uint8Array(width * height);
  const water = new Uint8Array(width * height);
  for (const obstacle of definition.obstacles) {
    for (let row = obstacle.row; row < obstacle.row + obstacle.height; row++) {
      for (let column = obstacle.column; column < obstacle.column + obstacle.width; column++) {
        const cell = row * width + column;
        blocked[cell] = 1;
        if (obstacle.material === 'water') water[cell] = 1;
      }
    }
  }
  const levels = buildElevationGrid(width, height, definition.elevationPatches);
  for (const node of variants) {
    const fail = reason => ({ nodeId: node.id, reason });
    if (!isShoreFish(node)) return fail('unknown resource variant');
    if (node.type !== 'food' || node.wildlifeSpecies !== undefined || node.wildlifeState !== undefined) {
      return fail('shore fish requires food without wildlife lifecycle');
    }
    const column = Math.floor(node.x + width / 2);
    const row = Math.floor(node.z + height / 2);
    const cell = row * width + column;
    if (column < 0 || column >= width || row < 0 || row >= height || blocked[cell]) {
      return fail('shore fish requires an open land access cell');
    }
    if (levels[cell] !== 0) return fail('shore fish requires a level 0 bank');
    const neighbours = [column > 0 ? cell - 1 : -1, column + 1 < width ? cell + 1 : -1,
      row > 0 ? cell - width : -1, row + 1 < height ? cell + width : -1];
    if (!neighbours.some(next => next >= 0 && water[next] && levels[next] === 0)) {
      return fail('shore fish requires adjacent level 0 water');
    }
  }
  return null;
}
