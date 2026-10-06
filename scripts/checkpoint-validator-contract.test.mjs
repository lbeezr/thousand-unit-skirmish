import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { createPveHeadlessFixture, assertRecoveredWorkerObservation } from './pve-headless-fixture.mjs';
import { createAuthoritativeMapValidatorFixture } from './fixtures/authoritative-map-validator-fixture.mjs';
import { TECHNOLOGY_DEFINITIONS } from '../src/gameplay-definitions.mjs';

// The same authority adapter used by existing checkpoint/fog/native consumers.
// No validator copy or replacement policy is evaluated by this contract.
const map = JSON.parse(await readFile(new URL('../maps/veyrholds-terraced-vale.json', import.meta.url), 'utf8'));

const bareMap = (width = 32, height = width) => ({
  id: 'validator-contract', name: 'Validator contract', width, height, obstacles: [],
  spawnPoints: [{ team: 0, x: -4.5, z: .5 }, { team: 1, x: 4.5, z: .5 }],
});
const timedEvent = overrides => ({
  id: 'supply', name: 'Supply', type: 'timed-supply', afterSeconds: .5,
  team: 'both', foodReward: 1, ...overrides,
});

test('map validator: shallow return, default mutation and JSON property order are retained', () => {
  const { validateMapDefinition } = createAuthoritativeMapValidatorFixture();
  const input = { ...bareMap(), terrainSeed: 1.5, victoryMode: null, fogOfWar: null,
    regions: [{ id: 'home', name: 'Home', zone: { column: 0, row: 0, width: 2, height: 2 } }],
    triggers: [], scenarioEvents: [], resourceNodes: [], extra: { retained: true } };
  const result = validateMapDefinition(input, 'contract');
  assert.notEqual(result, input);
  assert.equal(input.victoryMode, 'any');
  assert.equal(input.fogOfWar, false);
  assert.equal(input.terrainSeed, 1.5, 'terrainSeed normalization belongs to the return only');
  assert.equal(result.terrainSeed, 1);
  for (const key of ['obstacles', 'spawnPoints', 'regions', 'triggers', 'scenarioEvents', 'resourceNodes', 'extra']) {
    assert.equal(result[key], input[key], `${key}: nested reference is retained`);
  }
  assert.deepEqual(Object.keys(result), Object.keys(input));
  const absent = bareMap(), normalized = validateMapDefinition(absent, 'contract');
  assert.deepEqual(Object.keys(normalized), [...Object.keys(absent), 'terrainSeed', 'triggers', 'scenarioEvents', 'resourceNodes']);
  assert.equal(Object.hasOwn(normalized, 'regions'), false);
  assert.equal(Object.hasOwn(absent, 'terrainSeed'), false);
  for (const key of ['triggers', 'scenarioEvents', 'resourceNodes']) assert.deepEqual(normalized[key], []);
  const nullable = { ...bareMap(), triggers: null, scenarioEvents: null, resourceNodes: null, regions: null };
  const empty = validateMapDefinition(nullable, 'contract');
  for (const key of ['triggers', 'scenarioEvents', 'resourceNodes', 'regions']) {
    assert.deepEqual(empty[key], []);
    assert.equal(nullable[key], null, `${key}: null defaults affect the returned array only`);
  }
  for (const seed of [0, -1, 17]) assert.equal(validateMapDefinition({ ...bareMap(), terrainSeed: seed }, 'contract').terrainSeed, seed);
});

test('map validator: earlier faults and input defaulting retain exact diagnostics', () => {
  const { validateMapDefinition } = createAuthoritativeMapValidatorFixture();
  for (const input of [null, [], 1, 'map']) assert.throws(() => validateMapDefinition(input, 'named.json'),
    { name: 'Error', message: 'Map named.json must contain a JSON object.' });
  const cases = [
    [{ audio: null, region: 'unknown', victoryMode: 'bad' }, 'Map audio must reference a packId and profileId using stable IDs.', false, false],
    [{ region: 'unknown', victoryMode: 'bad' }, 'Map region must name a registered Vaelora palette.', false, false],
    [{ victoryMode: 'bad', startingArmySize: 7 }, 'Map named.json victoryMode must be "any" or "all".', true, false],
    [{ startingArmySize: 7, startingResources: null }, 'Map named.json startingArmySize must be an even total from 8 to 2000.', true, false],
    [{ startingResources: null, fogOfWar: 'yes' }, 'Map named.json has invalid starting food or wood.', true, true],
    [{ fogOfWar: 'yes', id: 'BAD' }, 'Map named.json fogOfWar must be a boolean.', true, true],
    [{ id: 'BAD', width: 15 }, 'Map named.json needs a lowercase hyphenated id.', true, true],
    [{ width: 15, elevationPatches: 'bad' }, 'Map named.json width and height must be integers between 16 and 256.', true, true],
    [{ terrainBase: 'bad', obstacles: null }, 'Map named.json has an invalid base terrain material.', true, true],
    [{ obstacles: null, triggers: null }, 'Map named.json must define obstacle and spawnPoints arrays.', true, true],
    [{ triggers: {}, scenarioEvents: {} }, 'Map named.json triggers must be an array with at most 32 entries.', true, true],
    [{ scenarioEvents: {}, resourceNodes: {} }, 'Map named.json scenarioEvents must be an array with at most 32 entries.', true, true],
  ];
  for (const [changes, message, victoryPresent, fogPresent] of cases) {
    const input = { ...bareMap(), ...changes };
    assert.throws(() => validateMapDefinition(input, 'named.json'), { name: 'Error', message });
    assert.equal(Object.hasOwn(input, 'victoryMode'), Object.hasOwn(changes, 'victoryMode') || victoryPresent);
    assert.equal(Object.hasOwn(input, 'fogOfWar'), Object.hasOwn(changes, 'fogOfWar') || fogPresent);
    if (!Object.hasOwn(changes, 'victoryMode') && victoryPresent) assert.equal(input.victoryMode, 'any');
    if (!Object.hasOwn(changes, 'fogOfWar') && fogPresent) assert.equal(input.fogOfWar, false);
  }
});

test('map validator: actual policy limits and 16–256 admission stay closed above their boundary', () => {
  const { validateMapDefinition, limits } = createAuthoritativeMapValidatorFixture();
  assert.deepEqual(limits, { MAX_UNITS: 2000, MAX_MAP_OBSTACLES: 4096, MAX_RESOURCE_NODES: 128,
    MAX_OBJECTIVE_FOOD_REWARD: 10000, MAX_MAP_SCENARIO_EVENTS: 32,
    MAX_SCENARIO_EVENT_REPEATS: 20, MIN_SCENARIO_EVENT_REPEAT_SECONDS: 5 });
  for (const side of [16, 256]) validateMapDefinition(bareMap(side), 'boundary');
  for (const [width, height] of [[15, 32], [32, 15], [257, 32], [32, 257], [320, 320]]) {
    assert.throws(() => validateMapDefinition(bareMap(width, height), 'boundary'),
      { message: 'Map boundary width and height must be integers between 16 and 256.' });
  }
  for (const startingArmySize of [8, 2000]) validateMapDefinition({ ...bareMap(), startingArmySize }, 'boundary');
  for (const startingArmySize of [6, 9, 2002]) assert.throws(() =>
    validateMapDefinition({ ...bareMap(), startingArmySize }, 'boundary'), /even total from 8 to 2000/);
  const events = Array.from({ length: 32 }, (_, i) => timedEvent({ id: `supply-${i}` }));
  validateMapDefinition({ ...bareMap(), scenarioEvents: events }, 'boundary');
  assert.throws(() => validateMapDefinition({ ...bareMap(), scenarioEvents: [...events, timedEvent({ id: 'overflow' })] }, 'boundary'), /at most 32 entries/);
  for (const overrides of [{ foodReward: 10000 }, { repeatCount: 20, repeatEverySeconds: 5 }]) {
    validateMapDefinition({ ...bareMap(), scenarioEvents: [timedEvent(overrides)] }, 'boundary');
  }
  for (const overrides of [{ foodReward: 10001 }, { repeatCount: 21, repeatEverySeconds: 5 }, { repeatCount: 20, repeatEverySeconds: 4.9 }]) {
    assert.throws(() => validateMapDefinition({ ...bareMap(), scenarioEvents: [timedEvent(overrides)] }, 'boundary'), /invalid timed supply event/);
  }
  const nodes = Array.from({ length: 128 }, (_, i) => ({ id: `food-${i}`, type: 'food', x: .5, z: .5, stock: 1 }));
  validateMapDefinition({ ...bareMap(), resourceNodes: nodes }, 'boundary');
  assert.throws(() => validateMapDefinition({ ...bareMap(), resourceNodes: [...nodes, { ...nodes[0], id: 'overflow' }] }, 'boundary'), /at most 128 entries/);
  assert.throws(() => validateMapDefinition({ ...bareMap(), obstacles: Array(4097).fill(null) }, 'boundary'), /must define obstacle and spawnPoints arrays/);
  const patches = Array.from({ length: 4096 }, (_, i) => ({ column: i % 256, row: Math.floor(i / 256), width: 1, height: 1 }));
  validateMapDefinition({ ...bareMap(256), obstacles: patches }, 'boundary');
  const paint = patches.map(patch => ({ ...patch, material: 'dirt' }));
  validateMapDefinition({ ...bareMap(256), terrainPatches: paint }, 'boundary');
  assert.throws(() => validateMapDefinition({ ...bareMap(256), terrainPatches: [...paint, { column: 0, row: 16, width: 1, height: 1, material: 'dirt' }] }, 'boundary'), /too many terrain paint patches/);
  const capture = i => ({ id: `capture-${i}`, name: 'Capture', type: 'capture-zone',
    zone: { column: 16, row: 16, width: 1, height: 1 }, requiredUnits: 1000, captureSeconds: .5, foodReward: 10000 });
  const triggers = Array.from({ length: 32 }, (_, i) => capture(i));
  validateMapDefinition({ ...bareMap(), triggers }, 'boundary');
  assert.throws(() => validateMapDefinition({ ...bareMap(), triggers: [...triggers, capture(32)] }, 'boundary'), /at most 32 entries/);
  assert.throws(() => validateMapDefinition({ ...bareMap(), triggers: [{ ...capture(0), requiredUnits: 1001 }] }, 'boundary'), /invalid scenario trigger/);
});

test('map validator: technology lookup remains deferred and short circuits at its existing position', () => {
  const lookups = [];
  const { validateMapDefinition, researchRulesFor } = createAuthoritativeMapValidatorFixture({ observeResearchLookup: id => lookups.push(id) });
  assert.deepEqual(lookups, [], 'constructing the validator does not resolve a technology');
  for (const [id, definition] of Object.entries(TECHNOLOGY_DEFINITIONS)) {
    const rule = researchRulesFor(id);
    assert.equal(rule, researchRulesFor(id), 'host lookup retains frozen rule identity');
    assert.equal(rule.buildingType, definition.building);
    const event = timedEvent({ foodReward: 0, technologyReward: id });
    assert.equal(validateMapDefinition({ ...bareMap(), scenarioEvents: [event] }, 'technology').scenarioEvents[0], event);
  }
  assert.deepEqual(lookups, Object.keys(TECHNOLOGY_DEFINITIONS));
  lookups.length = 0;
  for (const overrides of [{ foodReward: -1, technologyReward: 'unknown' }, { technologyReward: 7 }]) {
    assert.throws(() => validateMapDefinition({ ...bareMap(), scenarioEvents: [timedEvent(overrides)] }, 'technology'), /invalid timed supply event/);
  }
  assert.deepEqual(lookups, [], 'earlier faults and non-string rewards never call the lookup');
  assert.throws(() => validateMapDefinition({ ...bareMap(), scenarioEvents: [timedEvent({ technologyReward: 'unknown', message: 7 })] }, 'technology'),
    { message: 'Map technology has an invalid timed supply event.' });
  assert.deepEqual(lookups, ['unknown'], 'lookup still precedes message validation');
  assert.equal(researchRulesFor('unknown'), null);
});

test('map validator: every shipped map retains normalized bytes and shallow references', async () => {
  const { validateMapDefinition } = createAuthoritativeMapValidatorFixture();
  const mapsUrl = new URL('../maps/', import.meta.url);
  const filenames = (await readdir(mapsUrl)).filter(name => name.endsWith('.json')).sort();
  assert.ok(filenames.length > 0);
  for (const filename of filenames) {
    const input = JSON.parse(await readFile(new URL(filename, mapsUrl), 'utf8'));
    const result = validateMapDefinition(input, filename), bytes = JSON.stringify(result);
    assert.equal(JSON.stringify(validateMapDefinition(result, filename)), bytes, `${filename}: normalized validation is stable`);
    for (const key of ['obstacles', 'spawnPoints', 'triggers', 'scenarioEvents', 'resourceNodes', 'regions']) {
      if (input[key] !== undefined) assert.equal(result[key], input[key], `${filename}: ${key} identity`);
    }
  }
});

for (const mode of ['authored', 'skirmish']) test(`${mode}: validation retains canonical map/state and restore parity`, async () => {
  const fixture = await createPveHeadlessFixture(map, { matchModeId: mode, matchModeVersion: 1 });
  const replay = fixture.replay;
  try {
    const snapshot = replay.checkpoint(), bytes = JSON.stringify(snapshot);
    const world = replay.checkpoint(), observations = [replay.observe(0), replay.observe(1)];
    const result = replay.validateCheckpoint(snapshot);
    assert.deepEqual(Object.keys(result), ['definition', 'state', 'explored', 'savedMatchMode']);
    assert.deepEqual(result.definition, snapshot.mapDefinition, 'returns the canonical authored map');
    assert.equal(result.state, snapshot.state, 'state identity is retained, without cloning or activation');
    assert.deepEqual(result.savedMatchMode, { matchModeId: mode, matchModeVersion: 1 });
    assert.notEqual(result.savedMatchMode, snapshot);
    assert.equal(result.explored.length, 2);
    for (const [team, decoded] of result.explored.entries()) {
      assert.ok(Buffer.isBuffer(decoded));
      assert.equal(decoded.length, map.width * map.height);
      assert.equal(decoded.toString('base64'), snapshot.state.explored[team]);
    }
    if (mode === 'skirmish') {
      assert.equal(result.state.triggerStates.length, map.triggers.length, 'bonus posts remain active under Skirmish');
    }
    assert.equal(JSON.stringify(snapshot), bytes, 'validation preserves serialized input');
    assert.deepEqual(replay.checkpoint(), world, 'validation does not activate or alter the running match');
    replay.restore(snapshot);
    for (const team of [0, 1]) assertRecoveredWorkerObservation(replay.observe(team), observations[team]);
    assert.deepEqual(replay.checkpoint(), world, 'the existing restore consumer retains the authority state');
  } finally { await fixture.dispose(); }
});

test('canonical validation and effective rules precede the restore consumer shipped-map veto', async () => {
  const fixture = await createPveHeadlessFixture(map, { matchModeId: 'skirmish', matchModeVersion: 1 });
  const replay = fixture.replay;
  try {
    const candidate = structuredClone(replay.checkpoint()), world = structuredClone(replay.checkpoint());
    candidate.mapDefinition.triggers[0].victory = true;
    candidate.mapDefinition.victoryHoldSeconds = 12;
    candidate.mapHash = createHash('sha256').update(JSON.stringify(candidate.mapDefinition)).digest('base64url');
    const bytes = JSON.stringify(candidate);
    const result = replay.validateCheckpoint(candidate);
    assert.equal(result.definition.triggers[0].victory, true, 'returns authored victory metadata, not the effective elimination projection');
    assert.equal(result.definition.victoryHoldSeconds, 12);
    assert.equal(result.state, candidate.state);
    assert.deepEqual(result.state.victoryHoldState.progressSeconds, [0, 0]);
    const advancing = structuredClone(candidate);
    advancing.state.victoryHoldState.activeTeams[0] = true;
    advancing.state.victoryHoldState.progressSeconds[0] = 1;
    advancing.matchModeId = 'authored';
    assert.equal(replay.validateCheckpoint(advancing).state, advancing.state, 'the authored twelve-second hold admits one second of progress');
    advancing.matchModeId = 'skirmish';
    const advancingBytes = JSON.stringify(advancing);
    assert.throws(() => replay.validateCheckpoint(advancing), { message: 'Invalid match checkpoint: invalid victory hold state' },
      'the same progress is invalid under effective Skirmish rules');
    assert.equal(JSON.stringify(advancing), advancingBytes);
    assert.throws(() => replay.restore(candidate), { message: 'Invalid match checkpoint: shipped map changed since checkpoint' });
    assert.equal(JSON.stringify(candidate), bytes);
    assert.deepEqual(replay.checkpoint(), world, 'catalog compatibility belongs to restore, before activation');
  } finally { await fixture.dispose(); }
});

test('ordinary checkpoint rejection priority and restore errors retain input/live-state parity', async () => {
  const fixture = await createPveHeadlessFixture(map, { matchModeId: 'skirmish', matchModeVersion: 1 });
  const replay = fixture.replay;
  try {
    const valid = replay.checkpoint(), world = replay.checkpoint();
    const cases = [
      ['schema before economy', s => { s.schemaVersion = 29; s.rulesetRevision = 'wrong'; }, 'Invalid match checkpoint: unsupported schema version'],
      ['economy before faction', s => { s.rulesetRevision = 'wrong'; s.factionId = 'wrong'; }, 'Invalid match checkpoint: economy profile or gameplay ruleset revision mismatch'],
      ['bank before faction', s => { s.state.teamFood[0] = -1; s.factionId = 'wrong'; }, 'Invalid match checkpoint: invalid food bank'],
      ['faction before rules', s => { s.factionId = 'wrong'; s.rulesVersion = 99; }, 'Invalid match checkpoint: unsupported faction'],
      ['rules before sequence', s => { s.rulesVersion = 99; s.sequence = 0; }, 'Invalid match checkpoint: unsupported game rules version'],
      ['sequence before time', s => { s.sequence = 0; s.savedAt = 0; }, 'Invalid match checkpoint: invalid sequence'],
      ['time before match identity', s => { s.savedAt = 0; s.matchId = ''; }, 'Invalid match checkpoint: invalid save time'],
      ['match identity before map', s => { s.matchId = ''; s.mapDefinition.width = 15; }, 'Invalid match checkpoint: invalid match identity'],
      ['map before mode', s => { s.mapDefinition.width = 15; s.matchModeId = 'unknown'; }, 'Map match checkpoint width and height must be integers between 16 and 256.'],
      ['mode before checksum', s => { s.matchModeId = 'unknown'; s.mapHash = ''; }, 'Invalid match checkpoint: Unsupported matchModeId: unknown'],
      ['checksum before forest', s => { s.mapHash = ''; s.state.forestStocks = null; }, 'Invalid match checkpoint: map checksum mismatch'],
      ['exploration before counters', s => { s.state.explored[0] = 'invalid'; s.state.nextPlayerId = 0; }, 'Invalid match checkpoint: invalid exploration grid'],
    ];
    for (const [label, change, expected] of cases) {
      const candidate = structuredClone(valid); change(candidate);
      const bytes = JSON.stringify(candidate);
      for (const method of ['validateCheckpoint', 'restore']) {
        assert.throws(() => replay[method](candidate), { name: 'Error', message: expected }, `${method}: ${label}`);
        assert.equal(JSON.stringify(candidate), bytes, `${method}: ${label} retains serialized input`);
        assert.deepEqual(replay.checkpoint(), world, `${method}: ${label} retains live authority`);
      }
    }
    for (const value of [undefined, null, [], 'checkpoint', 30]) {
      assert.throws(() => replay.validateCheckpoint(value), { message: 'Invalid match checkpoint: expected an object' });
    }
  } finally { await fixture.dispose(); }
});

test('XL route and JSON preflights run before schema and ordinary map admission', async () => {
  const fixture = await createPveHeadlessFixture(map, { matchModeId: 'skirmish', matchModeVersion: 1 });
  const replay = fixture.replay;
  try {
    const valid = replay.checkpoint(), world = replay.checkpoint();
    const cases = [
      ['route before state quota and schema', s => { s.state.units[0].path = [-1]; s.state.buildings = null; }, 'Invalid match checkpoint: XL route budget invalid cell index', undefined],
      ['state quota before schema', s => { s.state.buildings = null; }, 'Invalid match checkpoint: XL JSON budget invalid buildings table', 'CHECKPOINT_REJECTED'],
      ['under both quotas reaches schema', () => {}, 'Invalid match checkpoint: unsupported schema version', undefined],
    ];
    for (const [label, change, message, code] of cases) {
      const candidate = structuredClone(valid);
      Object.assign(candidate.mapDefinition, { width: 320, height: 320 });
      candidate.schemaVersion = 29; change(candidate);
      const bytes = JSON.stringify(candidate);
      for (const method of ['validateCheckpoint', 'restore']) {
        assert.throws(() => replay[method](candidate), error => {
          assert.equal(error.message, message, label);
          assert.equal(error.code, code, label);
          return true;
        });
        assert.equal(JSON.stringify(candidate), bytes, `${label}: input preserved`);
        assert.deepEqual(replay.checkpoint(), world, `${label}: live authority preserved`);
      }
    }
  } finally { await fixture.dispose(); }
});
