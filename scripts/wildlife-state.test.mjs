import { GAMEPLAY_RULESET_REVISION } from '../src/gameplay-definitions.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { isShoreFish } from '../src/shore-fishing.mjs';
import {
  activateWildlifeHarvest, createResourceNodeState, markWildlifeDepleted,
  validWildlifeNodeDefinition, validWildlifeNodeState,
} from '../src/wildlife-state.mjs';

const sheep = { id: 'sheep', type: 'food', x: 0, z: 0, stock: 100, wildlifeSpecies: 'bellweather-sheep' };

test('harvest activation preserves the sole food pool and cannot repeat or restock', () => {
  const node = createResourceNodeState(sheep);
  assert.equal(activateWildlifeHarvest(node), true);
  assert.equal(node.wildlifeState, 'carcass');
  assert.equal(node.stock, 100);
  node.stock -= 0.25;
  assert.equal(activateWildlifeHarvest(node), false);
  assert.equal(node.stock, 99.75);
  node.stock = 0;
  markWildlifeDepleted(node);
  assert.equal(node.wildlifeState, 'depleted');
  assert.equal(activateWildlifeHarvest(node), false);
  assert.equal(node.stock, 0);
  const ordinary = createResourceNodeState({ ...sheep, wildlifeSpecies: undefined });
  assert.equal(activateWildlifeHarvest(ordinary), false);
  markWildlifeDepleted(ordinary);
  assert.equal(ordinary.wildlifeState, undefined);
});

test('authored identity admits only food sheep and never runtime lifecycle', () => {
  assert.equal(validWildlifeNodeDefinition(sheep), true);
  assert.equal(validWildlifeNodeDefinition({ ...sheep, wildlifeSpecies: undefined }), true);
  for (const change of [{ type: 'wood' }, { wildlifeSpecies: 'deer' }, { wildlifeSpecies: null },
    { wildlifeState: 'alive' }, { wildlifeState: 'carcass' }, { wildlifeState: null }]) {
    assert.equal(validWildlifeNodeDefinition({ ...sheep, ...change }), false);
  }
});

test('optional authored nose yaw is finite Sheep presentation data, separate from live food state', () => {
  for (const wildlifeNoseYawDegrees of [0, 45, 90, 315, 359.99]) {
    const definition = { ...sheep, wildlifeNoseYawDegrees };
    assert.equal(validWildlifeNodeDefinition(definition), true);
    const state = createResourceNodeState(definition), baseline = createResourceNodeState(sheep);
    assert.equal(state.wildlifeMotion.heading, wildlifeNoseYawDegrees * Math.PI / 180);
    state.wildlifeMotion.heading = baseline.wildlifeMotion.heading;
    assert.deepEqual(state, baseline, 'authored initial pose changes no food or lifecycle state');
  }
  for (const wildlifeNoseYawDegrees of [-1, 360, NaN, Infinity, '90', null]) {
    assert.equal(validWildlifeNodeDefinition({ ...sheep, wildlifeNoseYawDegrees }), false);
  }
  assert.equal(validWildlifeNodeDefinition({ ...sheep, wildlifeSpecies: undefined, wildlifeNoseYawDegrees: 0 }), false);
});

test('checkpoint lifecycle cannot revive consumed stock or hide depleted stock', () => {
  const live = createResourceNodeState(sheep);
  assert.equal(validWildlifeNodeState(live, sheep), true);
  assert.equal(validWildlifeNodeState({ ...live, stock: 99 }, sheep), false);
  assert.equal(validWildlifeNodeState({ ...live, wildlifeState: undefined }, sheep), false);
  assert.equal(validWildlifeNodeState({ ...live, wildlifeSpecies: 'deer' }, sheep), false);
  assert.equal(validWildlifeNodeState({ ...live, wildlifeState: 'carcass', stock: 0.5 }, sheep), true);
  assert.equal(validWildlifeNodeState({ ...live, wildlifeState: 'carcass', stock: 0 }, sheep), false);
  assert.equal(validWildlifeNodeState({ ...live, wildlifeState: 'depleted', stock: 0 }, sheep), true);
  assert.equal(validWildlifeNodeState({ ...live, wildlifeState: 'depleted', stock: 1 }, sheep), false);
  const plain = { ...sheep, wildlifeSpecies: undefined };
  assert.equal(validWildlifeNodeState(createResourceNodeState(plain), plain), true);
  assert.equal(validWildlifeNodeState(live, plain), false);
});

const server = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
const gatherFunction = server.slice(server.indexOf('function assignGather('), server.indexOf('function stopGathering('));
for (const team of [0, 1]) test(`seat ${team} validates its Workers and visibility without wildlife ownership`, () => {
  const node = createResourceNodeState(sheep);
  const unit = (id, owner, hp, canGather, cell = 0) => ({ id, team: owner, hp, canGather, x: cell, z: 0,
    orderRevision: 0, queuedWaypoints: [], cargo: 0, cargoType: null });
  const workers = [unit(0, team, 100, true), unit(1, 1 - team, 100, true),
    unit(2, team, 0, true), unit(3, team, 100, false), unit(4, team, 100, true, 1)];
  const notices = [], routes = [];
  let visible = true;
  const context = vm.createContext({ isShoreFish, farmBuildingId: () => null, harvestNodeById: id => context.resourceNodeStates.get(id), resourceNodeStates: new Map([[node.id, node]]),
    spawnByTeam: [{ x: 0, z: 0 }, { x: 0, z: 0 }], walkableComponents: [0, 1],
    WORKER_CARRY_CAPACITY: 10, dirty: false,
    worldToCell: x => x, nearestOpenCell: cell => cell, cellVisibleToTeam: () => visible,
    commandUnits: command => workers.filter(worker => command.ids.includes(worker.id)),
    unitHasCapability: worker => worker.canGather,
    sendOrderNotice: (_, __, message) => notices.push(message),
    clearAttackMoveOrder: () => {}, routeWorker: (worker, phase) => routes.push([worker.id, phase]),
  });
  vm.runInContext(gatherFunction, context);
  context.assignGather({ team }, { ids: [1, 2, 3, 4], nodeId: node.id });
  assert.match(notices.pop(), /NO REACHABLE WORKERS/);
  assert.equal(routes.length, 0);
  assert.equal(node.wildlifeState, 'alive');
  visible = false;
  context.assignGather({ team }, { ids: [0], nodeId: node.id });
  assert.match(notices.pop(), /WILDLIFE NOT VISIBLE/);
  assert.equal(routes.length, 0);
  visible = true;
  context.assignGather({ team }, { ids: [0, 1, 2, 3, 4], nodeId: node.id });
  assert.deepEqual(routes, [[0, 'to-node']]);
  assert.equal(node.wildlifeState, 'alive', 'a distant accepted order does not dispatch wildlife');
  assert.equal(node.stock, 100);
  activateWildlifeHarvest(node);
  context.assignGather({ team: 1 - team }, { ids: [1], nodeId: node.id });
  assert.deepEqual(routes[1], [1, 'to-node'], 'opponent can gather the same carcass');
  node.stock = 0; markWildlifeDepleted(node);
  context.assignGather({ team }, { ids: [0], nodeId: node.id });
  assert.match(notices.pop(), /RESOURCE NODE EMPTY/);
  assert.equal(routes.length, 2);
});

test('schema 19 ordinary maps migrate, but cannot forge unrecorded wildlife state', () => {
  const migration = server.slice(server.indexOf('function migrateMatchCheckpoint('), server.indexOf('async function drainMatchCheckpointWrites'));
  const schemaVersion = Number(server.match(/const MATCH_CHECKPOINT_SCHEMA_VERSION = (\d+)/)[1]);
  const context = vm.createContext({ GAMEPLAY_RULESET_REVISION, MATCH_CHECKPOINT_SCHEMA_VERSION: schemaVersion, MATCH_RULES_VERSION: 6 });
  vm.runInContext(migration, context);
  const plain = { schemaVersion: 19, rulesVersion: 6, mapDefinition: { resourceNodes: [] }, state: { units: [] } };
  context.migrateMatchCheckpoint(plain);
  assert.equal(plain.schemaVersion, 22);
  const invalid = { ...plain, schemaVersion: 19, mapDefinition: { resourceNodes: [sheep] } };
  context.migrateMatchCheckpoint(invalid);
  assert.equal(invalid.schemaVersion, 19, 'validation will reject wildlife predating its state schema');
});
