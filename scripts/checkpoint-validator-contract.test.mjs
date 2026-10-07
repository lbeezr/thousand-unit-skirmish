import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { createPveHeadlessFixture, assertRecoveredWorkerObservation } from './pve-headless-fixture.mjs';
import { createAuthoritativeMapValidatorFixture } from './fixtures/authoritative-map-validator-fixture.mjs';
import { TECHNOLOGY_DEFINITIONS, UNIT_DEFINITIONS } from '../src/gameplay-definitions.mjs';

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

const checkpointScenarioMap = {
  ...bareMap(), startingArmySize: 24, terrainSeed: 71, terrainBase: 'meadow',
  victoryMode: 'all', victoryHoldSeconds: 12,
  triggers: [0, 1].map(i => ({ id: `capture-${i}`, name: `Capture ${i}`, type: 'capture-zone',
    zone: { column: 14, row: 6 + i * 18, width: 2, height: 2 },
    requiredUnits: 1, captureSeconds: 2, victory: true })),
  regions: [{ id: 'arrival', name: 'Arrival', zone: { column: 28, row: 28, width: 2, height: 2 } }],
  scenarioEvents: [
    timedEvent({ id: 'plain' }),
    timedEvent({ id: 'repeat-time', repeatCount: 2, repeatEverySeconds: 5 }),
    timedEvent({ id: 'captured', team: 'capturing', trigger: { type: 'capture', objectiveId: 'capture-0' } }),
    timedEvent({ id: 'repeat-capture', team: 'capturing', repeatCount: 2, repeatEverySeconds: 5,
      trigger: { type: 'capture', objectiveId: 'capture-0' } }),
    timedEvent({ id: 'region', trigger: { type: 'region-entry', regionId: 'arrival', team: '0' } }),
    timedEvent({ id: 'construction', trigger: { type: 'construction-complete', buildingType: 'barracks', team: '0' } }),
    timedEvent({ id: 'research', trigger: { type: 'research-complete', technologyId: 'food-tools', team: '0' } }),
    timedEvent({ id: 'chain', team: 'capturing', trigger: { type: 'event', eventId: 'captured' } }),
    timedEvent({ id: 'join', trigger: { type: 'event', eventIds: ['captured', 'plain'] } }),
  ],
};
const checkpointEvent = (snapshot, id) => snapshot.state.scenarioEventStates.find(event => event.id === id);

test('roster checkpoint: living plus queued population retains its boundary, first error and input identity', async () => {
  const fixture = await createPveHeadlessFixture({ ...bareMap(64), startingArmySize: 2000 });
  try {
    const r = fixture.replay, world = r.checkpoint();
    const queueWorker = (snapshot, team) => Object.assign(snapshot.state.workerProduction[team],
      { queue: 1, trainingRemaining: 1 });
    const accepted = [
      ['full living roster', () => {}],
      ...[0, 1].map(team => [`dead slot admits one queued Worker for team ${team}`, s => {
        s.state.units.find(unit => unit.team === team).hp = 0;
        queueWorker(s, team);
      }]),
    ];
    for (const [label, change] of accepted) {
      const snapshot = structuredClone(world); change(snapshot);
      const bytes = JSON.stringify(snapshot);
      assert.equal(r.validateCheckpoint(snapshot).state, snapshot.state, label);
      assert.equal(JSON.stringify(snapshot), bytes, label);
      assert.deepEqual(r.checkpoint(), world, label);
    }
    for (const [label, change, message] of [
      ...[0, 1].map(team => [`living plus queued overflow for team ${team}`, s => queueWorker(s, team),
        'team population exceeds its living-unit and queued-production cap']),
      ['population precedes unexpected mode state', s => { queueWorker(s, 0); s.state.bannerfall = null; },
        'team population exceeds its living-unit and queued-production cap'],
      ['earlier route error precedes population', s => { queueWorker(s, 0); s.state.units[0].path = null; },
        'invalid unit route 0'],
    ]) {
      const snapshot = structuredClone(world); change(snapshot);
      const bytes = JSON.stringify(snapshot);
      for (const consume of [s => r.validateCheckpoint(s), s => r.restore(s)]) {
        assert.throws(() => consume(snapshot), { name: 'Error', message: `Invalid match checkpoint: ${message}` }, label);
        assert.equal(JSON.stringify(snapshot), bytes, label);
        assert.deepEqual(r.checkpoint(), world, label);
      }
    }
  } finally { await fixture.dispose(); }
});

test('non-Bannerfall checkpoints retain explicit mode admission and late rejection order', async () => {
  const fixture = await createPveHeadlessFixture({ ...bareMap(), startingArmySize: 24 });
  try {
    const r = fixture.replay, world = r.checkpoint();
    for (const [label, change, message] of [
      ['present null mode state', s => { s.state.bannerfall = null; }, 'Bannerfall state requires its explicit mode identity'],
      ['present undefined mode state', s => { s.state.bannerfall = undefined; }, 'Bannerfall state requires its explicit mode identity'],
      ['mode-specific winner reason', s => { s.state.matchWinnerReason = 'stronghold-destruction'; }, 'Bannerfall state requires its explicit mode identity'],
      ['earlier exploration error', s => { s.state.bannerfall = null; s.state.explored[0] = ''; }, 'invalid exploration grid'],
      ['earlier target error', s => { s.state.bannerfall = null; s.state.units[0].attackTargetId = 24; }, 'invalid unit combat state 0'],
    ]) {
      const snapshot = structuredClone(world); change(snapshot);
      const bytes = JSON.stringify(snapshot);
      for (const consume of [s => r.validateCheckpoint(s), s => r.restore(s)]) {
        assert.throws(() => consume(snapshot), { name: 'Error', message: `Invalid match checkpoint: ${message}` }, label);
        assert.equal(JSON.stringify(snapshot), bytes, label);
        assert.deepEqual(r.checkpoint(), world, label);
      }
    }
  } finally { await fixture.dispose(); }
});

const bannerfallCheckpointMap = JSON.parse(await readFile(new URL('../maps/bannerfall-arena.json', import.meta.url), 'utf8'));
const startBannerfallCheckpoint = snapshot => { snapshot.state.scenarioClockStarted = true; };
const checkpointRider = (snapshot, unit) => {
  unit.kind = 'rider'; unit.hp = UNIT_DEFINITIONS.rider.combat.maxHp;
  snapshot.state.bannerfall.kills[unit.team] = 6;
};
const checkpointVoluntaryResult = (snapshot, resignedTeam = null) => {
  startBannerfallCheckpoint(snapshot);
  const reason = resignedTeam === null ? 'agreed-draw' : 'resignation';
  const winner = resignedTeam === null ? 2 : 1 - resignedTeam;
  Object.assign(snapshot.state, { matchWinner: winner, matchWinnerReason: reason,
    voluntaryEndings: { ...snapshot.state.voluntaryEndings, revision: 1,
      result: resignedTeam === null ? { reason, winner, agreedTeams: [0, 1] } : { reason, winner, resignedTeam } } });
};

test('Bannerfall checkpoint: waiting, evolved and stronghold saves preserve validated state and restore', async () => {
  const fixture = await createPveHeadlessFixture(bannerfallCheckpointMap, { matchModeId: 'bannerfall', matchModeVersion: 1 });
  try {
    const r = fixture.replay, world = r.checkpoint();
    for (const [label, change] of [
      ['waiting opening', () => {}],
      ['started opening', startBannerfallCheckpoint],
      ['evolved Rider', s => { startBannerfallCheckpoint(s); checkpointRider(s, s.state.units[0]); }],
      ['expired due waves', s => { startBannerfallCheckpoint(s); s.state.matchElapsedSeconds = 30; }],
      ['agreed draw with live strongholds', s => checkpointVoluntaryResult(s)],
      ...[0, 1].map(team => [`resignation by team ${team}`, s => checkpointVoluntaryResult(s, team)]),
      ...[0, 1].map(team => [`destroyed stronghold ${team}`, s => {
        startBannerfallCheckpoint(s); s.state.homeTownCenters[team].hp = 0;
        s.state.matchWinner = 1 - team; s.state.matchWinnerReason = 'stronghold-destruction';
      }]),
      ['both strongholds destroyed', s => {
        startBannerfallCheckpoint(s); s.state.homeTownCenters.forEach(home => { home.hp = 0; });
        s.state.matchWinner = 2; s.state.matchWinnerReason = 'stronghold-destruction';
      }],
      ['unknown outer state field', s => { s.state.retainedContractField = { untouched: true }; }],
    ]) {
      const snapshot = structuredClone(world); change(snapshot);
      const bytes = JSON.stringify(snapshot), before = r.checkpoint();
      const result = r.validateCheckpoint(snapshot);
      assert.equal(result.state, snapshot.state, label);
      assert.equal(result.state.bannerfall, snapshot.state.bannerfall, 'the rule validator clone does not replace saved state');
      assert.equal(JSON.stringify(snapshot), bytes, label);
      assert.deepEqual(r.checkpoint(), before, label);
      r.restore(snapshot);
      const restored = r.checkpoint();
      for (const key of ['units', 'bannerfall', 'workerProduction', 'homeTownCenters', 'matchWinner',
        'matchWinnerReason', 'matchWinnerTriggerId', 'scenarioClockStarted', 'matchElapsedSeconds']) {
        assert.deepEqual(restored.state[key], snapshot.state[key], `${label}: ${key}`);
      }
      assert.equal(JSON.stringify(snapshot), bytes, label);
    }
  } finally { await fixture.dispose(); }
});

test('Bannerfall checkpoint: exact delegated, roster, result and waiting errors preserve first-error order', async () => {
  const fixture = await createPveHeadlessFixture(bannerfallCheckpointMap, { matchModeId: 'bannerfall', matchModeVersion: 1 });
  try {
    const r = fixture.replay, world = r.checkpoint();
    const cases = [
      ['rule version before roster', s => { s.state.bannerfall.version = 2; s.state.currentArmySize = 18; }, 'Invalid Bannerfall state: unsupported version'],
      ['rule fields before result', s => { s.state.bannerfall.extra = true; s.state.matchWinnerTriggerId = 'unknown'; }, 'Invalid Bannerfall state: expected exact state fields'],
      ['rule kill counters', s => { s.state.bannerfall.kills[0] = 7; }, 'Invalid Bannerfall state: invalid kill counters'],
      ['opening army size', s => { s.state.currentArmySize = 18; }, 'invalid Bannerfall roster or economy'],
      ['foreign unit kind', s => { s.state.units[0].kind = 'scout'; s.state.units[0].hp = UNIT_DEFINITIONS.scout.combat.maxHp; }, 'invalid Bannerfall roster or economy'],
      ['Rider before evolution', s => { s.state.units[0].kind = 'rider'; s.state.units[0].hp = UNIT_DEFINITIONS.rider.combat.maxHp; }, 'invalid Bannerfall roster or economy'],
      ['weighted live population', s => { startBannerfallCheckpoint(s); s.state.units.filter(u => u.team === 0).forEach(u => checkpointRider(s, u)); }, 'invalid Bannerfall roster or economy'],
      ['friendly attack target', s => { s.state.units[0].attackTargetId = s.state.units.find(u => u.team === s.state.units[0].team && u.id !== 0).id; }, 'invalid Bannerfall roster or economy'],
      ['economy before result', s => { s.state.teamFood[0] = 1; s.state.matchWinnerTriggerId = 'unknown'; }, 'invalid Bannerfall roster or economy'],
      ['queued production', s => { Object.assign(s.state.workerProduction[0], { queue: 1, trainingRemaining: 1 }); }, 'invalid Bannerfall roster or economy'],
      ['stronghold winner', s => { startBannerfallCheckpoint(s); s.state.homeTownCenters[0].hp = 0; }, 'invalid Bannerfall stronghold result'],
      ['stronghold reason', s => { s.state.matchWinnerReason = 'elimination'; }, 'invalid Bannerfall stronghold result'],
      ['voluntary result after destroyed stronghold', s => { checkpointVoluntaryResult(s, 0); s.state.homeTownCenters[0].hp = 0; }, 'invalid Bannerfall stronghold result'],
      ['result before waiting', s => { s.state.matchWinnerTriggerId = 'unknown'; s.state.units[0].hp = 1; }, 'invalid Bannerfall stronghold result'],
      ['waiting clock', s => { s.state.matchElapsedSeconds = 1; }, 'waiting Bannerfall cannot contain completed gameplay'],
      ['waiting kills', s => { s.state.bannerfall.kills[0] = 1; }, 'waiting Bannerfall cannot contain completed gameplay'],
      ['waiting damaged unit', s => { s.state.units[0].hp = 1; }, 'waiting Bannerfall cannot contain completed gameplay'],
      ['waiting dead unit', s => { s.state.units[0].hp = 0; }, 'waiting Bannerfall cannot contain completed gameplay'],
      ['waiting damaged stronghold', s => { s.state.homeTownCenters[0].hp = 1; }, 'waiting Bannerfall cannot contain completed gameplay'],
    ];
    for (const [label, change, reason] of cases) {
      const snapshot = structuredClone(world); change(snapshot);
      const bytes = JSON.stringify(snapshot);
      const message = reason.startsWith('Invalid Bannerfall state:') ? reason : `Invalid match checkpoint: ${reason}`;
      for (const consume of [s => r.validateCheckpoint(s), s => r.restore(s)]) {
        assert.throws(() => consume(snapshot), { name: 'Error', message }, label);
        assert.equal(JSON.stringify(snapshot), bytes, label);
        assert.deepEqual(r.checkpoint(), world, label);
      }
    }
  } finally { await fixture.dispose(); }
});

for (const mode of ['authored', 'objective-control']) test(`${mode}: scenario checkpoint validation and restore retain state and bytes`, async () => {
  const fixture = await createPveHeadlessFixture(checkpointScenarioMap, { matchModeId: mode, matchModeVersion: 1 });
  try {
    const r = fixture.replay, snapshot = r.checkpoint(), world = structuredClone(snapshot), bytes = JSON.stringify(snapshot);
    const result = r.validateCheckpoint(snapshot);
    assert.equal(result.state, snapshot.state);
    assert.deepEqual(result.definition.scenarioEvents, checkpointScenarioMap.scenarioEvents);
    assert.equal(result.definition.victoryHoldSeconds, 12, 'the return remains canonical in both modes');
    assert.equal(JSON.stringify(snapshot), bytes);
    assert.deepEqual(r.checkpoint(), world);
    r.restore(snapshot);
    assert.deepEqual(r.checkpoint(), world, 'the existing restore consumer retains all scenario state');
  } finally { await fixture.dispose(); }
});

test('scenario checkpoint: exact first errors retain caller ordering and live-state/input parity', async () => {
  const fixture = await createPveHeadlessFixture(checkpointScenarioMap, { matchModeId: 'authored', matchModeVersion: 1 });
  try {
    const r = fixture.replay, world = r.checkpoint();
    const activate = (s, id, team = 0) => Object.assign(checkpointEvent(s, id), { activatedAtSeconds: 0, triggeredByTeam: team, fired: true });
    const cases = [
      ['earlier building ID', s => { s.state.nextBuildingId = 0; s.state.triggerStates = null; }, 'invalid next building ID'],
      ['trigger table before event/clock', s => { s.state.triggerStates = null; s.state.scenarioEventStates = null; s.state.matchElapsedSeconds = -1; }, 'invalid trigger states'],
      ['trigger duplicate', s => { s.state.triggerStates[1] = structuredClone(s.state.triggerStates[0]); }, 'invalid trigger state'],
      ['trigger owner', s => { s.state.triggerStates[0].owner = 2; }, 'invalid trigger state'],
      ['trigger progress', s => { s.state.triggerStates[0].progress = 2.01; }, 'invalid trigger state'],
      ['trigger count cap', s => { s.state.triggerStates[0].unitCounts[0] = 2001; }, 'invalid trigger state'],
      ['event table before hold', s => { s.state.scenarioEventStates = null; delete s.state.victoryHoldState; }, 'invalid scenario event states'],
      ['event duplicate', s => { s.state.scenarioEventStates[1] = structuredClone(s.state.scenarioEventStates[0]); }, 'invalid scenario event state'],
      ['event fired type', s => { checkpointEvent(s, 'plain').fired = 1; }, 'invalid scenario event state'],
      ['repeat count', s => { checkpointEvent(s, 'repeat-time').fireCount = -1; }, 'invalid repeating scenario event state'],
      ['repeat upper count', s => { checkpointEvent(s, 'repeat-time').fireCount = 4; }, 'invalid repeating scenario event state'],
      ['repeat fired schedule', s => { checkpointEvent(s, 'repeat-time').fired = true; }, 'invalid repeating scenario event state'],
      ['plain unexpected repeat fields', s => { checkpointEvent(s, 'plain').fireCount = 0; }, 'unexpected repeating scenario event state'],
      ['capture awaiting team', s => { checkpointEvent(s, 'captured').triggeredByTeam = 0; }, 'invalid triggered scenario event state'],
      ['capture activation beyond clock', s => { Object.assign(checkpointEvent(s, 'captured'), { activatedAtSeconds: 1, triggeredByTeam: 0 }); }, 'invalid triggered scenario event state'],
      ['region entering team', s => { activate(s, 'region', 1); }, 'invalid region event entering team'],
      ['construction completion team', s => { activate(s, 'construction', 1); }, 'invalid region event entering team'],
      ['research completion team', s => { activate(s, 'research', 1); }, 'invalid region event entering team'],
      ['chain before source', s => { activate(s, 'chain'); }, 'invalid chained scenario event state'],
      ['join before sources', s => { activate(s, 'join'); }, 'invalid chained scenario event state'],
      ['awaiting repeat-capture count', s => { checkpointEvent(s, 'repeat-capture').fireCount = 1; }, 'invalid repeating triggered scenario event schedule'],
      ['missing hold before clock', s => { delete s.state.victoryHoldState; s.state.matchElapsedSeconds = -1; }, 'missing victory hold state'],
      ['inactive hold progress', s => { s.state.victoryHoldState.progressSeconds[0] = 1; }, 'invalid victory hold state'],
      ['hold duration', s => { s.state.victoryHoldState.activeTeams[0] = true; s.state.victoryHoldState.progressSeconds[0] = 12.01; }, 'invalid victory hold state'],
      ['hold trigger', s => { s.state.victoryHoldState.triggerIds = ['unknown', null]; }, 'invalid victory hold state'],
      ['later clock', s => { s.state.matchElapsedSeconds = -1; }, 'invalid match result or clock'],
    ];
    for (const [label, change, detail] of cases) {
      const candidate = structuredClone(world); change(candidate); const bytes = JSON.stringify(candidate);
      for (const method of ['validateCheckpoint', 'restore']) {
        assert.throws(() => r[method](candidate), { name: 'Error', message: `Invalid match checkpoint: ${detail}` }, `${label}: ${method}`);
        assert.equal(JSON.stringify(candidate), bytes, `${label}: input bytes`);
        assert.deepEqual(r.checkpoint(), world, `${label}: live authority`);
      }
    }
  } finally { await fixture.dispose(); }
});

test('scenario checkpoint: accepted legacy/default and event-chain boundaries retain state identity', async () => {
  const fixture = await createPveHeadlessFixture(checkpointScenarioMap, { matchModeId: 'authored', matchModeVersion: 1 });
  try {
    const r = fixture.replay, world = r.checkpoint();
    const cases = [
      ['trigger count cap', s => { s.state.triggerStates[0].unitCounts = [2000, 2000]; }],
      ['null victory-hold default', s => { s.state.victoryHoldState = null; }],
      ['hold duration cap', s => { s.state.victoryHoldState.activeTeams[0] = true; s.state.victoryHoldState.progressSeconds[0] = 12; s.state.victoryHoldState.triggerIds = ['capture-0', null]; }],
      ['completed timed repeat', s => { Object.assign(checkpointEvent(s, 'repeat-time'), { fireCount: 3, fired: true, nextFireAtSeconds: null }); }],
      ['mixed joined-source team', s => {
        Object.assign(checkpointEvent(s, 'captured'), { fired: true, activatedAtSeconds: 0, triggeredByTeam: 0 });
        Object.assign(checkpointEvent(s, 'chain'), { fired: true, activatedAtSeconds: 0, triggeredByTeam: 0 });
        checkpointEvent(s, 'plain').fired = true;
        Object.assign(checkpointEvent(s, 'join'), { fired: true, activatedAtSeconds: 0, triggeredByTeam: -1 });
      }],
      ['unknown scenario fields', s => { s.state.triggerStates[0].extra = { retained: true }; checkpointEvent(s, 'plain').extra = 7; }],
    ];
    for (const [label, change] of cases) {
      const candidate = structuredClone(world); change(candidate); const bytes = JSON.stringify(candidate);
      const result = r.validateCheckpoint(candidate);
      assert.equal(result.state, candidate.state, label);
      assert.equal(JSON.stringify(candidate), bytes, `${label}: input bytes`);
      assert.deepEqual(r.checkpoint(), world, `${label}: live authority`);
    }
  } finally { await fixture.dispose(); }
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
