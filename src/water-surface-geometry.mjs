import * as THREE from 'three';

export const WATER_LEVEL = 0.032;
const SHORE_LIFT = 0.004;
const SHORE_WIDTH = 0.22;

const DEEP_WATER = new THREE.Color(0x304f62);
const OPEN_WATER = new THREE.Color(0x4d7982);
const COOL_SHORE = new THREE.Color(0x82968e);
const SAND_SHORE = new THREE.Color(0xac936d);

function terrainMaterials(definition, cellCount) {
  const cells = new Array(cellCount).fill(definition.terrainBase || 'meadow');
  for (const patch of definition.terrainPatches || []) {
    for (let row = patch.row; row < patch.row + patch.height; row++) {
      for (let column = patch.column; column < patch.column + patch.width; column++) {
        cells[row * definition.width + column] = patch.material;
      }
    }
  }
  return cells;
}

function appendQuad(buffer, points, colors) {
  const first = buffer.positions.length / 3;
  for (let index = 0; index < points.length; index++) {
    buffer.positions.push(...points[index]);
    buffer.colors.push(colors[index].r, colors[index].g, colors[index].b);
  }
  buffer.indices.push(first, first + 3, first + 1, first, first + 2, first + 3);
}

function waterColorAt(x, z) {
  const ripple = 0.5 + 0.5 * Math.sin(x * 1.17 + z * 0.56) * Math.cos(z * 0.93 - x * 0.41);
  return DEEP_WATER.clone().lerp(OPEN_WATER, 0.07 + ripple * 0.1);
}

// Clip only exposed convex corners, entirely inside blocked water cells.
// Neighboring water quads still share full edges, so no cracks are introduced.
function cellOutline(x0, z0, exposed) {
  const x1 = x0 + 1, z1 = z0 + 1, cut = 0.45;
  const tl = exposed.top && exposed.left, tr = exposed.top && exposed.right;
  const bl = exposed.bottom && exposed.left, br = exposed.bottom && exposed.right;
  return [
    [x0 + (tl ? cut : 0), z0], [x1 - (tr ? cut : 0), z0],
    ...(tr ? [[x1, z0 + cut]] : []), [x1, z1 - (br ? cut : 0)],
    ...(br ? [[x1 - cut, z1]] : []), [x0 + (bl ? cut : 0), z1],
    ...(bl ? [[x0, z1 - cut]] : []), [x0, z0 + (tl ? cut : 0)],
  ].filter((point, index, points) => index === 0 || point[0] !== points[index - 1][0] || point[1] !== points[index - 1][1]);
}

function appendWaterPolygon(buffer, outline) {
  const first = buffer.positions.length / 3;
  for (const [x, z] of outline) {
    const color = waterColorAt(x, z);
    buffer.positions.push(x, WATER_LEVEL, z);
    buffer.colors.push(color.r, color.g, color.b);
  }
  for (let i = 1; i < outline.length - 1; i++) buffer.indices.push(first, first + i, first + i + 1);
}

function appendContourShore(buffer, a, b, color) {
  const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
  if (!length) return;
  const nx = -dz / length * SHORE_WIDTH, nz = dx / length * SHORE_WIDTH;
  const y = WATER_LEVEL + SHORE_LIFT;
  appendQuad(buffer, [[a[0], y, a[1]], [b[0], y, b[1]],
    [a[0] + nx, y, a[1] + nz], [b[0] + nx, y, b[1] + nz]],
    [color, color, waterColorAt(a[0] + nx, a[1] + nz), waterColorAt(b[0] + nx, b[1] + nz)]);
}

export function buildWaterSurfaceGeometry(definition) {
  if (!definition || !Number.isInteger(definition.width) || !Number.isInteger(definition.height)
    || definition.width <= 0 || definition.height <= 0) return null;

  const { width, height } = definition;
  const cellCount = width * height;
  const waterCells = new Uint8Array(cellCount);
  for (const obstacle of definition.obstacles || []) {
    if (obstacle?.material !== 'water') continue;
    for (let row = obstacle.row; row < obstacle.row + obstacle.height; row++) {
      for (let column = obstacle.column; column < obstacle.column + obstacle.width; column++) {
        if (column >= 0 && column < width && row >= 0 && row < height) {
          waterCells[row * width + column] = 1;
        }
      }
    }
  }

  let waterCellCount = 0;
  for (const isWater of waterCells) waterCellCount += isWater;
  if (waterCellCount === 0) return null;

  const halfX = width / 2;
  const halfZ = height / 2;
  const landMaterials = terrainMaterials(definition, cellCount);
  const buffer = { positions: [], colors: [], indices: [] };
  let shorelineEdgeCount = 0;
  let sandyShorelineEdgeCount = 0;
  const edges = [
    { name: 'left', column: -1, row: 0 },
    { name: 'right', column: 1, row: 0 },
    { name: 'top', column: 0, row: -1 },
    { name: 'bottom', column: 0, row: 1 },
  ];

  for (let row = 0; row < height; row++) {
    for (let column = 0; column < width; column++) {
      const index = row * width + column;
      if (!waterCells[index]) continue;
      const x0 = column - halfX;
      const x1 = x0 + 1;
      const z0 = row - halfZ;
      const z1 = z0 + 1;
      const exposed = {};
      const shoreColors = {};
      for (let edgeIndex = 0; edgeIndex < edges.length; edgeIndex++) {
        const edge = edges[edgeIndex];
        const neighborColumn = column + edge.column;
        const neighborRow = row + edge.row;
        if (neighborColumn < 0 || neighborColumn >= width || neighborRow < 0 || neighborRow >= height) continue;
        const neighborIndex = neighborRow * width + neighborColumn;
        if (waterCells[neighborIndex]) continue;
        exposed[edge.name] = true;
        shorelineEdgeCount++;
        const isSand = landMaterials[neighborIndex] === 'sand';
        if (isSand) sandyShorelineEdgeCount++;
        shoreColors[edge.name] = isSand ? SAND_SHORE : COOL_SHORE;
      }
      const outline = cellOutline(x0, z0, exposed);
      // The last point can duplicate the first on an unclipped upper-left.
      if (outline.at(-1)[0] === outline[0][0] && outline.at(-1)[1] === outline[0][1]) outline.pop();
      appendWaterPolygon(buffer, outline);
      for (let i = 0; i < outline.length; i++) {
        const a = outline[i], b = outline[(i + 1) % outline.length];
        const edge = a[0] === x0 && b[0] === x0 ? 'left'
          : a[0] === x1 && b[0] === x1 ? 'right'
          : a[1] === z0 && b[1] === z0 ? 'top'
          : a[1] === z1 && b[1] === z1 ? 'bottom' : null;
        if (edge && !exposed[edge]) continue;
        appendContourShore(buffer, a, b, shoreColors[edge] || COOL_SHORE);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(buffer.positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(buffer.colors, 3));
  geometry.setIndex(buffer.indices);
  geometry.computeVertexNormals();
  geometry.userData.waterCellCount = waterCellCount;
  geometry.userData.shorelineEdgeCount = shorelineEdgeCount;
  geometry.userData.sandyShorelineEdgeCount = sandyShorelineEdgeCount;
  return geometry;
}
