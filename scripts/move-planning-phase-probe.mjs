// Source-qualified scheduling diagnosis. No production entrypoint or policy changes.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';
import { pathingBaselineMap } from './pathing-baseline-cases.mjs';

process.env.RTS_MAP = 'maps/open-field.json';
process.env.RTS_GAME_MODE = 'pvp'; process.env.RTS_PREGAME = '0';
process.env.RTS_TICK_DIAGNOSTICS = '1';
delete process.env.RTS_MATCH_STATE_PATH;
const rows = units => units.map(u => [u.id, u.x, u.z, u.orderRevision,
  u.moveGoalCell, u.pathIndex, u.path, u.movePlanningPending]);
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const records = [];
for (const schedule of ['before-first-tick', 'after-third-tick', 'one-turn-per-tick']) {
  for (let repeat = 0; repeat < 2; repeat++) {
    const fixture = await createPathingReplayFixture(pathingBaselineMap({ group: 16 }));
    const r = fixture.replay;
    try {
      const selected = r.units.filter(u => u.team === 0 && u.kind === 'infantry');
      const start = selected.map(u => [u.x, u.z]);
      const command = { type: 'move', ids: selected.map(u => u.id),
        unitGenerations: selected.map(u => u.generation), x: 16.5, z: .5, clientOrderToken: 1 };
      const acceptedAtTick = r.tick;
      const notices = r.order(0, command);
      assert.ok(notices.some(n => n.message.startsWith('PLANNING MOVE')));
      const accepted = rows(selected);
      const events = [];
      const observe = stage => events.push({ stage, tick: r.tick,
        committed: selected.filter(u => !u.movePlanningPending).length,
        moved: selected.filter((u, i) => u.x !== start[i][0] || u.z !== start[i][1]).length });
      observe('command-returned');
      if (schedule === 'before-first-tick') { r.drain(); observe('callbacks-drained'); }
      for (let tick = 1; tick <= 8; tick++) {
        r.step({ planningTurns: schedule === 'one-turn-per-tick' ? 1 : 0 });
        observe('tick-completed');
        if (schedule === 'after-third-tick' && tick === 3) {
          r.drain(); observe('callbacks-drained');
        }
      }
      assert.ok(selected.every(u => !u.movePlanningPending));
      records.push({ schedule, repeat, sourceSha256: fixture.sourceSha256,
        acceptedAtTick, acceptedStateHash: hash(accepted), command, events,
        firstMovedTick: events.find(e => e.moved > 0)?.tick,
        finalStateHash: hash(rows(selected)), planningSliceCount: r.planning.at(-1).planningSliceCount,
        operationCounts: { searches: r.planning.at(-1).searchCount,
          expandedCells: r.planning.at(-1).expandedCells } });
    } finally { await fixture.dispose(); }
  }
}
for (const schedule of ['before-first-tick', 'after-third-tick', 'one-turn-per-tick']) {
  const pair = records.filter(r => r.schedule === schedule);
  assert.equal(pair[0].acceptedStateHash, pair[1].acceptedStateHash);
  assert.equal(pair[0].finalStateHash, pair[1].finalStateHash);
  assert.deepEqual(pair[0].events, pair[1].events);
}
assert.ok(records.every(r => r.acceptedAtTick === 0
  && r.acceptedStateHash === records[0].acceptedStateHash));
assert.equal(records[0].firstMovedTick, 1);
assert.equal(records[2].firstMovedTick, 4);
assert.notEqual(records[0].finalStateHash, records[2].finalStateHash);
assert.equal(records[0].events.find(e => e.stage === 'callbacks-drained').tick, 0);
const fixture = await createPathingReplayFixture(pathingBaselineMap({ group: 16 }));
let cancellation;
try {
  const r = fixture.replay, selected = r.units.filter(u => u.team === 0 && u.kind === 'infantry');
  const common = { ids: selected.map(u => u.id), unitGenerations: selected.map(u => u.generation) };
  const notices = r.order(0, { type: 'move', ...common, x: 16.5, z: .5, clientOrderToken: 1 });
  r.order(0, { type: 'stop', ...common, clientOrderToken: 2 });
  const stopped = hash(rows(selected));
  r.drain();
  assert.equal(hash(rows(selected)), stopped);
  assert.ok(notices.some(n => n.message === 'ORDER SUPERSEDED · 0 UNITS'));
  cancellation = { acceptedAtTick: 0, callbacksAppliedAtTick: r.tick,
    units: selected.length, stoppedStatePreserved: true, notice: notices.at(-1).message };
} finally { await fixture.dispose(); }
console.log(JSON.stringify({ schemaVersion: 1, scope: 'planning-callback-phase-diagnosis',
  inspectedHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  sourceSha256: records[0].sourceSha256, node: process.version,
  acceptedStateFields: ['id', 'x', 'z', 'orderRevision', 'moveGoalCell',
    'pathIndex', 'path', 'movePlanningPending'],
  generationNormalization: 'fresh fixtures randomize generation tokens; each command uses current tokens, omitted from the compared movement-state hash',
  records, cancellation,
  limits: ['actual server function bodies; test adapter controls callback opportunities',
    'command entry uses existing assignment functions, not the socket or PvE intake',
    'one-turn-per-tick is a scheduling experiment, not an implemented runtime policy',
    'no renderer, deployment health, device capacity or latency recommendation'] }, null, 2));
