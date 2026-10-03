import assert from 'node:assert/strict';
import test from 'node:test';
import { createUnitPresentationClientFixture, workerSnapshotRow as row } from './unit-presentation-client-fixture.mjs';

for (const team of [0, 1]) for (const selected of [false, true]) {
  test(`seat ${team}, selected ${selected}: actual snapshot/frame path advances work and resumes after task interruption`, async () => {
    const f = await createUnitPresentationClientFixture({ localTeam: team });
    try {
      const data = { team, task: 'gathering', cargoType: 'wood', cargo: 1, audioExecution: 'wood',
        workHeading: 3 * Math.PI / 4 };
      f.apply([row(data)], { initial: true });
      if (selected) f.context.selected.add(0);
      const unit = f.unit(0);
      unit.angle = unit.targetAngle = data.workHeading;
      f.frame(1000, 0);
      assert.equal(f.frameId(0), 'gather-wood-south-east-0');
      f.frame(1300, 0.05);
      assert.equal(f.frameId(0), `gather-wood-south-east-${team ? 0 : 2}`);
      assert.equal(unit.spriteClockStartedAt, 1000);
      f.apply([row({ ...data, task: 'idle' })], { now: 1350 });
      assert.equal(f.frameId(0), 'idle-south-east-0', 'task interrupt writes idle immediately');
      f.apply([row(data)], { now: 1500 });
      assert.equal(f.frameId(0), 'gather-wood-south-east-0');
      assert.equal(unit.spriteClockStartedAt, 1500);
      assert.equal(f.context.selected.has(0), selected);
    } finally { f.dispose(); }
  });
}

test('real attack snapshot deduplication keeps one event clock and ends at the admitted authored duration', async () => {
  const f = await createUnitPresentationClientFixture();
  try {
    const data = { task: 'idle', attackTick: 4, attackX: 1, attackZ: -1 };
    f.apply([row(data)], { initial: true });
    const unit = f.unit(0); unit.angle = unit.targetAngle = 3 * Math.PI / 4;
    assert.equal(unit.attackStartedAt, 0, 'initial historical shot does not replay');
    f.apply([row({ ...data, attackTick: 5 })], { now: 1200 });
    assert.equal(f.frameId(0), 'attack-south-east-0');
    f.apply([row({ ...data, attackTick: 5 })], { now: 1500 });
    assert.equal(unit.attackStartedAt, 1200, 'duplicate snapshot does not restart');
    f.frame(1700, 0.05); assert.equal(f.frameId(0), 'attack-south-east-4');
    f.frame(2040, 0.05); assert.equal(f.frameId(0), 'idle-south-east-0');
    assert.equal(unit.attackStartedAt, 0);
  } finally { f.dispose(); }
});

test('actual interpolation drives walk independently of task and preserves its continuous clock', async () => {
  const f = await createUnitPresentationClientFixture();
  try {
    f.apply([row()], { initial: true });
    f.apply([row({ x: 1, z: -1 })]);
    f.frame(1016, 0.016);
    const unit = f.unit(0), start = unit.spriteClockStartedAt;
    assert.equal(unit.walking, true);
    assert.equal(unit.spriteClockState, 'walk');
    f.frame(1032, 0.016); assert.equal(unit.spriteClockStartedAt, start);
    for (let step = 3; step <= 40; step++) f.frame(1000 + step * 16, 0.016);
    assert.equal(unit.walking, false);
    assert.equal(unit.spriteClockState, 'idle');
    assert.equal(f.frameId(0), 'idle-south-east-0');
    assert.equal(unit.task, 'idle', 'moving pixels do not require a moving order label');
  } finally { f.dispose(); }
});

test('generation reuse clears selection and clocks; legacy snapshot clears fishing identity and heading', async () => {
  const f = await createUnitPresentationClientFixture();
  try {
    const data = { task: 'gathering', cargoType: 'food', cargo: 1, audioExecution: 'food',
      workResourceVariant: 'shore-fish', workHeading: 3 * Math.PI / 4 };
    f.apply([row(data)], { initial: true });
    f.context.selected.add(0); f.context.controlGroups[0].add(0);
    const unit = f.unit(0); unit.angle = unit.targetAngle = data.workHeading;
    f.frame(1000, 0); f.frame(1650, 0.05);
    assert.equal(f.frameId(0), 'gather-fish-south-east-2');
    f.apply([row({ generation: 2 })], { now: 1700 });
    assert.equal(unit.generation, 2);
    assert.equal(f.context.selected.size, 0); assert.equal(f.context.controlGroups[0].size, 0);
    assert.equal(unit.attackStartedAt, 0); assert.equal(unit.lastPlayedAttackTick, -1);
    assert.equal(unit.workResourceVariant, null); assert.equal(unit.workHeading, null);
    assert.equal(unit.spriteClockState, 'idle'); assert.equal(unit.spriteClockStartedAt, 1700);
    f.apply([row({ ...data, generation: 2 })], { now: 1800 });
    f.apply([row({ ...data, generation: 2 }).slice(0, 14)], { now: 1850 });
    assert.equal(unit.workResourceVariant, null); assert.equal(unit.workHeading, null);
    f.frame(1900, 0.05); assert.equal(unit.spriteClockState, 'gather');
  } finally { f.dispose(); }
});

test('sprite LOD scheduling advances actual work buffers and cosmetics leave snapshot values unchanged', async () => {
  const f = await createUnitPresentationClientFixture();
  try {
    const data = { task: 'gathering', cargoType: 'wood', cargo: 1, audioExecution: 'wood',
      workHeading: 3 * Math.PI / 4 };
    const input = Object.freeze(row(data)), before = JSON.stringify(input);
    f.apply([input], { initial: true });
    const unit = f.unit(0); unit.angle = unit.targetAngle = data.workHeading;
    f.context.unitLowDetailActive = true;
    f.frame(1000, 0); f.clearObservations();
    const mesh = f.mesh(0), version = mesh.geometry.getAttribute('instanceAtlasRect').version;
    f.frame(1300, 0.05);
    assert.equal(f.frameId(0), 'gather-wood-south-east-2');
    assert.ok(f.transformCalls.length > 0);
    assert.ok(mesh.geometry.getAttribute('instanceAtlasRect').version > version,
      'working sprite UV buffer is marked for upload at strategic LOD');
    assert.equal(JSON.stringify(input), before);
    assert.deepEqual([unit.hp, unit.cargo, unit.cargoType, unit.serverX, unit.serverZ], [100, 1, 'wood', 0, 0]);
    f.apply([row({ ...data, hp: 0 })], { now: 1400 });
    assert.equal(f.frameId(0), 'defeat-south-east-0', 'authoritative death overrides retained work');
    f.frame(1600, 0.05); assert.equal(f.frameId(0), 'defeat-south-east-1');
  } finally { f.dispose(); }
});

test('fog omission hides real matrices; redisclosure restores them without fabricating motion', async () => {
  const f = await createUnitPresentationClientFixture();
  try {
    const data = { team: 1, task: 'idle' };
    f.apply([row(data)], { initial: true, fogOfWar: true });
    assert.equal(f.hidden(0), false);
    f.apply([], { now: 1100, fogOfWar: true });
    assert.equal(f.hidden(0), true);
    f.frame(1200, 0.05); assert.equal(f.hidden(0), true);
    f.apply([row({ ...data, x: 2, z: 2 })], { now: 1300, fogOfWar: true });
    assert.equal(f.hidden(0), false);
    assert.equal(f.unit(0).renderX, 2); assert.equal(f.unit(0).renderZ, 2);
    f.frame(1350, 0.05); assert.equal(f.unit(0).walking, false);
    assert.equal(f.frameId(0), 'idle-south-east-0');
  } finally { f.dispose(); }
});
