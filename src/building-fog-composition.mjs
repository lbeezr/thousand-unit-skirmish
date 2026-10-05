import { BUILDING_DEFINITIONS } from './gameplay-definitions.mjs';

// Rendering only: remembered ground inside a live, currently disclosed owned
// footprint must not paint a dark rectangle across its building artwork.
// Keep authoritative visibility, minimap fog and unexplored cells unchanged.
export function clearOwnedBuildingFog(texturePixels, fogCells, buildings, team, columns, rows) {
  if ((team !== 0 && team !== 1) || !Array.isArray(buildings)) return;
  if (!Number.isInteger(columns) || !Number.isInteger(rows) || columns <= 0 || rows <= 0
    || texturePixels?.length !== columns * rows * 4 || fogCells?.length !== columns * rows) return;
  for (const building of buildings) {
    if (building?.team !== team || !Number.isFinite(building.hp) || building.hp <= 0
      || !Number.isFinite(building.x) || !Number.isFinite(building.z)) continue;
    // Home centers use their own offset footprint and do not have the paid
    // building's self-blocking fog hole. Do not infer their cells from the art.
    if (building.home === true || typeof building.type !== 'string'
      || !Object.hasOwn(BUILDING_DEFINITIONS, building.type)) continue;
    const size = BUILDING_DEFINITIONS[building.type].footprint;
    const half = Math.floor(size / 2);
    const centerColumn = Math.floor(building.x + columns / 2);
    const centerRow = Math.floor(building.z + rows / 2);
    if (centerColumn - half < 0 || centerColumn + half >= columns
      || centerRow - half < 0 || centerRow + half >= rows) continue;
    for (let row = centerRow - half; row <= centerRow + half; row++) {
      for (let column = centerColumn - half; column <= centerColumn + half; column++) {
        if (fogCells[row * columns + column] !== 1) continue;
        const textureOffset = ((rows - 1 - row) * columns + column) * 4;
        texturePixels[textureOffset + 3] = 0;
      }
    }
  }
}
