import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { compressGroundLevels } from '../src/terrain-authoring.mjs';

export const CONFLUENCE_LAYOUT = Object.freeze({ side: 160, homes: [[21, 80], [138, 80]],
  expansions: [[49, 35], [110, 35]], docks: [[31, 103], [128, 103]], crossings: [[59, 73], [92, 104]],
  plots: { farm: [19, 94], mill: [21, 88], watchtower: [33, 67] } });
const nearSquare = (x, y, cx, cy, r) => Math.max(Math.abs(x - cx), Math.abs(y - cy)) <= r;

export async function generateConfluenceGrounds() {
  const side = 160, size = side * side, resources = [];
  for (const team of [0, 1]) {
    const mirror = c => team ? 159 - c : c;
    const node = (id, c, r, type, stock, extra = {}) => resources.push({ id: `s${team}-${id}`,
      x: mirror(c) - 79.5, z: r - 79.5, type, stock, ...extra });
    node('berries', 29, 84, 'food', 240); node('timber', 29, 76, 'wood', 500);
    for (const [i, c, r, stock] of [[0, 28, 66, 67], [1, 34, 73, 67], [2, 30, 75, 66]]) node(`stone-${i}`, c, r, 'stone', stock);
    for (const [i, c, r] of [[0, 30, 83], [1, 31, 87], [2, 33, 84]]) node(`sheep-${i}`, c, r, 'food', 130,
      { wildlifeSpecies: 'bellweather-sheep' });
    node('shore-fish', 23, 104, 'food', 180, { resourceVariant: 'shore-fish' });
    node('expansion-food', 43, 36, 'food', 650); node('expansion-wood', 55, 36, 'wood', 850);
    node('expansion-stone', 48, 42, 'stone', 100);
  }
  resources.push({ id: 'north-ford-food', x: -.5, z: -13.5, type: 'food', stock: 500 },
    { id: 'south-ford-wood', x: -.5, z: 18.5, type: 'wood', stock: 600 });
  const terrain = new Uint8Array(size), levels = new Uint8Array(size), obstacles = new Uint8Array(size);
  for (let r = 0; r < side; r++) for (let c = 0; c < side; c++) {
    const cell = r * side + c, outer = Math.min(c, 159 - c);
    levels[cell] = c >= 70 && c <= 89 ? 0 : 1;
    if (r <= 25) levels[cell] = 2;
    if (r >= 101 && r <= 141) levels[cell] = 0;
    if (r === 142) levels[cell] = 1;
    terrain[cell] = levels[cell] === 2 ? 1 : 0;
    const river = r >= 10 && r <= 143 && Math.abs(c - 79.5) <= 5.5 + Math.floor(Math.sin(r / 12));
    const bay = ((outer - 33) / 23) ** 2 + ((r - 118) / 13) ** 2 <= 1;
    const quay = outer >= 20 && outer <= 46 && r >= 105 && r <= 111;
    const channel = c >= 32 && c <= 127 && r >= 119 + Math.floor(2 * Math.sin(Math.min(c, 159 - c) / 11)) && r <= 136;
    if (river || bay || quay || channel) { obstacles[cell] = 2; levels[cell] = 0; }
    if (CONFLUENCE_LAYOUT.crossings.some(([a, b]) => r >= a && r <= b) && c >= 63 && c <= 96) {
      obstacles[cell] = 0; levels[cell] = 0; terrain[cell] = 2;
    }
    if (!obstacles[cell]) for (const [x, y, rx, ry] of [[15, 35, 14, 17], [48, 53, 13, 10], [53, 85, 10, 13],
      [12, 145, 10, 12], [51, 150, 15, 8]]) {
      if (((outer - x) / rx) ** 2 + ((r - y) / ry) ** 2 < 1 + .05 * Math.sin(r * .3 + outer * .6)) obstacles[cell] = 1;
    }
    for (const [x, y] of CONFLUENCE_LAYOUT.homes) if (nearSquare(c, r, x, y, 20)) {
      obstacles[cell] = 0; levels[cell] = 1; terrain[cell] = 0;
    }
    for (const [x, y] of CONFLUENCE_LAYOUT.expansions) if (nearSquare(c, r, x, y, 9)) {
      obstacles[cell] = 0; levels[cell] = 1; terrain[cell] = 0;
    }
    for (const [x, y] of CONFLUENCE_LAYOUT.docks) if (nearSquare(c, r, x, y, 1)) {
      obstacles[cell] = 0; levels[cell] = 0; terrain[cell] = 2;
    }
    for (const node of resources) if (Math.hypot(c - (node.x + 79.5), r - (node.z + 79.5)) <= 3 && obstacles[cell] === 1) obstacles[cell] = 0;
    if ((r >= 63 && r <= 68 || r >= 96 && r <= 100) && c >= 40 && c <= 119 && obstacles[cell] === 0) terrain[cell] = 2;
  }
  const audio = JSON.parse(await readFile(new URL('../maps/shore-fishing.json', import.meta.url))).audio;
  return { id: 'siltmouths-confluence-grounds', name: 'Siltmouths · Confluence Grounds', region: 'siltmouths',
    summary: 'Tiny 160 · connected fishing bays, broad fords, flat campuses · paid Stone/Farm/Dock/Skiff · nearby neutral Sheep',
    width: side, height: side, terrainSeed: 93027, terrainBase: 'meadow', fogOfWar: true,
    economyProfileId: 'stone-defense-v1', startingArmySize: 24, startingResources: { food: 150, wood: 250 },
    spawnPoints: CONFLUENCE_LAYOUT.homes.map(([c, r], team) => ({ team, x: c - 79.5, z: r - 79.5 })),
    terrainPatches: compressGroundLevels(terrain, side, side).map(({ level, ...rect }) => ({ ...rect, material: ['meadow', 'dry-grass', 'dirt'][level] })),
    elevationPatches: compressGroundLevels(levels, side, side),
    obstacles: compressGroundLevels(obstacles, side, side).map(({ level, ...rect }) => ({ ...rect, material: level === 1 ? 'forest' : 'water' })),
    resourceNodes: resources, triggers: [], scenarioEvents: [], audio };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await writeFile(new URL('../maps/siltmouths-confluence-grounds.json', import.meta.url), JSON.stringify(await generateConfluenceGrounds(), null, 2) + '\n');
  console.log('Generated the authored 160 Confluence arena.');
}
