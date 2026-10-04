import * as THREE from 'three';
import { applyBuildingGroundDepth } from './building-sprites.mjs';
import { imageAlphaPixels } from './environment-instance-picking.mjs';

const DEFAULT_MANIFEST_URL = new URL(
  '../assets/buildings/town-center-lifecycle-meshy-v1/lifecycle-grid.json',
  import.meta.url,
).href;
const manifestRequests = new Map();
const MANIFEST_RETRY_MS = 5000;
const imagePromises = new Map();
const frameTextures = new Map();

function asAbsoluteUrl(path, baseUrl) {
  return new URL(path, baseUrl).href;
}

function loadManifest(manifestUrl) {
  const cached = manifestRequests.get(manifestUrl);
  if (!cached?.promise || Date.now() >= cached.retryAt) {
    const pending = (async () => {
      const response = await fetch(manifestUrl, { cache: cached ? 'reload' : 'force-cache' });
      if (!response.ok) throw Object.assign(
        new Error(`Building view manifest returned HTTP ${response.status}`), { status: response.status },
      );
      const manifest = await response.json();
      if (manifest.schema !== 'thousand-unit-skirmish.building-lifecycle-reference.v1'
        || !Array.isArray(manifest.camera?.azimuthDegrees)
        || !Array.isArray(manifest.camera?.framePixels)
        || !Array.isArray(manifest.camera?.anchorPixelFromTopLeft)
        || !Array.isArray(manifest.stateOrder)) {
        throw new Error('Building view manifest has an unsupported schema or camera contract');
      }
      return manifest;
    })();
    const entry = { promise: pending, retryAt: Infinity };
    manifestRequests.set(manifestUrl, entry);
    pending.catch((error) => {
      entry.retryAt = error?.status === 404 ? Infinity : Date.now() + MANIFEST_RETRY_MS;
    });
  }
  return manifestRequests.get(manifestUrl).promise;
}

// All consumers of this URL retry on their next update, sharing one fresh fetch.
export function invalidateCapturedBuildingManifest(manifestUrl = DEFAULT_MANIFEST_URL) {
  manifestRequests.set(new URL(manifestUrl, import.meta.url).href, { retryAt: 0 });
}

function currentManifestRequest(data, pending = data.manifestPromise) {
  return !data.disposed && data.manifestPromise === pending
    && manifestRequests.get(data.manifestUrl)?.promise === pending;
}

function loadVerifiedImage(path, expectedSha256, manifestUrl) {
  const url = asAbsoluteUrl(path, manifestUrl);
  const cacheKey = `${url}:${expectedSha256}`;
  if (!imagePromises.has(cacheKey)) {
    const pending = (async () => {
      if (!/^[a-f0-9]{64}$/i.test(expectedSha256 || '')) {
        throw new Error(`Building view image has no valid SHA-256 digest: ${path}`);
      }
      const response = await fetch(url, { cache: 'force-cache' });
      if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
      const bytes = await response.arrayBuffer();
      if (!globalThis.crypto?.subtle) throw new Error('Web Crypto is unavailable for building view verification');
      const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
      const actual = [...new Uint8Array(digest)]
        .map((value) => value.toString(16).padStart(2, '0')).join('');
      if (actual !== expectedSha256.toLowerCase()) throw new Error(`${path} SHA-256 differs from its manifest entry`);
      const blob = new Blob([bytes], { type: response.headers.get('content-type') || 'image/webp' });
      const imageUrl = URL.createObjectURL(blob);
      const image = new Image();
      image.decoding = 'async';
      image.src = imageUrl;
      try {
        await image.decode();
        return image;
      } finally {
        URL.revokeObjectURL(imageUrl);
      }
    })();
    imagePromises.set(cacheKey, pending);
    pending.catch(() => imagePromises.delete(cacheKey));
  }
  return imagePromises.get(cacheKey);
}

function lifecycleStateName(input, manifest) {
  if (typeof input === 'string') return input;
  if (input?.state && manifest.stateOrder.includes(input.state)) return input.state;

  const mapping = manifest.stateMapping || {};
  const progress = Number.isFinite(input?.progress) ? THREE.MathUtils.clamp(input.progress, 0, 1) : 1;
  const complete = input?.complete === true || progress >= 1;
  if (!complete) {
    const foundationLimit = Number(mapping.construction?.foundationAtOrBelow) || 0.275;
    return progress <= foundationLimit ? 'foundation' : 'frame';
  }

  const maxHp = Number(input?.maxHp);
  const hp = Number(input?.hp);
  const harvest = mapping.harvest;
  const exhausted = Number.isFinite(input?.harvestStock) && input.harvestStock <= 0;
  const resolved = state => exhausted && harvest?.exhaustedStates?.[state]
    && manifest.stateOrder.includes(harvest.exhaustedStates[state]) ? harvest.exhaustedStates[state] : state;
  if (Number.isFinite(maxHp) && maxHp > 0 && Number.isFinite(hp)) {
    const ratio = THREE.MathUtils.clamp(hp / maxHp, 0, 1);
    const criticalLimit = Number(mapping.health?.criticalAtOrBelow) || 0.3;
    const damagedLimit = Number(mapping.health?.damagedAtOrBelow) || 0.6;
    if (ratio <= criticalLimit) return resolved('critical');
    if (ratio <= damagedLimit) return resolved('damaged');
  }
  return resolved('complete');
}

function findState(manifest, name) {
  if (name === 'complete') return manifest.completeState;
  return manifest.states?.find((state) => state.state === name) || null;
}

function nearestViewIndex(camera, position, azimuths, orientation = 0) {
  if (!camera || !Array.isArray(azimuths) || azimuths.length === 0) return 0;
  // Orthographic view direction is shared across the map, including after pan.
  const towardCamera = camera.isOrthographicCamera ? camera.getWorldDirection(new THREE.Vector3()).negate() : null;
  const dx = towardCamera?.x ?? camera.position.x - position.x;
  const dz = towardCamera?.z ?? camera.position.z - position.z;
  const cameraAzimuth = (Math.atan2(dx, dz) * 180 / Math.PI - orientation * 90 + 720) % 360;
  let bestIndex = 0;
  let bestDelta = Infinity;
  for (let index = 0; index < azimuths.length; index++) {
    const delta = Math.abs(((cameraAzimuth - azimuths[index] + 540) % 360) - 180);
    if (delta < bestDelta) {
      bestDelta = delta;
      bestIndex = index;
    }
  }
  return bestIndex;
}

function teamColorCss(teamColor) {
  if (typeof teamColor === 'string') return teamColor;
  if (!Number.isFinite(teamColor)) return null;
  return `#${Math.round(teamColor).toString(16).padStart(6, '0').slice(-6)}`;
}

async function composeFrame(view, teamColor, manifestUrl) {
  const color = await loadVerifiedImage(view.path, view.sha256, manifestUrl);
  const colorCss = teamColorCss(teamColor);
  let mask = null;
  if (colorCss && view.teamMaskPath && view.teamMaskSha256) {
    mask = await loadVerifiedImage(view.teamMaskPath, view.teamMaskSha256, manifestUrl);
  }

  const width = color.naturalWidth || color.width;
  const height = color.naturalHeight || color.height;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not create a canvas for the building view');
  context.drawImage(color, 0, 0, width, height);

  if (mask) {
    const overlay = document.createElement('canvas');
    overlay.width = width;
    overlay.height = height;
    const overlayContext = overlay.getContext('2d');
    if (!overlayContext) throw new Error('Could not create a team-color canvas for the building view');
    overlayContext.fillStyle = colorCss;
    overlayContext.fillRect(0, 0, width, height);
    overlayContext.globalCompositeOperation = 'destination-in';
    overlayContext.drawImage(mask, 0, 0, width, height);
    context.globalAlpha = 0.86;
    context.drawImage(overlay, 0, 0);
    context.globalAlpha = 1;
  }
  return canvas;
}

function leaseFrame(view, teamColor, manifestUrl) {
  const masked = teamColorCss(teamColor) && view.teamMaskPath && view.teamMaskSha256;
  const key = JSON.stringify([asAbsoluteUrl(view.path, manifestUrl), view.sha256,
    masked ? [asAbsoluteUrl(view.teamMaskPath, manifestUrl), view.teamMaskSha256, teamColorCss(teamColor)] : null]);
  let entry = frameTextures.get(key);
  if (!entry) {
    entry = { references: 0, texture: null };
    frameTextures.set(key, entry);
    entry.ready = composeFrame(view, masked ? teamColor : null, manifestUrl).then(canvas => {
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = true;
      texture.userData.sharedCapturedFrame = true;
      entry.texture = texture;
      if (!entry.references) texture.dispose();
      return texture;
    }).catch(error => {
      if (frameTextures.get(key) === entry) frameTextures.delete(key);
      throw error;
    });
  }
  entry.references++;
  let released = false;
  return { ready: entry.ready, release() {
    if (released) return;
    released = true;
    if (--entry.references === 0) {
      if (frameTextures.get(key) === entry) frameTextures.delete(key);
      entry.texture?.dispose();
    }
  } };
}

export function createCapturedBuildingSprite({
  manifestUrl = DEFAULT_MANIFEST_URL,
  teamColor = null,
  preview = false,
} = {}) {
  const material = new THREE.SpriteMaterial({
    map: null,
    color: 0xffffff,
    transparent: true,
    alphaTest: 0.025,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
    opacity: preview ? 0.5 : 1,
  });
  applyBuildingGroundDepth(material);
  const sprite = new THREE.Sprite(material);
  sprite.visible = false;
  sprite.renderOrder = 0.9;
  sprite.raycast = preview ? () => {} : function(raycaster, intersects) {
    if (!this.visible || !this.material.map) return;
    const texture = this.material.map, pixels = imageAlphaPixels(texture.image);
    // A failed read leaves the existing geometry/ground target available.
    if (!pixels) return;
    const hits = [];
    THREE.Sprite.prototype.raycast.call(this, raycaster, hits);
    if (texture.matrixAutoUpdate) texture.updateMatrix();
    for (const hit of hits) {
      const uv = texture.transformUv(hit.uv.clone());
      const column = Math.min(pixels.width - 1, Math.max(0, Math.floor(uv.x * pixels.width)));
      const row = Math.min(pixels.height - 1, Math.max(0, Math.floor(uv.y * pixels.height)));
      if (pixels.alpha[row * pixels.width + column] / 255 >= this.material.alphaTest) intersects.push(hit);
    }
  };
  const bodyDepth = new THREE.Sprite(new THREE.SpriteMaterial({
    transparent: false, alphaTest: 0.9, colorWrite: false,
    depthTest: true, depthWrite: true, toneMapped: false,
  }));
  applyBuildingGroundDepth(bodyDepth.material);
  bodyDepth.userData.buildingBodyDepth = true;
  bodyDepth.visible = !preview;
  bodyDepth.raycast = () => {};
  // A child shares the parent's exact world transform; do not scale it again.
  sprite.add(bodyDepth);
  sprite.userData.capturedBuildingArt = {
    bodyDepth,
    manifestUrl: new URL(manifestUrl, import.meta.url).href,
    teamColor,
    manifest: null,
    manifestPromise: null,
    lifecycleInput: 'complete',
    camera: null,
    worldPosition: new THREE.Vector3(),
    requestKey: null,
    requestVersion: 0,
    currentFrame: null,
    pendingFrame: null,
    disposed: false,
    warned: false,
  };
  return sprite;
}

export function updateCapturedBuildingSprite(sprite, camera, lifecycleInput = 'complete') {
  const data = sprite?.userData?.capturedBuildingArt;
  if (!data || data.disposed) return;
  data.camera = camera;
  data.lifecycleInput = lifecycleInput;
  const pending = loadManifest(data.manifestUrl);
  if (data.manifestPromise !== pending) {
    data.manifestPromise = pending;
    data.manifest = null;
    data.requestKey = null;
    data.requestVersion++;
    data.pendingFrame?.release(); data.pendingFrame = null;
    sprite.visible = false;
    pending.then((manifest) => {
      if (!currentManifestRequest(data, pending)) return;
      data.manifest = manifest;
      requestCurrentFrame(sprite, data);
    }).catch((error) => {
      if (!currentManifestRequest(data, pending)) return;
      if (!data.warned) {
        data.warned = true;
        console.warn('Captured building views unavailable; using the procedural Town Center fallback.', error);
      }
    });
  }
  if (data.manifest) requestCurrentFrame(sprite, data);
}

function requestCurrentFrame(sprite, data) {
  if (data.disposed || !data.manifest) return;
  const stateName = lifecycleStateName(data.lifecycleInput, data.manifest);
  const state = findState(data.manifest, stateName);
  if (!state?.views?.length) {
    // A Complete-only source must yield to its fallback during construction/damage.
    // Invalidate pending loads so an older frame cannot become visible afterward.
    if (data.requestKey !== null) { data.requestKey = null; ++data.requestVersion; }
    data.pendingFrame?.release(); data.pendingFrame = null;
    sprite.visible = false;
    if (!data.warned) {
      data.warned = true;
      console.warn(`Captured building state "${stateName}" is missing from ${data.manifest.asset}.`);
    }
    return;
  }
  const position = sprite.parent?.getWorldPosition(data.worldPosition) || sprite.position;
  const viewIndex = nearestViewIndex(data.camera, position, data.manifest.camera.azimuthDegrees,
    typeof data.lifecycleInput === 'object' ? data.lifecycleInput?.orientation ?? 0 : 0);
  const view = state.views.find((candidate) => candidate.index === viewIndex) || state.views[viewIndex];
  if (!view) return;
  const requestKey = `${stateName}:${viewIndex}:${teamColorCss(data.teamColor) || 'plain'}`;
  if (data.requestKey === requestKey) return;
  data.requestKey = requestKey;
  const version = ++data.requestVersion;
  sprite.visible = false;
  data.pendingFrame?.release();
  const frame = leaseFrame(view, data.teamColor, data.manifestUrl);
  data.pendingFrame = frame;

  const dimensions = data.manifest.camera.framePixels;
  const pixelsPerWorldUnit = data.manifest.camera.pixelsPerWorldUnit;
  if (Number.isFinite(pixelsPerWorldUnit) && pixelsPerWorldUnit > 0) {
    sprite.scale.set(dimensions[0] / pixelsPerWorldUnit, dimensions[1] / pixelsPerWorldUnit, 1);
    sprite.center.set(data.manifest.camera.anchorPixelFromTopLeft[0] / dimensions[0],
      1 - data.manifest.camera.anchorPixelFromTopLeft[1] / dimensions[1]);
    data.bodyDepth.center.copy(sprite.center);
    sprite.position.y = 0.035;
  }

  frame.ready.then((texture) => {
    if (!currentManifestRequest(data) || version !== data.requestVersion) return;
    data.pendingFrame = null;
    data.currentFrame?.release(); data.currentFrame = frame;
    sprite.material.map = texture;
    data.bodyDepth.material.map = texture;
    data.bodyDepth.material.needsUpdate = true;
    sprite.material.needsUpdate = true;
    sprite.visible = true;
  }).catch((error) => {
    frame.release();
    if (!currentManifestRequest(data) || version !== data.requestVersion) return;
    data.pendingFrame = null;
    sprite.visible = false;
    if (!data.warned) {
      data.warned = true;
      console.warn(`Captured building view ${requestKey} unavailable; using the procedural Town Center fallback.`, error);
    }
  });
}

export function disposeCapturedBuildingSprite(sprite) {
  const data = sprite?.userData?.capturedBuildingArt;
  if (!data || data.disposed) return;
  data.disposed = true;
  data.requestVersion++;
  sprite.visible = false;
  data.bodyDepth.visible = false;
  data.pendingFrame?.release(); data.pendingFrame = null;
  data.currentFrame?.release(); data.currentFrame = null;
  sprite.material.map = null;
  data.bodyDepth.material.map = null;
  data.bodyDepth.material.dispose();
  sprite.material.dispose();
}
