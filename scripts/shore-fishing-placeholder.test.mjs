import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createShoreFishPlaceholder, updateShoreFishPlaceholder } from '../src/shore-fishing-placeholder.mjs';

test('temporary marker uses existing ring visibility and finite stock stage cues without external art', () => {
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.66, 24), new THREE.MeshBasicMaterial());
  const marker = createShoreFishPlaceholder();
  ring.add(marker);
  assert.equal(marker.parent, ring);
  assert.equal(marker.userData.placeholderArt, true);
  assert.equal(marker.material.map, null, 'no asset download or finished-art assertion');
  assert.ok(marker.geometry.attributes.position.count > 0);
  updateShoreFishPlaceholder(marker, 'full');
  assert.equal(marker.scale.x, 1);
  updateShoreFishPlaceholder(marker, 'low');
  assert.ok(marker.scale.x < 1 && marker.scale.x > 0);
  updateShoreFishPlaceholder(marker, 'depleted');
  assert.equal(marker.material.color.getHex(), 0x77806b);
  assert.equal(marker.scale.x, 0.22);
  updateShoreFishPlaceholder(marker, 'full');
  assert.equal(marker.scale.x, 1, 'rematch restores presentation');
  assert.equal(marker.material.color.getHex(), 0x82d6df);
  marker.geometry.dispose(); marker.material.dispose(); ring.geometry.dispose(); ring.material.dispose();
});
