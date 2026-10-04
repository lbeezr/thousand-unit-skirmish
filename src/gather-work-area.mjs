// A wood assignment stays near the source the player chose. Current targets may
// change; the original anchor must survive deliveries and temporary work.
export const GATHER_WORK_AREA_RADIUS = 8;

export function woodWorkArea(source) {
  return { type: 'wood', x: source.x, z: source.z };
}

export function inWoodWorkArea(area, source) {
  return area?.type === 'wood' && source.type === 'wood' && Number.isFinite(source.stock) && source.stock > 0
    && Number.isFinite(source.x) && Number.isFinite(source.z)
    && Math.hypot(source.x - area.x, source.z - area.z) <= GATHER_WORK_AREA_RADIUS;
}

export function nearbyWoodSources(area, position, sources) {
  return sources.filter(source => inWoodWorkArea(area, source))
    .sort((left, right) => Math.hypot(left.x - position.x, left.z - position.z)
      - Math.hypot(right.x - position.x, right.z - position.z)
      || (String(left.id) < String(right.id) ? -1 : String(left.id) > String(right.id) ? 1 : 0));
}
