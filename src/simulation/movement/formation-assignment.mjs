function projectedPosition(unit, axis) {
  return unit.x * axis.x + unit.z * axis.z;
}

function compareStableId(left, right) {
  const leftId = Number.isFinite(left.id) ? left.id : Number.MAX_SAFE_INTEGER;
  const rightId = Number.isFinite(right.id) ? right.id : Number.MAX_SAFE_INTEGER;
  return leftId - rightId;
}

export function orderUnitsForFormation(units, layout) {
  if (!Array.isArray(units)) return [];
  if (units.length < 2) return units.slice();
  if (!layout || !Number.isFinite(layout.rows)
    || !layout.direction || !Number.isFinite(layout.direction.x) || !Number.isFinite(layout.direction.z)
    || !layout.side || !Number.isFinite(layout.side.x) || !Number.isFinite(layout.side.z)) {
    return units.slice().sort(compareStableId);
  }

  // A one-row shape has no depth to preserve, so place units across its full lateral span first.
  const primary = layout.rows === 1 ? layout.side : layout.direction;
  const secondary = layout.rows === 1 ? layout.direction : layout.side;
  return units.slice().sort((left, right) => (
    projectedPosition(left, primary) - projectedPosition(right, primary)
    || projectedPosition(left, secondary) - projectedPosition(right, secondary)
    || compareStableId(left, right)
  ));
}
