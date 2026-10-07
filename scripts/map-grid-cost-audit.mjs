import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { BASE_ELEVATION_PATH_COST } from '../src/elevation.mjs';
import { VisionCoverageCache } from '../src/server/vision-coverage-cache.mjs';
import { forestGatherGroups } from '../src/forest-gather-group.mjs';
import { UNIT_DEFINITIONS, BUILDING_DEFINITIONS } from '../src/gameplay-definitions.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const bytesByType = { Uint8Array: 1, Uint16Array: 2, Int32Array: 4, Uint32Array: 4, Float32Array: 4 };
const base64Bytes = bytes => 4 * Math.ceil(bytes / 3);
export function visionIndexWitness(side, bits = 16) {
  const index = side * side - 1;
  const stored = bits === 16 ? Uint16Array.of(index)[0] : Uint32Array.of(index)[0];
  return { index, stored, wraps: stored !== index };
}
export function gridCosts(side, model) {
  if (!Number.isInteger(side) || side < 16 || side > 1024) throw new RangeError('Grid cost study accepts integer sides 16–1024.');
  const cells = side * side, bucketsPerSide = Math.floor((side - .5) / model.bucketSide) + 1;
  const fogBytes = Math.ceil(cells / 4), routeIndices = cells - 1;
  const diskCells = radius => { let count = 0; for (let y = -radius; y <= radius; y++)
    for (let x = -radius; x <= radius; x++) if (x * x + y * y <= radius * radius) count++; return count; };
  const sightCoverageBound = model.sights.reduce((sum, sight) => sum + diskCells(sight + model.highGroundBonus), 0);
  return {
    side, cells, areaFactorVs256: cells / 65536, validatorAllows: side <= model.validatorMaxSide,
    residentTypedArrayBytes: cells * model.residentBytesPerCell + bucketsPerSide ** 2 * model.bucketBytes,
    attackFlowCacheBytesAtLimit: model.attackFlowLimit * cells * 4,
    checkpointValidationForestGroupMembershipBytes: cells * (model.forestGroupIndexBytesPerCell ?? 0),
    visionIndexWitness: visionIndexWitness(side, model.visionIndexBits),
    // All source cells visited at all current sight radii on raised, unoccluded land.
    visionCoverageIndexBytesAtAllSources: cells * sightCoverageBound * model.visionIndexBits / 8,
    proposedUint32VisionCoverageIndexBytesAtAllSources: cells * sightCoverageBound * 4,
    visionCoverageRetainedPayloadBytesLimit: model.visionCache?.maxBytes ?? null,
    visionCoverageRetainedEntriesLimit: model.visionCache?.maxEntries ?? null,
    visionCoverageBoundExcludes: 'All-source figure is a hypothetical uncapped index sum, not retained cache memory; visible/fringe partition the target disk. JS Maps/keys/objects, allocator overhead, rays and temporary/GC payload are excluded; not an RSS prediction',
    maxManhattanHeuristic: 2 * (side - 1) * BASE_ELEVATION_PATH_COST,
    heuristicFitsUint16: 2 * (side - 1) * BASE_ELEVATION_PATH_COST <= 65535,
    fogPerSeat: { packedBytes: fogBytes, base64Characters: base64Bytes(fogBytes) },
    fogBase64CharactersPerSecondTwoSeatsAtSnapshotCadence: 2 * base64Bytes(fogBytes) * model.snapshotHz,
    checkpointExploredBase64CharactersTwoSeats: 2 * base64Bytes(cells),
    oneFullSimplePathJsonUpperBytesPerUnit: routeIndices * (String(cells - 1).length + 1) + 1,
    oneFullSimplePathJsonUpperBytes2000Units: 2000 * (routeIndices * (String(cells - 1).length + 1) + 1),
    pathBoundExcludes: 'unit metadata, queued commands and attackMoveResumePath; ordinary network snapshots do not transmit these path arrays',
    raisedGroundBaseGeometry: { vertices: 4 * cells, indices: 6 * cells, attributeAndIndexBytes: 216 * cells },
    rendererAdditional: { terrainLevelAndCornerBytes: 17 * cells, fogTextureRgbaBytes: 4 * cells,
      rgbaBlendMaskBytesPerMaterial: 4 * cells, sameGridGeometryBytesPerBlendSurface: 216 * cells },
  };
}

export async function runGridCostAudit() {
  const files = ['server.mjs', 'src/main.js', 'src/wall-line-planner.mjs', 'src/water-route-graph.mjs',
    'src/environment-art.mjs', 'src/terrain-height.mjs', 'src/terrain-blend.mjs', 'src/gameplay-definitions.mjs',
    'src/elevation.mjs', 'src/map-size-policy.mjs', 'src/forest-fringe.mjs',
    'src/server/vision-coverage-cache.mjs', 'src/server/map-definition-validator.mjs',
    'src/forest-gather-group.mjs', 'scripts/map-grid-cost-audit.mjs', 'index.html'];
  const inputs = Object.fromEntries(await Promise.all(files.map(async name => [name, await readFile(new URL(`../${name}`, import.meta.url), 'utf8')])));
  const server = inputs['server.mjs'];
  const validator = inputs['src/server/map-definition-validator.mjs'];
  if (!server.includes("import { createMapDefinitionValidator } from './src/server/map-definition-validator.mjs';")
    || !server.includes('return authoritativeMapValidator(definition, filename);'))
    throw new Error('Authoritative map validator binding moved; update the source-bound cost audit.');
  const start = server.indexOf('\nfunction activateMap(definition) {');
  const end = server.indexOf('\nfunction ', start + 1);
  if (start < 0 || end < 0) throw new Error('Map activation moved; update the source-bound cost audit.');
  const activation = server.slice(start, end);
  const allocations = { CELL_COUNT: {}, bucketCount: {} };
  for (const [, type, size] of activation.matchAll(/new (\w+Array)\((CELL_COUNT|bucketCount)\)/g)) {
    if (!bytesByType[type]) throw new Error(`Unaccounted activation allocation: ${type}`);
    const group = allocations[size]; group[type] = (group[type] ?? 0) + 1;
  }
  const byteCount = group => Object.entries(group).reduce((sum, [type, count]) => sum + bytesByType[type] * count, 0);
  const number = pattern => { const match = server.match(pattern); if (!match) throw new Error(`Source contract moved: ${pattern}`); return Number(match[1]); };
  const probe = new VisionCoverageCache({ width: 1, height: 1 });
  const visionIndexBits = probe.set(0, 8, { visible: [0], fringe: [0] }).visible.BYTES_PER_ELEMENT * 8;
  const forestGroupIndexBytesPerCell = forestGatherGroups(new Uint8Array(1), 1).byCell.BYTES_PER_ELEMENT;
  if (!server.includes('coverage = visionCoverageBySourceCell.set(sourceCell, sight, { visible: cells,')
    || !server.includes('visionCoverageBySourceCell = new VisionCoverageCache(')
    || !inputs['src/forest-fringe.mjs'].includes('return Uint32Array.from(fringe);') || !server.includes('walkableComponents = new Int32Array(CELL_COUNT)')
    || !activation.includes('forestWorkGroups = forestGatherGroups(forestCellMask, MAP_WIDTH);')
    || !server.includes('const checkpointForestGroups = forestGatherGroups(checkpointForestMask, definition.width);')
    || !server.includes('elevationLevelByCell = buildElevationGrid(') || !server.includes('forestCellMask = forestCellsForDefinition('))
    throw new Error('Resident/vision model moved; update the source-bound audit.');
  const model = {
    activationAllocations: allocations, residentBytesPerCell: byteCount(allocations.CELL_COUNT) + 6 + forestGroupIndexBytesPerCell,
    residentExtraBytesPerCell: { elevationGrid: 1, forestMask: 1, walkableComponents: 4,
      forestWorkGroupMembership: forestGroupIndexBytesPerCell }, forestGroupIndexBytesPerCell,
    bucketBytes: byteCount(allocations.bucketCount), bucketSide: number(/const SPATIAL_BUCKET_SIZE = ([\d.]+);/),
    attackFlowLimit: number(/const MAX_ATTACK_FLOW_FIELDS = (\d+);/), visionIndexBits,
    visionCache: { maxBytes: probe.metrics().maxBytes, maxEntries: probe.metrics().maxEntries,
      coverageArrays: ['visible', 'fringe'], scope: 'live exact owned typed payload; excludes temporary/GC buffers and JS overhead' },
    validatorMaxSide: (() => {
      const match = validator.match(/definition\.width > (\d+) \|\| definition\.height >/);
      if (!match) throw new Error('Authoritative map dimension gate moved; update the source-bound cost audit.');
      return Number(match[1]);
    })(),
    highGroundBonus: number(/const HIGH_GROUND_VISION_BONUS_CELLS = (\d+);/),
    snapshotHz: number(/const TICK_RATE = (\d+);/) / number(/const STATE_EVERY_TICKS = (\d+);/),
    sights: [...new Set([8, ...Object.values(UNIT_DEFINITIONS).map(v => v.sight || 8),
      ...Object.values(BUILDING_DEFINITIONS).map(v => v.sight || 8)])].sort((a, b) => a - b),
    exclusions: 'JS caches/objects including forest group cell lists, unit routes/state, temporary validation/components queues and forest-group membership, catalog, water grids, render/GPU allocations, allocator/runtime overhead',
  };
  return { schemaVersion: 2, sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
    sourceDirty: Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).trim()),
    sourceInputSha256: Object.fromEntries(files.map(name => [name, createHash('sha256').update(inputs[name]).digest('hex')])),
    model, grids: [160, 192, 224, 256, 320].map(side => gridCosts(side, model)),
    hardLimitSites: ['src/server/map-definition-validator.mjs:validateMapDefinition', 'src/main.js:editor validation', 'index.html:studio width/height',
      'src/wall-line-planner.mjs:wall geometry', 'src/water-route-graph.mjs:water geometry', 'src/map-size-policy.mjs:ordinary eligibility'],
    xlAdmitted: false, limitsChanged: false };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  console.log(JSON.stringify(await runGridCostAudit(), null, 2));
