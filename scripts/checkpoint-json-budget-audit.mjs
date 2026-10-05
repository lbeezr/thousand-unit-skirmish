import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { inspectCheckpointJson, preflightXlCheckpointState, XL_CHECKPOINT_JSON_LIMITS as limits } from '../src/server/checkpoint-json-budget.mjs';
import { XL_CHECKPOINT_ROUTE_MAX_ENTRIES as routeEntries } from '../src/server/checkpoint-route-budget.mjs';
import { CHECKPOINT_INSPECTION_CHUNK_BYTES } from '../src/server/checkpoint-file-reader.mjs';
import { CheckpointJsonScan } from '../src/server/checkpoint-json-scan.mjs';
import { BUILDING_DEFINITIONS } from '../src/gameplay-definitions.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const files = ['server.mjs', 'src/server/checkpoint-json-budget.mjs', 'src/server/checkpoint-json-scan.mjs',
  'src/server/checkpoint-file-reader.mjs', 'src/server/checkpoint-route-budget.mjs',
  'src/gameplay-definitions.mjs', 'src/work-intent.mjs', 'scripts/pve-headless-fixture.mjs',
  'scripts/checkpoint-json-budget-audit.mjs', 'scripts/fixtures/xl-far-marches.json'];
function constant(source, name) {
  const match = source.match(new RegExp(`const ${name} = ([0-9_]+);`));
  if (!match) throw new Error(`Checkpoint source constant moved: ${name}`);
  return Number(match[1].replaceAll('_', ''));
}

export async function runCheckpointJsonBudgetAudit({ native = false } = {}) {
  const bytes = await Promise.all(files.map(f => readFile(new URL(`../${f}`, import.meta.url))));
  const source = bytes[0].toString(), map = JSON.parse(bytes.at(-1));
  const c = Object.fromEntries(['MAX_UNITS', 'MAX_BUILDINGS', 'MAX_RESOURCE_NODES', 'MAX_QUEUED_WAYPOINTS',
    'MAX_BUILDING_QUEUE', 'HOME_TOWN_CENTER_ID_BASE', 'MAX_INBOUND_FRAME_BYTES'].map(name => [name, constant(source, name)]));
  const maxFootprintCells = Math.max(...Object.values(BUILDING_DEFINITIONS).map(r => r.footprint ** 2));
  const records = { maxUnits: c.MAX_UNITS, maxBuildings: c.MAX_BUILDINGS, maxResourceNodes: c.MAX_RESOURCE_NODES };
  let witness = { status: 'not-run', command: 'node scripts/checkpoint-json-budget-audit.mjs --native' };
  if (native) {
    const { createPveHeadlessFixture } = await import('./pve-headless-fixture.mjs');
    const fixture = await createPveHeadlessFixture({ id: 'checkpoint-size-maximum-roster', name: 'Checkpoint maximum roster',
      width: 256, height: 256, terrainSeed: 19, fogOfWar: true, obstacles: [], resourceNodes: [],
      spawnPoints: [{ team: 0, x: -80.5, z: .5 }, { team: 1, x: 80.5, z: .5 }],
      startingArmySize: c.MAX_UNITS, startingResources: { food: 150, wood: 250 }, triggers: [], scenarioEvents: [] });
    try {
      const actual = fixture.replay.checkpoint(), actualSize = inspectCheckpointJson(actual);
      const draft = structuredClone(actual); draft.mapDefinition = map;
      const siteIds = Array.from({ length: c.MAX_BUILDINGS }, (_, i) => c.HOME_TOWN_CENTER_ID_BASE - 1 - i);
      const perPath = Math.floor((routeEntries - c.MAX_RESOURCE_NODES * 64) / (2 * c.MAX_UNITS));
      let remaining = routeEntries - c.MAX_RESOURCE_NODES * 64;
      for (const unit of draft.state.units) {
        unit.wallBuildOrder = { generation: unit.generation, revision: unit.orderRevision, ids: siteIds };
        unit.workIntent = { version: 1, kind: 'construction', generation: unit.generation, siteIds,
          area: { minX: -160, maxX: 160, minZ: -160, maxZ: 160 } };
        unit.queuedWaypoints = Array.from({ length: c.MAX_QUEUED_WAYPOINTS }, () => ({ destination: 102399,
          attackMove: false, point: { x: 159.99999999999997, z: 159.99999999999997 } }));
        unit.path = Array(perPath).fill(102399); unit.attackMoveResumePath = Array(perPath).fill(102399);
        remaining -= 2 * perPath;
      }
      draft.state.units[0].path.push(...Array(remaining).fill(102399));
      draft.state.resourceNodes = Array.from({ length: c.MAX_RESOURCE_NODES }, (_, i) => ({
        id: `allocation-herd-${i}`, type: 'food', stock: 1000, wildlifeSpecies: 'bellweather-sheep',
        wildlifeMotion: { x: 0, z: 0, heading: Math.PI, targetX: 0, targetZ: 0 },
        wildlifeHerd: { path: Array(64).fill(102399), goalCell: 102399, goalX: 159.5, goalZ: 159.5, pathIndex: 0 } }));
      draft.state.buildings = Array.from({ length: c.MAX_BUILDINGS }, (_, i) => ({
        id: siteIds[i], team: i % 2, type: 'town-center', x: .5, z: .5, hp: 2400, progress: 1,
        complete: true, queue: c.MAX_BUILDING_QUEUE, productionQueue: Array(c.MAX_BUILDING_QUEUE).fill('worker'),
        trainingRemaining: 20, productionBlocked: false, footprint: Array(maxFootprintCells).fill(102399), rallyCell: 102399 }));
      draft.state.forestStocks = Array.from({ length: map.width * map.height }, (_, cell) => [cell, 5.999999999999999]);
      draft.state.explored = [0, 1].map(() => Buffer.alloc(map.width * map.height).toString('base64'));
      const before = process.memoryUsage(), start = performance.now();
      const sized = preflightXlCheckpointState(draft, records), afterInspection = process.memoryUsage();
      const serialized = JSON.stringify(draft), observedBytes = Buffer.byteLength(serialized), scanner = new CheckpointJsonScan();
      scanner.push(serialized); const lexical = scanner.finish();
      if (sized.bytes !== observedBytes || lexical.legacyCandidate || lexical.violation)
        throw new Error('Supported-field upper witness is inconsistent with the proposed JSON budget.');
      const noRoutes = unit => { const { path, attackMoveResumePath, ...rest } = unit; return inspectCheckpointJson(rest).bytes; };
      witness = { status: 'passed', actualAdmitted256Checkpoint: { units: actual.state.units.length, ...actualSize,
        unitMemberCountMax: Math.max(...actual.state.units.map(u => Object.keys(u).length)) },
      synthetic320SupportedFieldUpperWitness: { ...sized, observedCompactBytes: observedBytes, lexical,
        unitNonRouteBytesMax: Math.max(...draft.state.units.map(noRoutes)),
        maxForestRows: draft.state.forestStocks.length, units: draft.state.units.length,
        buildings: draft.state.buildings.length, resources: draft.state.resourceNodes.length, routeEntries,
        scope: 'actual captured roster shape plus declared field-limit combinations; not a valid full320 match, journey or accepted save' },
      diagnostics: { milliseconds: performance.now() - start, memoryBytes: { before, afterInspection, afterSerialize: process.memoryUsage() },
        scope: 'allocation witness; no GC-normalized comparison, RSS guarantee or supported capacity' } };
    } finally { await fixture.dispose(); }
  }
  return { schemaVersion: 1, sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    sourceDirty: Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim()),
    sourceInputSha256: Object.fromEntries(files.map((f, i) => [f, createHash('sha256').update(bytes[i]).digest('hex')])),
    constants: c, limits, maxFootprintCells, inspectionChunkBytes: CHECKPOINT_INSPECTION_CHUNK_BYTES,
    canonicalInputSizingModel: { routeArrayBytesUpper: routeEntries * 7 + (2 * c.MAX_UNITS + c.MAX_RESOURCE_NODES) * 2,
      unitNonRouteAllowanceBytes: c.MAX_UNITS * 8192, forestRowsBytesUpper: map.width * map.height * (6 + 24 + 4),
      buildingAllowanceBytes: c.MAX_BUILDINGS * 2048, resourceAllowanceBytes: c.MAX_RESOURCE_NODES * 2048,
      mapPublicationBytesUpper: c.MAX_INBOUND_FRAME_BYTES, generationCounterBytesUpper: c.MAX_UNITS * 11 + 2,
      exploredBase64BytesUpper: 2 * 4 * Math.ceil(map.width * map.height / 3) + 8,
      fixedControlAllowanceBytes: 32768,
      note: 'canonical IDs/pins and supported field combinations; allowances are not claims about every formerly unconstrained custom metadata value. XL quotas explicitly restrict volume; <=256 acceptance stays unchanged.' },
    nativeWitness: witness, ordinary320Admission: 'closed',
    remaining: { livePublicationAndSearch: 'movement-owned', actual320RecoveryPlayabilityPerformanceRendered: 'pending',
      rejectedFileClassificationWork: 'linear in file bytes to preserve legacy property order/duplicates', totalProcessRss: 'not bounded by this accounting' } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  console.log(JSON.stringify(await runCheckpointJsonBudgetAudit({ native: process.argv.includes('--native') }), null, 2));
