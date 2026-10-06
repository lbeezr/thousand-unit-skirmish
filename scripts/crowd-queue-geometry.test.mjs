import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import * as movement from '../src/unit-movement.mjs';
import { UNIT_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { constructionMovementActive } from '../src/construction-work-intent.mjs';
import { workerPatrolAcquiredMovementActive } from '../src/combat-movement.mjs';
import { createTemporalObserver } from './crowd-first-decision-observer.mjs';
import { frameContext } from './crowd-first-decision-context.mjs';
import { classifyQueueGeometry } from './crowd-queue-geometry.mjs';

function receipt(name, hash) {
  const packed = readFileSync(new URL('../docs/qa-evidence/' + name, import.meta.url));
  assert.equal(createHash('sha256').update(packed).digest('hex'), hash);
  return JSON.parse(gunzipSync(packed));
}
const forest = receipt('crowd-first-decision-2026-10-06/first-decision.json.gz',
  '74ede1895682f64b9f1d512f9fe9fb200e542c77ad1568165aaf8ea38e18b11a');
const wall = receipt('construction-temporal-2026-10-06/actor75-temporal.json.gz',
  '0ac8d06e7d5c9ed95214c70c9c9cb8fdde2a9372bdb7b30d89ae752683f3f38d');
const wallRow = wall.history.find(row => row.tick === 594), wallBlocked = new Set(wallRow.blockedCells);
for (const o of wall.map.obstacles) for (let z = o.row; z < o.row + o.height; z++)
  for (let x = o.column; x < o.column + o.width; x++) wallBlocked.add(z * wall.map.width + x);
const wallMap = { map: wall.map, navigationMask: Array.from({length: wall.map.width * wall.map.height},
  (_, cell) => !wallBlocked.has(cell)), elevationLevels: new Array(wall.map.width * wall.map.height).fill(0) };
const server = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
const start = server.indexOf('function getMoveVector('), end = server.indexOf('function stationaryWorkerCellsNear(', start);
assert.ok(start >= 0 && end > start);
const dependencies = { movement, UNIT_DEFINITIONS, constructionMovementActive, workerPatrolAcquiredMovementActive };
const distance = (a,b) => Math.hypot(a.x-b.x, a.z-b.z);
const cases = [
  { name: 'forest142', record: forest, frame: forest.firstDivergence.baseline, peerId: 24,
    expected: 'queue-following', across: -.0020173754298253854, gain: .041581473441066885 },
  { name: 'wall594', record: wallMap, frame: wallRow.frames[0], peerId: 73,
    expected: 'lateral-rejoin', across: .45466188340719227, gain: .023663475770982045 },
];
function geometry(frame, peer) {
  const p = frame.events.find(e => e.type === 'priority'), from = {x: frame.actor.x, z: frame.actor.z};
  return { from, to: {x: from.x + p.best.x * p.best.stepDistance, z: from.z + p.best.z * p.best.stepDistance},
    peer, routeDirection: {x: p.routeX, z: p.routeZ}, progressTarget: frame.input.progressTarget,
    radius: frame.input.radius, peerRadius: movement.LAND_CLEARANCE_PROFILE.radiusByKind[peer.kind] };
}

for (const c of cases) test(`${c.name}: classified geometry preserves the full captured production wait and controller`, async () => {
  const observer = await createTemporalObserver(null, { prepareOnly: true, actorId: [28,75] });
  try {
    const {context, unit, decode} = frameContext(c.frame, c.record, observer.observed, dependencies, server.slice(start,end));
    const query = context.crowdNeighborsNear(unit), peerBody = c.frame.bodies.find(b => b.actor.id === c.peerId);
    assert.deepEqual(Array.from(query.neighbors, u => u.id), c.frame.query.ids);
    assert.equal(query.visits, c.frame.query.visits); assert.equal(query.overflow, false);
    // Both witnesses satisfy the rejected exception's context. Its shared
    // future triplet and positive current alignment cannot distinguish them.
    for (const b of [c.frame.bodies[0], peerBody]) {
      const actor = decode(b.actor), state = decode(b.state);
      assert.equal(observer.observed.ordinaryCrowdBodyRadius(actor), .22);
      assert.equal(state.path, actor.path); assert.equal(state.pathIndex, actor.pathIndex);
      assert.deepEqual([state.generation, state.revision, state.navigationRevision, state.epoch],
        [actor.generation, actor.orderRevision, c.frame.navigationRevision, c.frame.epoch]);
      assert.ok(state.lastTick >= c.frame.tick - 1 && state.lastTick <= c.frame.tick);
      assert.ok(!state.detour && !state.lease && !state.contour);
    }
    const ownTriple = unit.path.slice(unit.pathIndex, unit.pathIndex + 3), peer = decode(peerBody.actor);
    assert.equal(new Set(ownTriple).size, 3);
    assert.deepEqual(peer.path.slice(peer.pathIndex-1, peer.pathIndex+2), ownTriple);
    const args = geometry(c.frame, peer), before = structuredClone(args), actorBefore = structuredClone(unit);
    assert.ok(peerBody.direction.x * args.routeDirection.x + peerBody.direction.z * args.routeDirection.z > 0);
    assert.equal(classifyQueueGeometry(args), c.expected); assert.deepEqual(args, before);
    assert.ok(Math.abs((peer.x-unit.x)*args.routeDirection.z-(peer.z-unit.z)*args.routeDirection.x-c.across) < 1e-12);
    assert.ok(Math.abs(distance(unit,args.progressTarget)-distance(args.to,args.progressTarget)-c.gain) < 1e-12);
    // Existing cell/static/body admission stays independent. Neither receipt
    // needs overlap escape, and the classifier performs no physical admission.
    assert.ok(movement.canTraverseUnitStep(context.worldToCell(unit.x,unit.z), context.worldToCell(args.to.x,args.to.z),
      c.record.map.width, context.elevationLevelByCell, context.isWalkable));
    assert.ok(movement.canTraverseStaticBodySegment(unit,args.to,args.radius,c.record.map.width,c.record.map.height,context.isWalkable));
    assert.ok(observer.observed.canTraverseCrowdBodySegment(unit,args.to,args.radius,query.neighbors));
    assert.equal(movement.canTraverseStaticBodySegment(unit,args.to,args.radius,c.record.map.width,c.record.map.height,()=>false),false);
    assert.equal(observer.observed.canTraverseCrowdBodySegment(unit,args.to,args.radius,
      [{...peer,x:args.to.x,z:args.to.z}]),false,'a geometry label cannot admit a colliding step');
    observer.observed.replayHostStart(unit,c.frame.tick,c.frame.navigationRevision,c.frame.epoch);
    const entry = c.frame.events.find(e=>e.type==='host-entry');
    const result = context.getMoveVector(unit,entry?.remainingStep ?? c.frame.input.stepDistance,entry?.allowLocalDetour);
    observer.observed.replayHostEnd(unit,result);
    const [replayed] = observer.observed.drainReplayFrames();
    assert.deepEqual(structuredClone(result),decode(c.frame.result));
    assert.deepEqual(unit,actorBefore); assert.deepEqual(replayed.afterState,c.frame.afterState);
    const omit = e => !['host-entry','host-oracle'].includes(e.type)
      && (c.name==='forest142' || !['claim-predicate','claimant'].includes(e.type));
    assert.deepEqual(replayed.events.filter(omit),c.frame.events.filter(omit));
    assert.ok(replayed.events.some(e=>e.type==='claimant' && e.id===c.peerId && e.claims));
    assert.ok(result.waitingForCrowd);
    const overflow = observer.observed.selectCrowdStep({...decode(c.frame.input),unit,neighbors:query.neighbors,overflow:true,
      canTraverse:()=>{throw Error('overflow must perform no physical proposals');}});
    assert.ok(overflow.waitingForCrowd); assert.equal(overflow.stepDistance,0);
    assert.equal(overflow.crowdControl.proposals,0); assert.deepEqual(unit,actorBefore);
    // Positive one-step gain is below the unchanged .02 progress-credit bound.
    assert.ok(distance(args.to,args.progressTarget) >= decode(c.frame.bodies[0].state).bestDistance - .02);
    assert.equal(replayed.afterState.lastProgressTick,c.frame.bodies[0].state.lastProgressTick);
    if (c.name==='wall594') {
      assert.equal(classifyQueueGeometry({...args,from:args.to,to:args.to}), 'queue-following',
        'holding the peer fixed, this proposal enters its lane; this is no live continuation');
      assert.ok(peerBody.direction.x*c.frame.events.find(e=>e.type==='priority').best.x
        +peerBody.direction.z*c.frame.events.find(e=>e.type==='priority').best.z < 0,
        'positive route-axis alignment does not mean parallel selected motion');
    }
  } finally { await observer.dispose(); }
});

const wallGeometry = geometry(wallRow.frames[0], wallRow.frames[0].bodies.find(b=>b.actor.id===73).actor);
test('geometry is invariant under translation, rotation, reflection and route-axis scaling', () => {
  for (const c of cases) for (const angle of [0,.37,Math.PI/2,Math.PI]) for (const sign of [-1,1]) {
    const g = geometry(c.frame,c.frame.bodies.find(b=>b.actor.id===c.peerId).actor);
    const rotate = p => ({x:Math.cos(angle)*p.x-Math.sin(angle)*p.z*sign,z:Math.sin(angle)*p.x+Math.cos(angle)*p.z*sign});
    const move = p => {const q=rotate(p);return {x:q.x+11,z:q.z-7};};
    assert.equal(classifyQueueGeometry({...g,from:move(g.from),to:move(g.to),peer:move(g.peer),progressTarget:move(g.progressTarget),
      routeDirection:rotate({x:g.routeDirection.x*3,z:g.routeDirection.z*3})}),c.expected);
  }
});

test('ordinary following has priority at body-width contact and with oblique admitted progress', () => {
  const g = wallGeometry;
  for (const cross of [0,.2,.44,.44+5e-10,-.44]) {
    assert.equal(classifyQueueGeometry({...g,peer:{x:g.from.x+cross,z:g.from.z+.5}}),'queue-following');
  }
  assert.equal(classifyQueueGeometry({...g,peer:{x:g.from.x+.47,z:g.from.z+.5},peerRadius:.25}),'queue-following',
    'body support uses both actual radii');
});

test('outside-lane geometry alone, positive alignment and waypoint gain are insufficient', () => {
  const g=wallGeometry;
  for (const extra of [
    {to:g.from}, {to:{x:g.from.x,z:g.from.z+.04}}, {to:{x:g.from.x-.02,z:g.from.z+.04}},
    {to:{x:g.from.x+.02,z:g.from.z-.04}}, {to:{x:g.from.x+.6,z:g.from.z+.04}},
    {peer:{x:g.peer.x,z:g.from.z}}, {peer:{x:g.peer.x,z:g.from.z-.5}},
    {routeDirection:{x:0,z:0}}, {routeDirection:{x:NaN,z:1}}, {from:{x:NaN,z:0}},
    {radius:0}, {peerRadius:NaN}, {to:{x:Infinity,z:0}}, {progressTarget:null},
  ]) assert.equal(classifyQueueGeometry({...g,...extra}),'undetermined');
});
