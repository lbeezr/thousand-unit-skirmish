import * as THREE from 'three';
import { frontierBuildingManifestUrl } from './frontier-building-preview.mjs';
import { createCapturedBuildingSprite, updateCapturedBuildingSprite, disposeCapturedBuildingSprite } from './captured-building-art.mjs';
import { buildingEntranceDirection } from './building-orientation.mjs';

// A renderer-only final-state image. No gameplay factory, socket or debit exists
// in this module. Keep the calibrated art unscaled and tint only the site cells.
export function createBuildingPlacementPreview() {
  const group = new THREE.Group();
  const footprint = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ color: 0x9cdb8a, transparent: true, opacity: 0.3, depthWrite: false }));
  footprint.rotation.x = -Math.PI / 2; footprint.position.y = 0.025;
  const outline = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-0.5, 0.04, -0.5), new THREE.Vector3(0.5, 0.04, -0.5),
    new THREE.Vector3(0.5, 0.04, 0.5), new THREE.Vector3(-0.5, 0.04, 0.5),
  ]), new THREE.LineBasicMaterial({ color: 0x9cdb8a, depthWrite: false }));
  const entrance = new THREE.Mesh(new THREE.CircleGeometry(0.18, 16),
    new THREE.MeshBasicMaterial({ color: 0x9cdb8a, depthWrite: false }));
  entrance.rotation.x = -Math.PI / 2; entrance.position.y = 0.045;
  group.add(footprint, outline, entrance); group.visible = false;
  let sprite = null, currentManifest = null;
  const reset = () => {
    if (sprite) { disposeCapturedBuildingSprite(sprite); sprite.removeFromParent(); }
    sprite = null; currentManifest = null; group.visible = false;
  };
  return { group, footprint, outline, entrance, get sprite() { return sprite; }, reset,
    update({ type, size, orientation, teamColor, camera, placement, height, mode = null }) {
      const manifest = frontierBuildingManifestUrl(type, mode);
      if (manifest !== currentManifest) {
        reset(); currentManifest = manifest;
        if (manifest) {
          sprite = createCapturedBuildingSprite({ manifestUrl: manifest, teamColor, preview: true });
          group.add(sprite);
        }
      }
      group.visible = Boolean(placement);
      if (!placement) return;
      group.position.set(placement.x, height, placement.z);
      footprint.scale.set(size, size, 1); outline.scale.set(size, 1, size);
      const color = placement.valid ? 0x9cdb8a : 0xe7836d;
      for (const object of [footprint, outline, entrance]) object.material.color.setHex(color);
      entrance.visible = Boolean(manifest);
      const [dx, dz] = buildingEntranceDirection(orientation);
      entrance.position.set(dx * (size / 2 + 0.25), 0.045, dz * (size / 2 + 0.25));
      if (sprite) updateCapturedBuildingSprite(sprite, camera, { state: 'complete', orientation });
    }, dispose() { reset(); for (const object of [footprint, outline, entrance]) { object.geometry.dispose(); object.material.dispose(); } },
  };
}
