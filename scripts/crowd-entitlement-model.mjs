// Reference host for the production contract; no parallel movement algorithm.
import { MovingCrowdEntitlement } from '../src/crowd-moving-entitlement.mjs';
import { ordinaryCrowdBodyRadius } from '../src/unit-crowd-steering.mjs';
export { crowdEntitlementBudget as entitlementBudget, crowdMovementStart as movementStart,
  finalizedCrowdProgress as finalizedProgress } from '../src/crowd-moving-entitlement.mjs';
export class MovingEntitlementModel extends MovingCrowdEntitlement {
  constructor() {
    const records=new WeakMap();
    super({stateOf:u=>{ if(!records.has(u)) records.set(u,{offer:null,lease:null,lastGrantTick:-Infinity}); return records.get(u); },
      active:ordinaryCrowdBodyRadius});
    this.records=records;
  }
  restore() { const records=new WeakMap(); this.records=records; this.latest=null;
    this.stateOf=u=>{if(!records.has(u)) records.set(u,{offer:null,lease:null,lastGrantTick:-Infinity});return records.get(u);}; }
  resetRouting(u) { const slot=this.slot(u);slot.request=null;slot.reservation=null;slot.cursor=-1; }
}
