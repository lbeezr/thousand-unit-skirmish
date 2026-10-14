const CELL_LAYERS = ['groundMaterials', 'groundLevels', 'obstacleMaterials', 'obstacleElevations'];

function snapshot(state) {
  return { ...state,
    ...Object.fromEntries(CELL_LAYERS.map(key => [key, state[key].slice()])),
    resourceNodes: JSON.stringify(state.resourceNodes),
  };
}

function matches(saved, state) {
  if (saved.width !== state.width || saved.height !== state.height
    || saved.terrainSeed !== state.terrainSeed
    || saved.resourceNodes !== JSON.stringify(state.resourceNodes)) return false;
  return CELL_LAYERS.every(key => saved[key].length === state[key].length
    && saved[key].every((value, index) => value === state[key][index]));
}

// Editor-only cell deltas; neither history nor previews enter portable map JSON.
// One baseline snapshot detects external resource/terrain edits before navigation.
export class MapStudioTerrainHistory {
  constructor({ limit = 64, byteLimit = 8 * 1024 * 1024 } = {}) {
    if (!Number.isInteger(limit) || limit < 1 || !Number.isInteger(byteLimit) || byteLimit < 1) {
      throw new RangeError('Terrain history limits must be positive integers.');
    }
    this.limit = limit;
    this.byteLimit = byteLimit;
    this.clear();
  }
  clear() {
    this.entries = [];
    this.index = 0;
    this.bytes = 0;
    this.baseline = null;
  }
  get canUndo() { return this.index > 0; }
  get canRedo() { return this.index < this.entries.length; }
  sync(state) {
    if (this.baseline && !matches(this.baseline, state)) this.clear();
  }
  begin(state) {
    this.sync(state);
    return snapshot(state);
  }
  record(before, state) {
    if (before.width !== state.width || before.height !== state.height) {
      this.clear();
      return false;
    }
    if (matches(before, state)) return false;
    const layers = CELL_LAYERS.map(key => {
      const indices = [];
      for (let i = 0; i < state[key].length; i++) {
        if (before[key][i] !== state[key][i]) indices.push(i);
      }
      const Values = state[key].constructor;
      return { key, indices: Uint32Array.from(indices),
        before: Values.from(indices, i => before[key][i]),
        after: Values.from(indices, i => state[key][i]) };
    });
    const nodes = JSON.stringify(state.resourceNodes);
    const resources = before.resourceNodes === nodes ? null : {
      before: before.resourceNodes, after: nodes,
      beforeSelected: before.selectedResourceId, afterSelected: state.selectedResourceId,
    };
    const entry = { layers, resources, beforeSeed: before.terrainSeed, afterSeed: state.terrainSeed };
    entry.bytes = layers.reduce((sum, layer) => sum + layer.indices.byteLength
      + layer.before.byteLength + layer.after.byteLength, 0)
      + (resources ? 2 * (resources.before.length + resources.after.length) : 0) + 32;
    this.entries.splice(this.index);
    this.entries.push(entry);
    this.bytes = this.entries.reduce((sum, item) => sum + item.bytes, 0);
    while (this.entries.length > this.limit || this.bytes > this.byteLimit) {
      this.bytes -= this.entries.shift().bytes;
    }
    this.index = this.entries.length;
    this.baseline = snapshot(state);
    return true;
  }
  restore(direction, state) {
    if (direction !== 'undo' && direction !== 'redo') throw new RangeError('Unknown terrain history direction.');
    this.sync(state);
    if (direction === 'undo' ? !this.canUndo : !this.canRedo) return null;
    const entry = this.entries[direction === 'undo' ? this.index - 1 : this.index];
    const side = direction === 'undo' ? 'before' : 'after';
    for (const layer of entry.layers) {
      layer.indices.forEach((index, i) => { state[layer.key][index] = layer[side][i]; });
    }
    if (entry.resources) {
      state.resourceNodes = JSON.parse(entry.resources[side]);
      state.selectedResourceId = entry.resources[`${side}Selected`];
    }
    state.terrainSeed = entry[`${side}Seed`];
    this.index += direction === 'undo' ? -1 : 1;
    this.baseline = snapshot(state);
    return state;
  }
}
