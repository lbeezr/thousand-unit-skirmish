import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import * as THREE from 'three';
import { createCapturedBuildingSprite, disposeCapturedBuildingSprite } from '../src/captured-building-art.mjs';

// Execute the shipped factory without launching the browser-only asset loader.
const source = readFileSync(new URL('../src/environment-art.mjs', import.meta.url), 'utf8');
const factory = source.slice(source.indexOf('export function createConstructionGroundInstances('),
  source.indexOf('\nfunction registerLandVegetation(')).replaceAll('export function', 'function');
function groundFactory(loaded = false, height = 0) {
  const context = vm.createContext({ THREE,
    constructionTextures: new Map(loaded ? ['earthwork', 'foundation'].map(stage => [stage, new THREE.Texture()]) : []),
    constructionMaterials: new Map(), constructionInstances: new Map(),
    registerTextureMaterial() {}, textureMaterials(map, stage) { if (!map.has(stage)) map.set(stage, new Set()); return map.get(stage); },
    instanceDummy: new THREE.Object3D(), groundHeight: () => height,
    constructionGroundRotation: new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)),
  });
  vm.runInContext(factory, context); return context;
}

test('loaded and fallback construction paint precedes actors without disabling terrain/building occlusion', () => {
  const unitSource = readFileSync(new URL('../src/unit-sprite-runtime.mjs', import.meta.url), 'utf8');
  const actorOrder = Number(unitSource.match(/mesh.renderOrder = ([\d.]+);/)[1]);
  const captured = createCapturedBuildingSprite();
  for (const loaded of [false, true]) for (const stage of ['earthwork', 'foundation']) {
    const mesh = groundFactory(loaded).createConstructionGroundInstances(stage, 128);
    assert.ok(mesh.renderOrder < 0, 'paint must precede default-order transparent props/direct buildings');
    assert.ok(mesh.renderOrder < captured.renderOrder && mesh.renderOrder < actorOrder,
      'paint cannot alpha-blend over actors that do not write depth');
    assert.equal(mesh.material.depthTest, true, 'raised terrain/opaque building bodies must still reject hidden paint');
    assert.equal(mesh.material.depthWrite, false, 'paint must not become an occluder');
    assert.equal(mesh.material.transparent, true);
    assert.equal(mesh.visible, false); assert.equal(mesh.count, 0);
    mesh.geometry.dispose(); mesh.material.dispose();
  }
  disposeCapturedBuildingSprite(captured);
});

test('construction ground keeps true terrain height and clears on empty membership', () => {
  const context = groundFactory(true, 2.4);
  const mesh = context.createConstructionGroundInstances('earthwork', 2), matrix = new THREE.Matrix4();
  assert.equal(context.updateConstructionGroundInstances(mesh, [{ x: 3.5, z: -2.5 }]), true);
  mesh.getMatrixAt(0, matrix);
  const point = new THREE.Vector3().setFromMatrixPosition(matrix);
  assert.ok(Math.abs(point.y - 2.402) < 1e-6); assert.equal(point.x, 3.5); assert.equal(point.z, -2.5);
  const before = mesh.instanceMatrix.array.slice();
  assert.equal(context.updateConstructionGroundInstances(mesh, Array(3).fill({ x: 0, z: 0 })), false);
  assert.deepEqual(mesh.instanceMatrix.array, before, 'capacity rejection must not partially update');
  assert.equal(context.updateConstructionGroundInstances(mesh, []), true);
  assert.equal(mesh.count, 0); assert.equal(mesh.visible, false);
  mesh.geometry.dispose(); mesh.material.dispose();
});
