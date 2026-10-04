import assert from 'node:assert/strict';
import test from 'node:test';
import { createUnitPresentationClientFixture, workerSnapshotRow as row } from './unit-presentation-client-fixture.mjs';

for (const team of [0, 1]) for (const selected of [false, true]) {
  test(`confirmed activity: seat ${team}, selected ${selected}, assigned waits use real idle frames`, async () => {
    const f = await createUnitPresentationClientFixture({ localTeam: team });
    try {
      for (const task of ['gathering', 'building', 'repairing']) {
        f.apply([row({ team, task, cargoType: 'wood', performingAction: null,
          workHeading: 3 * Math.PI / 4 })], { initial: true });
        const unit = f.unit(0); unit.angle = unit.targetAngle = 3 * Math.PI / 4;
        if (selected) f.context.selected.add(0);
        f.frame(1000, 0);
        assert.equal(f.frameId(0), 'idle-south-east-0', `${task} intent is not productive work`);
        assert.equal(unit.performingAction, null);
      }
    } finally { f.dispose(); }
  });
}

test('confirmed activity: no-wood repair clear changes the actual buffer immediately with authority otherwise stable', async () => {
  const f = await createUnitPresentationClientFixture();
  try {
    const data = { task: 'repairing', performingAction: 'repair' };
    f.apply([row(data)], { initial: true });
    f.unit(0).angle = f.unit(0).targetAngle = 3 * Math.PI / 4;
    f.frame(1000, 0); f.frame(1300, 0.05);
    assert.equal(f.frameId(0), 'repair-south-east-2');
    f.clearObservations();
    const version = f.mesh(0).geometry.getAttribute('instanceAtlasRect').version;
    f.apply([row({ ...data, performingAction: null })], { now: 1320 });
    assert.equal(f.frameId(0), 'idle-south-east-0', 'clear needs no movement, input or animation tick');
    assert.ok(f.transformCalls.length > 0);
    assert.ok(f.mesh(0).geometry.getAttribute('instanceAtlasRect').version > version);
    assert.equal(f.unit(0).task, 'repairing', 'intent remains available to HUD');
    const phase = f.unit(0).motionPhase;
    f.frame(1330, 0.01); assert.equal(f.unit(0).motionPhase, phase, 'waiting does not keep work scheduling alive');
    f.apply([row(data)], { now: 1400 });
    assert.equal(f.frameId(0), 'repair-south-east-0');
  } finally { f.dispose(); }
});

for (const team of [0, 1]) {
  test(`confirmed activity: seat ${team}, productive resource selects existing frames rather than previous cargo`, async () => {
    const f = await createUnitPresentationClientFixture({ localTeam: team });
    try {
      const data = { team, task: 'gathering', cargoType: 'wood', cargo: 1,
        performingAction: 'gather-food', workHeading: 3 * Math.PI / 4 };
      f.apply([row(data)], { initial: true });
      const unit = f.unit(0); unit.angle = unit.targetAngle = data.workHeading;
      f.frame(1000, 0);
      assert.equal(f.frameId(0), 'gather-food-south-east-0');
      f.frame(1300, 0.05);
      assert.equal(f.frameId(0), `gather-food-south-east-${team ? 0 : 2}`);
      const start = unit.spriteClockStartedAt;
      f.apply([row(data)], { now: 1350 });
      assert.equal(unit.spriteClockStartedAt, start, 'repeated positive snapshots preserve elapsed work');
      f.apply([row({ ...data, cargoType: 'food', performingAction: 'gather-wood' })], { now: 1400 });
      assert.equal(f.frameId(0), 'gather-wood-south-east-0', 'a different resource starts its own real clip');
      assert.equal(unit.spriteClockStartedAt, 1400);
      f.apply([row({ ...data, performingAction: 'gather-stone' })], { now: 1450 });
      assert.equal(f.frameId(0), 'idle-south-east-0', 'missing Stone sprites cannot be wood artwork');
    } finally { f.dispose(); }
  });
}

test('confirmed activity: missing or unknown protocol and incompatible actions clear without intent fallback', async () => {
  const f = await createUnitPresentationClientFixture();
  try {
    const data = { task: 'building', performingAction: 'build' };
    f.apply([row(data)], { initial: true });
    f.unit(0).angle = f.unit(0).targetAngle = 3 * Math.PI / 4;
    f.frame(1000, 0);
    for (const [action, version] of [['build', undefined], ['build', 2], ['build', '1'],
      ['unknown', 1], ['repair', 1], [null, 1]]) {
      f.apply([row({ ...data, performingAction: action })], { workerPerformingActionVersion: version });
      assert.equal(f.frameId(0), 'idle-south-east-0');
      assert.equal(f.unit(0).performingAction, null);
    }
    f.apply([row(data)]);
    f.apply([row(data).slice(0, 17)]);
    assert.equal(f.frameId(0), 'idle-south-east-0', 'a missing current action slot clears');
  } finally { f.dispose(); }
});

test('confirmed activity: generation change clears a positive row until a subsequent matching-generation grant', async () => {
  const f = await createUnitPresentationClientFixture();
  try {
    const data = { task: 'building', performingAction: 'build' };
    f.apply([row(data)], { initial: true });
    f.apply([row({ ...data, generation: 2 })], { now: 1200 });
    assert.equal(f.unit(0).performingAction, null);
    assert.equal(f.unit(0).spriteClockState, 'idle');
    f.apply([row({ ...data, generation: 2 })], { now: 1300 });
    assert.equal(f.unit(0).performingAction, 'build');
    assert.equal(f.unit(0).spriteClockState, 'build');
  } finally { f.dispose(); }
});

test('concurrent fixture construction preserves the caller fetch binding', async () => {
  const originalFetch = globalThis.fetch;
  const fixtures = await Promise.all([createUnitPresentationClientFixture(), createUnitPresentationClientFixture()]);
  try {
    assert.equal(globalThis.fetch, originalFetch);
    for (const fixture of fixtures) {
      fixture.apply([row()], { initial: true });
      assert.equal(fixture.frameId(0), 'idle-east-0');
    }
  } finally { for (const fixture of fixtures) fixture.dispose(); }
});

for (const team of [0, 1]) for (const selected of [false, true]) {
  test(`seat ${team}, selected ${selected}: actual snapshot/frame path advances work and resumes after task interruption`, async () => {
    const f = await createUnitPresentationClientFixture({ localTeam: team });
    try {
      const data = { team, task: 'gathering', cargoType: 'wood', cargo: 1, audioExecution: 'wood', performingAction: 'gather-wood',
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
    const data = { task: 'gathering', cargoType: 'food', cargo: 1, audioExecution: 'food', performingAction: 'gather-food',
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
    f.frame(1900, 0.05); assert.equal(unit.spriteClockState, 'idle');
  } finally { f.dispose(); }
});

test('sprite LOD scheduling advances actual work buffers and cosmetics leave snapshot values unchanged', async () => {
  const f = await createUnitPresentationClientFixture();
  try {
    const data = { task: 'gathering', cargoType: 'wood', cargo: 1, audioExecution: 'wood', performingAction: 'gather-wood',
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
