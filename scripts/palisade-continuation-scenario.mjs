import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { constructionWorkArea } from '../src/construction-work-intent.mjs';
import { createGatherWorkIntent } from '../src/work-intent.mjs';

// Real paid construction/recovery cases. --observe records behavior without claiming the known
// continuation defect is fixed. Default mode requires natural continuation.
const observe = process.argv.includes('--observe');
const caseArgument = process.argv.find(value => value.startsWith('--case='))?.slice(7);
const cases = ['complete', 'complete-warm', 'legacy-wall', 'checkpoint-controls', 'unassigned-site', 'cancel-gate', 'cancel-pending-wall', 'stop', 'move', 'gather', 'manual-replacement'];
if (caseArgument) assert.ok(cases.includes(caseArgument), 'Unknown continuation case');
const selectedCases = caseArgument ? [caseArgument] : cases;
const fixture = await createFortifiedFixture({ mapPath: 'maps/open-field.json', timeoutMs: 60000,
  ...(process.env.PALISADE_CONTINUATION_SERVER ? { entrypointPath: process.env.PALISADE_CONTINUATION_SERVER } : {}) });
const map = { id: 'palisade-continuation-proof', name: 'Palisade Continuation Proof', width: 64, height: 64,
  terrainSeed: 19, fogOfWar: false, startingArmySize: 20, startingResources: { food: 0, wood: 300 },
  spawnPoints: [{ team: 0, x: -12, z: 0 }, { team: 1, x: 12, z: 0 }],
  obstacles: [], resourceNodes: [{ id: 'azure-food', type: 'food', x: -16.5, z: -8.5, stock: 1000 },
    { id: 'ember-food', type: 'food', x: 16.5, z: -8.5, stock: 1000 }], triggers: [], scenarioEvents: [] };
let clients, tokens, orderToken = 18000, activeMapId, unselectedJobs = [];
const events = [];
const command = (team, value, expression) => clients[team].command({ ...value, clientOrderToken: orderToken++ }, expression);
const ledger = predicate => fixture.checkpoint(s => {
  if (s.mapDefinition.id !== activeMapId) return false;
  for (const job of unselectedJobs) {
    const unit = s.state.units[job.id];
    assert.equal(unit.generation, job.generation);
    assert.equal(unit.buildingTargetId, null, `unselected Worker ${job.id} must never join construction`);
    assert.equal(unit.gatherNodeId, job.gatherNodeId, `unselected Worker ${job.id} retains its original job`);
    assert.equal(unit.gatherForestCell, job.gatherForestCell);
  }
  return !predicate || predicate(s);
});
const progress = (snapshot, ids) => snapshot.state.buildings.filter(b => ids.includes(b.id)).map(b => [b.id, b.progress]);
const sitesComplete = (snapshot, ids) => ids.every(id => snapshot.state.buildings.find(b => b.id === id)?.complete === true);
function assertFoodConserved(snapshot) {
  const stock = snapshot.state.resourceNodes.filter(node => node.type === 'food').reduce((sum, node) => sum + node.stock, 0);
  const cargo = snapshot.state.units.filter(unit => unit.cargoType === 'food').reduce((sum, unit) => sum + unit.cargo, 0);
  const bank = snapshot.state.teamFood.reduce((sum, food) => sum + food, 0);
  assert.ok(Math.abs(stock + cargo + bank - 2000) < 1e-9, 'all authored Food remains in stock, cargo or banks');
}
function assertOldConstructionCleared(unit, ids) {
  assert.equal(unit.wallBuildOrder, null, 'accepted replacement clears the old wall order');
  assert.ok(!ids.includes(unit.buildingTargetId), 'accepted replacement clears the old construction target');
  assert.ok(!unit.workIntent?.siteIds?.some(id => ids.includes(id)), 'accepted replacement forgets old construction site IDs');
}
function assertSites(snapshot, expected) {
  assert.equal(snapshot.state.buildings.length, expected.length, 'all and only admitted surviving paid sites remain');
  for (const site of expected) {
    const row = snapshot.state.buildings.find(b => b.id === site.id);
    assert.ok(row, `paid site ${site.id} must survive`);
    assert.equal(row.type, site.type); assert.equal(row.team, site.team);
  }
}
async function reconnect() {
  await fixture.start(); clients = [await fixture.connect(0, tokens?.[0]), await fixture.connect(1, tokens?.[1])];
  tokens ??= clients.map(c => c.welcome.player.sessionToken);
}
try {
  await reconnect();
  for (const mode of selectedCases) {
    unselectedJobs = [];
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
    let working = await ledger(s => s.state.buildings.length === 6 && [0, 1].every(team =>
      s.state.buildings.some(b => b.team === team && b.progress > 0 && !b.complete)));
    const wallIds = [0, 1].map(team => working.state.buildings.filter(b => b.team === team).map(b => b.id));
    if (mode === 'legacy-wall') {
      await fixture.stop();
      const legacy = JSON.parse(await readFile(fixture.checkpointPath, 'utf8'));
      for (const unit of legacy.state.units) delete unit.workIntent;
      await writeFile(fixture.checkpointPath, JSON.stringify(legacy)); await reconnect();
      assert.ok(clients.every(c => c.welcome.recoveredFromCheckpoint && c.welcome.player.resumed));
      working = await ledger(); assert.equal(working.matchId, legacy.matchId);
      assert.deepEqual(working.state.teamWood, [255, 255]);
    }
    const excludedIds = [];
    if (mode === 'unassigned-site') {
      // Separate selected Workers pay for neighboring sites, then explicitly
      // stop. The original line builders must never adopt these IDs.
      for (const team of [0, 1]) {
        const worker = teamWorkers[team][2];
        await command(team, { type: 'buildWall', ids: [worker.id], unitGenerations: [worker.generation],
          points: [{ column: team ? 45 : 21, row: 41 }] }, /PALISADE LINE PLACED/);
        await command(team, { type: 'stop', ids: [worker.id], unitGenerations: [worker.generation] }, /STOP ORDER/);
      }
      working = await ledger(s => s.state.buildings.length === 8
        && teamWorkers.every(rows => s.state.units[rows[2].id].buildingTargetId === null));
      excludedIds.push(...working.state.buildings.filter(b => !wallIds.flat().includes(b.id)).map(b => b.id));
      assert.equal(excludedIds.length, 2);
    }
    unselectedJobs = working.state.units.filter(u => u.kind === 'worker' && !builders.some(b => b.id === u.id))
      .map(u => ({ id: u.id, generation: u.generation, gatherNodeId: u.gatherNodeId, gatherForestCell: u.gatherForestCell }));
    assert.ok(working.state.units.filter(u => unselectedJobs.some(job => job.id === u.id)).every(u => u.buildingTargetId === null));
    for (const team of [0, 1]) await command(team, withWorker(team, { type: 'build', buildingType: 'palisade-gate',
      x: (team ? 47 : 23) - 32 + .5, z: 8.5 }), /PALISADE GATE PLACED/);
    const assigned = await ledger(s => s.state.buildings.length === 8 + excludedIds.length && builders.every(u =>
      s.state.buildings.find(b => b.id === s.state.units[u.id].buildingTargetId)?.type === 'palisade-gate'));
    assert.deepEqual(assigned.state.teamWood, excludedIds.length ? [225, 225] : [240, 240]);
    const gates = [0, 1].map(team => assigned.state.buildings.find(b => b.team === team && b.type === 'palisade-gate'));
    const sourceAreas = [0, 1].map(team => constructionWorkArea(working.state.buildings.filter(b => wallIds[team].includes(b.id)), map));
    if (!observe) for (const team of [0, 1]) {
      const order = assigned.state.units[builders[team].id].wallBuildOrder;
      assert.deepEqual(order.ids, [gates[team].id, ...wallIds[team]]);
      const intent = assigned.state.units[builders[team].id].workIntent;
      assert.deepEqual(intent.siteIds, order.ids); assert.deepEqual(intent.area, sourceAreas[team]);
      assert.equal(intent.generation, builders[team].generation);
    }
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
    const remainingPalisadeIds = assigned.state.buildings.map(b => b.id)
      .filter(id => !cancelled.includes(id) && !excludedIds.includes(id));
    const houseIds = mode === 'manual-replacement' ? builders.map(u => beforeRestart.state.units[u.id].buildingTargetId) : [];
    const assertGatherReplacement = snapshot => {
      for (const team of [0, 1]) {
        const unit = snapshot.state.units[builders[team].id];
        const node = map.resourceNodes.find(node => node.id === (team ? 'ember-food' : 'azure-food'));
        assert.equal(unit.buildingTargetId, null);
        assert.equal(unit.gatherNodeId, node.id);
        assert.deepEqual(unit.workIntent, createGatherWorkIntent(builders[team].generation, node, 'food'),
          'accepted Gather retains the new typed job, generation and original anchor');
        assertOldConstructionCleared(unit, [...wallIds[team], gates[team].id]);
      }
      assertFoodConserved(snapshot);
    };
    if (!observe && replacement) {
      for (const team of [0, 1]) assertOldConstructionCleared(beforeRestart.state.units[builders[team].id], [...wallIds[team], gates[team].id]);
      if (mode === 'gather') assertGatherReplacement(beforeRestart);
    }
    if (houseIds.length) {
      assert.equal(new Set(houseIds).size, 2);
      assert.ok(houseIds.every((id, team) => beforeRestart.state.buildings.some(b => b.id === id && b.type === 'house' && b.team === team)));
    }
    const expectedSites = [...assigned.state.buildings.filter(b => !cancelled.includes(b.id)),
      ...beforeRestart.state.buildings.filter(b => houseIds.includes(b.id))].map(({ id, type, team }) => ({ id, type, team }));
    assertSites(beforeRestart, expectedSites);
    assert.equal(beforeRestart.state.nextBuildingId, initial.state.nextBuildingId + 8 + excludedIds.length + houseIds.length,
      'paid site identities advance monotonically across published case maps');
    const corruptionControls = [];
    if (mode === 'checkpoint-controls') {
      await fixture.stop();
      const valid = JSON.parse(await readFile(fixture.checkpointPath, 'utf8'));
      for (const [label, mutate] of [
        ['foreign-gate', order => { order.siteIds[0] = gates[1].id; }],
        ['stale-generation', order => { order.generation++; }],
        ['outside-area', order => { order.area.minX = -33; }],
        ['site-outside-area', order => { order.area.maxX = order.area.minX; }],
        ['nonfinite-area', order => { order.area.minX = null; }],
        ['unknown-area-field', order => { order.area.extra = 1; }],
      ]) {
        const invalid = structuredClone(valid);
        mutate(invalid.state.units[builders[0].id].workIntent);
        const rejectedBefore = new Set((await readdir(fixture.directory)).filter(name => name.startsWith('match.json.rejected-')));
        const bytes = JSON.stringify(invalid); await writeFile(fixture.checkpointPath, bytes); await reconnect();
        assert.ok(clients.every(c => !c.welcome.recoveredFromCheckpoint));
        const rejected = (await readdir(fixture.directory)).find(name => name.startsWith('match.json.rejected-') && !rejectedBefore.has(name));
        assert.ok(rejected, label); assert.equal(await readFile(`${fixture.directory}/${rejected}`, 'utf8'), bytes);
        await fixture.stop(); corruptionControls.push(label);
      }
      await writeFile(fixture.checkpointPath, JSON.stringify(valid)); await reconnect();
      assert.ok(clients.every(c => c.welcome.recoveredFromCheckpoint && c.welcome.player.resumed));
    }
    const coldRecovered = mode !== 'complete-warm';
    if (coldRecovered) {
      await fixture.stop(); await reconnect();
      assert.ok(clients.every(c => c.welcome.recoveredFromCheckpoint && c.welcome.player.resumed));
    }
    const recovered = await ledger();
    assert.equal(recovered.matchId, beforeRestart.matchId);
    assert.deepEqual(recovered.state.teamWood, paidWood);
    assertSites(recovered, expectedSites);
    if (!observe) for (const team of [0, 1]) {
      const order = recovered.state.units[builders[team].id].workIntent;
      if (replacement) {
        assertOldConstructionCleared(recovered.state.units[builders[team].id], [...wallIds[team], gates[team].id]);
        if (mode === 'stop' || mode === 'move') assert.equal(order, null, 'Stop/Move cancels construction without creating new work');
        else if (mode === 'manual-replacement') assert.deepEqual(order.siteIds, [houseIds[team]], 'manual House replaces the old construction intent');
      }
      else assert.deepEqual(order.area, sourceAreas[team], 'cold recovery keeps the original fixed source area');
    }
    if (!observe && mode === 'gather') assertGatherReplacement(recovered);
    let settled, resuming = null;
    if (replacement) {
      settled = await ledger(s => s.state.tickNumber >= beforeRestart.state.tickNumber + 90
        && (mode !== 'manual-replacement' || sitesComplete(s, houseIds)));
      assert.deepEqual(progress(settled, remainingPalisadeIds), progress(beforeRestart, remainingPalisadeIds),
        `${mode} takes priority through cold restart and manual replacement completion`);
    } else if (observe) {
      const gatesDone = mode === 'cancel-gate' ? recovered : await ledger(s =>
        sitesComplete(s, gates.map(g => g.id)));
      settled = await ledger(s => s.state.tickNumber >= gatesDone.state.tickNumber + 90);
    } else {
      resuming = await ledger(s => builders.every((u, team) => {
        const target = s.state.units[u.id].buildingTargetId;
        return wallIds[team].includes(target) && !cancelled.includes(target)
          && s.state.buildings.find(b => b.id === target)?.progress > beforeRestart.state.buildings.find(b => b.id === target)?.progress;
      }));
      assertSites(resuming, expectedSites);
      settled = await ledger(s => sitesComplete(s, remainingPalisadeIds));
      const completedAt = settled.state.tickNumber;
      settled = await ledger(s => s.state.tickNumber > completedAt && builders.every(u => s.state.units[u.id].wallBuildOrder === null
        && s.state.units[u.id].workIntent === null));
    }
    assertSites(settled, expectedSites);
    if (!observe && replacement) {
      for (const team of [0, 1]) assertOldConstructionCleared(settled.state.units[builders[team].id], [...wallIds[team], gates[team].id]);
      if (mode === 'gather') assertGatherReplacement(settled);
    }
    assert.deepEqual(settled.state.teamWood, paidWood, 'continuation/recovery does not pay again');
    assert.equal(settled.state.nextBuildingId, beforeRestart.state.nextBuildingId, 'continuation allocates no additional paid identities');
    assert.deepEqual(progress(settled, excludedIds), progress(beforeRestart, excludedIds),
      'unassigned paid neighbors never join remembered construction');
    assert.ok(cancelled.every(id => !settled.state.buildings.some(b => b.id === id)), 'cancelled sites never return');
    assert.ok(gatherers.every(u => settled.state.units[u.id].buildingTargetId === null
      && settled.state.units[u.id].gatherNodeId === (u.team ? 'ember-food' : 'azure-food')),
      'unselected Workers retain unrelated Gather jobs');
    if (mode === 'gather') assert.ok(builders.every(u => settled.state.units[u.id].gatherNodeId === (u.team ? 'ember-food' : 'azure-food')));
    if (mode === 'move') assert.ok(builders.every(u => settled.state.units[u.id].moveGoalCell === beforeRestart.state.units[u.id].moveGoalCell));
    if (mode === 'stop') assert.ok(builders.every(u => settled.state.units[u.id].path.length === 0
      && settled.state.units[u.id].queuedWaypoints.length === 0 && !settled.state.units[u.id].movePlanningPending));
    const continued = !replacement && [0, 1].every(team => rememberedIds.filter(id => wallIds[team].includes(id)).some(id =>
      settled.state.buildings.find(b => b.id === id)?.progress > beforeRestart.state.buildings.find(b => b.id === id)?.progress));
    const event = { mode, observe, continued, cancelled, excludedIds, coldRecovered, corruptionControls, sourceAreas, wood: paidWood,
      expectedSites, resumedByOriginalBuilders: resuming ? builders.map(u => ({ id: u.id, target: resuming.state.units[u.id].buildingTargetId })) : null,
      unselectedJobCount: unselectedJobs.length,
      progressBefore: progress(beforeRestart, rememberedIds), progressAfter: progress(settled, rememberedIds),
      workerTargets: builders.map(u => settled.state.units[u.id].buildingTargetId),
      recoveredSchema: recovered.schemaVersion, sameMatch: recovered.matchId === beforeRestart.matchId };
    events.push(event); console.log(JSON.stringify(event));
    if (!observe && !replacement) assert.ok(continued, `${mode} naturally resumes remembered nearby construction`);
  }
  const source = await readFile(process.env.PALISADE_CONTINUATION_SERVER || new URL('../server.mjs', import.meta.url));
  const scenario = await readFile(new URL(import.meta.url));
  const report = { sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    serverEntrypoint: process.env.PALISADE_CONTINUATION_SERVER || 'server.mjs',
    serverIsCheckoutSource: !process.env.PALISADE_CONTINUATION_SERVER,
    serverSha256: createHash('sha256').update(source).digest('hex'),
    scenarioSha256: createHash('sha256').update(scenario).digest('hex'), observe, events,
    checkoutDirtyAtCapture: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8' }).trim().length > 0,
    limits: ['native authoritative server and real WebSocket commands/checkpoints; no browser/GPU or deployed acceptance',
      'observe mode records unresolved continuation and must not be counted as a passing fix'] };
  if (process.env.PALISADE_CONTINUATION_RECORD) await writeFile(process.env.PALISADE_CONTINUATION_RECORD, JSON.stringify(report, null, 2) + '\n');
} finally { await fixture.dispose(); }
