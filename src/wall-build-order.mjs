// Player orders invalidate the sequence by revision; route repairs preserve it.
export function activeWallBuildOrder(unit) {
  const order = unit.wallBuildOrder;
  return order && unit.hp > 0 && order.generation === unit.generation
    && order.revision === unit.orderRevision ? order : null;
}
