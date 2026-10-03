import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { seedShoreFishSites, shoreFishSitePositions, SHORE_FISHING_PILOT_SETTINGS } from '../src/shore-fishing-placement.mjs';
import { findInvalidResourceVariant } from '../src/shore-fishing.mjs';
import { buildElevationGrid, findUnreachableResourceNode } from '../src/map-utils.mjs';
import { townCenterFootprintCells } from '../src/town-center-spawn.mjs';

const source = JSON.parse(await readFile(new URL('./fixtures/shore-fishing-authoring-source.json', import.meta.url)));
const pilot = JSON.parse(await readFile(new URL('../maps/shore-fishing.json', import.meta.url)));
const settings = JSON.parse(await readFile(new URL('./fixtures/shore-fishing-placement-settings.json', import.meta.url)));
const stock = (map, type) => map.resourceNodes.filter(node => node.type === type).reduce((sum, node) => sum + node.stock, 0);
const authored = (map = source, request = settings) => ({ ...map, resourceNodes: seedShoreFishSites(map, request) });
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function rejectUnchanged(map, request, expression) {
  const before = JSON.stringify(map), options = JSON.stringify(request);
  assert.throws(() => seedShoreFishSites(freeze(map), freeze(request)), expression);
  assert.equal(JSON.stringify(map), before); assert.equal(JSON.stringify(request), options);
}

test('seeded pilot is reproducible and stock preserving, with no change to terrain, IDs or other resources', () => {
  assert.deepEqual(settings, SHORE_FISHING_PILOT_SETTINGS);
  assert.deepEqual(authored(freeze(structuredClone(source)), settings), pilot);
  assert.deepEqual(authored(pilot, settings), pilot, 'explicit seed/anchors regenerate idempotently');
  for (const [key, value] of Object.entries(source)) if (key !== 'resourceNodes') assert.deepEqual(pilot[key], value, key);
  assert.equal(stock(pilot, 'food'), stock(source, 'food')); assert.equal(stock(pilot, 'food'), 120);
  assert.equal(stock(pilot, 'wood'), stock(source, 'wood')); assert.equal(stock(pilot, 'wood'), 200);
  assert.deepEqual(pilot.resourceNodes.map(node => [node.id, node.type, node.stock]), source.resourceNodes.map(node => [node.id, node.type, node.stock]));
  assert.deepEqual(pilot.resourceNodes.slice(2), source.resourceNodes.slice(2));
  assert.notDeepEqual(authored(source, { ...settings, seed: settings.seed + 1 }), pilot);
  assert.equal(findInvalidResourceVariant(pilot), null);
});

test('visual handoff uses distinct water centers and one-cell envelopes while authority stays on the mirrored banks', () => {
  const sites = shoreFishSitePositions(pilot);
  assert.equal(sites.length, 2);
  assert.deepEqual(sites.map(site => site.land), [{ x: -10.5, z: 9.5 }, { x: 10.5, z: 9.5 }]);
  assert.deepEqual(sites.map(site => site.water), [
    { x: -9.5, z: 9.5, column: 10, row: 25 }, { x: 9.5, z: 9.5, column: 29, row: 25 }]);
  for (const site of sites) {
    const node = pilot.resourceNodes.find(node => node.id === site.nodeId);
    assert.deepEqual(site.land, { x: node.x, z: node.z });
    assert.deepEqual(site.visualEnvelope, { width: 1, depth: 1 });
    assert.equal(Math.hypot(site.land.x - site.water.x, site.land.z - site.water.z), 1);
    assert.ok(pilot.obstacles.some(rect => site.water.column >= rect.column && site.water.column < rect.column + rect.width
      && site.water.row >= rect.row && site.water.row < rect.row + rect.height && rect.material === 'water'));
  }
  assert.deepEqual(shoreFishSitePositions(source), []);
});

test('both land approaches remain reachable with Town Centers and never require walking on water', () => {
  const blocked = new Uint8Array(pilot.width * pilot.height);
  for (const rect of pilot.obstacles) for (let row = rect.row; row < rect.row + rect.height; row++) {
    blocked.fill(1, row * pilot.width + rect.column, row * pilot.width + rect.column + rect.width);
  }
  for (const team of [0, 1]) for (const cell of townCenterFootprintCells(pilot.spawnPoints, team, pilot.width, pilot.height)) blocked[cell] = 1;
  assert.equal(findUnreachableResourceNode(pilot.width, pilot.height, blocked, pilot.spawnPoints, pilot.resourceNodes,
    buildElevationGrid(pilot.width, pilot.height)), null);
  for (const site of shoreFishSitePositions(pilot)) {
    const land = Math.floor(site.land.z + pilot.height / 2) * pilot.width + Math.floor(site.land.x + pilot.width / 2);
    const water = site.water.row * pilot.width + site.water.column;
    assert.equal(blocked[land], 0); assert.equal(blocked[water], 1);
  }
});

test('impossible shores, dirt paths, raised banks, disconnected land and unsafe stocks fail atomically', () => {
  rejectUnchanged({ ...structuredClone(source), obstacles: [] }, settings, /No safe reachable/);
  rejectUnchanged({ ...structuredClone(source), terrainPatches: [{ column: 0, row: 0, width: 40, height: 32, material: 'dirt' }] }, settings, /No safe reachable/);
  rejectUnchanged({ ...structuredClone(source), elevationPatches: [{ column: 0, row: 0, width: 40, height: 32, level: 1 }] }, settings, /No safe reachable/);
  rejectUnchanged({ ...structuredClone(source), obstacles: [...source.obstacles, { column: 20, row: 0, width: 1, height: 32, material: 'stone' }] }, settings, /No safe reachable/);
  for (const change of [{ seed: NaN }, { radius: 9 }, { spawnClearance: -1 }, { sites: [] },
    { sites: [settings.sites[0], settings.sites[0]] }, { sites: [{ nodeId: 'azure-wood', x: -10.5, z: 8.5 }] },
    { sites: [{ nodeId: 'missing', x: -10.5, z: 8.5 }] }]) rejectUnchanged(structuredClone(source), { ...settings, ...change }, /settings|unique existing/);
  for (const change of [{ stock: 0 }, { stock: Infinity }, { wildlifeSpecies: 'bellweather-sheep' }, { wildlifeState: 'carcass' }]) {
    const map = structuredClone(source); Object.assign(map.resourceNodes[0], change);
    rejectUnchanged(map, settings, /existing|finite food/);
  }
});

test('placement reserves occupied bank cells and water envelopes without replacing unrelated fields', () => {
  const first = authored(source, { ...settings, sites: [settings.sites[0]] });
  const extra = { id: 'another-food', type: 'food', x: 0.5, z: -8.5, stock: 7.25, metadata: { authored: true } };
  const map = { ...first, resourceNodes: [...first.resourceNodes, extra] };
  const result = authored(map, { ...settings, sites: [{ nodeId: extra.id, x: -10.5, z: 8.5 }] });
  assert.deepEqual(result.resourceNodes[0], first.resourceNodes[0]);
  assert.notDeepEqual(shoreFishSitePositions(result)[0].water, shoreFishSitePositions(result)[1].water);
  assert.equal(result.resourceNodes.at(-1).stock, 7.25);
  assert.deepEqual(result.resourceNodes.at(-1).metadata, { authored: true });
  result.resourceNodes.at(-1).metadata.authored = false;
  assert.equal(map.resourceNodes.at(-1).metadata.authored, true);
});

test('CLI writes portable authoring JSON without overwriting its input or an existing destination', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'shore-fish-authoring-'));
  try {
    const input = path.join(directory, 'source.json'), request = path.join(directory, 'settings.json'), output = path.join(directory, 'new.json');
    await writeFile(input, JSON.stringify(source)); await writeFile(request, JSON.stringify(settings));
    const cli = new URL('./seed-shore-fish.mjs', import.meta.url).pathname;
    const result = spawnSync(process.execPath, [cli, input, request, output], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(await readFile(output, 'utf8')), pilot);
    assert.equal(JSON.parse(result.stdout).food, 120);
    assert.notEqual(spawnSync(process.execPath, [cli, input, request, output]).status, 0);
    assert.notEqual(spawnSync(process.execPath, [cli, input, request, input]).status, 0);
    assert.deepEqual(JSON.parse(await readFile(input, 'utf8')), source);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
