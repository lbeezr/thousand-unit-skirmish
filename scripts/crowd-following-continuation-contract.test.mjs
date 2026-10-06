// Synthetic semantic controls plus two prior PUBLIC rejection frames.
// No qualifier-private bytes or decision replay, fixture, server or journey.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { soleFollowingContinuation } from './crowd-following-continuation-contract.mjs';
import { crowdPriorityClaims, canTraverseCrowdBodySegment } from '../src/unit-crowd-steering.mjs';

const actor = (id, x, z) => ({ id, x, z, team: 0, generation: 17, orderRevision: 8, kind: 'infantry', hp: 100,
  path: [7, 8, 9, 10], pathIndex: 0, moveGoalCell: 10, queuedWaypoints: [{ destination: 11 }] });
function scene() {
  const unit = actor(2, 0, 0), peer = actor(1, .42, .35);
  peer.pathIndex = 1; peer.target = { x: 0, z: -3 };
  const states = new Map([unit, peer].map(u => [u, { generation: u.generation, revision: u.orderRevision,
    path: u.path, pathIndex: u.pathIndex, navigationRevision: 4, epoch: 2, lastTick: 40,
    detour: null, lease: null, contour: null, lastProgressTick: 0 }]));
  const best = { x: Math.sin(.7), z: Math.cos(.7), stepDistance: 2.6 / 30 };
  const args = { unit, neighbors: [peer], radius: .22, stepDistance: 2.6 / 30, noProgressTicks: 40,
    best, detour: null, progressTarget: { x: 0, z: 3 }, travelDirection: { x: 0, z: 1 },
    targetOf: u => u.target, directionOf: u => ({ x: 3 - u.x, z: 3 - u.z }) };
  const to = { x: best.x * best.stepDistance, z: best.z * best.stepDistance };
  const original = crowdPriorityClaims(args).claims;
  const policy = { ...args, to, claims: original, stateOf: u => states.get(u), tick: 40,
    navigationRevision: 4, epoch: 2, claimsComplete: true,
    physicalAdmitted: canTraverseCrowdBodySegment(unit, to, .22, [peer]) };
  return { unit, peer, states, args, policy, to };
}

for (const team of [0, 1]) test(`seat${team}: sole aligned following claimant can retain already admitted raw progress`, () => {
  const s = scene(); s.unit.team = s.peer.team = team;
  const before = structuredClone([s.unit, s.peer, ...s.states.values()]);
  assert.equal(s.policy.physicalAdmitted, true);
  assert.deepEqual(s.policy.claims, [s.peer], 'complete original predicate really vetoes this synthetic step');
  assert.equal(soleFollowingContinuation(s.policy), true);
  assert.deepEqual([s.unit, s.peer, ...s.states.values()], before, 'no pose, route, queue or history is written');
});

for (let quarter = 0; quarter < 4; quarter++) for (const reflection of [-1, 1])
  test(`same contract under rotation${quarter}, reflection${reflection} and translation`, () => {
    const s = scene(), directions = new Map([s.unit, s.peer].map(u => [u, s.policy.directionOf(u)]));
    const rotate = p => { let x = p.x, z = p.z * reflection;
      for (let i = 0; i < quarter; i++) [x, z] = [-z, x]; return { x, z }; };
    const move = p => { const q = rotate(p); return { x: q.x + 11, z: q.z - 7 }; };
    s.peer.target = move(s.peer.target);
    for (const u of [s.unit, s.peer]) Object.assign(u, move(u));
    s.policy.best = { ...rotate(s.policy.best), stepDistance: s.policy.best.stepDistance };
    s.policy.progressTarget = move(s.policy.progressTarget);
    s.policy.travelDirection = rotate(s.policy.travelDirection);
    s.policy.directionOf = u => rotate(directions.get(u));
    s.policy.claims = crowdPriorityClaims({ ...s.args, ...s.policy }).claims;
    const to = { x: s.unit.x + s.policy.best.x * s.policy.best.stepDistance,
      z: s.unit.z + s.policy.best.z * s.policy.best.stepDistance };
    s.policy.to = to;
    s.policy.physicalAdmitted = canTraverseCrowdBodySegment(s.unit, to, .22, [s.peer]);
    assert.deepEqual(s.policy.claims, [s.peer]); assert.equal(soleFollowingContinuation(s.policy), true);
  });

for (const reverse of [false, true]) test(`all original claimants are required, neighbor order reversed=${reverse}`, () => {
  const s = scene(), other = actor(0, -.3, .4); other.target = { x: 0, z: -3 };
  const neighbors = reverse ? [other, s.peer] : [s.peer, other];
  s.policy.claims = crowdPriorityClaims({ ...s.args, neighbors }).claims;
  assert.equal(s.policy.claims.length, 2);
  assert.equal(soleFollowingContinuation(s.policy), false, 'no partial waiver from a first-claimant-only view');
});

for (const cosine of [.899999, .9, .900001]) test(`strict selected-step alignment threshold ${cosine}`, () => {
  const s = scene(); s.policy.to = { x: 0, z: .08 };
  s.policy.directionOf = () => ({ x: Math.sqrt(1 - cosine ** 2), z: cosine });
  assert.equal(soleFollowingContinuation(s.policy), cosine > .9);
});

for (const cells of [[7, 8], [7, 7, 9], [9, 8, 7], [7, 8, -1]])
  test(`fresh but unmatched/truncated/repeated/invalid continuation ${cells}`, () => {
    const s = scene(); s.peer.path = cells; s.peer.pathIndex = 0;
    Object.assign(s.states.get(s.peer), { path: cells, pathIndex: 0 });
    assert.equal(soleFollowingContinuation(s.policy), false);
  });

for (const [name, change] of [
  ['not physically admitted', s => { s.policy.physicalAdmitted = false; }],
  ['nonboolean admission assertion', s => { s.policy.physicalAdmitted = 'false'; }],
  ['query overflow', s => { s.policy.overflow = true; }],
  ['first-claimant-only input', s => { s.policy.claimsComplete = false; }],
  ['nonboolean claimant completeness', s => { s.policy.claimsComplete = 'false'; }],
  ['missing epoch', s => { s.policy.epoch = undefined; }],
  ['no original claimant', s => { s.policy.claims = []; }],
  ['second original claimant', s => { s.policy.claims.push(actor(0, -.1, .4)); }],
  ['terminal waypoint', s => { s.unit.path = [7]; }],
  ['unknown route axis', s => { s.policy.travelDirection = { x: 0, z: 0 }; }],
  ['backward route axis', s => { s.policy.travelDirection = { x: 0, z: -1 }; }],
  ['raw waypoint behind', s => { s.policy.progressTarget = { x: 0, z: -3 }; }],
  ['outside following lane', s => { s.peer.x = .5; }],
  ['unshared continuation', s => { s.peer.path = [12, 13, 14]; }],
  ['repeated route cell', s => { s.unit.path = s.peer.path = [7, 7, 9]; }],
  ['parked claimant', s => { s.peer.holdingPosition = true; }],
  ['Worker caller', s => { s.unit.kind = 'worker'; }],
  ['opposing peer direction', s => { s.policy.directionOf = () => ({ x: 0, z: -1 }); }],
  ['missing peer direction', s => { s.policy.directionOf = () => null; }],
  ['zero peer direction', s => { s.policy.directionOf = () => ({ x: 0, z: 0 }); }],
  ['only route-axis alignment', s => { s.policy.directionOf = () => ({ x: 0, z: 1 }); }],
  ['unknown endpoint', s => { s.policy.to = { x: NaN, z: .04 }; }],
  ['zero displacement', s => { s.policy.to = { x: 0, z: 0 }; }],
  ['overlong proposal', s => { s.policy.to = { x: 0, z: .251 }; }],
]) test(`${name} preserves the original veto`, () => {
  const s = scene(); change(s); assert.equal(soleFollowingContinuation(s.policy), false);
});

for (const who of ['unit', 'peer']) for (const [name, change] of [
  ['unknown actor identity', (u, state) => { u.id = undefined; }],
  ['negative actor identity', (u, state) => { u.id = -1; }],
  ['generation', (u, state) => { u.generation++; }],
  ['unknown birth', (u, state) => { u.generation = state.generation = undefined; }],
  ['command', (u, state) => { u.orderRevision++; }],
  ['unknown command', (u, state) => { u.orderRevision = state.revision = undefined; }],
  ['path identity', (u, state) => { u.path = [...u.path]; }],
  ['path index', (u, state) => { u.pathIndex++; }],
  ['fractional path index', (u, state) => { u.pathIndex = state.pathIndex = .25; }],
  ['navigation', (u, state) => { state.navigationRevision++; }],
  ['epoch', (u, state) => { state.epoch++; }],
  ['stale observation', (u, state) => { state.lastTick = 38; }],
  ['missing observation tick', (u, state) => { delete state.lastTick; }],
  ['nonfinite observation tick', (u, state) => { state.lastTick = NaN; }],
  ['future observation', (u, state) => { state.lastTick = 41; }],
  ['detour', (u, state) => { state.detour = {}; }],
  ['lease', (u, state) => { state.lease = {}; }],
  ['contour', (u, state) => { state.contour = {}; }],
]) test(`${who} ${name} preserves the original veto`, () => {
  const s = scene(); change(s[who], s.states.get(s[who])); assert.equal(soleFollowingContinuation(s.policy), false);
});

function receipt(name, hash) {
  const bytes = readFileSync(new URL('../docs/qa-evidence/' + name, import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), hash);
  return JSON.parse(gunzipSync(bytes));
}
const forest = receipt('crowd-first-decision-2026-10-06/first-decision.json.gz',
  '74ede1895682f64b9f1d512f9fe9fb200e542c77ad1568165aaf8ea38e18b11a');
const wall = receipt('construction-temporal-2026-10-06/actor75-temporal.json.gz',
  '0ac8d06e7d5c9ed95214c70c9c9cb8fdde2a9372bdb7b30d89ae752683f3f38d');
for (const [name, frame, peerId, expected] of [
  ['forest142', forest.firstDivergence.baseline, 24, .5317950594532269],
  ['wall594', wall.history.find(row => row.tick === 594).frames[0], 73, -.8253633325477777],
]) test(`${name}: actual public step/peer direction still fails the alignment requirement`, () => {
  const best = frame.events.find(event => event.type === 'priority').best;
  const direction = frame.bodies.find(body => body.actor.id === peerId).direction;
  const cosine = (best.x * direction.x + best.z * direction.z) / Math.hypot(direction.x, direction.z);
  assert.ok(Math.abs(cosine - expected) < 1e-12); assert.ok(cosine < .9);
  const s = scene(); s.policy.to = { x: best.x * best.stepDistance, z: best.z * best.stepDistance };
  s.policy.directionOf = () => direction;
  assert.equal(soleFollowingContinuation(s.policy), false);
});

test('the exact admitted endpoint supplies the step; normalized metadata is not reconstructed', () => {
  const s = scene(); s.policy.to = { x: .01, z: .03 };
  const length = Math.hypot(s.policy.to.x, s.policy.to.z);
  assert.notEqual(s.policy.to.z / length * length, s.policy.to.z);
  s.policy.best = { x: NaN, z: NaN, stepDistance: NaN };
  s.policy.directionOf = () => ({ x: .01, z: .03 });
  assert.equal(soleFollowingContinuation(s.policy), true);
  assert.deepEqual(s.policy.to, { x: .01, z: .03 });
});
