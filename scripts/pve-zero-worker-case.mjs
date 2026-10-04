import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createDeterministicPolicy, toOpponentObservation } from '../src/pve-opponent.mjs';
import { createPveHeadlessFixture, assertRecoveredWorkerObservation } from './pve-headless-fixture.mjs';

// Canonical Medium geometry, normal starting banks and actual combat casualties.
// The human prelude spends 100 food on two Workers, then loses all six Workers.
export async function replayZeroWorkerRecovery(team, initial = null) {
  const map = JSON.parse(await readFile(new URL('../maps/veyrholds-riven-escarpment.json', import.meta.url)));
  const identity = { matchModeId: 'skirmish', matchModeVersion: 1 }, enemy = 1 - team;
  let fixture = await createPveHeadlessFixture(map, identity), r = fixture.replay;
  const trace = [], stages = {};
  let spentFood = 0, spentWood = 0;
  const view = seat => toOpponentObservation(r.observe(seat), seat, map);
  const order = async (seat, command) => {
    const before = r.observe(seat), notices = await r.order(seat, command); r.drain();
    assert.ok(!notices.some(notice => /REJECTED|FAILED|UNREACHABLE/.test(notice.message || '')),
      JSON.stringify({ command, notices }));
    const after = r.observe(seat);
    spentFood += before.food[seat] - after.food[seat];
    spentWood += before.wood[seat] - after.wood[seat];
    trace.push({ tick: before.tick, team: seat, command, notices });
  };
  const selected = (units, type, extra = {}) => ({ type, ids: units.map(u => u.id),
    unitGenerations: units.map(u => u.generation), ...extra });
  try {
    if (initial) r.restore(initial); else initial = r.checkpoint();
    assert.deepEqual(initial.state.teamFood, [150, 150]);
    assert.deepEqual(initial.state.teamWood, [250, 250]);
    assert.equal(initial.state.units.filter(unit => unit.hp > 0).length, 24);
    for (const seat of [0, 1]) await order(seat, selected(view(seat).units.friendly, 'holdPosition'));
    const center = view(team).buildings.friendly.find(b => b.home && b.complete);
    for (let i = 0; i < 2; i++) await order(team, { type: 'trainUnit', kind: 'worker', buildingId: center.id });
    assert.equal(r.observe(team).food[team], 50);
    for (let i = 0; i < 3000 && view(team).units.friendly.filter(u => u.kind === 'worker').length < 6; i++) r.step();
    const workers = view(team).units.friendly.filter(u => u.hp > 0 && u.kind === 'worker');
    assert.equal(workers.length, 6, 'both paid opening Workers actually spawn');
    const destination = map.spawnPoints.find(point => point.team === enemy);
    await order(team, selected(workers, 'move', { x: destination.x, z: destination.z }));
    let focus = null;
    for (let i = 0; i < 9000 && view(team).units.friendly.some(u => u.hp > 0 && u.kind === 'worker'); i++) {
      if (i % 30 === 0) {
        const observation = view(enemy), target = observation.units.visibleEnemies
          .filter(u => u.hp > 0 && u.kind === 'worker').sort((a, b) => a.hp - b.hp || a.id - b.id)[0];
        const key = target && `${target.id}:${target.generation}`;
        if (target && focus !== key) {
          const guards = observation.units.friendly.filter(u => u.hp > 0 && u.kind === 'infantry');
          await order(enemy, selected(guards, 'setStance', { stance: 'aggressive' }));
          await order(enemy, selected(guards, 'attack', { targetId: target.id, targetGeneration: target.generation }));
          focus = key;
        }
      }
      r.step();
    }
    const loss = r.checkpoint(); stages.loss = r.observe(team).tick;
    assert.equal(loss.state.units.filter(u => u.team === team && u.hp > 0 && u.kind === 'worker').length, 0);
    assert.equal(r.observe(team).food[team], 50, 'the real loss leaves exactly one Worker price');
    assert.equal(view(team).buildings.friendly.find(b => b.id === center.id)
      .productionOptions.find(option => option.kind === 'worker').available, true);

    let policy = createDeterministicPolicy(20260925, identity), restarted = false;
    for (let i = 0; i < 2400; i++) {
      if (i % 30 === 0) for (const command of policy.next(view(team))) {
        const beforeFood = r.observe(team).food[team]; await order(team, command);
        if (command.type === 'trainUnit' && command.kind === 'worker') {
          stages.purchase ??= r.observe(team).tick;
          assert.equal(beforeFood - r.observe(team).food[team], 50, 'authoritative training debits the full Worker price');
          if (!restarted) {
            const before = [r.observe(0), r.observe(1)], checkpoint = r.checkpoint();
            const recovered = await createPveHeadlessFixture(map, identity);
            try {
              recovered.replay.restore(checkpoint);
              for (const seat of [0, 1]) assertRecoveredWorkerObservation(recovered.replay.observe(seat), before[seat]);
            } catch (error) { await recovered.dispose(); throw error; }
            await fixture.dispose(); fixture = recovered; r = fixture.replay;
            policy = createDeterministicPolicy(20260925, identity); restarted = true;
            stages.restart = r.observe(team).tick;
            trace.push({ tick: stages.restart, restart: true });
          }
        }
      }
      const observation = view(team);
      if (observation.units.friendly.some(u => u.hp > 0 && u.kind === 'worker')) stages.spawn ??= observation.tick;
      r.step();
      const afterStep = view(team);
      if (restarted && stages.spawn !== undefined && (afterStep.resources.food > observation.resources.food
        || afterStep.resources.wood > observation.resources.wood)) {
        stages.deposit = afterStep.tick; break;
      }
    }
    const final = r.checkpoint(), conservation = {};
    for (const [resource, key, spent] of [['food', 'teamFood', spentFood], ['wood', 'teamWood', spentWood]]) {
      const stock = state => state.resourceNodes.filter(node => node.type === resource).reduce((sum, node) => sum + node.stock, 0);
      const consumed = stock(initial.state) - stock(final.state);
      const cargo = final.state.units.filter(unit => unit.cargoType === resource).reduce((sum, unit) => sum + unit.cargo, 0);
      const residue = initial.state[key].reduce((sum, bank) => sum + bank, 0) + consumed - cargo - spent
        - final.state[key].reduce((sum, bank) => sum + bank, 0);
      assert.ok(Math.abs(residue) < 1e-5, `${resource}: native stock, cargo, bank and spending reconcile`);
      conservation[resource] = { consumed, cargo, spent, residue };
    }
    return { initial, result: { team, identity, stages, loss, trace, conservation, final } };
  } finally { await fixture.dispose(); }
}
