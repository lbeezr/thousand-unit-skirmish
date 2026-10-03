import { isShoreFish, SHORE_FISH_VARIANT } from './shore-fishing.mjs';
import { shoreFishSitePositions } from './shore-fishing-placement.mjs';
import { headingToTarget } from './unit-heading.mjs';

// Map definitions are replaced on publish/reset/recovery. Cache derived visual
// points by definition identity; never persist them or use them for navigation.
const waterByMap = new WeakMap();

export function workerFishingPresentation(unit, node, map) {
  if (unit.hp <= 0 || unit.kind !== 'worker' || unit.gatherPhase !== 'gathering'
    || unit.gatherForestCell >= 0 || !isShoreFish(node)) return null;
  let waterById = waterByMap.get(map);
  if (!waterById) {
    waterById = new Map(shoreFishSitePositions(map).map(site => [site.nodeId, site.water]));
    waterByMap.set(map, waterById);
  }
  const water = waterById.get(node.id);
  if (!water) return null;
  return { resourceVariant: SHORE_FISH_VARIANT,
    heading: headingToTarget(unit.x, unit.z, water.x, water.z) };
}
