import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createSkirmishTargetPolicy } from '../src/pve-skirmish-targets.mjs';
import { toOpponentObservation } from '../src/pve-opponent.mjs';
import { createPveHeadlessFixture, assertRecoveredWorkerObservation } from './pve-headless-fixture.mjs';

/** Actual unedited Medium routes; isolated seeds select their original unknown goals. */
export async function replayProgressSearch(name, { factory = createSkirmishTargetPolicy, cold = false } = {}) {
  const data = JSON.parse(gunzipSync(await readFile(new URL(`fixtures/pve-progress-search/${name}.json.gz`, import.meta.url))));
  const map = JSON.parse(await readFile(new URL('../maps/veyrholds-riven-escarpment.json', import.meta.url)));
  const identity = { matchModeId: 'skirmish', matchModeVersion: 1 }, seed = name === 'progressing' ? 9 : 677;
  const ids = new Set(data.command.ids), team = data.team, trace = [], stages = {};
  let fixture = await createPveHeadlessFixture(map, identity), r = fixture.replay, policy = factory(seed);
  const view = () => toOpponentObservation(r.observe(team), team, map);
  const mask = o => Buffer.from(o.visibility.data, 'base64');
  const cell = Math.floor(data.command.z + map.height / 2) * map.width + Math.floor(data.command.x + map.width / 2);
  const memory = (bytes, i) => bytes[i >> 2] >> ((i & 3) * 2) & 3;
  let initialMask, disclosed = null, firstChanged = null;
  try {
    r.restore(data.checkpoint);
    assert.equal(r.observe(team).tick, data.tick);
    initialMask = mask(view());
    assert.equal(memory(initialMask, cell), 0);
    for (let step = 0; step <= 3600; step++) {
      if (step % 30 === 0) {
        if (cold && step === 1830) {
          const checkpoint = r.checkpoint(), before = [r.observe(0), r.observe(1)];
          const recovered = await createPveHeadlessFixture(map, identity);
          try {
            recovered.replay.restore(checkpoint);
            for (const seat of [0, 1]) assertRecoveredWorkerObservation(recovered.replay.observe(seat), before[seat]);
          } catch (error) { await recovered.dispose(); throw error; }
          await fixture.dispose(); fixture = recovered; r = fixture.replay;
          assert.equal(r.observe(team).tick, data.tick + step);
          stages.restart = data.tick + step;
          policy = factory(seed);
        }
        const o = view();
        if (memory(mask(o), cell) === 2) disclosed ??= o.tick;
        if (step === 3600) break;
        for (const command of policy.next(o, o.units.friendly.filter(u => ids.has(u.id)))) {
          if (step === 0) assert.deepEqual(command, data.command, 'fresh target seed selects the real original order');
          if (command.x !== data.command.x || command.z !== data.command.z) firstChanged ??= o.tick;
          const notices = await r.order(team, command); r.drain();
          assert.ok(!notices.some(n => /REJECTED|FAILED|UNREACHABLE/.test(n.message || '')), JSON.stringify({ command, notices }));
          trace.push({ tick: o.tick, command, notices });
        }
      }
      r.step();
    }
    const finalView = view(), finalMask = mask(finalView);
    let newCells = 0, newCellsNearGoal = 0;
    for (let i = 0; i < map.width * map.height; i++) if (memory(initialMask, i) === 0 && memory(finalMask, i) !== 0) {
      newCells++;
      if (Math.abs(i % map.width - cell % map.width) <= 8
        && Math.abs(Math.floor(i / map.width) - Math.floor(cell / map.width)) <= 8) newCellsNearGoal++;
    }
    return { name, source: data.source, fullGameSeeds: data.fullGameSeeds, seed, team, cold,
      initialTick: data.tick, goal: { x: data.command.x, z: data.command.z }, disclosed, firstChanged,
      stages, newCells, newCellsNearGoal, trace, final: r.checkpoint() };
  } finally { await fixture.dispose(); }
}
