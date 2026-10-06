// Executable engineering contract, not a production controller/import.
import { LAND_CLEARANCE_PROFILE, pointSegmentDistanceSquared } from '../src/unit-movement.mjs';
import { ordinaryCrowdBodyRadius } from '../src/unit-crowd-steering.mjs';
import { classifyQueueGeometry } from './crowd-queue-geometry.mjs';
const EPS = 1e-9, LIMIT = 64, PROPOSALS = 128;
const point = u => ({ x:u.x, z:u.z });
const same = (a,b) => a && b && a.x === b.x && a.z === b.z;
const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
const radius = u => LAND_CLEARANCE_PROFILE.radiusByKind[u.kind];
const finite = p => p && Number.isFinite(p.x) && Number.isFinite(p.z);
function directedJoin(u,p) {
  const own=u.path.slice(u.pathIndex,u.pathIndex+3);
  return own.length===3 && new Set(own).size===3 && own.every(Number.isInteger) && own.every(cell=>cell>=0)
    && [p.pathIndex,p.pathIndex-1].some(i=>i>=0 && own.every((cell,k)=>p.path[i+k]===cell));
}
function segmentDistance(a,b,c,d) {
  const ax=b.x-a.x, az=b.z-a.z, bx=d.x-c.x, bz=d.z-c.z, den=ax*bz-az*bx;
  if (den !== 0) {
    const t=((c.x-a.x)*bz-(c.z-a.z)*bx)/den, v=((c.x-a.x)*az-(c.z-a.z)*ax)/den;
    if (t>=0 && t<=1 && v>=0 && v<=1) return 0;
  }
  return Math.min(pointSegmentDistanceSquared(a,c,d),pointSegmentDistanceSquared(b,c,d),
    pointSegmentDistanceSquared(c,a,b),pointSegmentDistanceSquared(d,a,b));
}
const separated = (from,to,r,u) => segmentDistance(from,to,r.from,r.to) >= (radius(u)+r.radius-EPS)**2;
const stamp = (u,c) => ({ generation:u.generation, kind:u.kind, radius:radius(u), revision:u.orderRevision, path:u.path,
  index:u.pathIndex, goal:u.moveGoalCell, waypoint:point(c.pointOf(u)), nav:c.nav, epoch:c.epoch });
const matches = (s,u,c) => s && ordinaryCrowdBodyRadius(u)>0 && s.generation===u.generation
  && s.kind===u.kind && s.radius===radius(u) && s.revision===u.orderRevision && s.path===u.path
  && s.index===u.pathIndex && s.goal===u.moveGoalCell
  && s.nav===c.nav && s.epoch===c.epoch && same(s.waypoint,c.pointOf(u));

export class MovingEntitlementModel {
  records = new WeakMap();
  state(u) {
    if (!this.records.has(u)) this.records.set(u,{offer:{request:null,reservation:null,cursor:-1,issuedTick:-Infinity},
      lease:null,lastGrantTick:-Infinity});
    return this.records.get(u);
  }
  restore() { this.records = new WeakMap(); } // Atomic cold/epoch retirement, no saved protocol state.
  resetRouting(u) { const s=this.state(u); s.offer.request=null; s.offer.reservation=null;
    s.offer.cursor=-1; /* Keep safety-only lease across the recipient's own route/order changes. */ }
  live(r,c) { return r && this.state(r.owner).offer.reservation===r && c.tick>=r.tick && c.tick<=r.tick+1
    && matches(r.stamp,r.owner,c) && same(r.from,r.owner); }
  obligation(u,c) { const l=this.state(u).lease;
    return l && u.hp>0 && l.generation===u.generation && this.live(l.reservation,c) ? l : null; }
  guard(u,from,to,c,b) {
    if (c.overflow || c.neighbors.length>LIMIT) return false;
    // At most64 queried reservations plus the actor's own captured obligation.
    const reservations=new Set(c.neighbors.map(other=>this.state(other).offer.reservation));
    const own=this.obligation(u,c); if(own) reservations.add(own.reservation);
    for(const r of reservations) if(r?.owner!==u && this.live(r,c)) {
      b.reservationVisits++; if(!separated(from,to,r,u)) return false;
    }
    return true;
  }
  admit(u,from,to,c,b) {
    if(!finite(from) || !finite(to) || c.overflow || c.neighbors.length>LIMIT || b.proposals>=PROPOSALS
      || distance(from,to)<=EPS || distance(from,to)>Math.min(.25,c.budgetOf(u))+EPS) return false;
    b.proposals++;
    return c.admit(u,from,to) && this.guard(u,from,to,c,b);
  }
  eligible(q,peer,c) {
    if (!(q && q.tick===c.tick-1 && q.peer===peer && peer.id<q.unit.id
      && directedJoin(q.unit,peer)
      && matches(q.stamp,q.unit,c) && matches(q.peerStamp,peer,c) && same(q.from,q.unit)
      && !c.maneuver(q.unit) && !this.obligation(q.unit,c)
      && classifyQueueGeometry({...q,peer,radius:radius(q.unit),peerRadius:radius(peer),
        progressTarget:c.pointOf(q.unit)})==='lateral-rejoin')) return false;
    const claims=c.claims(q.unit,q.to); return claims.length===1 && claims[0]===peer;
  }
  request(u,peer,to,routeDirection,c,b) {
    const s=this.state(u),claims=c.claims(u,to);
    if(!ordinaryCrowdBodyRadius(u) || !ordinaryCrowdBodyRadius(peer) || peer.id>=u.id || !directedJoin(u,peer)
      || c.maneuver(u) || this.obligation(u,c) || claims.length!==1 || claims[0]!==peer
      || classifyQueueGeometry({from:u,to,peer,routeDirection,progressTarget:c.pointOf(u),
        radius:radius(u),peerRadius:radius(peer)})!=='lateral-rejoin' || distance(to,c.pointOf(u))<=EPS
      || !this.admit(u,u,to,c,b)) return false;
    s.offer.request={unit:u,peer,from:point(u),to:point(to),routeDirection:point(routeDirection),
      stamp:stamp(u,c),peerStamp:stamp(peer,c),tick:c.tick}; return true;
  }
  publish(u,to,receipt,c,b) {
    const s=this.state(u),slot=s.offer;
    if(slot.issuedTick===c.tick) return null;
    slot.issuedTick=c.tick;
    if(!receipt?.finalized || receipt.tick!==c.tick || !same(receipt.to,u)
      || !matches(receipt.beforeStamp,u,c) || !matches(receipt.stamp,u,c) || !ordinaryCrowdBodyRadius(u) || c.maneuver(u)
      || c.claims(u,to).length || distance(receipt.from,c.pointOf(u))<=distance(u,c.pointOf(u))+EPS
      || distance(u,c.pointOf(u))<=distance(to,c.pointOf(u))+EPS || distance(to,c.pointOf(u))<=EPS
      || !this.admit(u,u,to,c,b)) return null;
    const contenders=c.neighbors.map(other=>this.state(other).offer.request).filter(q=>this.eligible(q,u,c))
      .sort((a,b)=>a.unit.id-b.unit.id);
    const ordered=[...contenders.filter(q=>q.unit.id>slot.cursor),...contenders.filter(q=>q.unit.id<=slot.cursor)];
    const r={owner:u,from:point(u),to:point(to),radius:radius(u),stamp:stamp(u,c),tick:c.tick,
      winner:null,request:null,attempted:false};
    for(const q of ordered) {
      if(b.proposals>=PROPOSALS) break;
      slot.cursor=q.unit.id; // Attempts rotate even if admission/acknowledgement later fails.
      if(!this.admit(q.unit,q.from,q.to,c,b) || !separated(q.from,q.to,r,q.unit)) continue;
      r.winner=q.unit; r.request=q; slot.reservation=r; return r;
    }
    return null;
  }
  prepareIngress(u,peer,c,b) {
    const s=this.state(u),r=this.state(peer).offer.reservation,q=s.offer.request;
    if(!this.live(r,c) || c.tick!==r.tick || r.winner!==u || r.request!==q || !this.eligible(q,peer,c)
      || !this.admit(u,q.from,q.to,c,b)) return null;
    s.lease={kind:'ingress-obligation',generation:u.generation,reservation:r,pending:true,from:q.from,to:q.to};
    return point(q.to);
  }
  finishIngress(u,receipt,c) {
    const s=this.state(u),l=s.lease; if(!l?.pending) return false;
    l.pending=false; s.offer.request=null;
    const committed=receipt?.finalized && receipt.tick===c.tick && matches(l.reservation.request.stamp,u,c)
      && matches(receipt.beforeStamp,u,c) && matches(receipt.stamp,u,c)
      && this.live(l.reservation,c) && same(receipt.from,l.from)
      && same(receipt.to,l.to) && same(u,l.to);
    if(committed) s.lastGrantTick=c.tick;
    // A guarded fallback still keeps its obligation, without claiming ingress credit.
    if(same(u,l.from)) s.lease=null;
    return Boolean(committed);
  }
  take(u,c,b) {
    const s=this.state(u),r=s.offer.reservation;
    if(r?.attempted) throw Error('finish the reserved admission before another selection');
    const ack=r && this.obligation(r.winner,c);
    if(!this.live(r,c) || c.tick!==r.tick+1 || ack?.reservation!==r || ack.pending || c.maneuver(u)
      || c.claims(u,r.to).length || !this.admit(u,u,r.to,c,b)) { s.offer.reservation=null; return null; }
    r.attempted=true; return point(r.to); // Exact named quantum; do not rerank tangents.
  }
  finish(u,receipt,c) {
    const s=this.state(u),r=s.offer.reservation;
    const committed=r?.attempted && receipt?.finalized && receipt.tick===c.tick
      && matches(r.stamp,u,c) && matches(receipt.beforeStamp,u,c) && matches(receipt.stamp,u,c)
      && same(receipt.from,r.from) && same(receipt.to,r.to) && same(u,r.to);
    s.offer.reservation=null; return Boolean(committed); // One attempt, including failure.
  }
}

export const entitlementBudget = (proposals=0) => ({proposals,reservationVisits:0});
export const movementStart = (u,c) => ({from:point(u),stamp:stamp(u,c),tick:c.tick});
// The host alone asserts finalized after all authoritative writes/budget accounting.
export const finalizedProgress = (u,start,c) => ({from:start.from,to:point(u),beforeStamp:start.stamp,
  stamp:stamp(u,c),tick:c.tick,finalized:start.tick===c.tick});
