import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
import { fishingVisualSites, fishingWaterContact, createWorkerFishingContactRuntime,
  FISHING_REACH_CONTACT_PX } from '../src/worker-fishing-contact.mjs';
import { createUnitSpriteRuntime } from '../src/unit-sprite-runtime.mjs';
import { isShoreFish } from '../src/shore-fishing.mjs';
import { WATER_LEVEL } from '../src/water-surface-geometry.mjs';
import { decodeRgba8 } from './sprite-pixel-bounds.mjs';
import { resourcePickingBindings, resourcePickingFunctionSource } from './resource-picking-fixture-bindings.mjs';

const map = JSON.parse(readFileSync(new URL('../maps/shore-fishing.json', import.meta.url)));
const pack = JSON.parse(readFileSync(new URL('../assets/units/cast-human-sprite-v3/sprite-atlas-pack-v1.json', import.meta.url)));
const worker = team => ({ id: team, team, slot: 0, kind: 'worker', hp: 100,
  serverX: -10.5, serverZ: 10.5, renderX: -10.5, renderZ: 10.5,
  workHeading: 3 * Math.PI / 4, angle: 3 * Math.PI / 4,
  workResourceVariant: 'shore-fish', task: 'gathering', performingAction: 'gather-food', cargoType: 'food', cargo: 0 });

test('rope begins on a visible net pixel in the approved reach key', () => {
  const image = decodeRgba8(readFileSync(new URL('../docs/art-direction/human-roster-v1/fishing-SE-v1/fishing-SE-01.png', import.meta.url)));
  const { x, y } = FISHING_REACH_CONTACT_PX;
  assert.ok(image.pixels[(y * image.width + x) * 4 + 3] >= 200, 'contact cannot float outside the net alpha');
});

test('water contact uses actual canonical target and current server bearing, without changing authority', () => {
  const unit = worker(0), before = structuredClone(unit);
  assert.deepEqual(fishingWaterContact(unit, map), fishingVisualSites(map)[0].water);
  assert.deepEqual(unit, before);
  for (const change of [{ hp: 0 }, { kind: 'infantry' }, { workHeading: null },
    { workHeading: Math.PI / 2 }, { workResourceVariant: null }, { performingAction: null }, { serverX: -18 }]) {
    assert.equal(fishingWaterContact({ ...unit, ...change }, map), null);
  }
  assert.deepEqual(fishingWaterContact(unit, structuredClone(map)), fishingWaterContact(unit, map));
  const ambiguous = structuredClone(map);
  ambiguous.resourceNodes.push({ ...map.resourceNodes[0], id: 'second-bank', x: -9.5, z: 10.5 });
  assert.equal(fishingWaterContact(unit, ambiguous), null, 'two matching bank identities cannot invent a contact');
});

test('actual four-key runtime contacts water only in reach and clears for Stop, movement, combat, fog and reuse', async () => {
  const savedFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => pack });
  class TextureLoader { load(url, done) { const t = new THREE.Texture(); queueMicrotask(() => done(t)); return t; } }
  try {
    const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-4, 4, 4, -4, .1, 100);
    camera.position.set(7.8, 11.2, 7.8); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true);
    const contact = createWorkerFishingContactRuntime({ THREE, scene, capacity: 2, getMap: () => map });
    const cueMeshes = scene.children.slice();
    const runtime = createUnitSpriteRuntime({ THREE: { ...THREE, TextureLoader }, scene, capacity: 2,
      teamHex: [0x5aa7d7, 0xe67a5e], cameraQuaternion: camera.quaternion, roles: ['human'],
      roleSpriteVersions: { human: 'v3' }, humanAppearancePreview: true, fishingContact: contact });
    const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
    const transforms = vm.createContext({ THREE, workerFishingContactRuntime: contact, unitSpriteRuntime: runtime,
      updateUnitHealthVisual: () => {}, SPAWN_POSE_MS: 300, DEFEAT_POSE_MS: 300,
      castPreview: true, unitSpritePreviewActive: true, unitSpritePreviewRoleSet: new Set(['worker']),
      unitPresentation: () => ({ role: 'boat' }), UNIT_DEFINITIONS: { skiff: { movementDomain: 'water' } },
      unitLowDetailActive: false, updateUnitLodTransform: () => {}, dummy: new THREE.Object3D(),
      facing: new THREE.Quaternion(), worldUp: new THREE.Vector3(0, 1, 0), unitArtMeshes: [],
      boatMeshes: [{ setMatrixAt: () => {} }, { setMatrixAt: () => {} }], updateUnitFocusVisual: () => {},
    });
    vm.runInContext(main.slice(main.indexOf('function updateUnitTransform('), main.indexOf('\nfunction setArmySize(')), transforms);
    runtime.setCount(0, 1); runtime.setCount(1, 1); runtime.setVisible(true);
    assert.equal(await runtime.ready, true);
    for (const team of [0, 1]) {
      const unit = worker(team), rope = cueMeshes[team * 2], rim = cueMeshes[team * 2 + 1];
      const actor = scene.children[4 + team];
      runtime.update(unit, 1000, .94);
      const first = new THREE.Matrix4(); actor.getMatrixAt(0, first);
      assert.equal(rope.visible, false, 'crouch does not fake water contact');
      runtime.update(unit, 1350, .94);
      assert.equal(rope.visible, true); assert.equal(rim.visible, true);
      const rimMatrix = new THREE.Matrix4(), point = new THREE.Vector3(); rim.getMatrixAt(0, rimMatrix);
      point.setFromMatrixPosition(rimMatrix);
      assert.ok(point.distanceTo(new THREE.Vector3(-9.5, WATER_LEVEL + .012, 9.5)) < 1e-6);
      const ropeMatrix = new THREE.Matrix4(); rope.getMatrixAt(0, ropeMatrix);
      const endpoint = new THREE.Vector3(0, .5, 0).applyMatrix4(ropeMatrix);
      assert.ok(endpoint.distanceTo(point) < 1e-6, 'actual rope geometry reaches canonical water');
      runtime.update(unit, 1650, .94); assert.equal(rope.visible, false, 'retrieve remains on bank');
      runtime.update(unit, 2000, .94); assert.equal(rope.visible, false, 'collect remains on bank');
      runtime.update(unit, 2300, .94); assert.equal(rope.visible, false, 'wrap retains crouch root');
      const wrapped = new THREE.Matrix4(); actor.getMatrixAt(0, wrapped);
      assert.deepEqual(wrapped.elements, first.elements, 'contact cannot move the actor root at wrap');
      for (const change of [{ performingAction: null }, { workResourceVariant: null, task: 'idle' }, { walking: true },
        { attackStartedAt: 2600 }, { hp: 0, defeatStartedAt: 2600 }, { kind: 'infantry' },
        { angle: Math.PI / 2 }]) {
        const active = worker(team);
        runtime.update(active, 1000, .94);
        runtime.update(active, 1350, .94); assert.equal(rope.visible, true);
        runtime.update({ ...active, ...change }, 2650, .94); assert.equal(rope.visible, false);
      }
      const active = worker(team);
      runtime.update(active, 1000, .94);
      runtime.update(active, 1350, .94); runtime.update(active, 1400, 0); assert.equal(rope.visible, false);
      runtime.update(active, 1350, .94); runtime.setVisible(false); assert.equal(rope.visible, false);
      runtime.setVisible(true);
      transforms.updateUnitTransform({ ...active, kind: 'skiff', scale: .94 }, 1400);
      assert.equal(rope.visible, false, 'actual Skiff transform clears a recycled Worker cue before its early return');
      assert.equal(rim.visible, false);
      runtime.update(active, 1350, .94); assert.equal(rope.visible, true);
      runtime.setCount(team, 0); assert.equal(rope.visible, false);
      assert.equal(unit.cargo, 0); assert.equal(unit.cargoType, 'food');
      runtime.setCount(team, 1);
    }
  } finally { globalThis.fetch = savedFetch; }
});

test('bank ring and water glyph pick the same land resource, retaining current fog-only policy', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const node = map.resourceNodes[0], water = fishingVisualSites(map)[0].water;
  const camera = new THREE.OrthographicCamera(-7, 7, 4.375, -4.375, .1, 100);
  camera.position.set(-2.7, 11.2, 17.3); camera.lookAt(-10.5, 0, 9.5); camera.updateMatrixWorld(true);
  const fog = new Uint8Array(map.width * map.height).fill(2);
  const context = vm.createContext({ ...resourcePickingBindings(), THREE, isShoreFish, localTeam: 0, mapDefinition: map,
    MAP_WIDTH: map.width, MAP_HEIGHT: map.height, camera, screenPoint: new THREE.Vector3(),
    resourceNodeVisuals: new Map([[node.id, { fishingWater: water }]]), latestBuildings: [], latestResourceStocks: new Map(),
    latestFogCells: fog, wildlifeRenderer: { isAvailable: () => true },
    groundHeight: () => 0, renderer: { domElement: { getBoundingClientRect: () => ({ width: 1280, height: 800 }) } },
  });
  vm.runInContext(resourcePickingFunctionSource(main), context);
  const screen = point => { const p = new THREE.Vector3(point.x, .22, point.z).project(camera); return [(p.x*.5+.5)*1280,(-p.y*.5+.5)*800]; };
  assert.equal(context.pickResourceNodeAt(...screen(node)), node);
  assert.equal(context.pickResourceNodeAt(...screen(water)), node);
  fog[water.row * map.width + water.column] = 0;
  assert.equal(context.pickResourceNodeAt(...screen(water), { visibleOnly: true }), null);
  assert.equal(context.pickResourceNodeAt(...screen(node), { visibleOnly: true }), node);
  // A real body hit outside the point radius must exercise the new Farm branch.
  const farm = { id: 77, type: 'farm', team: 0, complete: true, hp: 600,
    x: node.x + 4, z: node.z, harvestStock: 200 };
  const geometry = new THREE.BoxGeometry(3, 2, 3), material = new THREE.MeshBasicMaterial();
  const group = new THREE.Group(); group.position.set(farm.x, 1, farm.z);
  group.add(new THREE.Mesh(geometry, material));
  context.latestBuildings.push(farm); context.buildingVisuals.set(farm.id, { group });
  try {
    const point = new THREE.Vector3(farm.x + 1.2, 1, farm.z).project(camera);
    const body = [(point.x * .5 + .5) * 1280, (-point.y * .5 + .5) * 800];
    assert.ok(Math.hypot(body[0] - screen(farm)[0], body[1] - screen(farm)[1]) > 26);
    assert.equal(context.pickResourceNodeAt(...body).id, 'farm:77');
    farm.harvestStock = 0;
    assert.equal(context.pickResourceNodeAt(...body).stock, 0, 'authority retains the exhausted stock refusal');
    farm.team = 1; assert.equal(context.pickResourceNodeAt(...body), null);
    farm.team = 0; farm.complete = false; assert.equal(context.pickResourceNodeAt(...body), null);
    farm.complete = true; group.visible = false;
    assert.equal(context.pickResourceNodeAt(...body, { visibleOnly: true }), null);
    group.visible = true;
    assert.equal(context.pickResourceNodeAt(...body, { inspectableWildlifeOnly: true }), null);
  } finally { geometry.dispose(); material.dispose(); }
});
