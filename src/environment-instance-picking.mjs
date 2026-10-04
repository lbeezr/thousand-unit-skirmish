import * as THREE from 'three';

// Alpha is presentation data only. It never creates a resource, stock or ID.
const alphaImages = new WeakMap();
const unreadableImages = new WeakSet();
export function imageAlphaPixels(image) {
  if (!image || image.complete === false) return null;
  const cached = alphaImages.get(image);
  if (cached) return cached;
  const width = image.naturalWidth || image.width, height = image.naturalHeight || image.height;
  if (!width || !height) return null;
  let rgba, canvas;
  try {
    if (image.data?.length === width * height * 4) rgba = image.data;
    else {
      canvas = globalThis.document?.createElement('canvas');
      if (!canvas) return null;
      canvas.width = width; canvas.height = height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return null;
      context.drawImage(image, 0, 0);
      rgba = context.getImageData(0, 0, width, height).data;
    }
    const alpha = new Uint8Array(width * height);
    for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3];
    const result = { width, height, alpha };
    alphaImages.set(image, result);
    return result;
  } catch {
    if (!unreadableImages.has(image)) {
      unreadableImages.add(image);
      console.warn('Tree sprite alpha could not be read for picking; root targets remain available.');
    }
    return null;
  } finally {
    if (canvas) canvas.width = canvas.height = 0;
  }
}

function wrapUv(value, wrap) {
  if (wrap === THREE.RepeatWrapping) return value - Math.floor(value);
  if (wrap === THREE.MirroredRepeatWrapping) {
    const cell = Math.floor(value), fraction = value - cell;
    return Math.abs(cell % 2) === 1 ? 1 - fraction : fraction;
  }
  return Math.max(0, Math.min(1, value));
}

// Match the existing uv_vertex map matrix, then per-instance atlas rectangle.
export function instanceImageUv(mesh, index, uv) {
  const texture = mesh.material.map;
  if (!texture) return null;
  if (texture.matrixAutoUpdate) texture.updateMatrix();
  const point = uv.clone().applyMatrix3(texture.matrix);
  const rect = mesh.geometry.getAttribute('environmentAtlasRect')
    || mesh.geometry.getAttribute('resourceViewRect') || mesh.geometry.getAttribute('plantViewRect');
  if (rect) point.set(rect.getX(index) + point.x * rect.getZ(index),
    rect.getY(index) + point.y * rect.getW(index));
  point.set(wrapUv(point.x, texture.wrapS), wrapUv(point.y, texture.wrapT));
  if (texture.flipY) point.y = 1 - point.y;
  return point;
}

function sampledAlpha(pixels, uv) {
  // Bilinear level-zero coverage matches the ordinary magnified art; authored
  // mip filtering is a render detail, not a new resource/stock decision.
  const x = uv.x * pixels.width - .5, y = uv.y * pixels.height - .5;
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const at = (column, row) => pixels.alpha[Math.max(0, Math.min(pixels.height - 1, row)) * pixels.width
    + Math.max(0, Math.min(pixels.width - 1, column))] / 255;
  return (at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx) * (1 - fy)
    + (at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx) * fy;
}

export function createEnvironmentInstancePicker({ readAlpha = imageAlphaPixels } = {}) {
  // Raycast one supplied instance at a time. Raycasting the entire batch once
  // per slot would turn the existing linear click scan into a quadratic scan.
  const probe = new THREE.Mesh(), instance = new THREE.Matrix4(), clipPoint = new THREE.Vector3(), hits = [];
  return (raycaster, candidates) => {
    let nearest = null, distance = Infinity;
    for (const candidate of candidates) {
      const { mesh, index } = candidate;
      if (!mesh || !Number.isInteger(index) || index < 0 || index >= mesh.count) continue;
      let visible = true;
      for (let parent = mesh; parent; parent = parent.parent) if (!parent.visible) { visible = false; break; }
      if (!visible || !mesh.material.visible || !mesh.material.map) continue;
      mesh.updateWorldMatrix(true, false);
      mesh.getMatrixAt(index, instance);
      if (instance.determinant() === 0) continue; // Inactive state or cleared tree.
      probe.geometry = mesh.geometry; probe.material = mesh.material;
      probe.matrixWorld.multiplyMatrices(mesh.matrixWorld, instance);
      hits.length = 0;
      probe.raycast(raycaster, hits);
      for (const hit of hits) {
        if (hit.distance >= distance || !hit.uv) continue;
        if (raycaster.camera && Math.abs(clipPoint.copy(hit.point).project(raycaster.camera).z) > 1) continue;
        const pixels = readAlpha(mesh.material.map.image);
        const uv = instanceImageUv(mesh, index, hit.uv);
        if (!pixels || !uv || sampledAlpha(pixels, uv) * mesh.material.opacity
          < Math.max(mesh.material.alphaTest, 1 / 255)) continue;
        nearest = candidate; distance = hit.distance;
      }
    }
    return nearest;
  };
}
