import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { compressGroundLevels } from '../src/terrain-authoring.mjs';

// A proposed ordinary XL layout, retained outside maps/ until runtime admission
// and the ordinary-entry/native/rendered gates pass. This is not a resize.
export const XL_LAYOUT = Object.freeze({
  side: 320, homes: [[31, 160], [288, 160]], homeRadius: 28,
  sites: [[74, 109, 1, 'shelf'], [107, 40, 2, 'crown'], [96, 241, 0, 'basin'],
    [65, 290, 1, 'causeway'], [37, 47, 1, 'outer-march']],
  crossings: [[124, 145], [194, 215], [265, 280], [40, 55]],
  ridgeColumns: [133, 186],
});

export async function generateFarMarches() {
  const width = XL_LAYOUT.side, height = width, size = width * height, half = (width - 1) / 2;
  const levels = new Uint8Array(size), forest = new Uint8Array(size), paint = new Uint8Array(size);
  const materials = ['scree', 'short-grass', 'dry-grass', 'dirt', 'meadow'];
  const inside = (x, y, cx, cy, radius) => Math.abs(x - cx) <= radius && Math.abs(y - cy) <= radius;
  const roads = [[31, 160, 74, 109], [74, 109, 107, 40], [31, 160, 96, 241],
    [96, 241, 65, 290], [37, 47, 74, 109], [31, 160, 37, 47]];
  const nearRoad = (x, y, [ax, ay, bx, by]) => {
    const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
    return Math.hypot(x - ax - t * (bx - ax), y - ay - t * (by - ay)) <= 3;
  };
  for (let row = 0; row < height; row++) for (let column = 0; column < width; column++) {
    const cell = row * width + column, outer = Math.min(column, width - 1 - column);
    levels[cell] = outer < 116 ? 1 : 0;
    if (((outer - 98) / 35) ** 2 + ((row - 37) / 29) ** 2 <= 1) levels[cell] = 2;
    if (outer >= 126 && outer <= 137 + Math.floor(2 * Math.sin(row / 23))) levels[cell] = 2;
    const crossing = XL_LAYOUT.crossings.find(([first, last]) => row >= first && row <= last);
    if (crossing && outer >= 116) levels[cell] = crossing[0] < 220 && crossing[0] > 60 ? 0 : 1;
    // One-level strips connect ridge tops and shoulders without opening another
    // complete cross-basin route through a two-level inner cliff.
    if ([123, 146, 193, 216].includes(row) && outer >= 126 && outer <= 140) levels[cell] = 1;
    const ridgeRamp = row >= 154 && row <= 167 && outer >= 111 && outer <= 127;
    if (ridgeRamp) levels[cell] = 1;
    paint[cell] = levels[cell] === 0 ? 1 : levels[cell] === 1 ? 2 : 0;
    for (const [cx, cy, rx, ry] of [[22, 95, 16, 24], [67, 152, 23, 27], [30, 222, 20, 24],
      [71, 270, 18, 15], [19, 305, 13, 10], [72, 19, 19, 12], [113, 296, 17, 16]]) {
      if (((outer - cx) / rx) ** 2 + ((row - cy) / ry) ** 2 < 1 + .06 * Math.sin(row * .7 + outer * .4)) forest[cell] = 1;
    }
    if (roads.some(road => nearRoad(outer, row, road)) || ridgeRamp) { forest[cell] = 0; paint[cell] = 3; }
    if (XL_LAYOUT.homes.some(([cx, cy]) => inside(column, row, cx, cy, XL_LAYOUT.homeRadius))) {
      levels[cell] = 1; paint[cell] = 4; forest[cell] = 0;
    }
    for (const [cx, cy, level] of XL_LAYOUT.sites) {
      if (inside(outer, row, cx, cy, 11)) forest[cell] = 0;
      if (inside(outer, row, cx, cy, 9)) { levels[cell] = level; paint[cell] = 4; }
    }
    if (crossing) {
      forest[cell] = 0;
      if (outer >= 59 && row % 19 >= 4 && row % 19 <= 11) paint[cell] = 3;
    }
  }
  const resources = [];
  const nodeRows = [['home-food', 37, 166, 'food', 650], ['home-wood', 37, 154, 'wood', 975]];
  for (const [cx, cy, , id] of XL_LAYOUT.sites) {
    const [food, wood] = { shelf: [1400, 1800], crown: [2500, 3000], basin: [2200, 2500],
      causeway: [2600, 3200], 'outer-march': [1600, 2100] }[id];
    nodeRows.push([`${id}-food`, cx - 8, cy, 'food', food], [`${id}-wood`, cx + 8, cy, 'wood', wood]);
  }
  for (const team of [0, 1]) for (const [id, column, row, type, stock] of nodeRows)
    resources.push({ id: `s${team}-${id}`, x: team === 0 ? column - half : half - column, z: row - half, type, stock });
  resources.push({ id: 'north-pass-contested-food', x: .5, z: -24.5, type: 'food', stock: 1000 },
    { id: 'south-pass-contested-wood', x: .5, z: 44.5, type: 'wood', stock: 1200 });
  const audio = JSON.parse(await readFile(new URL('../maps/veyrholds-slate-saddle.json', import.meta.url))).audio;
  return {
    id: 'veyrholds-far-marches', name: 'Veyrholds · Far Marches', region: 'veyrholds',
    summary: 'XL · 320 × 320 · four ridge crossings · five expansion pockets per seat · elimination',
    width, height, terrainSeed: 104041, fogOfWar: true, terrainBase: 'scree',
    terrainPatches: compressGroundLevels(paint, width, height).map(({ level, ...rect }) => ({ ...rect, material: materials[level] })),
    elevationPatches: compressGroundLevels(levels, width, height),
    spawnPoints: [{ team: 0, x: -128.5, z: .5 }, { team: 1, x: 128.5, z: .5 }],
    startingArmySize: 24, startingResources: { food: 150, wood: 250 },
    obstacles: compressGroundLevels(forest, width, height).map(({ level, ...rect }) => ({ ...rect, material: 'forest' })),
    resourceNodes: resources, triggers: [], scenarioEvents: [], victoryMode: 'any', audio,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const map = await generateFarMarches();
  // Compact deterministic JSON also measures the actual map-publication payload.
  await writeFile(new URL('./fixtures/xl-far-marches.json', import.meta.url), `${JSON.stringify(map)}\n`);
  console.log('Generated proposed XL fixture; ordinary runtime admission remains closed.');
}
