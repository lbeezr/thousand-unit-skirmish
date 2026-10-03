const manifests = Object.freeze(Object.fromEntries([
  ['town-center', 'frontier-civilization-scale-pilot-v1'],
  ['house', 'frontier-civilization-scale-pilot-v1'],
  ['storehouse', 'frontier-civilization-models-v1'],
  ['stable', 'frontier-civilization-models-v1'],
  ['workshop', 'frontier-civilization-models-v1'],
  ['watchtower', 'frontier-civilization-models-v1'],
].map(([type, pack]) => [type,
  new URL(`../assets/buildings/${pack}/${type}-complete-renderer.json`, import.meta.url).href,
])));

// A named preview requests one family. "1" retains the full-checkout comparison.
export function frontierBuildingPreviewUrl(type, mode) {
  return (mode === '1' || mode === type) && Object.hasOwn(manifests, type)
    ? manifests[type] : null;
}
