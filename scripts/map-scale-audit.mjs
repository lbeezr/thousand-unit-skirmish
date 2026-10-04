#!/usr/bin/env node
// Source-only measurement: imports shared rules, never starts or edits a match.
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildElevationGrid } from '../src/map-utils.mjs';
import { canTraverseElevation, elevationPathCost } from '../src/elevation.mjs';
import { townCenterFootprintCells } from '../src/town-center-spawn.mjs';
import { UNIT_DEFINITIONS, BUILDING_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { PVE_MAP_IDS } from '../src/pve-match.mjs';
import { NORMAL_HUMAN_MATCH_MODE, NORMAL_MATCH_MAP_ID, matchModeDefinition } from '../src/match-modes.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const round = n => Number(n.toFixed(3));
const count = mask => mask.reduce((sum, value) => sum + Number(Boolean(value)), 0);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const CITY = ['town-center', 'barracks', 'barracks', 'archery-range', 'stable', 'workshop',
  'storehouse', 'mill', ...Array(12).fill('house'), ...Array(8).fill('farm'),
  'watchtower', 'watchtower'];

// Dijkstra uses the authoritative cardinal adjacency and 100/115 elevation costs.
// Equal-cost tie order is deterministic here; it need not match server A* ties.
export function searchGrid(width, height, blocked, levels, start, weighted = true) {
  const distance = new Float64Array(width * height).fill(Infinity);
  const previous = new Int32Array(width * height).fill(-1);
  const heap = [];
  function push(cell, cost) {
    let i = heap.length; heap.push([cell, cost]);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][1] <= cost) break;
      heap[i] = heap[p]; i = p;
    }
    heap[i] = [cell, cost];
  }
  function pop() {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      let i = 0;
      while (i * 2 + 1 < heap.length) {
        let child = i * 2 + 1;
        if (child + 1 < heap.length && heap[child + 1][1] < heap[child][1]) child++;
        if (heap[child][1] >= last[1]) break;
        heap[i] = heap[child]; i = child;
      }
      heap[i] = last;
    }
    return top;
  }
  if (blocked[start]) return { distance, previous };
  distance[start] = 0; push(start, 0);
  while (heap.length) {
    const [cell, cost] = pop();
    if (distance[cell] !== cost) continue;
    const x = cell % width, y = Math.floor(cell / width);
    for (const next of [x > 0 ? cell - 1 : -1, x + 1 < width ? cell + 1 : -1,
      y > 0 ? cell - width : -1, y + 1 < height ? cell + width : -1]) {
      if (next < 0 || blocked[next] || !canTraverseElevation(levels, cell, next)) continue;
      const value = cost + (weighted ? elevationPathCost(levels, cell, next) : 1);
      if (value >= distance[next]) continue;
      distance[next] = value; previous[next] = cell; push(next, value);
    }
  }
  return { distance, previous };
}

function route(tree, goal) {
  if (!Number.isFinite(tree.distance[goal])) return null;
  const cells = [];
  for (let cell = goal; cell >= 0; cell = tree.previous[cell]) cells.push(cell);
  cells.reverse();
  const length = cells.length - 1;
  return { cells, worldLength: length, weightedCost: tree.distance[goal],
    nominalTravelSeconds: Object.fromEntries(['worker', 'infantry', 'scout'].map(kind =>
      [kind, round(length / UNIT_DEFINITIONS[kind].combat.moveSpeed)])) };
}
const publicRoute = value => value && ({ ...value, cells: undefined });

export function auditMap(map, constants) {
  const { width: w, height: h } = map, size = w * h;
  const cellOf = p => Math.floor(p.z + h / 2) * w + Math.floor(p.x + w / 2);
  const square = (cell, side) => {
    const half = Math.floor(side / 2), x = cell % w, y = Math.floor(cell / w);
    if (x < half || y < half || x + half >= w || y + half >= h) return null;
    const cells = [];
    for (let row = y - half; row <= y + half; row++)
      for (let col = x - half; col <= x + half; col++) cells.push(row * w + col);
    return cells;
  };
  const levels = buildElevationGrid(w, h, map.elevationPatches);
  const obstacles = new Uint8Array(size), forest = new Uint8Array(size);
  const materialMasks = {};
  for (const rect of map.obstacles) {
    const material = rect.material ?? 'stone';
    const mask = materialMasks[material] ||= new Uint8Array(size);
    for (let y = rect.row; y < rect.row + rect.height; y++)
      for (let x = rect.column; x < rect.column + rect.width; x++) {
        const cell = y * w + x; mask[cell] = obstacles[cell] = 1;
        if (material === 'forest') forest[cell] = 1;
      }
  }
  const spawns = [0, 1].map(team => map.spawnPoints.find(p => p.team === team));
  const spawnCells = spawns.map(cellOf);
  const homes = [0, 1].map(team => townCenterFootprintCells(map.spawnPoints, team, w, h));
  const blocked = obstacles.slice();
  for (const cell of homes.flat()) blocked[cell] = 1;
  const buildExcluded = blocked.slice();
  for (const node of map.resourceNodes ?? []) buildExcluded[cellOf(node)] = 1;
  for (const { zone } of map.triggers ?? [])
    for (let y = zone.row; y < zone.row + zone.height; y++)
      for (let x = zone.column; x < zone.column + zone.width; x++) buildExcluded[y * w + x] = 1;
  const trees = spawnCells.map(cell => searchGrid(w, h, blocked, levels, cell));
  const geometricTree = searchGrid(w, h, blocked, levels, spawnCells[0], false);
  const primary = route(trees[0], spawnCells[1]);
  const midpoint = primary?.cells[Math.floor(primary.cells.length / 2)];
  const detourMask = blocked.slice();
  if (midpoint !== undefined) for (const cell of square(midpoint, 7) ?? []) detourMask[cell] = 1;
  const detour = midpoint === undefined || !square(midpoint, 7) ? null
    : route(searchGrid(w, h, detourMask, levels, spawnCells[0]), spawnCells[1]);
  const cutForest = blocked.map((value, cell) => forest[cell] ? 0 : value);
  for (const cell of homes.flat()) cutForest[cell] = 1;
  const cleared = route(searchGrid(w, h, cutForest, levels, spawnCells[0]), spawnCells[1]);
  const eligible = {};
  for (const side of [3, 5]) {
    const legal = [], flat = [];
    for (let cell = 0; cell < size; cell++) {
      const cells = square(cell, side);
      if (!cells || cells.some(c => buildExcluded[c])) continue;
      legal.push(cell);
      if (cells.every(c => levels[c] === levels[cell])) flat.push(cell);
    }
    eligible[side] = { legal, flat };
  }
  // Static greedy packing in a 41x41 home square, restricted to the nearer seat.
  // One free ring around each building reserves circulation; only flat pads used.
  const cityFits = [0, 1].map(team => {
    const reserved = buildExcluded.slice(), placements = [];
    for (const kind of CITY) {
      const side = BUILDING_DEFINITIONS[kind].footprint;
      const candidates = eligible[side].flat.filter(cell => {
        const x = cell % w, y = Math.floor(cell / w), spawn = spawnCells[team];
        if (Math.max(Math.abs(x - spawn % w), Math.abs(y - Math.floor(spawn / w))) > 20
          || !Number.isFinite(trees[team].distance[cell])) return false;
        const distance = t => (x + .5 - w / 2 - spawns[t].x) ** 2 + (y + .5 - h / 2 - spawns[t].z) ** 2;
        return distance(team) < distance(1 - team);
      }).sort((a, b) => trees[team].distance[a] - trees[team].distance[b] || a - b);
      const center = candidates.find(cell => {
        const cells = square(cell, side + 2);
        return cells && cells.every(c => !reserved[c]);
      });
      if (center === undefined) continue;
      for (const c of square(center, side + 2)) reserved[c] = 1;
      placements.push({ kind, column: center % w, row: Math.floor(center / w) });
    }
    return { team, placedBuildings: placements.length, completeTemplate: placements.length === CITY.length,
      addedHousePopulation: placements.filter(p => p.kind === 'house').length * BUILDING_DEFINITIONS.house.populationCapacity,
      placements };
  });
  const resources = (map.resourceNodes ?? []).map(node => {
    const distances = trees.map(tree => route(tree, cellOf(node))?.worldLength ?? null);
    const nearestTeam = distances[0] === distances[1] || distances.includes(null) ? null
      : distances[0] < distances[1] ? 0 : 1;
    return { id: node.id, type: node.type, stock: node.stock, x: node.x, z: node.z,
      shortestCostRouteWorldLengths: distances, nearestTeam };
  });
  // Connected marker groups by type at <=4 world units, Chebyshev distance.
  // These are transparent geometric clusters, not asserted playable expansions.
  const ungrouped = new Set(resources), clusters = [];
  while (ungrouped.size) {
    const members = [ungrouped.values().next().value]; ungrouped.delete(members[0]);
    for (let i = 0; i < members.length; i++) for (const next of ungrouped)
      if (next.type === members[i].type && Math.max(Math.abs(next.x - members[i].x), Math.abs(next.z - members[i].z)) <= 4) {
        members.push(next); ungrouped.delete(next);
      }
    clusters.push({ type: members[0].type, ids: members.map(n => n.id), stock: members.reduce((s, n) => s + n.stock, 0),
      minimumRouteWorldLengthsBySeat: [0, 1].map(t => {
        const distances = members.map(n => n.shortestCostRouteWorldLengths[t]).filter(n => n !== null);
        return distances.length ? Math.min(...distances) : null;
      }) });
  }
  const totals = {};
  for (const node of resources) totals[node.type] = (totals[node.type] ?? 0) + node.stock;
  const centerColumn = Math.floor(w / 2), crossings = [];
  for (let y = 0; y < h; y++) {
    const right = y * w + centerColumn, left = right - 1;
    if (blocked[left] || blocked[right] || !canTraverseElevation(levels, left, right)) continue;
    const last = crossings.at(-1);
    if (last && last.row + last.width === y) last.width++;
    else crossings.push({ row: y, width: 1 });
  }
  const objectives = (map.triggers ?? []).map(trigger => {
    const targets = [];
    for (let y = trigger.zone.row; y < trigger.zone.row + trigger.zone.height; y++)
      for (let x = trigger.zone.column; x < trigger.zone.column + trigger.zone.width; x++)
        if (!blocked[y * w + x]) targets.push(y * w + x);
    return { id: trigger.id, name: trigger.name, captureSeconds: trigger.captureSeconds,
      foodReward: trigger.foodReward ?? 0, woodReward: trigger.woodReward ?? 0,
      travelBySeat: trees.map(tree => {
        const target = targets.toSorted((a, b) => tree.distance[a] - tree.distance[b] || a - b)[0];
        return target === undefined ? null : publicRoute(route(tree, target));
      }) };
  });
  const reachableCells = trees.map(tree => count(tree.distance.map(d => Number.isFinite(d) ? 1 : 0)));
  return { id: map.id, name: map.name, pool: map.region || map.audio?.packId?.startsWith('vaelora-') ? 'regional' : 'lab',
    purpose: ['shore-fishing', 'meshy-resource-review'].includes(map.id) ? 'micro-fixture'
      : map.id === 'siltmouths-confluence-grounds' ? 'admitted-test-arena'
      : map.region ? 'regional-skirmish' : 'lab',
    defaultPvp: map.id === constants.defaultMapId, seededPve: PVE_MAP_IDS.includes(map.id),
    geometry: { columns: w, rows: h, cellSideWorldUnits: 1, worldWidth: w, worldHeight: h, area: size,
      terrainWalkableCells: size - count(obstacles), initialWalkableCells: size - count(blocked),
      initialWalkableFraction: round((size - count(blocked)) / size), reachableCellsBySeat: reachableCells,
      obstacleCellsByMaterial: Object.fromEntries(Object.entries(materialMasks).map(([k, v]) => [k, count(v)])),
      elevationCellCounts: [0, 1, 2].map(level => levels.reduce((s, v) => s + Number(v === level), 0)),
      mapSidesInConstructedTownCenterSides: [w, h].map(n => round(n / BUILDING_DEFINITIONS['town-center'].footprint)) },
    travel: { endpoint: 'spawn-cell center to opposing spawn-cell center; initial home TC occupancy included',
      euclideanSpawnWorldDistance: round(Math.hypot(spawns[0].x - spawns[1].x, spawns[0].z - spawns[1].z)),
      shortestGeometricWorldLength: Number.isFinite(geometricTree.distance[spawnCells[1]]) ? geometricTree.distance[spawnCells[1]] : null,
      minimumElevationCostRoute: publicRoute(primary), midpointSevenCellSquareDetour: publicRoute(detour),
      allForestClearedRoute: publicRoute(cleared), centerColumnCrossings: crossings,
      baseSeparationInConstructedTownCenterSides: primary ? round(primary.worldLength / BUILDING_DEFINITIONS['town-center'].footprint) : null,
      objectives },
    buildingSpace: { eligibleGroundCells: size - count(buildExcluded), eligibleGroundFraction: round((size - count(buildExcluded)) / size),
      centersByFootprint: Object.fromEntries(Object.entries(eligible).map(([side, lists]) => [side,
        { legalCenters: lists.legal.length, flatPadCenters: lists.flat.length, legalCenterFraction: round(lists.legal.length / size) }])),
      initialHomeTownCenterFootprintCellsBySeat: homes.map(cells => cells.length),
      cityTemplate: { buildings: CITY.length, types: CITY, homeSquareRadiusCells: 20, circulationRingCells: 1,
        staticGreedyFlatPadFitsBySeat: cityFits, runtimeAddedBuildingLimitSharedBothSeats: constants.maxBuildings } },
    economy: { startingArmyTotalUnits: map.startingArmySize ?? constants.defaultArmySize,
      startingResourcesPerSeat: { food: map.startingResources?.food ?? 0, wood: map.startingResources?.wood ?? 0, stone: 0 }, ordinaryNodeStockTotals: totals,
      forestCells: count(forest), initialForestWoodPotential: count(forest) * constants.forestWoodPerCell,
      resources, geometricResourceClusters: clusters, timedVictory: map.timedVictory ?? null,
      supplyEvents: (map.scenarioEvents ?? []).filter(e => e.type === 'timed-supply') } };
}

export async function runAudit() {
  // Rules and files must come from this one checkout; do not mix arbitrary roots.
  const root = ROOT;
  const source = await readFile(path.join(root, 'server.mjs'), 'utf8');
  function integer(name) {
    const value = source.match(new RegExp(`const ${name} = (\\d+);`))?.[1];
    if (!value) throw new Error(`Recheck simulation contract: ${name}`);
    return Number(value);
  }
  if (!source.includes('Math.floor(x + MAP_HALF_X)') || !source.includes('matchElapsedSeconds += STEP_SECONDS')
    || !source.includes('STEP_SECONDS = 1 / TICK_RATE') || !source.includes('moveSpeed * STEP_SECONDS'))
    throw new Error('Recheck cell conversion or time/movement contract.');
  if (!source.includes('process.env.RTS_MATCH_MODE_VERSION === undefined ? NORMAL_HUMAN_MATCH_MODE : {}')
    || !source.includes('matchModeDefinition(configuredMatchMode).defaultMapId ?? NORMAL_MATCH_MAP_ID'))
    throw new Error('Recheck default map contract.');
  const defaultMapId = matchModeDefinition(NORMAL_HUMAN_MATCH_MODE).defaultMapId ?? NORMAL_MATCH_MAP_ID;
  const constants = { defaultMapId, ticksPerSecond: integer('TICK_RATE'), maxBuildings: integer('MAX_BUILDINGS'),
    forestWoodPerCell: integer('FOREST_WOOD_PER_CELL'), defaultArmySize: integer('DEFAULT_STARTING_ARMY_SIZE') };
  const files = (await readdir(path.join(root, 'maps'))).filter(f => f.endsWith('.json')).sort();
  const inputFiles = ['scripts/map-scale-audit.mjs', 'server.mjs', 'simulation-scheduler.mjs', 'src/map-utils.mjs', 'src/elevation.mjs', 'src/town-center-spawn.mjs',
    'src/gameplay-definitions.mjs', 'src/farm-harvest.mjs', 'src/palisade-profile.mjs', 'src/pve-match.mjs', 'src/match-modes.mjs', 'src/terrain-height.mjs', ...files.map(f => `maps/${f}`)];
  const hashes = {};
  for (const file of inputFiles) hashes[file] = hash(await readFile(path.join(root, file)));
  const maps = [];
  for (const file of files) maps.push({ file: `maps/${file}`,
    ...auditMap(JSON.parse(await readFile(path.join(root, 'maps', file), 'utf8')), constants) });
  return { schemaVersion: 1, sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    sourceInputSha256: hashes, constants,
    buildingFootprintSideCells: Object.fromEntries(Object.entries(BUILDING_DEFINITIONS).map(([id, definition]) => [id, definition.footprint])),
    unitMoveSpeedWorldUnitsPerGameSecond: Object.fromEntries(['worker', 'infantry', 'scout'].map(kind => [kind, UNIT_DEFINITIONS[kind].combat.moveSpeed])),
    timing: { nominalGameSecondsPerWallSecond: 1, observedGameSecondsPerWallSecond: null,
      note: `${constants.ticksPerSecond} fixed steps/s; overload skips wall-time slots without catching up simulation. Nominal times require sustained tick cadence; no observed match timing is claimed.` },
    methods: { route: 'Initial static cardinal graph including both home TC footprints. Min elevation-cost routes use shared costs; equal-cost tie choices may differ from server A*. Travel = route world length / specific unit speed; cost is not speed.',
      buildability: 'Static eligible ground excludes obstacles, home TCs, ordinary resources, objectives. Legal footprint centers allow mixed ground levels as current server does. Flat centers are a separate authoring recommendation. Units, money, prerequisites, access and route-cut rejection are omitted.',
      city: `Greedy geometry only; ${CITY.length}-building template, flat pads, 1-cell free circulation rings, within 20 cells of own spawn and nearer own seat. Fit is a constructive static example, not maximum capacity or paid runtime acceptance.`,
      routes: 'Midpoint 7x7 removal tests local detour resilience, not independent flank routes. Center-column runs measure open crossing widths, not global min-cut or guaranteed army throughput.',
      resources: `Ordinary finite stock separated from ${constants.forestWoodPerCell} wood per initial forest cell (potential after progressive cutting). Type-specific clusters use transitive Chebyshev distance <=4; route distance to markers ignores interaction radius.`,
      comparison: 'Never equate grid counts between engines. Compare travel at declared clock rates, map dimensions divided by gameplay building sides, usable area per seat, expansion count/access and route breadth.' }, maps };
}

export function summaryRecords(report) {
  const { maps, ...metadata } = report;
  return [{ record: 'methods', ...metadata }, ...maps.map(map => ({ ...map,
    record: 'map', buildingSpace: { ...map.buildingSpace, cityTemplate: {
      ...map.buildingSpace.cityTemplate,
      staticGreedyFlatPadFitsBySeat: map.buildingSpace.cityTemplate.staticGreedyFlatPadFitsBySeat.map(({ placements, ...fit }) => fit) } },
    economy: { ...map.economy, resources: undefined, geometricResourceClusters: undefined,
      geometricResourceClusterCount: map.economy.geometricResourceClusters.length } }))];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length > 3 || (process.argv[2] && process.argv[2] !== '--summary-jsonl'))
    throw new Error('Usage: node scripts/map-scale-audit.mjs [--summary-jsonl]');
  const report = await runAudit();
  console.log(process.argv[2] ? summaryRecords(report).map(record => JSON.stringify(record)).join('\n') : JSON.stringify(report, null, 2));
}
