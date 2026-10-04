import assert from 'node:assert/strict';
import { test } from 'node:test';
import { UNIT_DEFINITIONS, TECHNOLOGY_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { cueForNotice, OrderAudioGate } from '../src/audio-policy.mjs';

test('all registered unit queue acknowledgements reuse the queue cue', () => {
  for (const unit of Object.values(UNIT_DEFINITIONS)) {
    const message = `${unit.label.toUpperCase()} QUEUED · 1/5`;
    assert.equal(cueForNotice(message, { localTeam: 0 }), 'queue', unit.id);
    assert.equal(cueForNotice(message, { localTeam: 1 }), 'queue', unit.id);
  }
  assert.equal(cueForNotice('WAYPOINT QUEUED · 12 UNITS', { localTeam: 0 }), null);
  assert.equal(cueForNotice('DRAGON QUEUED · 1/5', { localTeam: 0 }), null);
  assert.equal(cueForNotice('PLANNING SPEARMAN QUEUED · 1/5', { localTeam: 0 }), null);
});

test('every registered technology completes with local research feedback, never the production cue', () => {
  for (const technology of Object.values(TECHNOLOGY_DEFINITIONS)) {
    for (const team of [0, 1]) {
      const message = `${team === 0 ? 'AZURE' : 'EMBER'} ${technology.label.toUpperCase()} COMPLETE · UPGRADE ACTIVE`;
      assert.equal(cueForNotice(message, { localTeam: team }), 'research-complete', technology.id);
      assert.equal(cueForNotice(message, { localTeam: 1 - team }), null, 'opponent research stays silent');
      assert.equal(cueForNotice(message, { localTeam: null }), null, 'spectators do not hear local research');
    }
  }
});

test('failures and planning do not become queue or research success; generic completion stays generic', () => {
  assert.equal(cueForNotice('SPEARMAN QUEUED · TRAINING FAILED', { localTeam: 0 }), 'reject');
  assert.equal(cueForNotice('AZURE MILITARY TIER II COMPLETE · CANCELLED', { localTeam: 0 }), 'reject');
  assert.equal(cueForNotice('PLANNING MOUNTED FORGING COMPLETE · 1', { localTeam: 0 }), null);
  assert.equal(cueForNotice('AZURE WORKSHOP COMPLETE · 1', { localTeam: 0 }), 'complete');
  assert.equal(cueForNotice('AZURE CUSTOM REWARD COMPLETE · 1', { localTeam: 0 }), 'complete');
  assert.equal(cueForNotice('AZURE RIDER READY', { localTeam: 0 }), 'complete', 'birth audio still comes from lifecycle rows');
});

test('a wall line acknowledges one applied local order, never planning, rejection or each segment', () => {
  const gate = new OrderAudioGate();
  const event = { cue: 'build', kind: 'worker' };
  gate.sent(1, event);
  assert.equal(gate.observe(1, 'PLANNING WALL BUILD ORDER · 8 WORKERS'), null);
  assert.equal(gate.observe(2, 'WALL BUILD ORDER · 8 WORKERS'), null, 'unissued token is silent');
  assert.deepEqual(gate.observe(1, 'WALL BUILD ORDER · 8 WORKERS'), event);
  assert.equal(gate.observe(1, 'WALL BUILD ORDER · 8 WORKERS'), null, 'duplicate application is silent');
  assert.equal(gate.observe(1, 'WALL BUILD SEQUENCE · 1 WORKER'), null, 'later wall segments do not speak again');
  for (const notice of ['BUILD REJECTED · NEEDS WOOD', 'WALL BUILD ORDER FAILED · UNREACHABLE', 'WALL BUILD ORDER CANCELLED · MATCH OVER']) {
    gate.sent(3, event);
    assert.equal(gate.observe(3, notice), null);
    assert.equal(gate.observe(3, 'WALL BUILD ORDER · 8 WORKERS'), null, 'failed token cannot speak later');
  }
  gate.sent(4, event); gate.reset();
  assert.equal(gate.observe(4, 'WALL BUILD ORDER · 8 WORKERS'), null, 'reset invalidates pending order');
});
