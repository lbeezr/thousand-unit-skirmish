import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createPveHeadlessFixture, assertRecoveredWorkerObservation } from './pve-headless-fixture.mjs';
import { createDeterministicPolicy, toOpponentObservation } from '../src/pve-opponent.mjs';
import { economyRulesetRevision } from '../src/economy-profile.mjs';
import { migrateFoodToolsCheckpoint, PRE_FOOD_TOOLS_RULESETS } from '../src/server/worker-food-tools.mjs';

const seeds = [20260925, 0], identity = { matchModeId: 'skirmish', matchModeVersion: 1 };
const bytes = mask => atob(mask.data);
const seen = (mask, cell) => (mask.charCodeAt(cell >> 2) >> ((cell & 3) * 2)) & 3;

/** Retained actual Medium endpoint, migrated as at server startup; one minute of full policy. */
export async function replayRememberedScoutRing({ cold = false, disableScout = false } = {}) {
  process.env.RTS_MAP = 'maps/open-field.json'; process.env.RTS_GAME_MODE = 'pvp'; process.env.RTS_PREGAME = '0';
  delete process.env.RTS_MATCH_STATE_PATH;
  const map = JSON.parse(await readFile(new URL('../maps/veyrholds-riven-escarpment.json', import.meta.url)));
  const initial = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/pve-recon-ring/medium-native.json.gz', import.meta.url))));
  const nativeIdentity = { matchModeId: initial.matchModeId, matchModeVersion: initial.matchModeVersion };
  assert.deepEqual(nativeIdentity, identity, 'retained native mode and configured policy are both Skirmish@1');
  let fixture = await createPveHeadlessFixture(map, nativeIdentity), r = fixture.replay;
  const view = team => toOpponentObservation(r.observe(team), team, map);
  const trace = [], samples = [];
  try {
    assert.equal(initial.rulesetRevision, PRE_FOOD_TOOLS_RULESETS[initial.economyProfileId]);
    assert.throws(() => r.restore(initial), /economy profile or gameplay ruleset revision mismatch/,
      'strict restore still rejects the historical content pin before startup migration');
    const migrated = migrateFoodToolsCheckpoint(structuredClone(initial));
    const expected = structuredClone(initial);
    expected.rulesetRevision = economyRulesetRevision(initial.economyProfileId);
    expected.state.teamUpgrades = initial.state.teamUpgrades.map(upgrades => ({ ...upgrades, foodTools: false }));
    assert.deepEqual(migrated, expected, 'production migration changes only the content pin and unpurchased Food Tools flags');
    r.restore(migrated); assert.equal(r.observe(0).tick, 108000);
    assert.equal(r.checkpoint().matchModeId, nativeIdentity.matchModeId);
    assert.equal(r.checkpoint().matchModeVersion, nativeIdentity.matchModeVersion);
    const starts = [view(0), view(1)], scouts = starts.map(v => v.units.friendly.find(u => u.kind === 'scout'));
    assert.ok(scouts.every(u => u && u.hp > 0));
    let policies = seeds.map(seed => createDeterministicPolicy(seed, identity));
    let shadows = seeds.map(seed => createDeterministicPolicy(seed, identity));
    let restartedAt = null;
    for (let step = 0; step <= 1800; step++) {
      if (step % 30 === 0) {
        if (cold && step === 900) {
          r.drain(); const before = [r.observe(0), r.observe(1)], checkpoint = r.checkpoint();
          const fresh = await createPveHeadlessFixture(map, nativeIdentity);
          fresh.replay.restore(checkpoint);
          for (const team of [0, 1]) assertRecoveredWorkerObservation(fresh.replay.observe(team), before[team], 'both complete peer views survive fresh fixture restore');
          await fixture.dispose(); fixture = fresh; r = fresh.replay;
          policies = seeds.map(seed => createDeterministicPolicy(seed, identity));
          shadows = seeds.map(seed => createDeterministicPolicy(seed, identity));
          restartedAt = r.observe(0).tick;
        }
        samples.push([r.observe(0), r.observe(1)]);
        if (step < 1800) for (const team of [0, 1]) {
          const observation = view(team), commands = policies[team].next(observation);
          assert.deepEqual(commands, shadows[team].next(structuredClone(observation)));
          for (const command of commands) {
            if (disableScout && command.type === 'move' && command.ids.includes(scouts[team].id)) {
              trace.push({ tick: observation.tick, team, suppressed: command }); continue;
            }
            const notices = await r.order(team, command); r.drain();
            assert.ok(!notices.some(n => /REJECTED|FAILED|UNREACHABLE/.test(n.message || '')), JSON.stringify(notices));
            trace.push({ tick: observation.tick, team, command, notices });
          }
        }
      }
      if (step < 1800) r.step();
    }
    const seats = [0, 1].map(team => {
      const end = view(team), scout = end.units.friendly.find(u => u.id === scouts[team].id && u.generation === scouts[team].generation);
      const oldFog = bytes(starts[team].visibility), newFog = bytes(end.visibility);
      let newCells = 0;
      for (let cell = 0; cell < map.width * map.height; cell++) if (seen(oldFog, cell) === 0 && seen(newFog, cell) !== 0) newCells++;
      return { team, initialScout: scouts[team], finalScout: scout,
        scoutDisplacement: scout ? Math.hypot(scout.x - scouts[team].x, scout.z - scouts[team].z) : null,
        newCells, scoutOrders: trace.filter(row => row.team === team && row.command?.ids?.includes(scouts[team].id)),
        resources: end.resources, positiveWood: end.resourceNodes.filter(n => n.type === 'wood' && n.stock > 0) };
    });
    return { cold, disableScout, coldStartFromRetainedEndpoint: true, restartedAt,
      startTick: initial.state.tickNumber, endTick: r.observe(0).tick,
      seats, trace, samples, final: r.checkpoint() };
  } finally { await fixture.dispose(); }
}
