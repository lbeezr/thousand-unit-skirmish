import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createPveHeadlessFixture, assertRecoveredWorkerObservation } from './pve-headless-fixture.mjs';
import { createDeterministicPolicy, toOpponentObservation } from '../src/pve-opponent.mjs';
import { BUILDING_DEFINITIONS, UNIT_DEFINITIONS } from '../src/gameplay-definitions.mjs';

const identity = { matchModeId: 'skirmish', matchModeVersion: 1 };
const selected = (units, type, extra = {}) => ({ type, ids: units.map(u => u.id),
  unitGenerations: units.map(u => u.generation), ...extra });

// Canonical Medium map, paid Scout/Stable, actual local stock depletion.
// Neither opening nor continuation checkpoints are edited.
export async function replayWoodDiscovery(team, { opening = null, prepared = null,
  cold = false, control = 'none', seconds = 180 } = {}) {
  assert.ok([0, 1].includes(team));
  assert.ok(['none', 'no-disclosure', 'no-forest-gather'].includes(control));
  assert.ok(Number.isInteger(seconds) && seconds >= 1 && seconds <= 180);
  process.env.RTS_MAP = 'maps/open-field.json'; process.env.RTS_GAME_MODE = 'pvp'; process.env.RTS_PREGAME = '0';
  delete process.env.RTS_MATCH_STATE_PATH;
  const map = JSON.parse(await readFile(new URL('../maps/veyrholds-riven-escarpment.json', import.meta.url)));
  let fixture = await createPveHeadlessFixture(map, identity), r = fixture.replay;
  const view = seat => toOpponentObservation(r.observe(seat), seat, map);
  const trace = [], samples = [], spent = { food: 0, wood: 0 }, setup = { stages: {}, spentFood: 0, spentWood: 0, trace: [] };
  const order = async (seat, command, rows = trace) => {
    const before = r.observe(seat), notices = await r.order(seat, command); r.drain();
    assert.ok(!notices.some(n => /REJECTED|FAILED|UNREACHABLE|NO REACHABLE/.test(n.message || '')), JSON.stringify({ command, notices }));
    const after = r.observe(seat);
    rows.push({ tick: before.tick, team: seat, command, notices });
    if (rows === trace) {
      spent.food += before.food[seat] - after.food[seat]; spent.wood += before.wood[seat] - after.wood[seat];
    }
    return { food: before.food[seat] - after.food[seat], wood: before.wood[seat] - after.wood[seat] };
  };
  try {
    if (prepared) r.restore(prepared);
    else {
      if (opening) r.restore(opening); else opening = r.checkpoint();
      assert.deepEqual(opening.state.teamFood, [150, 150]);
      assert.deepEqual(opening.state.teamWood, [250, 250]);
      for (const seat of [0, 1]) await order(seat, selected(view(seat).units.friendly, 'holdPosition'), setup.trace);
      const workers = view(team).units.friendly.filter(u => u.kind === 'worker');
      const home = map.spawnPoints.find(p => p.team === team);
      const cost = await order(team, selected(workers, 'build', { buildingType: 'stable', x: home.x + (team ? -10 : 10), z: 3.5 }), setup.trace);
      setup.spentWood += cost.wood;
      let stable;
      for (let tick = 0; tick < 3000; tick++) {
        stable = view(team).buildings.friendly.find(b => b.type === 'stable' && b.complete);
        if (stable) break;
        r.step();
      }
      assert.ok(stable, 'ordinary paid Stable completes'); setup.stages.stable = r.observe(team).tick;
      const trainCost = await order(team, { type: 'trainUnit', buildingId: stable.id, kind: 'scout' }, setup.trace);
      setup.spentFood += trainCost.food; setup.spentWood += trainCost.wood;
      await order(team, selected(workers, 'gather', { nodeId: `s${team}-home-wood` }), setup.trace);
      const local = () => r.checkpoint().state.resourceNodes.find(n => n.id === `s${team}-home-wood`);
      for (let tick = 0; tick < 24000; tick++) {
        if (tick % 30 === 0) {
          if (view(team).units.friendly.some(u => u.kind === 'scout')) setup.stages.scout ??= r.observe(team).tick;
          if (local().stock === 0) setup.stages.depleted ??= r.observe(team).tick;
          if (setup.stages.depleted && view(team).units.friendly.filter(u => u.kind === 'worker').every(u => u.task === 'idle' && u.cargo === 0)) break;
        }
        r.step();
      }
      assert.equal(local().stock, 0, 'ordinary harvesting depletes all 975 local wood');
      assert.ok(view(team).units.friendly.filter(u => u.kind === 'worker').every(u => u.task === 'idle' && u.cargo === 0), 'all local cargo is actually delivered before continuation');
      assert.equal(setup.spentWood, BUILDING_DEFINITIONS.stable.cost.wood + UNIT_DEFINITIONS.scout.cost.wood);
      assert.equal(setup.spentFood, UNIT_DEFINITIONS.scout.cost.food);
      prepared = r.checkpoint();
      assert.ok(Math.abs(prepared.state.teamWood[team] - (250 + 975 - setup.spentWood)) < 1e-5, 'paid prelude conserves local stock, bank and construction/training');
    }
    const startTick = r.observe(team).tick, start = view(team);
    const scout = start.units.friendly.find(u => u.kind === 'scout' && u.hp > 0);
    assert.ok(scout, 'a native paid living Scout survives the prelude');
    let policy = createDeterministicPolicy(20260925, identity), shadow = createDeterministicPolicy(20260925, identity);
    const stages = { forestDisclosed: null, forestGather: null, woodDeposit: null, coldRestart: null };
    let forestCells = [], restartRequested = false, depositWitness = null, disclosureWitness = null;
    const forestWorkers = new Map();
    for (let step = 0; step <= seconds * 30; step++) {
      if (step % 30 === 0) {
        const observation = view(team);
        forestCells = observation.forestCells || [];
        if (forestCells.length && stages.forestDisclosed === null) {
          stages.forestDisclosed = observation.tick;
          const currentScout = observation.units.friendly.find(u => u.id === scout.id && u.generation === scout.generation);
          disclosureWitness = { tick: observation.tick, scout: currentScout, cells: forestCells };
        }
        const policyView = control === 'no-disclosure' ? { ...observation, forestCells: [] } : observation;
        const commands = policy.next(policyView);
        assert.deepEqual(commands, shadow.next(structuredClone(policyView)));
        if (step < seconds * 30) for (const command of commands) {
          const suppressed = control === 'no-forest-gather' && command.type === 'gather' && Object.hasOwn(command, 'forestCell');
          if (suppressed) { trace.push({ tick: observation.tick, team, suppressed: command }); continue; }
          if (command.type === 'gather' && Object.hasOwn(command, 'forestCell')) {
            assert.ok(forestCells.some(n => n.cell === command.forestCell), 'ordinary Gather uses a currently disclosed positive tree');
            stages.forestGather ??= observation.tick; restartRequested ||= cold && stages.coldRestart === null;
            for (const id of command.ids) forestWorkers.set(id, observation.units.friendly.find(u => u.id === id).generation);
          }
          if (command.type === 'gather' && Object.hasOwn(command, 'nodeId')) for (const id of command.ids) forestWorkers.delete(id);
          await order(team, command);
        }
        samples.push([r.observe(0), r.observe(1)]);
      }
      if (restartRequested) {
        const checkpoint = r.checkpoint(), before = [r.observe(0), r.observe(1)];
        const fresh = await createPveHeadlessFixture(map, identity); fresh.replay.restore(checkpoint);
        for (const seat of [0, 1]) assertRecoveredWorkerObservation(fresh.replay.observe(seat), before[seat], 'fresh restore preserves complete both-seat authority views');
        await fixture.dispose(); fixture = fresh; r = fresh.replay;
        policy = createDeterministicPolicy(20260925, identity); shadow = createDeterministicPolicy(20260925, identity);
        stages.coldRestart = r.observe(team).tick; restartRequested = false;
      }
      if (step < seconds * 30) {
        const before = r.observe(team); r.step(); const after = r.observe(team);
        if (stages.forestGather !== null && after.wood[team] > before.wood[team]) {
          const delivered = before.units.filter(u => forestWorkers.get(u[0]) === u[8] && u[7] === 'wood' && u[6] > 0)
            .filter(u => after.units.some(v => v[0] === u[0] && v[8] === u[8] && v[6] === 0));
          if (delivered.length) {
            stages.woodDeposit = after.tick;
            depositWitness = { tick: after.tick, before, after, delivered,
              bankIncrease: after.wood[team] - before.wood[team] };
            assert.ok(Math.abs(depositWitness.bankIncrease - delivered.reduce((sum, u) => sum + u[6], 0)) < 1e-5, 'matching forest Workers deliver their actual cargo to the native bank');
            break;
          }
        }
      }
    }
    const final = r.checkpoint();
    const accountedWood = state => state.teamWood.reduce((sum, bank) => sum + bank, 0)
      + state.resourceNodes.filter(n => n.type === 'wood').reduce((sum, n) => sum + n.stock, 0)
      + state.units.filter(u => u.hp > 0 && u.cargoType === 'wood').reduce((sum, u) => sum + u.cargo, 0)
      + state.forestStocks.reduce((sum, [, stock]) => sum + stock - 6, 0);
    const woodResidue = accountedWood(prepared.state) - accountedWood(final.state) - spent.wood;
    assert.ok(Math.abs(woodResidue) < 0.0001, 'native ordinary/forest stock, cargo, banks and paid continuation spending reconcile');
    return { opening, setup: prepared && setup.trace.length ? setup : null, prepared,
      result: { team, identity, control, cold, seconds, startTick, scout, start, stages,
        disclosureWitness, depositWitness, forestCells, spent, woodResidue, trace, samples, final } };
  } finally { await fixture.dispose(); }
}

// One branch per fresh process keeps native fixture modules from accumulating.
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const options = JSON.parse(await readFile(process.argv[3], 'utf8'));
  await writeFile(process.argv[4], JSON.stringify(await replayWoodDiscovery(Number(process.argv[2]), options)));
}
