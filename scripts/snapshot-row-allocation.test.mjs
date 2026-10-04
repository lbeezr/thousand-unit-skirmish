import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { baselineSnapshot, createSnapshotRowFixture } from './snapshot-row-fixture.mjs';
const shape = rows => Array.from(rows, row => ({ length: row.length, keys: Object.keys(row), entries: Object.entries(row) }));
function same(old, current) {
  for (const team of [0, 1, null]) {
    assert.deepEqual(shape(current.rows(team)), shape(old.rows(team)), `exact holes/values/field order for view ${team}`);
    assert.equal(JSON.stringify(current.rows(team)), JSON.stringify(old.rows(team)));
    for (const compressed of [false, true]) assert.deepEqual(current.frame(team, compressed), old.frame(team, compressed));
  }
}
test('wire oracle is the preserved b4641998 production snapshot body', () => {
  assert.equal(createHash('sha256').update(baselineSnapshot).digest('hex'), '4815ed55d734594e9883d68d10d5b0ac7a940f2923086f4ea49605411bb3154e');
});
for (const fog of [true, false]) test(`base-row construction keeps exact private snapshots and compressed/plain frames with fog ${fog}`, () => {
  const old = createSnapshotRowFixture({ baseline: true, fog }), current = createSnapshotRowFixture({ fog });
  for (const f of [old, current]) {
    f.units[8].attackTargetId = 0; f.units[24].attackTargetId = 0;
    f.units[8].lastAttackTick = 50; f.units[8].lastAttackX = 7; f.units[8].lastAttackZ = -8;
    f.units[1].lastAttackTick = 49; f.units[1].lastAttackX = 4; f.units[1].lastAttackZ = 5;
    f.units[9].hp = 0; f.units[9].attackTargetId = 0;
    f.units[25].lastAttackTick = 40;
    f.units[0].x = -.004; f.units[0].z = -0;
  }
  same(old, current);
  const own = current.rows(0).find(row => row[0] === 0);
  assert.equal(own[6], .0001, 'positive sub-cent cargo survives');
  assert.equal(own[10], fog ? 1 : 2, 'focus count obeys attacker ownership');
  assert.ok(Object.is(own[2], -0)); assert.ok(Object.is(own[3], -0));
  assert.equal(own[14], 'food'); assert.equal(own[17], 'gather-food');
  const fish = current.rows(0).find(row => row[0] === 1);
  assert.equal(fish[16], 'shore-fish'); assert.equal(fish[17], 'gather-food');
  assert.equal(Object.hasOwn(fish, 10), true);
  if (fog) {
    current.context.cellVisibleToTeam = () => true; old.context.cellVisibleToTeam = () => true;
    same(old, current);
    const enemy = current.rows(1).find(row => row[0] === 1);
    assert.equal(enemy[9], null); assert.equal(enemy[12], null); assert.equal(enemy[13], null);
    assert.equal(enemy[14], undefined); assert.equal(enemy[15], undefined); assert.equal(enemy[16], undefined); assert.equal(enemy[17], undefined);
    current.context.cellVisibleToTeam = () => false; old.context.cellVisibleToTeam = () => false;
    same(old, current); assert.ok(current.rows(1).every(row => row[1] === 1));
  }
  const persisted = JSON.stringify(current.units);
  same(old, current); assert.equal(JSON.stringify(current.units), persisted, 'snapshots do not mutate authoritative actor state');
});
test('death, reused generations, clear receipts and checkpoint-shaped recovery keep exact optional fields', () => {
  const old = createSnapshotRowFixture({ baseline: true }), current = createSnapshotRowFixture();
  for (const step of ['dead','reused','next tick','restored']) {
    for (const f of [old, current]) {
      if (step === 'dead') f.units[0].hp = 0;
      if (step === 'reused') { f.units[0].hp = 100; f.units[0].generation++; }
      if (step === 'next tick') { f.context.tickNumber++; f.journal.beginStep(f.context.tickNumber); }
      if (step === 'restored') { f.context.units = JSON.parse(JSON.stringify(f.units)); f.journal.clear(); }
    }
    same(old, current); assert.equal(current.rows(0).find(row => row[0] === 0)[17], null, step);
  }
});
test('large fixed rosters preserve sparse optional fields and exact serialized row order', () => {
  const old = createSnapshotRowFixture({ baseline:true,count:2000,workerSlots:4 });
  const current = createSnapshotRowFixture({ count:2000,workerSlots:4 });
  same(old,current);
});
