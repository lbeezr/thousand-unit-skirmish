// An explicit Wood/Stone assignment stays near the source the player chose. Current targets may
// change; the original anchor must survive deliveries and temporary work.
import { isAreaGatherResource } from './work-intent.mjs';
export const GATHER_WORK_AREA_RADIUS = 8;

export function gatherWorkArea(source, resource) {
  return isAreaGatherResource(resource) ? { type: resource, x: source.x, z: source.z } : null;
}

export function inGatherWorkArea(area, source) {
  return isAreaGatherResource(area?.type) && source.type === area.type && Number.isFinite(source.stock) && source.stock > 0
    && Number.isFinite(source.x) && Number.isFinite(source.z)
    && Math.hypot(source.x - area.x, source.z - area.z) <= GATHER_WORK_AREA_RADIUS;
}

export function nearbyGatherSources(area, position, sources) {
  return sources.filter(source => inGatherWorkArea(area, source))
    .sort((left, right) => Math.hypot(left.x - position.x, left.z - position.z)
      - Math.hypot(right.x - position.x, right.z - position.z)
      || (String(left.id) < String(right.id) ? -1 : String(left.id) > String(right.id) ? 1 : 0));
}

// Keep the existing Wood-only helper contract for its callers.
export const woodWorkArea = source => gatherWorkArea(source, 'wood');
export const inWoodWorkArea = (area, source) => area?.type === 'wood' && inGatherWorkArea(area, source);
export const nearbyWoodSources = (area, position, sources) => nearbyGatherSources(area?.type === 'wood' ? area : null, position, sources);
