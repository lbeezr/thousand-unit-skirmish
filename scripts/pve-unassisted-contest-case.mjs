import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createPveHeadlessFixture } from './pve-headless-fixture.mjs';
import { createDeterministicPolicy, toOpponentObservation } from '../src/pve-opponent.mjs';
import { assertMatchModeCompatibility } from '../src/match-modes.mjs';
import { UNIT_DEFINITIONS } from '../src/gameplay-definitions.mjs';

const qualifiedSource = '41e30deb3aac6b4533231514943a6b65ad3068ab';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const key = unit => `${unit.id}:${unit.generation}`;
const identity = { matchModeId: 'skirmish', matchModeVersion: 1 };
const root = fileURLToPath(new URL('..', import.meta.url));

// Opt-in evidence runner. No setup commands, state edits or midgame resets.
export async function runUnassistedContest(contractFile, opening = null) {
  const contractBytes = await readFile(contractFile), contract = JSON.parse(contractBytes);
  const directory = path.dirname(contractFile);
  assert.equal(contract.opponentSource, qualifiedSource);
  assert.deepEqual(contract.seeds, [20260925, 0]);
  assert.equal(contract.seconds, 3600);
  assert.deepEqual(contract.commandSeatOrder, [0, 1]);
  const opponentRoot = path.resolve(directory, 'source/opponent');
  const receipts = await Promise.all(['run', 'opponent'].map(label =>
    readFile(path.join(directory, `${label}-source-receipt.json`), 'utf8').then(JSON.parse)));
  assert.equal(receipts[0].source, contract.runSource);
  assert.equal(receipts[1].source, qualifiedSource);
  for (const [index, sourceRoot] of [root, opponentRoot].entries()) {
    for (const entry of receipts[index].files.filter(entry => entry.path.startsWith('src/') && entry.path.endsWith('.mjs')
      || ['server.mjs', 'scripts/pve-headless-fixture.mjs', 'scripts/pve-unassisted-contest-case.mjs'].includes(entry.path))) {
      assert.equal(digest(await readFile(path.join(sourceRoot, entry.path))), entry.sha256, `source drift: ${entry.path}`);
    }
  }
  assert.deepEqual(await readFile(path.join(opponentRoot, 'src/gameplay-definitions.mjs')),
    await readFile(path.join(root, 'src/gameplay-definitions.mjs')), 'qualified opponent retains the same public prices/stats');
  const mapBytes = await readFile(new URL('../maps/veyrholds-terraced-vale.json', import.meta.url)), map = JSON.parse(mapBytes);
  assert.equal(digest(mapBytes), contract.mapSHA256);
  assert.deepEqual(mapBytes, await readFile(path.join(opponentRoot, 'maps/veyrholds-terraced-vale.json')));
  assertMatchModeCompatibility(identity, map, { mode: 'pve' });
  const opponent = await import(pathToFileURL(path.join(opponentRoot, 'src/pve-opponent.mjs')).href);
  const factories = [createDeterministicPolicy, opponent.createDeterministicPolicy];
  const project = [toOpponentObservation, opponent.toOpponentObservation];
  const policies = factories.map((factory, team) => factory(contract.seeds[team], identity));
  const shadows = factories.map((factory, team) => factory(contract.seeds[team], identity));
  const fixture = await createPveHeadlessFixture(map, identity), r = fixture.replay;
  const trace = [], samples = [], losses = [], deposits = [], purchases = [], spawns = [];
  const jobs = new Map(), replacements = new Map();
  const metrics = [0, 1].map(() => ({ firstEnemySight: null, firstIncomingDamage: null,
    firstDeposit: null, producerPurchase: null, producerComplete: null,
    spentFood: 0, spentWood: 0, commands: 0, rejected: 0, recovery: null }));
  const observation = team => project[team](r.observe(team), team, map);
  let initial, initialViews, startTick, failure = null;
  try {
    if (opening) r.restore(opening);
    initial = r.checkpoint(); initialViews = [r.observe(0), r.observe(1)]; startTick = initial.state.tickNumber;
    assert.deepEqual(initial.state.teamFood, [150, 150]);
    assert.deepEqual(initial.state.teamWood, [250, 250]);
    assert.equal(initial.state.units.filter(u => u.hp > 0).length, 24);
    for (const team of [0, 1]) {
      const seen = observation(team);
      assert.equal(seen.units.visibleEnemies.length, 0);
      assert.equal(seen.buildings.visibleEnemies.length, 0);
      const changed = structuredClone(initialViews[team]);
      changed.food[1-team] = 1e9; changed.wood[1-team] = 1e9;
      changed.units.push([999999, 1-team, 0, 0, 100, 'worker', 0, '', 1]);
      assert.deepEqual(project[team](changed, team, map), seen, 'unseen opponent banks/entities stay outside decisions');
    }
    let before = initial.state;
    for (let step = 0; step < 108000 && before.matchWinner === -1; step++) {
      if (step % 30 === 0) {
        for (const team of [0, 1]) {
          const seen = observation(team), metric = metrics[team];
          if (seen.units.visibleEnemies.length || seen.buildings.visibleEnemies.length) metric.firstEnemySight ??= seen.tick;
          if (seen.buildings.friendly.some(b => b.type === 'barracks' && b.complete)) metric.producerComplete ??= seen.tick;
          const commands = policies[team].next(seen);
          assert.deepEqual(commands, shadows[team].next(structuredClone(seen)), 'same-source shadow decisions match');
          for (const command of commands) {
            if (command.type === 'attack') assert.ok(seen.units.visibleEnemies.some(u => u.id === command.targetId
              && u.hp > 0 && (command.targetGeneration === undefined || u.generation === command.targetGeneration)));
            if (command.type === 'attackBuilding') assert.ok(seen.buildings.visibleEnemies.some(b => b.id === command.buildingId && b.hp > 0));
            const playerView = r.observe(team), nativeBefore = command.type === 'trainUnit' && command.kind === 'worker' ? r.checkpoint().state : null;
            const notices = await r.order(team, command); r.drain();
            const after = r.observe(team), cost = { food: playerView.food[team]-after.food[team], wood: playerView.wood[team]-after.wood[team] };
            const accepted = !notices.some(n => /REJECTED|FAILED|UNREACHABLE|NO REACHABLE|BLOCKED/.test(n.message || ''));
            trace.push({ tick: seen.tick, team, command, notices, cost, accepted, playerView });
            metric.commands++; metric.rejected += Number(!accepted);
            metric.spentFood += cost.food; metric.spentWood += cost.wood;
            if (!accepted) continue;
            if (command.type === 'build' && command.buildingType === 'barracks') metric.producerPurchase ??= seen.tick;
            if (command.type === 'trainUnit') assert.deepEqual(cost, UNIT_DEFINITIONS[command.kind].cost);
            if (nativeBefore) {
              const nativeAfter = r.checkpoint().state;
              const home = nativeAfter.workerProduction[team].queue === nativeBefore.workerProduction[team].queue+1;
              const building = nativeAfter.buildings.find(b => b.id === command.buildingId);
              assert.ok(home || building?.productionQueue.at(-1) === 'worker', 'actual native queue records the paid Worker');
              purchases.push({ tick: seen.tick, team, buildingId: command.buildingId, cost, home,
                queueBefore: home ? nativeBefore.workerProduction[team] : nativeBefore.buildings.find(b => b.id === command.buildingId),
                queueAfter: home ? nativeAfter.workerProduction[team] : building, spawned: false });
            }
            if (command.type === 'gather') {
              const source = Number.isInteger(command.forestCell) ? seen.forestCells.find(t => t.cell === command.forestCell && t.stock > 0)
                : seen.resourceNodes.find(n => n.id === command.nodeId && n.stock > 0);
              assert.ok(source, 'accepted Gather uses a disclosed positive source');
              for (const id of command.ids) {
                const worker = seen.units.friendly.find(u => u.id === id);
                if (worker?.cargo === 0) jobs.set(key(worker), { tick: seen.tick, command,
                  resource: Number.isInteger(command.forestCell) ? 'wood' : source.type });
              }
            }
          }
        }
        if (step % 900 === 0) samples.push([r.observe(0), r.observe(1)]);
        if (step % 9000 === 0) console.log(JSON.stringify({ progressSeconds: step/30, commands: metrics.map(m => m.commands) }));
        before = r.checkpoint().state;
      }
      r.step(); const after = r.checkpoint().state;
      for (const unit of before.units.filter(u => u.hp > 0)) {
        const next = after.units.find(u => key(u) === key(unit));
        if (!next || next.hp < unit.hp) metrics[unit.team].firstIncomingDamage ??= after.tickNumber;
        if (unit.kind === 'worker' && (!next || next.hp <= 0)) {
          const attackers = after.units.filter(u => u.team !== unit.team && u.lastAttackTick === after.tickNumber
            && Math.hypot(u.lastAttackX-unit.x,u.lastAttackZ-unit.z) < 1e-8);
          losses.push({ tick: after.tickNumber, team: unit.team, worker: unit, dead: next, attackers });
        }
      }
      const born = after.units.filter(u => u.kind === 'worker' && u.hp > 0 && !before.units.some(v => key(v) === key(u)));
      for (const worker of born) {
        const candidates = purchases.filter(p => !p.spawned && p.team === worker.team && p.tick < after.tickNumber).filter(p => {
          const a = p.home ? before.workerProduction[p.team] : before.buildings.find(b => b.id === p.buildingId);
          const b = p.home ? after.workerProduction[p.team] : after.buildings.find(b => b.id === p.buildingId);
          return a?.queue > 0 && b?.queue === a.queue-1;
        });
        assert.equal(candidates.length, 1, 'replacement birth matches one real completed paid queue');
        const purchase = candidates[0]; purchase.spawned = true;
        const loss = losses.find(l => l.team === worker.team && l.tick < purchase.tick && l.attackers.length);
        const spawn = { tick: after.tickNumber, worker, purchaseTick: purchase.tick, buildingId: purchase.buildingId, lossTick: loss?.tick ?? null };
        spawns.push(spawn); if (loss) replacements.set(key(worker), spawn);
      }
      for (const team of [0, 1]) for (const type of ['food', 'wood']) {
        const bank = type === 'food' ? 'teamFood' : 'teamWood', bankIncrease = after[bank][team]-before[bank][team];
        if (bankIncrease <= 0) continue;
        const delivered = before.units.filter(u => u.team === team && u.hp > 0 && u.cargo > 0 && u.cargoType === type)
          .filter(u => after.units.some(v => key(v) === key(u) && v.hp > 0 && v.cargo === 0));
        if (!delivered.length) continue;
        const cargo = delivered.reduce((sum,u) => sum+u.cargo,0);
        assert.ok(bankIncrease+1e-5 >= cargo, 'actual living cargo is covered by native bank credit; normal simultaneous rewards remain separate');
        const event = { tick: after.tickNumber, team, type, delivered, bankIncrease, cargo,
          otherSimultaneousCredit: bankIncrease-cargo };
        deposits.push(event); metrics[team].firstDeposit ??= event.tick;
        if (!metrics[team].recovery) for (const worker of delivered) {
          const spawn = replacements.get(key(worker)), job = jobs.get(key(worker));
          const enemyMilitary = after.units.filter(u => u.team !== team && u.kind !== 'worker' && u.hp > 0);
          if (spawn && job?.resource === type && job.tick >= spawn.tick && job.tick < event.tick
            && worker.cargo === 10 && enemyMilitary.length && after.matchWinner === -1) {
            metrics[team].recovery = { spawn, job, deposit: event, enemyMilitary,
              before: { tick: before.tickNumber, banks: before[bank], worker },
              after: { tick: after.tickNumber, banks: after[bank], worker: after.units.find(u => key(u) === key(worker)) } };
          }
        }
      }
      before = after;
    }
  } catch (error) { failure = { name: error.name, message: error.message }; }
  try {
    const final = r.checkpoint(), finalViews = [r.observe(0),r.observe(1)];
    const completed = final.state.matchWinner >= 0 && final.state.matchWinnerReason === 'elimination';
    const criteria = { nativeElimination: completed,
      bothPaidProducers: metrics.every(m => m.producerPurchase !== null && m.producerComplete !== null && m.spentFood > 0 && m.spentWood >= 175),
      bothNativeCargoDeposits: metrics.every(m => m.firstDeposit !== null),
      bothIncomingCombatDamage: metrics.every(m => m.firstIncomingDamage !== null),
      bothDisclosedEnemySight: metrics.every(m => m.firstEnemySight !== null),
      zeroRejectedCommands: metrics.every(m => m.rejected === 0), noHarnessFailure: failure === null };
    return { opening: initial, result: { runSource: contract.runSource, opponentSource: qualifiedSource,
      contractSHA256: digest(contractBytes), mapSHA256: digest(mapBytes), nativeIdentity: identity,
      policyIdentities: [identity,identity], seeds: contract.seeds, commandSeatOrder: contract.commandSeatOrder,
      initialViews, openingSHA256: initial ? digest(JSON.stringify(initial)) : null, startTick,
      stopTick: final.state.tickNumber, elapsedSeconds: (final.state.tickNumber-startTick)/30,
      stop: failure ? 'harness-failure' : completed ? 'native-elimination' : 'bounded-unresolved',
      criteria, qualifiedUnassistedContest: Object.values(criteria).every(Boolean), failure,
      metrics, losses, purchases, spawns, deposits, trace, samples, finalViews, final } };
  } finally { await fixture.dispose(); }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const opening = process.argv[4] ? JSON.parse(await readFile(process.argv[4],'utf8')) : null;
  const result = await runUnassistedContest(path.resolve(process.argv[2]), opening);
  await writeFile(process.argv[3],JSON.stringify(result));
  console.log(JSON.stringify({ stop: result.result.stop, elapsedSeconds: result.result.elapsedSeconds,
    qualified: result.result.qualifiedUnassistedContest, metrics: result.result.metrics.map(m => ({ ...m, recovery: Boolean(m.recovery) })), failure: result.result.failure }));
  if (result.result.failure) process.exitCode = 1;
}
