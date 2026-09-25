import * as THREE from 'three';

const ASSET_ROOT = './assets/environment/frontier-v1/';
export const TERRAIN_MATERIALS = ['meadow', 'short-grass', 'long-grass', 'dirt', 'sand', 'scree', 'cinder'];
const spriteNames = ['oak', 'pine', 'berries', 'rock-outcrop', 'basalt-ridge', 'cliff', 'seamstone'];
const textureLoader = new THREE.TextureLoader();

const sprites = Object.fromEntries(spriteNames.map((name) => {
  const texture = textureLoader.load(`${ASSET_ROOT}${name}.webp`);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return [name, texture];
}));

const grounds = Object.fromEntries(TERRAIN_MATERIALS.map((name) => {
  const texture = textureLoader.load(`${ASSET_ROOT}${name}.webp`);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.MirroredRepeatWrapping;
  texture.wrapT = THREE.MirroredRepeatWrapping;
  texture.anisotropy = 4;
  return [name, texture];
}));

const cameraFacing = new THREE.Quaternion().setFromUnitVectors(
  new THREE.Vector3(0, 0, 1),
  new THREE.Vector3(0.78, 1.12, 0.78).normalize(),
);
const instanceDummy = new THREE.Object3D();

export function environmentTheme(definition) {
  return TERRAIN_MATERIALS.includes(definition.terrainBase)
    ? definition.terrainBase : definition.id === 'cinder-ridge' ? 'cinder' : 'meadow';
}

function addGroundQuad(buffer, definition, x0, z0, x1, z1, y, alpha = [1, 1, 1, 1]) {
  const first = buffer.vertices.length / 3;
  for (const [x, z, opacity] of [
    [x0, z0, alpha[0]], [x1, z0, alpha[1]],
    [x0, z1, alpha[2]], [x1, z1, alpha[3]],
  ]) {
    buffer.vertices.push(x, y, z);
    // Every region samples the same world-space texture coordinates.
    buffer.uvs.push((x + definition.width / 2) / 12, (z + definition.height / 2) / 12);
    buffer.colors.push(1, 1, 1, opacity);
  }
  buffer.indices.push(first, first + 3, first + 1, first, first + 2, first + 3);
}

function finishGroundGeometry(buffer) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(buffer.vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(buffer.uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(buffer.colors, 4));
  geometry.setIndex(buffer.indices);
  geometry.computeVertexNormals();
  return geometry;
}

function groundBuffer() {
  return { vertices: [], uvs: [], colors: [], indices: [] };
}

function paintedGroundGeometry(rectangles, definition, materialIndex, materialGrid) {
  const buffer = groundBuffer();
  const halfX = definition.width / 2;
  const halfZ = definition.height / 2;
  const feather = 0.42;
  const y = -0.019;
  for (const rect of rectangles) {
    const x0 = rect.column - halfX;
    const z0 = rect.row - halfZ;
    addGroundQuad(buffer, definition, x0, z0, x0 + rect.width, z0 + rect.height, y);
  }
  // Feather only the outside of the material union. Adjacent rectangles of the
  // same paint stay fully opaque, so compression cannot introduce hairline seams.
  for (const rect of rectangles) {
    for (let row = rect.row; row < rect.row + rect.height; row++) {
      for (let column = rect.column; column < rect.column + rect.width; column++) {
        const index = row * definition.width + column;
        const left = column > 0 && materialGrid[index - 1] !== materialIndex;
        const right = column + 1 < definition.width && materialGrid[index + 1] !== materialIndex;
        const top = row > 0 && materialGrid[index - definition.width] !== materialIndex;
        const bottom = row + 1 < definition.height
          && materialGrid[index + definition.width] !== materialIndex;
        if (!(left || right || top || bottom)) continue;
        const x0 = column - halfX;
        const x1 = x0 + 1;
        const z0 = row - halfZ;
        const z1 = z0 + 1;
        if (left) addGroundQuad(buffer, definition, x0 - feather, z0, x0, z1, y, [0, 1, 0, 1]);
        if (right) addGroundQuad(buffer, definition, x1, z0, x1 + feather, z1, y, [1, 0, 1, 0]);
        if (top) addGroundQuad(buffer, definition, x0, z0 - feather, x1, z0, y, [0, 0, 1, 1]);
        if (bottom) addGroundQuad(buffer, definition, x0, z1, x1, z1 + feather, y, [1, 1, 0, 0]);
        if (left && top) addGroundQuad(buffer, definition, x0 - feather, z0 - feather, x0, z0, y, [0, 0, 0, 1]);
        if (right && top) addGroundQuad(buffer, definition, x1, z0 - feather, x1 + feather, z0, y, [0, 0, 1, 0]);
        if (left && bottom) addGroundQuad(buffer, definition, x0 - feather, z1, x0, z1 + feather, y, [0, 1, 0, 0]);
        if (right && bottom) addGroundQuad(buffer, definition, x1, z1, x1 + feather, z1 + feather, y, [1, 0, 0, 0]);
      }
    }
  }
  return finishGroundGeometry(buffer);
}

export function createGroundSurfaces(definition) {
  const base = environmentTheme(definition);
  const baseBuffer = groundBuffer();
  addGroundQuad(baseBuffer, definition,
    -definition.width / 2, -definition.height / 2,
    definition.width / 2, definition.height / 2, -0.025);
  const meshes = [new THREE.Mesh(
    finishGroundGeometry(baseBuffer),
    new THREE.MeshBasicMaterial({ map: grounds[base], color: 0xd2d4bd }),
  )];
  const materialGrid = new Int8Array(definition.width * definition.height);
  materialGrid.fill(-1);
  for (const patch of definition.terrainPatches || []) {
    const materialIndex = TERRAIN_MATERIALS.indexOf(patch.material);
    if (materialIndex < 0) continue;
    for (let row = patch.row; row < patch.row + patch.height; row++) {
      for (let column = patch.column; column < patch.column + patch.width; column++) {
        materialGrid[row * definition.width + column] = materialIndex;
      }
    }
  }
  for (const [materialIndex, material] of TERRAIN_MATERIALS.entries()) {
    const rectangles = (definition.terrainPatches || []).filter((patch) => patch.material === material);
    if (!rectangles.length) continue;
    const mesh = new THREE.Mesh(
      paintedGroundGeometry(rectangles, definition, materialIndex, materialGrid),
      new THREE.MeshBasicMaterial({ map: grounds[material], color: 0xd2d4bd,
        vertexColors: true, transparent: true, depthWrite: false }),
    );
    mesh.renderOrder = materialIndex + 1;
    meshes.push(mesh);
  }
  return meshes;
}

function spriteGeometry(width, height) {
  const geometry = new THREE.PlaneGeometry(width, height);
  geometry.translate(0, height / 2, 0);
  return geometry;
}

function spriteMaterial(name) {
  return new THREE.MeshBasicMaterial({
    map: sprites[name],
    side: THREE.DoubleSide,
    transparent: true,
    alphaTest: 0.08,
    depthWrite: true,
    toneMapped: false,
  });
}

export function createEnvironmentSprite(name, width, height, x, z) {
  const mesh = new THREE.Mesh(spriteGeometry(width, height), spriteMaterial(name));
  mesh.quaternion.copy(cameraFacing);
  mesh.position.set(x, 0, z);
  return mesh;
}

export function createEnvironmentSpriteInstances(name, width, height, positions) {
  if (positions.length === 0) return null;
  const mesh = new THREE.InstancedMesh(
    spriteGeometry(width, height), spriteMaterial(name), positions.length,
  );
  for (let index = 0; index < positions.length; index++) {
    const point = positions[index];
    setEnvironmentSpriteInstance(mesh, index, point.x, point.z, point.scale ?? 1, point.flip ?? false);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  return mesh;
}

export function setEnvironmentSpriteInstance(mesh, index, x, z, scale, flip = false) {
  instanceDummy.position.set(x, 0, z);
  instanceDummy.quaternion.copy(cameraFacing);
  instanceDummy.scale.set(flip ? -scale : scale, scale, scale);
  instanceDummy.updateMatrix();
  mesh.setMatrixAt(index, instanceDummy.matrix);
}

function variation(index) {
  const value = Math.sin(index * 127.1 + 17.7) * 43758.5453;
  return value - Math.floor(value);
}

export function addObstacleEnvironmentSprites(definition, halfX, halfZ, addObject) {
  const pines = [];
  const oaks = [];
  const outcrops = [];
  const ridges = [];
  const cliffs = [];
  for (const obstacle of definition.obstacles) {
    for (let row = obstacle.row; row < obstacle.row + obstacle.height; row++) {
      for (let column = obstacle.column; column < obstacle.column + obstacle.width; column++) {
        const index = row * definition.width + column;
        const x = column - halfX + 0.5;
        const z = row - halfZ + 0.5;
        if (obstacle.material === 'forest') {
          const point = {
            x: x + (variation(index) - 0.5) * 0.28,
            z: z + (variation(index + 19) - 0.5) * 0.28,
            scale: 0.78 + variation(index + 31) * 0.17,
          };
          if (variation(index + 7) < 0.28) oaks.push(point);
          else pines.push(point);
        } else if (obstacle.material === 'stone') {
          const vertical = obstacle.height >= obstacle.width;
          const centerLine = vertical
            ? column === obstacle.column + Math.floor(obstacle.width / 2)
            : row === obstacle.row + Math.floor(obstacle.height / 2);
          const along = vertical ? row - obstacle.row : column - obstacle.column;
          if (centerLine && along % 2 === 0) {
            const point = {
              x, z,
              scale: 0.88 + variation(index + 13) * 0.24,
              flip: variation(index + 41) < 0.5,
            };
            if ((obstacle.elevation ?? 1.12) < 1) outcrops.push(point);
            else if ((obstacle.elevation ?? 1.12) >= 1.75) cliffs.push(point);
            else ridges.push(point);
          }
        }
      }
    }
  }
  for (const [name, width, height, points] of [
    ['pine', 2.25, 3.4, pines],
    ['oak', 3.05, 2.86, oaks],
    ['rock-outcrop', 3.5, 2.2, outcrops],
    ['basalt-ridge', 3.6, 3.05, ridges],
    ['cliff', 4.2, 4.6, cliffs],
  ]) {
    const mesh = createEnvironmentSpriteInstances(name, width, height, points);
    if (mesh) addObject(mesh);
  }
}
