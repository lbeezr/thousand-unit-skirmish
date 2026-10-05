// Diagnostic kinematic exclusions. Included bodies are possible, not proven
// terrain-reachable or causal. No production caller consumes these rules.
import assert from 'node:assert/strict';
import { pointSegmentDistanceSquared, segmentRectangleDistanceSquared } from '../src/unit-movement.mjs';
const EPS = 1e-9;
export const INFLUENCE_HORIZONS = Object.freeze([1, 3, 6, 9, 12]);
const finite = p => Number.isFinite(p?.x) && Number.isFinite(p?.z);
export function queryReach(owner, peers, ticks, length = .75) {
  return Math.min(length, owner.speed * ticks / 30) + owner.radius
    + Math.max(...peers.map(p => p.radius + p.speed * ticks / 30));
}
export function corridorInfluence(owner, bodies, { ticks, length = .75, direction = { x: 1, z: 0 } }) {
  assert.ok(finite(owner) && owner.radius > 0 && owner.speed > 0 && Number.isInteger(ticks) && ticks >= 1 && ticks <= 12);
  assert.ok(bodies.length <= 256 && length >= 0 && length <= .75 && finite(direction));
  const norm = Math.hypot(direction.x, direction.z); assert.ok(norm > 0);
  const at = d => ({ x: owner.x + direction.x / norm * d, z: owner.z + direction.z / norm * d });
  const end = at(Math.min(length, owner.speed * ticks / 30));
  const members = [], stats = { bodyVisits: 0, corridorDistances: 0, nominalSegmentDistances: 0 };
  for (const b of bodies) {
    if (b.id === owner.id) continue;
    assert.ok(finite(b) && b.radius > 0 && Number.isFinite(b.speed) && b.speed >= 0);
    stats.bodyVisits++; stats.corridorDistances++;
    const distance = Math.sqrt(pointSegmentDistanceSquared(b, owner, end));
    const reach = owner.radius + b.radius + b.speed * ticks / 30;
    if (distance > reach + EPS) continue;
    let earliestNominalTick = null;
    for (let k = 1; k <= ticks; k++) {
      stats.nominalSegmentDistances++;
      const from = at(Math.min(length, owner.speed * (k - 1) / 30)), to = at(Math.min(length, owner.speed * k / 30));
      // This labelled view assumes maximal early owner progress. The safe
      // inclusion above uses the entire horizon and permits owner delay.
      if (Math.sqrt(pointSegmentDistanceSquared(b, from, to)) <= owner.radius + b.radius + b.speed * k / 30 + EPS) {
        earliestNominalTick = k; break;
      }
    }
    members.push({ id: b.id, distance, reach, frozen: b.speed === 0, earliestNominalTick });
  }
  return { end, members: members.sort((a, b) => a.id - b.id), stats };
}
export function rootEnvelope(roots, bodies, ticks, length = .75) {
  assert.ok(roots.length >= 1 && roots.length <= 4 && bodies.length <= 256 && Number.isInteger(ticks) && ticks >= 1 && ticks <= 12);
  const ids = new Set(), stats = { pairDistances: 0 };
  for (const root of roots) for (const b of bodies) {
    if (b.id === root.id) continue;
    stats.pairDistances++;
    if (Math.hypot(root.x - b.x, root.z - b.z) <= Math.min(length, root.speed * ticks / 30)
      + root.radius + b.radius + b.speed * ticks / 30 + EPS) ids.add(b.id);
  }
  return { ids: [...ids].sort((a, b) => a - b), stats };
}
export function inputDependencyClosure(movers, rootIds, ticks = 0) {
  assert.ok(movers.length <= 64 && Number.isInteger(ticks) && ticks >= 0 && ticks <= 12);
  assert.equal(new Set(movers.map(b => b.id)).size, movers.length);
  const edges = new Map(movers.map(b => [b.id, []])); let pairDistances = 0;
  for (let i = 0; i < movers.length; i++) for (let j = i + 1; j < movers.length; j++) {
    const a = movers[i], b = movers[j]; pairDistances++;
    // Current2.1 input edges, or conservative possible future input edges.
    // Transitive closure is potential dependency, never observed causality.
    if (Math.hypot(a.x - b.x, a.z - b.z) <= 2.1 + (a.speed + b.speed) * ticks / 30 + EPS) {
      edges.get(a.id).push(b.id); edges.get(b.id).push(a.id);
    }
  }
  const seen = new Set(rootIds), pending = [...rootIds]; assert.ok(rootIds.every(id => edges.has(id)));
  let edgeVisits = 0;
  for (let index = 0; index < pending.length; index++) for (const id of edges.get(pending[index])) {
    edgeVisits++; if (!seen.has(id)) { seen.add(id); pending.push(id); }
  }
  return { ids: [...seen].sort((a, b) => a - b), stats: { pairDistances, edgeVisits } };
}
export function physicalBoundaryDecision({ owner, peers, ticks, query, influence, closure, cohortIds }) {
  const reasons = [], requiredRadius = queryReach(owner, peers, ticks);
  if (!query || query.overflow !== false || !Number.isInteger(query.visits) || query.visits < 0 || query.visits > 128
    || !Array.isArray(query.neighbors) || query.neighbors.length > 64) reasons.push('query-refused');
  if (!(query?.coveredRadius >= requiredRadius - EPS)) reasons.push('horizon-outside-certified-query');
  if (influence.members.some(b => !cohortIds.includes(b.id))) reasons.push('outside-physical-influence');
  if (closure.ids.some(id => !cohortIds.includes(id))) reasons.push('outside-input-dependency');
  return { status: reasons.length ? 'refuse' : 'candidate-witness-only', requiredRadius, reasons };
}

// Diagnostic current-live-position index. Building it is separately charged;
// it is not the production start-of-tick bucket index or an admission adapter.
export function regionCandidates(bodies, region, reach, { offset = { x: 0, z: 0 }, padding = 0 } = {}) {
  // The retained one-cell throat and largest twelve-tick land reach bound
  // cap bucket-head work independently of how many bodies are returned.
  assert.ok(bodies.length <= 256 && Number.isFinite(reach) && reach >= 0 && reach <= 2.08 + EPS);
  assert.ok([region.minX, region.maxX, region.minZ, region.maxZ].every(Number.isFinite)
    && region.maxX >= region.minX && region.maxX - region.minX <= 1
    && region.maxZ >= region.minZ && region.maxZ - region.minZ <= 1);
  assert.ok(finite(offset) && Number.isFinite(padding) && padding >= 0 && padding <= .15);
  const bucket = p => [Math.floor((p.x + offset.x) / 1.2), Math.floor((p.z + offset.z) / 1.2)];
  const buckets = new Map();
  for (const b of bodies) { const key = bucket(b).join(','); if (!buckets.has(key)) buckets.set(key, []); buckets.get(key).push(b); }
  let visits = 0, bucketHeads = 0; const neighbors = [];
  const [minX, minZ] = bucket({ x: region.minX - reach - padding, z: region.minZ - reach - padding });
  const [maxX, maxZ] = bucket({ x: region.maxX + reach + padding, z: region.maxZ + reach + padding });
  for (let z = minZ; z <= maxZ; z++) for (let x = minX; x <= maxX; x++) {
    bucketHeads++;
    for (const b of buckets.get(`${x},${z}`) ?? []) {
      if (visits === 128) return { visits, bucketHeads, neighbors, overflow: true, indexBuildVisits: bodies.length };
      visits++;
      if (Math.sqrt(segmentRectangleDistanceSquared(b, b, region)) > reach + EPS) continue;
      if (neighbors.length === 64) return { visits, bucketHeads, neighbors, overflow: true, indexBuildVisits: bodies.length };
      neighbors.push(b);
    }
  }
  return { visits, bucketHeads, neighbors: neighbors.sort((a, b) => a.id - b.id), overflow: false, indexBuildVisits: bodies.length };
}
