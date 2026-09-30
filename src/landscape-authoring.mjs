// Landscape shapes compile to the existing portable cell/rectangle schema.
// An envelope is a tactical constraint, not the visible shape of a feature.
export function landscapeRectangles(width, height, materialAt) {
  const rectangles = [];
  const active = new Map();
  for (let row = 0; row < height; row++) {
    const next = new Map();
    for (let column = 0; column < width;) {
      const material = materialAt(column + 0.5, row + 0.5);
      const start = column++;
      while (column < width && materialAt(column + 0.5, row + 0.5) === material) column++;
      if (!material) continue;
      const key = `${start}:${column - start}:${material}`;
      let rect = active.get(key);
      if (rect) rect.height++;
      else { rect = { column: start, row, width: column - start, height: 1, material }; rectangles.push(rect); }
      next.set(key, rect);
    }
    active.clear();
    for (const [key, rect] of next) active.set(key, rect);
  }
  return rectangles;
}

function insideFeature(x, y, rect, seed, mapWidth) {
  // Mirrored local coordinates give both seats the same harvestable footprint.
  if (rect.column >= mapWidth / 2) x = rect.column + rect.width - (x - rect.column);
  else if (rect.column + rect.width > mapWidth / 2) x = Math.min(x, mapWidth - x);
  const nx = (x - rect.column - rect.width / 2) / (rect.width / 2);
  const ny = (y - rect.row - rect.height / 2) / (rect.height / 2);
  const phase = (seed % 101) * 0.17 + rect.row * 0.11;
  if (rect.material === 'water' && rect.width <= 4) {
    // Narrow channels wander inside their envelope; crossing gaps stay open.
    const bend = rect.column + rect.width / 2 === mapWidth / 2 ? 0 : Math.sin(y * 0.19 + phase) * 0.28;
    return Math.abs(nx - bend) <= 0.69 + Math.sin(y * 0.43 + phase) * 0.08;
  }
  const angle = Math.atan2(ny, nx);
  const edge = 0.88 + Math.sin(angle * 3 + phase) * 0.09
    + Math.cos(angle * 5 - phase) * 0.05;
  // Lobed radial outlines rather than independent random missing cells.
  return Math.hypot(nx, ny) <= edge;
}

export function shapeRegionalLandscape(definition) {
  const { width, height, terrainSeed = 0 } = definition;
  const inRect = (x, y, rect) => x >= rect.column && x < rect.column + rect.width
    && y >= rect.row && y < rect.row + rect.height;
  const woodland = ['underbough', 'vesperra'].includes(definition.region);
  const fringe = [];
  if (woodland) for (let step = 0; step <= 32; step++) {
    const t = step / 32;
    fringe.push({ x: 12 + t * 20, y: 8 + t * 12 + Math.sin(t * Math.PI) * 2,
      radius: 3.2 + Math.sin(t * Math.PI) * 0.6 });
  }
  const obstacles = landscapeRectangles(width, height, (x, y) => {
    const rect = definition.obstacles.find(rect => inRect(x, y, rect));
    if (rect && insideFeature(x, y, rect, terrainSeed, width)) return rect.material;
    // Join woodland cores with a sweeping tree line, rather than six islands.
    // Keep resource working clearings out of these newly added fringes.
    if (woodland && !definition.resourceNodes.some(node =>
      Math.hypot(x - (node.x + width / 2), y - (node.z + height / 2)) < 3.5)) {
      const mx = Math.min(x, width - x), my = Math.min(y, height - y);
      if (fringe.some(point => Math.hypot(mx - point.x, my - point.y) < point.radius)) return 'forest';
    }
    return null;
  });
  const terrainPatches = landscapeRectangles(width, height, (x, y) => {
    const rect = definition.terrainPatches.find(rect => inRect(x, y, rect));
    if (!rect) return null;
    if (rect.material === 'dirt' && rect.width === width) {
      const mirror = Math.min(x, width - x);
      const center = rect.row + rect.height / 2 + Math.sin(mirror * 0.16) * 1.5;
      const radius = 1.7 + Math.cos(mirror * 0.31) * 0.35;
      return Math.abs(y - center) <= radius ? rect.material : null;
    }
    return insideFeature(x, y, rect, terrainSeed, width) ? rect.material : null;
  });
  return { ...definition, obstacles, terrainPatches };
}
