import * as THREE from 'three';
import { terrainHeightField } from '../../terrain-height.mjs';
import { TERRAIN_MATERIALS, forestGroundForBase } from '../../terrain-materials.mjs';
import { createGroundMistStudy, groundMistEnabled } from '../../terrain-atmosphere.mjs';
import { applyTerrainTextureSampling } from '../../terrain-texture-sampling.mjs';
import { createTerrainCliffFaces } from '../../terrain-cliff-faces.mjs';
import { buildTerrainBlendMasks, buildForestGroundMask } from '../../terrain-blend.mjs';
import { buildWaterSurfaceGeometry } from './water/geometry.mjs';
import { createWaterSurfaceStudy, waterSurfaceOptions } from './water/surface.mjs';
import { createShoreBankShade } from '../../shore-bank-shade.mjs';

const GROUND_RENDER_ORDER = -20;

function addGroundQuad(buffer, definition, x0, z0, x1, z1, y, alpha = [1, 1, 1, 1], heights = null) {
  const field=terrainHeightField(definition);
  if (field.raised && heights===null) {
    for(let row=0;row<definition.height;row++) for(let column=0;column<definition.width;column++) {
      const x=column-definition.width/2,z=row-definition.height/2;
      if(x<x0||z<z0||x+1>x1||z+1>z1) continue;
      addGroundQuad(buffer,definition,x,z,x+1,z+1,y,alpha,field.corners(column,row));
    }
    return;
  }
  const first = buffer.vertices.length / 3;
  for (const [i, [x, z, opacity]] of [
    [x0, z0, alpha[0]], [x1, z0, alpha[1]],
    [x0, z1, alpha[2]], [x1, z1, alpha[3]],
  ].entries()) {
    buffer.vertices.push(x, y+(heights?.[i]||0), z);
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
  const normals = geometry.getAttribute('normal');
  const colors = geometry.getAttribute('color');
  // Preserve the painted material's flat color while making slopes legible.
  for (let i = 0; i < normals.count; i++) {
    const shade = THREE.MathUtils.clamp(.85 + .15 * normals.getY(i)
      + .2 * (-.6 * normals.getX(i) + .4 * normals.getZ(i)), .68, 1.15);
    colors.setXYZ(i, shade, shade, shade);
  }
  return geometry;
}

function groundBuffer() {
  return { vertices: [], uvs: [], colors: [], indices: [] };
}

// The host owns base selection and shared texture/atlas/cache policy.
export function createGroundSurfaceBuilder({ groundBaseMaterial, groundTexture }) {
  function createGroundSurfaces(definition) {
    const base = groundBaseMaterial(definition);
    const stochastic = new URLSearchParams(globalThis.location?.search ?? '').get('terrainTiling') !== 'mirror';
    const freeRotation = new URLSearchParams(globalThis.location?.search ?? '').get('terrainRotation') === 'free';
    const groundMaterial = (options, role) => applyTerrainTextureSampling(
      new THREE.MeshBasicMaterial({ ...options, vertexColors: true }), definition.terrainSeed || 0, stochastic, freeRotation,
      stochastic ? groundTexture(role, definition, true) : null);
    const baseBuffer = groundBuffer();
    addGroundQuad(baseBuffer, definition,
      -definition.width / 2, -definition.height / 2,
      definition.width / 2, definition.height / 2, -0.025);
    const meshes = [new THREE.Mesh(
      finishGroundGeometry(baseBuffer),
      groundMaterial({ map: groundTexture(base, definition), color: 0xd2d4bd }, base),
    )];
    const waterGeometry = buildWaterSurfaceGeometry(definition);
    if (waterGeometry) {
      const motion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
      const options = waterSurfaceOptions(globalThis.location?.search ?? '', motion?.matches === true);
      const water = createWaterSurfaceStudy(definition, {
        ...options, geometry: waterGeometry, getTime: () => performance.now() / 1000,
      });
      if (motion?.addEventListener) {
        const change = event => water.userData.setWaterStudyMotion(event.matches);
        motion.addEventListener('change', change);
        water.material.addEventListener('dispose', () => motion.removeEventListener('change', change));
      }
      water.renderOrder = 5;
      meshes.push(water);
    }
    function blendSurface(mask, y, renderOrder) {
      const buffer = groundBuffer();
      addGroundQuad(buffer, definition, -definition.width / 2, -definition.height / 2,
        definition.width / 2, definition.height / 2, y);
      const geometry = finishGroundGeometry(buffer);
      // Ground repeats in world units; the independent blend mask spans the map.
      const uv = geometry.getAttribute('uv');
      for (let vertex = 0; vertex < uv.count; vertex++) {
        uv.setXY(vertex, uv.getX(vertex) * 12 / definition.width,
          uv.getY(vertex) * 12 / definition.height);
      }
      const texture = groundTexture(mask.material, definition).clone();
      texture.repeat.set(definition.width / 12, definition.height / 12);
      const alphaMap = new THREE.DataTexture(mask.pixels, mask.width, mask.height, THREE.RGBAFormat);
      alphaMap.magFilter = THREE.LinearFilter;
      alphaMap.minFilter = THREE.LinearMipmapLinearFilter;
      alphaMap.generateMipmaps = true;
      alphaMap.needsUpdate = true;
      const mesh = new THREE.Mesh(geometry, groundMaterial({
        map: texture, alphaMap, color: 0xd2d4bd,
        transparent: true, depthWrite: false,
      }, mask.material));
      mesh.userData.ownedGroundTextures = [texture, alphaMap];
      mesh.renderOrder = renderOrder;
      return mesh;
    }
    const organicPaint = definition.region === 'underbough'
      && new URLSearchParams(globalThis.location?.search ?? '').get('paintEdges') !== 'legacy';
    for (const [layer, mask] of buildTerrainBlendMasks(definition, TERRAIN_MATERIALS, base, organicPaint).entries()) {
      meshes.push(blendSurface(mask, -0.019, GROUND_RENDER_ORDER + layer));
    }
    const forestMask = buildForestGroundMask(definition, forestGroundForBase(base));
    if (forestMask) {
      meshes.push(blendSurface(forestMask, -0.012,
        GROUND_RENDER_ORDER + TERRAIN_MATERIALS.length));
    }
    const bankShade = createShoreBankShade(definition);
    if (bankShade) {
      bankShade.renderOrder = -2; // After terrain paint, before haze, props and water.
      meshes.push(bankShade);
    }
    const atmosphere = new URLSearchParams(globalThis.location?.search ?? '');
    const atmosphereDefinition = { ...definition, terrainBase: base };
    if (groundMistEnabled(atmosphereDefinition, atmosphere.get('terrainAtmosphere'))) {
      const timeValue = atmosphere.get('terrainAtmosphereTime');
      const fixedTime = timeValue !== null && Number.isFinite(Number(timeValue)) ? Number(timeValue) : null;
      const mist = createGroundMistStudy(atmosphereDefinition, fixedTime, meshes[0].geometry);
      if (mist) meshes.push(mist);
    }
    const cliffFaces = createTerrainCliffFaces(definition, { base,
      texture: base === 'scree' ? groundTexture('scree', definition) : null, stochastic, freeRotation });
    if (cliffFaces) meshes.push(cliffFaces);
    meshes[0].userData.terrainSurface=true;
    return meshes;
  }

  return createGroundSurfaces;
}
