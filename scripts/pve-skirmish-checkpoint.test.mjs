import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createPveHeadlessFixture, assertRecoveredWorkerObservation } from './pve-headless-fixture.mjs';
import { createDeterministicPolicy, toOpponentObservation } from '../src/pve-opponent.mjs';

const identity = { matchModeId: 'skirmish', matchModeVersion: 1 };
for (const id of ['bellweather-millrace', 'underbough-rootways']) {
  test(`${id}: canonical Skirmish checkpoint restores both-seat policy and bonus rules`, async () => {
    const bytes = await readFile(new URL(`../maps/${id}.json`, import.meta.url));
    const map = JSON.parse(bytes), fixture = await createPveHeadlessFixture(map, identity), r = fixture.replay;
    try {
      const initial = r.checkpoint();
      assert.equal(initial.matchModeId, 'skirmish');
      assert.equal(initial.matchModeVersion, 1);
      assert.deepEqual(initial.mapDefinition.triggers, map.triggers, 'checkpoint stores canonical victory flags');
      const policies = [0, 1].map(team => createDeterministicPolicy(team ? 0 : 20260925, identity));
      for (let tick = 0; tick < 300; tick++) {
        if (tick % 30 === 0) for (const team of [0, 1]) {
          for (const command of policies[team].next(toOpponentObservation(r.observe(team), team, map))) {
            const notices = await r.order(team, command); r.drain();
            assert.ok(!notices.some(n => /REJECTED|FAILED|UNREACHABLE/.test(n.message || '')));
          }
        }
        r.step();
      }
      r.drain(); const before = [r.observe(0), r.observe(1)], checkpoint = r.checkpoint();
      r.restore(checkpoint);
      for (const team of [0, 1]) {
        const restored = r.observe(team);
        assertRecoveredWorkerObservation(restored, before[team]);
        assert.equal(restored.matchModeId, 'skirmish');
        assert.ok(restored.objectives.every(o => !o.victory), 'effective posts remain bonuses after recovery');
        const policy = createDeterministicPolicy(team ? 0 : 20260925, restored);
        const repeat = createDeterministicPolicy(team ? 0 : 20260925, restored);
        assert.deepEqual(policy.next(toOpponentObservation(restored, team, map)),
          repeat.next(toOpponentObservation(restored, team, map)));
      }
      assert.equal(r.checkpoint().mapHash, initial.mapHash);
      assert.deepEqual(await readFile(new URL(`../maps/${id}.json`, import.meta.url)), bytes);
    } finally { await fixture.dispose(); }
  });
}
