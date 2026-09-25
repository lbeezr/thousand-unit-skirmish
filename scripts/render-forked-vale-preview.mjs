import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const map = JSON.parse(await readFile(path.join(root, 'maps/forked-vale.json'), 'utf8'));
const scale = 8;
const left = 80;
const top = 80;
const width = map.width * scale;
const height = map.height * scale;
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const x = column => left + column * scale;
const y = row => top + row * scale;
const worldX = value => x(value + map.width / 2);
const worldY = value => y(value + map.height / 2);
const parts = [
  `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="665" viewBox="0 0 800 665" role="img" aria-labelledby="title desc">`,
  `<title id="title">Forked Vale tactical map</title>`,
  `<desc id="desc">Mirrored Azure and Ember bases, north and south signal crossings, a gated central watch, food and wood nodes, and segmented river obstacles.</desc>`,
  `<rect width="800" height="665" fill="#111c1b"/>`,
  `<text x="80" y="39" fill="#f1e8cb" font-family="Georgia,serif" font-size="27" font-weight="700">FORKED VALE</text>`,
  `<text x="719" y="38" text-anchor="end" fill="#9cae9e" font-family="sans-serif" font-size="13">80 × 64 · 1v1 · NORTH ↑</text>`,
  `<rect x="${left}" y="${top}" width="${width}" height="${height}" rx="3" fill="#60745a" stroke="#99ad8b" stroke-width="2"/>`,
];
for (let column = 8; column < map.width; column += 8) {
  parts.push(`<path d="M${x(column)} ${top}V${top + height}" stroke="#d4dfbd" stroke-opacity=".12" stroke-width="1"/>`);
}
for (let row = 8; row < map.height; row += 8) {
  parts.push(`<path d="M${left} ${y(row)}H${left + width}" stroke="#d4dfbd" stroke-opacity=".12" stroke-width="1"/>`);
}
for (const obstacle of map.obstacles) {
  const fill = obstacle.material === 'water' ? '#304f62' : obstacle.material === 'forest' ? '#294b36' : '#8b8b75';
  const stroke = obstacle.material === 'water' ? '#62869a' : obstacle.material === 'forest' ? '#43674b' : '#b4af94';
  parts.push(`<rect x="${x(obstacle.column)}" y="${y(obstacle.row)}" width="${obstacle.width * scale}" height="${obstacle.height * scale}" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`);
}
for (const trigger of map.triggers) {
  const zone = trigger.zone;
  const central = trigger.name === 'Vale Watch';
  const color = central ? '#f0c978' : '#d8e58b';
  parts.push(`<rect x="${x(zone.column)}" y="${y(zone.row)}" width="${zone.width * scale}" height="${zone.height * scale}" fill="${color}" fill-opacity=".13" stroke="${color}" stroke-width="2.5" stroke-dasharray="6 3"/>`);
  parts.push(`<text x="${x(zone.column + zone.width / 2)}" y="${y(zone.row + zone.height / 2) + 4}" text-anchor="middle" paint-order="stroke" stroke="#172621" stroke-width="4" fill="#fff3cf" font-family="sans-serif" font-size="12" font-weight="700">${escape(trigger.name.toUpperCase())}</text>`);
}
for (const node of map.resourceNodes) {
  const cx = worldX(node.x);
  const cy = worldY(node.z);
  if (node.type === 'food') {
    parts.push(`<circle cx="${cx}" cy="${cy}" r="6" fill="#e6bd6d" stroke="#33291d" stroke-width="1.5"/>`);
  } else {
    parts.push(`<rect x="${cx - 5.5}" y="${cy - 5.5}" width="11" height="11" rx="2" fill="#9fc987" stroke="#203525" stroke-width="1.5"/>`);
  }
}
for (const spawn of map.spawnPoints) {
  const color = spawn.team === 0 ? '#6bb7eb' : '#ec8b68';
  const label = spawn.team === 0 ? 'AZURE' : 'EMBER';
  const cx = worldX(spawn.x);
  const cy = worldY(spawn.z);
  parts.push(`<circle cx="${cx}" cy="${cy}" r="15" fill="#162425" stroke="${color}" stroke-width="4"/>`);
  parts.push(`<circle cx="${cx}" cy="${cy}" r="5" fill="${color}"/>`);
  parts.push(`<text x="${cx}" y="${cy - 23}" text-anchor="middle" paint-order="stroke" stroke="#1a271f" stroke-width="4" fill="${color}" font-family="sans-serif" font-size="13" font-weight="700">${label}</text>`);
}
parts.push(`<text x="80" y="618" fill="#d3dbc5" font-family="sans-serif" font-size="13">● Spawn</text>`);
parts.push(`<circle cx="185" cy="614" r="5" fill="#e6bd6d"/><text x="199" y="618" fill="#d3dbc5" font-family="sans-serif" font-size="13">Food</text>`);
parts.push(`<rect x="274" y="609" width="10" height="10" rx="2" fill="#9fc987"/><text x="295" y="618" fill="#d3dbc5" font-family="sans-serif" font-size="13">Wood</text>`);
parts.push(`<rect x="365" y="609" width="10" height="10" fill="#304f62" stroke="#62869a"/><text x="386" y="618" fill="#d3dbc5" font-family="sans-serif" font-size="13">Water blocks</text>`);
parts.push(`<text x="720" y="618" text-anchor="end" fill="#b0c19f" font-family="sans-serif" font-size="12">Signals → Watch → 20s hold</text>`);
parts.push(`</svg>`);
const output = path.join(root, 'docs/forked-vale-preview.svg');
await writeFile(output, `${parts.join('\n')}\n`);
console.log(output);
