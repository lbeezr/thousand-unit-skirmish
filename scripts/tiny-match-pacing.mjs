// Read-only measurement over the canonical fixed-tick authority. This is a
// bounded policy mirror, not opponent qualification or human balance evidence.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPveHeadlessFixture, assertRecoveredWorkerObservation } from './pve-headless-fixture.mjs';
import { createDeterministicPolicy, toOpponentObservation } from '../src/pve-opponent.mjs';
import { PVE_PRODUCTION_LIMITS } from '../src/pve-production.mjs';
import { NORMAL_MATCH_MAP_ID, NORMAL_HUMAN_MATCH_MODE, assertMatchModeCompatibility } from '../src/match-modes.mjs';
import { UNIT_DEFINITIONS } from '../src/gameplay-definitions.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const hz = 30, ceilingSeconds = 3600, restoreSeconds = 600;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const key = unit => `${unit.id}:${unit.generation}`;
const seconds = tick => tick === null ? null : tick / hz;

export function classifyPacingResult(state, limitSeconds) {
  if (state.matchWinner === -1) return { status: 'bounded-unresolved', winner: -1, reason: null,
    seconds: state.tickNumber / hz, limitSeconds };
  return { status: 'finished', winner: state.matchWinner, reason: state.matchWinnerReason,
    seconds: state.tickNumber / hz, limitSeconds };
}

export async function measureTinyMatch(seeds, { limitSeconds = ceilingSeconds, initial = null } = {}) {
  assert.ok(Number.isInteger(limitSeconds) && limitSeconds > 0 && limitSeconds <= ceilingSeconds);
  assert.ok(Array.isArray(seeds) && seeds.length === 2 && seeds.every(seed => Number.isInteger(seed) && seed >= 0 && seed <= 0xffff_ffff));
  const mapBytes = await readFile(path.join(root, `maps/${NORMAL_MATCH_MAP_ID}.json`));
  const map = JSON.parse(mapBytes);
  assertMatchModeCompatibility(NORMAL_HUMAN_MATCH_MODE, map, { mode: 'pve' });
  const fixture = await createPveHeadlessFixture(map, NORMAL_HUMAN_MATCH_MODE), r = fixture.replay;
  const trace = [], samples = [], depletions = [], restores = [];
  const metrics = seeds.map((seed, team) => ({ team, seed, firstVisibleEnemyTick: null,
    firstAttackTick: null, firstDamageObservedTick: null, firstPaidRecruitTick: null,
    firstBarracksCompleteTick: null, firstDepotCompleteTick: null,
    firstExpansionCompleteTick: null, maxMilitary: 8, maxWorkers: 4,
    purchasedBuildings: [], belowInfantryFoodSeconds: 0, firstBelowInfantryFoodTick: null,
    commandDebits: { food: 0, wood: 0 }, commandCredits: { food: 0, wood: 0 } }));
  const depleted = new Set(), complete = new Set();
  try {
    if (initial) r.restore(initial); else initial = r.checkpoint();
    assert.equal(initial.state.tickNumber, 0, 'measure only a fresh opening');
    assert.deepEqual(initial.state.teamFood, [150, 150]); assert.deepEqual(initial.state.teamWood, [250, 250]);
    assert.equal(initial.state.units.filter(unit => unit.hp > 0).length, 24);
    const openingIds = new Set(initial.state.units.map(key));
    let policies = seeds.map(seed => createDeterministicPolicy(seed, NORMAL_HUMAN_MATCH_MODE));
    const view = team => toOpponentObservation(r.observe(team), team, map);
    // Observer checkpoints never enter a policy. Every decision receives only
    // its own native peer view, in the canonical Azure/Ember decision order.
    for (let step = 0; step <= limitSeconds * hz; step++) {
      if (step % hz === 0) {
        if (step === restoreSeconds * hz) {
          r.drain(); const before = [r.observe(0), r.observe(1)], saved = r.checkpoint();
          r.restore(saved);
          for (const team of [0, 1]) assertRecoveredWorkerObservation(r.observe(team), before[team]);
          policies = seeds.map(seed => createDeterministicPolicy(seed, NORMAL_HUMAN_MATCH_MODE));
          restores.push({ tick: step, sameAuthority: true, freshPolicies: true });
        }
        let state = r.checkpoint().state;
        for (const node of state.resourceNodes) if (node.stock <= 0 && !depleted.has(node.id)) {
          depleted.add(node.id); depletions.push({ tick: step, id: node.id, type: node.type });
        }
        for (const team of [0, 1]) {
          const observation = view(team), metric = metrics[team];
          const living = observation.units.friendly.filter(unit => unit.hp > 0);
          if (observation.units.visibleEnemies.length || observation.buildings.visibleEnemies.length) metric.firstVisibleEnemyTick ??= step;
          for (const unit of living) if (unit.lastAttack?.tick >= 0) {
            metric.firstAttackTick = Math.min(metric.firstAttackTick ?? Infinity, unit.lastAttack.tick);
          }
          if (living.some(unit => unit.hp < UNIT_DEFINITIONS[unit.kind].combat.maxHp)) metric.firstDamageObservedTick ??= step;
          if (living.some(unit => unit.kind !== 'worker' && !openingIds.has(key(unit)))) metric.firstPaidRecruitTick ??= step;
          metric.maxMilitary = Math.max(metric.maxMilitary, living.filter(unit => unit.kind !== 'worker').length);
          metric.maxWorkers = Math.max(metric.maxWorkers, living.filter(unit => unit.kind === 'worker').length);
          if (step < limitSeconds * hz && state.matchWinner === -1 && observation.resources.food < UNIT_DEFINITIONS.infantry.cost.food) {
            metric.belowInfantryFoodSeconds++;
            metric.firstBelowInfantryFoodTick ??= step;
          }
          for (const building of observation.buildings.friendly) if (building.complete && !complete.has(building.id)) {
            complete.add(building.id);
            if (building.type === 'barracks') metric.firstBarracksCompleteTick ??= step;
            if (['storehouse', 'mill'].includes(building.type)) metric.firstDepotCompleteTick ??= step;
            if (building.type === 'town-center' && !building.home) metric.firstExpansionCompleteTick ??= step;
          }
          if (step === limitSeconds * hz || state.matchWinner !== -1) continue;
          for (const command of policies[team].next(observation)) {
            const before = r.observe(team), notices = await r.order(team, command); r.drain();
            const after = r.observe(team);
            for (const resource of ['food', 'wood']) {
              const delta = before[resource][team] - after[resource][team];
              metric.commandDebits[resource] += Math.max(0, delta);
              metric.commandCredits[resource] += Math.max(0, -delta);
            }
            const rejected = notices.some(notice => /REJECTED|FAILED|UNREACHABLE/.test(notice.message || ''));
            for (const building of after.buildings) if (!rejected && !before.buildings.some(previous => previous.id === building.id)) {
              metric.purchasedBuildings.push({ tick: step, id: building.id, type: building.type, x: building.x, z: building.z });
            }
            trace.push({ tick: step, team, command, notices, rejected });
          }
        }
        state = r.checkpoint().state;
        if (step % 30 === 0 || step === limitSeconds * hz || state.matchWinner !== -1) samples.push({ tick: step,
          seats: metrics.map(metric => {
            const team = metric.team, alive = state.units.filter(unit => unit.team === team && unit.hp > 0);
            return { team, food: state.teamFood[team], wood: state.teamWood[team],
              workers: alive.filter(unit => unit.kind === 'worker').length,
              military: alive.filter(unit => unit.kind !== 'worker').length,
              cargo: ['food', 'wood'].map(type => ({ type, amount: alive.filter(unit => unit.cargoType === type).reduce((sum, unit) => sum + unit.cargo, 0) })),
              homeHp: state.homeTownCenters[team].hp,
              buildings: state.buildings.filter(building => building.team === team && building.hp > 0).map(building => ({ id: building.id, type: building.type, hp: building.hp, complete: building.complete, queue: building.productionQueue.length })) };
          }), nodes: state.resourceNodes.map(node => ({ id: node.id, type: node.type, stock: node.stock })) });
        if (state.matchWinner !== -1 || step === limitSeconds * hz) break;
      }
      r.step();
    }
    const final = r.checkpoint();
    const terminal = classifyPacingResult(final.state, limitSeconds);
    const seatSummary = metrics.map(metric => ({ ...metric,
      timesSeconds: Object.fromEntries(Object.entries(metric).filter(([name]) => name.endsWith('Tick')).map(([name, tick]) => [name.replace(/Tick$/, ''), seconds(tick)])) }));
    return { initial, result: { mapId: map.id, mapSha256: hash(mapBytes), terrainSeed: map.terrainSeed,
      mode: NORMAL_HUMAN_MATCH_MODE, seeds, decisionOrder: [0, 1], terminal,
      seats: seatSummary, depletions, restores, rejectedOrders: trace.filter(item => item.rejected),
      trace, samples, final } };
  } finally { await fixture.dispose(); }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const output = process.argv[2];
  assert.ok(output && process.argv.length === 3, 'Usage: node scripts/tiny-match-pacing.mjs OUTPUT_DIRECTORY');
  await mkdir(output, { recursive: true });
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const provenance = { revision, dirty: Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim()), node: process.version,
    scope: 'fixed-tick-paid-policy-mirror', limitSeconds: ceilingSeconds, restoreSeconds,
    sampleIntervalSeconds: 1, timelineIntervalSeconds: 1,
    opponent: { module: 'src/pve-opponent.mjs', productionLimits: PVE_PRODUCTION_LIMITS,
      qualification: 'not independently qualified; same implementation in both seats' },
    renderer: false, servedRelease: null, deployment: null };
  const summary = { schemaVersion: 1, provenance, runs: [] };
  for (const seeds of [[20260925, 0], [0, 20260925]]) {
    const first = await measureTinyMatch(seeds), repeat = await measureTinyMatch(seeds, { initial: first.initial });
    assert.deepEqual(repeat, first, 'complete commands, notices, samples and terminal authority must repeat exactly');
    const name = `seeds-${seeds.join('-')}.json`, bytes = JSON.stringify(first);
    await writeFile(path.join(output, name), bytes);
    const { terminal, seats, depletions, rejectedOrders, restores, mapId, mapSha256, terrainSeed, mode } = first.result;
    summary.runs.push({ file: name, sha256: hash(bytes), seeds, mapId, mapSha256, terrainSeed, mode,
      exactRepeat: true, terminal, seats, depletions, rejectedOrders: rejectedOrders.length, restores });
    await writeFile(path.join(output, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
    console.log(JSON.stringify(summary.runs.at(-1)));
  }
}
