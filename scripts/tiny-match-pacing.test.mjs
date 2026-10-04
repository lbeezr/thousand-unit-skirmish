import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyPacingResult, measureTinyMatch } from './tiny-match-pacing.mjs';

test('an unresolved bound is never a victory or draw; actual native results retain their reason', () => {
  assert.deepEqual(classifyPacingResult({ tickNumber: 108000, matchWinner: -1, matchWinnerReason: null }, 3600),
    { status: 'bounded-unresolved', winner: -1, reason: null, seconds: 3600, limitSeconds: 3600 });
  assert.deepEqual(classifyPacingResult({ tickNumber: 18000, matchWinner: 2, matchWinnerReason: 'elimination' }, 3600),
    { status: 'finished', winner: 2, reason: 'elimination', seconds: 600, limitSeconds: 3600 });
});

test('canonical paid Tiny opening records actual purchases/recruits and repeats all authority', async () => {
  const first = await measureTinyMatch([20260925, 0], { limitSeconds: 225 });
  const repeat = await measureTinyMatch([20260925, 0], { limitSeconds: 225, initial: first.initial });
  assert.deepEqual(repeat, first);
  assert.equal(first.result.terminal.status, 'bounded-unresolved');
  assert.equal(first.result.terminal.seconds, 225);
  assert.deepEqual(first.result.mode, { matchModeId: 'skirmish', matchModeVersion: 1 });
  assert.equal(first.result.rejectedOrders.length, 0);
  for (const seat of first.result.seats) {
    assert.ok(seat.commandDebits.wood >= 175, 'real Barracks purchase');
    assert.ok(seat.commandDebits.food >= 50, 'real recruit purchase');
    assert.ok(seat.firstPaidRecruitTick > seat.firstBarracksCompleteTick);
    assert.equal(seat.firstExpansionCompleteTick, null, 'home center is not a paid expansion');
    assert.ok(seat.firstNativeAttackObservedTick <= 225 * 30, 'durable attack evidence survives expired three-tick peer receipts');
  }
  assert.deepEqual(first.initial.state.teamFood, [150, 150]);
  assert.deepEqual(first.initial.state.teamWood, [250, 250]);
});

test('measurements cannot silently extend the existing completion ceiling or alter seed identities', async () => {
  await assert.rejects(measureTinyMatch([20260925, 0], { limitSeconds: 3601 }));
  await assert.rejects(measureTinyMatch([-1, 0], { limitSeconds: 45 }));
});
