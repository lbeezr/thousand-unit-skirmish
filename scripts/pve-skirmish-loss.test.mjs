import assert from 'node:assert/strict';
import test from 'node:test';
import { replayPaidSkirmishLoss } from './pve-skirmish-loss-case.mjs';

for (const id of ['bellweather-millrace', 'underbough-rootways']) for (const team of [0, 1]) {
  test(`${id}, seat ${team}: real army/producer loss, paid rebuild, cold restart and five-unit advance`, async () => {
    const first = await replayPaidSkirmishLoss(id, team);
    const second = await replayPaidSkirmishLoss(id, team, first.initial);
    assert.deepEqual(first, second, 'complete casualty/recovery commands, notices and final checkpoint replay exactly');
    const r = first.result, s = r.stages;
    console.log(JSON.stringify({ id, team, wipeoutSeconds: s.wipeout / 30,
      producerLossSeconds: s.producerLost / 30, paidRebuildSeconds: (s.replacementPurchase - s.recoveryStart) / 30,
      completeSeconds: (s.replacementComplete - s.recoveryStart) / 30,
      groupAdvanceSeconds: (r.firstPressure - s.recoveryStart) / 30,
      spentFood: r.spentFood, spentWood: r.spentWood }));
  });
}
