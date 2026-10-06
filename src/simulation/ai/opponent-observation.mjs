// Pure peer-scoped observation projection; no policy, socket or match-state ownership.
import { TECHNOLOGY_DEFINITIONS } from '../../gameplay-definitions.mjs';
import { farmHarvestNodeId } from '../../farm-harvest.mjs';
import { readDisclosedWildlife } from '../../wildlife-client-state.mjs';

export const OPPONENT_OBSERVATION_SCHEMA_VERSION = 1;

function validTeam(team) {
  return Number.isInteger(team) && (team === 0 || team === 1);
}

function assertTeam(team) {
  if (!validTeam(team)) throw new TypeError('Opponent seat must be assigned team 0 or 1.');
}

function decodeVisibility(state, map) {
  if (state.fogOfWar !== true) return null;
  const mask = state.visibility;
  const columns = Number.isInteger(map?.width) ? map.width : mask?.columns;
  const rows = Number.isInteger(map?.height) ? map.height : mask?.rows;
  if (!mask || !Number.isInteger(columns) || !Number.isInteger(rows)
    || mask.columns !== columns || mask.rows !== rows || typeof mask.data !== 'string') {
    throw new TypeError('Fogged opponent state requires a matching team visibility mask.');
  }

  let binary;
  try {
    binary = typeof atob === 'function'
      ? atob(mask.data)
      : Buffer.from(mask.data, 'base64').toString('binary');
  } catch {
    throw new TypeError('Opponent visibility mask is not valid base64.');
  }
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  if (bytes.length < Math.ceil(columns * rows / 4)) {
    throw new TypeError('Opponent visibility mask is truncated.');
  }

  function cellStateAtWorld(x, z) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return 0;
    const column = Math.floor(x + columns / 2);
    const row = Math.floor(z + rows / 2);
    if (column < 0 || column >= columns || row < 0 || row >= rows) return 0;
    const cell = row * columns + column;
    return (bytes[cell >> 2] >> ((cell & 3) * 2)) & 0b11;
  }

  function buildingVisibleAtWorld(x, z) {
    const centerColumn = Math.floor(x + columns / 2);
    const centerRow = Math.floor(z + rows / 2);
    if (cellStateAtWorld(x, z) === 2) return true;
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (Math.abs(dx) <= 1 && Math.abs(dz) <= 1) continue;
        const column = centerColumn + dx;
        const row = centerRow + dz;
        if (column < 0 || column >= columns || row < 0 || row >= rows) continue;
        const cell = row * columns + column;
        if (((bytes[cell >> 2] >> ((cell & 3) * 2)) & 0b11) === 2) return true;
      }
    }
    return false;
  }

  function zoneFullyVisible(zone) {
    if (!zone || !Number.isInteger(zone.column) || !Number.isInteger(zone.row)
      || !Number.isInteger(zone.width) || !Number.isInteger(zone.height)
      || zone.width < 1 || zone.height < 1
      || zone.column < 0 || zone.row < 0
      || zone.column + zone.width > columns || zone.row + zone.height > rows) return false;
    for (let row = zone.row; row < zone.row + zone.height; row++) {
      for (let column = zone.column; column < zone.column + zone.width; column++) {
        const cell = row * columns + column;
        if (((bytes[cell >> 2] >> ((cell & 3) * 2)) & 0b11) !== 2) return false;
      }
    }
    return true;
  }

  return {
    columns,
    rows,
    data: mask.data,
    cellStateAtWorld,
    buildingVisibleAtWorld,
    zoneFullyVisible,
  };
}

function normalizeUnit(row, team) {
  if (!Array.isArray(row) || !Number.isInteger(row[0]) || !validTeam(row[1])
    || !Number.isFinite(row[2]) || !Number.isFinite(row[3])
    || !Number.isFinite(row[4]) || typeof row[5] !== 'string') return null;
  const own = row[1] === team;
  const lastAttack = Number.isFinite(row[11]) && Number.isFinite(row[12]) && Number.isFinite(row[13])
    ? { tick: row[11], x: row[12], z: row[13] } : null;
  return {
    id: row[0],
    team: row[1],
    x: row[2],
    z: row[3],
    hp: row[4],
    kind: row[5],
    cargo: Number.isFinite(row[6]) ? row[6] : 0,
    cargoType: typeof row[7] === 'string' ? row[7] : '',
    generation: Number.isInteger(row[8]) ? row[8] : 0,
    task: own && row[5] === 'worker' && typeof row[9] === 'string' ? row[9] : null,
    focusedCount: Number.isInteger(row[10]) ? row[10] : 0,
    lastAttack,
  };
}

function normalizeBuilding(building, viewTeam) {
  if (!building || !Number.isInteger(building.id) || !validTeam(building.team)
    || typeof building.type !== 'string' || !Number.isFinite(building.x)
    || !Number.isFinite(building.z)) return null;
  const queue = Array.isArray(building.queue)
    ? building.queue.length : Number.isInteger(building.queue) ? building.queue : 0;
  return {
    id: building.id,
    team: building.team,
    type: building.type,
    home: building.home === true,
    x: building.x,
    z: building.z,
    hp: Number.isFinite(building.hp) ? building.hp : null,
    maxHp: Number.isFinite(building.maxHp) ? building.maxHp : null,
    progress: Number.isFinite(building.progress) ? building.progress : null,
    complete: building.complete === true,
    queue,
    researchOptions: building.team === viewTeam && Array.isArray(building.researchOptions)
      ? building.researchOptions.filter(option => option && Object.hasOwn(TECHNOLOGY_DEFINITIONS, option.upgrade) && typeof option.available === 'boolean')
        .map(option => ({ upgrade: option.upgrade, available: option.available, reason: typeof option.reason === 'string' ? option.reason : '' })) : [],
    productionOptions: building.team === viewTeam && Array.isArray(building.productionOptions)
      ? building.productionOptions.filter((option) => option && typeof option.kind === 'string' && typeof option.available === 'boolean')
        .map((option) => ({ kind: option.kind, available: option.available, reason: typeof option.reason === 'string' ? option.reason : '',
          missingPrerequisites: Array.isArray(option.missingPrerequisites) ? option.missingPrerequisites.filter((id) => typeof id === 'string') : [] })) : [],
    trainingRemaining: Number.isFinite(building.trainingRemaining) ? building.trainingRemaining : 0,
    productionBlocked: building.productionBlocked === true,
    trainingProgress: Number.isFinite(building.trainingProgress) ? building.trainingProgress : 0,
  };
}

function normalizePopulation(record) {
  if (!record || !['used', 'reserved', 'capacity', 'available'].every((key) => Number.isInteger(record[key]) && record[key] >= 0)
    || record.capacity > 1000 || record.available !== Math.max(0, record.capacity - record.used - record.reserved)) return null;
  return { used: record.used, reserved: record.reserved, capacity: record.capacity, available: record.available };
}

function normalizeWorkerProduction(record, team) {
  if (!record || record.team !== team) return null;
  return {
    queue: Number.isInteger(record.queue) ? record.queue : 0,
    trainingRemaining: Number.isFinite(record.trainingRemaining) ? record.trainingRemaining : 0,
    productionBlocked: record.productionBlocked === true,
    trainingProgress: Number.isFinite(record.trainingProgress) ? record.trainingProgress : 0,
  };
}

function normalizeResearch(record) {
  if (!record || typeof record !== 'object') return null;
  return {
    ...Object.fromEntries(Object.values(TECHNOLOGY_DEFINITIONS).map(technology => [technology.upgradeKey, record[technology.upgradeKey] === true])),
    active: record.active && typeof record.active === 'object'
      ? {
        type: typeof record.active.type === 'string' ? record.active.type : null,
        buildingId: Number.isInteger(record.active.buildingId) ? record.active.buildingId : null,
        remaining: Number.isFinite(record.active.remaining) ? record.active.remaining : 0,
        progress: Number.isFinite(record.active.progress) ? record.active.progress : 0,
      }
      : null,
  };
}

function visibleResources(state, map, visibility, team) {
  const stateNodes = Array.isArray(state.resourceNodes) ? state.resourceNodes : [];
  const mapNodes = new Map((Array.isArray(map?.resourceNodes) ? map.resourceNodes : [])
    .filter((node) => typeof node?.id === 'string')
    .map((node) => [node.id, node]));
  const visible = [];
  const wildlife = readDisclosedWildlife(map, state, team, point =>
    !visibility || visibility.cellStateAtWorld(point.x, point.z) === 2)?.rows;
  for (const record of stateNodes) {
    if (typeof record?.id !== 'string' || typeof record.type !== 'string'
      || !Number.isFinite(record.stock)) continue;
    const farm = record.sourceBuildingId === undefined ? null : state.buildings?.find(building =>
      building.id === record.sourceBuildingId && building.team === team && building.type === 'farm'
      && building.complete && building.hp > 0 && record.type === 'food' && record.id === farmHarvestNodeId(building.id));
    const authored = mapNodes.get(record.id);
    const location = authored?.wildlifeSpecies === undefined ? authored ?? farm : wildlife?.get(record.id);
    if (!location || !Number.isFinite(location.x) || !Number.isFinite(location.z)) continue;
    // The server always publishes owned structures, including occupied centers
    // outside the cell visibility mask. Neutral authored nodes still need sight.
    if (visibility && !farm && visibility.cellStateAtWorld(location.x, location.z) !== 2) continue;
    visible.push({ id: record.id, type: record.type, stock: record.stock, x: location.x, z: location.z });
  }
  return visible.sort((left, right) => left.id.localeCompare(right.id));
}

// Static authored addresses locate trees; only current peer sight supplies
// usable stock. Missing changed entries mean the native initial six wood.
function visibleForestCells(state, map, visibility) {
  if (!Array.isArray(state.forestStocks) || !Number.isInteger(map?.width)
    || !Number.isInteger(map?.height)) return [];
  const stocks = new Map(state.forestStocks), cells = new Map();
  for (const obstacle of map.obstacles || []) {
    if (obstacle.material !== 'forest') continue;
    for (let row = obstacle.row; row < obstacle.row + obstacle.height; row++) {
      for (let column = obstacle.column; column < obstacle.column + obstacle.width; column++) {
        const cell = row * map.width + column, x = column + .5 - map.width / 2, z = row + .5 - map.height / 2;
        if (visibility && visibility.cellStateAtWorld(x, z) !== 2) continue;
        const stock = stocks.has(cell) ? stocks.get(cell) : 6;
        if (Number.isFinite(stock) && stock > 0 && stock <= 6) cells.set(cell, { cell, x, z, stock });
      }
    }
  }
  return [...cells.values()].sort((a, b) => a.cell - b.cell);
}

function normalizeObjectiveZone(zone) {
  if (!zone || !Number.isInteger(zone.column) || !Number.isInteger(zone.row)
    || !Number.isInteger(zone.width) || !Number.isInteger(zone.height)
    || zone.width < 1 || zone.height < 1) return null;
  return {
    column: zone.column,
    row: zone.row,
    width: zone.width,
    height: zone.height,
  };
}

function countObservableUnits(units, zone, map, visibility) {
  const columns = Number.isInteger(map?.width) ? map.width : visibility?.columns;
  const rows = Number.isInteger(map?.height) ? map.height : visibility?.rows;
  const counts = [0, 0];
  if (!zone || !Number.isInteger(columns) || !Number.isInteger(rows)) return counts;
  for (const unit of units) {
    if (unit.hp <= 0) continue;
    const column = Math.floor(unit.x + columns / 2);
    const row = Math.floor(unit.z + rows / 2);
    if (column >= zone.column && column < zone.column + zone.width
      && row >= zone.row && row < zone.row + zone.height) counts[unit.team]++;
  }
  return counts;
}

function projectObjectives(state, map, visibility, units) {
  const stateObjectives = Array.isArray(state.objectives) ? state.objectives : [];
  const triggers = new Map((Array.isArray(map?.triggers) ? map.triggers : [])
    .filter((trigger) => typeof trigger?.id === 'string')
    .map((trigger) => [trigger.id, trigger]));
  const objectives = [];
  for (const record of stateObjectives) {
    if (typeof record?.id !== 'string' || !Number.isInteger(record.owner)) continue;
    const trigger = triggers.get(record.id);
    const zone = normalizeObjectiveZone(trigger?.zone);
    const objective = {
      id: record.id,
      zone,
      owner: record.owner,
      victory: record.victory === true,
      requires: typeof record.requires === 'string' ? record.requires : null,
      requiredOwner: Number.isInteger(record.requiredOwner) ? record.requiredOwner : -1,
    };
    if (Array.isArray(record.requiresAll)) {
      objective.requiresAll = record.requiresAll.filter((id) => typeof id === 'string');
    }
    if (Array.isArray(record.requiredOwners)) {
      objective.requiredOwners = record.requiredOwners
        .filter((owner) => Number.isInteger(owner));
    }

    objective.unitCounts = countObservableUnits(units, zone, map, visibility);
    const progressVisible = !visibility || (zone !== null && visibility.zoneFullyVisible(zone));
    if (progressVisible) {
      objective.progressTeam = Number.isInteger(record.progressTeam) ? record.progressTeam : -1;
      objective.progress = Number.isFinite(record.progress) ? record.progress : 0;
    }
    objectives.push(objective);
  }
  return objectives.sort((left, right) => left.id.localeCompare(right.id));
}

/**
 * Convert only a peer-specific `welcome.state` / `state` / `mapChange.state`
 * into the stable bot/model DTO. `team` must come from `welcome.player.team`.
 * The full map supplies resource coordinates for peer-visible resource IDs
 * and public objective zones; resource positions are rechecked against the
 * peer's visibility mask, while objective visibility gates transient progress.
 */
export function toOpponentObservation(state, team, map = null) {
  assertTeam(team);
  if (!state || state.type !== 'state') throw new TypeError('Opponent adapter requires a peer-scoped state snapshot.');
  if (typeof state.fogOfWar !== 'boolean') throw new TypeError('Opponent state must declare its fog-of-war mode.');
  const visibility = decodeVisibility(state, map);
  const units = (Array.isArray(state.units) ? state.units : [])
    .map((row) => normalizeUnit(row, team))
    .filter((unit) => unit && (unit.team === team
      || !visibility || visibility.cellStateAtWorld(unit.x, unit.z) === 2))
    .sort((left, right) => left.id - right.id);
  const buildings = [...(Array.isArray(state.buildings) ? state.buildings : []),
    ...(Array.isArray(state.homeTownCenters) ? state.homeTownCenters : [])]
    .map((building) => normalizeBuilding(building, team))
    .filter((building) => building && (building.team === team
      || !visibility || visibility.buildingVisibleAtWorld(building.x, building.z)))
    .sort((left, right) => left.id - right.id);
  const research = Array.isArray(state.teamResearch) ? normalizeResearch(state.teamResearch[team]) : null;
  const food = Array.isArray(state.food) ? state.food[team] : null;
  const wood = Array.isArray(state.wood) ? state.wood[team] : null;
  if (!Number.isFinite(food) || !Number.isFinite(wood)) {
    throw new TypeError('Opponent state is missing the assigned team resource balances.');
  }

  return {
    schemaVersion: OPPONENT_OBSERVATION_SCHEMA_VERSION,
    team,
    tick: Number.isSafeInteger(state.tick) ? state.tick : 0,
    map: {
      id: typeof state.mapId === 'string' ? state.mapId : typeof map?.id === 'string' ? map.id : null,
      width: Number.isInteger(map?.width) ? map.width : visibility?.columns ?? null,
      height: Number.isInteger(map?.height) ? map.height : visibility?.rows ?? null,
    },
    fogOfWar: state.fogOfWar === true,
    visibility: visibility ? { columns: visibility.columns, rows: visibility.rows, data: visibility.data } : null,
    resources: { food, wood },
    population: normalizePopulation(state.population?.[team]),
    units: {
      friendly: units.filter((unit) => unit.team === team),
      visibleEnemies: units.filter((unit) => unit.team !== team),
    },
    buildings: {
      friendly: buildings.filter((building) => building.team === team),
      visibleEnemies: buildings.filter((building) => building.team !== team),
    },
    workerProduction: normalizeWorkerProduction(
      Array.isArray(state.workerProduction) ? state.workerProduction[team] : null,
      team,
    ),
    research,
    resourceNodes: visibleResources(state, map, visibility, team),
    forestCells: visibleForestCells(state, map, visibility),
    objectives: projectObjectives(state, map, visibility, units),
  };
}

