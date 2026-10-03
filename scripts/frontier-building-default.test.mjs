import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import * as THREE from 'three';
import { BUILDING_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { buildingPresentation } from '../src/gameplay-presentation.mjs';
import { frontierBuildingManifestUrl } from '../src/frontier-building-preview.mjs';
import { createCapturedBuildingSprite, updateCapturedBuildingSprite, disposeCapturedBuildingSprite } from '../src/captured-building-art.mjs';

// Real renderer factories and verified public file bytes, with DOM decode mocked.
// This is a source/binding/lifecycle test; it does not execute WebGL or certify pixels.
test('normal Town Center/House factories use existing Complete art and truthful per-state fallbacks for both teams', async () => {
  const previous = { fetch: globalThis.fetch, Image: globalThis.Image, document: globalThis.document, warn: console.warn };
  const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
  const functionSource = name => {
    const start = main.indexOf(`function ${name}(`);
    assert.ok(start >= 0, name);
    return main.slice(start, main.indexOf('\nfunction ', start + 1));
  };
  const fetched = [];
  globalThis.fetch = async url => {
    fetched.push(String(url));
    assert.equal(new URL(url).protocol, 'file:', 'use the actual repository asset URL');
    const bytes = await readFile(fileURLToPath(url));
    return new Response(bytes, { headers: { 'content-type': String(url).endsWith('.json') ? 'application/json' : 'image/png' } });
  };
  globalThis.Image = class { width = 1024; height = 1024; decode() { return Promise.resolve(); } };
  globalThis.document = { createElement() { return { getContext() { return { drawImage() {}, fillRect() {} }; } }; } };
  console.warn = () => {};
  const scene = new THREE.Scene(), capturedBuildingVisuals = [], TEAM_HEX = [0x5aa7d7, 0xe67a5e];
  const context = vm.createContext({ THREE, scene, capturedBuildingVisuals, TEAM_HEX, buildingPresentation,
    frontierBuildingManifestUrl, frontierBuildingsPreview: null, createCapturedBuildingSprite,
    groundHeight: () => 1.6, updateBuildingHealthIndicator() {}, updateBuildingProductionCue() {},
    createBuildingHealthIndicator: () => ({ group: new THREE.Group() }),
    createBuildingCombatFeedback: () => ({ targetRing: new THREE.Group(), impactFlash: new THREE.Group() }),
    createBuildingRallyMarker: () => new THREE.Group(),
  });
  for (const name of ['addBuildingStandard', 'createTownCenterVisual', 'updateTownCenterVisual',
    'createHouseVisual', 'updateHouseVisual', 'createGameplayBuildingVisual']) vm.runInContext(functionSource(name), context);
  const camera = new THREE.OrthographicCamera(-20, 20, 20, -20, .1, 300);
  camera.position.set(80, 112, 80); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const step = () => {
    for (const entry of capturedBuildingVisuals) {
      updateCapturedBuildingSprite(entry.sprite, camera, entry.lifecycleInput);
      entry.fallbackRoot.visible = !entry.sprite.visible;
    }
  };
  const settle = async predicate => {
    for (let i = 0; i < 300; i++) { step(); if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 1)); }
    assert.fail('Captured frame failed to settle');
  };
  const visuals = [], textures = new Map();
  try {
    assert.equal(BUILDING_DEFINITIONS['town-center'].footprint, 5);
    assert.equal(BUILDING_DEFINITIONS.house.footprint, 3);
    for (const team of [0, 1]) for (const type of ['town-center', 'house']) {
      const building = { type, team, x: team ? -50 : 50, z: 0, home: type === 'town-center', complete: true, progress: 1, hp: 100, maxHp: 100 };
      const visual = context.createGameplayBuildingVisual(building); visuals.push(visual);
      const entry = visual.frontierCaptureEntry;
      assert.ok(entry, 'actual normal factory attaches this family');
      await settle(() => entry.sprite.visible);
      const data = entry.sprite.userData.capturedBuildingArt, depth = data.bodyDepth;
      assert.equal(data.manifest.asset, type); assert.equal(data.requestKey, 'complete:1:#' + TEAM_HEX[team].toString(16));
      assert.equal(entry.sprite.scale.x, 8); assert.equal(entry.sprite.scale.y, 8);
      assert.ok(Math.abs(entry.sprite.center.y - (1 - 647.1527325565025 / 1024)) < 1e-12);
      assert.equal(visual.group.position.y, 1.6); assert.equal(entry.sprite.position.y, .035);
      assert.equal(entry.fallbackRoot.visible, false);
      if (textures.has(type)) assert.equal(entry.sprite.material.map, textures.get(type), 'unmasked frame texture is shared across teams and instances');
      else textures.set(type, entry.sprite.material.map);
      assert.ok(visual.group.children.some(child => child.userData.buildingTeamStandard && child.visible), 'team standard stays outside the hidden fallback');
      assert.equal(visual.outline.parent, visual.group); assert.equal(visual.healthIndicator.group.parent, visual.group);
      assert.equal(depth.material.map, entry.sprite.material.map); assert.equal(depth.geometry, entry.sprite.geometry);
      assert.equal(depth.material.alphaTest, .9); assert.equal(depth.material.colorWrite, false); assert.equal(depth.material.depthWrite, true);
      scene.updateMatrixWorld(true); assert.deepEqual(depth.matrixWorld.elements, entry.sprite.matrixWorld.elements);
      assert.deepEqual(depth.center.toArray(), entry.sprite.center.toArray());
      const point = entry.sprite.getWorldPosition(new THREE.Vector3()).project(camera);
      const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(point.x, point.y), camera);
      const hits = ray.intersectObject(entry.sprite, true);
      assert.equal(hits.length, 1); assert.equal(hits[0].object, entry.sprite, 'depth never adds a picking target');
      for (const state of [{ complete: false, progress: .05 }, { complete: false, progress: .5 }, { complete: true, progress: 1, hp: 50 }, { complete: true, progress: 1, hp: 20 }]) {
        entry.lifecycleInput = { ...building, ...state };
        if (type === 'house') context.updateHouseVisual(visual, entry.lifecycleInput);
        else context.updateTownCenterVisual(visual, entry.lifecycleInput);
        step();
        assert.equal(entry.sprite.visible, false, 'missing Foundation/Frame/Damaged/Critical cannot show Complete');
        assert.equal(entry.fallbackRoot.visible, true);
        if (type === 'house' && state.complete === false) assert.equal(visual.roof.visible, false, 'construction fallback omits its finished roof');
        if (type === 'town-center') {
          await settle(() => visual.captureEntry.sprite.visible);
          const expected = state.complete === false ? state.progress < .275 ? 'foundation' : 'frame' : state.hp > 30 ? 'damaged' : 'critical';
          assert.ok(visual.captureEntry.sprite.userData.capturedBuildingArt.requestKey.startsWith(expected + ':'), 'older authored lifecycle fallback selects the real state');
        }
      }
      entry.lifecycleInput = building; await settle(() => entry.sprite.visible);
      visual.group.visible = false;
      assert.equal(entry.sprite.parent.visible, false, 'authoritative hidden group owns both captured passes');
      visual.group.visible = true;
    }
    assert.ok(fetched.some(url => url.includes('house-complete-view-01.png')));
    assert.ok(fetched.some(url => url.includes('town-center-complete-view-01.png')));
    const houseTexture = textures.get('house'); let releases = 0;
    houseTexture.addEventListener('dispose', () => releases++);
    const houses = visuals.filter(visual => visual.frontierCaptureEntry.sprite.userData.capturedBuildingArt.manifest.asset === 'house');
    disposeCapturedBuildingSprite(houses[0].frontierCaptureEntry.sprite);
    assert.equal(releases, 0, 'one owner cannot dispose another building\'s shared frame');
    disposeCapturedBuildingSprite(houses[1].frontierCaptureEntry.sprite);
    assert.equal(releases, 1, 'last frame owner releases the single texture');
  } finally {
    for (const entry of capturedBuildingVisuals) disposeCapturedBuildingSprite(entry.sprite);
    scene.traverse(object => { if (!object.isSprite) object.geometry?.dispose(); object.material?.dispose(); });
    Object.assign(globalThis, { fetch: previous.fetch, Image: previous.Image, document: previous.document }); console.warn = previous.warn;
  }
});
