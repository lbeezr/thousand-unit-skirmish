import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { generateFarMarches, XL_LAYOUT as layout } from './generate-far-marches.mjs';
import { runXlBoundaryAudit, crossingTopology, assertCheckpointEnvelopeConsumer,
  assertAuthoritativeMapValidatorConsumer, assertCheckpointScenarioStateConsumer,
  assertCheckpointRosterConsumer } from './xl-map-boundary-audit.mjs';
import { buildElevationGrid, validateElevationPatches } from '../src/map-utils.mjs';
import { planWallLine } from '../src/wall-line-planner.mjs';
import { compressGroundLevels } from '../src/terrain-authoring.mjs';
import { createMapStudioDraftStore, MAP_STUDIO_DRAFT_VERSION } from '../src/authoring/map-studio-draft-store.mjs';

const map = JSON.parse(await readFile(new URL('./fixtures/xl-far-marches.json', import.meta.url)));
const report = await runXlBoundaryAudit(), audit = report.candidate.geometry;
const envelopeSource = await readFile(new URL('../src/server/checkpoint-envelope.mjs', import.meta.url), 'utf8');
const authoritySource = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
const side = layout.side, levels = buildElevationGrid(side, side, map.elevationPatches);
const scenery = new Uint8Array(side * side);
for (const o of map.obstacles) for (let y = o.row; y < o.row + o.height; y++) for (let x = o.column; x < o.column + o.width; x++) {
  assert.equal(scenery[y * side + x], 0); scenery[y * side + x] = 1;
}
const cell = p => Math.floor(p.z + side / 2) * side + Math.floor(p.x + side / 2);

test('XL proposal is deterministic and absent from the shipped map pool', async () => {
  assert.deepEqual(await generateFarMarches(), map);
  assert.equal((await readdir(new URL('../maps/', import.meta.url))).includes('veyrholds-far-marches.json'), false);
  assert.deepEqual([map.width, map.height, map.startingArmySize], [320, 320, 24]);
  assert.deepEqual(map.startingResources, { food: 150, wood: 250 });
  assert.equal(map.fogOfWar, true); assert.ok(map.summary.length <= 120);
  assert.deepEqual([map.triggers, map.scenarioEvents], [[], []]);
  assert.equal(map.economyProfileId, undefined); assert.equal(map.timedVictory, undefined);
  assert.equal(validateElevationPatches(side, side, map.elevationPatches), null);
});

test('connected useful land meets XL pacing before and after forest clearing', () => {
  assert.equal(audit.geometry.initialWalkableCells, 92106);
  assert.deepEqual(audit.geometry.reachableCellsBySeat, [92106, 92106]);
  assert.equal(audit.travel.minimumElevationCostRoute.worldLength, 287);
  assert.equal(audit.travel.allForestClearedRoute.worldLength, 287);
  assert.deepEqual(audit.travel.minimumElevationCostRoute.nominalTravelSeconds,
    { worker: 110.385, infantry: 110.385, scout: 63.778 });
  assert.deepEqual(report.candidate.crossingTopology.alternatives.map(r => [r.declaredPassRows, r.worldLength, r.reachable]),
    [[22, 287, true], [22, 325, true], [16, 467, true], [16, 467, true]]);
  assert.deepEqual(report.candidate.crossingTopology.allDeclaredCrossingsClosed,
    { opposingHomeReachable: false, shortestBypassWorldLength: null,
      scope: 'static initial terrain; closes complete width of both ridge bands inside every declared crossing' });
});

test('closing all four complete ridge bands detects the independently found shoulder bypass', () => {
  const oldLevels = levels.slice();
  for (const row of [123, 146, 193, 216]) for (let column = 0; column < side; column++) {
    const outer = Math.min(column, side - 1 - column);
    if (outer >= 126 && outer <= 140) oldLevels[row * side + column] = 1;
  }
  const oldGeometry = { ...map, elevationPatches: compressGroundLevels(oldLevels, side, side) };
  const bypass = crossingTopology(oldGeometry).allDeclaredCrossingsClosed;
  assert.equal(bypass.opposingHomeReachable, true);
  assert.equal(bypass.shortestBypassWorldLength, 289);
});

test('57-square flat homes and five mirrored resource-free expansion campuses fit cities', () => {
  for (const [cx, cy] of layout.homes) for (let y = cy - 28; y <= cy + 28; y++) for (let x = cx - 28; x <= cx + 28; x++) {
    assert.equal(scenery[y * side + x], 0); assert.equal(levels[y * side + x], 1);
  }
  assert.deepEqual(audit.buildingSpace.cityTemplate.staticGreedyFlatPadFitsBySeat.map(s => s.placedBuildings), [30, 30]);
  const nodes = new Set(map.resourceNodes.map(cell));
  for (const [left, cy, level] of layout.sites) for (const cx of [left, side - 1 - left]) {
    for (let y = cy - 9; y <= cy + 9; y++) for (let x = cx - 9; x <= cx + 9; x++) assert.equal(levels[y * side + x], level);
    for (let y = cy - 5; y <= cy + 5; y++) for (let x = cx - 5; x <= cx + 5; x++) {
      assert.equal(scenery[y * side + x], 0); assert.equal(nodes.has(y * side + x), false);
    }
  }
});

test('paired stocks/access are symmetric and retain the nine-world-unit home-resource predicate', () => {
  for (let y = 0; y < side; y++) for (let x = 0; x < side / 2; x++) {
    assert.equal(scenery[y * side + x], scenery[y * side + side - 1 - x]);
    assert.equal(levels[y * side + x], levels[y * side + side - 1 - x]);
  }
  assert.deepEqual(audit.economy.ordinaryNodeStockTotals, { food: 22900, wood: 28350 });
  assert.equal(audit.economy.initialForestWoodPotential, 61572);
  for (const node of audit.economy.resources.filter(r => r.id.startsWith('s0-'))) {
    const mirror = audit.economy.resources.find(r => r.id === node.id.replace('s0-', 's1-'));
    assert.equal(node.stock, mirror.stock);
    assert.deepEqual(node.shortestCostRouteWorldLengths, [...mirror.shortestCostRouteWorldLengths].reverse());
    assert.ok(node.shortestCostRouteWorldLengths.every(Number.isFinite));
  }
  for (const team of [0, 1]) for (const type of ['food', 'wood']) {
    const home = map.spawnPoints[team], node = map.resourceNodes.find(r => r.id === `s${team}-home-${type}`);
    assert.ok(Math.hypot(home.x - node.x, home.z - node.z) <= 9);
  }
});

test('all current dimension consumers agree on256 and reject both320 rectangular orientations', () => {
  assert.deepEqual(report.dimensions.limits, { server: 256, studioRestore: 256, studioImport: 256,
    studioResize: 256, studioHtml: [256, 256] });
  for (const row of report.dimensions.boundaryMatrix) {
    const expected = row.width <= 256 && row.height <= 256;
    for (const [consumer, accepted] of Object.entries(row).filter(([key]) => !['width', 'height'].includes(key)))
      assert.equal(accepted, expected, `${row.width}x${row.height}:${consumer}`);
  }
  // Geometry and waypoints are separate bounds: raising map size later must not
  // silently increase the current wall command's256-waypoint allowance.
  assert.throws(() => planWallLine({ width: 256, height: 256,
    points: Array.from({ length: 257 }, () => ({ column: 0, row: 0 })) }), TypeError);
});

test('authority dimension evidence follows the actual module and unchanged host policy binding', async () => {
  const expected = createHash('sha256').update(await readFile(new URL('../src/server/map-definition-validator.mjs', import.meta.url))).digest('hex');
  assert.equal(report.sourceInputSha256['src/server/map-definition-validator.mjs'], expected);
  assert.equal(report.gridCostProvenance.sourceInputSha256['src/server/map-definition-validator.mjs'], expected);
  assert.doesNotThrow(() => assertAuthoritativeMapValidatorConsumer(authoritySource));
  for (const [before, after] of [
    ["from './src/server/map-definition-validator.mjs'", "from './src/authoring/map-import-validator.mjs'"],
    ['maxUnits: MAX_UNITS, maxMapObstacles: MAX_MAP_OBSTACLES,', 'maxUnits: 4000, maxMapObstacles: MAX_MAP_OBSTACLES,'],
    ['MIN_SCENARIO_EVENT_REPEAT_SECONDS, researchRulesFor,', 'MIN_SCENARIO_EVENT_REPEAT_SECONDS, researchRulesFor: researchRulesFor(),'],
    ['return authoritativeMapValidator(definition, filename);', 'return definition;'],
  ]) {
    assert.ok(authoritySource.includes(before), before);
    assert.throws(() => assertAuthoritativeMapValidatorConsumer(authoritySource.replace(before, after)),
      /Authoritative map validator binding\/policy moved/);
  }
});

test('draft restore dimension evidence follows the bound helper and actual recovery acceptance', () => {
  const store = createMapStudioDraftStore({ getStorage: () => {
    throw new Error('The guard must not access browser storage.');
  } });
  assert.match(report.sourceInputSha256['src/authoring/map-studio-draft-store.mjs'], /^[a-f0-9]{64}$/);
  assert.match(report.sourceInputSha256['src/authoring/map-studio/draft/v1/contract.mjs'], /^[a-f0-9]{64}$/);
  assert.match(report.sourceInputSha256['src/world/scenario-event-chain.mjs'], /^[a-f0-9]{64}$/);
  assert.match(report.sourceInputSha256['src/world/capture-prerequisites.mjs'], /^[a-f0-9]{64}$/);
  for (const row of report.dimensions.boundaryMatrix) {
    const definition = { width: row.width, height: row.height, obstacles: [], spawnPoints: [] };
    const draft = { version: MAP_STUDIO_DRAFT_VERSION, sourceMapId: 'audit', editor: { definition } };
    if (row.studioRestoreDimensionGate) assert.equal(store.requireRecovery(draft, 'audit').definition, definition);
    else assert.throws(() => store.requireRecovery(draft, 'audit'), /saved draft could not be read/);
  }
});

test('checkpoint audit follows the actual private envelope binding, limits and preflight order', () => {
  assert.doesNotThrow(() => assertCheckpointEnvelopeConsumer(authoritySource, envelopeSource));
  const route = '  preflightXlCheckpointRoutes(snapshot.mapDefinition, snapshot.state,\n    { maxUnits, maxResourceNodes });\n';
  const state = '  preflightXlCheckpointState(snapshot,\n    { maxUnits, maxBuildings, maxResourceNodes });\n';
  assert.ok(envelopeSource.includes(route + state));
  for (const [source, envelope] of [
    [authoritySource.replace("from './src/server/checkpoint-envelope.mjs'", "from './src/server/checkpoint-json-budget.mjs'"), envelopeSource],
    [authoritySource.replace('maxUnits: MAX_UNITS, maxBuildings: MAX_BUILDINGS, maxResourceNodes: MAX_RESOURCE_NODES,\n    validateMapDefinition,', 'maxUnits: 1, maxBuildings: MAX_BUILDINGS, maxResourceNodes: MAX_RESOURCE_NODES,\n    validateMapDefinition,'), envelopeSource],
    [authoritySource.replace('function validateMatchCheckpoint(snapshot) {', 'function validateMatchCheckpoint(snapshot) {\n  const savedPregame = validatePregameCheckpoint(state.pregame);'), envelopeSource],
    [authoritySource, envelopeSource.replace(route + state, state + route)],
  ]) assert.throws(() => assertCheckpointEnvelopeConsumer(source, envelope), /XL checkpoint preflight consumer\/ordering changed/);
});

test('scenario-state audit retains the effective map, actual unit cap and surrounding rejection order', async () => {
  const source = await readFile(new URL('../src/server/checkpoint-scenario-state.mjs', import.meta.url), 'utf8');
  assert.equal(report.sourceInputSha256['src/server/checkpoint-scenario-state.mjs'], createHash('sha256').update(source).digest('hex'));
  assert.doesNotThrow(() => assertCheckpointScenarioStateConsumer(authoritySource));
  const call = '  validateCheckpointScenarioState(definition, state, { maxUnits: MAX_UNITS });\n';
  assert.ok(authoritySource.includes(call));
  for (const changed of [
    authoritySource.replace("from './src/server/checkpoint-scenario-state.mjs'", "from './src/server/checkpoint-envelope.mjs'"),
    authoritySource.replace(call, call.replace('(definition,', '(canonicalDefinition,')),
    authoritySource.replace(call, call.replace('MAX_UNITS', '4000')),
    authoritySource.replace(call, ''),
    authoritySource.replace(call, '').replace('function validateMatchCheckpoint(snapshot) {', `function validateMatchCheckpoint(snapshot) {\n${call}`),
    authoritySource.replace(call, '').replace('  return { definition: canonicalDefinition, state, explored, savedMatchMode };', `${call}  return { definition: canonicalDefinition, state, explored, savedMatchMode };`),
  ]) assert.throws(() => assertCheckpointScenarioStateConsumer(changed), /Checkpoint scenario-state consumer\/ordering changed/);
});

test('both XL audit input hashes include the bound checkpoint envelope bytes', () => {
  const expected = createHash('sha256').update(envelopeSource).digest('hex');
  assert.equal(report.sourceInputSha256['src/server/checkpoint-envelope.mjs'], expected);
  assert.equal(report.checkpoint.xlJsonEnvelope.sourceInputSha256['src/server/checkpoint-envelope.mjs'], expected);
});

test('roster audit retains saved mode, actual population caps and terminal rejection order', async () => {
  const source = await readFile(new URL('../src/server/checkpoint-roster.mjs', import.meta.url), 'utf8');
  assert.equal(report.sourceInputSha256['src/server/checkpoint-roster.mjs'], createHash('sha256').update(source).digest('hex'));
  assert.doesNotThrow(() => assertCheckpointRosterConsumer(authoritySource));
  const call = '  validateCheckpointRoster(state, savedMatchMode, { maxUnits: MAX_UNITS, maxTeamRoster: MAX_TEAM_ROSTER });\n';
  assert.ok(authoritySource.includes(call));
  for (const changed of [
    authoritySource.replace("from './src/server/checkpoint-roster.mjs'", "from './src/server/checkpoint-envelope.mjs'"),
    authoritySource.replace(call, call.replace('savedMatchMode,', 'matchMode,')),
    authoritySource.replace(call, call.replace('MAX_UNITS', '4000')),
    authoritySource.replace(call, call.replace('MAX_TEAM_ROSTER', '2000')),
    authoritySource.replace(call, ''),
    authoritySource.replace(call, '').replace('function validateMatchCheckpoint(snapshot) {', `function validateMatchCheckpoint(snapshot) {\n${call}`),
    authoritySource.replace(call, '').replace('  return { definition: canonicalDefinition, state, explored, savedMatchMode };', `  return { definition: canonicalDefinition, state, explored, savedMatchMode };\n${call}`),
  ]) assert.throws(() => assertCheckpointRosterConsumer(changed), /Checkpoint roster consumer\/ordering changed/);
});

test('source-bound route/save/wire envelope distinguishes finite validation from observed cost', () => {
  assert.equal(report.routes.validatedEntriesPerPath, 102400);
  assert.equal(report.routes.maxValidatedPathJsonBytes, 716801);
  assert.equal(report.routes.validatedRouteArraysJsonBytesAtFullRoster, 2867204000);
  assert.equal(report.routes.atomicSearchExpandedCellsUpper, 102400);
  assert.equal(report.routes.callbackExpandedCellsThresholdBetweenSearches, 4096);
  assert.equal(report.routes.aggregateRouteRetentionBudget, null);
  assert.equal(report.checkpoint.explicitByteEnvelope, null);
  const preflight = report.checkpoint.xlRoutePreflight;
  assert.equal(preflight.maxRouteEntries, 1048576);
  assert.equal(preflight.maxAuxiliaryPathReferences, 4128);
  assert.equal(preflight.oneCopySlotPayloadBytesUpper, 8388608);
  assert.equal(preflight.acceptedBoundary.validatedEntries, 1048576);
  assert.equal(preflight.oversizedRejectedBeforeIndexReads.indexReads, 0);
  assert.equal(preflight.remaining.ordinary320Admission, 'closed');
  assert.equal(preflight.remaining.fileReadAndJsonParseByteEnvelope, 'XL bounded; legacy classification remains linear in file bytes');
  assert.equal(report.checkpoint.xlJsonEnvelope.limits.bytes, 33554432);
  assert.equal(report.checkpoint.xlJsonEnvelope.inspectionChunkBytes, 32768);
  assert.equal(report.transport.inboundFrameBytes, 1000000);
  assert.equal(report.transport.outboundQueuedAndFrameBytes, 4194304);
  assert.equal(report.transport.packedFogBytesPerSeat, 25600);
  assert.equal(report.candidate.compactMapJsonBytes, 89516);
  assert.equal(report.candidate.publicationCommandJsonBytes, 89559);
  assert.equal(report.candidate.publicationFitsCurrentInboundFrame, true);
  assert.equal(report.transport.actualWelcomeStateFrameMeasured, false);
  assert.equal(report.transport.actualCheckpointBytesMeasured, false);
  assert.equal(report.ordinaryXlComplete, false); assert.equal(report.limitsChanged, false);
  assert.match(report.sourceInputSha256['server.mjs'], /^[a-f0-9]{64}$/);
  assert.match(report.sourceInputSha256['src/gameplay-definitions.mjs'], /^[a-f0-9]{64}$/);
  assert.match(report.sourceInputSha256['src/terrain-authoring.mjs'], /^[a-f0-9]{64}$/);
  assert.match(report.runtimeProvenance.runtimeSha256, /^[a-f0-9]{64}$/);
  assert.equal(report.runtimeProvenance.sourceRevision, report.sourceCommit);
  assert.match(report.gridCostProvenance.sourceInputSha256['src/forest-fringe.mjs'], /^[a-f0-9]{64}$/);
  assert.equal(report.gates.supportedCapacity, null);
});
