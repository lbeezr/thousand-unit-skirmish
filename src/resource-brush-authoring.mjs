import { appendSeededResourceCluster } from './resource-cluster-authoring.mjs';
import { DEFAULT_ECONOMY_PROFILE_ID, resolveEconomyProfileId } from './economy-profile.mjs';

const copy = value => JSON.parse(JSON.stringify(value));
const previews = new WeakMap();
// Only placement inputs and map identity invalidate a preview/history. Names,
// objectives and other unrelated editor fields may change without being replaced.
function placementKey(map) {
  const profileId = resolveEconomyProfileId(map.economyProfileId);
  return JSON.stringify([map.id, map.width, map.height, map.terrainBase,
    map.terrainPatches ?? [], map.elevationPatches ?? [], map.obstacles,
    map.spawnPoints, map.resourceNodes ?? [],
    ...(profileId === DEFAULT_ECONOMY_PROFILE_ID ? [] : [profileId])]);
}
export { placementKey as resourceBrushMapKey };

// Read-only preview on a validated map. Stock is the entire patch budget.
export function previewResourceBrush(map, settings) {
  const { seed, type, x, z, totalStock, nodesPerPatch = 5, radius = 4,
    spawnClearance = 6, distribution = 'uniform' } = settings;
  const options = Object.freeze({ seed, type, x, z, totalStock, nodesPerPatch, radius, spawnClearance, distribution });
  const resourceNodes = appendSeededResourceCluster(map, options);
  const nodes = resourceNodes.slice((map.resourceNodes ?? []).length);
  const preview = Object.freeze({ settings: options,
    nodes: Object.freeze(copy(nodes).map(node => Object.freeze(node))) });
  previews.set(preview, { base: placementKey(map), resourceNodes: copy(resourceNodes) });
  return preview;
}

// A stale, edited or JSON-reloaded preview must be regenerated, never retargeted.
export function applyResourceBrush(map, preview) {
  const receipt = previews.get(preview);
  if (!receipt || receipt.base !== placementKey(map)) {
    throw new Error('Resource brush preview is stale or unknown; preview again.');
  }
  return copy(receipt.resourceNodes);
}

// Thin editor adapter: readMap must include the current compressed terrain,
// elevation, spawns and node array. commit synchronously replaces BOTH resource
// fields atomically or throws before writing; redraw/save happen after success.
export function createResourceBrushEditor({ readMap, readSelectedId = () => null, commit, limit = 64 }) {
  if (typeof readMap !== 'function' || typeof readSelectedId !== 'function'
    || typeof commit !== 'function' || !Number.isInteger(limit) || limit < 1 || limit > 64) {
    throw new Error('Invalid resource brush editor callbacks or history limit.');
  }
  let entries = [], index = 0, pending = null, currentKey = placementKey(readMap());
  function requireCurrent(map) {
    if (placementKey(map) !== currentKey) {
      throw new Error('Resource brush editor changed outside this history; reset before editing.');
    }
  }
  function snapshot(map) {
    const resourceNodes = copy(map.resourceNodes ?? []), selectedId = readSelectedId();
    return { resourceNodes,
      selectedResourceId: resourceNodes.some(node => node.id === selectedId) ? selectedId : null };
  }
  function write(map, state) {
    const nextKey = placementKey({ ...map, resourceNodes: state.resourceNodes });
    commit(copy(state));
    currentKey = nextKey;
    pending = null;
  }
  function restore(direction) {
    const entry = entries[direction === 'undo' ? index - 1 : index];
    if (!entry) return false;
    const map = readMap(); requireCurrent(map);
    write(map, entry[direction === 'undo' ? 'before' : 'after']);
    index += direction === 'undo' ? -1 : 1;
    return true;
  }
  return {
    get canUndo() { return index > 0 && placementKey(readMap()) === currentKey; },
    get canRedo() { return index < entries.length && placementKey(readMap()) === currentKey; },
    preview(settings) {
      const map = readMap(); requireCurrent(map); pending = null;
      pending = previewResourceBrush(map, settings);
      return pending;
    },
    cancel() { pending = null; },
    apply(preview = pending) {
      if (!preview || preview !== pending) throw new Error('Preview this resource brush before applying.');
      const map = readMap(); requireCurrent(map);
      const before = snapshot(map), after = {
        resourceNodes: applyResourceBrush(map, preview), selectedResourceId: preview.nodes[0].id,
      };
      write(map, after);
      entries.splice(index); entries.push({ before, after });
      if (entries.length > limit) entries.shift();
      index = entries.length;
      return true;
    },
    undo() { return restore('undo'); },
    redo() { return restore('redo'); },
    // Call after map load/resize or resource/terrain edits by another tool.
    reset() { currentKey = placementKey(readMap()); entries = []; index = 0; pending = null; },
  };
}
