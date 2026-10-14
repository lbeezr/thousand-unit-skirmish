import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import { terrainHeightField } from '../src/terrain-height.mjs';
import { battlefieldSurroundEnabled, buildBattlefieldSurroundGeometry, createBattlefieldSurround } from '../src/presentation/rendering/battlefield-surround.mjs';

const vale = JSON.parse(readFileSync(new URL('../maps/veyrholds-terraced-vale.json', import.meta.url)));
function dispose(group) {
  group.traverse(mesh => { mesh.geometry?.dispose(); mesh.material?.dispose(); });
}

test('normal Terraced Vale alone selects the scenery; no map or simulation data changes', () => {
  const before = JSON.stringify(vale);
  assert.equal(battlefieldSurroundEnabled(vale), true);
  for (const map of [{ ...vale, id: 'veyrholds-crownroads' }, { ...vale, region: 'bellweather' }]) {
    assert.equal(createBattlefieldSurround(map), null);
  }
  const surround = createBattlefieldSurround(vale);
  assert.equal(JSON.stringify(vale), before);
  assert.equal(surround.children.length, 2, 'one land batch and one static cloud batch');
  assert.equal(surround.userData.battlefieldSurround.cloudMotion, 'static');
  dispose(surround);
});

test('scenic triangles have a real playable-area hole and the lip follows every terrain edge cell', () => {
  const geometry = buildBattlefieldSurroundGeometry(vale);
  const p = geometry.attributes.position, terrain = terrainHeightField(vale);
  assert.equal(p.count, 7680);
  assert.equal(geometry.index.count / 3, 12804, 'four cliff transitions have closure faces');
  for (let i = 0; i < p.count; i++) {
    assert.ok(Number.isFinite(p.getY(i)));
    assert.ok(Math.abs(p.getX(i)) >= 80 || Math.abs(p.getZ(i)) >= 80, 'no scenic vertex inside the match');
  }
  const expected = [];
  for (let x = 0; x < 160; x++) { const h = terrain.corners(x, 0); expected.push([h[0], h[1]]); }
  for (let z = 0; z < 160; z++) { const h = terrain.corners(159, z); expected.push([h[1], h[3]]); }
  for (let x = 159; x >= 0; x--) { const h = terrain.corners(x, 159); expected.push([h[3], h[2]]); }
  for (let z = 159; z >= 0; z--) { const h = terrain.corners(0, z); expected.push([h[2], h[0]]); }
  const { start, segments } = geometry.userData.battlefieldLip;
  assert.equal(segments, expected.length);
  for (let i = 0; i < segments; i++) for (let j = 0; j < 2; j++) {
    assert.ok(Math.abs(p.getY(start + i * 2 + j) - expected[i][j] + .025) < 1e-6,
      `each cell owns its actual corner pair, including discontinuous segment ${i}`);
  }
  for (let i = 0; i < geometry.index.count; i += 3) {
    const triangle = [0, 1, 2].map(j => geometry.index.getX(i + j));
    const x = triangle.reduce((sum, j) => sum + p.getX(j), 0) / 3;
    const z = triangle.reduce((sum, j) => sum + p.getZ(j), 0) / 3;
    assert.ok(Math.abs(x) >= 80 || Math.abs(z) >= 80, 'no scenic triangle crosses the playable area');
  }
  assert.ok(geometry.boundingSphere.radius < 900, 'bounded scenic geometry');
  geometry.dispose();
});

test('the seeded scenery is repeatable, has irregular declining relief and fades to the backdrop', () => {
  const a = buildBattlefieldSurroundGeometry(vale), b = buildBattlefieldSurroundGeometry(vale);
  assert.deepEqual(a.attributes.position.array, b.attributes.position.array);
  const other = buildBattlefieldSurroundGeometry({ ...vale, terrainSeed: vale.terrainSeed + 1 });
  assert.notDeepEqual(a.attributes.position.array, other.attributes.position.array);
  const p = a.attributes.position;
  const terrain = terrainHeightField(vale), lipStart = a.userData.battlefieldLip.start;
  for (let i = 0; i < lipStart; i++) {
    const lip = lipStart + (i % 640) * 2;
    assert.ok(p.getY(i) < terrain.sample(p.getX(lip), p.getZ(lip)), 'outer scenery stays below its adjoining terrain');
  }
  const distances = Array.from({ length: 640 }, (_, i) => Math.max(
    Math.abs(p.getX(i + 640)) - 80, Math.abs(p.getZ(i + 640)) - 80));
  assert.ok(Math.max(...distances) - Math.min(...distances) > .3, 'outer terrain breaks the ruler-straight rim');
  assert.ok(a.attributes.surroundHaze.getX(0) < .01);
  assert.equal(a.attributes.surroundHaze.getX(lipStart - 1), 1);
  for (const geometry of [a, b, other]) geometry.dispose();
});

test('both scenic batches refuse ray picks; clouds are below ground, bounded and never modify depth', () => {
  const surround = createBattlefieldSurround(vale);
  const ray = new THREE.Raycaster(new THREE.Vector3(90, 100, 0), new THREE.Vector3(0, -1, 0));
  assert.deepEqual(ray.intersectObject(surround, true), []);
  for (const child of surround.children) assert.equal(child.userData.terrainSurface, undefined);
  const clouds = surround.children[1], p = clouds.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    assert.equal(p.getY(i), -7);
    assert.ok(Math.abs(p.getX(i)) > 80 || Math.abs(p.getZ(i)) > 80);
  }
  assert.equal(clouds.material.depthWrite, false);
  assert.equal(clouds.material.transparent, true);
  assert.equal(clouds.material.uniforms.time, undefined, 'no animation clock or reduced-motion dependency');
  assert.ok(clouds.renderOrder > surround.children[0].renderOrder && clouds.renderOrder < -20);
  dispose(surround);
});

test('painted scree uses the shared atlas contract and owns no extra image or texture', () => {
  const texture = new THREE.Texture();
  const surround = createBattlefieldSurround(vale, { texture });
  const land = surround.children[0];
  assert.equal(land.material.map, texture);
  assert.equal(land.userData.ownedGroundTextures, undefined);
  assert.equal(land.material.fog, false);
  const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.basic.vertexShader, fragmentShader: THREE.ShaderLib.basic.fragmentShader };
  land.material.onBeforeCompile(shader);
  assert.match(shader.vertexShader, /vSurroundHaze = surroundHaze/);
  assert.match(shader.fragmentShader, /mix\(diffuseColor.rgb, surroundSky, vSurroundHaze\)/);
  assert.equal(shader.uniforms.surroundSky.value.getHex(), 0x8c9ca0);
  dispose(surround); texture.dispose();
});
