// Static Sheep binding used by the normal neutral renderer. Snapshot/gameplay owners
// must explicitly supply visibility and idle state; moving/dead/resource states
// have no authored art and are never represented by a live idle Sheep.
import { spriteGroundDepthBias } from './unit-sprite-runtime.mjs';

export function staticSheepFrame(manifest, binding, state) {
  if (state?.visible !== true || state.stateId !== 'idle' || state.moving !== false) return null;
  if (!binding.previewOnly || binding.packId !== manifest.packId || binding.animations?.length !== 0) return null;
  if (!binding.directions?.includes(state.directionId)) return null;
  const asset = manifest.assets?.find(item => item.id === binding.assetId && item.kind === 'prop');
  const clip = asset?.clips?.find(item => item.stateId === 'idle' && item.directionId === state.directionId);
  if (!clip || clip.loop || clip.sequence?.length !== 1) return null;
  return asset.frames?.find(item => item.id === clip.sequence[0].frameId) || null;
}

export function sheepQuadPlacement(frame, projectedPixelsPerWorldUnit) {
  if (!Number.isFinite(projectedPixelsPerWorldUnit) || projectedPixelsPerWorldUnit <= 0) {
    throw new Error('Sheep preview requires an explicit projected world scale');
  }
  const scale = 1 / projectedPixelsPerWorldUnit;
  return {
    width: frame.canvasPx.width * scale, height: frame.canvasPx.height * scale,
    centerX: (frame.canvasPx.width / 2 - frame.groundPivotPx.x) * scale,
    centerY: (frame.groundPivotPx.y - frame.canvasPx.height / 2) * scale,
    scale,
  };
}

async function json(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Sheep preview could not load ${url.pathname || url} (${response.status})`);
  return response.json();
}

async function verifiedBytes(url, expectedSha256) {
  if (!/^[a-f0-9]{64}$/i.test(expectedSha256 || '')) throw new Error('Missing Sheep preview digest');
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Sheep preview returned HTTP ${response.status}`);
  const bytes = await response.arrayBuffer();
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  const actual = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
  if (actual !== expectedSha256.toLowerCase()) throw new Error('Sheep preview SHA-256 mismatch');
  return bytes;
}

export async function createStaticSheepRuntime({ THREE, scene, bindingUrl }) {
  const url = new URL(bindingUrl, globalThis.location?.href);
  const binding = await json(url);
  if (binding.previewOnly !== true || binding.animations?.length !== 0) throw new Error('Only static preview bindings are supported');
  const manifestUrl = new URL(binding.manifest, url);
  const manifest = JSON.parse(new TextDecoder().decode(await verifiedBytes(manifestUrl, binding.manifestSha256)));
  const asset = manifest.assets?.find(item => item.id === binding.assetId && item.kind === 'prop');
  const page = manifest.pages?.find(item => item.id === asset?.frames?.[0]?.fallbackRectPx?.pageId);
  const file = manifest.files?.find(item => item.id === page?.runtimeFileId);
  if (!file || !page || manifest.packId !== binding.packId) throw new Error('Incomplete Sheep preview pack');
  const bytes = await verifiedBytes(new URL(file.path, manifestUrl), file.sha256);
  const blobUrl = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
  const image = new Image();
  try {
    image.src = blobUrl;
    await image.decode();
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
  if (image.width !== page.dimensionsPx.width || image.height !== page.dimensionsPx.height) {
    throw new Error('Sheep preview decoded dimensions mismatch');
  }
  const texture = new THREE.Texture(image);
  texture.needsUpdate = true;
  texture.flipY = false;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({
    map: texture, color: 0xffffff, transparent: true, alphaTest: .035,
    depthTest: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  const geometries = new Map();
  const initialGeometry = mesh.geometry;
  mesh.visible = false;
  scene.add(mesh);
  const local = new THREE.Vector3(), up = new THREE.Vector3(), toward = new THREE.Vector3();
  let disposed = false;
  function geometryForFrame(frame) {
    if (geometries.has(frame.id)) return geometries.get(frame.id);
    const rect = frame.fallbackRectPx.rectPx;
    if (frame.fallbackRectPx.pageId !== page.id) throw new Error('Sheep preview supports one color page');
    const geometry = new THREE.PlaneGeometry(1, 1);
    const width = page.dimensionsPx.width, height = page.dimensionsPx.height;
    // A direction owns immutable UVs. Live instances share this geometry safely;
    // switching the template frame must not turn every cloned Sheep with it.
    const uv = geometry.getAttribute('uv');
    const x0 = (rect.x + .5) / width, x1 = (rect.x + rect.width - .5) / width;
    const y0 = (rect.y + .5) / height, y1 = (rect.y + rect.height - .5) / height;
    uv.setXY(0, x0, y0); uv.setXY(1, x1, y0);
    uv.setXY(2, x0, y1); uv.setXY(3, x1, y1);
    geometries.set(frame.id, geometry);
    return geometry;
  }
  return {
    binding, manifest, mesh,
    supports(state) { return !disposed && Boolean(staticSheepFrame(manifest, binding, state)); },
    update(state, camera) {
      const frame = !disposed && ['x', 'groundY', 'z'].every(key => Number.isFinite(state?.[key]))
        ? staticSheepFrame(manifest, binding, state) : null;
      mesh.visible = Boolean(frame);
      if (!frame) return false;
      const placement = sheepQuadPlacement(frame, binding.projectedPixelsPerWorldUnit);
      mesh.geometry = geometryForFrame(frame);
      mesh.quaternion.copy(camera.quaternion);
      up.set(0, 1, 0).applyQuaternion(camera.quaternion);
      toward.set(0, 0, 1).applyQuaternion(camera.quaternion);
      const bias = spriteGroundDepthBias(frame.alphaBoundsPx, frame.groundPivotPx, placement.scale, up.y, toward.y);
      local.set(placement.centerX, placement.centerY, 0).applyQuaternion(camera.quaternion);
      mesh.position.set(state.x, state.groundY, state.z).add(local).addScaledVector(toward, bias + .018);
      mesh.scale.set(placement.width, placement.height, 1);
      return true;
    },
    dispose() {
      if (disposed) return;
      disposed = true; mesh.visible = false;
      scene.remove(mesh); initialGeometry.dispose();
      for (const geometry of geometries.values()) geometry.dispose();
      geometries.clear(); material.dispose(); texture.dispose();
    },
  };
}
