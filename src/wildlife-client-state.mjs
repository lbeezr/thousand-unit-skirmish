// Client disclosure and string-ID selection only. Food, navigation and ownership
// remain authoritative; army selection and shared Gather do not use this state.
const SPECIES = 'bellweather-sheep', TAU = Math.PI * 2;
const publicKeys = new Set(['id', 'type', 'resourceVariant', 'stock', 'wildlifeSpecies',
  'wildlifeState', 'wildlifeTeam', 'x', 'z', 'wildlifeHeading', 'wildlifeActivity']);
const runtimeKeys = ['wildlifeState', 'wildlifeTeam', 'wildlifeHerd', 'wildlifeGrazeAnchor',
  'wildlifeMotion', 'wildlifeActivity', 'wildlifeHeading'];
const seat = team => team === 0 || team === 1;
const teamLabel = team => team === null || seat(team);
const bounded = (point, map) => Number.isFinite(point?.x) && Number.isFinite(point.z)
  && point.x >= -map.width / 2 && point.x < map.width / 2
  && point.z >= -map.height / 2 && point.z < map.height / 2;
const sameContext = (a, b) => Boolean(a && b && a.map === b.map && a.mapId === b.mapId
  && a.resourceEpoch === b.resourceEpoch && a.team === b.team);

function validDefinition(node, map) {
  return typeof node?.id === 'string' && node.id.length > 0 && node.type === 'food'
    && node.wildlifeSpecies === SPECIES && Number.isFinite(node.stock) && node.stock > 0
    && bounded(node, map) && runtimeKeys.every(key => node[key] === undefined)
    && (node.wildlifeNoseYawDegrees === undefined || (Number.isFinite(node.wildlifeNoseYawDegrees)
      && node.wildlifeNoseYawDegrees >= 0 && node.wildlifeNoseYawDegrees < 360));
}

function readRow(row, definition, map) {
  if (!row || typeof row !== 'object' || Array.isArray(row)
    || Object.keys(row).some(key => !publicKeys.has(key))
    || row.id !== definition.id || row.type !== 'food' || row.wildlifeSpecies !== SPECIES
    || row.resourceVariant !== definition.resourceVariant || !teamLabel(row.wildlifeTeam)
    || !bounded(row, map) || !Number.isFinite(row.stock) || row.stock < 0 || row.stock > definition.stock
    || !Number.isFinite(row.wildlifeHeading) || row.wildlifeHeading < 0 || row.wildlifeHeading >= TAU) return null;
  if (row.wildlifeState === 'alive') {
    if (row.stock !== definition.stock || !['idle', 'grazing', 'wandering'].includes(row.wildlifeActivity)) return null;
  } else if ((row.wildlifeState !== 'carcass' || row.stock <= 0)
    && (row.wildlifeState !== 'depleted' || row.stock !== 0)) return null;
  if (row.wildlifeState !== 'alive' && row.wildlifeActivity !== undefined) return null;
  return Object.freeze({ id: row.id, type: row.type, stock: row.stock,
    ...(row.resourceVariant === undefined ? {} : { resourceVariant: row.resourceVariant }),
    wildlifeSpecies: SPECIES, wildlifeState: row.wildlifeState, wildlifeTeam: row.wildlifeTeam,
    x: row.x, z: row.z, wildlifeHeading: row.wildlifeHeading,
    ...(row.wildlifeState === 'alive' ? { wildlifeActivity: row.wildlifeActivity } : {}),
  });
}

// Missing resource rows mean no disclosure, including for the last owner. A fog
// predicate receives the sanitized actual pose, never the authored position.
export function readDisclosedWildlife(map, snapshot, team, isVisible) {
  if (typeof map?.id !== 'string' || !map.id || snapshot?.mapId !== map.id
    || !Number.isSafeInteger(map.width) || map.width <= 0
    || !Number.isSafeInteger(map.height) || map.height <= 0
    || !Number.isSafeInteger(map.width * map.height) || !Array.isArray(map.resourceNodes)
    || !Number.isSafeInteger(snapshot.forestEpoch) || snapshot.forestEpoch < 0 || !teamLabel(team)) return null;
  const definitions = new Map(), definitionCounts = new Map(), rowCounts = new Map(), rows = new Map();
  for (const node of map.resourceNodes) definitionCounts.set(node?.id, (definitionCounts.get(node?.id) || 0) + 1);
  for (const node of map.resourceNodes) {
    if (definitionCounts.get(node?.id) === 1 && validDefinition(node, map)) definitions.set(node.id, node);
  }
  const disclosed = Array.isArray(snapshot.resourceNodes) ? snapshot.resourceNodes : [];
  for (const row of disclosed) rowCounts.set(row?.id, (rowCounts.get(row?.id) || 0) + 1);
  for (const row of disclosed) {
    const definition = definitions.get(row?.id);
    if (!definition || rowCounts.get(row.id) !== 1) continue;
    const parsed = readRow(row, definition, map);
    if (!parsed) continue;
    const visible = typeof isVisible === 'function' ? isVisible(parsed) === true : map.fogOfWar !== true || team === null;
    if (visible) rows.set(parsed.id, parsed);
  }
  return Object.freeze({ map, mapId: map.id, resourceEpoch: snapshot.forestEpoch, team, rows });
}

export function selectOwnedWildlife(view, nodeId) {
  if (!seat(view?.team) || typeof nodeId !== 'string') return null;
  const row = view.rows?.get(nodeId);
  return row?.wildlifeState === 'alive' && row.stock > 0 && row.wildlifeTeam === view.team ? nodeId : null;
}

export function reconcileWildlifeSelection(nodeId, previousView, currentView) {
  return sameContext(previousView, currentView) ? selectOwnedWildlife(currentView, nodeId) : null;
}

// Keep the view from which selection was made as selectionView. A rematch using
// the same ID cannot silently send an order into its new resource epoch. Tokens
// are intentionally added by the existing sendTrackedOrder caller.
export function createWildlifeCommand(type, nodeId, selectionView, currentView, destination, {
  isVisible, isLegalEndpoint,
} = {}) {
  if (!sameContext(selectionView, currentView) || selectOwnedWildlife(currentView, nodeId) === null) return null;
  if (type === 'stopWildlife') return { type, nodeId, resourceEpoch: currentView.resourceEpoch };
  if (type !== 'herd' || !bounded(destination, currentView.map)) return null;
  const point = Object.freeze({ x: destination.x, z: destination.z });
  if (typeof isVisible !== 'function' || typeof isLegalEndpoint !== 'function'
    || isVisible(point) !== true || isLegalEndpoint(point) !== true) return null;
  return { type, nodeId, resourceEpoch: currentView.resourceEpoch, x: point.x, z: point.z };
}

// Construction may conservatively retain a last disclosed positive-food pose.
// Hidden rows never update it; selection and commands accept only current views.
export function updateWildlifePositionMemory(previousMemory, view) {
  if (!view) return null;
  const positions = new Map();
  if (sameContext(previousMemory, view)) {
    for (const [id, point] of previousMemory.positions) positions.set(id, Object.freeze({ x: point.x, z: point.z }));
  }
  for (const [id, row] of view.rows) {
    if (row.stock === 0) positions.delete(id);
    else positions.set(id, Object.freeze({ x: row.x, z: row.z }));
  }
  return Object.freeze({ map: view.map, mapId: view.mapId, resourceEpoch: view.resourceEpoch, team: view.team, positions });
}
