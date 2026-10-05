import assert from 'node:assert/strict';
import test from 'node:test';
import './checkpoint-validator-contract.test.mjs';
import './checkpoint-envelope.test.mjs';
import { createHash } from 'node:crypto';
import { migrateEconomyCheckpoint, validateEconomyCheckpoint } from '../src/economy-checkpoint.mjs';
import { GAMEPLAY_RULESET_REVISION } from '../src/gameplay-definitions.mjs';
import { DEFAULT_ECONOMY_PROFILE_ID as BASE, STONE_ECONOMY_PROFILE_ID as STONE, economyRulesetRevision } from '../src/economy-profile.mjs';

const legacy = () => ({ schemaVersion: 22, rulesetRevision: GAMEPLAY_RULESET_REVISION,
  mapDefinition: { resourceNodes: [{ id: 'food', type: 'food', stock: 200 }] },
  state: { teamFood: [37.25, 11.5], teamWood: [99.75, 20.125], resourceNodes: [{ id: 'food', type: 'food', stock: 0 }],
    buildings: [{ type: 'watchtower', complete: false, progress: 0.25 }, { type: 'farm', harvestStock: 37.5 }],
    workerProduction: [{ queue: 2, trainingRemaining: 12 }, { queue: 0, trainingRemaining: 0 }],
    units: [{ cargoType: 'wood', cargo: 3.125 }, { cargoType: null, cargo: 0 }] } });
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

test('schema 22 retains map checksum, fractional banks, cargo, crops, depletion and paid work', () => {
  const snapshot = legacy(), before = structuredClone(snapshot), mapHash = hash(snapshot.mapDefinition);
  assert.equal(migrateEconomyCheckpoint(snapshot), snapshot);
  assert.equal(snapshot.schemaVersion, 23); assert.equal(snapshot.economyProfileId, BASE);
  assert.equal(snapshot.rulesetRevision, before.rulesetRevision);
  assert.equal(hash(snapshot.mapDefinition), mapHash, 'no omitted authored selector is added');
  assert.deepEqual(snapshot.state, { ...before.state, teamStone: [0, 0] });
  assert.equal(validateEconomyCheckpoint(snapshot), BASE);
});

test('an older or unknown pin cannot claim Stone profile, banks, cargo or source state', () => {
  for (const change of [s => s.rulesetRevision = `v1:${'0'.repeat(64)}`,
    s => s.economyProfileId = STONE, s => s.mapDefinition.economyProfileId = STONE,
    s => s.state.teamStone = [0, 0], s => s.state.units[0].cargoType = 'stone',
    s => s.state.resourceNodes[0].type = 'stone', s => s.mapDefinition.resourceNodes[0].type = 'stone',
    s => s.schemaVersion = 24]) {
    const snapshot = legacy(); change(snapshot); const bytes = JSON.stringify(snapshot);
    migrateEconomyCheckpoint(snapshot); assert.equal(JSON.stringify(snapshot), bytes);
  }
});

test('current Stone recovery requires matching explicit identity and complete finite typed banks', () => {
  const snapshot = migrateEconomyCheckpoint(legacy());
  snapshot.economyProfileId = snapshot.mapDefinition.economyProfileId = STONE;
  snapshot.rulesetRevision = economyRulesetRevision(STONE); snapshot.state.teamStone = [49.9999, 7.25];
  snapshot.state.units[0].cargoType = 'stone'; snapshot.state.resourceNodes[0].type = 'stone';
  assert.equal(validateEconomyCheckpoint(snapshot), STONE);
  for (const change of [s => delete s.economyProfileId, s => delete s.mapDefinition.economyProfileId,
    s => s.economyProfileId = 'stone', s => s.rulesetRevision = GAMEPLAY_RULESET_REVISION,
    s => delete s.state.teamStone, s => s.state.teamStone = [1], s => s.state.teamStone[0] = -1,
    s => s.state.teamStone[0] = Infinity, s => delete s.state.teamFood,
    s => s.state.teamWood[0] = NaN, s => s.state.units[0].cargoType = 'gold',
    s => s.state.resourceNodes[0].type = 'copper']) {
    const invalid = structuredClone(snapshot); change(invalid); const before = structuredClone(invalid);
    assert.throws(() => validateEconomyCheckpoint(invalid)); assert.deepEqual(invalid, before);
  }
});

test('baseline recovery forbids mineral state and never reparses the Stone price as food/wood', () => {
  for (const change of [s => s.state.teamStone[0] = 0.001,
    s => s.state.units[0].cargoType = 'stone', s => s.state.resourceNodes[0].type = 'stone']) {
    const snapshot = migrateEconomyCheckpoint(legacy()); change(snapshot);
    assert.throws(() => validateEconomyCheckpoint(snapshot));
  }
});
