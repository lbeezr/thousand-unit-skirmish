// Independent, seeded texture placements blended on a triangle lattice.
// This is a lightweight tiling prototype, not histogram-preserving synthesis.
const FUNCTIONS = /* glsl */`
#ifdef USE_MAP
uniform float vaeloraTerrainSeed;
uniform float vaeloraFreeRotation;
#ifdef VAELORA_GROUND_ATLAS
uniform vec4 vaeloraMapRect;
#endif
#ifdef VAELORA_GROUND_VARIANT
uniform sampler2D vaeloraVariantMap;
#endif
#ifdef VAELORA_VARIANT_ATLAS
uniform vec4 vaeloraVariantRect;
#endif
#if defined(VAELORA_GROUND_ATLAS) || defined(VAELORA_VARIANT_ATLAS)
vec4 vaeloraAtlasSample(sampler2D terrainMap, vec2 uv, vec2 dx, vec2 dy, vec4 rect) {
  vec2 phase = mod(uv, 2.0);
  vec2 flip = step(vec2(1.0), phase);
  vec2 mirrored = mix(phase, 2.0 - phase, flip);
  // Fold each actual sample, after stochastic rotation/offset. Interpolating
  // folded vertex UVs would stretch a paint across repeat boundaries.
  vec2 gradientSign = 1.0 - 2.0 * flip;
  vec2 atlasDx = dx * rect.zw, atlasDy = dy * rect.zw;
  // Preserve gradient direction/aspect while bounding the filter footprint at
  // mip 5 (32 base texels), safely inside the 64-texel mirrored gutters.
  float footprint = max(length(atlasDx * 1920.0), length(atlasDy * 1920.0));
  float mipCap = min(1.0, 32.0 / max(footprint, 0.0001));
  return textureGrad(terrainMap, rect.xy + mirrored * rect.zw,
    atlasDx * gradientSign * mipCap, atlasDy * gradientSign * mipCap);
}
#endif
vec4 vaeloraMapSample(sampler2D terrainMap, vec2 uv, vec2 dx, vec2 dy) {
#ifdef VAELORA_GROUND_ATLAS
  return vaeloraAtlasSample(terrainMap, uv, dx, dy, vaeloraMapRect);
#else
  return textureGrad(terrainMap, uv, dx, dy);
#endif
}
vec2 vaeloraHash(vec2 p) {
  p += vaeloraTerrainSeed;
  return fract(sin(vec2(dot(p, vec2(127.1, 311.7)),
    dot(p, vec2(269.5, 183.3)))) * 43758.5453);
}
vec4 vaeloraPatch(sampler2D terrainMap, vec2 uv, vec2 anchor, vec2 dx, vec2 dy) {
  vec2 random = vaeloraHash(anchor);
  float angle = mix(floor(random.x * 4.0) * 1.57079632679,
    random.x * 6.28318530718, vaeloraFreeRotation);
  mat2 rotation = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
#ifdef VAELORA_GROUND_VARIANT
  // One source per lattice anchor; adjacent anchors blend continuously using
  // the existing three weights. Each branch samples one source per patch.
  if (vaeloraHash(anchor + vec2(43.0, 19.0)).y > 0.5) {
#ifdef VAELORA_VARIANT_ATLAS
    return vaeloraAtlasSample(vaeloraVariantMap, rotation * uv + random * 7.0,
      rotation * dx, rotation * dy, vaeloraVariantRect);
#else
    return textureGrad(vaeloraVariantMap, rotation * uv + random * 7.0,
      rotation * dx, rotation * dy);
#endif
  }
#endif
  return vaeloraMapSample(terrainMap, rotation * uv + random * 7.0,
    rotation * dx, rotation * dy);
}
vec4 vaeloraGround(sampler2D terrainMap, vec2 uv, vec2 dx, vec2 dy) {
  vec2 skew = vec2(uv.x - uv.y * 0.57735026919, uv.y * 1.15470053838) * 1.4;
  vec2 cell = floor(skew), f = fract(skew);
  vec2 a, b, c;
  vec3 weights;
  if (f.x + f.y < 1.0) {
    a = cell; b = cell + vec2(1.0, 0.0); c = cell + vec2(0.0, 1.0);
    weights = vec3(1.0 - f.x - f.y, f.x, f.y);
  } else {
    a = cell + vec2(1.0); b = cell + vec2(0.0, 1.0); c = cell + vec2(1.0, 0.0);
    weights = vec3(f.x + f.y - 1.0, 1.0 - f.x, 1.0 - f.y);
  }
  // Narrow the overlap to keep the painted strokes from becoming a muddy blur.
  weights *= weights;
  weights /= dot(weights, vec3(1.0));
  vec4 result = vaeloraPatch(terrainMap, uv, a, dx, dy) * weights.x
    + vaeloraPatch(terrainMap, uv, b, dx, dy) * weights.y
    + vaeloraPatch(terrainMap, uv, c, dx, dy) * weights.z;
  // One broad, quiet value field, rather than stacking fractal detail noise.
  vec2 macroUv = uv / 4.5;
  vec2 macroCell = floor(macroUv), t = fract(macroUv);
  t = t * t * (3.0 - 2.0 * t);
  float macro = mix(mix(vaeloraHash(macroCell).x,
    vaeloraHash(macroCell + vec2(1.0, 0.0)).x, t.x),
    mix(vaeloraHash(macroCell + vec2(0.0, 1.0)).x,
    vaeloraHash(macroCell + vec2(1.0)).x, t.x), t.y);
  result.rgb *= mix(0.95, 1.05, macro);
  return result;
}
#endif
`;

export function applyTerrainTextureSampling(material, seed = 0, enabled = true, freeRotation = false, variantTexture = null) {
  const mapRect = material.map?.userData.paintedMaterialAtlasUvRect;
  const variantRect = enabled && variantTexture?.userData.paintedMaterialAtlasUvRect;
  if (!enabled && !mapRect) return material;
  if (mapRect) material.defines = { ...material.defines, VAELORA_GROUND_ATLAS: 1 };
  if (variantRect) material.defines = { ...material.defines, VAELORA_VARIANT_ATLAS: 1 };
  if (!enabled) variantTexture = null;
  if (variantTexture) {
    material.defines = { ...material.defines, VAELORA_GROUND_VARIANT: 1 };
    material.userData.groundVariantTexture = variantTexture;
  }
  material.onBeforeCompile = (shader) => {
    shader.uniforms.vaeloraTerrainSeed = { value: (seed % 997) / 17 };
    shader.uniforms.vaeloraFreeRotation = { value: freeRotation ? 1 : 0 };
    const glRect = rect => [rect.min.u, 1 - rect.max.v,
      rect.max.u - rect.min.u, rect.max.v - rect.min.v];
    if (mapRect) shader.uniforms.vaeloraMapRect = { value: glRect(mapRect) };
    if (variantRect) shader.uniforms.vaeloraVariantRect = { value: glRect(variantRect) };
    if (variantTexture) shader.uniforms.vaeloraVariantMap = { value: variantTexture };
    shader.fragmentShader = FUNCTIONS + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', /* glsl */`
      #ifdef USE_MAP
        // Derivatives precede coverage discard so sparse paint edges retain
        // correct mip selection. Empty mask pixels skip all three ground reads.
        vec2 vaeloraDx = dFdx(vMapUv), vaeloraDy = dFdy(vMapUv);
      #endif
      #ifdef USE_ALPHAMAP
        float vaeloraPaintAlpha = texture2D(alphaMap, vAlphaMapUv).g;
        if (vaeloraPaintAlpha < 0.001) discard;
      #endif
      #ifdef USE_MAP
        diffuseColor *= ${enabled ? 'vaeloraGround' : 'vaeloraMapSample'}(map, vMapUv, vaeloraDx, vaeloraDy);
      #endif
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <alphamap_fragment>', `
      #ifdef USE_ALPHAMAP
        diffuseColor.a *= vaeloraPaintAlpha;
      #endif
    `);
  };
  material.customProgramCacheKey = () => `vaelora-ground-v5:${enabled}:${freeRotation}:${Boolean(variantTexture)}:${Boolean(mapRect)}:${Boolean(variantRect)}`;
  return material;
}
