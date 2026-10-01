// The map's semantic paint roles remain unchanged. Regions own the pixels.
import { TERRAIN_COLORS } from './terrain-materials.mjs';

const UNDERBOUGH_GROUNDS = Object.freeze({
  meadow: 'underbough-clearing-grass-v2',
  'short-grass': 'underbough-clearing-grass-v2',
  'long-grass': 'underbough-dense-growth-v2',
  'forest-floor': 'underbough-root-soil-v2',
  dirt: 'underbough-worn-dirt-v2',
});

// Average source RGB values keep diagram paint and exposed borders in the kit.
const UNDERBOUGH_COLORS = Object.freeze({
  meadow: '#63532c', 'short-grass': '#63532c', 'long-grass': '#574a1e',
  'forest-floor': '#4b3519', dirt: '#71533b',
});

export function regionalGroundTextureName(definition, material, enabled = true) {
  if (enabled && definition?.region === 'underbough') {
    return UNDERBOUGH_GROUNDS[material] || material;
  }
  return material;
}

export function regionalGroundVariantTextureName(definition, material, enabled = true) {
  return enabled && definition?.region === 'underbough' && ['meadow', 'short-grass'].includes(material)
    ? 'underbough-clearing-grass-02-v2' : null;
}

export function regionalGroundColor(definition, material) {
  const enabled = new URLSearchParams(globalThis.location?.search ?? '').get('regionalGrounds') !== 'legacy';
  return (enabled && definition?.region === 'underbough' && UNDERBOUGH_COLORS[material])
    || TERRAIN_COLORS[material] || TERRAIN_COLORS.meadow;
}
