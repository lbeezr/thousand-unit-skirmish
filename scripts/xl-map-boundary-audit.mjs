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
    'src/wall-line-planner.mjs', 'src/water-route-graph.mjs', 'src/map-size-policy.mjs',
    'src/match-modes.mjs', 'src/server/vision-coverage-cache.mjs',
    'src/gameplay-definitions.mjs', 'src/elevation.mjs', 'src/map-utils.mjs',
    'src/town-center-spawn.mjs', 'src/terrain-authoring.mjs', 'src/forest-fringe.mjs',
    'maps/veyrholds-slate-saddle.json', 'scripts/performance-run-evidence.mjs',
    'scripts/generate-far-marches.mjs', 'scripts/fixtures/xl-far-marches.json',
    'scripts/map-scale-audit.mjs', 'scripts/map-grid-cost-audit.mjs',
    'scripts/pve-headless-fixture.mjs', 'scripts/xl-map-boundary-audit.mjs'];
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
    || !saveSource.includes("serialized = await readFile(MATCH_STATE_PATH, 'utf8');")
    || !saveSource.includes('JSON.parse(serialized)')
    || !source.includes('path: [...unit.path]') || !source.includes('[...unit.attackMoveResumePath]'))
    throw new Error('Checkpoint capture/write/read contract moved; update the audit.');
  const mapBytes = Buffer.byteLength(JSON.stringify(map));
  const publishCommandBytes = Buffer.byteLength(JSON.stringify({ type: 'publishMap', map, persist: true }));
  const maxUnits = sourceNumber(source, /const MAX_UNITS = (\d+);/);
  // The literal may use separators; parse separately without evaluating code.
  const inboundLiteral = source.match(/const MAX_INBOUND_FRAME_BYTES = ([\d_]+);/);
  if (!inboundLiteral) throw new Error('Inbound frame envelope moved.');
  const inbound = Number(inboundLiteral[1].replaceAll('_', ''));
  const outgoing = source.match(/const MAX_PEER_QUEUED_BYTES = (\d+) \* 1024 \* 1024;/);
  if (!outgoing) throw new Error('Outbound frame/queue envelope moved.');
  const limits = {
    server: sourceNumber(source, /definition\.width > (\d+) \|\| definition\.height >/),
    studioRestore: sourceNumber(extractFunction(inputs['src/main.js'], 'restoreMapStudioDraft'), /definition\.width > (\d+)/),
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
      scope: 'prospective320 path-leaf envelope if dimension admission alone were widened; current complete checkpoints reject320 maps',
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
      note: 'Executed path-leaf upper bound at the proposed cellCount, not an admitted320 checkpoint or observed legitimate save. No giant aggregate array is allocated. A* can exhaust the finite grid within one atomic search; the callback threshold is not a per-search cap.' },
    checkpoint: { captureClonesActiveAndResumePaths: true, serialization: 'JSON.stringify whole captured snapshot',
      write: 'atomic temporary write, fsync, rename', read: 'whole UTF-8 readFile then JSON.parse',
      explicitByteEnvelope: null, exploredBase64CharactersTwoSeats: grid.grids.at(-1).checkpointExploredBase64CharactersTwoSeats,
      note: 'No route aggregate or checkpoint byte envelope in the audited source. Preserve prior <=256 checkpoint behavior when designing XL bounds.' },
    transport: { inboundFrameBytes: inbound, outboundQueuedAndFrameBytes: Number(outgoing[1]) * 1024 * 1024,
      routeArraysInOrdinarySnapshots: false, packedFogBytesPerSeat: grid.grids.at(-1).fogPerSeat.packedBytes,
      fogBase64CharactersPerSeat: grid.grids.at(-1).fogPerSeat.base64Characters,
      actualWelcomeStateFrameMeasured: false, actualCheckpointBytesMeasured: false,
      note: 'Compact publication payload fits by itself. Actual welcome/mapChange + worst-state frames and actual private checkpoints are still native qualification gates; geometry JSON is not their proxy.' },
    nativeAdmission: nativeAdmission ?? { status: 'not-run', command: 'node scripts/xl-map-boundary-audit.mjs --native' },
    nativeProbeMatchesDimensionPolicy,
    nativeProbeScope: 'actual fixed-tick authority validation/activation and both-seat in-memory checkpoint restore; no process restart, wall clock or ordinary menu entry',
    gates: { visibilityIndexAndCache: 'integrated under256 admission in PR328',
      routeAndSaveEnvelope: 'shared movement contract decision pending', allSiteAdmission: 'closed',
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
