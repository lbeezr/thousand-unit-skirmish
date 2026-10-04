// Ordinary catalog policy; canonical maps and checkpoint restoration stay separate.
export const ORDINARY_MAP_MIN_SIDE = 160;
export const MAP_SIZE_TIERS = Object.freeze([
  Object.freeze({ id: 'tiny', label: 'Tiny', side: 160, workerTravelTargetSeconds: [50, 60], engineLimitAllows: true }),
  Object.freeze({ id: 'small', label: 'Small', side: 192, workerTravelTargetSeconds: [60, 75], engineLimitAllows: true }),
  Object.freeze({ id: 'medium', label: 'Medium', side: 224, workerTravelTargetSeconds: [75, 90], engineLimitAllows: true }),
  Object.freeze({ id: 'large', label: 'Large', side: 256, workerTravelTargetSeconds: [90, 105], engineLimitAllows: true }),
  Object.freeze({ id: 'xl', label: 'XL', side: 320, workerTravelTargetSeconds: [105, 125], engineLimitAllows: false }),
]);

/** Exact dimensions remain visible; rectangular maps use their shorter side's tier. */
export function mapSizeIdentity(map) {
  const { width, height } = map ?? {};
  if (![width, height].every(side => Number.isInteger(side) && side > 0)) {
    throw new TypeError('Map size identity needs positive integer width and height.');
  }
  const shorterSide = Math.min(width, height);
  const tier = [...MAP_SIZE_TIERS].reverse().find(value => shorterSide >= value.side);
  return {
    width, height, sizeTierId: tier?.id ?? 'internal', sizeTierLabel: tier?.label ?? 'Internal fixture',
    ordinarySelectable: shorterSide >= ORDINARY_MAP_MIN_SIDE && Math.max(width, height) <= 256,
    // A tier/grid size never promises browser, hosting or army capacity.
    supportedUnitCapacity: null,
  };
}

/** A current small map can be displayed/restored, but cannot be newly selected. */
export function ordinaryMapCatalog(maps, currentMapId = null) {
  return maps.flatMap(map => {
    const identity = mapSizeIdentity(map);
    if (!identity.ordinarySelectable && map.id !== currentMapId) return [];
    return [{ ...map, ...identity, selectable: identity.ordinarySelectable,
      legacyCurrent: !identity.ordinarySelectable && map.id === currentMapId }];
  });
}
