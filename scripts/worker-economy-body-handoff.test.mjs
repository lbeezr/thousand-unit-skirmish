import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';
import { LAND_CLEARANCE_PROFILE, pointSegmentDistanceSquared } from '../src/unit-movement.mjs';

const EPSILON = 1e-9;
const CHECKPOINT_WINDOW_TICKS = 2700; // Existing Stone checkpoint deadline: 90 seconds at 30 Hz.
const definition = JSON.parse(await readFile(new URL('../maps/stone-defense-field.json', import.meta.url), 'utf8'));

// Observe every actual serial-executor write, including terminal snaps and
// productive separation. End-of-tick chords alone can miss an unsafe substep.
function contactViolation(step) {
  const radius = LAND_CLEARANCE_PROFILE.radiusByKind.worker;
  const violations = [];
  for (const other of step.neighbours) {
    const required = radius + LAND_CLEARANCE_PROFILE.radiusByKind[other.kind];
    const before = Math.hypot(step.from.x - other.x, step.from.z - other.z);
    const after = Math.hypot(step.to.x - other.x, step.to.z - other.z);
    const swept = Math.sqrt(pointSegmentDistanceSquared(other, step.from, step.to));
    if (before >= required - EPSILON ? swept < required - EPSILON
      : swept < before - EPSILON || after < before - EPSILON) {
      violations.push({ tick: step.tick, team: step.team, reason: step.reason,
        peerKind: other.kind, inherited: before < required - EPSILON });
    }
  }
  return violations;
}

async function journey(mode) {
  process.env.RTS_MAP = 'maps/open-field.json';
  process.env.RTS_GAME_MODE = 'pvp';
  process.env.RTS_PREGAME = '0';
  process.env.RTS_MOVE_PLANNING_TURNS_PER_TICK = '0';
  delete process.env.RTS_MATCH_STATE_PATH;
  const fixture = await createPathingReplayFixture(definition, { traceLandSteps: true });
  const r = fixture.replay;
  const workers = [0, 1].map(team => r.units.filter(u => u.team === team && u.kind === 'worker'));
  const ids = workers.map(us => us.map(u => u.id));
  const stats = { mode, steps: 0, admittedWrites: 0, violations: 0, firstViolation: null,
    newWorkerContacts: [0, 0], firstNewWorkerContact: null,
    delivered: [false, false], completed: [false, false], coldRestores: 0 };
  let stage = 'gather';
  function conserved() {
    const cp = r.checkpoint();
    for (const team of [0, 1]) {
      const stock = cp.state.resourceNodes.filter(n => n.type === 'stone'
        && n.id.startsWith(`stone-candidate-s${team}-`)).reduce((sum, n) => sum + n.stock, 0);
      const cargo = cp.state.units.filter(u => u.team === team && u.cargoType === 'stone')
        .reduce((sum, u) => sum + u.cargo, 0);
      const paid = cp.state.buildings.filter(b => b.team === team && b.type === 'watchtower').length * 50;
      assert.ok(Number.isFinite(stock + cargo + cp.state.teamStone[team] + paid));
      assert.ok(Math.abs(stock + cargo + cp.state.teamStone[team] + paid - 200) < 1e-7,
        `seat ${team}: stock, cargo, bank and paid Stone conserved at ${stage}`);
    }
    return cp;
  }
  function step() {
    r.step(); stats.steps++;
    for (const write of r.landSteps.filter(s => s.kind === 'worker')) {
      stats.admittedWrites++;
      for (const violation of contactViolation(write)) {
        stats.violations++;
        stats.firstViolation ??= { ...violation, stage };
        if (violation.peerKind === 'worker' && !violation.inherited) {
          stats.newWorkerContacts[write.team]++;
          stats.firstNewWorkerContact ??= { ...violation, stage };
        }
      }
    }
    conserved();
  }
  function until(predicate, label) {
    for (let i = 0; i < CHECKPOINT_WINDOW_TICKS && !predicate(); i++) step();
    assert.ok(predicate(), `${label}; ${JSON.stringify(stats)}`);
  }
  function order(team, command, expected) {
    assert.match(r.order(team, command).map(n => n.message).join('\n'), expected);
  }
  function coldRestore() {
    const cp = conserved();
    r.restore(structuredClone(cp));
    const restored = conserved();
    assert.deepEqual(restored.state.units, cp.state.units, 'cold restore preserves Worker poses and work');
    for (const key of ['resourceNodes', 'teamStone', 'teamFood', 'teamWood', 'buildings']) {
      assert.deepEqual(restored.state[key], cp.state[key], `cold restore preserves ${key}`);
    }
    stats.coldRestores++;
  }
  try {
    assert.deepEqual(workers.map(us => us.length), [4, 4]);
    for (const team of [0, 1]) order(team, { type: 'gather', ids: ids[team],
      nodeId: `stone-candidate-s${team}-0` }, /GATHER ORDER/);
    if (mode === 'node-free-return') {
      until(() => workers.every(us => us.every(u => u.cargo > 0)), 'both seats naturally carry Stone');
    } else {
      // Keep the shipped native fixture's first depletion/Stop/Return boundary;
      // each checkpoint keeps its original 90-second window.
      until(() => [0, 1].every(team => r.resources.get(`stone-candidate-s${team}-0`).stock === 0),
        'both seats naturally deplete their first Stone node');
    }
    {
      for (const team of [0, 1]) {
        order(team, { type: 'stop', ids: ids[team] }, /STOP ORDER/);
        order(team, { type: 'returnCargo', ids: ids[team] }, /RETURN CARGO ORDER/);
      }
      const carrying = ids.flat().filter(id => r.units[id].cargo > 0);
      assert.ok(carrying.length > 0);
      assert.ok(carrying.every(id => r.units[id].gatherNodeId === null && r.units[id].gatherPhase === 'to-base'));
      coldRestore();
      // Restore replaces actor objects; all subsequent reads use live IDs.
      stage = 'node-free-return';
      until(() => ids.flat().every(id => r.units[id].cargo === 0 && !r.units[id].gatherPhase),
        'node-free Return delivers and stops');
      for (const team of [0, 1]) {
        const remaining = [...r.resources.values()].find(n => n.type === 'stone'
          && n.id.startsWith(`stone-candidate-s${team}-`) && n.stock > 0);
        assert.ok(remaining);
        order(team, { type: 'gather', ids: ids[team], nodeId: remaining.id }, /GATHER ORDER/);
      }
    }
    stage = 'depletion-return';
    until(() => [...r.resources.values()].filter(n => n.type === 'stone').every(n => n.stock === 0)
      && ids.flat().every(id => r.units[id].cargo === 0),
    'both seats finish finite Stone gathering and deliver all cargo');
    const banked = conserved();
    assert.ok(banked.state.teamStone.every(value => Math.abs(value - 200) < 1e-7));
    stats.delivered = [true, true];
    for (const team of [0, 1]) {
      const parked = ids[team].map(id => [r.units[id].x, r.units[id].z]);
      order(team, { type: 'stop', ids: ids[team] }, /STOP ORDER/);
      assert.deepEqual(ids[team].map(id => [r.units[id].x, r.units[id].z]), parked, 'Stop does not relocate Workers');
      assert.ok(ids[team].every(id => !r.units[id].gatherPhase && r.units[id].workIntent === null));
    }
    coldRestore();
    assert.equal(stats.violations, 0, `economy writes preserve body clearance; ${JSON.stringify(stats)}`);
    stage = 'paid-construction';
    const parkedPeers = ids.map(us => us.slice(1).map(id => ({ id, x: r.units[id].x, z: r.units[id].z })));
    for (const team of [0, 1]) order(team, { type: 'build', buildingType: 'watchtower', ids: [ids[team][0]],
      x: (team ? 1 : -1) * 10.5, z: -12.5 }, /WATCHTOWER PLACED/);
    until(() => r.buildings.length === 2 && r.buildings.every(b => b.type === 'watchtower' && b.complete),
      'both naturally paid Watchtowers complete within the original window');
    for (const peer of parkedPeers.flat()) {
      assert.deepEqual([r.units[peer.id].x, r.units[peer.id].z], [peer.x, peer.z], 'builder cannot displace parked peers');
    }
    stats.completed = [true, true];
    const finished = conserved();
    assert.ok(finished.state.teamStone.every(value => Math.abs(value - 150) < 1e-7));
    assert.deepEqual(finished.state.teamFood, [250, 250]);
    assert.deepEqual(finished.state.teamWood, [450, 450]);
    assert.ok(stats.admittedWrites > 0);
    assert.equal(stats.violations, 0, `every actual Worker write preserves body clearance; ${JSON.stringify(stats)}`);
  } finally {
    // Only aggregate evidence leaves the fixture; no poses, IDs or checkpoints.
    console.log(JSON.stringify({ sourceSha256: fixture.sourceSha256, ...stats }));
    await fixture.dispose();
  }
}

for (const mode of ['natural-depletion', 'node-free-return']) {
  test(`both seats: ${mode} preserves body clearance through Stop, cold recovery and paid construction`,
    async () => journey(mode));
}
