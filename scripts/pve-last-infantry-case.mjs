import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { createPveHeadlessFixture, assertRecoveredWorkerObservation } from './pve-headless-fixture.mjs';
import { createDeterministicPolicy, toOpponentObservation } from '../src/pve-opponent.mjs';

const policyIdentity = { matchModeId: 'skirmish', matchModeVersion: 1 };
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

// The real unchanged Tiny terminal packets supply this loss. Verify both byte
// layers and restore the entire native checkpoint without editing authority.
export async function loadLastInfantryLoss(mode) {
  const provenance = JSON.parse(await readFile(new URL('fixtures/pve-last-infantry/provenance.json', import.meta.url)));
  const descriptor = provenance.checkpoints.find(row => row.mode === mode);
  assert.ok(descriptor);
  const compressed = await readFile(new URL(`fixtures/pve-last-infantry/${descriptor.filename}`, import.meta.url));
  assert.equal(digest(compressed), descriptor.compressedSha256);
  const bytes = gunzipSync(compressed);
  assert.equal(digest(bytes), descriptor.checkpointSha256);
  const loss = JSON.parse(bytes);
  assert.equal(loss.state.tickNumber, provenance.terminalTick);
  assert.equal(loss.matchModeId, mode);
  assert.equal(loss.state.units.filter(u => u.team === provenance.team && u.hp > 0).length, 0);
  return { map: loss.mapDefinition, nativeIdentity: descriptor.nativeIdentity, team: provenance.team, loss };
}

export async function replayLastInfantryRecovery(input) {
  const { map, nativeIdentity, team, loss } = input;
  let fixture = await createPveHeadlessFixture(map, nativeIdentity), r = fixture.replay;
  const view = () => toOpponentObservation(r.observe(team), team, map);
  const trace = [], stages = {}, seed = 20260925;
  try {
    r.restore(loss);
    const initialView = view(), hidden = structuredClone(r.observe(team)), enemy = 1 - team;
    hidden.food[enemy] = 100000; hidden.wood[enemy] = 100000;
    hidden.units.push([10000, enemy, 0, 0, 100, 'worker', 0, '', 1]);
    assert.deepEqual(toOpponentObservation(hidden, team, map), initialView,
      'hidden banks and an undisclosed unit cannot change this recovery observation');
    assert.equal(initialView.buildings.friendly.length, 1);
    assert.equal(initialView.buildings.friendly[0].productionOptions.find(option => option.kind === 'infantry').available, true);
    let policy = createDeterministicPolicy(seed, policyIdentity), twin = createDeterministicPolicy(seed, policyIdentity);
    for (let i = 0; i <= 900; i++) {
      if (i % 30 === 0) {
        const observation = view(), commands = policy.next(observation);
        assert.deepEqual(commands, twin.next(structuredClone(observation)));
        for (const command of commands) {
          const before = r.observe(team), notices = await r.order(team, command); r.drain();
          assert.ok(!notices.some(n => /REJECTED|FAILED|UNREACHABLE/.test(n.message || '')), JSON.stringify({ command, notices }));
          trace.push({ tick: before.tick, command, notices });
          if (command.type === 'train') {
            assert.equal(before.food[team] - r.observe(team).food[team], 50, 'the last Infantry pays its full native price');
            assert.equal(stages.purchase, undefined, 'one paid replacement only'); stages.purchase = before.tick;
            const paid = r.checkpoint(), beforeRestore = [r.observe(0), r.observe(1)];
            const next = await createPveHeadlessFixture(map, nativeIdentity);
            try {
              next.replay.restore(paid);
              for (const seat of [0, 1]) assertRecoveredWorkerObservation(next.replay.observe(seat), beforeRestore[seat]);
            } catch (error) { await next.dispose(); throw error; }
            await fixture.dispose(); fixture = next; r = next.replay;
            policy = createDeterministicPolicy(seed, policyIdentity); twin = createDeterministicPolicy(seed, policyIdentity);
            stages.restart = r.observe(team).tick;
          }
        }
      }
      if (view().units.friendly.some(u => u.kind === 'infantry' && u.hp > 0)) stages.spawn ??= r.observe(team).tick;
      if (i < 900) r.step();
    }
    const final = r.checkpoint();
    assert.equal(stages.purchase - loss.state.tickNumber, 300, 'normal ten-second production opening remains');
    assert.equal(stages.restart, stages.purchase);
    assert.equal(stages.spawn - stages.purchase, 361, 'the native paid twelve-second queue survives cold restore');
    assert.equal(final.state.teamFood[team], loss.state.teamFood[team] - 50);
    assert.equal(final.state.teamWood[team], loss.state.teamWood[team], 'recovery spends no wood or resource grants');
    assert.equal(final.state.units.filter(u => u.team === team && u.hp > 0).length, 1);
    return { team, nativeIdentity, stages, trace, final };
  } finally { await fixture.dispose(); }
}
