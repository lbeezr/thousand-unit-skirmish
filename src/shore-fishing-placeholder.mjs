import * as THREE from 'three';
import { resourceVisualScale } from './resource-visual-state.mjs';

// Temporary flat bank marker. This primitive symbol is not the fish artist's
// finished asset or an animation; attach to the existing resource ring so it
// inherits the ring's land position and fog visibility.
export function createShoreFishPlaceholder() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.26, 0);
  shape.lineTo(-0.48, 0.2);
  shape.lineTo(-0.48, -0.2);
  shape.lineTo(-0.26, 0);
  shape.quadraticCurveTo(0.08, -0.35, 0.46, 0);
  shape.quadraticCurveTo(0.08, 0.35, -0.26, 0);
  const marker = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({
    color: 0x82d6df, side: THREE.DoubleSide, depthWrite: false,
  }));
  marker.position.z = 0.015;
  marker.userData.placeholderArt = true;
  return marker;
}

export function updateShoreFishPlaceholder(marker, stage) {
  marker.scale.setScalar(resourceVisualScale(stage));
  marker.material.color.setHex(stage === 'depleted' ? 0x77806b : 0x82d6df);
}
