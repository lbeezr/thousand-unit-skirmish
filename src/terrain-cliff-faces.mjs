import * as THREE from 'three';
import { terrainHeightField } from './terrain-height.mjs';
import { TERRAIN_MATERIALS } from './terrain-materials.mjs';
import { regionalGroundColor } from './regional-ground-kits.mjs';
import { applyTerrainTextureSampling } from './terrain-texture-sampling.mjs';

const REPEAT_UNITS = 12;

// The original discontinuity faces, with optional visual attributes. Heights,
// boundaries, triangulation and the separate walkable top mesh stay unchanged.
export function buildTerrainCliffGeometry(definition, base, painted = true) {
  const field = terrainHeightField(definition);
  if (!field.raised) return null;
  const vertices = [], uvs = [], colors = [], distances = [], upperColors = [], lowerColors = [];
  const labels = painted ? new Array(definition.width * definition.height).fill(base) : null;
  if (painted) for (const patch of definition.terrainPatches || []) {
    if (!TERRAIN_MATERIALS.includes(patch.material)) continue;
    for (let row = patch.row; row < patch.row + patch.height; row++) {
      for (let column = patch.column; column < patch.column + patch.width; column++) {
        labels[row * definition.width + column] = patch.material;
      }
    }
  }
  function wall(a, b, c, d, here, there, axis) {
    const hereHigher = a[1] + b[1] >= c[1] + d[1];
    const topColor = painted && new THREE.Color(regionalGroundColor(definition, labels[hereHigher ? here : there]));
    const bottomColor = painted && new THREE.Color(regionalGroundColor(definition, labels[hereHigher ? there : here]));
    const normal = hereHigher ? 1 : -1;
    // The wall winding points toward +X but -Z when here is higher.
    // Use the ground renderer's world-light direction on both orientations.
    const shade = .85 + .2 * (axis === 'x' ? -.6 : -.4) * normal;
    for (const [point, endpoint] of [[a, 0], [b, 1], [c, 1], [a, 0], [c, 1], [d, 0]]) {
      vertices.push(...point);
      if (!painted) continue;
      // One world-unit density on both axes, with no reset at cell boundaries.
      // x+z also gives equal phases at orthogonal-face corners.
      uvs.push((point[0] + point[2] + (definition.width + definition.height) / 2) / REPEAT_UNITS,
        point[1] / REPEAT_UNITS);
      colors.push(shade, shade, shade);
      const h = endpoint === 0 ? [a[1], d[1]] : [b[1], c[1]];
      distances.push(Math.max(...h) - point[1], point[1] - Math.min(...h));
      upperColors.push(...topColor.toArray()); lowerColors.push(...bottomColor.toArray());
    }
  }
  for (let row = 0; row < definition.height; row++) for (let column = 0; column < definition.width; column++) {
    const x = column - definition.width / 2, z = row - definition.height / 2;
    const h = field.corners(column, row), here = row * definition.width + column;
    if (column + 1 < definition.width) {
      const n = field.corners(column + 1, row);
      if (Math.abs(h[1] - n[0]) + Math.abs(h[3] - n[2]) > .001) {
        wall([x + 1, h[1], z], [x + 1, h[3], z + 1], [x + 1, n[2], z + 1], [x + 1, n[0], z], here, here + 1, 'x');
      }
    }
    if (row + 1 < definition.height) {
      const n = field.corners(column, row + 1);
      if (Math.abs(h[2] - n[0]) + Math.abs(h[3] - n[1]) > .001) {
        wall([x, h[2], z + 1], [x + 1, h[3], z + 1], [x + 1, n[1], z + 1], [x, n[0], z + 1], here, here + definition.width, 'z');
      }
    }
  }
  if (!vertices.length) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  if (painted) {
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('cliffEdgeDistances', new THREE.Float32BufferAttribute(distances, 2));
    geometry.setAttribute('cliffUpperColor', new THREE.Float32BufferAttribute(upperColors, 3));
    geometry.setAttribute('cliffLowerColor', new THREE.Float32BufferAttribute(lowerColors, 3));
  }
  geometry.computeVertexNormals();
  return geometry;
}

function applyCliffEdgeColors(material) {
  const sample = material.onBeforeCompile, key = material.customProgramCacheKey;
  material.onBeforeCompile = shader => {
    sample(shader);
    shader.vertexShader = `attribute vec2 cliffEdgeDistances;
attribute vec3 cliffUpperColor;
attribute vec3 cliffLowerColor;
varying vec2 vCliffEdgeDistances;
varying vec3 vCliffUpperColor;
varying vec3 vCliffLowerColor;
` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
vCliffEdgeDistances = cliffEdgeDistances;
vCliffUpperColor = cliffUpperColor;
vCliffLowerColor = cliffLowerColor;`);
    shader.fragmentShader = `varying vec2 vCliffEdgeDistances;
varying vec3 vCliffUpperColor;
varying vec3 vCliffLowerColor;
` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
// Opaque color feathering only: no holes or extra cap/ledge geometry.
float cliffUpperWeight = .35 * (1.0 - smoothstep(0.0, .12, vCliffEdgeDistances.x));
float cliffLowerWeight = .30 * (1.0 - smoothstep(0.0, .16, vCliffEdgeDistances.y));
diffuseColor.rgb = mix(diffuseColor.rgb, vCliffUpperColor * diffuse, cliffUpperWeight);
diffuseColor.rgb = mix(diffuseColor.rgb, vCliffLowerColor * diffuse, cliffLowerWeight);`);
  };
  material.customProgramCacheKey = () => `${key.call(material)}:cliff-edge-colors-v1`;
  return material;
}

export function createTerrainCliffFaces(definition, { base, texture = null, stochastic = true, freeRotation = false }) {
  const geometry = buildTerrainCliffGeometry(definition, base, Boolean(texture));
  if (!geometry) return null;
  const material = texture ? applyCliffEdgeColors(applyTerrainTextureSampling(new THREE.MeshBasicMaterial({
    map: texture, color: 0xd2d4bd, vertexColors: true, side: THREE.DoubleSide,
  }), definition.terrainSeed || 0, stochastic, freeRotation)) : new THREE.MeshStandardMaterial({
    color: new THREE.Color(regionalGroundColor(definition, base)).multiplyScalar(.65),
    roughness: 1, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  // Match the normal base surface's -.025 registration. Paint overlays sit
  // slightly above it; neither their geometry nor the authoritative height moves.
  if (texture) mesh.position.y = -.025;
  mesh.userData.terrainCliffFaces = { painted: Boolean(texture), repeatUnits: REPEAT_UNITS };
  return mesh;
}
