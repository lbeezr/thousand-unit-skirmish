import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { compressGroundLevels } from '../src/terrain-authoring.mjs';

export const MEDIUM_LAYOUT = Object.freeze({
  side: 224, homes: [[25, 112], [198, 112]],
  expansions: [[55, 63], [75, 151], [64, 194], [168, 63], [148, 151], [159, 194]],
  crossings: [[78, 95], [129, 146], [176, 193]], flank: [26, 39],
  ridgeColumns: [88, 135],
});

export async function generateRivenEscarpment() {
  const width = 224, height = 224, size = width * height;
  const levels = new Uint8Array(size), forest = new Uint8Array(size), paint = new Uint8Array(size);
  const materials = ['scree', 'short-grass', 'dry-grass', 'dirt', 'meadow'];
  const inside = (x, y, cx, cy, radius) => Math.abs(x - cx) <= radius && Math.abs(y - cy) <= radius;
  const roads = [[25, 112, 55, 63], [25, 112, 75, 151], [75, 151, 64, 194], [37, 170, 64, 194]];
  const nearRoad = (x, y, [ax, ay, bx, by]) => {
    const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
    return Math.hypot(x - ax - t * (bx - ax), y - ay - t * (by - ay)) <= 3;
  };
  for (let row = 0; row < height; row++) for (let column = 0; column < width; column++) {
    const cell = row * width + column, outer = Math.min(column, width - 1 - column);
    levels[cell] = outer < 76 ? 1 : 0;
    if (((outer - 40) / 37) ** 2 + ((row - 25) / 28) ** 2 <= 1
      || ((outer - 44) / 42) ** 2 + ((row - 197) / 26) ** 2 <= 1) levels[cell] = 2;
    // Twin escarpments enclose a usable low rift, with explicit crossings.
    if (outer >= 83 && outer <= 96 + Math.floor(2 * Math.sin(row / 17))) levels[cell] = 2;
    const lowPass = (row >= 78 && row <= 95) || (row >= 129 && row <= 146);
    const raisedCrossing = (row >= 176 && row <= 193) || (row >= 26 && row <= 39);
    if (lowPass && outer >= 76) levels[cell] = 0;
    if (raisedCrossing && outer >= 76) levels[cell] = 1;
    // Ramp shoulders are on the far side of each low pass, avoiding a short
    // one-cell shortcut next to the nearest approach from the homes.
    if ([77, 147].includes(row) && outer >= 83 && outer <= 98) levels[cell] = 1;
    const ridgeRamp = row >= 104 && row <= 119 && outer >= 70 && outer <= 84;
    if (ridgeRamp) levels[cell] = 1;
    paint[cell] = levels[cell] === 0 ? 1 : levels[cell] === 1 ? 2 : 0;
    for (const [cx, cy, rx, ry] of [[29, 49, 21, 19], [61, 96, 18, 16], [45, 154, 18, 17],
      [32, 189, 18, 19], [77, 211, 12, 10], [20, 13, 12, 9]]) {
      if (((outer - cx) / rx) ** 2 + ((row - cy) / ry) ** 2 < 1 + .06 * Math.sin(row * .7 + outer * .4)) forest[cell] = 1;
    }
    if (roads.some(road => nearRoad(outer, row, road))) { forest[cell] = 0; paint[cell] = 3; }
    if (ridgeRamp) { forest[cell] = 0; paint[cell] = 3; }
    if (MEDIUM_LAYOUT.homes.some(([cx, cy]) => inside(column, row, cx, cy, 24))) {
      levels[cell] = 1; paint[cell] = 4; forest[cell] = 0;
    }
    for (const [cx, cy] of MEDIUM_LAYOUT.expansions) {
      if (inside(column, row, cx, cy, 11)) forest[cell] = 0;
      if (inside(column, row, cx, cy, 9)) { levels[cell] = cy === 194 ? 2 : cy === 151 ? 0 : 1; paint[cell] = 4; }
    }
    if (lowPass || raisedCrossing) {
      forest[cell] = 0;
      if (outer >= 40 && row % 17 >= 4 && row % 17 <= 10) paint[cell] = 3;
    }
  }
  const resources = [];
  for (const [team, sign] of [[0, -1], [1, 1]]) for (const [id, column, row, type, stock] of [
    ['home-food', 31, 118, 'food', 650], ['home-wood', 31, 106, 'wood', 975],
    ['shelf-food', 47, 63, 'food', 1000], ['shelf-wood', 63, 63, 'wood', 1500],
    ['rift-food', 67, 151, 'food', 1800], ['rift-wood', 83, 151, 'wood', 2000],
    ['crown-food', 56, 194, 'food', 2200], ['crown-wood', 72, 194, 'wood', 2500],
  ]) resources.push({ id: `s${team}-${id}`, x: sign * (111.5 - column), z: row - 111.5, type, stock });
  resources.push({ id: 'rift-contested-food', x: .5, z: -24.5, type: 'food', stock: 800 },
    { id: 'causeway-contested-wood', x: .5, z: 73.5, type: 'wood', stock: 1000 });
  const audio = JSON.parse(await readFile(new URL('../maps/veyrholds-slate-saddle.json', import.meta.url))).audio;
  return {
    id: 'veyrholds-riven-escarpment', name: 'Veyrholds · Riven Escarpment', region: 'veyrholds',
    summary: 'Medium · 224 × 224 · twin escarpments, low rift, two passes and high routes · three expansion pockets per seat · elimination',
    width, height, terrainSeed: 93027, fogOfWar: true, terrainBase: 'scree',
    terrainPatches: compressGroundLevels(paint, width, height).map(({ level, ...rect }) => ({ ...rect, material: materials[level] })),
    elevationPatches: compressGroundLevels(levels, width, height),
    spawnPoints: [{ team: 0, x: -86.5, z: .5 }, { team: 1, x: 86.5, z: .5 }],
    startingArmySize: 24, startingResources: { food: 150, wood: 250 },
    obstacles: compressGroundLevels(forest, width, height).map(({ level, ...rect }) => ({ ...rect, material: 'forest' })),
    resourceNodes: resources, triggers: [], scenarioEvents: [], victoryMode: 'any', audio,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const map = await generateRivenEscarpment();
  const fields = Object.entries(map).map(([key, value]) => `  ${JSON.stringify(key)}: `
    + (Array.isArray(value) && value.length ? `[\n${value.map(row => `    ${JSON.stringify(row)}`).join(',\n')}\n  ]` : JSON.stringify(value)));
  await writeFile(new URL('../maps/veyrholds-riven-escarpment.json', import.meta.url), `{\n${fields.join(',\n')}\n}\n`);
  console.log('Generated one authored Medium 224 layout.');
}
