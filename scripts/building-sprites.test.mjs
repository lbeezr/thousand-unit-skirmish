import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
import { attachBuildingSprite, buildingSpriteUrl, applyBuildingGroundDepth } from '../src/building-sprites.mjs';
import { barracksModelVisualState, buildingFinishedDetailsVisible } from '../src/building-visual-state.mjs';
import { CAMERA_VIEW_DIRECTION } from '../src/camera-controls.mjs';

function groundDepthShader() {
  const material = new THREE.SpriteMaterial({ depthTest: true, depthWrite: false });
  applyBuildingGroundDepth(material);
  const shader = { vertexShader: THREE.ShaderLib.sprite.vertexShader,
    fragmentShader: THREE.ShaderLib.sprite.fragmentShader, uniforms: {} };
  material.onBeforeCompile(shader);
  // Evaluate the actual patched GLSL scalar assignments, rather than a copied
  // depth formula. The independent oracle below projects a world-space point.
  const expression = (source, name) => source.match(new RegExp(`${name}\\s*=\\s*([^;]+);`))[1];
  const slope = new Function('viewMatrix', 'max', `return ${expression(shader.vertexShader, 'vGroundSlope')};`);
  const groundZ = new Function('vBuildingDepth', 'vGroundSlope', 'min', `return ${expression(shader.fragmentShader, 'groundViewZ')};`);
  const depth = new Function('vBuildingDepth', 'groundViewZ', 'clamp', `return ${expression(shader.fragmentShader, 'gl_FragDepth')};`);
  return { material, shader, evaluate(camera, root, offset) {
    const view = camera.matrixWorldInverse.elements, projection = camera.projectionMatrix.elements;
    const v = { x: offset, y: root.clone().applyMatrix4(camera.matrixWorldInverse).z,
      z: projection[10], w: projection[14] };
    const value = slope([null, { y: view[5], z: view[6] }], Math.max);
    return depth(v, groundZ(v, value, Math.min), (x, lo, hi) => Math.max(lo, Math.min(hi, x)));
  } };
}

test('building ground-depth shader matches projected ground contact without flattening to the near plane', () => {
  const patched = groundDepthShader();
  for (const direction of [CAMERA_VIEW_DIRECTION, [8, 10, 8], [1, 3, 1]]) {
    for (const height of [0, 2.4]) {
      const root = new THREE.Vector3(2, height + .035, -1);
      const camera = new THREE.OrthographicCamera(-4, 4, 4, -4, .1, 300);
      camera.position.copy(new THREE.Vector3(...direction).normalize().multiplyScalar(100)).add(root);
      camera.lookAt(root); camera.updateMatrixWorld();
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
      const toward = new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion);
      for (const offset of [-1.4, -.6, -.05, 0, .35, 1.2]) {
        const billboardPoint = root.clone().addScaledVector(up, offset);
        const contact = billboardPoint.clone();
        if (offset < 0) contact.addScaledVector(toward, -offset * up.y / toward.y);
        const before = billboardPoint.clone().project(camera), expected = contact.clone().project(camera);
        const actual = patched.evaluate(camera, root, offset);
        assert.ok(Math.abs(actual - (expected.z * .5 + .5)) < 1e-10,
          `height ${height}, offset ${offset}: shader ${actual} must equal projected contact depth`);
        assert.ok(Math.abs(before.x - expected.x) < 1e-10 && Math.abs(before.y - expected.y) < 1e-10,
          'contact correction changes only depth, preserving selected art placement');
        if (offset < 0) {
          assert.ok(Math.abs(contact.y - root.y) < 1e-10);
          const foreground = contact.clone().addScaledVector(toward, .1).project(camera);
          assert.ok(actual > foreground.z * .5 + .5, 'foreground terrain must occlude the painted base/shadow');
          assert.ok(actual > 0 && actual < 1, 'ordinary below-anchor pixels must not receive clamped near-plane depth');
        }
      }
    }
  }
  patched.material.dispose();
});

test('ground-depth correction adds no texture/uniform/batch and preserves the sprite color/facing path', () => {
  const { material, shader } = groundDepthShader();
  assert.deepEqual(shader.uniforms, {});
  assert.equal(material.depthTest, true); assert.equal(material.depthWrite, false);
  assert.ok(shader.vertexShader.includes(THREE.ShaderLib.sprite.vertexShader.slice(0,
    THREE.ShaderLib.sprite.vertexShader.indexOf('gl_Position = projectionMatrix * mvPosition;'))));
  for (const chunk of ['#include <map_fragment>', '#include <alphatest_fragment>', '#include <fog_fragment>']) {
    assert.ok(shader.fragmentShader.includes(chunk), chunk);
  }
  assert.equal((shader.vertexShader.match(/varying vec4 vBuildingDepth/g) || []).length, 1);
  assert.equal((shader.vertexShader.match(/varying float vGroundSlope/g) || []).length, 1);
  assert.equal((shader.fragmentShader.match(/gl_FragDepth\s*=/g) || []).length, 1);
  material.dispose();
});

test('production building constructors keep outlines local to their grounded group', () => {
  const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const constructors = source.slice(source.indexOf('function createArcheryRangeVisual('),
    source.indexOf('\nfunction reconcileBuildings('));
  const scene = new THREE.Scene();
  const context = vm.createContext({ THREE, scene, dummy: new THREE.Object3D(),
    TEAM_HEX: [0x5aa7d7, 0xe67a5e], groundHeight: () => 2.4,
    barracksModelVisualState, buildingFinishedDetailsVisible,
    attachBuildingSprite: () => ({ update() {} }),
    addBuildingStandard: () => new THREE.Group(),
    createBuildingProductionLamp: () => new THREE.Group(),
    createBuildingRallyMarker: () => new THREE.Group(),
    createBuildingHealthIndicator: () => ({ group: new THREE.Group() }),
    createBuildingCombatFeedback: () => ({ targetRing: new THREE.Group(), impactFlash: new THREE.Group() }),
    updateBuildingProductionCue() {}, updateBuildingHealthIndicator() {},
  });
  vm.runInContext(constructors, context);
  for (const team of [0, 1]) for (const [type, create] of [
    ['archery-range', context.createArcheryRangeVisual], ['barracks', context.createBarracksVisual],
  ]) {
    const visual = create({ type, team, x: -14.5, z: 8.5, progress: 1, complete: true });
    assert.equal(visual.group.position.y, 2.4);
    assert.equal(visual.outline.parent, visual.group);
    const positions = visual.outline.geometry.getAttribute('position');
    assert.equal(positions.count, 8);
    for (let index = 0; index < positions.count; index++) {
      assert.ok(Math.abs(positions.getY(index) - .025) < 1e-6, 'local outline inherits terrain height once');
    }
    visual.group.traverse(object => {
      object.geometry?.dispose();
      object.material?.dispose();
    });
  }
});

test('available team and lifecycle frames resolve to real files', () => {
  for (const type of ['barracks', 'archery-range']) for (const team of [0, 1]) {
    for (const state of [
      { progress: 0.05 }, { progress: 0.5 }, { progress: 1 },
      { complete: true, hp: 100, maxHp: 100 },
      { complete: true, hp: 50, maxHp: 100 },
      { complete: true, hp: 20, maxHp: 100 },
    ]) assert.ok(existsSync(new URL(`../${buildingSpriteUrl({ type, team, ...state })}`, import.meta.url)));
  }
  assert.match(buildingSpriteUrl({ type: 'town-center' }), /view-01.webp$/);
  assert.equal(buildingSpriteUrl({ type: 'unknown' }), null);
});

test('sprite loading preserves fog, indicators, fallback and latest state', async () => {
  const group = new THREE.Group();
  const model = new THREE.Mesh();
  const indicator = new THREE.Group();
  group.add(model, indicator);
  const requests = [];
  const load = (url) => {
    const entry = { texture: new THREE.Texture(), url };
    entry.ready = new Promise(resolve => { entry.resolve = resolve; });
    requests.push(entry);
    return entry;
  };
  const controller = attachBuildingSprite(group, [model], { type: 'barracks', team: 0, progress: 0 }, undefined, load);
  const fallback = model.parent;
  const sprite = group.children.find(child => child.isSprite);
  const bodyDepth = group.children.find(child => child.userData.buildingBodyDepth);
  group.visible = false;
  controller.update({ type: 'barracks', team: 0, complete: true });
  requests[0].resolve(true); await Promise.resolve();
  assert.equal(sprite.visible, false);
  assert.equal(bodyDepth.visible, false, 'stale frames cannot leave a ghost occluder');
  requests[1].resolve(true); await Promise.resolve();
  assert.equal(sprite.visible, true);
  assert.equal(bodyDepth.visible, true);
  assert.equal(bodyDepth.material.map, sprite.material.map, 'both passes share the exact loaded frame');
  assert.equal(fallback.visible, false);
  assert.equal(group.visible, false, 'loading must not reveal fog-hidden buildings');
  assert.equal(indicator.parent, group);
  assert.equal(indicator.visible, true);
  controller.update({ type: 'barracks', team: 0, complete: true, hp: 1, maxHp: 100 });
  requests[2].resolve(false); await Promise.resolve();
  assert.equal(sprite.visible, false);
  assert.equal(bodyDepth.visible, false, 'failed replacement frames retain only the fallback');
  assert.equal(fallback.visible, true);
  controller.update({ type: 'barracks', team: 1, complete: true });
  controller.dispose();
  requests[3].resolve(true); await Promise.resolve();
  assert.equal(sprite.visible, false, 'disposed visuals must ignore late loads');
  assert.equal(bodyDepth.visible, false);
});

test('solid building pixels occlude later actors while soft shadows and openings leave depth alone', async () => {
  const group = new THREE.Group(), texture = new THREE.Texture();
  const controller = attachBuildingSprite(group, [], { type: 'barracks', team: 0, complete: true },
    undefined, () => ({ texture, ready: Promise.resolve(true) }));
  await Promise.resolve();
  const color = group.children.find(child => child.isSprite);
  const depth = group.children.find(child => child.userData.buildingBodyDepth);
  assert.equal(depth.material.transparent, false, 'Three routes the body into the opaque pass before transparent actors');
  assert.equal(depth.material.colorWrite, false); assert.equal(depth.material.depthWrite, true);
  assert.equal(depth.material.depthTest, true);
  assert.equal(color.material.depthWrite, false, 'the blended color/shadow pass stays unchanged');
  assert.equal(depth.material.map, color.material.map);
  assert.equal(depth.geometry, color.geometry, 'no extra vertex/index buffer');
  assert.deepEqual(depth.center.toArray(), color.center.toArray());
  assert.deepEqual(depth.position.toArray(), color.position.toArray());
  assert.deepEqual(depth.scale.toArray(), color.scale.toArray());
  assert.equal(color.material.map, texture);
  assert.equal(color.material.alphaTest, .08); assert.equal(depth.material.alphaTest, .9);
  const hits = []; depth.raycast(new THREE.Raycaster(), hits); assert.deepEqual(hits, []);

  // A depth-buffer oracle exercises the render-state contract, including a
  // negative control with the prior color-only pass. This is not GPU evidence.
  const rootDepth = .4;
  const writesDepth = alpha => depth.visible && alpha >= depth.material.alphaTest;
  const actorVisible = (alpha, actorDepth, withBodyPass) => actorDepth <= (withBodyPass && writesDepth(alpha) ? rootDepth : 1);
  assert.equal(actorVisible(1, .5, false), true, 'old color-only building allows a background actor through');
  assert.equal(actorVisible(1, .5, true), false, 'opaque body rejects the background actor');
  assert.equal(actorVisible(1, .3, true), true, 'foreground actor remains visible');
  for (const alpha of [0, .08, .3, .89]) assert.equal(actorVisible(alpha, .5, true), true,
    'transparent opening or soft shadow cannot become an opaque blocker');
  group.visible = false;
  assert.equal(depth.parent, group, 'the original fog-hidden group owns both passes');
  controller.dispose(); assert.equal(depth.visible, false);
  color.material.dispose(); depth.material.dispose(); texture.dispose();
});

test('body-depth cost stays at one extra shared-geometry pass per loaded sprite building', async () => {
  const server = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
  const buildingLimit = Number(server.match(/const MAX_BUILDINGS = (\d+);/)[1]);
  assert.ok(buildingLimit > 0 && buildingLimit <= 128,
    'a higher authoritative limit requires revisiting the documented draw budget');
  const scene = new THREE.Scene(), texture = new THREE.Texture();
  let loads = 0;
  for (let i = 0; i < buildingLimit; i++) {
    const group = new THREE.Group(); scene.add(group);
    attachBuildingSprite(group, [], { type: i % 2 ? 'barracks' : 'archery-range', team: i % 2, complete: true },
      undefined, () => { loads++; return { texture, ready: Promise.resolve(true) }; });
  }
  await Promise.resolve();
  const bodyPasses = [], colorPasses = [];
  scene.traverse(child => {
    if (child.userData.buildingBodyDepth) bodyPasses.push(child);
    else if (child.isSprite) colorPasses.push(child);
  });
  assert.equal(loads, buildingLimit, 'adding depth must not trigger another image request');
  assert.equal(bodyPasses.length, buildingLimit); assert.equal(colorPasses.length, buildingLimit);
  assert.equal(new Set(bodyPasses.map(pass => pass.geometry)).size, 1);
  assert.equal(new Set(bodyPasses.map(pass => pass.material.map)).size, 1);
  assert.ok(bodyPasses.every(pass => pass.visible && pass.material.side === THREE.FrontSide),
    'one front-face draw, without the transparent DoubleSide two-draw path');
  scene.traverse(child => child.material?.dispose()); texture.dispose();
});

test('live Barracks updates advance the sprite through construction and damage for both teams', async () => {
  const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const updateSource = source.slice(source.indexOf('function updateBarracksVisual('),
    source.indexOf('\nfunction reconcileBuildings('));
  const context = vm.createContext({ THREE, barracksModelVisualState, groundHeight: () => .8,
    updateBuildingProductionCue() {}, updateBuildingHealthIndicator() {},
  });
  vm.runInContext(updateSource, context);
  for (const team of [0, 1]) {
    const group = new THREE.Group();
    const frame = new THREE.Group();
    const ridge = new THREE.Group();
    group.add(frame, ridge);
    const first = { type: 'barracks', team, progress: 0, x: 4, z: 8 };
    const load = (url) => ({ ready: Promise.resolve(true), texture: { url } });
    const authoredSprite = attachBuildingSprite(group, [frame, ridge], first, undefined, load);
    const visual = { group, frame, ridge, walls: [], roofPanels: [], finishPieces: [], authoredSprite };
    const sprite = group.children.find(child => child.isSprite);
    for (const state of [
      { progress: 0.1 }, { progress: 0.5 }, { progress: 1, complete: true },
      { progress: 1, complete: true, hp: 900, maxHp: 1800 },
      { progress: 1, complete: true, hp: 300, maxHp: 1800 },
    ]) {
      const building = { ...first, ...state };
      context.updateBarracksVisual(visual, building);
      await Promise.resolve();
      assert.equal(sprite.material.map.url, buildingSpriteUrl(building));
      assert.equal(sprite.visible, true);
      assert.equal(group.position.y, .8, 'building group follows its terrain height');
    }
  }
});
