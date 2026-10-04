import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createSkirmishTargetPolicy } from '../src/pve-skirmish-targets.mjs';
import { toOpponentObservation } from '../src/pve-opponent.mjs';
import { createPveHeadlessFixture, assertRecoveredWorkerObservation } from './pve-headless-fixture.mjs';

// Unedited checkpoints from the retained normal Medium game, not authored
// casualty or fog states. Seeds exercise remembered-to-unknown candidate order.
export async function replayRememberedSearch(team, factory = createSkirmishTargetPolicy) {
  const data = JSON.parse(gunzipSync(await readFile(new URL(`fixtures/pve-medium-search/seat-${team}.json.gz`, import.meta.url))));
  const map = JSON.parse(await readFile(new URL('../maps/veyrholds-riven-escarpment.json', import.meta.url)));
  const identity = { matchModeId: 'skirmish', matchModeVersion: 1 };
  let fixture = await createPveHeadlessFixture(map, identity), r = fixture.replay;
  const trace = [], stages = {};
  const view = () => toOpponentObservation(r.observe(team), team, map);
  const cohort = observation => observation.units.friendly.filter(unit => data.cohort.includes(unit.id));
  const memory = (observation, point) => {
    const bytes = Buffer.from(observation.visibility.data, 'base64');
    const cell = Math.floor(point.z + map.height / 2) * map.width + Math.floor(point.x + map.width / 2);
    return (bytes[cell >> 2] >> ((cell & 3) * 2)) & 3;
  };
  const order = async command => {
    const notices = await r.order(team, command); r.drain();
    assert.ok(!notices.some(notice => /REJECTED|FAILED|UNREACHABLE/.test(notice.message || '')), JSON.stringify({ command, notices }));
    trace.push({ tick: r.observe(team).tick, command, notices });
  };
  try {
    r.restore(data.checkpoint);
    assert.equal(r.observe(team).tick, data.checkpointTick);
    let policy = factory(data.seed);
    const opening = view(), first = policy.next(opening, cohort(opening))[0];
    assert.equal(first?.type, 'attackMove');
    const firstMemory = memory(opening, first);
    await order(first);
    let checkpoint = null;
    for (let i = 0; i < 1800; i++) {
      const observation = view();
      if (memory(observation, first) === 2) {
        stages.disclosed = observation.tick; checkpoint = r.checkpoint(); break;
      }
      r.step();
    }
    assert.ok(checkpoint, 'the native army actually discloses its search goal');
    const before = [r.observe(0), r.observe(1)];
    const recovered = await createPveHeadlessFixture(map, identity);
    try {
      recovered.replay.restore(checkpoint);
      for (const seat of [0, 1]) assertRecoveredWorkerObservation(recovered.replay.observe(seat), before[seat]);
    } catch (error) { await recovered.dispose(); throw error; }
    await fixture.dispose(); fixture = recovered; r = fixture.replay;
    stages.restart = r.observe(team).tick;
    assert.equal(stages.restart, stages.disclosed, 'cold recovery advances no tick');
    policy = factory(data.seed);
    const resumed = view(), next = policy.next(resumed, cohort(resumed))[0];
    assert.equal(next?.type, 'attackMove');
    const nextMemory = memory(resumed, next);
    await order(next);
    for (let i = 0; i < 30; i++) r.step();
    return { team, seed: data.seed, source: data.source, stages, first, firstMemory, next, nextMemory,
      trace, checkpoint, final: r.checkpoint() };
  } finally { await fixture.dispose(); }
}
