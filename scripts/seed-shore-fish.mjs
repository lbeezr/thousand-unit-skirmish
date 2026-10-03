import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { seedShoreFishSites, shoreFishSitePositions } from '../src/shore-fishing-placement.mjs';

const [input, settingsFile, output, ...extra] = process.argv.slice(2);
if (!input || !settingsFile || !output || extra.length || path.resolve(input) === path.resolve(output)) {
  throw new Error('Usage: node scripts/seed-shore-fish.mjs INPUT_MAP.json SETTINGS.json NEW_OUTPUT_MAP.json');
}
const map = JSON.parse(await readFile(input, 'utf8'));
const settings = JSON.parse(await readFile(settingsFile, 'utf8'));
const authored = { ...map, resourceNodes: seedShoreFishSites(map, settings) };
await writeFile(output, JSON.stringify(authored, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output, sites: shoreFishSitePositions(authored),
  food: authored.resourceNodes.filter(node => node.type === 'food').reduce((sum, node) => sum + node.stock, 0) }));
