import * as THREE from 'three';
import { regionalGroundTextureName, regionalGroundVariantTextureName } from './regional-ground-kits.mjs';

export const PAINTED_MATERIAL_ATLAS_MANIFEST = new URL(
  '../assets/environment/frontier-painted-material-atlas-v1/manifest.json', import.meta.url);
export const PAINTED_MATERIAL_NAMES = Object.freeze([
  'meadow', 'short-grass', 'long-grass', 'forest-floor', 'dirt', 'sand', 'scree', 'cinder',
]);

// Resolve regional/quiet/variant choices before deciding whether an atlas cell exists.
export function groundTextureName(material, definition, variant = false, search = '') {
  const query = new URLSearchParams(search);
  const enabled = query.get('regionalGrounds') !== 'legacy';
  let name = variant ? regionalGroundVariantTextureName(definition, material,
    enabled && query.get('groundVariants') !== 'single') : regionalGroundTextureName(definition, material, enabled);
  if (name === 'meadow' && query.get('meadowSurface') === 'quiet') name = 'bellweather-quiet-meadow';
  if (name === 'tidal-mud' && query.get('tidalSurface') !== 'legacy') name = 'siltmouths-quiet-mud';
  if (name === 'snow' && query.get('snowSurface') !== 'legacy') name = 'pale-meridian-quiet-snow';
  if (name === 'jungle-loam' && (!definition?.region || definition.region === 'vesperra')
    && query.get('jungleSurface') !== 'legacy') name = 'vesperra-quiet-loam';
  return name;
}

export function paintedMaterialAtlasDescriptor(manifest) {
  const { page, materials, files } = manifest;
  const sampling = page?.sampling;
  if (manifest.packId !== 'frontier-painted-material-atlas-v1' || manifest.schemaVersion !== 1
    || page.dimensionsPx?.width !== 1920 || page.dimensionsPx?.height !== 1920
    || page.colorSpace !== 'srgb' || page.wrapMode !== 'clamp' || page.alphaMode !== 'opaque'
    || sampling?.generateMipmaps !== false || sampling.maxMipLevel !== 5 || sampling.uvInsetPx !== 0.5
    || sampling.minFilter !== 'linear-mipmap-linear' || sampling.magFilter !== 'linear'
    || page.mipLevels?.length !== 6 || materials?.length !== PAINTED_MATERIAL_NAMES.length) {
    throw new Error('unsupported painted material atlas contract');
  }
  const mipFiles = page.mipLevels.map((mip, level) => {
    const file = files.find(entry => entry.id === mip.fileId);
    const size = 1920 / 2 ** level;
    if (mip.level !== level || file?.usage !== 'runtime'
      || file.path !== `assets/environment/frontier-painted-material-atlas-v1/frontier-painted-material-atlas-mip-${level}.webp`
      || [mip.dimensionsPx?.width, mip.dimensionsPx?.height,
        file.dimensionsPx?.width, file.dimensionsPx?.height].some(value => value !== size)) {
      throw new Error('unsupported painted material atlas mip');
    }
    return file;
  });
  const rects = new Map(PAINTED_MATERIAL_NAMES.map((name, index) => {
    const material = materials.find(entry => entry.id === name);
    const r = material?.rectPx;
    if (r?.x !== index % 3 * 640 + 64 || r.y !== Math.floor(index / 3) * 640 + 64
      || r.width !== 512 || r.height !== 512 || material.repeatMode !== 'mirrored-repeat'
      || material.worldRepeatUnits !== 12) throw new Error('unsupported painted material atlas cell');
    const expected = { min: { u: (r.x + 0.5) / 1920, v: (r.y + 0.5) / 1920 },
      max: { u: (r.x + r.width - 0.5) / 1920, v: (r.y + r.height - 0.5) / 1920 } };
    for (const bound of ['min', 'max']) for (const axis of ['u', 'v']) {
      if (material.uvRectTopLeft?.[bound]?.[axis] !== expected[bound][axis]) {
        throw new Error('painted material atlas half-pixel inset disagreement');
      }
    }
    return [name, expected];
  }));
  return { mipFiles, rects };
}

export async function loadPaintedMaterialAtlas({ fetchImpl = globalThis.fetch,
  imageLoader = new THREE.ImageLoader() } = {}) {
  const response = await fetchImpl(PAINTED_MATERIAL_ATLAS_MANIFEST);
  if (!response.ok) throw new Error(`painted material manifest HTTP ${response.status}`);
  const descriptor = paintedMaterialAtlasDescriptor(await response.json());
  const images = await Promise.all(descriptor.mipFiles.map(async file => {
    const image = await imageLoader.loadAsync(new URL(`../${file.path}`, import.meta.url).href);
    if (image.width !== file.dimensionsPx.width || image.height !== file.dimensionsPx.height) {
      throw new Error('painted material atlas decoded mip dimensions disagree');
    }
    return image;
  }));
  const page = new THREE.Texture(images[0]);
  page.colorSpace = THREE.SRGBColorSpace;
  page.wrapS = page.wrapT = THREE.ClampToEdgeWrapping;
  page.minFilter = THREE.LinearMipmapLinearFilter;
  page.magFilter = THREE.LinearFilter;
  page.anisotropy = 4;
  // Three r180 allocates exactly mipmaps.length immutable levels: reads clamp
  // at authored level 5. Never generate the cross-cell 6+ tail on the GPU.
  page.generateMipmaps = false;
  page.mipmaps = images;
  page.needsUpdate = true;
  const textures = new Map();
  return {
    texture(name) {
      if (!descriptor.rects.has(name)) return null;
      if (!textures.has(name)) {
        const texture = page.clone(); // Same source/GPU page; each paint owns its UV descriptor.
        texture.name = `painted-ground:${name}`;
        texture.userData.paintedMaterialAtlasUvRect = descriptor.rects.get(name);
        textures.set(name, texture);
      }
      return textures.get(name);
    },
  };
}
