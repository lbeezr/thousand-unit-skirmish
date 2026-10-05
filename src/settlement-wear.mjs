import * as THREE from 'three';
import { buildingEntranceDirection, ROTATABLE_BUILDINGS } from './building-orientation.mjs';
import { terrainHeightField } from './terrain-height.mjs';

const NEAR = 9;
const RADIUS = 4;
const LIMIT = 128;
const smooth = value => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };

// Snapshot-driven cosmetic cache. No simulation state, traffic history or route
// inference: only live owned Complete structures contribute soft threshold wear.
export function createSettlementWearCache(definition, definitions) {
  const { width, height } = definition;
  const field = terrainHeightField(definition);
  const blocked = new Uint8Array(width * height);
  for (const rect of definition.obstacles || []) {
    for (let row = rect.row; row < rect.row + rect.height; row++) {
      for (let column = rect.column; column < rect.column + rect.width; column++) {
        if (column >= 0 && row >= 0 && column < width && row < height) blocked[row * width + column] = 1;
      }
    }
  }
  let signature = null, plan = null;
  let rebuilds = 0;
  return {
    get rebuilds() { return rebuilds; },
    update(buildings, team) {
      const rows = [...buildings].sort((a, b) => a.id - b.id);
      const next = JSON.stringify([team, rows.map(b => [b.id, b.type, b.team, b.x, b.z,
        b.orientation ?? 0, b.complete === true, b.footprint ?? null])]);
      if (next === signature) return plan;
      signature = next; rebuilds++;
      // Fail closed outside the game's existing building budget.
      if (rows.length > LIMIT) return plan = { cells: [], lobes: [], vertices: [], colors: [], uvs: [], indices: [] };
      const occupied = new Set();
      for (const b of rows) {
        if (Array.isArray(b.footprint)) { for (const cell of b.footprint) occupied.add(cell); continue; }
        const size = definitions[b.type]?.footprint;
        if (!size) continue;
        const c = Math.floor(b.x + width / 2) - Math.floor(size / 2);
        const r = Math.floor(b.z + height / 2) - Math.floor(size / 2);
        for (let y = r; y < r + size; y++) for (let x = c; x < c + size; x++) {
          if (x >= 0 && y >= 0 && x < width && y < height) occupied.add(y * width + x);
        }
      }
      const candidates = rows.filter(b => b.team === team && b.complete === true
        && ROTATABLE_BUILDINGS.includes(b.type) && definitions[b.type]?.footprint % 2 === 1
        && Number.isFinite(b.x) && Number.isFinite(b.z)
        && Number.isInteger(b.orientation ?? 0) && (b.orientation ?? 0) >= 0 && (b.orientation ?? 0) < 4);
      const buckets = new Map();
      const bucketKey = (x, z) => `${Math.floor(x / NEAR)}:${Math.floor(z / NEAR)}`;
      for (const b of candidates) {
        const key = bucketKey(b.x, b.z);
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(b);
      }
      const lobes = [];
      for (const b of candidates) {
        const column = Math.floor(b.x + width / 2), row = Math.floor(b.z + height / 2);
        if (column < 0 || row < 0 || column >= width || row >= height) continue;
        const level = field.levels[row * width + column];
        let neighbours = 0;
        for (let dz = -1; dz <= 1 && neighbours < 2; dz++) for (let dx = -1; dx <= 1 && neighbours < 2; dx++) {
          for (const other of buckets.get(bucketKey(b.x + dx * NEAR, b.z + dz * NEAR)) || []) {
            const cell = Math.floor(other.z + height / 2) * width + Math.floor(other.x + width / 2);
            if (other !== b && field.levels[cell] === level && (other.x - b.x) ** 2 + (other.z - b.z) ** 2 <= NEAR ** 2) neighbours++;
            if (neighbours >= 2) break;
          }
        }
        if (neighbours < 2) continue;
        const [dx, dz] = buildingEntranceDirection(b.orientation);
        const front = definitions[b.type].footprint / 2 + .6;
        // Phase depends on seed/site, never input order, HP, time or object identity.
        const phase = ((definition.terrainSeed || 0) * .013 + b.x * 1.73 + b.z * 2.31) % (Math.PI * 2);
        lobes.push({ id: b.id, x: b.x + dx * front, z: b.z + dz * front, dx, dz, phase, level });
      }
      const cells = new Map();
      for (const lobe of lobes) {
        for (let row = Math.floor(lobe.z + height / 2 - RADIUS); row <= Math.floor(lobe.z + height / 2 + RADIUS); row++) {
          for (let column = Math.floor(lobe.x + width / 2 - RADIUS); column <= Math.floor(lobe.x + width / 2 + RADIUS); column++) {
            if (row < 0 || column < 0 || row >= height || column >= width) continue;
            const cell = row * width + column;
            if (blocked[cell] || occupied.has(cell) || field.levels[cell] !== lobe.level) continue;
            if (!cells.has(cell)) cells.set(cell, []);
            cells.get(cell).push(lobe);
          }
        }
      }
      const result = { cells: [], lobes, vertices: [], colors: [], uvs: [], indices: [] };
      function alpha(x, z, local, level) {
        let remaining = 1;
        for (const lobe of local) {
          const vx = x - lobe.x, vz = z - lobe.z;
          const side = (vx * lobe.dz - vz * lobe.dx) / 3.4;
          const front = (vx * lobe.dx + vz * lobe.dz) / 2.9;
          const ripple = 1 + .08 * Math.sin(x * 1.6 + lobe.phase) * Math.sin(z * 1.3 - lobe.phase);
          remaining *= 1 - .55 * smooth((1 - Math.hypot(side, front) * ripple) / .65);
        }
        // Fade before every excluded cell; no paint triangle crosses water,
        // a cliff, map edge, live building footprint or an authored blocker.
        const gx = x + width / 2, gz = z + height / 2;
        let clearance = 1;
        for (let row = Math.floor(gz) - 1; row <= Math.floor(gz) + 1; row++) {
          for (let column = Math.floor(gx) - 1; column <= Math.floor(gx) + 1; column++) {
            const cell = row * width + column;
            if (row >= 0 && column >= 0 && row < height && column < width
              && !blocked[cell] && !occupied.has(cell) && field.levels[cell] === level) continue;
            const distance = Math.hypot(Math.max(column - gx, 0, gx - column - 1),
              Math.max(row - gz, 0, gz - row - 1));
            clearance = Math.min(clearance, smooth(distance / .65));
          }
        }
        return Math.min(.7, 1 - remaining) * clearance;
      }
      for (const [cell, local] of [...cells].sort((a, b) => a[0] - b[0])) {
        const x0 = cell % width - width / 2, z0 = Math.floor(cell / width) - height / 2;
        let emitted = false;
        for (let v = 0; v < 2; v++) for (let u = 0; u < 2; u++) {
          const points = [[u, v], [u + 1, v], [u, v + 1], [u + 1, v + 1]]
            .map(([x, z]) => [x0 + x / 2, z0 + z / 2]);
          const alphas = points.map(([x, z]) => alpha(x, z, local, field.levels[cell]));
          if (!alphas.some(a => a > .001)) continue;
          const first = result.vertices.length / 3;
          points.forEach(([x, z], i) => {
            result.vertices.push(x, field.sample(x, z) + .001, z);
            result.uvs.push((x + width / 2) / 12, (z + height / 2) / 12);
            result.colors.push(1, 1, 1, alphas[i]);
          });
          result.indices.push(first, first + 3, first + 1, first, first + 2, first + 3);
          emitted = true;
        }
        if (emitted) result.cells.push(cell);
      }
      return plan = result;
    },
  };
}

export function createSettlementWearMesh(material) {
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
  mesh.visible = false; mesh.renderOrder = -.75; mesh.raycast = () => {};
  return mesh;
}

export function updateSettlementWearMesh(mesh, plan) {
  if (mesh.userData.settlementWearPlan === plan) return false;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(plan.vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(plan.uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(plan.colors, 4));
  geometry.setIndex(plan.indices);
  geometry.computeVertexNormals();
  const normals = geometry.attributes.normal, colors = geometry.attributes.color;
  for (let i = 0; i < normals.count; i++) {
    const shade = THREE.MathUtils.clamp(.85 + .15 * normals.getY(i)
      + .2 * (-.6 * normals.getX(i) + .4 * normals.getZ(i)), .68, 1.15);
    colors.setXYZ(i, shade, shade, shade);
  }
  mesh.geometry.dispose(); mesh.geometry = geometry;
  mesh.visible = plan.indices.length > 0;
  mesh.userData.settlementWearPlan = plan;
  return true;
}
