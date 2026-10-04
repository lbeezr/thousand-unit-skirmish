import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import * as THREE from 'three';
import { BUILDING_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { buildingPresentation } from '../src/gameplay-presentation.mjs';
import { buildingOrientationAngle } from '../src/building-orientation.mjs';
import { battlefieldCursor } from '../src/battlefield-cursor.mjs';
import { attachBuildingSprite, buildingSpriteUrl } from '../src/building-sprites.mjs';
import { barracksModelVisualState, buildingFinishedDetailsVisible } from '../src/building-visual-state.mjs';
import { frontierBuildingManifestUrl } from '../src/frontier-building-preview.mjs';
import { createCapturedBuildingSprite, updateCapturedBuildingSprite, disposeCapturedBuildingSprite } from '../src/captured-building-art.mjs';
import { wildlifeClientBindings, wildlifeClientFunctionSource } from './wildlife-client-fixture-bindings.mjs';

// Real renderer factories and verified public file bytes, with DOM decode mocked.
// This is a source/binding/lifecycle test; it does not execute WebGL or certify pixels.
test('normal factories use all eight Complete families and truthful per-state fallbacks for both teams', async () => {
  const previous = { fetch: globalThis.fetch, Image: globalThis.Image, document: globalThis.document, warn: console.warn };
  const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
  const functionSource = name => {
    const start = main.indexOf(`function ${name}(`);
    assert.ok(start >= 0, name);
    return main.slice(start, main.indexOf('\n}', start + 1) + 2);
  };
  const fetched = [];
  globalThis.fetch = async url => {
    fetched.push(String(url));
    assert.equal(new URL(url).protocol, 'file:', 'use the actual repository asset URL');
    const bytes = await readFile(fileURLToPath(url));
    return new Response(bytes, { headers: { 'content-type': String(url).endsWith('.json') ? 'application/json' : 'image/png' } });
  };
  globalThis.Image = class { width = 1024; height = 1024; decode() { return Promise.resolve(); } };
  globalThis.document = {
    createElement() { return { getContext() { return { drawImage() {}, fillRect() {} }; } }; },
    createElementNS() {
      const listeners = new Map();
      let imageSource;
      return { width: 640, height: 640,
        addEventListener(name, fn) { listeners.set(name, fn); },
        removeEventListener(name) { listeners.delete(name); },
        set src(value) {
          imageSource = value;
          fetched.push(value);
          // Load actual legacy bytes, while leaving browser image decode mocked.
          readFile(new URL('../' + value.replace(/^\.\//, ''), import.meta.url))
            .then(() => listeners.get('load')?.call(this), () => listeners.get('error')?.call(this));
        },
        get src() { return imageSource; },
      };
    },
  };
  console.warn = () => {};
  const scene = new THREE.Scene(), capturedBuildingVisuals = [], TEAM_HEX = [0x5aa7d7, 0xe67a5e];
  const renderer = { domElement: { dataset: {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }) } };
  let selectedIds = [];
  const camera = new THREE.OrthographicCamera(-20, 20, 20, -20, .1, 300);
  const context = vm.createContext({ ...wildlifeClientBindings(), THREE, scene, capturedBuildingVisuals, TEAM_HEX, BUILDING_DEFINITIONS, buildingPresentation,
    camera, renderer, raycaster: new THREE.Raycaster(), pointerNdc: new THREE.Vector2(),
    latestBuildings: [], buildingVisuals: new Map(), localTeam: 0, selectedBuildingId: null,
    selectedIds: () => selectedIds, units: { worker: { kind: 'worker' }, military: { kind: 'infantry' } },
    battlefieldCursor, pan: null, spaceDown: false, drag: null, movedPointer: false,
    matchWinner: -1, buildPlacementActive: false, ui: {}, attackMoveMode: false,
    tapOrderArmed: false, cursorShift: false, cursorPointer: null,
    pickAt: (x, y, predicate, options) => { assert.equal(options.advance, false); return { unit: null }; },
    pickResourceNodeAt: () => null, pickForestCellAt: () => null,
    dummy: new THREE.Object3D(), attachBuildingSprite, barracksModelVisualState, buildingFinishedDetailsVisible,
    frontierBuildingManifestUrl, frontierBuildingsPreview: null, createCapturedBuildingSprite,
    buildingOrientationAngle, groundHeight: () => 1.6, updateBuildingHealthIndicator() {}, updateBuildingProductionCue() {},
    createBuildingHealthIndicator: () => ({ group: new THREE.Group() }),
    createBuildingCombatFeedback: () => ({ targetRing: new THREE.Group(), impactFlash: new THREE.Group() }),
    createBuildingRallyMarker: () => new THREE.Group(),
  });
  vm.runInContext(wildlifeClientFunctionSource(main), context);
  for (const name of ['addBuildingStandard', 'createBuildingProductionLamp', 'createTownCenterVisual', 'updateTownCenterVisual',
    'createHouseVisual', 'updateHouseVisual', 'createWatchtowerVisual', 'updateWatchtowerVisual',
    'createBarracksVisual', 'updateBarracksVisual', 'createArcheryRangeVisual', 'updateArcheryRangeVisual',
    'createGameplayBuildingVisual', 'createBuildingHealthIndicator', 'updateBuildingHealthIndicator',
    'updateBuildingSelectionVisual', 'pickBuildingAt', 'buildingSupportsRally',
    'setBattlefieldCursor', 'syncBattlefieldCursor']) vm.runInContext(functionSource(name), context);
  camera.position.set(80, 112, 80); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const step = () => {
    for (const entry of capturedBuildingVisuals) {
      updateCapturedBuildingSprite(entry.sprite, camera, entry.lifecycleInput);
      entry.fallbackRoot.visible = !entry.sprite.visible;
      entry.fallbackRoot.rotation.y = entry.fallbackRoot.parent?.userData.buildingOrientationRoot
        ? 0 : buildingOrientationAngle(entry.lifecycleInput?.orientation ?? 0);
    }
  };
  const settle = async predicate => {
    for (let i = 0; i < 300; i++) { step(); if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 1)); }
    assert.fail('Captured frame failed to settle');
  };
  const visuals = [], textures = new Map(), teamShapes = new Map();
  try {
    assert.equal(BUILDING_DEFINITIONS['town-center'].footprint, 5);
    const families = ['town-center', 'house', 'storehouse', 'stable', 'workshop', 'watchtower', 'barracks', 'archery-range'];
    for (const type of families.slice(1)) assert.equal(BUILDING_DEFINITIONS[type].footprint, 3);
    const update = { 'town-center': context.updateTownCenterVisual, house: context.updateHouseVisual,
      storehouse: context.updateHouseVisual, stable: context.updateBarracksVisual,
      workshop: context.updateArcheryRangeVisual, watchtower: context.updateWatchtowerVisual,
      barracks: context.updateBarracksVisual, 'archery-range': context.updateArcheryRangeVisual };
    for (const team of [0, 1]) for (const type of families) {
      const building = { id: type + '-' + team, type, team, x: team ? -50 : 50, z: 0, home: type === 'town-center', complete: true, progress: 1, hp: 100, maxHp: 100 };
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
      assert.ok(visual.group.children.some(child => child.userData.buildingTeamStandard && child.visible), type + ': team standard stays outside the hidden fallback');
      let flag;
      visual.group.traverse(child => { if (child.isMesh && child.material.vertexColors) flag = child; });
      assert.ok(flag, type + ': live team flag geometry exists');
      const flagColor = flag.geometry.getAttribute('color'), expectedColor = new THREE.Color(TEAM_HEX[team]);
      for (const [actual, expected] of [[flagColor.getX(0), expectedColor.r], [flagColor.getY(0), expectedColor.g], [flagColor.getZ(0), expectedColor.b]]) {
        assert.ok(Math.abs(actual - expected) < 1e-6, 'live flag retains team color');
      }
      const shape = [...flag.geometry.getAttribute('position').array];
      if (team === 0) teamShapes.set(type, shape);
      else assert.notDeepEqual(shape, teamShapes.get(type), 'team flags differ in shape, despite sharing unmasked captured art');
      context.updateBuildingSelectionVisual(visual, true);
      assert.equal(visual.outline.material.color.getHex(), 0xd5ef78); assert.equal(visual.outline.material.opacity, 1);
      context.updateBuildingSelectionVisual(visual, false);
      assert.equal(visual.outline.material.color.getHex(), TEAM_HEX[team]); assert.equal(visual.outline.material.opacity, .9);
      if (['stable', 'workshop', 'barracks', 'archery-range'].includes(type)) {
        const standard = visual.group.children.find(child => child.userData.buildingTeamStandard);
        const expected = type === 'stable' || type === 'barracks' ? [1.24, 0, 1.15] : [-1.18, 0, 1.17];
        standard.position.toArray().forEach((value, index) => assert.ok(Math.abs(value - expected[index]) < 1e-12,
          'extracting a nested standard preserves its local/world position'));
      }
      assert.equal(visual.outline.parent, visual.group); assert.equal(visual.healthIndicator.group.parent, visual.group);
      assert.equal(visual.combatFeedback.targetRing.parent, visual.group);
      assert.equal(visual.combatFeedback.impactFlash.parent, visual.group);
      if (visual.productionLamp) assert.equal(visual.productionLamp.parent, visual.group);
      if (visual.rallyMarker) assert.equal(visual.rallyMarker.parent, visual.group);
      assert.equal(depth.material.map, entry.sprite.material.map); assert.equal(depth.geometry, entry.sprite.geometry);
      assert.equal(depth.material.alphaTest, .9); assert.equal(depth.material.colorWrite, false); assert.equal(depth.material.depthWrite, true);
      scene.updateMatrixWorld(true); assert.deepEqual(depth.matrixWorld.elements, entry.sprite.matrixWorld.elements);
      assert.deepEqual(depth.center.toArray(), entry.sprite.center.toArray());
      const point = entry.sprite.getWorldPosition(new THREE.Vector3()).project(camera);
      const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(point.x, point.y), camera);
      const hits = ray.intersectObject(entry.sprite, true);
      assert.equal(hits.length, 1); assert.equal(hits[0].object, entry.sprite, 'depth never adds a picking target');
      for (const state of [
        ...[.05, .275, .276, .5, .75, .9].map(progress => ({ complete: false, progress })),
        ...[60, 31, 30, 20].map(hp => ({ complete: true, progress: 1, hp })),
      ]) {
        entry.lifecycleInput = { ...building, ...state };
        update[type](visual, entry.lifecycleInput);
        step();
        assert.equal(entry.sprite.visible, false, 'missing Foundation/Frame/Damaged/Critical cannot show Complete');
        assert.equal(entry.fallbackRoot.visible, true);
        if (['barracks', 'archery-range'].includes(type)) {
          const expected = buildingSpriteUrl(entry.lifecycleInput);
          await settle(() => {
            let sprite;
            entry.fallbackRoot.traverse(child => { if (child.isSprite && !child.userData.buildingBodyDepth) sprite = child; });
            return sprite?.visible && sprite.material.map?.image?.src === expected;
          });
          assert.ok(fetched.includes(expected), 'actual legacy direct loader requests the correct missing-state art');
        }
        if (state.complete === false) {
          if (visual.roof) assert.equal(visual.roof.visible, ['workshop', 'archery-range'].includes(type) && state.progress >= .9,
            'fallback roof follows the existing role transition');
          if (visual.roofPanels) for (const panel of visual.roofPanels) assert.equal(panel.visible, state.progress >= .75);
        } else {
          assert.equal(visual.healthIndicator.group.visible, true);
          assert.equal(visual.healthIndicator.fill.scale.x, state.hp / building.maxHp);
        }
        if (type === 'town-center') {
          await settle(() => visual.captureEntry.sprite.visible);
          const expected = state.complete === false ? state.progress <= .275 ? 'foundation' : 'frame' : state.hp > 30 ? 'damaged' : 'critical';
          assert.ok(visual.captureEntry.sprite.userData.capturedBuildingArt.requestKey.startsWith(expected + ':'), 'older authored lifecycle fallback selects the real state');
        }
      }
      const repairedAboveBoundary = { ...building, hp: 61 };
      entry.lifecycleInput = repairedAboveBoundary; update[type](visual, repairedAboveBoundary);
      await settle(() => entry.sprite.visible);
      assert.equal(visual.healthIndicator.group.visible, true, '61% restores Complete art while retaining honest health feedback');
      assert.equal(visual.healthIndicator.fill.scale.x, .61);
      entry.lifecycleInput = building; update[type](visual, building); await settle(() => entry.sprite.visible);
      assert.equal(visual.healthIndicator.group.visible, false, 'full repair hides the health indicator');
      assert.ok(visual.group.children.some(child => child.userData.buildingTeamStandard && child.visible), 'repair restores live team standard');
      context.latestBuildings = [building]; context.buildingVisuals = new Map([[building.id, visual]]);
      camera.position.set(building.x + 80, 113.6, 80); camera.lookAt(building.x, 1.6, 0); camera.updateMatrixWorld();
      const projected = entry.sprite.getWorldPosition(new THREE.Vector3()).project(camera);
      const px = (projected.x + 1) * 640, py = (1 - projected.y) * 360;
      context.localTeam = team;
      assert.equal(context.pickBuildingAt(px, py)?.id, building.id, 'ordinary picker admits a friendly family');
      context.localTeam = 1 - team;
      assert.equal(context.pickBuildingAt(px, py), null, 'default left-click picker cannot select an enemy building');
      assert.equal(context.pickBuildingAt(px, py, row => row.team !== context.localTeam)?.id, building.id);
      context.cursorPointer = { x: px, y: py }; selectedIds = ['military'];
      context.syncBattlefieldCursor(); assert.equal(renderer.domElement.dataset.cursorMode, 'attack');
      selectedIds = ['worker']; context.syncBattlefieldCursor(); assert.equal(renderer.domElement.dataset.cursorMode, 'unavailable');
      selectedIds = []; context.syncBattlefieldCursor(); assert.equal(renderer.domElement.dataset.cursorMode, 'select');
      context.localTeam = team; context.selectedBuildingId = building.id;
      context.syncBattlefieldCursor(); assert.equal(renderer.domElement.dataset.cursorMode,
        BUILDING_DEFINITIONS[type].products.length ? 'rally' : 'unavailable');
      context.selectedBuildingId = null; selectedIds = ['military']; context.syncBattlefieldCursor();
      assert.equal(renderer.domElement.dataset.cursorMode, 'move', 'hovering a friendly building adds no new highlight/order mode');
      assert.equal(visual.outline.material.color.getHex(), TEAM_HEX[team], 'hover preserves deselected team outline');
      visual.group.visible = false;
      assert.equal(entry.sprite.parent.visible, false, 'authoritative hidden group owns both captured passes');
      assert.equal(context.pickBuildingAt(px, py), null, 'hidden authoritative group adds no pick target');
      visual.group.visible = true;
    }
    for (const type of families) assert.ok(fetched.some(url => url.includes(type + '-complete-view-01.png')));
    const houseTexture = textures.get('house'); let releases = 0;
    houseTexture.addEventListener('dispose', () => releases++);
    const town = visuals.find(visual => visual.frontierCaptureEntry.lifecycleInput.type === 'town-center');
    town.frontierCaptureEntry.lifecycleInput = { ...town.frontierCaptureEntry.lifecycleInput, orientation: 1, complete: false, progress: 0.1 };
    town.captureEntry.lifecycleInput = town.frontierCaptureEntry.lifecycleInput;
    step();
    assert.equal(town.frontierCaptureEntry.fallbackRoot.rotation.y, Math.PI / 2);
    assert.equal(town.captureEntry.fallbackRoot.rotation.y, 0, 'nested procedural Town Center rotates exactly once');
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
