import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';

// Real opening orders, cargo, deposits and restart; no injected match state.
const map = JSON.parse(await readFile(new URL('../maps/bellweather-millrace.json', import.meta.url)));
const fixture = await createFortifiedFixture({ mapPath: 'maps/bellweather-millrace.json', timeoutMs: 70_000 });
try {
  await fixture.start();
  const clients = [await fixture.connect(0), await fixture.connect(1)];
  const tokens = clients.map(c => c.welcome.player.sessionToken);
  const targets = [];
  for (const [team, client] of clients.entries()) {
    const workers = client.latest.units.filter(u => u[1] === team && u[5] === 'worker');
    assert.ok(workers.length >= 2);
    for (const [index, type] of ['food', 'wood'].entries()) {
      const node = map.resourceNodes.find(n => n.id === `s${team}-${index}-1`);
      assert.equal(node.type, type);
      targets.push({ team, ...node });
      await client.command({ type: 'gather', ids: [workers[index][0]], nodeId: node.id,
        clientOrderToken: 1 + team * 2 + index }, /GATHER ORDER/);
    }
  }
  const delivered = await fixture.checkpoint(s => s.state.teamFood.every(n => n > 150)
    && s.state.teamWood.every(n => n > 250));
  assert.ok(delivered.state.matchElapsedSeconds < 120, 'proof precedes timed resource rewards');
  for (const node of targets) {
    const remaining = delivered.state.resourceNodes.find(n => n.id === node.id).stock;
    const bank = node.type === 'food' ? delivered.state.teamFood[node.team] - 150 : delivered.state.teamWood[node.team] - 250;
    const cargo = delivered.state.units.filter(u => u.team === node.team && u.cargoType === node.type).reduce((sum, u) => sum + u.cargo, 0);
    assert.ok(remaining < node.stock && bank >= 10, 'new marker really gathers and delivers');
    assert.ok(Math.abs(node.stock - remaining - bank - cargo) < 0.00001, 'stock equals delivered credit plus cargo');
  }
  await fixture.stop(); await fixture.start();
  const recovered = [await fixture.connect(0, tokens[0]), await fixture.connect(1, tokens[1])];
  for (const [team, client] of recovered.entries()) {
    assert.equal(client.welcome.matchId, delivered.matchId, 'welcome belongs to the restored match');
    assert.equal(client.welcome.recoveredFromCheckpoint, true);
    assert.notEqual(client.welcome.serverInstanceId, clients[team].welcome.serverInstanceId);
    assert.ok(client.latest.tick >= delivered.state.tickNumber, 'welcome resumes the saved clock');
    assert.ok(client.latest.food[team] >= delivered.state.teamFood[team]);
    assert.ok(client.latest.wood[team] >= delivered.state.teamWood[team]);
  }
  const restored = await fixture.checkpoint(s => s.state.tickNumber >= delivered.state.tickNumber);
  for (const node of targets) assert.ok(restored.state.resourceNodes.find(n => n.id === node.id).stock
    <= delivered.state.resourceNodes.find(n => n.id === node.id).stock, 'restart never replenishes gathered stock');
  assert.ok(restored.state.teamFood.every((n, team) => n >= delivered.state.teamFood[team]));
  assert.ok(restored.state.teamWood.every((n, team) => n >= delivered.state.teamWood[team]));
  assert.ok(recovered.every((c, team) => c.welcome.player.team === team));
  console.log(JSON.stringify({ map: map.id, bothSeatNewNodeGathering: true, conservedCreditAndCargo: true,
    restartReclaimsSeatsAndStock: true, firstBothResourceDeliverySeconds: delivered.state.matchElapsedSeconds,
    food: delivered.state.teamFood, wood: delivered.state.teamWood }));
} finally { await fixture.dispose(); }
