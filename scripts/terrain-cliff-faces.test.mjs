import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { buildTerrainCliffGeometry, createTerrainCliffFaces } from '../src/terrain-cliff-faces.mjs';
import { terrainHeightField } from '../src/terrain-height.mjs';
import { buildElevationGrid } from '../src/map-utils.mjs';

const root = new URL('../', import.meta.url);
const vale = JSON.parse(await readFile(new URL('maps/veyrholds-terraced-vale.json', root)));
const atlas = JSON.parse(await readFile(new URL('assets/environment/frontier-painted-material-atlas-v1/manifest.json', root)));
const positionHash = geometry => createHash('sha256').update(Buffer.from(geometry.attributes.position.array.buffer)).digest('hex');
// Measured from the original untextured normal renderer at 0fc2e9b8.
const valeBaseline = 'fef64ba2e212a89a674072006ed12d1c9b54f634cb992aef3e824b24b8c8d8f5';

test('actual Terraced Vale cliff triangles preserve the baseline and authoritative elevation', () => {
  const before = JSON.stringify(vale), levels = buildElevationGrid(vale.width, vale.height, vale.elevationPatches);
  const geometry = buildTerrainCliffGeometry(vale, 'scree');
  assert.equal(geometry.attributes.position.count, 1704);
  assert.equal(positionHash(geometry), valeBaseline, 'the original local vertices and triangle layout remain');
  assert.equal(JSON.stringify(vale), before, 'rendering cannot edit the map');
  assert.deepEqual(terrainHeightField(vale).levels, levels);
  for (const attribute of Object.values(geometry.attributes)) {
    assert.equal(attribute.count, 1704); assert.ok(attribute.array.every(Number.isFinite));
  }
  const fallback = buildTerrainCliffGeometry(vale, 'scree', false);
  assert.equal(positionHash(fallback), valeBaseline);
  assert.deepEqual([...fallback.attributes.normal.array], [...geometry.attributes.normal.array]);
  assert.equal(fallback.attributes.uv, undefined);
  geometry.dispose(); fallback.dispose();
});

test('face texel density never normalizes to wall height and phases agree across cells/corners', () => {
  const geometry = buildTerrainCliffGeometry(vale, 'scree');
  const { position: p, uv, cliffEdgeDistances: edges } = geometry.attributes;
  const phases = new Map(); let verticalPairs = 0, orthogonalCorners = 0;
  for (let i = 0; i < p.count; i++) {
    assert.ok(Math.abs(uv.getX(i) * 12 - p.getX(i) - p.getZ(i) - 160) < 1e-5);
    assert.ok(Math.abs(uv.getY(i) * 12 - p.getY(i)) < 1e-6);
    assert.ok(edges.getX(i) >= 0 && edges.getY(i) >= 0);
    assert.ok(edges.getX(i) === 0 || edges.getY(i) === 0, 'original vertices stay on one lip');
    const key = [p.getX(i), p.getY(i), p.getZ(i)].join(',');
    const normal = [geometry.attributes.normal.getX(i), geometry.attributes.normal.getZ(i)].join(',');
    if (phases.has(key)) {
      const previous = phases.get(key);
      assert.deepEqual([uv.getX(i), uv.getY(i)], previous.uv);
      if (previous.normal !== normal) orthogonalCorners++;
    } else phases.set(key, { uv: [uv.getX(i), uv.getY(i)], normal });
    if (i % 6 === 0) {
      assert.equal(uv.getX(i + 5), uv.getX(i));
      assert.ok(Math.abs((uv.getY(i) - uv.getY(i + 5)) * 12 - p.getY(i) + p.getY(i + 5)) < 1e-6);
      verticalPairs++;
    }
  }
  assert.ok(verticalPairs > 0 && orthogonalCorners > 0);
  geometry.dispose();
});

test('flat terrain and smooth ramps gain no wall; uncovered regions retain their plain material', () => {
  const flat = { width: 8, height: 8, terrainBase: 'scree', obstacles: [] };
  const ramp = { ...flat, elevationPatches: [{ column: 0, row: 0, width: 4, height: 8, level: 1 }] };
  for (const map of [flat, ramp]) assert.equal(createTerrainCliffFaces(map, { base: 'scree', texture: new THREE.Texture() }), null);
  const fallback = createTerrainCliffFaces(vale, { base: 'cinder' });
  assert.equal(fallback.material.type, 'MeshStandardMaterial');
  assert.equal(fallback.material.roughness, 1); assert.equal(fallback.material.map, null);
  assert.equal(fallback.material.side, THREE.DoubleSide); assert.equal(fallback.material.depthWrite, true);
  assert.equal(fallback.userData.terrainSurface, undefined, 'walls never replace the walkable picking surface');
  fallback.geometry.dispose(); fallback.material.dispose();
});

test('normal ground factory binds existing scree with cap5 sampling and opaque edge-color feathering', async () => {
  const previous = { fetch: globalThis.fetch, document: globalThis.document, Image: globalThis.Image,
    location: globalThis.location, warn: console.warn };
  const interactive = JSON.parse(await readFile(new URL('assets/environment/frontier-interactive-v1/manifest.json', root)));
  const sizes = new Map(interactive.files.map(file => [file.path, file.dimensionsPx]));
  const requests = [];
  class ImageMock {
    listeners = new Map(); width = 640; height = 640;
    addEventListener(name, callback) { this.listeners.set(name, callback); }
    removeEventListener(name) { this.listeners.delete(name); }
    set src(url) {
      const name = String(url).split('/').at(-1), size = sizes.get(name);
      if (size) { this.width = size.width; this.height = size.height; }
      if (name.includes('frontier-painted-material-atlas-mip-')) this.width = this.height = 1920 / 2 ** Number(name.match(/-mip-(\d)/)[1]);
      queueMicrotask(() => this.listeners.get('load')?.call(this));
    }
  }
  globalThis.document = { createElementNS() { return new ImageMock(); } }; globalThis.Image = ImageMock;
  console.warn = () => {};
  const surfaces = [];
  try {
    for (const mode of ['normal', 'mirror', 'atlas-failed']) {
      globalThis.location = { search: mode === 'mirror' ? '?terrainTiling=mirror' : '' };
      globalThis.fetch = async url => {
        requests.push(String(url));
        if (mode === 'atlas-failed' && String(url).includes('frontier-painted-material-atlas-v1/manifest.json')) return new Response('', { status: 404 });
        try { return new Response(await readFile(new URL(url, root))); } catch { return new Response('', { status: 404 }); }
      };
      const art = await import(`../src/environment-art.mjs?cliff-test=${mode}`);
      await art.resourceStateAssetsReady;
      const current = art.createGroundSurfaces(vale); surfaces.push(...current);
      const wall = current.find(mesh => mesh.userData.terrainCliffFaces);
      assert.equal(wall.userData.terrainCliffFaces.painted, true);
      assert.equal(positionHash(wall.geometry), valeBaseline);
      assert.equal(wall.material.map, current[0].material.map, 'same cached source, no extra image or clone');
      assert.equal(wall.material.map.name, mode === 'atlas-failed' ? '' : 'painted-ground:scree');
      assert.equal(wall.material.type, 'MeshBasicMaterial');
      assert.equal(wall.material.transparent, false); assert.equal(wall.material.depthWrite, true);
      assert.equal(wall.position.y, -.025, 'painted lips align to the unchanged base surface');
      const groundPoints = new Set();
      const p = current[0].geometry.attributes.position;
      const pointKey = (x, y, z) => [x, y, z].map(value => Math.round(value * 1e5)).join(',');
      for (let i = 0; i < p.count; i++) groundPoints.add(pointKey(p.getX(i), p.getY(i), p.getZ(i)));
      const w = wall.geometry.attributes.position;
      for (let i = 0; i < w.count; i++) {
        assert.ok(groundPoints.has(pointKey(w.getX(i), w.getY(i) + wall.position.y, w.getZ(i))),
          'each painted cliff endpoint coincides with an existing ground corner');
      }
      assert.equal(wall.userData.terrainSurface, undefined); assert.equal(current[0].userData.terrainSurface, true);
      const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.basic.vertexShader, fragmentShader: THREE.ShaderLib.basic.fragmentShader };
      wall.material.onBeforeCompile(shader);
      assert.match(shader.vertexShader, /vCliffEdgeDistances = cliffEdgeDistances/);
      assert.match(shader.fragmentShader, /smoothstep\(0\.0, \.12, vCliffEdgeDistances\.x\)/);
      assert.match(shader.fragmentShader, /smoothstep\(0\.0, \.16, vCliffEdgeDistances\.y\)/);
      assert.match(shader.fragmentShader, mode === 'mirror' ? /diffuseColor \*= vaeloraMapSample/ : /diffuseColor \*= vaeloraGround/);
      assert.match(wall.material.customProgramCacheKey(), /cliff-edge-colors-v1/);
      if (mode !== 'atlas-failed') {
        assert.deepEqual(wall.material.map.userData.paintedMaterialAtlasUvRect, atlas.materials.find(m => m.id === 'scree').uvRectTopLeft);
        assert.match(shader.fragmentShader, /32\.0 \/ max\(footprint/);
      }
      const other = art.createGroundSurfaces({ ...vale, terrainBase: 'cinder' }); surfaces.push(...other);
      assert.equal(other.find(mesh => mesh.userData.terrainCliffFaces).userData.terrainCliffFaces.painted, false);
    }
    assert.ok(requests.every(url => !url.includes('frontier-cliff-pilot-v1')), 'no pilot or new art request');
  } finally {
    for (const mesh of surfaces) {
      mesh.geometry.dispose(); mesh.material.dispose();
      for (const texture of mesh.userData.ownedGroundTextures || []) texture.dispose();
    }
    for (const [key, value] of Object.entries(previous)) {
      if (key === 'warn') console.warn = value;
      else if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  }
});
