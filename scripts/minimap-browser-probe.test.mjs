import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { installMinimapCameraProbe } from './minimap-browser-probe.mjs';

test('camera observation works on an existing raycaster when every viewport corner misses finite terrain', t => {
  const terrain = new THREE.Mesh(new THREE.PlaneGeometry(160, 96), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  terrain.rotation.x = -Math.PI / 2; terrain.updateMatrixWorld();
  t.after(() => { terrain.geometry.dispose(); terrain.material.dispose(); });
  const camera = new THREE.OrthographicCamera(-200, 200, 120, -120, 0.1, 500);
  camera.position.set(80, 150, 80); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const raycaster = new THREE.Raycaster(), capture = {};
  const dispose = installMinimapCameraProbe(THREE, capture); t.after(dispose);
  for (const corner of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    raycaster.setFromCamera(new THREE.Vector2(...corner), camera);
    assert.equal(raycaster.intersectObject(terrain, false).length, 0, 'no complete minimap outline can be drawn');
  }
  assert.equal(capture.cameraSamples, 4);
  assert.deepEqual(capture.camera.position, [80, 150, 80]);
  assert.equal(capture.camera.zoom, 1);
  assert.deepEqual(capture.camera.frustum, [-200, 200, 120, -120]);
  const before = structuredClone(capture.camera);
  camera.position.x += 10; camera.updateMatrixWorld();
  raycaster.setFromCamera(new THREE.Vector2(1, 1), camera);
  assert.notDeepEqual(capture.camera, before, 'pan is observable even when the outline remains absent');
  assert.deepEqual(before.position, [80, 150, 80], 'earlier snapshot is immutable');
});

test('observation preserves native ray directions, intersections and return values', t => {
  const camera = new THREE.OrthographicCamera(-32, 32, 32, -32, 0.1, 300);
  camera.position.set(10, 100, 10); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const raycaster = new THREE.Raycaster(), coords = new THREE.Vector2(0.2, -0.1);
  const returned = raycaster.setFromCamera(coords, camera), ray = raycaster.ray.clone();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
  const prototypeMethod = THREE.Raycaster.prototype.setFromCamera, capture = {};
  const dispose = installMinimapCameraProbe(THREE, capture); t.after(dispose);
  assert.equal(raycaster.setFromCamera(coords, camera), returned);
  assert.deepEqual(raycaster.ray, ray);
  assert.deepEqual(raycaster.ray.intersectPlane(plane, new THREE.Vector3()), hit);
  camera.zoom = 2; camera.updateProjectionMatrix(); raycaster.setFromCamera(coords, camera);
  assert.equal(capture.camera.zoom, 2);
  dispose(); assert.equal(THREE.Raycaster.prototype.setFromCamera, prototypeMethod);
});
