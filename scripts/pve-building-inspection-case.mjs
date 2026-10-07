import assert from 'node:assert/strict';
import { createPveHeadlessFixture, assertRecoveredWorkerObservation } from './pve-headless-fixture.mjs';
import { createSkirmishTargetPolicy } from '../src/simulation/ai/policies/skirmish-targets.mjs';
import { toOpponentObservation } from '../src/pve-opponent.mjs';

// Trusted lab geometry retains authored native identity; the tested targeting
// responsibility is Skirmish's policy, as in the existing controlled fixtures.
const identity = { matchModeId: 'authored', matchModeVersion: 1 };
const accepted = notices => !notices.some(notice => /REJECTED|FAILED|UNREACHABLE|NO REACHABLE|BLOCKED/.test(notice.message || ''));
const commandFor = (units, type, point = {}) => ({ type, ids: units.map(unit => unit.id),
  unitGenerations: units.map(unit => unit.generation), ...point });
const wire = value => JSON.parse(JSON.stringify(value));

// A trusted Tiny lab map, not fresh-map admission or a modified shipped map.
// One allied Worker supplies sight while a distant Infantry begins its assault.
export async function createBuildingInspectionCase(team) {
  const map = { id: 'pve-building-inspection', name: 'Tiny Building Sight Loss', width: 160, height: 160,
    terrainSeed: 19, fogOfWar: true, startingArmySize: 24,
    startingResources: { food: 150, wood: 250 },
    spawnPoints: [{ team: 0, x: -25, z: 0 }, { team: 1, x: 25, z: 0 }],
    obstacles: [], resourceNodes: [], triggers: [], scenarioEvents: [] };
  const fixture = await createPveHeadlessFixture(map, identity), r = fixture.replay;
  const view = seat => toOpponentObservation(r.observe(seat), seat, map);
  const setup = [], direction = team === 0 ? 1 : -1, enemy = 1 - team;
  const centerX = 28 * direction;
  const order = async (seat, command) => {
    const notices = await r.order(seat, command); r.drain();
    assert(accepted(notices), JSON.stringify({ command, notices }));
    setup.push({ tick: r.observe(seat).tick, seat, command, notices });
  };
  try {
    const opening = r.checkpoint();
    for (const seat of [0, 1]) await order(seat, commandFor(view(seat).units.friendly, 'holdPosition'));
    await order(enemy, commandFor(view(enemy).units.friendly, 'move', { x: 55 * direction, z: 35 }));
    const soldier = view(team).units.friendly.find(unit => unit.kind === 'infantry');
    const observer = view(team).units.friendly.find(unit => unit.kind === 'worker');
    await order(team, commandFor(view(team).units.friendly.filter(unit => ![soldier.id, observer.id].includes(unit.id)),
      'move', { x: -55 * direction, z: -35 }));
    const soldierPoint = { x: centerX - 14 * direction, z: .5 };
    const observerPoint = { x: centerX - 8.5 * direction, z: .5 };
    await order(team, commandFor([soldier], 'move', soldierPoint));
    await order(team, commandFor([observer], 'move', observerPoint));
    let ready = false;
    for (let step = 0; step < 3600; step++) {
      r.step();
      if ((step + 1) % 30) continue;
      const o = view(team), own = id => o.units.friendly.find(unit => unit.id === id);
      const other = view(enemy).units.friendly;
      if (Math.hypot(own(soldier.id).x - soldierPoint.x, own(soldier.id).z - soldierPoint.z) < .6
        && Math.hypot(own(observer.id).x - observerPoint.x, own(observer.id).z - observerPoint.z) < .6
        && other.every(unit => Math.hypot(unit.x - centerX, unit.z) > 20)) { ready = true; break; }
    }
    assert(ready, `ordinary positioning completes within 120 seconds: ${JSON.stringify({
      own: view(team).units.friendly.filter(unit => [soldier.id, observer.id].includes(unit.id)),
      enemy: view(enemy).units.friendly.map(unit => ({ id: unit.id, x: unit.x, z: unit.z })),
    })}`);
    await order(enemy, commandFor(view(enemy).units.friendly, 'holdPosition'));
    await order(team, commandFor([soldier], 'stop'));
    await order(team, commandFor([soldier], 'setStance', { stance: 'aggressive' }));
    const target = view(team).buildings.visibleEnemies.find(building => building.type === 'town-center');
    assert(target, 'ordinary allied sight discloses the actual enemy Town Center');
    await order(team, commandFor([observer], 'move', { x: centerX - 24 * direction, z: .5 }));
    let previous = null, lost = false;
    for (let step = 0; step < 600; step++) {
      r.step();
      if ((step + 1) % 3) continue;
      const o = view(team);
      if (!o.buildings.visibleEnemies.some(building => building.id === target.id)) { lost = true; break; }
      previous = { checkpoint: r.checkpoint(), views: [wire(r.observe(0)), wire(r.observe(1))], priming: o };
    }
    assert(lost && previous, 'ordinary allied withdrawal loses building sight at a native publication boundary');
    assert.equal(previous.checkpoint.state.homeTownCenters[enemy].hp, target.hp);
    assert.deepEqual(previous.checkpoint.state.teamFood, opening.state.teamFood);
    assert.deepEqual(previous.checkpoint.state.teamWood, opening.state.teamWood);
    assert.equal(previous.checkpoint.state.units.filter(unit => unit.hp > 0).length, 24);
    return { map, team, enemy, seed: 0, cohortIds: [soldier.id], target: { id: target.id, x: target.x, z: target.z, hp: target.hp },
      setup, ...previous };
  } finally { await fixture.dispose(); }
}

// All arms accept the same sighted entity order before the Worker withdraws.
// A fresh policy after loss is the no-history control; no hidden ID reaches it.
export async function replayBuildingInspection(data, { forgetOnLoss = false, coldAt = null, seconds = 15 } = {}) {
  let fixture = await createPveHeadlessFixture(data.map, identity), r = fixture.replay;
  let policy = createSkirmishTargetPolicy(data.seed), twin = createSkirmishTargetPolicy(data.seed);
  const trace = [], stages = {}, ids = new Set(data.cohortIds);
  const view = () => toOpponentObservation(r.observe(data.team), data.team, data.map);
  const soldiers = o => o.units.friendly.filter(unit => ids.has(unit.id) && unit.hp > 0);
  const issue = async o => {
    const commands = policy.next(o, soldiers(o));
    assert.deepEqual(commands, twin.next(structuredClone(o), structuredClone(soldiers(o))));
    for (const command of commands) {
      if (command.type === 'attackBuilding') assert(o.buildings.visibleEnemies.some(building => building.id === command.buildingId && building.hp > 0));
      else assert.equal(command.type, 'attackMove');
      const notices = await r.order(data.team, command); r.drain();
      assert(accepted(notices), JSON.stringify({ command, notices }));
      trace.push({ tick: o.tick, visible: o.buildings.visibleEnemies.some(building => building.id === data.target.id), command, notices });
    }
  };
  const restart = async () => {
    r.drain(); const checkpoint = r.checkpoint(), before = [wire(r.observe(0)), wire(r.observe(1))];
    const next = await createPveHeadlessFixture(data.map, identity);
    try {
      next.replay.restore(checkpoint);
      for (const seat of [0, 1]) assertRecoveredWorkerObservation(wire(next.replay.observe(seat)), before[seat]);
    } catch (error) { await next.dispose(); throw error; }
    await fixture.dispose(); fixture = next; r = next.replay;
    policy = createSkirmishTargetPolicy(data.seed); twin = createSkirmishTargetPolicy(data.seed);
    stages.restart = r.observe(data.team).tick;
  };
  try {
    r.restore(data.checkpoint);
    for (const seat of [0, 1]) assertRecoveredWorkerObservation(wire(r.observe(seat)), data.views[seat]);
    const initial = r.checkpoint();
    await issue(view());
    assert.equal(trace[0].command.type, 'attackBuilding');
    assert.equal(trace[0].command.buildingId, data.target.id);
    for (const id of ids) assert.equal(r.checkpoint().state.units.find(unit => unit.id === id).attackBuildingTargetId,
      data.target.id, 'initial sighted order actually assigns the native building target');
    for (let step = 1; step <= seconds * 30; step++) {
      r.step();
      if (step % 3) continue;
      const o = view(), disclosed = o.buildings.visibleEnemies.some(building => building.id === data.target.id);
      const native = r.checkpoint();
      if (!disclosed && stages.lost === undefined) {
        stages.lost = o.tick;
        assert.equal(native.state.homeTownCenters[data.enemy].hp, data.target.hp);
        if (forgetOnLoss) { policy = createSkirmishTargetPolicy(data.seed); twin = createSkirmishTargetPolicy(data.seed); }
        if (coldAt === 'loss') await restart();
      }
      if (stages.lost !== undefined && trace.length === 1
        && [...ids].every(id => native.state.units.find(unit => unit.id === id).attackBuildingTargetId === -1)) {
        stages.authorityCleared ??= o.tick;
      }
      if (disclosed && stages.lost !== undefined && stages.redisclosed === undefined) {
        stages.redisclosed = o.tick;
        if (coldAt === 'redisclosure') await restart();
      }
      if (native.state.homeTownCenters[data.enemy].hp < data.target.hp) stages.damage ??= o.tick;
      if (stages.lost !== undefined && step % 30 === 0 && step < seconds * 30) await issue(view());
    }
    return { forgetOnLoss, coldAt, seconds, initial, stages, trace, final: r.checkpoint() };
  } finally { await fixture.dispose(); }
}
