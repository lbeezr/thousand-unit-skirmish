import { shoreFishSitePositions } from './shore-fishing-placement.mjs';
import { headingToTarget } from './unit-heading.mjs';
import { WATER_LEVEL } from './water-surface-geometry.mjs';

const sitesByMap = new WeakMap();
export function fishingVisualSites(map) {
  if (!map) return [];
  if (!sitesByMap.has(map)) sitesByMap.set(map, shoreFishSitePositions(map));
  return sitesByMap.get(map);
}

// Resolve the cosmetic target from the current authoritative position/bearing.
// Ambiguity or stale identity fails closed; this is never a gather/reach rule.
export function fishingWaterContact(unit, map) {
  if (unit.kind !== 'worker' || unit.hp <= 0 || unit.workResourceVariant !== 'shore-fish'
    || ![unit.serverX, unit.serverZ, unit.workHeading].every(Number.isFinite)) return null;
  const matches = fishingVisualSites(map).filter(site => {
    const heading = headingToTarget(unit.serverX, unit.serverZ, site.water.x, site.water.z);
    return heading !== null && Math.hypot(site.water.x - unit.serverX, site.water.z - unit.serverZ) <= 2.5
      && Math.abs(Math.atan2(Math.sin(heading - unit.workHeading), Math.cos(heading - unit.workHeading))) < 1e-6;
  });
  return matches.length === 1 ? matches[0].water : null;
}

// The approved reach key's outer net rim, measured on its fixed 512px canvas.
// Extend a neutral rope/net contact to the real water cell only during reach.
// The actor's pixels, root, scale, animation clock and simulation stay intact.
export const FISHING_REACH_CONTACT_PX = Object.freeze({ x: 388, y: 475 });
export function createWorkerFishingContactRuntime({ THREE, scene, capacity, getMap }) {
  const geometry = new THREE.CylinderGeometry(0.012, 0.012, 1, 5);
  const rimGeometry = new THREE.RingGeometry(0.07, 0.085, 12);
  const material = new THREE.MeshBasicMaterial({ color: 0xb9935e, side: THREE.DoubleSide,
    transparent: true, opacity: 0.85, depthWrite: false });
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const dummy = new THREE.Object3D(), start = new THREE.Vector3(), end = new THREE.Vector3();
  const direction = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const active = [new Set(), new Set()];
  let visible = false;
  const batches = [0, 1].map(() => {
    const meshes = [geometry, rimGeometry].map(g => {
      const mesh = new THREE.InstancedMesh(g, material, capacity);
      mesh.count = 0; mesh.visible = false; mesh.frustumCulled = false;
      mesh.renderOrder = 1.11;
      for (let slot = 0; slot < capacity; slot++) mesh.setMatrixAt(slot, zero);
      scene.add(mesh); return mesh;
    });
    return meshes;
  });
  function refresh(team) {
    for (const mesh of batches[team]) mesh.visible = visible && active[team].size > 0;
  }
  function hide(unit) {
    if (!active[unit.team]?.delete(unit.slot)) return;
    for (const mesh of batches[unit.team]) mesh.setMatrixAt(unit.slot, zero);
    refresh(unit.team);
  }
  return {
    setCount(team, count) {
      for (const mesh of batches[team]) mesh.count = count;
      for (const slot of active[team]) if (slot >= count) hide({ team, slot });
    },
    setVisible(next) { visible = Boolean(next); refresh(0); refresh(1); },
    markTeamDirty(team) { for (const mesh of batches[team]) mesh.instanceMatrix.needsUpdate = true; },
    hide,
    update(unit, { role, state, frame, crop, matrix }) {
      if (role !== 'human' || state !== 'gather-fish' || frame.id !== 'gather-fish-south-east-1') return;
      const water = fishingWaterContact(unit, getMap());
      if (!water) return;
      const rect = crop.rectPx, offset = crop.offsetPx || { x: 0, y: 0 };
      start.set((FISHING_REACH_CONTACT_PX.x - offset.x) / rect.width - 0.5,
        0.5 - (FISHING_REACH_CONTACT_PX.y - offset.y) / rect.height, 0).applyMatrix4(matrix);
      end.set(water.x, WATER_LEVEL + 0.012, water.z);
      direction.subVectors(end, start);
      const distance = direction.length();
      if (!Number.isFinite(distance) || distance < 0.02 || distance > 2.5) return;
      dummy.position.copy(start).add(end).multiplyScalar(0.5);
      dummy.quaternion.setFromUnitVectors(up, direction.normalize());
      dummy.scale.set(1, distance, 1); dummy.updateMatrix();
      batches[unit.team][0].setMatrixAt(unit.slot, dummy.matrix);
      dummy.position.copy(end); dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.set(1, 1, 1); dummy.updateMatrix();
      batches[unit.team][1].setMatrixAt(unit.slot, dummy.matrix);
      active[unit.team].add(unit.slot); refresh(unit.team);
    },
  };
}
