// Test-only accepted-tick trace. Authority, snapshots and checkpoint validation
// come from the existing fixed-tick fixture; no socket or live replay API.
import assert from 'node:assert/strict';

function freeze(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

export async function recordAcceptedCommand(replay, team, command, acceptedMessage) {
  const tick = replay.observe(team).tick;
  const packet = structuredClone(command);
  const notices = await replay.order(team, structuredClone(packet));
  replay.drain();
  assert.ok(notices.some(notice => notice.message === acceptedMessage),
    `command must receive its acceptance notice: ${acceptedMessage}`);
  assert.ok(!notices.some(notice => /REJECTED|FAILED|UNREACHABLE|CANCELLED/.test(notice.message ?? '')));
  assert.equal(replay.observe(team).tick, tick, 'acceptance does not advance a fixed tick');
  return freeze(structuredClone({ tick, team, command: packet, acceptedMessage, notices }));
}

export function sealCommandReplay(initialCheckpoint, commands, finalTick) {
  let previousTick = initialCheckpoint.state.tickNumber;
  assert.ok(Number.isSafeInteger(finalTick) && finalTick >= previousTick);
  for (const entry of commands) {
    assert.ok(Number.isSafeInteger(entry.tick) && entry.tick >= previousTick && entry.tick <= finalTick);
    assert.ok(entry.team === 0 || entry.team === 1);
    previousTick = entry.tick;
  }
  // Includes the seed, canonical map/hash, rules, original IDs/generations and
  // exact command order. Detach caller references before freezing the artifact.
  return freeze(structuredClone({ schemaVersion: 1, initialCheckpoint, commands, finalTick }));
}

export function captureReplayBoundary(replay, nextCommandIndex) {
  return structuredClone({ nextCommandIndex, checkpoint: replay.checkpoint(),
    views: [replay.observe(0), replay.observe(1)] });
}

export async function replayCommandTrace(replay, trace,
  { checkpoint = trace.initialCheckpoint, nextCommandIndex = 0 } = {}) {
  assert.equal(trace.schemaVersion, 1);
  assert.ok(Number.isSafeInteger(nextCommandIndex) && nextCommandIndex >= 0
    && nextCommandIndex <= trace.commands.length);
  for (const key of ['schemaVersion', 'rulesVersion', 'economyProfileId', 'rulesetRevision',
    'factionId', 'matchModeId', 'matchModeVersion', 'mapHash', 'matchId']) {
    assert.equal(checkpoint[key], trace.initialCheckpoint[key], `resume preserves ${key}`);
  }
  const startTick = checkpoint.state.tickNumber;
  assert.ok(startTick <= trace.finalTick);
  assert.ok(nextCommandIndex === 0 || trace.commands[nextCommandIndex - 1].tick <= startTick);
  assert.ok(nextCommandIndex === trace.commands.length || trace.commands[nextCommandIndex].tick >= startTick);
  replay.restore(structuredClone(checkpoint));
  const boundaries = [];
  for (let tick = startTick; tick <= trace.finalTick; tick++) {
    assert.equal(replay.observe(0).tick, tick);
    while (nextCommandIndex < trace.commands.length && trace.commands[nextCommandIndex].tick === tick) {
      const entry = trace.commands[nextCommandIndex];
      const actual = await recordAcceptedCommand(replay, entry.team, entry.command, entry.acceptedMessage);
      assert.deepEqual(actual, entry, `accepted command ${nextCommandIndex} replays exactly`);
      nextCommandIndex++;
    }
    boundaries.push(captureReplayBoundary(replay, nextCommandIndex));
    if (tick < trace.finalTick) replay.step();
  }
  assert.equal(nextCommandIndex, trace.commands.length);
  return boundaries;
}
