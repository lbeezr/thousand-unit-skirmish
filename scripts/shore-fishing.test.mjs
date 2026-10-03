import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { findInvalidResourceVariant, isShoreFish, validResourceVariantState } from '../src/shore-fishing.mjs';
import { buildElevationGrid, findUnreachableResourceNode } from '../src/map-utils.mjs';
import { createResourceNodeState, validWildlifeNodeState } from '../src/wildlife-state.mjs';
import { createResourceBrushEditor } from '../src/resource-brush-authoring.mjs';
import { GAMEPLAY_RULESET_REVISION } from '../src/gameplay-definitions.mjs';

const fish = { id: 'shore-fish', type: 'food', resourceVariant: 'shore-fish', x: -0.5, z: -0.5, stock: 22.5 };
const map = { width: 16, height: 16, spawnPoints: [{ team: 0, x: -5.5, z: -0.5 },
  { team: 1, x: 5.5, z: -0.5 }], resourceNodes: [fish],
  obstacles: [{ column: 7, row: 8, width: 1, height: 2, material: 'water' }] };

test('bank marker identifies existing food without introducing a second resource or lifecycle', () => {
  assert.equal(isShoreFish(fish), true);
  assert.equal(findInvalidResourceVariant(map), null);
  const state = createResourceNodeState(fish);
  assert.deepEqual(state, { id: fish.id, type: 'food', resourceVariant: 'shore-fish', x: fish.x, z: fish.z, stock: 22.5 });
  assert.equal(isShoreFish(state), true);
  assert.equal(validResourceVariantState(state, fish), true);
  assert.equal(validResourceVariantState({ ...state, resourceVariant: undefined }, fish), false);
  assert.equal(validResourceVariantState({ ...state, resourceVariant: 'ocean-fish' }, fish), false);
  assert.equal(validWildlifeNodeState(state, fish), true);
  assert.equal(validWildlifeNodeState({ ...state, stock: 0 }, fish), true);
  assert.equal(isShoreFish({ ...fish, resourceVariant: undefined }), false);
});

test('schema 20 ordinary/sheep checkpoints migrate; fish cannot forge previously unrecorded identity', () => {
  const server = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
  const migration = server.slice(server.indexOf('function migrateMatchCheckpoint('), server.indexOf('async function drainMatchCheckpointWrites'));
  const schemaVersion = Number(server.match(/const MATCH_CHECKPOINT_SCHEMA_VERSION = (\d+)/)[1]);
  const context = vm.createContext({ MATCH_CHECKPOINT_SCHEMA_VERSION: schemaVersion, MATCH_RULES_VERSION: 6,
    GAMEPLAY_RULESET_REVISION });
  vm.runInContext(migration, context);
  for (const node of [{ ...fish, resourceVariant: undefined },
    { ...fish, resourceVariant: undefined, wildlifeSpecies: 'bellweather-sheep' }]) {
    const snapshot = { schemaVersion: 20, rulesVersion: 6, mapDefinition: { resourceNodes: [node] }, state: { units: [] } };
    context.migrateMatchCheckpoint(snapshot);
    assert.equal(snapshot.schemaVersion, schemaVersion);
  }
  const invalid = { schemaVersion: 20, rulesVersion: 6, mapDefinition: { resourceNodes: [fish] }, state: { units: [] } };
  context.migrateMatchCheckpoint(invalid);
  assert.equal(invalid.schemaVersion, 20);
});

test('ordinary legacy food/wood and neutral sheep keep their existing contract', () => {
  for (const node of [{ ...fish, resourceVariant: undefined },
    { ...fish, type: 'wood', resourceVariant: undefined },
    { ...fish, resourceVariant: undefined, wildlifeSpecies: 'bellweather-sheep' }]) {
    assert.equal(findInvalidResourceVariant({ ...map, resourceNodes: [node], obstacles: [] }), null);
  }
});

test('resource brush apply/undo/redo preserves existing fish identity and its sole stock pool', () => {
  const bank = { ...fish, x: -14.5, z: 6.5 };
  const draft = { id: 'fish-brush-proof', width: 64, height: 64, resourceNodes: [bank],
    spawnPoints: [{ team: 0, x: -20, z: 0 }, { team: 1, x: 20, z: 0 }],
    obstacles: [{ column: 16, row: 39, width: 4, height: 4, material: 'water' }] };
  const editor = createResourceBrushEditor({ readMap: () => draft,
    commit: state => { draft.resourceNodes = state.resourceNodes; } });
  editor.apply(editor.preview({ seed: 123, type: 'wood', x: 0.5, z: -15.5, totalStock: 100, nodesPerPatch: 1 }));
  assert.deepEqual(draft.resourceNodes[0], bank);
  assert.equal(findInvalidResourceVariant(draft), null);
  assert.equal(editor.undo(), true);
  assert.deepEqual(draft.resourceNodes, [bank]);
  assert.equal(editor.redo(), true);
  assert.deepEqual(draft.resourceNodes[0], bank);
  assert.equal(draft.resourceNodes.length, 2);
});

test('reject unknown identity, non-food, wildlife mixing, water anchors and distant/diagonal banks', () => {
  for (const [change, reason] of [
    [{ resourceVariant: 'fish' }, 'unknown resource variant'],
    [{ resourceVariant: null }, 'unknown resource variant'],
    [{ type: 'wood' }, 'shore fish requires food without wildlife lifecycle'],
    [{ wildlifeSpecies: 'bellweather-sheep' }, 'shore fish requires food without wildlife lifecycle'],
    [{ wildlifeState: 'alive' }, 'shore fish requires food without wildlife lifecycle'],
    [{ x: -0.5, z: 0.5 }, 'shore fish requires an open land access cell'],
    [{ x: 0.5, z: -0.5 }, 'shore fish requires adjacent level 0 water'],
    [{ x: -2.5, z: -0.5 }, 'shore fish requires adjacent level 0 water'],
  ]) {
    assert.deepEqual(findInvalidResourceVariant({ ...map, resourceNodes: [{ ...fish, ...change }] }),
      { nodeId: fish.id, reason });
  }
});

test('cardinal adjacency is bounded at map edges and raised banks/water fail', () => {
  const edge = { ...map, resourceNodes: [{ ...fish, x: -7.5, z: -0.5 }],
    obstacles: [{ column: 15, row: 6, width: 1, height: 1, material: 'water' }] };
  assert.ok(findInvalidResourceVariant(edge), 'row wrap is not shore access');
  edge.obstacles.push({ column: 0, row: 8, width: 1, height: 1, material: 'water' });
  assert.equal(findInvalidResourceVariant(edge), null);
  for (const row of [7, 8]) assert.ok(findInvalidResourceVariant({ ...map,
    elevationPatches: [{ column: 7, row, width: 1, height: 1, level: 1 }] }));
});

test('existing land reachability rejects fish isolated from either seat', () => {
  const blocked = new Uint8Array(map.width * map.height);
  for (const obstacle of map.obstacles) for (let row = obstacle.row; row < obstacle.row + obstacle.height; row++) {
    for (let column = obstacle.column; column < obstacle.column + obstacle.width; column++) blocked[row * map.width + column] = 1;
  }
  const levels = buildElevationGrid(map.width, map.height);
  assert.equal(findUnreachableResourceNode(map.width, map.height, blocked, map.spawnPoints, [fish], levels), null);
  for (let row = 0; row < map.height; row++) blocked[row * map.width + 9] = 1;
  assert.deepEqual(findUnreachableResourceNode(map.width, map.height, blocked, map.spawnPoints, [fish], levels),
    { nodeId: fish.id, team: 1 });
  for (let row = 0; row < map.height; row++) { blocked[row * map.width + 9] = 0; blocked[row * map.width + 4] = 1; }
  assert.deepEqual(findUnreachableResourceNode(map.width, map.height, blocked, map.spawnPoints, [fish], levels),
    { nodeId: fish.id, team: 0 });
});
