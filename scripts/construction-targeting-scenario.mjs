import assert from 'node:assert/strict';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { constructionTargetingFixture } from './construction-targeting-fixture.mjs';

// Paid placement and real contextual Build payloads on both seats; no GPU claim.
const fixture = await createFortifiedFixture({ mapPath: 'maps/open-field.json', timeoutMs: 45000 });
const map = { id: 'targeted-palisade-proof', name: 'Targeted Palisade Proof', width: 64, height: 64,
  terrainSeed: 19, fogOfWar: false, startingArmySize: 20, startingResources: { food: 0, wood: 300 },
  spawnPoints: [{ team: 0, x: -12, z: 0 }, { team: 1, x: 12, z: 0 }],
  obstacles: [], resourceNodes: [], triggers: [], scenarioEvents: [] };
let clients, tokens, orderToken = 9100;
const ledger = predicate => fixture.checkpoint(s => s.mapDefinition.id === map.id && (!predicate || predicate(s)));
async function reconnect() {
  await fixture.start(); clients = [await fixture.connect(0, tokens?.[0]), await fixture.connect(1, tokens?.[1])];
  tokens ??= clients.map(c => c.welcome.player.sessionToken);
}
const command = (team, value, expression) => clients[team].command({ ...value, clientOrderToken: orderToken++ }, expression);
try {
  await reconnect(); clients[0].send({ type: 'publishMap', map });
  await clients[0].wait(m => m.type === 'mapChange' && m.state.mapId === map.id);
  const initial = await ledger();
  const workers = [0, 1].map(team => initial.state.units.find(u => u.team === team && u.kind === 'worker' && u.hp > 0));
  const withWorker = (team, value) => ({ ids: [workers[team].id], unitGenerations: [workers[team].generation], ...value });
  for (const team of [0, 1]) {
    await command(team, withWorker(team, { type: 'buildWall', points: [{ column: team ? 44 : 20, row: 48 }] }), /PALISADE LINE PLACED/);
    await command(team, withWorker(team, { type: 'stop' }), /STOP ORDER/);
    await command(team, withWorker(team, { type: 'build', buildingType: 'palisade-gate', x: team ? 12.5 : -11.5, z: 18.5 }), /PALISADE GATE PLACED/);
    await command(team, withWorker(team, { type: 'stop' }), /STOP ORDER/);
  }
  const paid = await ledger(s => s.state.buildings.length === 4 && workers.every(w => s.state.units[w.id].buildingTargetId === null));
  assert.deepEqual(paid.state.teamWood, [270, 270]);
  assert.ok(paid.state.buildings.every(b => !b.complete));
  for (const team of [0, 1]) {
    const building = paid.state.buildings.find(b => b.team === team && b.type === 'palisade-wall');
    await command(1 - team, withWorker(1 - team, { type: 'build', buildingId: building.id }), /BUILD REJECTED.*SELECT YOUR BUILDING/);
    await command(team, { type: 'build', buildingId: building.id, ids: [] }, /BUILD REJECTED.*SELECT A WORKER/);
    await command(team, { ...withWorker(team, { type: 'build', buildingId: building.id }), unitGenerations: [workers[team].generation + 1] }, /BUILD REJECTED.*SELECT A WORKER/);
    const f = constructionTargetingFixture({ team, units: paid.state.units.map(u => ({ ...u, serverX: u.x, serverZ: u.z })),
      selection: [workers[team].id], buildings: paid.state.buildings });
    f.clickAt(building.x, building.z);
    assert.equal(f.payloads[0]?.type, 'build'); assert.equal(f.payloads[0].buildingId, building.id);
    await command(team, f.payloads[0], /CONSTRUCTION RESUMED/);
  }
  const walls = await ledger(s => s.state.buildings.filter(b => b.type === 'palisade-wall').every(b => b.complete));
  assert.deepEqual(walls.state.teamWood, [270, 270]); assert.equal(walls.state.nextBuildingId, 5);
  for (const team of [0, 1]) {
    const gate = walls.state.buildings.find(b => b.team === team && b.type === 'palisade-gate');
    const f = constructionTargetingFixture({ team, units: walls.state.units.map(u => ({ ...u, serverX: u.x, serverZ: u.z })),
      selection: [workers[team].id], buildings: walls.state.buildings });
    f.clickAt(gate.x, gate.z);
    await command(team, f.payloads[0], /CONSTRUCTION RESUMED/);
  }
  const assigned = await ledger(s => workers.every(w => s.state.buildings.find(b => b.id === s.state.units[w.id].buildingTargetId)?.type === 'palisade-gate'));
  const otherWorkers = assigned.state.units.filter(u => u.kind === 'worker' && !workers.some(w => w.id === u.id));
  assert.ok(otherWorkers.every(u => u.buildingTargetId === null), 'unselected Workers are never recruited');
  await fixture.stop(); await reconnect();
  assert.ok(clients.every(c => c.welcome.recoveredFromCheckpoint && c.welcome.player.resumed));
  const complete = await ledger(s => s.state.buildings.every(b => b.complete));
  assert.equal(complete.matchId, assigned.matchId); assert.deepEqual(complete.state.teamWood, [270, 270]);
  assert.equal(complete.state.nextBuildingId, 5);
  assert.ok(otherWorkers.every(u => complete.state.units[u.id].buildingTargetId === null));
  console.log('Both seats: actual right-click Build resumes the exact paid wall/gate; foreign, stale and empty admission rejects; no unselected recruitment, recharge or new identities; cold restart completes the assigned gates.');
} finally { await fixture.dispose(); }
