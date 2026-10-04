import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';

// Real paid construction/recovery cases prepared before the shared workIntent
// foundation. --observe records current behavior without claiming the known
// continuation defect is fixed. Default mode requires natural continuation.
const observe = process.argv.includes('--observe');
const caseArgument = process.argv.find(value => value.startsWith('--case='))?.slice(7);
const cases = ['complete', 'cancel-gate', 'cancel-pending-wall', 'stop', 'move', 'gather', 'manual-replacement'];
if (caseArgument) assert.ok(cases.includes(caseArgument), 'Unknown continuation case');
const selectedCases = caseArgument ? [caseArgument] : cases;
const fixture = await createFortifiedFixture({ mapPath: 'maps/open-field.json', timeoutMs: 60000,
  ...(process.env.PALISADE_CONTINUATION_SERVER ? { entrypointPath: process.env.PALISADE_CONTINUATION_SERVER } : {}) });
const map = { id: 'palisade-continuation-proof', name: 'Palisade Continuation Proof', width: 64, height: 64,
  terrainSeed: 19, fogOfWar: false, startingArmySize: 20, startingResources: { food: 0, wood: 300 },
  spawnPoints: [{ team: 0, x: -12, z: 0 }, { team: 1, x: 12, z: 0 }],
  obstacles: [], resourceNodes: [{ id: 'azure-food', type: 'food', x: -16.5, z: -8.5, stock: 1000 },
    { id: 'ember-food', type: 'food', x: 16.5, z: -8.5, stock: 1000 }], triggers: [], scenarioEvents: [] };
let clients, tokens, orderToken = 18000, activeMapId;
const events = [];
const command = (team, value, expression) => clients[team].command({ ...value, clientOrderToken: orderToken++ }, expression);
const ledger = predicate => fixture.checkpoint(s => s.mapDefinition.id === activeMapId && (!predicate || predicate(s)));
const progress = (snapshot, ids) => snapshot.state.buildings.filter(b => ids.includes(b.id)).map(b => [b.id, b.progress]);
async function reconnect() {
  await fixture.start(); clients = [await fixture.connect(0, tokens?.[0]), await fixture.connect(1, tokens?.[1])];
  tokens ??= clients.map(c => c.welcome.player.sessionToken);
}
try {
  await reconnect();
  for (const mode of selectedCases) {
    activeMapId = `${map.id}-${mode}`;
    const after = clients[0].messages.length;
    clients[0].send({ type: 'publishMap', map: { ...map, id: activeMapId } });
    await clients[0].wait(m => m.type === 'mapChange' && m.state.mapId === activeMapId, 'fresh case map', after);
    const initial = await ledger();
    const teamWorkers = [0, 1].map(team => initial.state.units.filter(u => u.team === team && u.kind === 'worker' && u.hp > 0));
    const builders = teamWorkers.map(rows => rows[0]), gatherers = teamWorkers.map(rows => rows[1]);
    const withWorker = (team, value) => ({ ids: [builders[team].id], unitGenerations: [builders[team].generation], ...value });
    for (const team of [0, 1]) {
      await command(team, { type: 'gather', ids: [gatherers[team].id], unitGenerations: [gatherers[team].generation],
        nodeId: team ? 'ember-food' : 'azure-food' }, /GATHER ORDER/);
      await command(team, withWorker(team, { type: 'buildWall',
        points: [{ column: team ? 44 : 20, row: 40 }, { column: team ? 46 : 22, row: 40 }] }), /PALISADE LINE PLACED/);
    }
    const working = await ledger(s => s.state.buildings.length === 6 && [0, 1].every(team =>
      s.state.buildings.some(b => b.team === team && b.progress > 0 && !b.complete)));
    const wallIds = [0, 1].map(team => working.state.buildings.filter(b => b.team === team).map(b => b.id));
    for (const team of [0, 1]) await command(team, withWorker(team, { type: 'build', buildingType: 'palisade-gate',
      x: (team ? 47 : 23) - 32 + .5, z: 8.5 }), /PALISADE GATE PLACED/);
    const assigned = await ledger(s => s.state.buildings.length === 8 && builders.every(u =>
      s.state.buildings.find(b => b.id === s.state.units[u.id].buildingTargetId)?.type === 'palisade-gate'));
    assert.deepEqual(assigned.state.teamWood, [240, 240]);
    const gates = [0, 1].map(team => assigned.state.buildings.find(b => b.team === team && b.type === 'palisade-gate'));
    const cancelled = [];
    if (mode.startsWith('cancel-')) {
      for (const team of [0, 1]) {
        const id = mode === 'cancel-gate' ? gates[team].id : wallIds[team].at(-1);
        await command(1 - team, { type: 'cancelConstruction', buildingId: id }, /CANCEL REJECTED/);
        await command(team, { type: 'cancelConstruction', buildingId: id }, /CONSTRUCTION CANCELLED/);
        cancelled.push(id);
      }
      const removed = await ledger(s => cancelled.every(id => !s.state.buildings.some(b => b.id === id)));
      if (mode === 'cancel-pending-wall') assert.deepEqual(removed.state.teamWood, [255, 255]);
      else assert.ok(removed.state.teamWood.every(wood => wood > 240 && wood <= 255));
      for (const team of [0, 1]) await command(team, { type: 'cancelConstruction', buildingId: cancelled[team] }, /CANCEL REJECTED/);
      const repeated = await ledger(s => s.state.tickNumber > removed.state.tickNumber);
      assert.deepEqual(repeated.state.teamWood, removed.state.teamWood, 'cancelled work refunds once only');
    } else if (['stop', 'move', 'gather', 'manual-replacement'].includes(mode)) {
      for (const team of [0, 1]) {
        const order = mode === 'stop' ? { type: 'stop' } : mode === 'move'
          ? { type: 'move', x: builders[team].x, z: -12.5 } : mode === 'gather'
          ? { type: 'gather', nodeId: team ? 'ember-food' : 'azure-food' }
          : { type: 'build', buildingType: 'house', x: team ? 12.5 : -11.5, z: -16.5 };
        const expression = mode === 'stop' ? /STOP ORDER/ : mode === 'move' ? /MOVE ORDER/
          : mode === 'gather' ? /GATHER ORDER/ : /HOUSE PLACED/;
        await command(team, withWorker(team, order), expression);
      }
    }
    const replacement = ['stop', 'move', 'gather', 'manual-replacement'].includes(mode);
    const beforeRestart = await ledger(s => !replacement || builders.every(u => mode === 'manual-replacement'
      ? s.state.buildings.find(b => b.id === s.state.units[u.id].buildingTargetId)?.type === 'house'
      : s.state.units[u.id].buildingTargetId === null));
    const paidWood = [...beforeRestart.state.teamWood];
    const rememberedIds = wallIds.flat().filter(id => !cancelled.includes(id));
    const remainingPalisadeIds = assigned.state.buildings.map(b => b.id).filter(id => !cancelled.includes(id));
    await fixture.stop(); await reconnect();
    assert.ok(clients.every(c => c.welcome.recoveredFromCheckpoint && c.welcome.player.resumed));
    const recovered = await ledger();
    assert.equal(recovered.matchId, beforeRestart.matchId);
    assert.deepEqual(recovered.state.teamWood, paidWood);
    let settled;
    if (replacement) {
      settled = await ledger(s => s.state.tickNumber >= beforeRestart.state.tickNumber + 90
        && (mode !== 'manual-replacement' || s.state.buildings.filter(b => b.type === 'house').every(b => b.complete)));
      assert.deepEqual(progress(settled, remainingPalisadeIds), progress(beforeRestart, remainingPalisadeIds),
        `${mode} takes priority through cold restart and manual replacement completion`);
    } else if (observe) {
      const gatesDone = mode === 'cancel-gate' ? recovered : await ledger(s =>
        s.state.buildings.filter(b => gates.some(g => g.id === b.id)).every(b => b.complete));
      settled = await ledger(s => s.state.tickNumber >= gatesDone.state.tickNumber + 90);
    } else {
      settled = await ledger(s => s.state.buildings.filter(b => remainingPalisadeIds.includes(b.id)).every(b => b.complete));
    }
    assert.deepEqual(settled.state.teamWood, paidWood, 'continuation/recovery does not pay again');
    assert.equal(settled.state.nextBuildingId, mode === 'manual-replacement' ? 11 : 9);
    assert.ok(cancelled.every(id => !settled.state.buildings.some(b => b.id === id)), 'cancelled sites never return');
    assert.ok(gatherers.every(u => settled.state.units[u.id].buildingTargetId === null
      && settled.state.units[u.id].gatherNodeId === (u.team ? 'ember-food' : 'azure-food')),
      'unselected Workers retain unrelated Gather jobs');
    const continued = !replacement && [0, 1].every(team => rememberedIds.filter(id => wallIds[team].includes(id)).some(id =>
      settled.state.buildings.find(b => b.id === id)?.progress > beforeRestart.state.buildings.find(b => b.id === id)?.progress));
    const event = { mode, observe, continued, cancelled, wood: paidWood,
      progressBefore: progress(beforeRestart, rememberedIds), progressAfter: progress(settled, rememberedIds),
      workerTargets: builders.map(u => settled.state.units[u.id].buildingTargetId),
      recoveredSchema: recovered.schemaVersion, sameMatch: recovered.matchId === beforeRestart.matchId };
    events.push(event); console.log(JSON.stringify(event));
    if (!observe && !replacement) assert.ok(continued, `${mode} naturally resumes remembered nearby construction`);
  }
  const source = await readFile(process.env.PALISADE_CONTINUATION_SERVER || new URL('../server.mjs', import.meta.url));
  const report = { sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    serverSha256: createHash('sha256').update(source).digest('hex'), observe, events,
    limits: ['native authoritative server and real WebSocket commands/checkpoints; no browser/GPU or deployed acceptance',
      'observe mode records unresolved continuation and must not be counted as a passing fix'] };
  if (process.env.PALISADE_CONTINUATION_RECORD) await writeFile(process.env.PALISADE_CONTINUATION_RECORD, JSON.stringify(report, null, 2) + '\n');
} finally { await fixture.dispose(); }
