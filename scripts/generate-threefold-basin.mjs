import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { compressGroundLevels } from '../src/terrain-authoring.mjs';

export const SMALL_LAYOUT = Object.freeze({
  side: 192, homes: [[25, 96], [166, 96]],
  expansions: [[49, 61], [75, 131], [73, 167], [142, 61], [116, 131], [118, 167]],
  crossings: [[73, 88], [104, 119], [145, 159]], flank: [35, 44],
});

export async function generateThreefoldBasin() {
  const width = 192, height = 192, size = width * height;
  const levels = new Uint8Array(size), forest = new Uint8Array(size), paint = new Uint8Array(size);
  const materials = ['scree', 'short-grass', 'dry-grass', 'dirt', 'meadow'];
  const inside = (x, y, cx, cy, radius) => Math.abs(x - cx) <= radius && Math.abs(y - cy) <= radius;
  for (let row = 0; row < height; row++) for (let column = 0; column < width; column++) {
    const cell = row * width + column, outer = Math.min(column, width - 1 - column);
    levels[cell] = outer < 66 ? 1 : 0;
    if (((outer - 18) / 25) ** 2 + ((row - 20) / 28) ** 2 <= 1
      || ((outer - 20) / 24) ** 2 + ((row - 174) / 21) ** 2 <= 1) levels[cell] = 2;
    if (Math.abs(column - 95.5) < 7 + Math.floor(2 * Math.sin(row / 13))) levels[cell] = 2;
    // Two valley passes; the third crossing is a raised southern causeway.
    if (((row >= 73 && row <= 87) || (row >= 105 && row <= 119)) && outer >= 66) levels[cell] = 0;
    if ([88, 104].includes(row) && column >= 82 && column <= 109) levels[cell] = 1;
    if (row >= 145 && row <= 159 && outer >= 66) levels[cell] = 1;
    if (row >= 35 && row <= 44 && column >= 82 && column <= 109) levels[cell] = 1;
    paint[cell] = levels[cell] === 0 ? 1 : levels[cell] === 1 ? 2 : 0;
    if (SMALL_LAYOUT.crossings.some(([first, last]) => row >= first + 4 && row <= last - 4)
      && column >= 34 && column <= 157) paint[cell] = 3;
    if (row >= 38 && row <= 41 && column >= 82 && column <= 109) paint[cell] = 3;
    for (const [cx, cy, rx, ry] of [[38, 28, 20, 16], [59, 143, 18, 17], [65, 51, 13, 12],
      [53, 126, 12, 14], [22, 162, 14, 11]]) {
      if (((outer - cx) / rx) ** 2 + ((row - cy) / ry) ** 2 < 1 + .06 * Math.sin(row * .7 + outer * .4)) forest[cell] = 1;
    }
    if (SMALL_LAYOUT.homes.some(([cx, cy]) => inside(column, row, cx, cy, 22))) {
      levels[cell] = 1; paint[cell] = 4; forest[cell] = 0;
    }
    for (const [cx, cy] of SMALL_LAYOUT.expansions) {
      if (inside(column, row, cx, cy, 5)) { levels[cell] = cy === 61 ? 1 : 0; paint[cell] = 4; }
      if (inside(column, row, cx, cy, 10)) forest[cell] = 0;
    }
    if (SMALL_LAYOUT.crossings.some(([first, last]) => row >= first && row <= last)
      || row >= 35 && row <= 44) forest[cell] = 0;
  }
  const resources = [];
  for (const [team, sign] of [[0, -1], [1, 1]]) for (const [id, column, row, type, stock] of [
    ['home-food', 31, 102, 'food', 650], ['home-wood', 31, 90, 'wood', 975],
    ['shelf-food', 43, 59, 'food', 1000], ['shelf-wood', 55, 59, 'wood', 1250],
    ['basin-food', 69, 132, 'food', 1400], ['basin-wood', 81, 132, 'wood', 1750],
    ['causeway-food', 67, 168, 'food', 1800], ['causeway-wood', 79, 168, 'wood', 2000],
  ]) resources.push({ id: `s${team}-${id}`, x: sign * (95.5 - column), z: row - 95.5, type, stock });
  const audio = JSON.parse(await readFile(new URL('../maps/veyrholds-slate-saddle.json', import.meta.url))).audio;
  return {
    id: 'veyrholds-threefold-basin', name: 'Veyrholds · Threefold Basin', region: 'veyrholds',
    summary: 'Small · 192 × 192 · valley passes, southern causeway and high flank · three expansion pockets per seat · elimination',
    width, height, terrainSeed: 93026, fogOfWar: true, terrainBase: 'scree',
    terrainPatches: compressGroundLevels(paint, width, height).map(({ level, ...rect }) => ({ ...rect, material: materials[level] })),
    elevationPatches: compressGroundLevels(levels, width, height),
    spawnPoints: [{ team: 0, x: -70.5, z: .5 }, { team: 1, x: 70.5, z: .5 }],
    startingArmySize: 24, startingResources: { food: 150, wood: 250 },
    obstacles: compressGroundLevels(forest, width, height).map(({ level, ...rect }) => ({ ...rect, material: 'forest' })),
    resourceNodes: resources,
    triggers: [['north-pass', 'North Pass', 76], ['south-pass', 'South Pass', 108], ['causeway', 'Timber Causeway', 147]]
      .map(([id, name, row]) => ({ id, name, type: 'capture-zone', zone: { column: 91, row, width: 10, height: 10 },
        requiredUnits: 5, captureSeconds: 9, foodReward: 75, woodReward: 50, victory: false })),
    scenarioEvents: [], victoryMode: 'any', audio,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await writeFile(new URL('../maps/veyrholds-threefold-basin.json', import.meta.url), JSON.stringify(await generateThreefoldBasin(), null, 2) + '\n');
  console.log('Generated one authored Small192 layout; no default, speed or cell changes.');
}
