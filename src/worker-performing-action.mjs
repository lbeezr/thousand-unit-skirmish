// Presentation receipts only: this journal never changes authoritative units.
export const WORKER_PERFORMING_ACTION_VERSION = 1;
export const WORKER_PERFORMING_ACTIONS = Object.freeze([
  'gather-food', 'gather-wood', 'gather-stone', 'build', 'repair',
]);

export function createWorkerPerformingActions() {
  const receipts = new Map();
  let preceding = new Map();
  let stepTick = -1;
  function read(unit, tick, compatible) {
    const receipt = receipts.get(unit);
    if (!receipt || tick !== stepTick || receipt.tick !== tick
      || unit.kind !== 'worker' || unit.hp <= 0
      || unit.generation !== receipt.generation || unit.orderRevision !== receipt.orderRevision
      || !compatible(unit, receipt)) return null;
    return receipt.action;
  }
  return {
    beginStep(tick) { receipts.clear(); stepTick = tick; },
    record(unit, action, target) {
      if (unit.kind !== 'worker' || unit.hp <= 0 || !WORKER_PERFORMING_ACTIONS.includes(action)) return;
      receipts.set(unit, { action, target, tick: stepTick,
        generation: unit.generation, orderRevision: unit.orderRevision });
    },
    read,
    // Compare resolved action identity, not transient object identity. Clearing a
    // receipt dirties state even when an assigned repair has run out of wood.
    finishStep(tick, compatible) {
      const current = new Map();
      for (const unit of receipts.keys()) {
        const action = read(unit, tick, compatible);
        if (action !== null) current.set(unit, action);
      }
      const changed = current.size !== preceding.size
        || [...current].some(([unit, action]) => preceding.get(unit) !== action);
      preceding = current;
      return changed;
    },
    clear() { receipts.clear(); preceding.clear(); stepTick = -1; },
  };
}
