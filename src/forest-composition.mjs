// Presentation-only species groups. Harvest cells, roots and stock stay owned
// by the map and resource simulation.
const random = value => {
  const n = Math.sin(value * 127.1 + 17.7) * 43758.5453;
  return n - Math.floor(n);
};
const family = value => value < .45 ? 'underbough-root-oak'
  : value < .75 ? 'underbough-moss-hornbeam'
    : value < .9 ? 'underbough-old-plum' : 'underbough-copperleaf';

export function underboughForestSpecies(column, row, seed = 0, habitatDepth = 1, spacing = 10) {
  if (!Number.isFinite(spacing) || spacing < 2) throw new RangeError('Grove spacing must be at least two cells');
  const cellKey = column * 71 + row * 137 + seed * .17;
  // Young woody scrub belongs mostly at the margin and around internal glades.
  if (random(cellKey + 97) < (habitatDepth <= 1 ? .12 : .04)) return 'underbough-bramble';
  const gx = Math.floor(column / spacing), gz = Math.floor(row / spacing);
  let nearest = Infinity, groveKey = 0;
  for (let z = gz - 1; z <= gz + 1; z++) for (let x = gx - 1; x <= gx + 1; x++) {
    const key = x * 313 + z * 571 + seed * .13;
    const cx = (x + .5 + (random(key + 11) - .5) * .6) * spacing;
    const cz = (z + .5 + (random(key + 29) - .5) * .6) * spacing;
    const distance = (column - cx) ** 2 + (row - cz) ** 2;
    if (distance < nearest) { nearest = distance; groveKey = key; }
  }
  // Most trees share the nearest grove's dominant form; a small admixture
  // softens transitions without spreading bright copper crowns everywhere.
  return family(random(random(cellKey + 43) < .16 ? cellKey + 59 : groveKey + 83));
}
