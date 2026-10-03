import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { STONE_ECONOMY_PROFILE_ID as STONE, economyRulesetRevision } from '../src/economy-profile.mjs';

test('native Stone profile exposes no initial grant, rejects unpaid defense and recovers declared typed state', async t => {
  const room = await createFortifiedFixture({ mapPath: 'maps/open-field.json', timeoutMs: 20000 });
  t.after(() => room.dispose()); await room.start();
  let clients = [await room.connect(0), await room.connect(1)];
  const tokens = clients.map(client => client.welcome.player.sessionToken);
  const map = { id: 'stone-ledger-recovery-proof', name: 'Stone ledger recovery proof',
    width: 64, height: 64, terrainSeed: 19, fogOfWar: true, startingArmySize: 24,
    economyProfileId: STONE, startingResources: { food: 300, wood: 600 },
    spawnPoints: [{ team: 0, x: -20, z: 0 }, { team: 1, x: 20, z: 0 }],
    obstacles: [], resourceNodes: [], triggers: [], scenarioEvents: [] };
  clients[0].send({ type: 'publishMap', map });
  await Promise.all(clients.map(client => client.wait(message => message.type === 'mapChange' && message.map.id === map.id)));
  for (const [team, client] of clients.entries()) {
    assert.equal(client.latest.economyProfileId, STONE);
    assert.equal(client.latest.rulesetRevision, economyRulesetRevision(STONE));
    assert.deepEqual(client.latest.stone, team === 0 ? [0, null] : [null, 0]);
    const ids = client.latest.units.filter(unit => unit[1] === team && unit[5] === 'worker').map(unit => unit[0]);
    assert.ok(ids.length);
    await client.command({ type: 'build', buildingType: 'watchtower', ids,
      x: (team ? 1 : -1) * 10.5, z: 8.5 }, /NEED .*50 STONE/);
  }
  await room.stop();
  const snapshot = JSON.parse(await readFile(room.checkpointPath, 'utf8'));
  assert.equal(snapshot.schemaVersion, 23); assert.deepEqual(snapshot.state.teamStone, [0, 0]);
  assert.deepEqual(snapshot.state.teamFood, [300, 300]); assert.deepEqual(snapshot.state.teamWood, [600, 600]);
  assert.equal(snapshot.state.buildings.length, 0); assert.equal(snapshot.state.nextBuildingId, 1);

  // A declared recovery fixture tests finite typed persistence, not natural harvest or playability.
  snapshot.state.teamStone = [7.25, 13.5];
  const workers = [0, 1].map(team => snapshot.state.units.find(unit => unit.team === team && unit.kind === 'worker'));
  for (const unit of workers) { unit.cargo = 3.125; unit.cargoType = 'stone'; }
  await writeFile(room.checkpointPath, JSON.stringify(snapshot)); await room.start();
  clients = [await room.connect(0, tokens[0]), await room.connect(1, tokens[1])];
  assert.ok(clients.every(client => client.welcome.recoveredFromCheckpoint));
  for (const [team, client] of clients.entries()) {
    assert.deepEqual(client.latest.stone, team === 0 ? [7.25, null] : [null, 13.5]);
  }
  await room.stop(); const recovered = JSON.parse(await readFile(room.checkpointPath, 'utf8'));
  assert.equal(recovered.matchId, snapshot.matchId); assert.deepEqual(recovered.state.teamStone, snapshot.state.teamStone);
  for (const unit of workers) {
    assert.equal(recovered.state.units[unit.id].cargo, 3.125);
    assert.equal(recovered.state.units[unit.id].cargoType, 'stone');
  }
  for (const change of [s => delete s.state.teamStone, s => delete s.economyProfileId,
    s => delete s.mapDefinition.economyProfileId, s => s.rulesetRevision = `v1:${'0'.repeat(64)}`]) {
    const invalid = structuredClone(recovered); change(invalid); const bytes = JSON.stringify(invalid);
    await writeFile(room.checkpointPath, bytes); await room.start(); await room.stop();
    const fallback = JSON.parse(await readFile(room.checkpointPath, 'utf8'));
    assert.notEqual(fallback.matchId, recovered.matchId);
    const rejected = (await readdir(room.directory)).filter(name => name.startsWith('match.json.rejected-'));
    assert.ok((await Promise.all(rejected.map(name => readFile(path.join(room.directory, name), 'utf8')))).includes(bytes));
  }
});
