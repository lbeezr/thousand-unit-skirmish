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
  function assertConserved(snapshot) {
    assert.ok(snapshot.state.matchElapsedSeconds < 120, 'proof precedes timed resource rewards');
    for (const node of targets) {
      const remaining = snapshot.state.resourceNodes.find(n => n.id === node.id).stock;
      const bank = node.type === 'food' ? snapshot.state.teamFood[node.team] - 150 : snapshot.state.teamWood[node.team] - 250;
      const cargo = snapshot.state.units.filter(u => u.team === node.team && u.cargoType === node.type).reduce((sum, u) => sum + u.cargo, 0);
      assert.ok(Math.abs(node.stock - remaining - bank - cargo) < 0.00001, 'stock equals delivered credit plus cargo');
    }
  }
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
  const carrying = await fixture.checkpoint(s => s.state.units.some(u => u.cargo > 0));
  assertConserved(carrying);
  // Corrupt copies of evidence only; never inject them into the running match.
  const duplicateCredit = structuredClone(carrying); duplicateCredit.state.teamFood[0] += 1;
  assert.throws(() => assertConserved(duplicateCredit), /stock equals delivered credit plus cargo/);
  const lostCargo = structuredClone(carrying), carrier = lostCargo.state.units.find(u => u.cargo > 0);
  carrier.cargo = 0;
  assert.throws(() => assertConserved(lostCargo), /stock equals delivered credit plus cargo/);
  const delivered = await fixture.checkpoint(s => s.state.teamFood.every(n => n > 150)
    && s.state.teamWood.every(n => n > 250));
  assertConserved(delivered);
  for (const node of targets) {
    const remaining = delivered.state.resourceNodes.find(n => n.id === node.id).stock;
    const bank = node.type === 'food' ? delivered.state.teamFood[node.team] - 150 : delivered.state.teamWood[node.team] - 250;
    assert.ok(remaining < node.stock && bank >= 10, 'new marker really gathers and delivers');
  }
  const restartPoint = await fixture.checkpoint(s => s.state.tickNumber > delivered.state.tickNumber
    && s.state.units.some(u => u.cargo > 0));
  assertConserved(restartPoint);
  const cargoAtRestart = restartPoint.state.units.reduce((sum, u) => sum + u.cargo, 0);
  await fixture.stop(); await fixture.start();
  const recovered = [await fixture.connect(0, tokens[0]), await fixture.connect(1, tokens[1])];
  for (const [team, client] of recovered.entries()) {
    assert.equal(client.welcome.matchId, restartPoint.matchId, 'welcome belongs to the restored match');
    assert.equal(client.welcome.recoveredFromCheckpoint, true);
    assert.notEqual(client.welcome.serverInstanceId, clients[team].welcome.serverInstanceId);
    assert.ok(client.latest.tick >= restartPoint.state.tickNumber, 'welcome resumes the saved clock');
    assert.ok(client.latest.food[team] >= restartPoint.state.teamFood[team]);
    assert.ok(client.latest.wood[team] >= restartPoint.state.teamWood[team]);
  }
  const restoredSequence = Math.max(...recovered.map(c => c.welcome.checkpointSequence));
  const restored = await fixture.checkpoint(s => s.sequence > restoredSequence && s.state.tickNumber >= restartPoint.state.tickNumber);
  assertConserved(restored);
  for (const node of targets) assert.ok(restored.state.resourceNodes.find(n => n.id === node.id).stock
    <= restartPoint.state.resourceNodes.find(n => n.id === node.id).stock, 'restart never replenishes gathered stock');
  assert.ok(restored.state.teamFood.every((n, team) => n >= restartPoint.state.teamFood[team]));
  assert.ok(restored.state.teamWood.every((n, team) => n >= restartPoint.state.teamWood[team]));
  assert.ok(recovered.every((c, team) => c.welcome.player.team === team));
  console.log(JSON.stringify({ map: map.id, bothSeatNewNodeGathering: true, conservedCreditAndCargo: true,
    postRestartConservation: true, duplicateCreditAndLostCargoControls: true, cargoAtRestart,
    restartReclaimsSeatsAndStock: true, firstBothResourceDeliverySeconds: delivered.state.matchElapsedSeconds,
    food: delivered.state.teamFood, wood: delivered.state.teamWood }));
} finally { await fixture.dispose(); }
