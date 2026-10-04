import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { WebGLRenderLists } from 'three/src/renderers/webgl/WebGLRenderLists.js';
import { createShoreFishPlaceholder, updateShoreFishPlaceholder } from '../src/shore-fishing-placeholder.mjs';
import { resourceVisualStage } from '../src/resource-visual-state.mjs';
import { isShoreFish } from '../src/shore-fishing.mjs';
import { fishingVisualSites } from '../src/worker-fishing-contact.mjs';

test('temporary marker uses existing ring visibility and finite stock stage cues without external art', () => {
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.66, 24), new THREE.MeshBasicMaterial());
  const marker = createShoreFishPlaceholder();
  ring.add(marker);
  assert.equal(marker.parent, ring);
  assert.equal(marker.userData.placeholderArt, true);
  assert.equal(marker.material.map, null, 'no asset download or finished-art assertion');
  assert.ok(marker.geometry.attributes.position.count > 0);
  updateShoreFishPlaceholder(marker, 'full');
  assert.equal(marker.scale.x, 0.45);
  updateShoreFishPlaceholder(marker, 'low');
  assert.ok(marker.scale.x < 1 && marker.scale.x > 0);
  updateShoreFishPlaceholder(marker, 'depleted');
  assert.equal(marker.material.color.getHex(), 0x77806b);
  assert.equal(marker.scale.x, 0.45 * 0.22);
  updateShoreFishPlaceholder(marker, 'full');
  assert.equal(marker.scale.x, 0.45, 'rematch restores presentation');
  assert.equal(marker.material.color.getHex(), 0x82d6df);
  marker.geometry.dispose(); marker.material.dispose(); ring.geometry.dispose(); ring.material.dispose();
});

test('actual shore-fish ring sorts below Worker sprites without moving its stock/fog anchor', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const scene = new THREE.Scene(), visuals = new Map(), stocks = new Map();
  const mapDefinition = JSON.parse(readFileSync(new URL('../maps/shore-fishing.json', import.meta.url)));
  const context = vm.createContext({ THREE, resourceVisualStage, isShoreFish,
    createShoreFishPlaceholder, updateShoreFishPlaceholder, fishingVisualSites, mapDefinition,
    groundHeight: () => 0.3, addMapObject: mesh => scene.add(mesh),
    resourceCalloutTexture: () => new THREE.Texture(), resourceNodeVisuals: visuals,
    latestResourceStocks: stocks, setWoodNodeTreeStage() {}, setBerryNodeStage() {},
  });
  vm.runInContext(main.slice(main.indexOf('function addResourceNodeVisual('),
    main.indexOf('function updateResourceNodeCallouts(')), context);
  const fish = { id: 'azure-food', type: 'food', resourceVariant: 'shore-fish', x: -10.5, z: 9.5, stock: 60 };
  context.addResourceNodeVisual(fish);
  context.addResourceNodeVisual({ ...fish, id: 'berries', resourceVariant: undefined });
  const visual = visuals.get(fish.id), ring = visual.ring;
  assert.equal(ring.position.x, -10.5); assert.equal(ring.position.z, 9.5);
  assert.ok(Math.abs(ring.position.y - 0.335) < 1e-9);
  const groundPosition = ring.position.toArray();
  assert.equal(ring.geometry.parameters.innerRadius, 0.27);
  assert.equal(ring.geometry.parameters.outerRadius, 0.31);
  assert.equal(visuals.get('berries').ring.geometry.parameters.outerRadius, 0.66);
  assert.equal(ring.material.color.getHex(), 0xe4bd63);
  assert.equal(ring.material.opacity, 0.78);
  assert.equal(visuals.get('berries').ring.renderOrder, 2, 'other resources keep their existing order');
  assert.equal(visual.fishPlaceholder.parent, ring);
  scene.updateMatrixWorld(true);
  const glyph = visual.fishPlaceholder.getWorldPosition(new THREE.Vector3());
  assert.equal(glyph.x, -9.5); assert.equal(glyph.z, 9.5, 'glyph identifies actual adjacent water');
  const worker = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true }));
  const runtime = readFileSync(new URL('../src/unit-sprite-runtime.mjs', import.meta.url), 'utf8');
  worker.renderOrder = Number(runtime.match(/mesh\.renderOrder = ([\d.]+);/)[1]);
  for (const depth of [-100, 100]) {
    const list = new WebGLRenderLists().get(scene, 0); list.init();
    list.push(worker, worker.geometry, worker.material, 0, -depth, null);
    list.push(ring, ring.geometry, ring.material, 0, depth, null);
    list.sort();
    assert.deepEqual(list.transparent.map(item => item.object), [ring, worker],
      'Three draws the marker before the sprite regardless of distance sort');
  }
  ring.visible = false;
  let markerVisible = false;
  scene.traverseVisible(mesh => { if (mesh === visual.fishPlaceholder) markerVisible = true; });
  assert.equal(markerVisible, false, 'icon retains parent ring fog visibility');
  ring.visible = true;
  context.updateResourceNodeVisual(fish.id, 0);
  assert.equal(stocks.get(fish.id), 0);
  assert.equal(ring.material.color.getHex(), 0x77806b);
  assert.equal(ring.material.opacity, 0.35);
  assert.equal(visual.fishPlaceholder.scale.x, 0.45 * 0.22);
  context.updateResourceNodeVisual(fish.id, 60);
  assert.equal(ring.material.color.getHex(), 0xe4bd63);
  assert.equal(ring.material.opacity, 0.78);
  assert.equal(visual.fishPlaceholder.scale.x, 0.45);
  assert.deepEqual(ring.position.toArray(), groundPosition);
});
