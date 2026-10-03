import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildWaterStudyField, selectWaterStudyFish, waterStudyTime, WATER_STUDY_FISH_LIMIT } from '../src/water-study-state.mjs';
import { createWaterSurfaceStudy, waterStudyOptions } from '../src/water-surface-study.mjs';
import { buildWaterSurfaceGeometry } from '../src/water-surface-geometry.mjs';
import { findInvalidResourceVariant } from '../src/shore-fishing.mjs';

const fish = { id: 'bank-fish', type: 'food', resourceVariant: 'shore-fish', x: -1.5, z: -.5, stock: 22.5 };
const map = () => ({ width: 8, height: 8, terrainSeed: 17, terrainBase: 'meadow',
  obstacles: [{ column: 3, row: 1, width: 4, height: 6, material: 'water' }],
  resourceNodes: [{ ...fish }] });
const visible = () => ({ resourceNodes: [{ ...fish }], visibleResourceIds: ['bank-fish'], visibleWaterCells: [27] });
function dispose(mesh) {
  mesh.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
  for (const texture of mesh.userData.ownedGroundTextures || []) texture.dispose();
}

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

test('explicit opt-in, finite fixed time, reduced motion and low quality preserve fallbacks', () => {
  assert.equal(waterStudyOptions('').enabled, false);
  assert.equal(waterStudyOptions('?waterStudy=garbage').enabled, false);
  assert.equal(waterStudyOptions('?waterStudy=1').enabled, true);
  assert.equal(waterStudyOptions('?waterStudyTime=').fixedTime, null);
  assert.equal(waterStudyOptions('?waterStudyTime=Infinity').fixedTime, null);
  assert.equal(waterStudyOptions('?waterStudyTime=0').fixedTime, 0);
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
