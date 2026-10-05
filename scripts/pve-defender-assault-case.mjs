import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { createPveHeadlessFixture, assertRecoveredWorkerObservation } from './pve-headless-fixture.mjs';
import { createDeterministicPolicy, toOpponentObservation } from '../src/pve-opponent.mjs';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export async function loadDefenderAssault(mode) {
  const provenance = JSON.parse(await readFile(new URL('fixtures/pve-defender-assault/provenance.json', import.meta.url)));
  const descriptor = provenance.checkpoints.find(row => row.mode === mode);
  assert.ok(descriptor);
  const compressed = await readFile(new URL(`fixtures/pve-defender-assault/${descriptor.filename}`, import.meta.url));
  assert.equal(digest(compressed), descriptor.compressedSha256);
  const bytes = gunzipSync(compressed);
  assert.equal(digest(bytes), descriptor.checkpointSha256);
  const loss = JSON.parse(bytes);
  assert.equal(loss.state.tickNumber, provenance.terminalTick);
  assert.equal(loss.matchModeId, mode);
  assert.equal(loss.state.matchWinner, -1);
  return { ...provenance, ...descriptor, map: loss.mapDefinition, loss };
}

// Restore the complete failure. Both seats use ordinary public observations and
// normal policies, including economy, home defense, rally and combat protection.
export async function replayDefenderAssault(input, { cold = false } = {}) {
  const { map, nativeIdentity, policyIdentity, team, loss, seeds, frontlineIds, defenderId, townCenterId } = input;
  let fixture = await createPveHeadlessFixture(map, nativeIdentity), r = fixture.replay;
  const view = seat => toOpponentObservation(r.observe(seat), seat, map);
  let policies = seeds.map(seed => createDeterministicPolicy(seed, policyIdentity));
  let twins = seeds.map(seed => createDeterministicPolicy(seed, policyIdentity));
  const trace = [], stages = {}, initialHp = loss.state.homeTownCenters[1 - team].hp;
  try {
    r.restore(loss);
    const initialView = view(team), state = r.observe(team), hidden = structuredClone(state), enemy = 1 - team;
    const fog = Buffer.from(state.visibility.data, 'base64');
    const cell = Array.from({ length: map.width * map.height }, (_, index) => index)
      .find(index => ((fog[index >> 2] >> ((index & 3) * 2)) & 3) !== 2);
    assert.ok(Number.isInteger(cell));
    hidden.food[enemy] = 100000; hidden.wood[enemy] = 100000;
    hidden.units.push([10000, enemy, cell % map.width - map.width / 2 + .5,
      Math.floor(cell / map.width) - map.height / 2 + .5, 100, 'infantry', 0, '', 1]);
    assert.deepEqual(toOpponentObservation(hidden, team, map), initialView,
      'hidden banks and an undisclosed armed unit cannot change target selection');
    assert.ok(initialView.units.visibleEnemies.some(unit => unit.id === defenderId && unit.hp === 100));
    assert.ok(initialView.buildings.visibleEnemies.some(building => building.id === townCenterId));
    for (const id of frontlineIds) assert.ok(initialView.units.friendly.some(unit => unit.id === id && unit.hp > 0));
    for (let i = 0; i < 1800; i++) {
      if (cold && i === 30) {
        r.drain(); const checkpoint = r.checkpoint(), before = [r.observe(0), r.observe(1)];
        const next = await createPveHeadlessFixture(map, nativeIdentity);
        try {
          next.replay.restore(checkpoint);
          for (const seat of [0, 1]) assertRecoveredWorkerObservation(next.replay.observe(seat), before[seat]);
        } catch (error) { await next.dispose(); throw error; }
        await fixture.dispose(); fixture = next; r = next.replay;
        policies = seeds.map(seed => createDeterministicPolicy(seed, policyIdentity));
        twins = seeds.map(seed => createDeterministicPolicy(seed, policyIdentity));
        stages.restart = r.observe(team).tick;
      }
      if (i % 30 === 0) for (const seat of [0, 1]) {
        const observation = view(seat), commands = policies[seat].next(observation);
        assert.deepEqual(commands, twins[seat].next(structuredClone(observation)));
        for (const command of commands) {
          if (command.type === 'attack') {
            assert.ok(observation.units.visibleEnemies.some(unit => unit.hp > 0
              && unit.id === command.targetId && unit.generation === command.targetGeneration),
            'unit attacks require current sight and the disclosed generation');
          }
          if (command.type === 'attackBuilding') assert.ok(observation.buildings.visibleEnemies
            .some(building => building.hp > 0 && building.id === command.buildingId));
          const notices = await r.order(seat, command); r.drain();
          assert.ok(!notices.some(notice => /REJECTED|FAILED|UNREACHABLE/.test(notice.message || '')),
            JSON.stringify({ command, notices }));
          trace.push({ tick: observation.tick, team: seat, command, notices });
          if (seat === team && command.type === 'attack' && command.targetId === defenderId) stages.attack ??= observation.tick;
          if (seat === team && stages.defenderDeath && command.type === 'attackBuilding'
            && command.buildingId === townCenterId) stages.resume ??= observation.tick;
        }
      }
      r.step();
      // Checkpoint capture refreshes vision. Inspect health only at the native
      // three-tick publication boundary, never between publication ticks.
      if ((i + 1) % 3 === 0 && stages.defenderDeath === undefined) {
        if (r.checkpoint().state.units.find(unit => unit.id === defenderId).hp <= 0) stages.defenderDeath = loss.state.tickNumber + i + 1;
        else stages.defenderLastAlive = loss.state.tickNumber + i + 1;
      }
    }
    const final = r.checkpoint();
    assert.equal(stages.attack, loss.state.tickNumber, 'normal policy addresses the already disclosed immediate defender');
    assert.ok(stages.defenderDeath < loss.state.tickNumber + 150, 'the native defender dies within five seconds');
    assert.ok(stages.resume > stages.defenderDeath, 'assault resumes on the currently disclosed producer after defender death');
    for (const id of frontlineIds) assert.ok(final.state.units.find(unit => unit.id === id).hp > 0,
      `frontline unit ${id} survives the sixty-second assault`);
    assert.ok(final.state.homeTownCenters[enemy].hp < initialHp - 400, 'survivors inflict actual native structure damage');
    assert.equal(final.state.matchWinner, -1, 'this bounded post-deadline fixture makes no completion claim');
    return { nativeIdentity, team, cold, stages, initialTownCenterHp: initialHp,
      finalTownCenterHp: final.state.homeTownCenters[enemy].hp, trace, final };
  } finally { await fixture.dispose(); }
}
