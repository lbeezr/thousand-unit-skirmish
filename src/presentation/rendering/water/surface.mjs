import * as THREE from 'three';
import { buildWaterSurfaceGeometry, WATER_LEVEL } from './geometry.mjs';
import { buildWaterStudyField, createWaterStudyFishSelector, waterStudyTime, WATER_STUDY_FISH_LIMIT } from './state.mjs';

export function waterSurfaceOptions(search = '', reducedMotion = false) {
  const params = new URLSearchParams(search);
  const time = params.get('waterTime') ?? params.get('waterStudyTime');
  return { quality: (params.get('waterQuality') ?? params.get('waterStudyQuality')) === 'low' ? 'low' : 'study', reducedMotion,
    fixedTime: time !== null && time.trim() !== '' && Number.isFinite(Number(time)) ? Number(time) : null };
}

export function createWaterSurfaceStudy(definition, {
  quality = 'study', reducedMotion = false, fixedTime = null,
  getTime = () => 0, geometry = null,
} = {}) {
  geometry ||= buildWaterSurfaceGeometry(definition);
  if (!geometry) return null;
  const fallback = quality === 'low';
  const material = fallback ? new THREE.MeshBasicMaterial({
    vertexColors: true, side: THREE.DoubleSide, toneMapped: false,
  }) : new THREE.ShaderMaterial({
    side: THREE.DoubleSide, toneMapped: false, fog: true,
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      mapSize: { value: new THREE.Vector2(definition.width, definition.height) },
      shoreField: { value: null }, time: { value: 0 },
      seed: { value: (Math.trunc(definition.terrainSeed || 0) >>> 0) % 997 },
      deepColor: { value: new THREE.Color(0x284e60) },
      shallowColor: { value: new THREE.Color(0x568984) },
      glintColor: { value: new THREE.Color(0x9dc3be) },
    },
    vertexShader: /* glsl */`
      varying vec2 waterPosition;
      varying vec3 shoreColor;
      varying float shoreBand;
      attribute vec3 color;
      #include <fog_pars_vertex>
      void main() {
        waterPosition = position.xz;
        shoreColor = color;
        shoreBand = clamp((position.y - 0.032) / 0.004, 0.0, 1.0);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec2 mapSize;
      uniform sampler2D shoreField;
      uniform float time;
      uniform float seed;
      uniform vec3 deepColor, shallowColor, glintColor;
      varying vec2 waterPosition;
      varying vec3 shoreColor;
      varying float shoreBand;
      #include <fog_pars_fragment>
      void main() {
        vec2 uv = (waterPosition + mapSize * 0.5) / mapSize;
        float apparentDepth = texture2D(shoreField, uv).g;
        vec3 color = mix(shallowColor, deepColor, smoothstep(0.02, 0.85, apparentDepth));
        // Low-amplitude directional bands: no displacement, screen/depth copy,
        // reflection target, refraction, bottom claim or passability change.
        float along = dot(waterPosition, normalize(vec2(0.8, 0.6)));
        float across = dot(waterPosition, vec2(-0.6, 0.8));
        float wave = sin(along * 5.4 - time * 0.65 + sin(across * 1.7 + seed) * 0.35);
        float glint = smoothstep(0.82, 0.99, wave) * (0.5 + 0.5 * sin(across * 2.3 + seed));
        color = mix(color, glintColor, glint * 0.075 * (1.0 - shoreBand));
        // Retain the existing sand-aware contour skirt and its exact envelope.
        color = mix(color, shoreColor, shoreBand * 0.8);
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 5;
  mesh.raycast = () => {};
  mesh.userData.waterStudy = { quality: fallback ? 'low' : 'study', apparentDepthOnly: true };
  let settings = { fixedTime, reducedMotion };
  let ripples = null;
  if (!fallback) {
    const field = buildWaterStudyField(definition);
    const texture = new THREE.DataTexture(field.pixels, field.width, field.height, THREE.RGBAFormat);
    texture.magFilter = texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    material.uniforms.shoreField.value = texture;
    mesh.userData.ownedGroundTextures = [texture];
    const rippleMaterial = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, toneMapped: false, fog: true,
      uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
        time: { value: 0 }, motion: { value: reducedMotion ? 0 : 1 }, tint: { value: new THREE.Color(0x9bc0bc) } },
      vertexShader: /* glsl */`
        attribute float phase;
        varying vec2 localUv;
        varying float fishPhase;
        #include <fog_pars_vertex>
        void main() {
          localUv = uv; fishPhase = phase;
          vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }
      `,
      fragmentShader: /* glsl */`
        uniform float time, motion;
        uniform vec3 tint;
        varying vec2 localUv;
        varying float fishPhase;
        #include <fog_pars_fragment>
        void main() {
          float t = fract(time * 0.16 + fishPhase);
          float radius = mix(0.12, 0.46, t);
          float d = length(localUv - 0.5);
          float ring = 1.0 - smoothstep(0.014, 0.035, abs(d - radius));
          float alpha = ring * sin(t * 3.14159265) * 0.25 * motion;
          if (alpha < 0.002) discard;
          gl_FragColor = vec4(tint, alpha);
          #include <colorspace_fragment>
          #include <fog_fragment>
        }
      `,
    });
    const rippleGeometry = new THREE.PlaneGeometry(.72, .72);
    rippleGeometry.rotateX(-Math.PI / 2);
    rippleGeometry.setAttribute('phase', new THREE.InstancedBufferAttribute(new Float32Array(WATER_STUDY_FISH_LIMIT), 1));
    ripples = new THREE.InstancedMesh(rippleGeometry, rippleMaterial, WATER_STUDY_FISH_LIMIT);
    ripples.count = 0; ripples.visible = false; ripples.frustumCulled = false;
    ripples.renderOrder = 6; ripples.raycast = () => {};
    mesh.add(ripples);
  }
  mesh.userData.updateWaterStudy = seconds => {
    const time = waterStudyTime(seconds, settings);
    if (!fallback) {
      material.uniforms.time.value = time;
      ripples.material.uniforms.time.value = time;
      ripples.material.uniforms.motion.value = settings.reducedMotion ? 0 : 1;
      ripples.visible = ripples.count > 0 && !settings.reducedMotion;
    }
  };
  mesh.userData.setWaterStudyMotion = value => { settings = { ...settings, reducedMotion: value === true }; };
  const selectFish = fallback ? () => [] : createWaterStudyFishSelector(definition);
  mesh.userData.updateWaterStudyFish = snapshot => {
    const fish = selectFish(snapshot);
    if (!ripples) return fish;
    ripples.count = fish.length; ripples.visible = fish.length > 0 && !settings.reducedMotion;
    const transform = new THREE.Matrix4(), phase = ripples.geometry.getAttribute('phase');
    fish.forEach((f, i) => {
      transform.makeTranslation(f.x, WATER_LEVEL + .01, f.z);
      ripples.setMatrixAt(i, transform); phase.setX(i, f.phase);
    });
    ripples.instanceMatrix.needsUpdate = true; phase.needsUpdate = true;
    return fish;
  };
  mesh.onBeforeRender = () => mesh.userData.updateWaterStudy(getTime());
  return mesh;
}
