// Controlled Blender study input from real Three geometry/materials. Not WebGL.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { CAMERA_VIEW_DIRECTION } from '../src/camera-controls.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const output = process.argv[2];
if (!output) throw new Error('Usage: node scripts/export-shore-bank-study.mjs NEW_OUTPUT_DIRECTORY');
await mkdir(output); // Never replace previous iterations.
const mapPath = 'maps/shore-fishing.json', bytes = await readFile(path.join(root, mapPath));
const definition = JSON.parse(bytes);
const original = { load: THREE.TextureLoader.prototype.load, fetch: globalThis.fetch,
  location: globalThis.location, warn: console.warn };
let surfaces;
try {
  THREE.TextureLoader.prototype.load = url => {
    const texture = new THREE.Texture(); texture.userData.studySourceUrl = url; return texture;
  };
  globalThis.fetch = async () => ({ ok: false, status: 404 });
  globalThis.location = { search: '?terrainTiling=mirror&waterQuality=low' };
  console.warn = () => {};
  const { createGroundSurfaces, resourceStateAssetsReady } = await import('../src/environment-art.mjs');
  await resourceStateAssetsReady;
  surfaces = createGroundSurfaces(definition);
} finally {
  THREE.TextureLoader.prototype.load = original.load; globalThis.fetch = original.fetch;
  if (original.location === undefined) delete globalThis.location; else globalThis.location = original.location;
  console.warn = original.warn;
}
const texture = value => value && ({ source: value.userData.studySourceUrl?.split('?')[0] ?? null,
  data: value.image?.data ? Array.from(value.image.data) : null,
  width: value.image?.width, height: value.image?.height,
  repeat: value.repeat.toArray(), mirrored: value.wrapS === THREE.MirroredRepeatWrapping,
  colorSpace: value.colorSpace });
const meshes = surfaces.map(surface => ({
  role: surface.userData.shoreBankShade ? 'bank-shade' : surface.userData.waterStudy ? 'static-water' : 'ground',
  positions: Array.from(surface.geometry.attributes.position.array),
  indices: Array.from(surface.geometry.index.array),
  colors: Array.from(surface.geometry.attributes.color.array),
  colorSize: surface.geometry.attributes.color.itemSize,
  uv: surface.geometry.attributes.uv ? Array.from(surface.geometry.attributes.uv.array) : null,
  material: { color: surface.material.color.toArray(), opacity: surface.material.opacity,
    map: texture(surface.material.map), alphaMap: texture(surface.material.alphaMap) },
}));
const views = [.91, .48].map(zoom => {
  const camera = new THREE.OrthographicCamera(-43 * 1280 / 720 / 2, 43 * 1280 / 720 / 2, 43 / 2, -43 / 2, .1, 300);
  camera.zoom = zoom; camera.position.copy(new THREE.Vector3(...CAMERA_VIEW_DIRECTION).normalize().multiplyScalar(100));
  camera.position.z += 8; camera.lookAt(0, 0, 8); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  return { zoom, cameraPosition: camera.position.toArray(), target: [0, 0, 8], orthoHeight: 43 / zoom,
    projectedPoints: [[0,0,8],[1,0,8],[0,1,8],[0,0,9]].map(point => {
      const p = new THREE.Vector3(...point).project(camera);
      return { point, screen: [(p.x + 1) * 640, (1 - p.y) * 360] };
    }) };
});
const record = { schema: 'thousand-unit-skirmish.shore-bank-study.v1',
  sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  renderer: 'Blender Cycles CPU study of exported Three geometry; not the game WebGL renderer',
  controls: 'Identical source map, meshes, textures, camera, seed and sampling; baseline omits only bank-shade mesh. Existing mirror ground sampling and static water quality. No sprites, units, HUD, fog or motion.',
  mapPath, mapSha256: createHash('sha256').update(bytes).digest('hex'),
  resolution: [1280, 720], background: new THREE.Color(0x859175).toArray(),
  views, bankShade: surfaces.find(mesh => mesh.userData.shoreBankShade).userData.shoreBankShade,
  meshes };
await writeFile(path.join(output, 'scene.json'), JSON.stringify(record) + '\n');
for (const surface of surfaces) {
  surface.geometry.dispose(); surface.material.dispose();
  for (const owned of surface.userData.ownedGroundTextures || []) owned.dispose();
}
console.log(JSON.stringify({ output, meshes: meshes.length, bankShade: record.bankShade, views: views.map(v => v.zoom) }));
