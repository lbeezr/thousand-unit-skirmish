import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildWaterStudyField, selectWaterStudyFish, waterStudyTime, WATER_STUDY_FISH_LIMIT } from '../src/presentation/rendering/water/state.mjs';
import { createWaterSurfaceStudy, waterSurfaceOptions } from '../src/presentation/rendering/water/surface.mjs';
import { createWaterStudyFishBinding } from '../src/presentation/rendering/water/fish-binding.mjs';
import { buildWaterSurfaceGeometry } from '../src/presentation/rendering/water/geometry.mjs';
import { findInvalidResourceVariant } from '../src/shore-fishing.mjs';
import { createGroundSurfaceBuilder } from '../src/presentation/rendering/ground-surfaces.mjs';

const fish = { id: 'bank-fish', type: 'food', resourceVariant: 'shore-fish', x: -1.5, z: -.5, stock: 22.5 };
const map = () => ({ width: 8, height: 8, terrainSeed: 17, terrainBase: 'meadow',
  obstacles: [{ column: 3, row: 1, width: 4, height: 6, material: 'water' }],
  resourceNodes: [{ ...fish }] });
const visible = () => ({ resourceNodes: [{ ...fish }], visibleResourceIds: ['bank-fish'], visibleWaterCells: [27] });
function dispose(mesh) {
  mesh.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
  for (const texture of mesh.userData.ownedGroundTextures || []) texture.dispose();
}

test('canonical ground builder defers host policy and query reads until surface creation', () => {
  const original = globalThis.location, calls = [];
  const texture = new THREE.Texture();
  try {
    globalThis.location = { get search() { calls.push('query'); return '?terrainTiling=mirror'; } };
    const build = createGroundSurfaceBuilder({
      groundBaseMaterial(definition) { calls.push(['base', definition]); return 'meadow'; },
      groundTexture(material, definition, variant) { calls.push(['texture', material, definition, variant]); return texture; },
    });
    assert.deepEqual(calls, [], 'factory creation does not read queries or call texture/base policy');
    assert.equal(build.name, 'createGroundSurfaces'); assert.equal(build.length, 1);
    const definition = { width: 2, height: 2, obstacles: [] };
    const surfaces = build(definition);
    assert.deepEqual(calls[0], ['base', definition], 'base selection remains before query evaluation');
    assert.equal(surfaces.length, 1);
    assert.equal(surfaces[0].material.map, texture, 'shared host texture identity is retained');
    assert.deepEqual(Array.from(surfaces[0].geometry.getAttribute('position').array),
      Array.from(new Float32Array([-1, -.025, -1, 1, -.025, -1, -1, -.025, 1, 1, -.025, 1])));
    assert.deepEqual(Array.from(surfaces[0].geometry.getAttribute('uv').array),
      Array.from(new Float32Array([0, 0, 2 / 12, 0, 0, 2 / 12, 2 / 12, 2 / 12])));
    assert.deepEqual(Array.from(surfaces[0].geometry.index.array), [0, 3, 1, 0, 2, 3]);
    assert.equal(surfaces[0].userData.terrainSurface, true);
    dispose(surfaces[0]);
  } finally {
    texture.dispose();
    if (original === undefined) delete globalThis.location; else globalThis.location = original;
  }
});

test('canonical ground builder keeps blend clones owned and cached source textures shared', () => {
  const original = globalThis.location;
  const shared = new Map();
  let sharedDisposals = 0;
  const surfaces = [];
  try {
    globalThis.location = { search: '?terrainTiling=mirror' };
    const build = createGroundSurfaceBuilder({ groundBaseMaterial: () => 'meadow', groundTexture(material) {
      if (!shared.has(material)) {
        const texture = new THREE.Texture(); texture.addEventListener('dispose', () => sharedDisposals++);
        shared.set(material, texture);
      }
      return shared.get(material);
    } });
    surfaces.push(...build({ width: 4, height: 4, terrainPatches: [
      { column: 0, row: 0, width: 2, height: 4, material: 'sand' },
    ], obstacles: [] }));
    const blend = surfaces.find(surface => surface.userData.ownedGroundTextures);
    assert.ok(blend);
    const [clone, mask] = blend.userData.ownedGroundTextures;
    assert.notEqual(clone, shared.get('sand')); assert.equal(blend.material.map, clone);
    assert.equal(blend.material.alphaMap, mask);
    assert.deepEqual([clone.repeat.x, clone.repeat.y], [4 / 12, 4 / 12]);
    assert.equal(blend.renderOrder, -20); assert.equal(blend.material.depthWrite, false);
    let ownedDisposals = 0;
    for (const texture of [clone, mask]) texture.addEventListener('dispose', () => ownedDisposals++);
    for (const surface of surfaces) dispose(surface);
    assert.equal(ownedDisposals, 2); assert.equal(sharedDisposals, 0, 'map teardown does not own cached textures');
  } finally {
    for (const texture of shared.values()) texture.dispose();
    if (original === undefined) delete globalThis.location; else globalThis.location = original;
  }
});

test('canonical ground builder retains the water preference callback until material disposal', () => {
  const original = { location: globalThis.location, matchMedia: globalThis.matchMedia };
  const listeners = new Set();
  let registered, removed;
  const motion = { matches: false,
    addEventListener(type, callback) { assert.equal(type, 'change'); registered = callback; listeners.add(callback); },
    removeEventListener(type, callback) { assert.equal(type, 'change'); removed = callback; listeners.delete(callback); } };
  const texture = new THREE.Texture();
  const surfaces = [];
  try {
    globalThis.location = { search: '' }; globalThis.matchMedia = () => motion;
    const build = createGroundSurfaceBuilder({ groundBaseMaterial: () => 'meadow', groundTexture: () => texture });
    assert.equal(listeners.size, 0);
    surfaces.push(...build(map()));
    const water = surfaces.find(surface => surface.userData.waterStudy);
    assert.equal(water.renderOrder, 5); assert.equal(listeners.size, 1);
    registered({ matches: true }); water.userData.updateWaterStudy(19);
    assert.equal(water.material.uniforms.time.value, 0);
    registered({ matches: false }); water.userData.updateWaterStudy(19);
    assert.equal(water.material.uniforms.time.value, 19);
    water.material.dispose(); assert.equal(removed, registered); assert.equal(listeners.size, 0);
  } finally {
    for (const surface of surfaces) dispose(surface);
    texture.dispose();
    for (const key of ['location', 'matchMedia']) {
      if (original[key] === undefined) delete globalThis[key]; else globalThis[key] = original[key];
    }
  }
});

test('cosmetic field grades real shore distance without mutating map or creating bathymetry', () => {
  const definition = { width: 12, height: 12, obstacles: [{ column: 1, row: 1, width: 10, height: 10, material: 'water' }] };
  const before = structuredClone(definition), field = buildWaterStudyField(definition);
  assert.deepEqual(definition, before);
  assert.equal(field.pixels.length, 12 * 12 * 4);
  assert.equal(field.pixels[0], 0);
  assert.equal(field.distance[13], 1);
  assert.ok(field.pixels[65 * 4 + 1] > field.pixels[13 * 4 + 1]);
  assert.ok([...field.pixels].every(Number.isFinite));
  assert.throws(() => buildWaterStudyField({ width: 1024, height: 1024 }), /bounded/);
});

test('map edges are not invented shores; interior islands remain dry', () => {
  const allWet = { width: 4, height: 4, obstacles: [{ column: 0, row: 0, width: 4, height: 4, material: 'water' }] };
  const field = buildWaterStudyField(allWet);
  for (let i = 0; i < 16; i++) assert.equal(field.pixels[i * 4 + 1], 255);
  const island = { width: 7, height: 7, obstacles: [] };
  for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) if (r !== 3 || c !== 3) {
    island.obstacles.push({ column: c, row: r, width: 1, height: 1, material: 'water' });
  }
  const around = buildWaterStudyField(island);
  assert.equal(around.cells[24], 0);
  assert.equal(around.pixels[24 * 4 + 1], 0);
  assert.equal(around.distance[23], 1);
});

test('study preserves original contour buffers, height and non-picking surface', () => {
  const definition = map(), before = structuredClone(definition);
  const original = buildWaterSurfaceGeometry(definition), study = createWaterSurfaceStudy(definition);
  assert.deepEqual(study.geometry.attributes.position.array, original.attributes.position.array);
  assert.deepEqual(study.geometry.index.array, original.index.array);
  assert.deepEqual(definition, before);
  assert.equal(study.userData.waterStudy.apparentDepthOnly, true);
  const raycaster = new THREE.Raycaster(new THREE.Vector3(-.5, 10, -.5), new THREE.Vector3(0, -1, 0));
  assert.deepEqual(raycaster.intersectObject(study, true), []);
  assert.equal(study.material.uniforms.shoreField.value.colorSpace, THREE.NoColorSpace);
  for (const material of [study.material, study.children[0].material]) {
    assert.equal(material.fog, true);
    assert.ok(material.uniforms.fogColor.value.isColor, 'shared fog uniforms support existing scene-distance fog');
  }
  original.dispose(); dispose(study);
});

test('default surface, finite fixed time, reduced motion and explicit low quality preserve fallbacks', () => {
  assert.deepEqual(waterSurfaceOptions(''), { quality: 'study', reducedMotion: false, fixedTime: null });
  assert.deepEqual(waterSurfaceOptions('?waterStudy=0'), waterSurfaceOptions(''), 'retired permission toggle has no effect');
  assert.equal(waterSurfaceOptions('?waterTime=').fixedTime, null);
  assert.equal(waterSurfaceOptions('?waterTime=Infinity').fixedTime, null);
  assert.equal(waterSurfaceOptions('?waterTime=0').fixedTime, 0);
  assert.equal(waterSurfaceOptions('?waterQuality=low').quality, 'low');
  assert.equal(waterSurfaceOptions('?waterStudyQuality=low').quality, 'low', 'existing static-quality links keep working');
  assert.equal(waterSurfaceOptions('?waterQuality=study&waterStudyQuality=low').quality, 'study');
  assert.equal(waterSurfaceOptions('?waterTime=16&waterStudyTime=12').fixedTime, 16);
  assert.equal(waterSurfaceOptions('?waterStudyTime=12').fixedTime, 12);
  assert.equal(waterSurfaceOptions('', true).reducedMotion, true);
  assert.equal(waterStudyTime(90, { fixedTime: 12 }), 12);
  assert.equal(waterStudyTime(90, { fixedTime: 12, reducedMotion: true }), 0);
  assert.equal(waterStudyTime(NaN), 0);
  const low = createWaterSurfaceStudy(map(), { quality: 'low' });
  assert.equal(low.material.isMeshBasicMaterial, true);
  assert.equal(low.children.length, 0);
  assert.equal(low.userData.ownedGroundTextures, undefined);
  assert.deepEqual(low.userData.updateWaterStudyFish(visible()), []);
  dispose(low);
});

test('fish require live finite food stock and explicit bank AND water visibility', () => {
  const definition = map();
  assert.equal(findInvalidResourceVariant(definition), null);
  assert.deepEqual(selectWaterStudyFish(definition), []);
  assert.deepEqual(selectWaterStudyFish(definition, { ...visible(), resourceNodes: [] }), []);
  for (const key of ['visibleResourceIds', 'visibleWaterCells']) {
    assert.deepEqual(selectWaterStudyFish(definition, { ...visible(), [key]: [] }), []);
  }
  for (const stock of [0, -1, NaN, Infinity, undefined]) {
    assert.deepEqual(selectWaterStudyFish(definition, { ...visible(), resourceNodes: [{ ...fish, stock }] }), []);
  }
  for (const node of [{ ...fish, resourceVariant: undefined }, { ...fish, type: 'wood' }, { ...fish, wildlifeSpecies: 'bellweather-sheep' }]) {
    assert.deepEqual(selectWaterStudyFish(definition, { ...visible(), resourceNodes: [node] }), []);
  }
});

test('one-cell water envelope and reachable bank stay separate and phases repeat', () => {
  const definition = map(), snapshot = visible(), before = structuredClone(snapshot);
  const [school] = selectWaterStudyFish(definition, snapshot);
  assert.equal(school.waterCell, 27);
  assert.equal(school.approachX, fish.x); assert.equal(school.approachZ, fish.z);
  assert.equal(school.x, -.5); assert.equal(school.z, -.5);
  assert.ok(.72 * .46 < .5, 'animated circle remains within its selected water cell');
  assert.deepEqual(selectWaterStudyFish(definition, snapshot), [school]);
  assert.deepEqual(snapshot, before);
  const raised = map(); raised.elevationPatches = [{ column: 3, row: 3, width: 1, height: 1, level: 1 }];
  assert.deepEqual(selectWaterStudyFish(raised, snapshot), []);
  const blocked = map(); blocked.obstacles.push({ column: 2, row: 3, width: 1, height: 1, material: 'stone' });
  assert.deepEqual(selectWaterStudyFish(blocked, snapshot), []);
});

test('depletion, fog removal and reduced motion immediately clear active ripple instances', () => {
  const study = createWaterSurfaceStudy(map(), { fixedTime: 12 }), ripples = study.children[0];
  assert.equal(ripples.count, 0); assert.equal(ripples.visible, false);
  study.userData.updateWaterStudyFish(visible());
  assert.equal(ripples.count, 1); assert.equal(ripples.visible, true);
  study.userData.updateWaterStudy(999);
  assert.equal(study.material.uniforms.time.value, 12);
  assert.equal(ripples.material.uniforms.time.value, 12);
  study.userData.updateWaterStudyFish({ ...visible(), visibleWaterCells: [] });
  assert.equal(ripples.count, 0); assert.equal(ripples.visible, false);
  study.userData.updateWaterStudyFish(visible());
  study.userData.updateWaterStudyFish({ ...visible(), resourceNodes: [{ ...fish, stock: 0 }] });
  assert.equal(ripples.count, 0); assert.equal(ripples.visible, false);
  study.userData.updateWaterStudyFish(visible()); study.userData.setWaterStudyMotion(true); study.userData.updateWaterStudy(3);
  assert.equal(study.material.uniforms.time.value, 0);
  assert.equal(ripples.visible, false);
  assert.equal(ripples.material.uniforms.motion.value, 0);
  dispose(study);
});

test('visible schools have a stable bounded instance budget independent of snapshot order', () => {
  const definition = map();
  definition.resourceNodes = Array.from({ length: 40 }, (_, i) => ({ ...fish, id: `fish-${String(i).padStart(2, '0')}` }));
  const snapshot = { resourceNodes: [...definition.resourceNodes].reverse(),
    visibleResourceIds: definition.resourceNodes.map(n => n.id), visibleWaterCells: [27] };
  const schools = selectWaterStudyFish(definition, snapshot);
  assert.equal(schools.length, WATER_STUDY_FISH_LIMIT);
  assert.deepEqual(selectWaterStudyFish(definition, { ...snapshot, resourceNodes: [...snapshot.resourceNodes].reverse() }), schools);
});

test('actual ground factory selects default water and live fish, with static/reduced-motion cleanup', async () => {
  // Stub image/network delivery only: exercise the actual ground factory,
  // Three materials, ownership and motion callbacks without claiming pixels.
  const original = { load: THREE.TextureLoader.prototype.load, fetch: globalThis.fetch,
    location: globalThis.location, matchMedia: globalThis.matchMedia, warn: console.warn };
  const listeners = new Set();
  const motion = { matches: false, addEventListener(_type, callback) { listeners.add(callback); },
    removeEventListener(_type, callback) { listeners.delete(callback); } };
  const surfaces = [];
  try {
    THREE.TextureLoader.prototype.load = () => new THREE.Texture();
    globalThis.fetch = async () => ({ ok: false, status: 404 });
    globalThis.location = { search: '' };
    globalThis.matchMedia = () => motion;
    console.warn = () => {};
    const { createGroundSurfaces, resourceStateAssetsReady } = await import('../src/environment-art.mjs');
    await resourceStateAssetsReady;
    console.warn = original.warn;
    const definition = { ...map(), id: 'default-fish', fogOfWar: false, terrainPatches: [] };
    const defaults = createGroundSurfaces(definition); surfaces.push(...defaults);
    const water = defaults.find(surface => surface.userData.waterStudy);
    assert.ok(water.material.isShaderMaterial, 'ordinary map needs no preview query');
    const binding = createWaterStudyFishBinding(definition, water);
    binding.update({ mapId: definition.id, fogOfWar: false, visibility: null,
      resourceNodes: [{ id: fish.id, type: 'food', resourceVariant: 'shore-fish', stock: 1 }] });
    assert.equal(water.children[0].count, 1, 'default ground supports current match fish activity');
    for (const listener of listeners) listener({ matches: true });
    water.userData.updateWaterStudy(12);
    assert.equal(water.material.uniforms.time.value, 0);
    assert.equal(water.children[0].visible, false);
    for (const listener of listeners) listener({ matches: false });
    water.userData.updateWaterStudy(12);
    assert.equal(water.children[0].visible, true);
    water.material.dispose(); assert.equal(listeners.size, 0, 'map disposal removes preference listener');
    globalThis.location.search = '?waterQuality=low';
    const lowSurfaces = createGroundSurfaces(definition); surfaces.push(...lowSurfaces);
    const low = lowSurfaces.find(surface => surface.userData.waterStudy);
    assert.equal(low.material.isMeshBasicMaterial, true);
    assert.equal(low.children.length, 0); assert.equal(low.userData.ownedGroundTextures, undefined);
    const geometry = buildWaterSurfaceGeometry(definition);
    assert.deepEqual(low.geometry.attributes.position.array, geometry.attributes.position.array);
    geometry.dispose();
    motion.matches = true; globalThis.location.search = '';
    const reducedSurfaces = createGroundSurfaces(definition); surfaces.push(...reducedSurfaces);
    const reduced = reducedSurfaces.find(surface => surface.userData.waterStudy);
    reduced.userData.updateWaterStudy(12);
    assert.equal(reduced.material.uniforms.time.value, 0, 'initial OS preference is respected');
  } finally {
    for (const surface of surfaces) dispose(surface);
    THREE.TextureLoader.prototype.load = original.load; globalThis.fetch = original.fetch;
    if (original.location === undefined) delete globalThis.location; else globalThis.location = original.location;
    if (original.matchMedia === undefined) delete globalThis.matchMedia; else globalThis.matchMedia = original.matchMedia;
    console.warn = original.warn;
  }
  assert.equal(listeners.size, 0);
});
