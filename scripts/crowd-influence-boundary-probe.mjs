// Read-only oracle measurements against the existing physical serial fixture.
import assert from 'node:assert/strict';
import { UNIT_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { LAND_CLEARANCE_PROFILE, canTraverseStaticBodySegment, segmentRectangleDistanceSquared } from '../src/unit-movement.mjs';
import { createFiniteRoomProbe as createPassage } from './crowd-passage-service-probe.mjs';
import { INFLUENCE_HORIZONS, corridorInfluence, rootEnvelope, queryReach,
  inputDependencyClosure, physicalBoundaryDecision, regionCandidates } from './crowd-influence-boundary.mjs';
const EPS = 1e-9;
const registry = Object.entries(LAND_CLEARANCE_PROFILE.radiusByKind).map(([kind, radius]) =>
  ({ kind, radius, speed: UNIT_DEFINITIONS[kind].combat.moveSpeed }));
// Existing authored queued-wall-native-1 throat; this is not a new map/benchmark.
const throat = { minX: 0, maxX: 1, minZ: 0, maxZ: 1 };
export function createFiniteRoomProbe(config) {
  assert.equal(config.mode, 'influence');
  const observer = createPassage({ ...config, mode: 'passage' });
  const ids = config.origins.map(o => o.id), selected = new Set(config.serviceOrigins.map(o => o.id));
  const measurements = [], portalFrames = [], crossingCandidates = [], fullTransits = [], refusals = [], entries = new Map();
  const stats = { rounds: 0, oracleBodyVisits: 0, currentIndexBuildVisits: 0,
    corridorDistances: 0, nominalSegmentDistances: 0, rootPairDistances: 0, graphPairDistances: 0, graphEdgeVisits: 0,
    portalReceiptBodyVisits: 0 };
  let tick = null;
  function bodies(units) {
    if (units.length > 256) return null;
    const result = [];
    for (const u of units) {
      stats.oracleBodyVisits++;
      if (u.hp <= 0 || u.movementDomain === 'water') continue;
      const radius = LAND_CLEARANCE_PROFILE.radiusByKind[u.kind], speed = UNIT_DEFINITIONS[u.kind]?.combat.moveSpeed;
      if (!(radius > 0 && Number.isFinite(speed) && speed > 0 && Number.isFinite(u.x) && Number.isFinite(u.z))) return null;
      // All live land bodies retain their full registry movement bound. Parked
      // actors get no assumed zero budget and are never moved by this observer.
      result.push({ id: u.id, generation: u.generation, x: u.x, z: u.z, radius, speed });
    }
    return result;
  }
  return {
    get report() { return { ...observer.report, influence: { stats, measurements, portalFrames, crossingCandidates, fullTransits, refusals } }; },
    select(ctx) {
      const normal = observer.select(ctx);
      if (ctx.unit.id !== 110 || tick === ctx.tick) return normal;
      tick = ctx.tick;
      if (ctx.map.width !== 96 || ctx.map.height !== 64) { refusals.push({ tick, reason: 'retained-map-only' }); return normal; }
      const all = bodies(ctx.units);
      if (!all) { refusals.push({ tick, reason: 'oracle-overflow-or-unknown-body' }); return normal; }
      const owner = all.find(b => b.id === 110), roots = ids.map(id => all.find(b => b.id === id));
      const movers = all.filter(b => selected.has(b.id));
      if (!owner || roots.some(b => !b) || movers.length !== selected.size || selected.size > 64) {
        refusals.push({ tick, reason: 'original-membership-changed' }); return normal;
      }
      stats.rounds++;
      const current = inputDependencyClosure(movers, ids);
      stats.graphPairDistances += current.stats.pairDistances; stats.graphEdgeVisits += current.stats.edgeVisits;
      const rows = [];
      for (const horizon of INFLUENCE_HORIZONS) {
        // Reuse the historical110 eastward .75 corridor, translated to its
        // current pose, solely to classify physical influence. No new heading.
        const influence = corridorInfluence(owner, all, { ticks: horizon });
        const envelope = rootEnvelope(roots, all, horizon);
        const closure = inputDependencyClosure(movers, ids, horizon);
        stats.corridorDistances += influence.stats.corridorDistances;
        stats.nominalSegmentDistances += influence.stats.nominalSegmentDistances;
        stats.rootPairDistances += envelope.stats.pairDistances;
        stats.graphPairDistances += closure.stats.pairDistances; stats.graphEdgeVisits += closure.stats.edgeVisits;
        const queryIds = new Set(ctx.query?.neighbors?.map(b => b.id));
        const reach = Math.max(...registry.map(b => b.radius + b.speed * horizon / 30));
        const region = regionCandidates(all, throat, reach,
          { offset: { x: ctx.map.width / 2, z: ctx.map.height / 2 }, padding: .15 });
        stats.currentIndexBuildVisits += region.indexBuildVisits;
        const potentialEntrants = region.neighbors.filter(b => selected.has(b.id)
          && Math.sqrt(segmentRectangleDistanceSquared(b, b, throat)) <= b.radius + b.speed * horizon / 30 + EPS);
        const flow = b => {
          const u = ctx.units[b.id];
          if (!(u.moveGoalCell >= 0)) return 'ambiguous';
          const x = (u.moveGoalPoint ?? ctx.map.point(u.moveGoalCell)).x;
          if (!Number.isFinite(x)) return 'ambiguous';
          return x < throat.minX - b.radius ? 'west' : x > throat.maxX + b.radius ? 'east' : 'ambiguous';
        };
        rows.push({ horizon, fixedCorridorPhysicalIds: influence.members.map(b => b.id),
          outsidePhysicalIds: influence.members.filter(b => !ids.includes(b.id)).map(b => b.id),
          nominalEarliest: influence.members.map(b => [b.id, b.earliestNominalTick]),
          missingFromCurrentQuery: influence.members.filter(b => !queryIds.has(b.id)).map(b => b.id),
          anyDirectionRootPhysicalIds: envelope.ids, currentInputClosure: current.ids,
          horizonInputClosure: closure.ids, knownPopulationReach: queryReach(owner, all, horizon),
          genericLandReach: queryReach(owner, registry, horizon),
          fixedCorridorStaticClear: canTraverseStaticBodySegment(owner, influence.end, owner.radius,
            ctx.map.width, ctx.map.height, ctx.map.isWalkable),
          decision: physicalBoundaryDecision({ owner, peers: registry, ticks: horizon,
            query: { ...ctx.query, coveredRadius: 2.1 }, influence, closure, cohortIds: ids }),
          coarse: { queryVisits: region.visits, bucketHeads: region.bucketHeads, returnedBodies: region.neighbors.length,
            overflow: region.overflow, potentialEntrantIds: potentialEntrants.map(b => b.id),
            west: potentialEntrants.filter(b => flow(b) === 'west').map(b => b.id),
            east: potentialEntrants.filter(b => flow(b) === 'east').map(b => b.id),
            ambiguous: potentialEntrants.filter(b => flow(b) === 'ambiguous').map(b => b.id) } });
      }
      measurements.push({ tick, rows }); return normal;
    },
    observeExecuted(frame) {
      observer.observeExecuted(frame);
      const receipts = observer.report.ledger, valid = new Set(receipts.actors.filter(a => a.valid).map(a => a.id));
      if (receipts.failed || receipts.lastTick !== frame.tick) entries.clear();
      const all = bodies(frame.units);
      if (!all) { entries.clear(); refusals.push({ tick: frame.tick, reason: 'receipt-oracle-unknown-or-overflow' }); return; }
      const byId = new Map(all.map(b => [b.id, b]));
      for (const [id, entry] of entries) if (!valid.has(id) || frame.units[id]?.generation !== entry.generation
        || frame.units[id]?.orderRevision !== entry.revision || frame.navigationRevision !== entry.navigationRevision
        || frame.epoch !== entry.epoch) entries.delete(id);
      const occupied = all.filter(b => Math.sqrt(segmentRectangleDistanceSquared(b, b, throat)) < b.radius - EPS).map(b => b.id);
      portalFrames.push({ tick: frame.tick, occupied });
      for (const s of frame.steps) {
        if (!selected.has(s.id)) continue;
        const b = byId.get(s.id);
        const inLane = s.from.z >= throat.minZ + b.radius - EPS && s.from.z <= throat.maxZ - b.radius + EPS
          && s.to.z >= throat.minZ + b.radius - EPS && s.to.z <= throat.maxZ - b.radius + EPS;
        if (!inLane) continue;
        for (const [name, plane] of [['left', throat.minX - b.radius], ['right', throat.maxX + b.radius]]) {
          const east = name === 'left' ? s.from.x <= plane + EPS && s.to.x > plane + EPS
            : s.from.x < plane - EPS && s.to.x >= plane - EPS;
          const west = name === 'right' ? s.from.x >= plane - EPS && s.to.x < plane - EPS
            : s.from.x > plane + EPS && s.to.x <= plane + EPS;
          if (!east && !west) continue;
          const direction = east ? 'east' : 'west', type = name === 'left' && east || name === 'right' && west ? 'entry' : 'exit';
          const occupiedAfter = s.neighbours.filter(other => {
            stats.portalReceiptBodyVisits++;
            const radius = LAND_CLEARANCE_PROFILE.radiusByKind[other.kind];
            return Math.sqrt(segmentRectangleDistanceSquared(other, other, throat)) < radius - EPS;
          }).map(other => other.id);
          if (Math.sqrt(segmentRectangleDistanceSquared(s.to, s.to, throat)) < b.radius - EPS) occupiedAfter.push(s.id);
          const validReceipt = !receipts.failed && receipts.lastTick === frame.tick && valid.has(s.id);
          const event = { tick: frame.tick, id: s.id, plane: name, direction, type, validReceipt,
            occupiedAfter: occupiedAfter.sort((a, b) => a - b) };
          crossingCandidates.push(event);
          if (!validReceipt) { entries.delete(s.id); continue; }
          if (type === 'entry') entries.set(s.id, { ...event, generation: s.generation,
            revision: s.revision, navigationRevision: s.navigationRevision, epoch: frame.epoch });
          else {
            const entry = entries.get(s.id);
            if (entry && entry.direction === direction && entry.plane !== name)
              fullTransits.push({ id: s.id, direction, entryTick: entry.tick, exitTick: frame.tick,
                emptyAfterExit: !occupiedAfter.length });
            entries.delete(s.id);
          }
        }
      }
    },
  };
}
