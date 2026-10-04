import * as THREE from 'three';

// Bounded two-endpoint line: at most 256 + 256 - 1 cells, five pieces each.
export function createWallPlacementGhost() {
  const group = new THREE.Group(); group.visible = false;
  const material = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.65, depthWrite: false });
  const tiles = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.96, 0.96), material, 511);
  const timber = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, 2555);
  for (const mesh of [tiles, timber]) { mesh.frustumCulled = false; mesh.renderOrder = 5; mesh.count = 0; group.add(mesh); }
  const transform = new THREE.Object3D();
  const offsets = { north: [0, -1], east: [1, 0], south: [0, 1], west: [-1, 0] };
  return { group, tiles, timber,
    update(preview, { valid, halfX, halfZ, groundHeight }) {
      group.visible = Boolean(preview); tiles.count = 0; timber.count = 0;
      if (!preview) return;
      for (const piece of preview.pieces) {
        const x = piece.column - halfX + 0.5, z = piece.row - halfZ + 0.5, y = groundHeight(x, z);
        const color = new THREE.Color(valid ? piece.existing ? 0x76bcd2 : 0x9cdb8a : 0xe7836d);
        transform.position.set(x, y + 0.06, z); transform.rotation.set(-Math.PI / 2, 0, 0); transform.scale.set(1, 1, 1); transform.updateMatrix();
        tiles.setMatrixAt(tiles.count, transform.matrix); tiles.setColorAt(tiles.count++, color);
        transform.rotation.set(0, 0, 0);
        const box = (dx, dz, sx, sy, sz, cy) => {
          transform.position.set(x + dx, y + cy, z + dz); transform.scale.set(sx, sy, sz); transform.updateMatrix();
          timber.setMatrixAt(timber.count, transform.matrix); timber.setColorAt(timber.count++, color);
        };
        box(0, 0, 0.22, 1.4, 0.22, 0.7);
        for (const direction of piece.connections) {
          const [dx, dz] = offsets[direction]; box(dx * 0.25, dz * 0.25, dx ? 0.5 : 0.12, 0.65, dz ? 0.5 : 0.12, 0.65);
        }
      }
      for (const mesh of [tiles, timber]) { mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; }
    },
  };
}
