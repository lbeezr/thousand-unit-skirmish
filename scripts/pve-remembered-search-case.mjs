import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createSkirmishTargetPolicy } from '../src/simulation/ai/policies/skirmish-targets.mjs';
import { toOpponentObservation } from '../src/pve-opponent.mjs';
import { createPveHeadlessFixture, assertRecoveredWorkerObservation } from './pve-headless-fixture.mjs';
import { economyRulesetRevision } from '../src/economy-profile.mjs';
import { migrateFoodToolsCheckpoint, PRE_FOOD_TOOLS_RULESETS } from '../src/server/worker-food-tools.mjs';
import { migrateVoluntaryEndingCheckpoint } from '../src/server/voluntary-endings.mjs';

// Retained normal Medium checkpoints use the production startup migration on a
// clone. Seeds exercise remembered-to-unknown candidate order without edited fog/casualties.
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
    const initial = data.checkpoint;
    assert.equal(initial.rulesetRevision, PRE_FOOD_TOOLS_RULESETS[initial.economyProfileId]);
    assert.throws(() => r.restore(initial), /unsupported schema version/,
      'strict restore rejects the historical schema before startup migration');
    const currentSchema = structuredClone(initial);
    assert.equal(migrateVoluntaryEndingCheckpoint(currentSchema), true);
    assert.deepEqual(currentSchema, { ...initial, schemaVersion: 30,
      state: { ...initial.state, voluntaryEndings: { version: 0, generation: 1, revision: 0, result: null } } },
    'production schema migration preserves all captured state and adds only legacy voluntary state');
    assert.throws(() => r.restore(currentSchema), /economy profile or gameplay ruleset revision mismatch/,
      'strict restore still rejects the historical content pin before startup migration');
    const migrated = migrateFoodToolsCheckpoint(structuredClone(currentSchema));
    const expected = structuredClone(currentSchema);
    expected.rulesetRevision = economyRulesetRevision(initial.economyProfileId);
    expected.state.teamUpgrades = initial.state.teamUpgrades.map(upgrades => ({ ...upgrades, foodTools: false }));
    assert.deepEqual(migrated, expected, 'production migration changes only the content pin and unpurchased Food Tools flags');
    r.restore(migrated);
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
