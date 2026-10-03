import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { MILLRACE_SHEEP_IDS, MILLRACE_PRE_SHEEP_MAP_HASH, seedMillraceSheep,
  migrateMillraceSheepCheckpoint } from '../src/millrace-sheep.mjs';
import { seededMirroredResourceClusters } from '../src/resource-cluster-authoring.mjs';

const map = JSON.parse(readFileSync(new URL('../maps/bellweather-millrace.json', import.meta.url)));
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('base64url');
const stripIdentity = nodes => nodes.map(({ wildlifeSpecies, wildlifeState, ...node }) => node);
const prior = { ...map, resourceNodes: stripIdentity(map.resourceNodes) };
function legacy() {
  return { schemaVersion: 22, mapHash: hash(prior), mapDefinition: structuredClone(prior), matchId: 'keep-this-match',
    state: { resourceNodes: prior.resourceNodes.map(node => ({ ...node })), teamFood: [151.5, 150], teamWood: [250, 249],
      units: [{ id: 0, cargo: 1.5, cargoType: 'food', gatherNodeId: 's0-0-1', gatherPhase: 'to-base' }] } };
}

test('default Millrace has six mirrored Sheep with the exact prior budget, IDs, cells and seed', () => {
  assert.equal(hash(prior), MILLRACE_PRE_SHEEP_MAP_HASH, 'only the six authored identity fields change');
  assert.deepEqual(seedMillraceSheep(seededMirroredResourceClusters(map)), map.resourceNodes);
  const sheep = map.resourceNodes.filter(node => node.wildlifeSpecies !== undefined);
  assert.deepEqual(sheep.map(node => node.id), MILLRACE_SHEEP_IDS);
  assert.ok(sheep.every(node => node.wildlifeSpecies === 'bellweather-sheep' && node.stock === 130 && node.type === 'food'));
  assert.equal(sheep.reduce((sum, node) => sum + node.stock, 0), 780);
  assert.equal(map.resourceNodes.filter(node => node.type === 'food').reduce((sum, node) => sum + node.stock, 0), 2800);
  assert.equal(map.resourceNodes.filter(node => node.type === 'wood').reduce((sum, node) => sum + node.stock, 0), 4200);
  assert.deepEqual(map.startingResources, { food: 150, wood: 250 });
  for (const node of sheep.filter(node => node.x < 0)) {
    assert.deepEqual(sheep.find(other => other.id === node.id.replace('s0', 's1')),
      { ...node, id: node.id.replace('s0', 's1'), x: -node.x });
  }
});

test('exact pre-Sheep checkpoint migration preserves food, cargo, intent and unrelated fields', () => {
  const saved = legacy();
  for (const team of [0, 1]) for (const [index, stock] of [[1, 128.5], [3, 0], [4, 130]]) {
    saved.state.resourceNodes.find(node => node.id === `s${team}-0-${index}`).stock = stock;
  }
  const before = structuredClone(saved), shippedBefore = JSON.stringify(map);
  assert.equal(migrateMillraceSheepCheckpoint(saved, map, hash), true);
  assert.equal(saved.mapHash, hash(map)); assert.deepEqual(saved.mapDefinition, map);
  assert.deepEqual(stripIdentity(saved.state.resourceNodes), before.state.resourceNodes);
  assert.deepEqual({ ...saved, mapDefinition: before.mapDefinition, mapHash: before.mapHash,
    state: { ...saved.state, resourceNodes: before.state.resourceNodes } }, before);
  for (const team of [0, 1]) for (const [index, state] of [[1, 'carcass'], [3, 'depleted'], [4, 'alive']]) {
    assert.equal(saved.state.resourceNodes.find(node => node.id === `s${team}-0-${index}`).wildlifeState, state);
  }
  assert.equal(JSON.stringify(map), shippedBefore);
  assert.equal(migrateMillraceSheepCheckpoint(saved, map, hash), false, 'migration is one-time');
});

test('migration refuses other map revisions and never repairs corrupt selected state', () => {
  const mutations = [
    saved => { saved.mapHash = 'forged'; },
    saved => { saved.mapDefinition.terrainSeed++; saved.mapHash = hash(saved.mapDefinition); },
    saved => { saved.mapDefinition.resourceNodes[0].stock++; saved.mapHash = hash(saved.mapDefinition); },
    saved => { saved.state.resourceNodes = saved.state.resourceNodes.filter(node => node.id !== 's0-0-1'); },
    saved => { saved.state.resourceNodes.push({ ...saved.state.resourceNodes.find(node => node.id === 's0-0-1') }); },
    ...[-1, NaN, 130.1].map(stock => saved => { saved.state.resourceNodes.find(node => node.id === 's0-0-1').stock = stock; }),
    saved => { saved.state.resourceNodes.find(node => node.id === 's0-0-1').wildlifeState = 'alive'; },
    saved => { saved.state.resourceNodes.find(node => node.id === 's0-0-1').wildlifeSpecies = 'bellweather-sheep'; },
  ];
  for (const mutate of mutations) {
    const saved = legacy(); mutate(saved); const before = structuredClone(saved);
    assert.equal(migrateMillraceSheepCheckpoint(saved, map, hash), false);
    assert.deepEqual(saved, before, 'rejected compatibility does not mutate the save');
  }
  const changed = structuredClone(map); changed.startingResources.food++;
  const saved = legacy(), before = structuredClone(saved);
  assert.equal(migrateMillraceSheepCheckpoint(saved, changed, hash), false);
  assert.deepEqual(saved, before, 'future unrelated shipped edits remain protected');
});
