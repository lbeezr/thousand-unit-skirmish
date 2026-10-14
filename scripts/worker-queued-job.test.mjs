import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';
import { BUILDING_DEFINITIONS } from '../src/gameplay-definitions.mjs';

const baseMap = JSON.parse(await readFile(new URL('../maps/open-field.json', import.meta.url)));

async function journey(team, { wall = false, repair = false, cold = false, interrupt = null, cancel = false, pausedRepair = false, queueLimit = false } = {}) {
  const map = { ...baseMap, id: 'worker-queued-job', startingArmySize: 8,
    startingResources: { food: 1000, wood: pausedRepair ? 75 : 1000 }, triggers: [], scenarioEvents: [] };
  const fixture = await createPathingReplayFixture(map), r = fixture.replay;
  try {
    const sign = team ? 1 : -1;
    const id = r.units.find(u => u.team === team && u.kind === 'worker').id;
    const unit = () => r.units[id];
    const ids = [id], unitGenerations = [unit().generation];
    const order = (command, expected) => assert.match(r.order(team, { ids, unitGenerations, ...command })
      .map(n => n.message).join('\n'), expected);
    const until = (predicate, label) => {
      for (let i = 0; i < 2400 && !predicate(); i++) r.step();
      assert.ok(predicate(), `${label}: ${JSON.stringify(unit())}`);
    };
    const untouched = r.units.filter(u => u.id !== id).map(u => structuredClone(u));
    if (wall) {
      order({ type: 'buildWall', points: [{ column: team ? 44 : 19, row: 23 },
        { column: team ? 46 : 17, row: 23 }] }, /PALISADE LINE PLACED/);
    } else {
      order({ type: 'build', buildingType: 'house', x: sign * 12.5, z: -8.5 }, /HOUSE PLACED/);
    }
    r.drain();
    const siteIds = r.buildings.map(b => b.id);
    if (repair) {
      until(() => r.buildings.every(b => b.complete) && unit().buildingTargetId === null, 'initial construction finishes');
      // Controlled damage is the repair fixture's sole injection; payment,
      // commands, movement, completion and checkpoints use production bodies.
      r.buildings[0].hp -= 200;
      order({ type: 'repairBuilding', buildingId: siteIds[0] }, /PLANNING REPAIR|REPAIR ORDER/);
      r.drain();
    }
    const target = unit().buildingTargetId, revision = unit().orderRevision;
    const work = structuredClone(unit().workIntent), wallOrder = structuredClone(unit().wallBuildOrder);
    const woodBeforeQueue = r.wood[team];
    order({ type: 'move', x: sign * 18.5, z: 8.5, queue: true }, /WAYPOINT QUEUED/);
    order({ type: 'attackMove', x: sign * 16.5, z: 10.5, queue: true }, /WAYPOINT QUEUED/);
    assert.equal(unit().buildingTargetId, target);
    assert.equal(unit().orderRevision, revision);
    assert.deepEqual(unit().workIntent, work);
    assert.deepEqual(unit().wallBuildOrder, wallOrder);
    assert.equal(r.wood[team], woodBeforeQueue, 'queuing itself charges nothing');
    const destinations = unit().queuedWaypoints.map(w => w.destination);
    if (queueLimit) {
      for (let i = 2; i < 8; i++) order({ type: 'move', x: sign * 18.5, z: 8.5, queue: true }, /WAYPOINT QUEUED/);
      const before = structuredClone(unit());
      order({ type: 'move', x: sign * 19.5, z: 8.5, queue: true }, /WAYPOINT REJECTED.*QUEUE LIMIT/);
      assert.deepEqual(unit(), before, 'full-queue refusal preserves the accepted job and all later orders');
      assert.equal(r.wood[team], woodBeforeQueue);
      r.validate(r.checkpoint());
      return;
    }
    if (cold) {
      const cp = r.checkpoint(); r.validate(cp); r.restore(structuredClone(cp));
      assert.deepEqual(unit().queuedWaypoints, cp.state.units[id].queuedWaypoints);
      assert.equal(unit().buildingTargetId, target);
    }
    if (pausedRepair) {
      const hp = r.buildings[0].hp;
      for (let i = 0; i < 90; i++) r.step();
      assert.equal(r.wood[team], 0);
      assert.equal(r.buildings[0].hp, hp);
      assert.equal(unit().buildingTargetId, target);
      assert.equal(unit().repairing, true);
      assert.equal(unit().queuedWaypoints.length, 2, 'paused repair owns the job until replaced');
      r.validate(r.checkpoint());
      return;
    }
    if (cancel) {
      order({ type: 'cancelConstruction', buildingId: target }, /CONSTRUCTION CANCELLED/);
      assert.equal(r.buildings.length, 0);
      assert.equal(r.wood[team], 1000, 'unused construction is refunded once');
      assert.equal(unit().queuedWaypoints.length, 2, 'removing the job preserves accepted later travel');
    }
    if (interrupt) {
      order({ type: interrupt, ...(interrupt === 'move' ? { x: sign * 19.5, z: 9.5 } : {}) }, /(?:MOVE|STOP|HOLD POSITION) (?:ORDER|PLANNING)|PLANNING MOVE/);
      assert.equal(unit().buildingTargetId, null);
      assert.equal(unit().workIntent, null);
      assert.equal(unit().queuedWaypoints.length, 0);
      assert.deepEqual(r.units.filter(u => u.id !== id), untouched);
      return;
    }
    let firstAdvance = null;
    const finished = () => r.buildings.filter(b => siteIds.includes(b.id))
      .every(b => b.complete && (!repair || b.hp === BUILDING_DEFINITIONS[b.type].maxHp));
    until(() => {
      if (unit().queuedWaypoints.length < 2 && firstAdvance === null) {
        assert.ok(finished(), 'all accepted finite work completes before travel advances');
        firstAdvance = r.tick;
      }
      const goal = r.point(destinations[1]);
      return firstAdvance !== null && unit().queuedWaypoints.length === 0 && !unit().movePlanningPending
        && Math.hypot(unit().x - goal.x, unit().z - goal.z) < .02;
    }, 'queued route finishes');
    assert.equal(unit().workIntent, null);
    assert.equal(unit().buildingTargetId, null);
    assert.equal(unit().repairing, false);
    assert.deepEqual(r.units.filter(u => u.id !== id), untouched);
  } finally { await fixture.dispose(); }
}

for (const team of [0, 1]) {
  for (const wall of [false, true]) for (const cold of [false, true]) {
    test(`seat ${team}: finish ${wall ? 'wall sequence' : 'House'} before queued travel, cold=${cold}`, () => journey(team, { wall, cold }));
  }
  for (const cold of [false, true]) test(`seat ${team}: finish paid repair before queued travel, cold=${cold}`, () => journey(team, { repair: true, cold }));
  test(`seat ${team}: no-wood repair retains queued travel through recovery`, () => journey(team, { repair: true, pausedRepair: true, cold: true }));
  test(`seat ${team}: cancelled construction releases queued travel and refunds once`, () => journey(team, { cancel: true, cold: true }));
  test(`seat ${team}: full travel queue preserves construction without another payment`, () => journey(team, { queueLimit: true }));
  for (const interrupt of ['move', 'stop', 'holdPosition']) {
    test(`seat ${team}: ${interrupt} immediately replaces queued construction`, () => journey(team, { interrupt }));
  }
}
