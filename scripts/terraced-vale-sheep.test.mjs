import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { TERRACED_VALE_SHEEP_IDS, TERRACED_VALE_PRE_SHEEP_MAP_HASH,
  seedTerracedValeSheep, migrateTerracedValeSheepCheckpoint } from '../src/terraced-vale-sheep.mjs';
import { validWildlifeMotion } from '../src/wildlife-motion.mjs';
import { authoredWildlifeBodyHeading } from '../src/wildlife-heading.mjs';
import { validWildlifeNodeState } from '../src/wildlife-state.mjs';

const map = JSON.parse(readFileSync(new URL('../maps/veyrholds-terraced-vale.json', import.meta.url)));
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('base64url');
const ordinary = nodes => nodes.map(node => {
  const { wildlifeSpecies, wildlifeState, wildlifeTeam, wildlifeMotion, wildlifeHerd, wildlifeGrazeAnchor,
    wildlifeHeading, wildlifeActivity, ...original } = node;
  return original;
});
const prior = { ...map, resourceNodes: map.resourceNodes.map(node => {
  const original = { ...node };
  if (TERRACED_VALE_SHEEP_IDS.includes(node.id)) delete original.wildlifeSpecies;
  return original;
}) };
const nodeIn = (value, id) => value.state.resourceNodes.find(node => node.id === id);
function legacy() {
  return { schemaVersion: 29, mapHash: hash(prior), mapDefinition: structuredClone(prior),
    matchId: 'unchanged-room', matchModeId: 'skirmish', matchModeVersion: 1, sequence: 73,
    state: { resourceNodes: prior.resourceNodes.map(node => ({ ...node })), forestEpoch: 7,
      teamFood: [152.125, 150.25], teamWood: [248, 249], teamStone: [0, 0],
      units: [{ id: 0, cargo: 1.875, cargoType: 'food', gatherNodeId: 's0-home-food', gatherPhase: 'to-base',
        path: [10, 11], pathIndex: 1, queuedWaypoints: [{ type: 'gather', nodeId: 's0-terrace-food' }] }],
      buildings: [{ id: 1, type: 'mill', progress: .25, complete: false, productionQueue: [] }],
    } };
}

test('ordinary Tiny adds exactly four symmetric Sheep identities and preserves all 6,100 food', () => {
  assert.equal(map.id, 'veyrholds-terraced-vale'); assert.equal(map.width, 160); assert.equal(map.height, 160);
  assert.equal(hash(prior), TERRACED_VALE_PRE_SHEEP_MAP_HASH, 'the exact preceding shipped map is pinned');
  assert.deepEqual(TERRACED_VALE_SHEEP_IDS, ['s0-home-food', 's0-terrace-food', 's1-home-food', 's1-terrace-food']);
  assert.deepEqual(seedTerracedValeSheep(prior.resourceNodes), map.resourceNodes);
  assert.deepEqual(ordinary(map.resourceNodes), prior.resourceNodes, 'identity is the sole authored change');
  assert.equal(map.resourceNodes.filter(node => node.type === 'food').reduce((sum, node) => sum + node.stock, 0), 6100);
  const sheep = map.resourceNodes.filter(node => node.wildlifeSpecies !== undefined);
  assert.deepEqual(sheep.map(node => node.id), TERRACED_VALE_SHEEP_IDS);
  assert.equal(sheep.reduce((sum, node) => sum + node.stock, 0), 3300);
  for (const node of sheep.filter(node => node.id.startsWith('s0'))) {
    assert.equal(node.stock, node.id.includes('home') ? 650 : 1000);
    assert.deepEqual(sheep.find(other => other.id === node.id.replace('s0', 's1')),
      { ...node, id: node.id.replace('s0', 's1'), x: -node.x });
  }
  for (const team of [0, 1]) assert.equal(map.resourceNodes.find(node => node.id === `s${team}-valley-food`).wildlifeSpecies, undefined);
});

test('seeding is idempotent, immutable and rejects ambiguous or invalid selected markers', () => {
  const frozen = Object.freeze(prior.resourceNodes.map(node => Object.freeze({ ...node })));
  const once = seedTerracedValeSheep(frozen), before = structuredClone(once);
  assert.deepEqual(seedTerracedValeSheep(once), once); assert.deepEqual(once, before);
  for (const mutate of [
    nodes => nodes.filter(node => node.id !== TERRACED_VALE_SHEEP_IDS[0]),
    nodes => [...nodes, { ...nodes[0] }],
    ...[{ type: 'wood' }, { stock: 0 }, { stock: -1 }, { stock: Infinity }, { stock: NaN },
      { stock: '650' }, { wildlifeSpecies: 'deer' }].map(patch => nodes => nodes.map(node => node.id === TERRACED_VALE_SHEEP_IDS[0] ? { ...node, ...patch } : node)),
  ]) {
    const nodes = mutate(structuredClone(prior.resourceNodes)), original = structuredClone(nodes);
    assert.throws(() => seedTerracedValeSheep(nodes), /invalid Terraced Vale Sheep food marker/);
    assert.deepEqual(nodes, original);
  }
  assert.throws(() => seedTerracedValeSheep(null), /must be an array/);
});

test('exact schema29 identity migration preserves old food, cargo, orders, banks, positions and ordinary node keys', () => {
  const saved = legacy(), stockById = new Map([
    ['s0-home-food', 650], ['s0-terrace-food', 998.125], ['s1-home-food', 0], ['s1-terrace-food', 1000],
  ]);
  for (const [id, stock] of stockById) nodeIn(saved, id).stock = stock;
  const before = structuredClone(saved), shippedBefore = structuredClone(map);
  assert.equal(migrateTerracedValeSheepCheckpoint(saved, map, hash), true);
  assert.equal(saved.schemaVersion, 29); assert.equal(saved.mapHash, hash(map)); assert.deepEqual(saved.mapDefinition, map);
  assert.deepEqual(ordinary(saved.state.resourceNodes), before.state.resourceNodes);
  assert.deepEqual({ ...saved, mapDefinition: before.mapDefinition, mapHash: before.mapHash,
    state: { ...saved.state, resourceNodes: before.state.resourceNodes } }, before);
  for (const [id, stock] of stockById) {
    const node = nodeIn(saved, id), authored = map.resourceNodes.find(value => value.id === id);
    assert.equal(node.stock, stock); assert.equal(node.wildlifeTeam, null); assert.equal(node.wildlifeHerd, null);
    assert.equal(node.wildlifeState, stock === 0 ? 'depleted' : stock === authored.stock ? 'alive' : 'carcass');
    assert.deepEqual(node.wildlifeGrazeAnchor, { x: node.x, z: node.z });
    assert.equal(node.wildlifeMotion.heading, authoredWildlifeBodyHeading(authored));
    assert.equal(validWildlifeMotion(node, authored), true); assert.equal(validWildlifeNodeState(node, authored), true);
    assert.equal(node.wildlifeMotion.sequence, 0);
    if (node.wildlifeState !== 'alive') {
      assert.equal(node.wildlifeMotion.activity, 'idle'); assert.equal(node.wildlifeMotion.waitTicks, 0);
      assert.equal(node.wildlifeMotion.targetX, node.x); assert.equal(node.wildlifeMotion.targetZ, node.z);
    }
  }
  for (const node of saved.state.resourceNodes.filter(node => !TERRACED_VALE_SHEEP_IDS.includes(node.id))) {
    assert.deepEqual(node, nodeIn(before, node.id), 'ordinary node shape is exact');
  }
  assert.deepEqual(map, shippedBefore); const migrated = structuredClone(saved);
  assert.equal(migrateTerracedValeSheepCheckpoint(saved, map, hash), false); assert.deepEqual(saved, migrated, 'current saves never initialize motion or stock twice');
});

test('migration rejects corrupt selected legacy state atomically and never infers another map revision', () => {
  for (const mutate of [
    ...[undefined, 28, 30, '29'].map(schemaVersion => saved => { saved.schemaVersion = schemaVersion; }),
    saved => { saved.mapHash = 'forged'; },
    saved => { saved.mapDefinition.id = 'other'; saved.mapHash = hash(saved.mapDefinition); },
    saved => { saved.mapDefinition.terrainSeed++; saved.mapHash = hash(saved.mapDefinition); },
    saved => { saved.mapDefinition.resourceNodes[0].stock++; saved.mapHash = hash(saved.mapDefinition); },
    saved => { saved.state.resourceNodes = saved.state.resourceNodes.filter(node => node.id !== TERRACED_VALE_SHEEP_IDS[0]); },
    saved => { saved.state.resourceNodes.push({ ...saved.state.resourceNodes[0] }); },
    saved => { nodeIn(saved, TERRACED_VALE_SHEEP_IDS[0]).id = 'unknown'; },
    saved => { saved.state.resourceNodes[1] = null; },
    saved => { saved.state.resourceNodes[1].id = 'unknown-ordinary'; },
    saved => { saved.state.resourceNodes[1].stock = Infinity; },
    saved => { saved.state.resourceNodes[1].x += .01; },
    saved => { saved.state.resourceNodes[1].wildlifeHeading = 0; },
    ...[{ type: 'wood' }, { x: -51.49 }, { z: 6.49 }, { x: NaN }, { z: Infinity },
      ...[-1, NaN, Infinity, 650.001, '650'].map(stock => ({ stock })),
      ...['wildlifeSpecies', 'wildlifeState', 'wildlifeTeam', 'wildlifeMotion', 'wildlifeHerd',
        'wildlifeGrazeAnchor', 'wildlifeHeading', 'wildlifeActivity'].map(field => ({ [field]: null })),
    ].map(patch => saved => Object.assign(nodeIn(saved, TERRACED_VALE_SHEEP_IDS[0]), patch)),
  ]) {
    const saved = legacy(); mutate(saved); const before = structuredClone(saved);
    assert.equal(migrateTerracedValeSheepCheckpoint(saved, map, hash), false); assert.deepEqual(saved, before);
  }
  for (const mutate of [
    shipped => { shipped.startingResources.food++; }, shipped => { shipped.terrainSeed++; },
    shipped => { shipped.resourceNodes[0].stock++; }, shipped => { shipped.resourceNodes[0].x += .01; },
    shipped => { delete shipped.resourceNodes[0].wildlifeSpecies; },
    shipped => { shipped.resourceNodes.find(node => node.id === 's0-valley-food').wildlifeSpecies = 'bellweather-sheep'; },
    shipped => { shipped.resourceNodes.push({ ...shipped.resourceNodes[0] }); },
  ]) {
    const shipped = structuredClone(map); mutate(shipped); const beforeShipped = structuredClone(shipped), saved = legacy(), before = structuredClone(saved);
    assert.equal(migrateTerracedValeSheepCheckpoint(saved, shipped, hash), false);
    assert.deepEqual(saved, before); assert.deepEqual(shipped, beforeShipped);
  }
});
