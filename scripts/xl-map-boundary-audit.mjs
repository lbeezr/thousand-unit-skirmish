// Repeatable source/geometry audit. No map catalog, admission or save is changed.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { auditMap, searchGrid } from './map-scale-audit.mjs';
import { runGridCostAudit } from './map-grid-cost-audit.mjs';
import { performanceIdentity } from './performance-run-evidence.mjs';
import { XL_LAYOUT } from './generate-far-marches.mjs';
import { mapSizeIdentity, ordinaryMapCatalog } from '../src/map-size-policy.mjs';
import { planWallLine } from '../src/wall-line-planner.mjs';
import { createWaterRouteGraph } from '../src/water-route-graph.mjs';
import { buildElevationGrid } from '../src/map-utils.mjs';
import { townCenterFootprintCells } from '../src/town-center-spawn.mjs';
import { runCheckpointJsonBudgetAudit } from './checkpoint-json-budget-audit.mjs';
import { createMapStudioDraftStore } from '../src/authoring/map-studio-draft-store.mjs';
import { preflightXlCheckpointRoutes, XL_CHECKPOINT_ROUTE_MAX_ENTRIES,
  XL_CHECKPOINT_ROUTE_MAX_SIDE, XL_CHECKPOINT_ROUTE_LEGACY_SIDE,
  XL_CHECKPOINT_ROUTE_SLOT_BYTES } from '../src/server/checkpoint-route-budget.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const nativeDimensions = [[160, 160], [192, 192], [224, 224], [256, 256],
  [257, 256], [256, 257], [320, 160], [160, 320], [320, 320], [321, 320]];
function extractFunction(source, name) {
  const start = source.indexOf(`\nfunction ${name}(`);
  if (start < 0) throw new Error(`Source contract moved: ${name}`);
  const end = source.indexOf('\nfunction ', start + 1);
  if (end < 0) throw new Error(`Source function boundary moved: ${name}`);
  return source.slice(start, end);
}
function sourceNumber(source, pattern) {
  const match = source.match(pattern);
  if (!match) throw new Error(`Source contract moved: ${pattern}`);
  return Number(match[1]);
}
function accepts(call) {
  try { call(); return true; } catch { return false; }
}

// Bounded payload/operation witness, not a match or comparable performance run.
// The real authority remains gated at256; do not widen it for this probe.
export function xlCheckpointRouteProbe({ width, height }, { maxUnits, maxResourceNodes }) {
  const cells = width * height, limits = { maxUnits, maxResourceNodes };
  const before = process.memoryUsage(), paths = [];
  let remaining = XL_CHECKPOINT_ROUTE_MAX_ENTRIES;
  while (remaining > 0) {
    const length = Math.min(cells, remaining);
    paths.push(Array(length).fill(cells - 1)); remaining -= length;
  }
  const units = paths.map(path => ({ path, attackMoveResumePath: null }));
  const allocated = process.memoryUsage(), started = performance.now();
  const accepted = preflightXlCheckpointRoutes({ width, height }, { units, resourceNodes: [] }, limits);
  const preflightMilliseconds = performance.now() - started, validated = process.memoryUsage();
  const copies = paths.map(path => [...path]), copied = process.memoryUsage();
  if (copies.reduce((sum, path) => sum + path.length, 0) !== XL_CHECKPOINT_ROUTE_MAX_ENTRIES)
    throw new Error('Bounded route-copy witness changed.');
  let indexReads = 0;
  const unread = Array(cells);
  Object.defineProperty(unread, 0, { get() { indexReads++; throw new Error('Unexpected oversized payload read'); } });
  const oversized = Array.from({ length: Math.ceil((XL_CHECKPOINT_ROUTE_MAX_ENTRIES + 1) / cells) },
    () => ({ path: unread, attackMoveResumePath: null }));
  let rejection;
  try { preflightXlCheckpointRoutes({ width, height }, { units: oversized, resourceNodes: [] }, limits); }
  catch (error) { rejection = String(error.message); }
  if (!/exceeds aggregate cell entries/.test(rejection ?? '') || indexReads !== 0)
    throw new Error('XL over-budget rejection did not precede payload scanning.');
  return { legacyMaxSide: XL_CHECKPOINT_ROUTE_LEGACY_SIDE, maxSide: XL_CHECKPOINT_ROUTE_MAX_SIDE,
    maxRouteEntries: XL_CHECKPOINT_ROUTE_MAX_ENTRIES, maxUnits, maxResourceNodes,
    maxAuxiliaryPathReferences: 2 * maxUnits + maxResourceNodes,
    slotBytesModel: XL_CHECKPOINT_ROUTE_SLOT_BYTES,
    oneCopySlotPayloadBytesUpper: XL_CHECKPOINT_ROUTE_MAX_ENTRIES * XL_CHECKPOINT_ROUTE_SLOT_BYTES,
    acceptedBoundary: accepted, oversizedRejectedBeforeIndexReads: { rejection, indexReads },
    diagnostics: { preflightMilliseconds, memoryBytes: { before, allocated, validated, copied },
      scope: 'single-process bounded array witness; no GC normalization, quiet-host comparison, RSS guarantee or supported match capacity' },
    hooks: { beforeCaptureRouteCloning: true, beforeFullCheckpointValidationAllocations: true },
    remaining: { liveRoutePublicationBudget: 'pending',
      fileReadAndJsonParseByteEnvelope: 'XL bounded; legacy classification remains linear in file bytes',
      wholeCheckpointStateAndAllocationBudget: 'XL volume guarded; total process RSS not claimed', ordinary320Admission: 'closed' } };
}

export function crossingTopology(map) {
  const { width, height } = map, levels = buildElevationGrid(width, height, map.elevationPatches);
  const blocked = new Uint8Array(width * height);
  for (const o of map.obstacles) for (let row = o.row; row < o.row + o.height; row++)
    for (let column = o.column; column < o.column + o.width; column++) blocked[row * width + column] = 1;
  for (const team of [0, 1]) for (const cell of townCenterFootprintCells(map.spawnPoints, team, width, height)) blocked[cell] = 1;
  const cellAt = p => Math.floor(p.z + height / 2) * width + Math.floor(p.x + width / 2);
  // Close each complete ridge band, not one representative column. Raised
  // crossings permit a one-level corner approach from the adjacent ridge row.
  const barrierColumns = XL_LAYOUT.ridgeColumnRanges.flatMap(([first, last]) =>
    Array.from({ length: last - first + 1 }, (_, index) => first + index));
  const alternatives = XL_LAYOUT.crossings.map(([firstRow, lastRow]) => {
    const mask = blocked.slice();
    for (let row = 0; row < height; row++) if (row < firstRow || row > lastRow)
      for (const column of barrierColumns) mask[row * width + column] = 1;
    const worldLength = searchGrid(width, height, mask, levels, cellAt(map.spawnPoints[0]), false)
      .distance[cellAt(map.spawnPoints[1])];
    return { firstRow, lastRow, declaredPassRows: lastRow - firstRow + 1,
      reachable: Number.isFinite(worldLength), worldLength: Number.isFinite(worldLength) ? worldLength : null };
  });
  const closed = blocked.slice();
  for (const [firstRow, lastRow] of XL_LAYOUT.crossings) for (let row = firstRow; row <= lastRow; row++)
    for (const column of barrierColumns) closed[row * width + column] = 1;
  const bypass = searchGrid(width, height, closed, levels, cellAt(map.spawnPoints[0]), false)
    .distance[cellAt(map.spawnPoints[1])];
  return { alternatives, allDeclaredCrossingsClosed: { opposingHomeReachable: Number.isFinite(bypass),
    shortestBypassWorldLength: Number.isFinite(bypass) ? bypass : null,
    scope: 'static initial terrain; closes complete width of both ridge bands inside every declared crossing' } };
}

// The real authoritative fixture performs validation and activation with its
// existing fixed-tick I/O adapter. No dimension guard is replaced. Acceptance
// here proves only launch geometry; it does not prove actual match journeys.
export async function nativeAdmissionProbe(map) {
  const { createPveHeadlessFixture, assertRecoveredWorkerObservation } = await import('./pve-headless-fixture.mjs');
  const reports = [];
  for (const [width, height] of nativeDimensions) {
    const definition = { id: 'xl-boundary-probe', name: 'Boundary probe', width, height,
      terrainSeed: 881, fogOfWar: true, obstacles: [], resourceNodes: [],
      spawnPoints: [{ team: 0, x: -20.5, z: .5 }, { team: 1, x: 20.5, z: .5 }],
      startingArmySize: 24, startingResources: { food: 150, wood: 250 }, triggers: [], scenarioEvents: [] };
    let fixture;
    try {
      fixture = await createPveHeadlessFixture(definition);
      const checkpoint = fixture.replay.checkpoint();
      const observations = [fixture.replay.observe(0), fixture.replay.observe(1)];
      fixture.replay.restore(checkpoint);
      for (const team of [0, 1]) assertRecoveredWorkerObservation(fixture.replay.observe(team), observations[team]);
      reports.push({ width, height, accepted: true, inMemoryCheckpointRestore: true,
        appliedWidth: checkpoint.mapDefinition.width, appliedHeight: checkpoint.mapDefinition.height });
    } catch (error) {
      reports.push({ width, height, accepted: false, inMemoryCheckpointRestore: false, rejection: String(error.message).slice(0, 200) });
    } finally { await fixture?.dispose(); }
  }
  let fixture;
  try {
    fixture = await createPveHeadlessFixture(structuredClone(map));
    reports.push({ mapId: map.id, width: map.width, height: map.height, accepted: true });
  } catch (error) {
    reports.push({ mapId: map.id, width: map.width, height: map.height, accepted: false,
      rejection: String(error.message).slice(0, 200) });
  } finally { await fixture?.dispose(); }
  return reports;
}

export async function runXlBoundaryAudit({ native = false } = {}) {
  const files = ['server.mjs', 'room-supervisor.mjs', 'index.html', 'src/main.js',
    'src/authoring/map-studio-draft-store.mjs',
    'src/wall-line-planner.mjs', 'src/water-route-graph.mjs', 'src/map-size-policy.mjs',
    'src/match-modes.mjs', 'src/server/vision-coverage-cache.mjs',
    'src/server/checkpoint-route-budget.mjs',
    'src/server/checkpoint-json-budget.mjs', 'src/server/checkpoint-json-scan.mjs', 'src/server/checkpoint-file-reader.mjs',
    'src/gameplay-definitions.mjs', 'src/elevation.mjs', 'src/map-utils.mjs',
    'src/town-center-spawn.mjs', 'src/terrain-authoring.mjs', 'src/forest-fringe.mjs',
    'maps/veyrholds-slate-saddle.json', 'scripts/performance-run-evidence.mjs',
    'scripts/generate-far-marches.mjs', 'scripts/fixtures/xl-far-marches.json',
    'scripts/map-scale-audit.mjs', 'scripts/map-grid-cost-audit.mjs',
    'scripts/pve-headless-fixture.mjs', 'scripts/xl-map-boundary-audit.mjs', 'scripts/checkpoint-json-budget-audit.mjs'];
  const inputs = Object.fromEntries(await Promise.all(files.map(async file =>
    [file, await readFile(new URL(`../${file}`, import.meta.url), 'utf8')])));
  const source = inputs['server.mjs'], map = JSON.parse(inputs['scripts/fixtures/xl-far-marches.json']);
  const identity = await performanceIdentity(ROOT, 'scripts/fixtures/xl-far-marches.json');
  const grid = await runGridCostAudit();
  const constants = {
    forestWoodPerCell: sourceNumber(source, /const FOREST_WOOD_PER_CELL = (\d+);/),
    defaultArmySize: sourceNumber(source, /const DEFAULT_STARTING_ARMY_SIZE = (\d+);/),
    maxBuildings: sourceNumber(source, /const MAX_BUILDINGS = (\d+);/),
  };
  const geometry = auditMap(map, constants);
  // Execute the exact checkpoint leaf to distinguish its validation envelope
  // from the smaller simple-route bound used by the cost projection.
  const validPath = runInNewContext(`(${extractFunction(source, 'validCellPath')})`);
  const cells = map.width * map.height, repeatedFinalCell = Array(cells).fill(cells - 1);
  const maxValidatedPathJsonBytes = Buffer.byteLength(JSON.stringify(repeatedFinalCell));
  if (!validPath(repeatedFinalCell, cells) || validPath([...repeatedFinalCell, cells - 1], cells)
    || validPath([cells], cells) || !validPath([cells - 1, 0], cells))
    throw new Error('Checkpoint route validation changed; update the audit instead of retaining old claims.');
  const saveSource = source.slice(source.indexOf('\nasync function drainMatchCheckpointWrites('),
    source.indexOf('\nfunction broadcast(', source.indexOf('\nasync function initializeMatchFromCheckpoint(')));
  if (!saveSource.includes('serialized = JSON.stringify(next.snapshot);')
    || !saveSource.includes('serialized = await readMatchCheckpointFile(MATCH_STATE_PATH);')
    || !saveSource.includes('JSON.parse(serialized)')
    || !source.includes('path: [...unit.path]') || !source.includes('[...unit.attackMoveResumePath]'))
    throw new Error('Checkpoint capture/write/read contract moved; update the audit.');
  const mapBytes = Buffer.byteLength(JSON.stringify(map));
  const publishCommandBytes = Buffer.byteLength(JSON.stringify({ type: 'publishMap', map, persist: true }));
  const maxUnits = sourceNumber(source, /const MAX_UNITS = (\d+);/);
  const maxResourceNodes = sourceNumber(source, /const MAX_RESOURCE_NODES = (\d+);/);
  const captureBody = extractFunction(source, 'captureMatchCheckpoint');
  const validationBody = extractFunction(source, 'validateMatchCheckpoint');
  if (!captureBody.includes('preflightXlCheckpointRoutes(authoredMapDefinition, { units, resourceNodes: resourceNodeStates },')
    || captureBody.indexOf('preflightXlCheckpointRoutes(') > captureBody.indexOf('ensureVisionMasks();')
    || !validationBody.includes('preflightXlCheckpointRoutes(snapshot.mapDefinition, snapshot.state,')
    || validationBody.indexOf('preflightXlCheckpointRoutes(') > validationBody.indexOf('validateMapDefinition(')
    || !captureBody.includes('{ maxUnits: MAX_UNITS, maxResourceNodes: MAX_RESOURCE_NODES }')
    || !validationBody.includes('{ maxUnits: MAX_UNITS, maxResourceNodes: MAX_RESOURCE_NODES }'))
    throw new Error('XL checkpoint preflight consumer/ordering changed; update its evidence.');
  const xlRoutePreflight = xlCheckpointRouteProbe(map, { maxUnits, maxResourceNodes });
  const xlJsonEnvelope = await runCheckpointJsonBudgetAudit({ native });
  // The literal may use separators; parse separately without evaluating code.
  const inboundLiteral = source.match(/const MAX_INBOUND_FRAME_BYTES = ([\d_]+);/);
  if (!inboundLiteral) throw new Error('Inbound frame envelope moved.');
  const inbound = Number(inboundLiteral[1].replaceAll('_', ''));
  const outgoing = source.match(/const MAX_PEER_QUEUED_BYTES = (\d+) \* 1024 \* 1024;/);
  if (!outgoing) throw new Error('Outbound frame/queue envelope moved.');
  const draftRestoreBody = extractFunction(inputs['src/main.js'], 'restoreMapStudioDraft');
  if (!inputs['src/main.js'].includes('const mapStudioDraftStore = createMapStudioDraftStore({ getStorage: () => localStorage });')
    || !draftRestoreBody.includes('const { state, definition } = mapStudioDraftStore.requireRecovery(draft, editorDraftSourceMapId);')
    || !draftRestoreBody.includes('populateMapEditor(')
    || draftRestoreBody.indexOf('requireRecovery(') > draftRestoreBody.indexOf('populateMapEditor('))
    throw new Error('Map Studio draft recovery guard binding/order moved; update the audit.');
  const draftStore = createMapStudioDraftStore({ getStorage: () => {
    throw new Error('The dimension audit must not access browser storage.');
  } });
  const limits = {
    server: sourceNumber(source, /definition\.width > (\d+) \|\| definition\.height >/),
    studioRestore: sourceNumber(draftStore.requireRecovery.toString(), /definition\.width > (\d+)/),
    studioImport: sourceNumber(extractFunction(inputs['src/main.js'], 'validateImportedMap'), /definition\.width > (\d+)/),
    studioResize: sourceNumber(extractFunction(inputs['src/main.js'], 'resizeEditorMap'), /width > (\d+)/),
    studioHtml: [...inputs['index.html'].matchAll(/id="studio-(?:width|height)"[^>]*max="(\d+)"/g)].map(m => Number(m[1])),
  };
  if (limits.studioHtml.length !== 2) throw new Error('Map Studio HTML dimension controls moved.');
  const boundaryMatrix = nativeDimensions.map(([width, height]) => ({ width, height,
    serverDimensionGate: width <= limits.server && height <= limits.server,
    ordinaryCatalog: ordinaryMapCatalog([{ id: 'boundary', width, height }]).length === 1,
    studioRestoreDimensionGate: width <= limits.studioRestore && height <= limits.studioRestore,
    studioImportDimensionGate: width <= limits.studioImport && height <= limits.studioImport,
    studioResizeDimensionGate: width <= limits.studioResize && height <= limits.studioResize,
    studioHtmlDimensionGate: width <= limits.studioHtml[0] && height <= limits.studioHtml[1],
    wallGeometry: accepts(() => planWallLine({ width, height, points: [{ column: 0, row: 0 }] })),
    waterGeometry: accepts(() => createWaterRouteGraph({ width, height, obstacles: [] })),
  }));
  const nativeAdmission = native ? await nativeAdmissionProbe(map) : null;
  const nativeProbeMatchesDimensionPolicy = nativeAdmission?.every(row =>
    row.accepted === (row.width <= limits.server && row.height <= limits.server)
    && (!row.accepted || row.inMemoryCheckpointRestore === true)) ?? null;
  return {
    schemaVersion: 1,
    sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
    sourceDirty: Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).trim()),
    sourceInputSha256: Object.fromEntries(files.map(file => [file, sha(inputs[file])])),
    runtimeProvenance: { kind: identity.build.kind, sourceRevision: identity.build.sourceRevision,
      sourceDirty: identity.build.sourceDirty, runtimeSha256: identity.build.runtimeSha256,
      declaredRelease: identity.build.declaredRelease,
      scope: 'PR325 identity helper hashes server, package-lock and all src JS modules; no performance workload is executed' },
    gridCostProvenance: { schemaVersion: grid.schemaVersion, sourceInputSha256: grid.sourceInputSha256 },
    constants,
    candidate: { file: 'scripts/fixtures/xl-far-marches.json', sha256: sha(inputs['scripts/fixtures/xl-far-marches.json']),
      canonicalRuntimeMap: false, identity: mapSizeIdentity(map), geometry,
      expansionSitesPerSeat: XL_LAYOUT.sites.length, flatHomeSide: 2 * XL_LAYOUT.homeRadius + 1,
      crossingTopology: crossingTopology(map), compactMapJsonBytes: mapBytes,
      publicationCommandJsonBytes: publishCommandBytes,
      publicationFitsCurrentInboundFrame: publishCommandBytes <= inbound,
      patchCounts: { terrain: map.terrainPatches.length, elevation: map.elevationPatches.length, obstacles: map.obstacles.length } },
    dimensions: { limits, boundaryMatrix },
    routes: { indexRepresentation: 'absolute integer cells in JS arrays',
      scope: 'legacy path-leaf envelope without the XL preflight; current complete checkpoints reject320 maps',
      currentMaxAdmittedSquareCells: limits.server ** 2,
      activeAndResumeCheckpointPathsPerActor: 2, maxUnits,
      validatedEntriesPerPath: cells, simpleRuntimePathEntriesUpper: cells - 1,
      maxValidatedPathJsonBytes, validatedRouteArraysJsonBytesAtFullRoster: maxValidatedPathJsonBytes * maxUnits * 2,
      validationRequiresAdjacencyOrUniqueness: false,
      atomicSearchExpandedCellsUpper: cells,
      callbackExpandedCellsThresholdBetweenSearches: sourceNumber(source, /const MOVE_PLANNING_MAX_EXPANDED_CELLS_PER_SLICE = (\d+);/),
      atomicSearchCanOvershootCallbackThreshold: true,
      defaultPlanningTurnsPerTick: sourceNumber(source, /RTS_MOVE_PLANNING_TURNS_PER_TICK \?\? (\d+)/),
      maxManhattanHeuristic: grid.grids.at(-1).maxManhattanHeuristic,
      heuristicFitsUint16: grid.grids.at(-1).heuristicFitsUint16,
      aggregateRouteRetentionBudget: null,
      note: 'Legacy leaf-only upper bound excludes the new XL checkpoint aggregate preflight. Live route retention remains unbounded by an aggregate quota. A* can exhaust the finite grid within one atomic search; the callback threshold is not a per-search cap.' },
    checkpoint: { captureClonesActiveAndResumePaths: true, serialization: 'JSON.stringify whole captured snapshot',
      write: 'atomic temporary write, fsync, rename', read: 'stream effective dimensions; bounded XL volume before full read/JSON.parse; unchanged legacy read',
      explicitByteEnvelope: null, xlRoutePreflight, xlJsonEnvelope,
      exploredBase64CharactersTwoSeats: grid.grids.at(-1).checkpointExploredBase64CharactersTwoSeats,
      note: 'XL route and whole-JSON volume preflights precede cloning/serialization/restore grids. Accepted XL file allocation and parse work are capped; legacy classification requires one complete constant-memory pass and <=256 keeps its old byte/semantic acceptance. No global legacy byte quota or total process RSS bound is claimed.' },
    transport: { inboundFrameBytes: inbound, outboundQueuedAndFrameBytes: Number(outgoing[1]) * 1024 * 1024,
      routeArraysInOrdinarySnapshots: false, packedFogBytesPerSeat: grid.grids.at(-1).fogPerSeat.packedBytes,
      fogBase64CharactersPerSeat: grid.grids.at(-1).fogPerSeat.base64Characters,
      actualWelcomeStateFrameMeasured: false, actualCheckpointBytesMeasured: false,
      note: 'Compact publication payload fits by itself. Actual welcome/mapChange + worst-state frames and actual private checkpoints are still native qualification gates; geometry JSON is not their proxy.' },
    nativeAdmission: nativeAdmission ?? { status: 'not-run', command: 'node scripts/xl-map-boundary-audit.mjs --native' },
    nativeProbeMatchesDimensionPolicy,
    nativeProbeScope: 'actual fixed-tick authority validation/activation and both-seat in-memory checkpoint restore; no process restart, wall clock or ordinary menu entry',
    gates: { visibilityIndexAndCache: 'integrated under256 admission in PR328',
      routeAndSaveEnvelope: 'XL route/file/state preflights integrated; live publication/search and actual320 recovery pending', allSiteAdmission: 'closed',
      ordinaryCreateJoinReadyLaunchRecovery: 'not-run; runtime rejects320',
      actualWorkerInfantryScoutJourneys: 'not-run', comparablePerformance: 'not-run; use PR325 validity contract',
      qualifiedRenderedAcceptance: 'not-run; reuse PR331 normal-entry capture interface',
      stagingRevision: 'unverified', supportedCapacity: null },
    ordinaryXlComplete: false, limitsChanged: false,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await runXlBoundaryAudit({ native: process.argv.includes('--native') });
  console.log(JSON.stringify(report, null, 2));
  if (report.nativeProbeMatchesDimensionPolicy === false) process.exitCode = 1;
}
