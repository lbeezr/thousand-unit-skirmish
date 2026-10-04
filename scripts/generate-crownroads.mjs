import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { compressGroundLevels } from '../src/terrain-authoring.mjs';

export const LARGE_LAYOUT = Object.freeze({
  side: 256, homes: [[27, 128], [228, 128]],
  sites: [[62, 83, 1, 'shelf'], [91, 44, 2, 'crown'], [82, 180, 0, 'basin'], [70, 221, 1, 'causeway']],
  crossings: [[84, 103], [153, 172], [212, 231]], flank: [24, 39], ridgeColumns: [101, 154],
});

export async function generateCrownroads() {
  const width = 256, height = 256, size = width * height;
  const levels = new Uint8Array(size), forest = new Uint8Array(size), paint = new Uint8Array(size);
  const materials = ['scree', 'short-grass', 'dry-grass', 'dirt', 'meadow'];
  const inside = (x, y, cx, cy, r) => Math.abs(x - cx) <= r && Math.abs(y - cy) <= r;
  const roads = [[27, 128, 62, 83], [62, 83, 91, 44], [27, 128, 82, 180],
    [82, 180, 70, 221], [44, 222, 70, 221], [37, 199, 70, 221]];
  const nearRoad = (x, y, [ax, ay, bx, by]) => {
    const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
    return Math.hypot(x - ax - t * (bx - ax), y - ay - t * (by - ay)) <= 3;
  };
  for (let row = 0; row < height; row++) for (let column = 0; column < width; column++) {
    const cell = row * width + column, outer = Math.min(column, width - 1 - column);
    levels[cell] = outer < 88 ? 1 : 0;
    if (((outer - 68) / 39) ** 2 + ((row - 37) / 30) ** 2 <= 1
      || ((outer - 43) / 40) ** 2 + ((row - 239) / 18) ** 2 <= 1) levels[cell] = 2;
    // Two crown ridges flank a usable basin. Inner two-level cliffs make
    // passes consequential; the outer ramps reach the ridge without a shortcut.
    if (outer >= 96 && outer <= 111 + Math.floor(2 * Math.sin(row / 19))) levels[cell] = 2;
    const lowPass = (row >= 84 && row <= 103) || (row >= 153 && row <= 172);
    const raisedCrossing = (row >= 212 && row <= 231) || (row >= 24 && row <= 39);
    if (lowPass && outer >= 88) levels[cell] = 0;
    if (raisedCrossing && outer >= 88) levels[cell] = 1;
    if ([83, 173].includes(row) && outer >= 96 && outer <= 113) levels[cell] = 1;
    const ridgeRamp = row >= 120 && row <= 135 && outer >= 82 && outer <= 97;
    if (ridgeRamp) levels[cell] = 1;
    paint[cell] = levels[cell] === 0 ? 1 : levels[cell] === 1 ? 2 : 0;
    for (const [cx, cy, rx, ry] of [[25, 49, 19, 23], [57, 108, 19, 19], [43, 177, 21, 24],
      [34, 220, 20, 20], [83, 242, 15, 11], [20, 12, 12, 9], [73, 23, 18, 13]]) {
      if (((outer - cx) / rx) ** 2 + ((row - cy) / ry) ** 2 < 1 + .06 * Math.sin(row * .7 + outer * .4)) forest[cell] = 1;
    }
    if (roads.some(road => nearRoad(outer, row, road)) || ridgeRamp) { forest[cell] = 0; paint[cell] = 3; }
    if (LARGE_LAYOUT.homes.some(([cx, cy]) => inside(column, row, cx, cy, 26))) {
      levels[cell] = 1; paint[cell] = 4; forest[cell] = 0;
    }
    for (const [cx, cy, level] of LARGE_LAYOUT.sites) {
      if (inside(outer, row, cx, cy, 11)) forest[cell] = 0;
      if (inside(outer, row, cx, cy, 9)) { levels[cell] = level; paint[cell] = 4; }
    }
    if (lowPass || raisedCrossing) {
      forest[cell] = 0;
      if (outer >= 44 && row % 19 >= 4 && row % 19 <= 11) paint[cell] = 3;
    }
  }
  const resources = [];
  for (const [team, sign] of [[0, -1], [1, 1]]) for (const [id, column, row, type, stock] of [
    ['home-food', 33, 134, 'food', 650], ['home-wood', 33, 122, 'wood', 975],
    ['shelf-food', 54, 83, 'food', 1400], ['shelf-wood', 70, 83, 'wood', 1800],
    ['crown-food', 83, 44, 'food', 2500], ['crown-wood', 99, 44, 'wood', 3000],
    ['basin-food', 74, 180, 'food', 2200], ['basin-wood', 90, 180, 'wood', 2500],
    ['causeway-food', 62, 221, 'food', 2600], ['causeway-wood', 78, 221, 'wood', 3200],
  ]) resources.push({ id: `s${team}-${id}`, x: sign * (127.5 - column), z: row - 127.5, type, stock });
  resources.push({ id: 'north-pass-contested-food', x: .5, z: -34.5, type: 'food', stock: 1000 },
    { id: 'causeway-contested-wood', x: .5, z: 94.5, type: 'wood', stock: 1200 });
  const audio = JSON.parse(await readFile(new URL('../maps/veyrholds-slate-saddle.json', import.meta.url))).audio;
  return {
    id: 'veyrholds-crownroads', name: 'Veyrholds · Crownroads', region: 'veyrholds',
    summary: 'Large · 256 × 256 · crown ridges and four routes · four expansion pockets per seat · elimination',
    width, height, terrainSeed: 104031, fogOfWar: true, terrainBase: 'scree',
    terrainPatches: compressGroundLevels(paint, width, height).map(({ level, ...rect }) => ({ ...rect, material: materials[level] })),
    elevationPatches: compressGroundLevels(levels, width, height),
    spawnPoints: [{ team: 0, x: -100.5, z: .5 }, { team: 1, x: 100.5, z: .5 }],
    startingArmySize: 24, startingResources: { food: 150, wood: 250 },
    obstacles: compressGroundLevels(forest, width, height).map(({ level, ...rect }) => ({ ...rect, material: 'forest' })),
    resourceNodes: resources, triggers: [], scenarioEvents: [], victoryMode: 'any', audio,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const map = await generateCrownroads();
  const fields = Object.entries(map).map(([key, value]) => `  ${JSON.stringify(key)}: `
    + (Array.isArray(value) && value.length ? `[\n${value.map(row => `    ${JSON.stringify(row)}`).join(',\n')}\n  ]` : JSON.stringify(value)));
  await writeFile(new URL('../maps/veyrholds-crownroads.json', import.meta.url), `{\n${fields.join(',\n')}\n}\n`);
  console.log('Generated one authored Large 256 layout.');
}
