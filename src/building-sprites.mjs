import * as THREE from 'three';

const textures = new Map();
const roots = {
  barracks: './assets/buildings/barracks-sprite-test-v1/runtime',
  'archery-range': './assets/buildings/archery-range-sprite-v1/runtime',
  'town-center': './assets/buildings/town-center-meshy-review-v1/runtime',
};

export function buildingSpriteUrl(building) {
  const root = roots[building.type];
  if (!root) return null;
  if (building.type === 'town-center') return `${root}/town-center-view-01.webp`;
  let state = 'complete';
  if (building.complete !== true) {
    const progress = Number(building.progress) || 0;
    state = progress < 0.2 ? 'foundation' : progress < 0.9 ? 'frame' : 'complete';
  } else {
    const maxHp = Number(building.maxHp) || 1800;
    const hp = Number.isFinite(Number(building.hp)) ? Number(building.hp) : maxHp;
    state = hp / maxHp >= 0.66 ? 'complete' : hp / maxHp >= 0.33 ? 'damaged' : 'critical';
  }
  return `${root}/${building.type}-${state}-${building.team === 0 ? 'azure' : 'ember'}.webp`;
}

function loadFrame(url) {
  if (textures.has(url)) return textures.get(url);
  const entry = {};
  entry.ready = new Promise((resolve) => {
    entry.texture = new THREE.TextureLoader().load(url, () => resolve(true), undefined, () => resolve(false));
  });
  entry.texture.colorSpace = THREE.SRGBColorSpace;
  entry.texture.userData.sharedBuildingSprite = true;
  textures.set(url, entry);
  return entry;
}

// Wrap only the model parts. Health, selection, production cues and fog remain
// owned by the existing renderer and the building's outer group.
export function attachBuildingSprite(group, parts, building, position = { x: 0, z: 0 }, load = loadFrame) {
  const fallback = new THREE.Group();
  for (const part of parts) fallback.add(part);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    transparent: true, alphaTest: 0.08, depthTest: true, depthWrite: false, toneMapped: false,
  }));
  applyBuildingGroundDepth(sprite.material);
  sprite.center.set(0.5, building.type === 'town-center' ? 0.4125 : 0.311);
  sprite.scale.set(5, 5, 1);
  sprite.position.set(position.x, 0.035, position.z);
  sprite.visible = false;
  group.add(fallback, sprite);
  let currentUrl;
  let disposed = false;
  const controller = {
    update(next) {
      const url = buildingSpriteUrl(next);
      if (disposed || url === currentUrl) return;
      currentUrl = url;
      sprite.visible = false;
      fallback.visible = true;
      if (!url) return;
      const entry = load(url);
      entry.ready.then((loaded) => {
        if (disposed || currentUrl !== url || !loaded) return;
        sprite.material.map = entry.texture;
        sprite.material.needsUpdate = true;
        sprite.visible = true;
        fallback.visible = false;
      });
    },
    dispose() { disposed = true; },
  };
  controller.update(building);
  group.userData.buildingSprite = controller;
  return controller;
}

export function applyBuildingGroundDepth(material) {
  // Billboard pixels below the ground anchor must use the ground plane's
  // depth, rather than the tilted billboard plane that passes below terrain.
  // Keep depth testing so foreground units and terrain still occlude the art.
  material.onBeforeCompile = (shader) => {
    const declarations = 'varying vec4 vBuildingDepth; varying float vGroundSlope;\n';
    shader.vertexShader = declarations + shader.vertexShader.replace(
      'gl_Position = projectionMatrix * mvPosition;',
      `vBuildingDepth = vec4(rotatedPosition.y, mvPosition.z, projectionMatrix[2][2], projectionMatrix[3][2]);
       vGroundSlope = viewMatrix[1].y / max(0.001, viewMatrix[1].z);
       gl_Position = projectionMatrix * mvPosition;`,
    );
    shader.fragmentShader = declarations + shader.fragmentShader.replace(
      '#include <logdepthbuf_fragment>',
      `#include <logdepthbuf_fragment>
       float groundViewZ = vBuildingDepth.y - min(0.0, vBuildingDepth.x) * vGroundSlope;
       gl_FragDepth = clamp((vBuildingDepth.z * groundViewZ + vBuildingDepth.w) * 0.5 + 0.5, 0.0, 1.0);`,
    );
  };
  material.customProgramCacheKey = () => 'building-ground-depth-v1';
}
