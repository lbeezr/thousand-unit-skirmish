import { readFile, writeFile } from 'node:fs/promises';
import { seededMirroredResourceClusters } from '../src/resource-cluster-authoring.mjs';

// A bounded regeneration entry point; does not rebuild other maps or audio packs.
const file = new URL('../maps/bellweather-millrace.json', import.meta.url);
const map = JSON.parse(await readFile(file, 'utf8'));
map.resourceNodes = seededMirroredResourceClusters(map);
await writeFile(file, JSON.stringify(map, null, 2) + '\n');
const stock = type => map.resourceNodes.filter(n => n.type === type).reduce((sum, n) => sum + n.stock, 0);
console.log(JSON.stringify({ map: map.id, nodes: map.resourceNodes.length, food: stock('food'), nodeWood: stock('wood') }));
