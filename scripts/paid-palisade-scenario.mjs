import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { GAMEPLAY_RULESET_REVISION } from '../src/gameplay-definitions.mjs';

// Actual paid commands, naturally progressing Workers and token-preserving restarts.
const fixture = await createFortifiedFixture({ mapPath: 'maps/open-field.json', timeoutMs: 45_000 });
const map = { id: 'paid-palisade-proof', name: 'Paid Palisade Proof', width: 64, height: 64,
  terrainSeed: 19, fogOfWar: false, startingArmySize: 20,
  startingResources: { food: 0, wood: 300 },
  spawnPoints: [{ team: 0, x: -20, z: 0 }, { team: 1, x: 20, z: 0 }],
  obstacles: [{ column: 31, row: 0, width: 2, height: 64 }], resourceNodes: [], triggers: [], scenarioEvents: [] };
let clients, tokens, orderToken = 400;
const command = (team, value, expression) => clients[team].command({ ...value, clientOrderToken: orderToken++ }, expression);
const worker = (snapshot, team) => snapshot.state.units.find(unit => unit.team === team && unit.kind === 'worker' && unit.hp > 0);
const wall = (team, row = 39) => ({ type: 'buildWall', points: [{ column: team ? 47 : 15, row }, { column: team ? 49 : 17, row }] });
const withWorker = (snapshot, team, value) => ({ ids: [worker(snapshot, team).id], unitGenerations: [worker(snapshot, team).generation], ...value });
async function reconnect() {
  await fixture.start(); clients = [await fixture.connect(0, tokens?.[0]), await fixture.connect(1, tokens?.[1])];
  tokens ??= clients.map(client => client.welcome.player.sessionToken);
}
async function ledger() { return fixture.checkpoint(s => s.mapDefinition.id === map.id); }
async function reject(team, value, expression) {
  const before = await ledger();
  await command(team, withWorker(before, team, value), expression);
  const after = await fixture.checkpoint(s => s.state.tickNumber > before.state.tickNumber);
  assert.deepEqual(after.state.teamWood, before.state.teamWood);
  assert.equal(after.state.nextBuildingId, before.state.nextBuildingId);
  assert.equal(after.state.navigationRevision, before.state.navigationRevision);
  assert.deepEqual(after.state.buildings.map(b => b.id), before.state.buildings.map(b => b.id));
}
try {
  await reconnect();
  clients[0].send({ type: 'publishMap', map });
  await clients[0].wait(m => m.type === 'mapChange' && m.state.mapId === map.id);
  const initial = await ledger();
  for (const team of [0, 1]) await command(team, withWorker(initial, team, wall(team)), /PALISADE LINE PLACED/);
  const partial = await fixture.checkpoint(s => s.state.buildings.length === 6 && s.state.buildings.some(b => b.progress > 0 && !b.complete));
  assert.deepEqual(partial.state.teamWood, [255, 255]);
  assert.equal(partial.state.nextBuildingId, 7);
  assert.equal(partial.state.navigationRevision, initial.state.navigationRevision + 2, 'one navigation commit per entire paid line');
  for (const team of [0, 1]) {
    const builder = worker(partial, team);
    assert.equal(builder.wallBuildOrder.ids.length, 3);
    assert.equal(builder.wallBuildOrder.generation, builder.generation);
    assert.equal(builder.wallBuildOrder.revision, builder.orderRevision);
  }
  await reject(0, { type: 'buildWall', points: [{ column: 20, row: 1 }, { column: 20, row: 63 }] }, /INSUFFICIENT RESOURCES/);
  await reject(0, { type: 'buildWall', points: [{ column: 30, row: 45 }, { column: 33, row: 45 }] }, /SPACE BLOCKED/);
  await reject(0, wall(1), /SPACE BLOCKED/);
  await reject(0, { type: 'buildWall', points: [{ column: -1, row: 40 }] }, /OUTSIDE THE MAP/);
  await reject(0, { ...wall(0, 41), unitGenerations: [worker(partial, 0).generation + 1] }, /SELECT A WORKER/);
  // Full island cut is unaffordable with 300 starting wood; use a small authored corridor later for connectivity.
  await fixture.stop();
  const saved = JSON.parse(await readFile(fixture.checkpointPath, 'utf8'));
  await reconnect();
  assert.ok(clients.every(client => client.welcome.recoveredFromCheckpoint && client.welcome.player.resumed));
  assert.deepEqual(clients[0].latest.wood, saved.state.teamWood);
  const complete = await fixture.checkpoint(s => s.state.buildings.length === 6 && s.state.buildings.every(b => b.complete)
    && s.state.units.every(unit => !unit.wallBuildOrder));
  assert.deepEqual(complete.state.teamWood, [255, 255], 'sequence completion/recovery never pays a second time');
  assert.equal(complete.state.nextBuildingId, 7);
  assert.equal(complete.matchId, saved.matchId);
  console.log('Paid-line restart and natural sequential completion passed.');
  for (const team of [0, 1]) await command(team, withWorker(complete, team, wall(team)), /WALL ALREADY PLACED.*NO CHARGE/);
  const repeated = await ledger(); assert.deepEqual(repeated.state.teamWood, [255, 255]); assert.equal(repeated.state.nextBuildingId, 7);
  for (const team of [0, 1]) {
    const observed = clients[team].latest.buildings.filter(b => b.team === team);
    assert.deepEqual(observed.map(b => b.connections), [['east'], ['east', 'west'], ['west']]);
    await command(team, withWorker(complete, team, wall(team, 43)), /PALISADE LINE PLACED/);
  }
  const second = await fixture.checkpoint(s => s.state.buildings.length === 12);
  assert.deepEqual(second.state.teamWood, [210, 210]);
  const cancelledIds = [];
  for (const team of [0, 1]) {
    const pending = second.state.buildings.filter(b => b.team === team && b.z === 11.5)[1];
    assert.equal(pending.progress, 0); cancelledIds.push(pending.id);
    await command(team, { type: 'cancelConstruction', buildingId: pending.id }, /CONSTRUCTION CANCELLED/);
    await command(team, { type: 'cancelConstruction', buildingId: pending.id }, /CANCEL REJECTED/);
  }
  const pruned = await fixture.checkpoint(s => s.state.buildings.length === 10);
  assert.deepEqual(pruned.state.teamWood, [225, 225]);
  assert.ok(pruned.state.units.every(unit => !unit.wallBuildOrder?.ids.some(id => cancelledIds.includes(id))));
  await fixture.stop(); await reconnect();
  const recovered = await fixture.checkpoint(s => s.state.buildings.length === 10 && s.state.buildings.every(b => b.complete)
    && s.state.units.every(unit => !unit.wallBuildOrder));
  assert.deepEqual(recovered.state.teamWood, [225, 225], 'cancelled pending segments refund once across a restart');
  console.log('Pending removal, refund and restart passed.');
  for (const team of [0, 1]) {
    await command(team, withWorker(recovered, team, wall(team, 47)), /PALISADE LINE PLACED/);
    await command(team, withWorker(recovered, team, { type: 'stop' }), /STOP ORDER/);
  }
  const stopped = await fixture.checkpoint(s => s.state.buildings.length === 16 && s.state.units.every(unit => !unit.wallBuildOrder));
  const stoppedProgress = stopped.state.buildings.filter(b => !b.complete).map(b => b.progress);
  await fixture.stop(); await reconnect();
  const stable = await fixture.checkpoint(s => s.state.tickNumber >= stopped.state.tickNumber + 30);
  assert.deepEqual(stable.state.buildings.filter(b => !b.complete).map(b => b.progress), stoppedProgress, 'Stop interrupts the whole sequence through reconnect');
  assert.deepEqual(stable.state.teamWood, [180, 180]);
  console.log('Stop interruption persisted through restart.');
  // Removing a currently targeted, not-yet-started segment advances the remaining sequence.
  for (const team of [0, 1]) await command(team, withWorker(stable, team, { type: 'buildWall',
    points: [{ column: team ? 39 : 23, row: 51 }, { column: team ? 41 : 25, row: 51 }] }), /PALISADE LINE PLACED/);
  const currentLine = await fixture.checkpoint(s => s.state.buildings.length === 22);
  assert.deepEqual(currentLine.state.teamWood, [135, 135]);
  const currentIds = [];
  for (const team of [0, 1]) {
    const target = currentLine.state.buildings.find(b => b.team === team && b.z === 19.5);
    assert.equal(target.progress, 0); currentIds.push(target.id);
    await command(team, { type: 'cancelConstruction', buildingId: target.id }, /CONSTRUCTION CANCELLED/);
  }
  const advanced = await fixture.checkpoint(s => s.state.buildings.length === 20
    && s.state.units.every(unit => !unit.wallBuildOrder?.ids.some(id => currentIds.includes(id))));
  assert.deepEqual(advanced.state.teamWood, [150, 150]);
  await fixture.stop(); await reconnect();
  const advancedComplete = await fixture.checkpoint(s => s.state.buildings.filter(b => b.z === 19.5).every(b => b.complete)
    && s.state.units.every(unit => !unit.wallBuildOrder));
  assert.deepEqual(advancedComplete.state.teamWood, [150, 150]);
  console.log('Current removal, sequence advance and restart passed.');
  // Full union route cut remains illegal even though each endpoint alone leaves a route.
  const corridor = { ...map, id: map.id + '-corridor', name: 'Palisade Corridor', obstacles: [
    { column: 0, row: 20, width: 19, height: 1 }, { column: 22, row: 20, width: 42, height: 1 }],
    resourceNodes: [{ id: 'north-food', type: 'food', x: -14.5, z: -16.5, stock: 100 }] };
  clients[0].send({ type: 'publishMap', map: corridor });
  const publication = await clients[0].wait(m => (m.type === 'mapChange' && m.state.mapId === corridor.id) || m.type === 'mapRejected', 'corridor publication');
  assert.equal(publication.type, 'mapChange', publication.message);
  const beforeCut = await fixture.checkpoint(s => s.mapDefinition.id === corridor.id);
  await command(0, withWorker(beforeCut, 0, { type: 'buildWall',
    points: [{ column: 19, row: 20 }, { column: 21, row: 20 }] }), /WOULD BLOCK A ROUTE/);
  const afterCut = await fixture.checkpoint(s => s.mapDefinition.id === corridor.id && s.state.tickNumber > beforeCut.state.tickNumber);
  assert.deepEqual(afterCut.state.teamWood, [300, 300]); assert.equal(afterCut.state.nextBuildingId, beforeCut.state.nextBuildingId);
  assert.equal(afterCut.state.navigationRevision, beforeCut.state.navigationRevision);
  assert.equal(afterCut.state.buildings.length, 0);
  // Exact compatible pre-palisade revision preserves the complete match and migrates missing queues.
  await fixture.stop();
  const prior = JSON.parse(await readFile(fixture.checkpointPath, 'utf8'));
  const legacy = structuredClone(prior);
  legacy.rulesetRevision = 'v1:d85f5a09decc0d0ade81803ab289b52ec5a08e84ff5a1771e85401d4c3611eab';
  legacy.state.buildings = []; legacy.state.nextBuildingId = 1;
  for (const unit of legacy.state.units) { delete unit.wallBuildOrder; unit.buildingTargetId = null; }
  await writeFile(fixture.checkpointPath, JSON.stringify(legacy)); await reconnect();
  const migrated = await fixture.checkpoint(s => s.rulesetRevision === GAMEPLAY_RULESET_REVISION);
  assert.equal(migrated.matchId, prior.matchId, 'exact compatible pre-palisade ruleset migrates without replacing the match');
  // Corrupt generation/revision queues are rejected by the complete live restore validator.
  await fixture.stop();
  const invalid = JSON.parse(await readFile(fixture.checkpointPath, 'utf8'));
  const invalidWorker = worker(invalid, 0);
  invalidWorker.wallBuildOrder = { ids: [1], generation: invalidWorker.generation + 1, revision: invalidWorker.orderRevision };
  const invalidSource = JSON.stringify(invalid);
  await writeFile(fixture.checkpointPath, invalidSource); await reconnect();
  const fresh = await fixture.checkpoint(s => s.matchId !== invalid.matchId);
  assert.notEqual(fresh.matchId, invalid.matchId);
  const rejected = (await readdir(fixture.directory)).find(name => name.startsWith('match.json.rejected-'));
  assert.ok(rejected); assert.equal(await readFile(fixture.directory + '/' + rejected, 'utf8'), invalidSource);
  console.log('Paid palisade proof passed: both seats, atomic bank/ID/navigation commit, five rejections without mutation, natural multi-segment completion, token rejoin/restart, reuse without charge, pending/current cancellation/refund/pruning/recovery, Stop persistence, visible connection shapes, collective route-cut rejection, exact prior-ruleset migration, full-restore corruption rejection.');
} finally { await fixture.dispose(); }
