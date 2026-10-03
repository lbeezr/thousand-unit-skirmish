import * as THREE from 'three';
import { waterContours, roundedWaterContour } from './water-contours.mjs';
import { terrainHeightField } from './terrain-height.mjs';

export const SHORE_BANK_WIDTH = 0.60;
export const SHORE_BANK_OPACITY = 0.14;
export const SHORE_BANK_QUAD_LIMIT = 4096;
const LIFT = 0.008;

// A static land-side value cue, using the same conservative outline as water.
// It consumes no resource state, changes no ground height and owns no texture.
export function createShoreBankShade(definition) {
  if (!Number.isInteger(definition?.width) || !Number.isInteger(definition?.height)
    || definition.width < 1 || definition.height < 1
    || definition.width > 512 || definition.height > 512) return null;
  const { width, height } = definition;
  const field = terrainHeightField(definition);
  const positions = [], colors = [], indices = [];
  let quads = 0;
  const low = point => field.sample(point[0] - width / 2, point[1] - height / 2) < 0.001;
  const midpoint = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  for (const edges of waterContours(definition)) {
    const ring = roundedWaterContour(edges);
    const normals = ring.map((a, i) => {
      const b = ring[(i + 1) % ring.length];
      const dx = b.point[0] - a.point[0], dz = b.point[1] - a.point[1];
      const length = Math.hypot(dx, dz);
      return length > 0 ? [dz / length, -dx / length] : [0, 0];
    });
    const outer = ring.map((vertex, i) => {
      const previous = (i + ring.length - 1) % ring.length;
      const a = ring[previous].edge.shore ? normals[previous] : normals[i];
      const b = vertex.edge.shore ? normals[i] : a;
      const length = Math.hypot(a[0] + b[0], a[1] + b[1]);
      const n = length > 0 ? [(a[0] + b[0]) / length, (a[1] + b[1]) / length] : b;
      const extension = Math.min(SHORE_BANK_WIDTH * 1.8,
        SHORE_BANK_WIDTH / Math.max(0.1, n[0] * b[0] + n[1] * b[1]));
      return [Math.max(0, Math.min(width, vertex.point[0] + n[0] * extension)),
        Math.max(0, Math.min(height, vertex.point[1] + n[1] * extension))];
    });
    for (let i = 0; i < ring.length; i++) {
      if (!ring[i].edge.shore) continue; // No bank at the map boundary.
      const next = (i + 1) % ring.length;
      const a = ring[i].point, b = ring[next].point, c = outer[i], d = outer[next];
      if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-7) continue;
      // Raised banks need a separate cliff treatment; do not bridge their walls.
      if (![a, b, c, d, midpoint(a, b), midpoint(c, d)].every(low)) continue;
      if (++quads > SHORE_BANK_QUAD_LIMIT) return null;
      const first = positions.length / 3;
      for (const [point, alpha] of [[a, 1], [b, 1], [c, 0], [d, 0]]) {
        positions.push(point[0] - width / 2, LIFT, point[1] - height / 2);
        colors.push(1, 1, 1, alpha);
      }
      indices.push(first, first + 2, first + 1, first + 1, first + 2, first + 3);
    }
  }
  if (!quads) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
  geometry.setIndex(indices);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
    color: 0x27362d, vertexColors: true, opacity: SHORE_BANK_OPACITY,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    forceSinglePass: true, // Flat strips need no separate transparent back-face draw.
    toneMapped: false, fog: true,
  }));
  mesh.raycast = () => {};
  mesh.userData.shoreBankShade = { quads, width: SHORE_BANK_WIDTH, opacity: SHORE_BANK_OPACITY };
  return mesh;
}
