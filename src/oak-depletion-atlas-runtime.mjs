import * as THREE from 'three';

export const OAK_DEPLETION_ATLAS_ROOT = 'assets/environment/frontier-oak-depletion-atlas-v1/';
export const OAK_DEPLETION_ATLAS_MANIFEST = new URL(`../${OAK_DEPLETION_ATLAS_ROOT}manifest.json`, import.meta.url);
export const OAK_DEPLETION_STATES = Object.freeze(['worked', 'low', 'depleted']);
export const oakDepletionStage = name => OAK_DEPLETION_STATES.find(stage => name === `oak-${stage}`) ?? null;

export function oakDepletionAtlasDescriptor(manifest) {
  const { page, frames, files } = manifest;
  const sampling = page?.sampling;
  if (manifest.schemaVersion !== 1 || manifest.packId !== 'frontier-oak-depletion-atlas-v1'
    || page?.dimensionsPx?.width !== 3936 || page.dimensionsPx.height !== 1376
    || page.cellPx?.width !== 1312 || page.cellPx.height !== 1376 || page.gutterPx !== 32
    || page.gutterRule !== 'edge-rgb-transparent-alpha' || page.colorSpace !== 'srgb'
    || page.alphaMode !== 'straight' || page.wrapMode !== 'clamp'
    || sampling?.generateMipmaps !== false || sampling.maxMipLevel !== 5 || sampling.uvInsetPx !== .5
    || sampling.minFilter !== 'linear-mipmap-linear' || sampling.magFilter !== 'linear' || sampling.anisotropy !== 1
    || files?.length !== 6 || frames?.length !== 3) throw new Error('unsupported oak depletion atlas contract');
  const mipFiles = files.map((file, level) => {
    if (file.level !== level || file.path !== `oak-depletion-mip-${level}.webp` || file.usage !== 'runtime'
      || file.format !== 'webp' || !/^[a-f0-9]{64}$/.test(file.sha256 || '')
      || file.dimensionsPx?.width !== 3936 / 2 ** level || file.dimensionsPx?.height !== 1376 / 2 ** level) {
      throw new Error('unsupported oak depletion atlas mip');
    }
    return { ...file, path: OAK_DEPLETION_ATLAS_ROOT + file.path };
  });
  const rects = new Map(OAK_DEPLETION_STATES.map((state, index) => {
    const frame = frames.find(frame => frame.id === state);
    const r = frame?.rectPx;
    if (r?.x !== index * 1312 + 32 || r.y !== 32 || r.width !== 1226 || r.height !== 1283
      || frame.canvasPx?.width !== 1226 || frame.canvasPx.height !== 1283
      || frame.groundPivotPx?.x !== 613 || frame.groundPivotPx.y !== 1283
      || frame.worldSize?.width !== 4.1 || frame.worldSize.height !== 3.75) {
      throw new Error('oak depletion atlas registration changed');
    }
    const rect = { min: { u: (r.x + .5) / 3936, v: (r.y + .5) / 1376 },
      max: { u: (r.x + r.width - .5) / 3936, v: (r.y + r.height - .5) / 1376 } };
    for (const bound of ['min', 'max']) for (const axis of ['u', 'v']) {
      if (frame.uvRectTopLeft?.[bound]?.[axis] !== rect[bound][axis]) throw new Error('oak depletion half-pixel inset differs');
    }
    return [state, rect];
  }));
  return { mipFiles, rects };
}

async function decodeVerifiedImage(bytes, imageLoader) {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'image/webp' }));
  try { return await imageLoader.loadAsync(url); }
  finally { URL.revokeObjectURL(url); }
}

export async function loadOakDepletionAtlas({ fetchImpl = globalThis.fetch,
  imageLoader = new THREE.ImageLoader(), decodeImage = bytes => decodeVerifiedImage(bytes, imageLoader) } = {}) {
  const response = await fetchImpl(OAK_DEPLETION_ATLAS_MANIFEST);
  if (!response.ok) throw new Error(`oak depletion manifest HTTP ${response.status}`);
  const descriptor = oakDepletionAtlasDescriptor(await response.json());
  const images = await Promise.all(descriptor.mipFiles.map(async file => {
    const response = await fetchImpl(new URL(`../${file.path}`, import.meta.url));
    if (!response.ok) throw new Error(`oak depletion mip HTTP ${response.status}`);
    const bytes = await response.arrayBuffer();
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    const digest = [...new Uint8Array(hash)].map(value => value.toString(16).padStart(2, '0')).join('');
    if (digest !== file.sha256) throw new Error('oak depletion mip hash differs');
    const image = await decodeImage(bytes, file);
    if ((image.naturalWidth || image.width) !== file.dimensionsPx.width
      || (image.naturalHeight || image.height) !== file.dimensionsPx.height) throw new Error('oak depletion decoded dimensions differ');
    return image;
  }));
  const page = new THREE.Texture(images[0]);
  page.colorSpace = THREE.SRGBColorSpace;
  page.wrapS = page.wrapT = THREE.ClampToEdgeWrapping;
  page.minFilter = THREE.LinearMipmapLinearFilter; page.magFilter = THREE.LinearFilter;
  page.generateMipmaps = false; page.anisotropy = 1; page.mipmaps = images; page.needsUpdate = true;
  const textures = new Map();
  return { files: descriptor.mipFiles, texture(stage) {
    const rect = descriptor.rects.get(stage);
    if (!rect) return null;
    if (!textures.has(stage)) {
      const texture = page.clone();
      texture.name = `oak-depletion:${stage}`;
      texture.offset.set(rect.min.u, 1 - rect.max.v);
      texture.repeat.set(rect.max.u - rect.min.u, rect.max.v - rect.min.v);
      texture.updateMatrix();
      texture.userData.oakDepletionAtlas = true;
      textures.set(stage, texture);
    }
    return textures.get(stage);
  } };
}

export function applyOakDepletionSampling(material) {
  material.onBeforeCompile = shader => {
    if (!material.map?.userData.oakDepletionAtlas) return;
    shader.uniforms.oakAtlasSize = { value: new THREE.Vector2(3936, 1376) };
    shader.fragmentShader = 'uniform vec2 oakAtlasSize;\n' + shader.fragmentShader;
    const mapChunk = THREE.ShaderChunk.map_fragment.replace('texture2D( map, vMapUv )',
      `textureLod(map, vMapUv, min(5.0, max(0.0, 0.5 * log2(max(
        dot(dFdx(vMapUv) * oakAtlasSize, dFdx(vMapUv) * oakAtlasSize),
        dot(dFdy(vMapUv) * oakAtlasSize, dFdy(vMapUv) * oakAtlasSize))))))`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', mapChunk);
  };
  material.customProgramCacheKey = () => material.map?.userData.oakDepletionAtlas ? 'oak-depletion-atlas-mip5-v1' : 'oak-individual-v1';
  return material;
}
