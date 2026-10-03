import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { GAMEPLAY_RULESET_REVISION } from '../src/gameplay-definitions.mjs';

const fixture = await createFortifiedFixture({ mapPath: 'maps/open-field.json', timeoutMs: 45_000 });
const map = { id: 'paid-gate-proof', name: 'Paid Gate Proof', width: 64, height: 64,
  terrainSeed: 19, fogOfWar: false, startingArmySize: 20, startingResources: { food: 0, wood: 300 },
  spawnPoints: [{ team: 0, x: -12, z: 0 }, { team: 1, x: 12, z: 0 }],
  obstacles: [], resourceNodes: [], triggers: [], scenarioEvents: [] };
let clients, tokens, orderToken = 800;
const command = async (team, value, expression) => {
  const notice = await clients[team].command({ ...value, clientOrderToken: orderToken++ }, expression);
  if (/^GATE (OPEN|CLOSED) ·/.test(notice.message)) await fixture.checkpoint(s => s.state.buildings.find(b => b.id === value.buildingId)?.gateOpen === value.open);
  return notice;
};
const worker = (s, team) => s.state.units.find(u => u.team === team && u.kind === 'worker' && u.hp > 0);
const withWorker = (s, team, value) => ({ ids: [worker(s, team).id], unitGenerations: [worker(s, team).generation], ...value });
const ledger = (predicate = () => true) => fixture.checkpoint(s => s.mapDefinition.id === map.id && predicate(s));
async function reconnect() {
  await fixture.start(); clients = [await fixture.connect(0, tokens?.[0]), await fixture.connect(1, tokens?.[1])];
  tokens ??= clients.map(c => c.welcome.player.sessionToken);
}
async function reject(team, value, expression, getLedger = ledger) {
  const before = await getLedger(); await command(team, value, expression);
  const after = await fixture.checkpoint(s => s.mapDefinition.id === before.mapDefinition.id && s.state.tickNumber > before.state.tickNumber);
  for (const field of ['teamWood', 'teamFood', 'nextBuildingId', 'navigationRevision']) {
    assert.deepEqual(after.state[field], before.state[field], `rejection preserves ${field}`);
  }
  assert.deepEqual(after.state.buildings.map(b => [b.id, b.gateOpen]), before.state.buildings.map(b => [b.id, b.gateOpen]));
}
try {
  await reconnect(); clients[0].send({ type: 'publishMap', map });
  await clients[0].wait(m => m.type === 'mapChange' && m.state.mapId === map.id);
  const initial = await ledger();
  for (const team of [0, 1]) {
    await command(team, withWorker(initial, team, { type: 'build', buildingType: 'palisade-gate', x: team ? 12.5 : -11.5, z: 8.5 }), /PALISADE GATE PLACED/);
    const partial = await ledger(s => s.state.buildings.some(b => b.team === team));
    const gate = partial.state.buildings.find(b => b.team === team);
    assert.equal(gate.gateOpen, false);
    await reject(team, { type: 'setGateOpen', buildingId: gate.id, open: true }, /FINISH CONSTRUCTION FIRST/);
  }
  const complete = await ledger(s => s.state.buildings.length === 2 && s.state.buildings.every(b => b.complete));
  assert.deepEqual(complete.state.teamWood, [285, 285]);
  assert.equal(complete.state.nextBuildingId, 3);
  const gateIds = complete.state.buildings.map(b => b.id);
  for (const team of [0, 1]) {
    const gate = complete.state.buildings.find(b => b.team === team);
    await reject(1 - team, { type: 'setGateOpen', buildingId: gate.id, open: true }, /SELECT YOUR GATE/);
    await reject(team, { type: 'setGateOpen', buildingId: gate.id, open: 'true' }, /OPEN MUST BE TRUE OR FALSE/);
    await command(team, { type: 'setGateOpen', buildingId: gate.id, open: true }, /GATE OPEN.*BOTH TEAMS MAY PASS/);
  }
  const opened = await ledger(s => s.state.buildings.every(b => b.gateOpen));
  assert.equal(opened.state.navigationRevision, complete.state.navigationRevision + 2);
  for (const team of [0, 1]) {
    const gate = opened.state.buildings.find(b => b.team === team);
    await reject(team, { type: 'setGateOpen', buildingId: gate.id, open: true }, /ALREADY OPEN/);
    await reject(team, withWorker(opened, team, { type: 'build', buildingType: 'palisade-gate', x: gate.x, z: gate.z }), /SPACE BLOCKED/);
    const points = [{ column: Math.floor(gate.x + 32), row: Math.floor(gate.z + 32) }];
    await reject(1 - team, withWorker(opened, 1 - team, { type: 'buildWall', points }), /SPACE BLOCKED/);
    await reject(team, withWorker(opened, team, { type: 'buildWall', points }), /WALL ALREADY PLACED.*NO CHARGE/);
  }
  await fixture.stop(); const saved = JSON.parse(await readFile(fixture.checkpointPath, 'utf8'));
  await reconnect(); assert.ok(clients.every(c => c.welcome.recoveredFromCheckpoint && c.welcome.player.resumed));
  const restored = await ledger(); assert.equal(restored.matchId, saved.matchId);
  assert.deepEqual(restored.state.buildings.map(b => [b.id, b.gateOpen]), gateIds.map(id => [id, true]));
  assert.deepEqual(restored.state.teamWood, [285, 285]);
  for (const team of [0, 1]) {
    const gate = restored.state.buildings.find(b => b.team === team);
    await command(team, { type: 'setGateOpen', buildingId: gate.id, open: false }, /GATE CLOSED/);
  }
  const closed = await ledger(s => s.state.buildings.every(b => !b.gateOpen));
  assert.equal(closed.state.navigationRevision, restored.state.navigationRevision + 2);
  console.log('Both seats: paid selected-Worker completion, strict owner/manual operation, idempotence, reserved footprint, free friendly reuse, state/bank/token recovery and safe closing passed.');

  // Two crossings: build the closed gate while the other route remains available.
  const corridor = { ...map, id: map.id + '-corridor', name: 'Gate Corridor',
    spawnPoints: [{ team: 0, x: -14, z: 8.5 }, { team: 1, x: 14, z: 8.5 }],
    obstacles: [{ column: 32, row: 0, width: 1, height: 30 },
      { column: 32, row: 31, width: 1, height: 9 }, { column: 32, row: 41, width: 1, height: 23 }] };
  clients[0].send({ type: 'publishMap', map: corridor });
  const publication = await clients[0].wait(m => m.type === 'mapChange' && m.state.mapId === corridor.id || m.type === 'mapRejected');
  assert.equal(publication.type, 'mapChange', publication.message);
  const corridorLedger = (predicate = () => true) => fixture.checkpoint(s => s.mapDefinition.id === corridor.id && predicate(s));
  const start = await corridorLedger();
  await command(0, withWorker(start, 0, { type: 'build', buildingType: 'palisade-gate', x: 0.5, z: 8.5 }), /PALISADE GATE PLACED/);
  const built = await corridorLedger(s => s.state.buildings[0]?.complete);
  const gate = built.state.buildings[0];
  // Closed movement must use the upper gap; the committed path contains no gate cell.
  await command(0, withWorker(built, 0, { type: 'move', x: 7.5, z: 8.5 }), /MOVE ORDER/);
  const routed = await corridorLedger(s => worker(s, 0).x < 0 && worker(s, 0).path.length > 0);
  assert.ok(!worker(routed, 0).path.includes(gate.footprint[0]), 'closed gate is absent from actual route');
  await command(0, withWorker(routed, 0, { type: 'stop' }), /STOP ORDER/);
  await command(0, { type: 'setGateOpen', buildingId: gate.id, open: true }, /GATE OPEN/);
  // Closing the alternate passage is now legal, because the open gate is walkable.
  await command(0, withWorker(await corridorLedger(), 0, { type: 'buildWall', points: [{ column: 32, row: 30 }] }), /PALISADE LINE PLACED/);
  const sealed = await corridorLedger(s => s.state.buildings.length === 2 && s.state.buildings.every(b => b.complete));
  await reject(0, { type: 'setGateOpen', buildingId: gate.id, open: false }, /WOULD BLOCK A ROUTE/, corridorLedger);
  // Each team's Worker naturally traverses the only passage, regardless of gate owner.
  for (const team of [0, 1]) {
    const before = await corridorLedger(), mover = worker(before, team);
    await command(team, withWorker(before, team, { type: 'move', x: 0.5, z: 8.5 }), /MOVE ORDER/);
    const inGate = await corridorLedger(s => Math.floor(worker(s, team).x + 32) === 32 && Math.floor(worker(s, team).z + 32) === 40);
    await command(team, withWorker(inGate, team, { type: 'stop' }), /STOP ORDER/);
    await reject(0, { type: 'setGateOpen', buildingId: gate.id, open: false }, /UNITS IN GATE/, corridorLedger);
    if (team === 1) {
      await fixture.stop(); const occupiedSave = JSON.parse(await readFile(fixture.checkpointPath, 'utf8'));
      await reconnect(); const recovered = await corridorLedger();
      assert.equal(recovered.matchId, occupiedSave.matchId);
      assert.equal(recovered.state.buildings.find(b => b.id === gate.id).gateOpen, true);
      assert.equal(Math.floor(worker(recovered, team).x + 32), 32, 'open-gate occupant is not relocated on recovery');
      await reject(0, { type: 'setGateOpen', buildingId: gate.id, open: false }, /UNITS IN GATE/, corridorLedger);
    }
    const now = await corridorLedger();
    await command(team, withWorker(now, team, { type: 'move', x: team ? -5.5 : 5.5, z: 8.5 }), /MOVE ORDER/);
    await corridorLedger(s => team ? worker(s, team).x < -5 : worker(s, team).x > 5);
    assert.equal(worker(await corridorLedger(), team).id, mover.id);
  }
  assert.deepEqual((await corridorLedger()).state.teamWood, [270, 300]);
  console.log('Closed detour, global open traversal on both seats, last-route refusal, occupied-cell refusal and occupied open-gate restart passed.');

  // Exact pre-gate saves migrate; unknown or invalid gate state never silently resumes.
  await fixture.stop(); const current = JSON.parse(await readFile(fixture.checkpointPath, 'utf8'));
  const corrupt = structuredClone(current); delete corrupt.state.buildings.find(b => b.id === gate.id).gateOpen;
  const source = JSON.stringify(corrupt); await writeFile(fixture.checkpointPath, source); tokens = null; await reconnect();
  await fixture.checkpoint(s => s.matchId !== current.matchId);
  const rejected = (await readdir(fixture.directory)).find(name => name.startsWith('match.json.rejected-'));
  assert.ok(rejected); assert.equal(await readFile(fixture.directory + '/' + rejected, 'utf8'), source);
  await fixture.stop(); const preGate = JSON.parse(await readFile(fixture.checkpointPath, 'utf8'));
  preGate.rulesetRevision = 'v1:561c62ccc67ac78cc067e8e639942a83fc6d6b1f89633e5b1c73aedc20f4a3a6';
  await writeFile(fixture.checkpointPath, JSON.stringify(preGate)); await reconnect();
  const migrated = await fixture.checkpoint(s => s.rulesetRevision === GAMEPLAY_RULESET_REVISION);
  assert.equal(migrated.matchId, preGate.matchId);
  console.log('Full restore rejects and preserves corrupt gate state; exact preceding gate-free ruleset migrates without replacing the match.');
} finally { await fixture.dispose(); }
