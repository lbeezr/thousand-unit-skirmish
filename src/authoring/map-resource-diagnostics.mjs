import { buildElevationGrid } from '../map-utils.mjs';
import { canTraverseElevation } from '../elevation.mjs';
import { townCenterFootprintCells } from '../town-center-spawn.mjs';
import { economyResources } from '../economy-profile.mjs';
import { FOREST_WOOD_PER_CELL } from '../rules/forest-resources.mjs';
import { resourceBudget } from './map-resource-budgets.mjs';

function neighbors(cell, width, height) {
  const column = cell % width, row = Math.floor(cell / width);
  return [column > 0 ? cell - 1 : -1, column + 1 < width ? cell + 1 : -1,
    row > 0 ? cell - width : -1, row + 1 < height ? cell + width : -1];
}

function distancesFrom(start, width, height, blocked, levels) {
  const distances = new Int32Array(blocked.length).fill(-1), queue = new Int32Array(blocked.length);
  if (blocked[start]) return distances;
  let head = 0, tail = 1;
  queue[0] = start; distances[start] = 0;
  while (head < tail) {
    const cell = queue[head++];
    for (const next of neighbors(cell, width, height)) {
      if (next < 0 || blocked[next] || distances[next] >= 0 || !canTraverseElevation(levels, cell, next)) continue;
      distances[next] = distances[cell] + 1; queue[tail++] = next;
    }
  }
  return distances;
}

function checkedCell(point, width, height) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.z)
    || Math.abs(point.x) >= width / 2 || Math.abs(point.z) >= height / 2) {
    throw new Error('Move every spawn and resource marker inside the map before analyzing access.');
  }
  return Math.floor(point.z + height / 2) * width + Math.floor(point.x + width / 2);
}

// Static draft analysis, never a live-world read or a publication/balance gate.
// Four bounded traversals cover initial land and potential after forest cutting.
export function analyzeMapResources(map) {
  const { width, height } = map;
  if (![width, height].every(value => Number.isInteger(value) && value >= 16 && value <= 256)) {
    throw new Error('Set map dimensions between 16 and 256 before analyzing access.');
  }
  const resourceTypes = economyResources(map.economyProfileId);
  if (!Array.isArray(map.obstacles) || map.obstacles.length > 4096
    || !Array.isArray(map.spawnPoints) || map.spawnPoints.length !== 2
    || ![0, 1].every(team => map.spawnPoints.filter(spawn => spawn?.team === team).length === 1)) {
    throw new Error('Access analysis needs terrain and one spawn for each seat.');
  }
  const blocked = new Uint8Array(width * height), forest = new Uint8Array(blocked.length);
  const centers = new Uint8Array(blocked.length);
  for (const rectangle of map.obstacles) {
    const { column, row, width: w, height: h, material = 'stone' } = rectangle || {};
    if (![column, row, w, h].every(Number.isInteger) || column < 0 || row < 0 || w < 1 || h < 1
      || column + w > width || row + h > height || !['stone', 'forest', 'water'].includes(material)) {
      throw new Error('Correct invalid terrain blocks before analyzing access.');
    }
    for (let z = row; z < row + h; z++) for (let x = column; x < column + w; x++) {
      const cell = z * width + x;
      if (blocked[cell]) throw new Error('Remove overlapping terrain blocks before analyzing access.');
      blocked[cell] = 1; forest[cell] = Number(material === 'forest');
    }
  }
  const spawnCells = [0, 1].map(team => checkedCell(map.spawnPoints.find(spawn => spawn.team === team), width, height));
  for (const team of [0, 1]) for (const cell of townCenterFootprintCells(map.spawnPoints, team, width, height)) {
    blocked[cell] = 1; centers[cell] = 1;
  }
  const levels = buildElevationGrid(width, height, map.elevationPatches);
  const paths = spawnCells.map(cell => distancesFrom(cell, width, height, blocked, levels));
  const afterCut = blocked.map((value, cell) => forest[cell] && !centers[cell] ? 0 : value);
  const cutPaths = spawnCells.map(cell => distancesFrom(cell, width, height, afterCut, levels));
  const budget = () => resourceBudget(resourceTypes);
  const total = budget(), closer = [budget(), budget()], equal = budget(), inaccessible = budget();
  const reachable = [budget(), budget()];
  const nodes = map.resourceNodes ?? [];
  if (!Array.isArray(nodes) || nodes.length > 128) throw new Error('Access analysis supports at most 128 resource nodes.');
  const ids = new Set(), rows = [];
  for (const node of nodes) {
    if (!node || typeof node.id !== 'string' || !node.id || ids.has(node.id)
      || !resourceTypes.includes(node.type) || !Number.isFinite(node.stock) || node.stock <= 0) {
      throw new Error('Correct invalid, duplicate or unsupported resource nodes before analyzing access.');
    }
    ids.add(node.id);
    const cell = checkedCell(node, width, height);
    const distances = paths.map(path => path[cell] < 0 ? null : path[cell]);
    const nearest = distances.every(distance => distance === null) ? 'inaccessible'
      : distances[0] === null ? 1 : distances[1] === null ? 0
        : distances[0] === distances[1] ? 'equal' : distances[0] < distances[1] ? 0 : 1;
    total.add(node.type, node.stock);
    if (nearest === 'inaccessible') inaccessible.add(node.type, node.stock);
    else if (nearest === 'equal') equal.add(node.type, node.stock);
    else closer[nearest].add(node.type, node.stock);
    distances.forEach((distance, team) => { if (distance !== null) reachable[team].add(node.type, node.stock); });
    const frontage = paths.map(path => neighbors(cell, width, height).filter(next => next >= 0
      && !blocked[cell] && path[next] >= 0 && canTraverseElevation(levels, next, cell)).length);
    rows.push({ id: node.id, type: node.type, stock: node.stock, distances, nearest, frontage,
      kind: node.wildlifeSpecies ? 'Sheep' : node.resourceVariant === 'shore-fish' ? 'Shore fish' : 'Node',
      blockedBy: centers[cell] ? 'Town Center' : blocked[cell] ? 'terrain' : null });
  }
  const starting = Object.fromEntries(resourceTypes.map(type => [type, 0]));
  for (const type of ['food', 'wood']) {
    const value = map.startingResources?.[type] ?? 0;
    if (!Number.isInteger(value) || value < 0 || value > 100000) {
      throw new Error('Starting food and wood must be whole amounts from 0 to 100,000.');
    }
    starting[type] = value;
  }
  const forestReport = { cells: 0, woodPerCell: FOREST_WOOD_PER_CELL, potential: 0,
    reachableAfterCut: [0, 0], initialEdgeCells: [0, 0] };
  for (let cell = 0; cell < forest.length; cell++) if (forest[cell]) {
    forestReport.cells++; forestReport.potential += FOREST_WOOD_PER_CELL;
    for (const team of [0, 1]) {
      if (cutPaths[team][cell] >= 0) forestReport.reachableAfterCut[team] += FOREST_WOOD_PER_CELL;
      if (!centers[cell] && neighbors(cell, width, height).some(next => next >= 0
        && paths[team][next] >= 0 && canTraverseElevation(levels, next, cell))) forestReport.initialEdgeCells[team]++;
    }
  }
  const issues = [];
  for (const team of [0, 1]) if (blocked[spawnCells[team]]) issues.push({ team,
    message: `${team ? 'Ember' : 'Azure'} spawn is blocked by terrain or a starting Town Center. Move the spawn to open ground.` });
  const connected = paths[0][spawnCells[1]] >= 0;
  if (!connected && !issues.length) issues.push({ message: 'Spawns have no initial land connection. Review water, forest gaps and level-1 ramps.' });
  for (const row of rows) if (row.distances.some(distance => distance === null)) issues.push({ nodeId: row.id,
    message: `${row.id}: ${row.blockedBy ? `blocked by ${row.blockedBy}` : `no initial route for ${row.distances[0] === null && row.distances[1] === null ? 'either seat' : row.distances[0] === null ? 'Azure' : 'Ember'}`}. Move the node or open a terrain/ramp route.` });
  return { resourceTypes: [...resourceTypes], startingPerSeat: [{ ...starting }, { ...starting }],
    total: total.values(), closer: closer.map(budget => budget.values()), equal: equal.values(),
    inaccessible: inaccessible.values(), reachable: reachable.map(budget => budget.values()),
    nodes: rows, forest: forestReport, spawnsConnected: connected, issues };
}
