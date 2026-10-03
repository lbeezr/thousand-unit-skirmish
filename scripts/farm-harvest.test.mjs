import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { FARM_TUNING_PROPOSAL, farmHarvestNodeId, farmBuildingId, farmHarvestNode, validFarmStock } from '../src/farm-harvest.mjs';
import { BUILDING_DEFINITIONS as B, GAMEPLAY_DEFINITIONS, GAMEPLAY_RULESET_REVISION, validateGameplayDefinitions } from '../src/gameplay-definitions.mjs';
import { buildingPresentation } from '../src/gameplay-presentation.mjs';

test('Farm registry pins one provisional paid planting without drop-off or passive credit', () => {
  assert.deepEqual(B.farm.cost, { food: 0, wood: 60 });
  assert.deepEqual(B.farm.harvest, { type: 'food', stock: 200, access: 'owner' });
  assert.equal(B.farm.buildSeconds, 15); assert.equal(B.farm.maxHp, 600);
  assert.equal(B.farm.dropoff, undefined); assert.equal(B.farm.populationCapacity, undefined);
  assert.deepEqual(B.farm.products, []); assert.equal(FARM_TUNING_PROPOSAL.foodStock, 200);
  assert.ok(GAMEPLAY_DEFINITIONS.factions.frontier.buildings.includes('farm'));
  assert.deepEqual(buildingPresentation('farm'), { backend: 'procedural', role: 'house' });
  for (const change of [rules => rules.stock = 0, rules => rules.type = 'wood', rules => rules.access = 'any',
    rules => rules.regrowth = true]) {
    const clone = structuredClone(GAMEPLAY_DEFINITIONS); change(clone.buildings.farm.harvest);
    assert.throws(() => validateGameplayDefinitions(clone), /finite harvest source/);
  }
});

test('Farm harvest adapter has one persisted stock owner and disjoint source identity', () => {
  const building = { id: 12, type: 'farm', team: 1, x: 3, z: 4, hp: 600, complete: false, progress: 0, harvestStock: 0 };
  assert.equal(farmHarvestNode(building), null);
  assert.ok(validFarmStock(building, B));
  building.harvestStock = 1; assert.equal(validFarmStock(building, B), false);
  building.complete = true; building.progress = 1; building.harvestStock = B.farm.harvest.stock;
  const node = farmHarvestNode(building);
  assert.equal(node.id, 'farm:12'); assert.equal(node.team, 1); assert.equal(node.sourceBuildingId, 12);
  node.stock -= 10; assert.equal(building.harvestStock, 190);
  building.harvestStock = 0; assert.equal(node.stock, 0);
  assert.equal(farmHarvestNode(building).stock, 0, 'adapting or rereading never regrows stock');
  for (const stock of [-1, 200.01, NaN]) { building.harvestStock = stock; assert.equal(validFarmStock(building, B), false); }
  assert.equal(validFarmStock({ type: 'house', harvestStock: 200 }, B), false);
  for (const id of ['farm:0', 'farm:-1', 'farm:01', 'farm:1x', 'farm:9007199254740992', 'farm-12']) assert.equal(farmBuildingId(id), null);
  assert.equal(farmBuildingId(farmHarvestNodeId(12)), 12);
});

test('a prior content pin migrates existing work but cannot claim planted stock', () => {
  const source = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
  const start = source.indexOf('function migrateMatchCheckpoint('), end = source.indexOf('\nasync function ', start);
  const context = vm.createContext({ GAMEPLAY_RULESET_REVISION, MATCH_CHECKPOINT_SCHEMA_VERSION: 22, MATCH_RULES_VERSION: 6 });
  vm.runInContext(source.slice(start, end), context);
  const previous = 'v1:561c62ccc67ac78cc067e8e639942a83fc6d6b1f89633e5b1c73aedc20f4a3a6';
  const paid = { schemaVersion: 22, rulesetRevision: previous, state: { buildings: [{ type: 'mill' }, { type: 'dock' }], units: [] } };
  assert.equal(context.migrateMatchCheckpoint(paid).rulesetRevision, GAMEPLAY_RULESET_REVISION);
  const gatePin = 'v1:525ab43cd600206d5c6cfab131c9d1fe193a59d9160ab219dc96a0dfb181605b';
  const gate = { type: 'palisade-gate', gateOpen: true, progress: 1, complete: true };
  const recent = { schemaVersion: 22, rulesetRevision: gatePin,
    state: { buildings: [gate, { type: 'dock' }], units: [{ buildTargetId: 7 }] } };
  assert.equal(context.migrateMatchCheckpoint(recent).rulesetRevision, GAMEPLAY_RULESET_REVISION);
  assert.equal(recent.state.buildings[0], gate);
  assert.equal(recent.state.units[0].buildTargetId, 7);
  const skiffPin = 'v1:b82d5b9fdd687e98dd47b8390aaaa04f7bc00df9dc6ac16273f8c04235cbeb54';
  const water = { schemaVersion: 22, rulesetRevision: skiffPin, state: {
    teamFood: [12.5, 20], teamWood: [25, 19.75],
    buildings: [gate, { type: 'dock', productionQueue: ['skiff'], queue: 1, trainingRemaining: 4 }],
    units: [{ kind: 'skiff', movementDomain: 'water', path: [31, 32], cargo: 0, cargoType: null, gatherNodeId: null, gatherPhase: '' }],
  } };
  const retained = structuredClone(water.state);
  assert.equal(context.migrateMatchCheckpoint(water).rulesetRevision, GAMEPLAY_RULESET_REVISION);
  assert.deepEqual({ ...water.state, units: water.state.units.map(({ persistentOrder, ...unit }) => unit) }, retained,
    'pre-Farm Skiff boats, paid queues and fractional banks remain unchanged');
  for (const building of [{ type: 'farm', harvestStock: 200 }, { type: 'house', harvestStock: 200 }]) {
    for (const pin of [previous, gatePin, skiffPin]) {
      const invalid = { schemaVersion: 22, rulesetRevision: pin, state: { buildings: [building], units: [] } };
      assert.equal(context.migrateMatchCheckpoint(invalid).rulesetRevision, pin);
    }
  }
});
