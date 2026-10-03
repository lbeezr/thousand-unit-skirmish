import assert from 'node:assert/strict';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { OrderAudioGate, cueForNotice } from '../src/audio-policy.mjs';

// Actual paid lines exercise the server's applied notice and recipient/token boundary.
const fixture = await createFortifiedFixture({ mapPath: 'maps/open-field.json', timeoutMs: 30_000 });
const map = { id: 'audio-wall-order', name: 'Audio Wall Order', width: 64, height: 64,
  terrainSeed: 19, fogOfWar: true, startingArmySize: 20,
  startingResources: { food: 0, wood: 300 },
  spawnPoints: [{ team: 0, x: -20, z: 0 }, { team: 1, x: 20, z: 0 }],
  obstacles: [], resourceNodes: [], triggers: [], scenarioEvents: [] };
try {
  await fixture.start();
  const clients = [await fixture.connect(0), await fixture.connect(1)];
  clients[0].send({ type: 'publishMap', map });
  await Promise.all(clients.map(client => client.wait(m => m.type === 'mapChange' && m.state.mapId === map.id)));
  const initial = await fixture.checkpoint(s => s.mapDefinition.id === map.id);
  for (const [team, client] of clients.entries()) {
    const worker = initial.state.units.find(unit => unit.team === team && unit.kind === 'worker' && unit.hp > 0);
    const token = 400 + team;
    const gate = new OrderAudioGate();
    gate.sent(token, { cue: 'build', kind: 'worker' });
    const notice = await client.command({ type: 'buildWall', ids: [worker.id],
      unitGenerations: [worker.generation], clientOrderToken: token,
      points: [{ column: team ? 47 : 15, row: 39 }, { column: team ? 49 : 17, row: 39 }],
    }, /^WALL BUILD ORDER · /);
    assert.deepEqual(gate.observe(notice.clientOrderToken, notice.message), { cue: 'build', kind: 'worker' });
    assert.equal(gate.observe(notice.clientOrderToken, notice.message), null, 'duplicate success is silent');
    assert.equal(cueForNotice(notice.message, { localTeam: team }), null, 'generic notice route does not double the cue');
    console.log(JSON.stringify({ team, token, notice: notice.message, cue: 'build', acknowledgements: 1 }));
  }
  const paid = await fixture.checkpoint(s => s.state.buildings.length === 6);
  assert.deepEqual(paid.state.teamWood, [255, 255], 'one three-segment paid line per team');
  // Each ordered socket must pass both admissions before an absent token proves isolation.
  await Promise.all(clients.map((client, team) => client.state(state => state.tick > paid.state.tickNumber
    && state.buildings.filter(building => building.team === team).length === 3, 'state after both paid lines')));
  for (const team of [0, 1]) {
    assert.ok(!clients[1 - team].messages.some(m => m.type === 'notice' && m.clientOrderToken === 400 + team), 'opponent receives no order acknowledgement');
  }
  console.log('Wall audio passed: actual applied tokens, both local seats, fog/recipient isolation and one acknowledgement per line.');
} finally { await fixture.dispose(); }
