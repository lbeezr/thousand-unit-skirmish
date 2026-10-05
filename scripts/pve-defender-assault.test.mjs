import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createSkirmishTargetPolicy, selectSkirmishTarget } from '../src/pve-skirmish-targets.mjs';
import { UNIT_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { loadDefenderAssault, replayDefenderAssault } from './pve-defender-assault-case.mjs';

const unit = (team, id, extra = {}) => ({ team, id, generation: 1, x: 0, z: 0,
  hp: 100, kind: 'infantry', focusedCount: 0, lastAttack: null, ...extra });
function observation(team) {
  return { team, tick: 0, units: { friendly: [unit(team, 1), unit(team, 2, { x: 40 })],
    visibleEnemies: [unit(1 - team, 95, { x: 1.2, generation: 7 })] },
  buildings: { visibleEnemies: [{ team: 1 - team, id: 100, type: 'town-center', complete: true,
    hp: 2400, x: 2, z: 0 }] }, map: { id: 'veyrholds-terraced-vale', width: 160, height: 160 } };
}
for (const team of [0, 1]) for (const seed of [0, 20260925, 0xffffffff]) {
  test(`seat ${team}, seed ${seed}: immediate disclosed defender precedes producer with generation-bound orders`, () => {
    const state = observation(team), policy = createSkirmishTargetPolicy(seed);
    assert.equal(selectSkirmishTarget(state, state.units.friendly).targetId, 95,
      'a distant reinforcement cannot hide the threat to the frontline behind the cohort center');
    const commands = policy.next(state, state.units.friendly);
    assert.deepEqual(commands, [{ type: 'attack', ids: [1, 2], unitGenerations: [1, 1], targetId: 95, targetGeneration: 7 }]);
    assert.deepEqual(commands, createSkirmishTargetPolicy(seed).next(structuredClone(state), structuredClone(state.units.friendly)));
    assert.deepEqual(policy.next(state, state.units.friendly), [], 'unchanged target retains retry budget');
    state.tick++; state.units.visibleEnemies[0].generation++;
    assert.equal(policy.next(state, state.units.friendly)[0].targetGeneration, 8, 'reused target identity binds its new public generation');
    state.tick++; state.units.visibleEnemies = [];
    assert.equal(policy.next(state, state.units.friendly)[0].buildingId, 100, 'lost unit sight immediately releases entity targeting');
  });
}
for (const team of [0, 1]) {
  test(`seat ${team}: proximity uses the public enemy range and preserves distant/nonmilitary producer priority`, () => {
    for (const kind of ['infantry', 'spearman', 'archer', 'scout', 'rider', 'siege-engine']) {
      const state = observation(team), target = state.units.visibleEnemies[0]; target.kind = kind;
      target.x = UNIT_DEFINITIONS[kind].combat.range;
      assert.equal(selectSkirmishTarget(state, state.units.friendly).targetId, 95, `${kind} at its disclosed range`);
      target.x += .01;
      assert.equal(selectSkirmishTarget(state, state.units.friendly).buildingId, 100, `${kind} outside range`);
    }
    for (const extra of [{ kind: 'worker' }, { kind: 'skiff' }, { kind: 'unknown' }, { hp: 0 }, { team }, { x: 12 }]) {
      const state = observation(team); Object.assign(state.units.visibleEnemies[0], extra);
      assert.equal(selectSkirmishTarget(state, state.units.friendly).buildingId, 100, JSON.stringify(extra));
    }
  });
  test(`seat ${team}: immediate defender keeps focused and recent combat protection`, () => {
    const state = observation(team), policy = createSkirmishTargetPolicy(0);
    state.units.friendly[0].focusedCount = 1; state.units.friendly[1].lastAttack = { tick: 0 };
    assert.deepEqual(policy.next(state, state.units.friendly), []);
    state.tick = 120; state.units.friendly[0].focusedCount = 0;
    assert.deepEqual(policy.next(state, state.units.friendly)[0].ids, [1, 2]);
  });
}
for (const mode of ['authored', 'skirmish']) for (const cold of [false, true]) {
  test(`Tiny ${mode}, seat 1: real defender assault ${cold ? 'cold combat restore' : 'warm'} preserves four attackers and repeats exactly`, async () => {
    const input = await loadDefenderAssault(mode), result = await replayDefenderAssault(input, { cold });
    assert.deepEqual(await replayDefenderAssault(input, { cold }), result, 'all accepted orders, notices and full terminal authority repeat');
    if (process.env.RTS_PVE_DEFENDER_EVIDENCE_DIR) await writeFile(path.join(process.env.RTS_PVE_DEFENDER_EVIDENCE_DIR,
      `defender-${mode}-${cold ? 'cold' : 'warm'}.json`), JSON.stringify({ input, result }));
    console.log(JSON.stringify({ mode, cold, stages: result.stages, survivingFrontline: input.frontlineIds,
      townCenterDamage: result.initialTownCenterHp - result.finalTownCenterHp, rejectedCommands: 0, winner: result.final.state.matchWinner }));
  });
}
