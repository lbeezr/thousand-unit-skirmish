import * as THREE from 'three';
import { terrainHeightField } from '../../terrain-height.mjs';
import { applyTerrainTextureSampling } from '../../terrain-texture-sampling.mjs';

export const BATTLEFIELD_SURROUND_BACKGROUND = 0x8c9ca0;
export const BATTLEFIELD_SURROUND_FAR_MARGIN = 1200;
const LAND_RINGS = [0, 1.8, 5, 10, 18, 32, 56, 90, 144, 240, 400];

export function battlefieldSurroundEnabled(definition) {
  return definition.id === 'veyrholds-terraced-vale' && definition.region === 'veyrholds';
}

const smooth = (a, b, value) => {
  const t = THREE.MathUtils.clamp((value - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
function field(x, z, seed) {
  return .5 + .22 * Math.sin(x * .071 + seed) * Math.cos(z * .063 - seed)
    + .16 * Math.sin(x * .039 + z * .051 + seed * 2);
}

// Ring topology has an actual hole: scenic triangles never occupy playable X/Z.
// Sample every edge cell so the inner lip follows the existing raised terrain.
function ringGeometry(definition, rings, cloud = false) {
  const { width, height } = definition, halfX = width / 2, halfZ = height / 2;
  const terrain = terrainHeightField(definition);
  const seed = (Math.trunc(definition.terrainSeed || 0) >>> 0) % 997;
  const perimeter = [];
  for (let x = 0; x < width; x++) {
    const h = terrain.corners(x, 0); perimeter.push([x - halfX, -halfZ, h[0], h[1]]);
  }
  for (let z = 0; z < height; z++) {
    const h = terrain.corners(width - 1, z); perimeter.push([halfX, z - halfZ, h[1], h[3]]);
  }
  for (let x = 0; x < width; x++) {
    const h = terrain.corners(width - 1 - x, height - 1); perimeter.push([halfX - x, halfZ, h[3], h[2]]);
  }
  for (let z = 0; z < height; z++) {
    const h = terrain.corners(0, height - 1 - z); perimeter.push([-halfX, halfZ - z, h[2], h[0]]);
  }
  const vertices = [], uv = [], haze = [], indices = [];
  const outerRings = cloud ? rings : rings.slice(1);
  for (const offset of outerRings) for (const [x, z] of perimeter) {
    const angle = Math.atan2(z / halfZ, x / halfX);
    const spread = offset * (1 + .13 * Math.sin(angle * 7 + seed) + .06 * Math.sin(angle * 13));
    const px = x * (1 + spread / halfX), pz = z * (1 + spread / halfZ);
    const distance = Math.max(Math.abs(px) - halfX, Math.abs(pz) - halfZ);
    const edge = terrain.sample(x, z) - .025;
    const fall = (14 + 9 * field(px, pz, seed)) * (1 - Math.exp(-distance / (7 + 8 * field(px, pz, seed + 5))));
    const ridges = Math.max(0, field(px * .45, pz * .45, seed + 8) - .43)
      * 28 * smooth(22, 65, distance);
    const y = cloud ? -7 : edge - fall + ridges;
    vertices.push(px, y, pz);
    uv.push((px + halfX) / 12, (pz + halfZ) / 12);
    haze.push(smooth(45, 270, distance));
  }
  const stride = perimeter.length;
  for (let ring = 0; ring < outerRings.length - 1; ring++) for (let i = 0; i < stride; i++) {
    const j = (i + 1) % stride;
    const a = ring * stride + i, b = ring * stride + j;
    const c = a + stride, d = b + stride;
    indices.push(a, b, d, a, d, c);
  }
  // Two-level cliffs have different heights at the same grid coordinate.
  // Retain each edge cell's two corners instead of welding across that cliff.
  const lipStart = vertices.length / 3;
  if (!cloud) {
    for (let i = 0; i < stride; i++) {
      const j = (i + 1) % stride;
      const [x, z, aHeight, bHeight] = perimeter[i], [nextX, nextZ] = perimeter[j];
      vertices.push(x, aHeight - .025, z, nextX, bHeight - .025, nextZ);
      uv.push((x + halfX) / 12, (z + halfZ) / 12, (nextX + halfX) / 12, (nextZ + halfZ) / 12);
      haze.push(0, 0);
      const a = lipStart + i * 2, b = a + 1;
      indices.push(a, b, j, a, j, i);
    }
    for (let i = 0; i < stride; i++) {
      const previous = (i + stride - 1) % stride;
      if (Math.abs(perimeter[previous][3] - perimeter[i][2]) > .001) {
        indices.push(lipStart + previous * 2 + 1, lipStart + i * 2, i);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  if (!cloud) geometry.userData.battlefieldLip = { start: lipStart, segments: stride };
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setAttribute('surroundHaze', new THREE.Float32BufferAttribute(haze, 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  if (!cloud) {
    const normals = geometry.getAttribute('normal'), colors = [];
    for (let i = 0; i < normals.count; i++) {
      const shade = THREE.MathUtils.clamp(.85 + .15 * Math.abs(normals.getY(i))
        + .18 * (-.6 * normals.getX(i) + .4 * normals.getZ(i)), .64, 1.06);
      colors.push(shade * .93, shade * .96, shade);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  }
  geometry.computeBoundingSphere();
  return geometry;
}

export function buildBattlefieldSurroundGeometry(definition) {
  return ringGeometry(definition, LAND_RINGS);
}

function landMaterial(definition, texture) {
  const material = applyTerrainTextureSampling(new THREE.MeshBasicMaterial({
    map: texture, color: 0xd2d4bd, vertexColors: true, side: THREE.DoubleSide, fog: false,
  }), definition.terrainSeed || 0);
  const sample = material.onBeforeCompile, key = material.customProgramCacheKey;
  material.onBeforeCompile = shader => {
    sample(shader);
    shader.uniforms.surroundSky = { value: new THREE.Color(BATTLEFIELD_SURROUND_BACKGROUND) };
    shader.vertexShader = 'attribute float surroundHaze; varying float vSurroundHaze;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvSurroundHaze = surroundHaze;');
    shader.fragmentShader = 'uniform vec3 surroundSky; varying float vSurroundHaze;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>',
      '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, surroundSky, vSurroundHaze);');
  };
  material.customProgramCacheKey = () => `${key.call(material)}:battlefield-surround-v1`;
  return material;
}

function cloudMaterial(definition) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: {
      halfSize: { value: new THREE.Vector2(definition.width / 2, definition.height / 2) },
      cloudColor: { value: new THREE.Color(0xc2cdd0) },
      seed: { value: (definition.terrainSeed || 0) % 997 },
    },
    vertexShader: /* glsl */`
      varying vec2 cloudPosition;
      void main() {
        cloudPosition = position.xz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec2 halfSize;
      uniform vec3 cloudColor;
      uniform float seed;
      varying vec2 cloudPosition;
      float hash(vec2 p) { return fract(sin(dot(p + seed, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 a = floor(p), t = fract(p); t = t * t * (3.0 - 2.0 * t);
        return mix(mix(hash(a), hash(a + vec2(1.0, 0.0)), t.x),
          mix(hash(a + vec2(0.0, 1.0)), hash(a + vec2(1.0)), t.x), t.y);
      }
      void main() {
        float distance = max(abs(cloudPosition.x) - halfSize.x, abs(cloudPosition.y) - halfSize.y);
        float valley = smoothstep(7.0, 20.0, distance) * (1.0 - smoothstep(60.0, 112.0, distance));
        float pockets = noise(cloudPosition * .037) * .72 + noise(cloudPosition * .083) * .28;
        float alpha = valley * smoothstep(.32, .78, pockets) * .18;
        if (alpha < .001) discard;
        gl_FragColor = vec4(cloudColor, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

export function createBattlefieldSurround(definition, { texture = null } = {}) {
  if (!battlefieldSurroundEnabled(definition)) return null;
  const group = new THREE.Group();
  group.name = 'Terraced Vale surrounding landscape';
  group.userData.battlefieldSurround = { version: 1, decorative: true, cloudMotion: 'static', drawCalls: 2 };
  const land = new THREE.Mesh(buildBattlefieldSurroundGeometry(definition), landMaterial(definition, texture));
  land.name = 'Connected slate slopes and distant ridges';
  land.renderOrder = -28;
  const clouds = new THREE.Mesh(ringGeometry(definition, [6, 16, 32, 56, 88, 128], true), cloudMaterial(definition));
  clouds.name = 'Low valley cloud pockets';
  clouds.renderOrder = -24;
  // Main picks only its terrainSurface; also refuse generic mesh raycasting.
  for (const mesh of [land, clouds]) {
    mesh.raycast = () => {};
    mesh.userData.decorative = true;
    group.add(mesh);
  }
  return group;
}
