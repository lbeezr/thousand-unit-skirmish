import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createPveHeadlessFixture, assertRecoveredWorkerObservation } from './pve-headless-fixture.mjs';
import { replayPaidSkirmishLoss } from './pve-skirmish-loss-case.mjs';

const authored = { matchModeId: 'authored', matchModeVersion: 1 };
const skirmish = { matchModeId: 'skirmish', matchModeVersion: 1 };
const id = 'veyrholds-terraced-vale';

test('native snapshot boundary advances at most two ticks and preserves both seat views across a fresh fixture', async () => {
  const map = JSON.parse(await readFile(new URL(`../maps/${id}.json`, import.meta.url)));
  const live = await createPveHeadlessFixture(map, authored);
  try {
    const r = live.replay;
    for (const phase of [0, 1, 2]) {
      if (phase) for (let step = 0; step < phase; step++) r.step();
      const tick = r.observe(0).tick, expected = (3 - tick % 3) % 3;
      assert.equal(r.advanceToStateBoundary(), expected);
      assert.equal(r.observe(0).tick, tick + expected);
      assert.equal(r.observe(0).tick % 3, 0);
      assert.equal(r.advanceToStateBoundary(), 0, 'aligned observation is not advanced again');
      const before = [r.observe(0), r.observe(1)], checkpoint = r.checkpoint();
      const recovered = await createPveHeadlessFixture(map, authored);
      try {
        recovered.replay.restore(checkpoint);
        for (const team of [0, 1]) assertRecoveredWorkerObservation(recovered.replay.observe(team), before[team]);
      } finally { await recovered.dispose(); }
    }
  } finally { await live.dispose(); }
});

for (const team of [0, 1]) {
  test(`Tiny seat ${team}: off-phase legal foundation recovery strictly replays in a fresh fixture without time advance`, async () => {
    const options = { nativeIdentity: skirmish, recoveryPhase: team + 1 };
    const first = await replayPaidSkirmishLoss(id, team, null, options);
    const second = await replayPaidSkirmishLoss(id, team, first.initial, options);
    assert.deepEqual(first, second, 'losses, fresh foundation restore, commands, notices and final checkpoint repeat');
    const { stages, conservation, final } = first.result;
    assert.equal(stages.restart, stages.foundationObservation);
    assert.equal(stages.restart, stages.replacementPurchase + 30);
    assert.notEqual(stages.restart % 3, 0, 'immediate recovery covers a tick between routine publications');
    assert.equal(stages.restart % 3, options.recoveryPhase, 'both phases between routine publications are exercised');
    assert.equal(final.matchModeId, 'skirmish', 'Tiny uses the admitted actual native identity');
    assert.equal(final.state.matchWinner, -1);
    assert.equal(final.state.units.filter(unit => unit.team === team && unit.kind === 'worker' && unit.hp > 0).length, 4);
    for (const resource of ['food', 'wood']) assert.ok(Math.abs(conservation[resource].residue) < 1e-5);
    console.log(JSON.stringify({ team, nativeIdentity: 'skirmish@1', policyIdentity: 'skirmish@1',
      stages, firstPressure: first.result.firstPressure, conservation }));
  });
}
