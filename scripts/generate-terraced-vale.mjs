import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { compressGroundLevels } from '../src/terrain-authoring.mjs';
import { seedTerracedValeSheep } from '../src/terraced-vale-sheep.mjs';
import { seededMirroredResourceClusters } from '../src/resource-cluster-authoring.mjs';

export async function generateTerracedVale() {
  const width = 160, height = 160;
  const levels = new Uint8Array(width * height);
  const forest = new Uint8Array(levels.length);
  const ground = new Array(levels.length).fill('scree');
  const passes = [[57, 70], [90, 103]], flanks = [[35, 42], [118, 125]];
  const campuses = [22, 137].map(column => ({ column, row: 80, radius: 20 }));
  const expansions = [[40, 58], [63, 112], [119, 58], [96, 112]];
  const inside = (x, y, cx, cy, radius) => Math.abs(x - cx) <= radius && Math.abs(y - cy) <= radius;
  for (let row = 0; row < height; row++) for (let column = 0; column < width; column++) {
    const cell = row * width + column;
    const outer = Math.min(column, width - 1 - column);
    levels[cell] = outer < 56 ? 1 : 0;
    if (((outer - 14) / 21) ** 2 + ((row - 17) / 23) ** 2 <= 1
      || ((outer - 15) / 20) ** 2 + ((row - 143) / 23) ** 2 <= 1) levels[cell] = 2;
    const ridgeHalfWidth = 6 + Math.floor(2 * Math.sin(row / 11));
    if (Math.abs(column - 79.5) < ridgeHalfWidth) levels[cell] = 2;
    if (passes.some(([first, last]) => row >= first && row <= last) && outer >= 56) levels[cell] = 0;
    if (flanks.some(([first, last]) => row >= first && row <= last) && column >= 69 && column <= 90) levels[cell] = 1;
    // Terrace lips make the central ridge between the passes reachable, too.
    if ([71, 89].includes(row) && column >= 69 && column <= 90) levels[cell] = 1;
    ground[cell] = levels[cell] === 0 ? 'short-grass' : levels[cell] === 1 ? 'dry-grass' : 'scree';
    if (passes.some(([first, last]) => row >= first + 4 && row <= last - 4) && column >= 30 && column <= 129)
      ground[cell] = 'dirt';
    if (flanks.some(([first, last]) => row >= first + 2 && row <= last - 2) && column >= 69 && column <= 90)
      ground[cell] = 'dirt';
    if (campuses.some(pad => inside(column, row, pad.column, pad.row, pad.radius))) ground[cell] = 'meadow';
    for (const [cx, cy, rx, ry] of [[30, 25, 16, 13], [49, 126, 19, 19], [60, 37, 11, 10], [52, 112, 10, 10]]) {
      const contour = ((outer - cx) / rx) ** 2 + ((row - cy) / ry) ** 2;
      const edge = 1 + 0.06 * Math.sin(row * 0.7 + outer * 0.4);
      if (contour < edge) forest[cell] = 1;
    }
    // Reserve whole working regions, expansion pads and the four approach lanes.
    if (campuses.some(pad => inside(column, row, pad.column, pad.row, pad.radius))
      || expansions.some(([cx, cy]) => inside(column, row, cx, cy, 8))
      || passes.some(([first, last]) => row >= first && row <= last)
      || flanks.some(([first, last]) => row >= first && row <= last)) forest[cell] = 0;
  }
  const rectangles = (values, label) => {
    const result = [];
    for (let row = 0; row < height; row++) for (let column = 0; column < width;) {
      const value = values[row * width + column]; let end = column + 1;
      while (end < width && values[row * width + end] === value) end++;
      if (value && value !== 'scree') result.push({ column, row, width: end - column, height: 1, [label]: value });
      column = end;
    }
    return result;
  };
  const resourceNodes = [];
  for (const [team, sign] of [[0, -1], [1, 1]]) {
    for (const [id, x, z, type, stock] of [
      ['home-food', 51.5, 6.5, 'food', 650], ['home-wood', 51.5, -5.5, 'wood', 975],
      ['terrace-food', 43.5, -21.5, 'food', 1000], ['terrace-wood', 35.5, -21.5, 'wood', 1250],
      ['valley-food', 20.5, 32.5, 'food', 1400], ['valley-wood', 12.5, 32.5, 'wood', 1750],
    ]) resourceNodes.push({ id: `s${team}-${id}`, x: sign * x, z, type, stock });
  }
  const audio = JSON.parse(await readFile(new URL('../maps/veyrholds-slate-saddle.json', import.meta.url))).audio;
  const map = {
    id: 'veyrholds-terraced-vale', name: 'Veyrholds · Terraced Vale', region: 'veyrholds',
    summary: 'Tiny · 160 × 160 · broad passes, high flanks and expansion shelves · elimination; bonus-only posts',
    width, height, terrainSeed: 93025, fogOfWar: true, terrainBase: 'scree',
    terrainPatches: rectangles(ground, 'material'), elevationPatches: compressGroundLevels(levels, width, height),
    spawnPoints: [{ team: 0, x: -57.5, z: 0.5 }, { team: 1, x: 57.5, z: 0.5 }],
    startingArmySize: 24, startingResources: { food: 150, wood: 250 },
    obstacles: rectangles(forest, 'material').map(rect => ({ ...rect, material: 'forest' })), resourceNodes: seedTerracedValeSheep(resourceNodes),
    triggers: [
      { id: 'north-pass', name: 'North Pass', type: 'capture-zone',
        zone: { column: 75, row: 59, width: 10, height: 10 },
        requiredUnits: 5, captureSeconds: 9, foodReward: 75, woodReward: 50, victory: false },
      { id: 'south-pass', name: 'South Pass', type: 'capture-zone',
        zone: { column: 75, row: 92, width: 10, height: 10 },
        requiredUnits: 5, captureSeconds: 9, foodReward: 75, woodReward: 50, victory: false },
    ],
    scenarioEvents: [], victoryMode: 'any', audio,
  };
  // A small registered grove lets the existing Wood job continue locally.
  // Redistribute the opening budget; retain original anchors and expansion intent.
  const groves = seededMirroredResourceClusters(map, {
    seed: map.terrainSeed, nodesPerPatch: 3, radius: 4, spawnClearance: 6,
    patches: [{ type: 'wood', x: -51.5, z: -5.5, stock: 975 }],
  }).map(node => ({ ...node, id: node.id.replace(/-0(?=-|$)/, '-home-wood') }));
  const anchors = new Map(groves.map(node => [node.id, node]));
  map.resourceNodes = map.resourceNodes.map(node => anchors.has(node.id)
    ? { ...node, stock: anchors.get(node.id).stock } : node)
    .concat(groves.filter(node => /-wood-[12]$/.test(node.id)));
  return map;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const map = await generateTerracedVale();
  await writeFile(new URL('../maps/veyrholds-terraced-vale.json', import.meta.url), JSON.stringify(map, null, 2) + '\n');
  console.log('Generated one regional 160 × 160 Terraced Vale; no roster/default changes.');
}
