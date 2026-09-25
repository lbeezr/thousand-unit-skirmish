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

function groundRectangleGeometry(rectangles, definition, y, feather = false) {
  const vertices = [];
  const uvs = [];
  const colors = [];
  const indices = [];
  for (const rect of rectangles) {
    const x0 = rect.column - definition.width / 2;
    const x1 = x0 + rect.width;
    const z0 = rect.row - definition.height / 2;
    const z1 = z0 + rect.height;
    const edgeX = feather ? Math.min(0.7, rect.width / 2) : 0;
    const edgeZ = feather ? Math.min(0.7, rect.height / 2) : 0;
    const xs = feather ? [x0, x0 + edgeX, x1 - edgeX, x1] : [x0, x1];
    const zs = feather ? [z0, z0 + edgeZ, z1 - edgeZ, z1] : [z0, z1];
    const first = vertices.length / 3;
    for (let zi = 0; zi < zs.length; zi++) {
      for (let xi = 0; xi < xs.length; xi++) {
        const x = xs[xi];
        const z = zs[zi];
        vertices.push(x, y, z);
        uvs.push((x + definition.width / 2) / 12, (z + definition.height / 2) / 12);
        if (feather) colors.push(1, 1, 1,
          xi === 0 || xi === xs.length - 1 || zi === 0 || zi === zs.length - 1 ? 0 : 1);
      }
    }
    for (let zi = 0; zi < zs.length - 1; zi++) {
      for (let xi = 0; xi < xs.length - 1; xi++) {
        const a = first + zi * xs.length + xi;
        const b = a + 1;
        const c = a + xs.length;
        const d = c + 1;
        indices.push(a, d, b, a, c, d);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  if (feather) geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function createGroundSurfaces(definition) {
  const base = environmentTheme(definition);
  const meshes = [new THREE.Mesh(
    groundRectangleGeometry([{ column: 0, row: 0, width: definition.width, height: definition.height }], definition, -0.025),
    new THREE.MeshBasicMaterial({ map: grounds[base], color: 0xd2d4bd }),
  )];
  for (const material of TERRAIN_MATERIALS) {
    const rectangles = (definition.terrainPatches || []).filter((patch) => patch.material === material);
    if (!rectangles.length) continue;
    meshes.push(new THREE.Mesh(
      groundRectangleGeometry(rectangles, definition, -0.019, true),
      new THREE.MeshBasicMaterial({ map: grounds[material], color: 0xd2d4bd,
        vertexColors: true, transparent: true, depthWrite: false }),
    ));
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
