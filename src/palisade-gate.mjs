// Gates change global walkability. Ownership controls operation, never traversal.
export const isPalisade = type => type === 'palisade-wall' || type === 'palisade-gate';

export function validGateState(building) {
  return building.type === 'palisade-gate'
    ? typeof building.gateOpen === 'boolean' && (!building.gateOpen || building.complete === true)
    : !Object.hasOwn(building, 'gateOpen');
}

export function buildingBlocksMovement(building) {
  return !(building.type === 'palisade-gate' && building.complete && building.gateOpen === true);
}

// The caller supplies a staged, reversible connectivity assessment for closing.
// This planner never changes a building, economy, navigation cache or unit order.
export function planGateTransition({ building, team, open, occupied = false, canClose = () => false }) {
  if ((team !== 0 && team !== 1) || !building || building.team !== team || building.type !== 'palisade-gate') {
    return { status: 'rejected', reason: 'SELECT YOUR GATE' };
  }
  if (typeof open !== 'boolean') return { status: 'rejected', reason: 'OPEN MUST BE TRUE OR FALSE' };
  if (!building.complete || building.hp <= 0) return { status: 'rejected', reason: 'FINISH CONSTRUCTION FIRST' };
  if (building.gateOpen === open) return { status: 'unchanged', open };
  if (!open && occupied) return { status: 'rejected', reason: 'UNITS IN GATE' };
  if (!open && !canClose()) return { status: 'rejected', reason: 'WOULD BLOCK A ROUTE' };
  return { status: 'ready', open };
}
