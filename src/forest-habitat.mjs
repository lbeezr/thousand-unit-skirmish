// Distance to the actual woodland margin, independent of rectangle compression.
// Presentation only: every forest cell keeps its harvest identity and stock.
/**
 * @typedef {Readonly<{column: number, row: number, width: number, height: number,
 *   material?: 'stone' | 'forest' | 'water'}>} ForestObstacle
 * @typedef {Readonly<{width: number, height: number,
 *   obstacles?: ReadonlyArray<ForestObstacle> | null}>} ForestHabitatMap
 */

/** @param {ForestHabitatMap} definition @returns {Uint16Array} Row-major depths by map cell. */
export function forestHabitatDepth(definition) {
  const { width, height } = definition;
  const depth = new Uint16Array(width * height);
  for (const rect of definition.obstacles || []) {
    if (rect.material !== 'forest') continue;
    for (let y = rect.row; y < rect.row + rect.height; y++) {
      depth.fill(65535, y * width + rect.column, y * width + rect.column + rect.width);
    }
  }
  /** @type {number[]} */
  const queue = [];
  /** @param {number} cell */
  const neighbors = cell => {
    const x = cell % width, y = Math.floor(cell / width);
    return [x > 0 ? cell - 1 : -1, x + 1 < width ? cell + 1 : -1,
      y > 0 ? cell - width : -1, y + 1 < height ? cell + width : -1];
  };
  for (let cell = 0; cell < depth.length; cell++) {
    if (depth[cell] && neighbors(cell).some(other => other >= 0 && depth[other] === 0)) {
      depth[cell] = 1;
      queue.push(cell);
    }
  }
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const cell = queue[cursor];
    for (const other of neighbors(cell)) {
      if (other >= 0 && depth[other] > depth[cell] + 1) {
        depth[other] = depth[cell] + 1;
        queue.push(other);
      }
    }
  }
  return depth;
}

/** @param {number} depth @returns {number} */
export function forestCanopyFactor(depth) {
  return depth === 1 ? 0.68 : depth === 2 ? 0.86 : 1;
}

// Gradual presentation variation along margins; roots and resource cells stay put.
/**
 * @param {number} depth
 * @param {number} column
 * @param {number} row
 * @param {number} [seed]
 * @returns {number}
 */
export function forestMarginCanopyFactor(depth, column, row, seed = 0) {
  const spacing = 4, x = column / spacing, z = row / spacing;
  const ix = Math.floor(x), iz = Math.floor(z);
  /** @param {number} v */
  const smooth = v => v * v * (3 - 2 * v);
  /** @param {number} a @param {number} b */
  const hash = (a, b) => {
    let n = (Math.imul(a, 73856093) ^ Math.imul(b, 19349663) ^ (seed | 0)) >>> 0;
    n = Math.imul(n ^ (n >>> 16), 0x21f0aaad);
    return ((n ^ (n >>> 15)) >>> 0) / 0xffffffff;
  };
  /** @param {number} a @param {number} b @param {number} t */
  const mix = (a, b, t) => a + (b - a) * t;
  const value = mix(mix(hash(ix, iz), hash(ix + 1, iz), smooth(x - ix)),
    mix(hash(ix, iz + 1), hash(ix + 1, iz + 1), smooth(x - ix)), smooth(z - iz));
  return depth === 1 ? .4 + .45 * value : depth === 2 ? .72 + .23 * value : .94 + .12 * value;
}
