// Distance to the actual woodland margin, independent of rectangle compression.
// Presentation only: every forest cell keeps its harvest identity and stock.
export function forestHabitatDepth(definition) {
  const { width, height } = definition;
  const depth = new Uint16Array(width * height);
  for (const rect of definition.obstacles || []) {
    if (rect.material !== 'forest') continue;
    for (let y = rect.row; y < rect.row + rect.height; y++) {
      depth.fill(65535, y * width + rect.column, y * width + rect.column + rect.width);
    }
  }
  const queue = [];
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

export function forestCanopyFactor(depth) {
  return depth === 1 ? 0.68 : depth === 2 ? 0.86 : 1;
}
