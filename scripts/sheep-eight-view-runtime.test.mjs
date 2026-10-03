import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createNeutralWildlifeRenderer, WILDLIFE_RENDER_REGISTRY } from '../src/neutral-wildlife-renderer.mjs';
import { sheepQuadPlacement, staticSheepFrame } from '../src/sheep-static-preview.mjs';
import { CAMERA_VIEW_DIRECTION } from '../src/camera-controls.mjs';
import { auditSheepDirectionalReadiness, SHEEP_DIRECTIONS } from './sheep-directional-readiness.mjs';
import { decodeRgba8 } from './sprite-pixel-bounds.mjs';

const root = new URL('../assets/wildlife/bellweather-sheep-static-v1/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('sprite-atlas-pack-v1.json', root)));
const binding = JSON.parse(await readFile(new URL('static-preview-binding.json', root)));

test('the admitted original views, consumed contract and both atlases pass byte/pixel acceptance', async () => {
  const report = await auditSheepDirectionalReadiness(root.pathname, new URL('source/capture-contract.json', root).pathname);
  assert.deepEqual(report.errors, []);
  assert.equal(report.status, 'directional-static-bytes-validated');
  assert.equal(report.sourceViewsVerified, 8);
  assert.deepEqual(binding.directions, SHEEP_DIRECTIONS);
  assert.deepEqual(binding.animations, []);
  assert.equal(binding.projectedPixelsPerWorldUnit, 256);
  assert.equal(binding.headBodyOffsetDegrees, 42.03499984741211);
  for (const directionId of SHEEP_DIRECTIONS) {
    const state = { directionId, stateId: 'idle', visible: true, moving: false };
    const frame = staticSheepFrame(manifest, binding, state);
    assert.ok(frame);
    assert.deepEqual(sheepQuadPlacement(frame, 256), { width: 2, height: 2, centerX: 0, centerY: 0, scale: 1 / 256 });
    for (const stateId of binding.unavailableStates) assert.equal(staticSheepFrame(manifest, binding, { ...state, stateId }), null);
  }
});

test('default loader attaches all eight real views without root drift, UV sharing or invented animation', async () => {
  const originalFetch = globalThis.fetch, OriginalImage = globalThis.Image;
  const requests = [];
  let corrupt = false;
  globalThis.fetch = async input => {
    const url = new URL(input);
    if (url.protocol === 'blob:') return originalFetch(url);
    assert.ok(url.href.startsWith(root.href), 'normal registry requests the admitted runtime pack');
    requests.push(url.pathname);
    const bytes = await readFile(url);
    return new Response(corrupt && url.pathname.endsWith('sheep-atlas-runtime.png') ? Buffer.concat([bytes, Buffer.from('x')]) : bytes);
  };
  globalThis.Image = class {
    async decode() {
      const png = decodeRgba8(Buffer.from(await (await fetch(this.src)).arrayBuffer()));
      this.width = png.width; this.height = png.height;
    }
  };
  const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-20, 20, 20, -20, .1, 100);
  camera.position.fromArray(CAMERA_VIEW_DIRECTION).normalize().multiplyScalar(20);
  camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const definitions = [...SHEEP_DIRECTIONS, 'omitted'].map((directionId, index) => ({
    id: directionId, type: 'food', stock: 100, x: index * 2, z: index % 2,
    wildlifeSpecies: 'bellweather-sheep', ...(index < 8 ? { wildlifeNoseYawDegrees: index * 45 } : {}),
  }));
  const rows = definitions.map(({ id }) => ({ id, type: 'food', stock: 100,
    wildlifeSpecies: 'bellweather-sheep', wildlifeState: 'alive' }));
  const renderer = createNeutralWildlifeRenderer({ THREE, scene, groundHeight: () => .2 });
  const group = id => scene.children.find(item => item.userData.wildlifeNodeId === id);
  let fallback;
  try {
    assert.equal(WILDLIFE_RENDER_REGISTRY['bellweather-sheep'].bindingUrl, new URL('static-preview-binding.json', root).href);
    renderer.reset(definitions); await renderer.ready(); renderer.reconcile(rows, () => true); renderer.update(camera);
    assert.equal(renderer.diagnostics().artStatus, 'ready');
    assert.ok(renderer.diagnostics().nodes.every(node => node.mode === 'static-illustration'));
    const meshes = SHEEP_DIRECTIONS.map(id => group(id).children[2]);
    assert.equal(new Set(meshes.map(mesh => mesh.geometry)).size, 8);
    assert.equal(new Set(meshes.map(mesh => mesh.material)).size, 1);
    assert.equal(group('omitted').children[2].geometry, meshes[0].geometry);
    assert.equal(meshes[0].material.map.image.width, 2048);
    assert.equal(meshes[0].material.map.image.height, 1024);
    const geometries = meshes.map(mesh => mesh.geometry);
    const uvs = geometries.map(geometry => [...geometry.getAttribute('uv').array]);
    const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`);
    for (const [index, mesh] of meshes.entries()) {
      const x = (index % 4) * 512, y = Math.floor(index / 4) * 512;
      const expected = [(x + .5) / 2048, (y + .5) / 1024, (x + 511.5) / 2048, (y + .5) / 1024,
        (x + .5) / 2048, (y + 511.5) / 1024, (x + 511.5) / 2048, (y + 511.5) / 1024];
      uvs[index].forEach((value, i) => close(value, expected[i]));
      assert.deepEqual(mesh.scale.toArray(), [2, 2, 1]);
      assert.ok(mesh.quaternion.equals(camera.quaternion), 'producer pose offset is not reapplied to the billboard');
      scene.updateMatrixWorld(true);
      const authoredRoot = new THREE.Vector3(definitions[index].x, .2, definitions[index].z).project(camera);
      const projectedRoot = mesh.getWorldPosition(new THREE.Vector3()).project(camera);
      close(projectedRoot.x, authoredRoot.x); close(projectedRoot.y, authoredRoot.y);
    }
    const disposalCounts = Array(10).fill(0);
    [...geometries, meshes[0].material, meshes[0].material.map].forEach((resource, index) => {
      resource.addEventListener('dispose', () => disposalCounts[index]++);
    });
    renderer.reset([...definitions].reverse()); renderer.reconcile(rows, () => true); renderer.update(camera);
    for (const [index, id] of SHEEP_DIRECTIONS.entries()) {
      assert.equal(group(id).children[2].geometry, geometries[index]);
      assert.deepEqual([...geometries[index].getAttribute('uv').array], uvs[index]);
    }
    renderer.reconcile(rows, node => node.id !== 'east');
    assert.equal(group('east').visible, false, 'fog hides the real frame immediately');
    renderer.reconcile(rows.filter(row => row.id !== 'west'), () => true);
    assert.equal(group('west').visible, false, 'omitted authoritative rows stay hidden');
    renderer.reconcile(rows.map(row => ({ ...row, stock: 50, wildlifeState: 'carcass' })), () => true);
    assert.ok(renderer.diagnostics().nodes.every(node => node.mode === 'food-cache-marker'));
    assert.ok(scene.children.every(item => !item.children[2].visible));
    renderer.reconcile(rows.map(row => ({ ...row, stock: 0, wildlifeState: 'depleted' })), () => true);
    assert.ok(scene.children.every(item => !item.visible));
    renderer.dispose(); renderer.dispose();
    assert.deepEqual(disposalCounts, Array(10).fill(1));
    assert.equal(requests.length, 3, 'one binding/manifest/atlas load across every direction and reset');
    corrupt = true;
    fallback = createNeutralWildlifeRenderer({ THREE, scene, groundHeight: () => .2 });
    fallback.reset(definitions); await fallback.ready(); fallback.reconcile(rows, () => true); fallback.update(camera);
    assert.equal(fallback.diagnostics().artStatus, 'fallback');
    assert.ok(fallback.diagnostics().nodes.every(node => node.mode === 'sheep-proxy'));
    assert.ok(scene.children.every(item => item.children.length === 2), 'unverified pixels never enter the scene');
  } finally {
    renderer.dispose(); fallback?.dispose(); globalThis.fetch = originalFetch; globalThis.Image = OriginalImage;
  }
});
