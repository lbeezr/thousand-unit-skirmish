import assert from 'node:assert/strict';
import { assertRecoveredWorkerObservation, createPveHeadlessFixture } from './pve-headless-fixture.mjs';
import { createDeterministicPolicy, toOpponentObservation } from '../src/pve-opponent.mjs';

export async function replayPaidObstruction(team, { initial = null, policyFactory = createDeterministicPolicy,
  restart = true, limitTicks = 5400 } = {}) {
  const enemy = 1 - team, home = team ? 28 : -28, column = team ? 48 : 32;
  const map = { id: `paid-blocked-watch-${team}`, name: 'Paid Blocked Watch', width: 80, height: 64,
    terrainSeed: 19, fogOfWar: true, startingArmySize: 24, startingResources: { food: 150, wood: 250 },
    spawnPoints: [{ team, x: home, z: 0 }, { team: enemy, x: -home, z: 0 }], obstacles: [],
    resourceNodes: [{ id: 'own-food', type: 'food', x: home, z: 6.5, stock: 1000 },
      { id: 'own-wood', type: 'wood', x: home, z: -6.5, stock: 1000 },
      { id: 'enemy-food', type: 'food', x: -home, z: 6.5, stock: 1000 },
      { id: 'enemy-wood', type: 'wood', x: -home, z: -6.5, stock: 1000 }],
    triggers: [{ id: 'blocked-watch', name: 'Blocked Watch', type: 'capture-zone',
      zone: { column: column - 2, row: 30, width: 4, height: 4 } },
    { id: 'open-watch', name: 'Open Watch', type: 'capture-zone',
      zone: { column: team ? 43 : 33, row: 48, width: 4, height: 4 } }].map(trigger => ({ ...trigger,
      requiredUnits: 5, captureSeconds: 9, foodReward: 0, woodReward: 0, unitCount: 0, unitKind: 'infantry', victory: true })),
    victoryMode: 'any', scenarioEvents: [] };
  const fixture = await createPveHeadlessFixture(map), r = fixture.replay, trace = [];
  const observation = seat => toOpponentObservation(r.observe(seat), seat, map);
  const order = async (seat, command) => {
    const notices = await r.order(seat, command); r.drain();
    assert.ok(!notices.some(n => /REJECTED|FAILED|UNREACHABLE/.test(n.message || '')), JSON.stringify(notices));
    trace.push({ tick: r.observe(team).tick, seat, command, notices });
  };
  const commandFor = (units, type, extra = {}) => ({ type, ids: units.map(u => u.id),
    unitGenerations: units.map(u => u.generation), ...extra });
  const until = (condition, label, limit = 12000) => {
    for (let n = 0; n < limit && !condition(); n++) r.step();
    assert.ok(condition(), label);
  };
  try {
    if (initial) r.restore(initial);
    else {
      for (const seat of [team, enemy]) await order(seat, commandFor(observation(seat).units.friendly.filter(u => u.kind === 'infantry'), 'holdPosition'));
      const workers = observation(enemy).units.friendly.filter(u => u.kind === 'worker');
      await order(enemy, commandFor(workers, 'gather', { nodeId: 'enemy-wood' }));
      until(() => r.observe(enemy).wood[enemy] >= 350, 'ordinary deposits pay for the empty enclosure');
      await order(enemy, commandFor(workers, 'stop'));
      const left = column - 3, right = column + 2, top = 29, bottom = 34;
      const lines = [[{ column: left, row: top }, { column: right, row: top }],
        [{ column: right, row: top }, { column: right, row: bottom }],
        [{ column: left, row: bottom }, { column: right, row: bottom }]];
      for (const points of lines) {
        await order(enemy, commandFor(workers, 'buildWall', { points }));
        until(() => r.observe(enemy).buildings.every(b => b.complete), 'paid wall line completes');
      }
      const outside = { x: left - 40 - 2.5, z: 0 };
      await order(enemy, commandFor(workers, 'move', outside));
      until(() => observation(enemy).units.friendly.filter(u => u.kind === 'worker').every(u => Math.hypot(u.x - outside.x, u.z) < 4), 'builders leave before closing');
      await order(enemy, commandFor(workers, 'buildWall', { points: [{ column: left, row: top }, { column: left, row: bottom }] }));
      until(() => r.observe(enemy).buildings.every(b => b.complete), 'empty enclosure completes');
      await order(enemy, commandFor(workers, 'move', { x: -home, z: 7.5 }));
      until(() => observation(enemy).units.friendly.filter(u => u.kind === 'worker').every(u => Math.abs(u.x + home) < 5), 'builders return home');
      r.drain(); initial = r.checkpoint();
    }
    trace.length = 0;
    const startTick = r.observe(team).tick;
    let policy = policyFactory(20260925), shadow = policyFactory(20260925), restartedAt = null, alternativeAt = null;
    for (let n = 0; n <= limitTicks && r.observe(team).winner < 0; n++) {
      if (n % 30 === 0) {
        if (restart && n >= 900 && restartedAt === null) {
          r.drain(); const before = r.observe(team), checkpoint = r.checkpoint(); r.restore(checkpoint);
          assertRecoveredWorkerObservation(r.observe(team), before, 'checkpoint preserves real walls, paths, queues, banks and fog');
          policy = policyFactory(20260925); shadow = policyFactory(20260925);
          restartedAt = r.observe(team).tick; trace.push({ tick: restartedAt, restart: true });
        }
        const view = observation(team), commands = policy.next(view);
        assert.deepEqual(commands, shadow.next(structuredClone(view)));
        for (const command of commands) {
          if (command.type === 'attackMove' && command.z === 18) alternativeAt ??= view.tick;
          await order(team, command);
        }
      }
      r.step();
    }
    const final = r.checkpoint();
    assert.equal(final.state.buildings.filter(b => b.team === enemy && b.type === 'palisade-wall' && b.hp > 0 && b.complete).length, 20);
    const enemyWorkers = final.state.units.filter(u => u.team === enemy && u.kind === 'worker' && u.hp > 0);
    const cargo = enemyWorkers.filter(u => u.cargoType === 'wood').reduce((sum, u) => sum + u.cargo, 0);
    const stock = final.state.resourceNodes.find(node => node.id === 'enemy-wood').stock;
    assert.ok(Math.abs(250 + 1000 - stock - cargo - 300 - final.state.teamWood[enemy]) < 1e-5, 'the entire 300-wood ring stays paid');
    return { initial, result: { team, startTick, endTick: r.observe(team).tick, winner: r.observe(team).winner,
      restartedAt, alternativeAt, owners: r.observe(team).objectives.map(o => ({ id: o.id, owner: o.owner })), trace, final } };
  } finally { await fixture.dispose(); }
}
