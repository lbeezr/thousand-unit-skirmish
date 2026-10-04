import * as THREE from 'three';
import { constructionGroundStage } from './building-visual-state.mjs';
import { isPalisade } from './palisade-gate.mjs';

const SIDES = [['west', -1, 0, 'east'], ['east', 1, 0, 'west'],
  ['north', 0, -1, 'south'], ['south', 0, 1, 'north']];
const CORNERS = [[0, 0], [1, 0], [1, 1], [0, 1]];
const key = row => `${row.team}:${row.x}:${row.z}`;

// Consume only disclosed real sites. A completed/open gate is not a ground
// bridge, and adjacency alone cannot invent a server wall connection.
export function planPalisadeConstructionGround(buildings, sampleHeight) {
  const cells = buildings.filter(row => isPalisade(row.type)
    && [0, 1].includes(row.team) && Number.isFinite(row.x) && Number.isFinite(row.z)
    && constructionGroundStage(row.progress, row.complete) !== 'clear')
    .map(row => ({ ...row, stage: constructionGroundStage(row.progress, row.complete),
      y: sampleHeight(row.x, row.z), heights: CORNERS.map(([u, v]) =>
        sampleHeight(row.x + (u ? .5 - 1e-6 : -.5 + 1e-6), row.z + (v ? .5 - 1e-6 : -.5 + 1e-6))) }))
    .sort((a, b) => a.z - b.z || a.x - b.x || a.team - b.team || a.id - b.id);
  // Even malformed duplicate disclosed rows must not double-blend one cell.
  const owned = new Map();
  for (const cell of cells) if (!owned.has(key(cell))) owned.set(key(cell), cell);
  const stages = { earthwork: [], foundation: [] };
  for (const cell of owned.values()) {
    cell.edges = SIDES.map(([side, dx, dz, opposite]) => {
      const neighbour = owned.get(key({ team: cell.team, x: cell.x + dx, z: cell.z + dz }));
      return neighbour && Math.abs(neighbour.y - cell.y) < 1e-5
        && cell.connections?.includes(side) && neighbour.connections?.includes(opposite) ? 0 : 1;
    });
    stages[cell.stage].push(cell);
  }
  return Object.fromEntries(Object.entries(stages).map(([stage, rows]) => [stage, { cells: rows,
    signature: rows.map(row => `${row.id}:${row.team}:${row.x}:${row.z}:${row.heights.join(',')}:${row.edges.join('')}`).join('|') }]));
}

export function createPalisadeConstructionGroundMesh(material, capacity) {
  if (!Number.isInteger(capacity) || capacity <= 0) throw new RangeError('Ground capacity must be positive');
  const geometry = new THREE.BufferGeometry();
  for (const [name, size] of [['position', 3], ['uv', 2], ['groundEdges', 4]]) {
    geometry.setAttribute(name, new THREE.BufferAttribute(new Float32Array(capacity * 4 * size), size)
      .setUsage(THREE.DynamicDrawUsage));
  }
  const indices = [];
  for (let index = 0; index < capacity; index++) {
    const v = index * 4; indices.push(v, v + 2, v + 1, v, v + 3, v + 2);
  }
  geometry.setIndex(indices); geometry.setDrawRange(0, 0);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.visible = false; mesh.frustumCulled = false; mesh.renderOrder = -0.5;
  mesh.raycast = () => {}; // The authoritative buildings retain their picking.
  mesh.userData.palisadeGround = { capacity, signature: null, count: 0 };
  material.onBeforeCompile = shader => {
    const varyings = 'varying vec2 vGroundCell; varying vec2 vGroundWorld; varying vec4 vGroundEdges;\n';
    shader.vertexShader = 'attribute vec4 groundEdges;\n' + varyings + shader.vertexShader.replace(
      '#include <begin_vertex>', '#include <begin_vertex>\nvGroundCell = uv; vGroundWorld = position.xz; vGroundEdges = groundEdges;');
    // Mirror a shared soil-core sample in world coordinates. Grass/stone curb
    // borders of the original square must not repeat at internal wall joints.
    shader.fragmentShader = varyings + shader.fragmentShader.replace('#include <map_fragment>',
      THREE.ShaderChunk.map_fragment.replace('texture2D( map, vMapUv )',
        'texture2D( map, 0.3 + 0.4 * abs(fract(vGroundWorld * 0.5) * 2.0 - 1.0) )') + `
      vec4 edgeDistance = vec4(vGroundCell.x, 1.0-vGroundCell.x, vGroundCell.y, 1.0-vGroundCell.y);
      edgeDistance = mix(vec4(1.0), edgeDistance, vGroundEdges);
      float boundary = min(min(edgeDistance.x, edgeDistance.y), min(edgeDistance.z, edgeDistance.w));
      diffuseColor.a *= smoothstep(0.0, 0.12, boundary);`);
  };
  material.customProgramCacheKey = () => 'connected-palisade-ground-v1';
  return mesh;
}

export function updatePalisadeConstructionGroundMesh(mesh, plan) {
  const state = mesh.userData.palisadeGround;
  if (plan.cells.length > state.capacity) return false;
  if (plan.signature === state.signature) return true;
  const { position, uv, groundEdges } = mesh.geometry.attributes;
  plan.cells.forEach((cell, index) => CORNERS.forEach(([u, v], corner) => {
    const vertex = index * 4 + corner;
    position.setXYZ(vertex, cell.x + u - .5, cell.heights[corner] + .002, cell.z + v - .5);
    uv.setXY(vertex, u, v); groundEdges.setXYZW(vertex, ...cell.edges);
  }));
  for (const attribute of [position, uv, groundEdges]) attribute.needsUpdate = true;
  mesh.geometry.setDrawRange(0, plan.cells.length * 6);
  mesh.visible = plan.cells.length > 0;
  state.count = plan.cells.length; state.signature = plan.signature;
  return true;
}
