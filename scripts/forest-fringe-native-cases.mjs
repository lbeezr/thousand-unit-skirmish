// Registered through fog-checkpoint-forest.test.mjs to avoid the active CI lane
// registry. Real processes/WS and untouched saved restart; CPU pixels only.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { createPveHeadlessFixture } from './pve-headless-fixture.mjs';
import { fogCode, fogClientFixture } from './forest-fringe-fixture.mjs';

for (const viewer of [0, 1]) test(`native seat ${viewer}: forest scenery, hidden depletion/occupant, reconnect and cold restart`, async () => {
  const side = viewer === 0 ? -1 : 1, other = 1 - viewer;
  const fringe = 32 * 64 + (viewer === 0 ? 31 : 32);
  const nodeId = 'hidden-wood';
  const map = { id: `forest-fringe-native-${viewer}`, name: 'Forest fringe native case',
    width: 64, height: 64, startingArmySize: 8, fogOfWar: true,
    startingResources: { food: 0, wood: 0 },
    spawnPoints: [{ team: 0, x: -22, z: .5 }, { team: 1, x: 22, z: .5 }],
    obstacles: [{ column: 30, row: 20, width: 4, height: 24, material: 'forest' }],
    resourceNodes: [{ id: nodeId, type: 'wood', x: -side * 2.5, z: .5, stock: 20 }],
    triggers: [], scenarioEvents: [] };
  // The checkpoint carries this custom map; bootstrap through a shipped map.
  const fixture = await createFortifiedFixture({ mapPath: 'maps/open-field.json', timeoutMs: 15_000 });
  let seed;
  try {
    // Explicit trusted setup: three already-cut cells allow an enemy to enter
    // the fringe legally. This does not claim player-command depletion setup.
    seed = await createPveHeadlessFixture(map, { matchModeId: 'authored', matchModeVersion: 1 });
    const checkpoint = seed.replay.checkpoint();
    checkpoint.state.forestStocks = (viewer === 0 ? [31, 32, 33] : [30, 31, 32])
      .map(col => [32 * 64 + col, 0]);
    await writeFile(fixture.checkpointPath, JSON.stringify(checkpoint));
    await seed.dispose(); seed = null;
    await fixture.start();
    let clients = [await fixture.connect(0), await fixture.connect(1)];
    const tokens = clients.map(client => client.welcome.player.sessionToken);
    const workers = clients.map((client, team) => client.latest.units.find(row => row[1] === team && row[5] === 'worker')[0]);
    let token = 1;
    const command = async (team, body, expected) => {
      const notice = await clients[team].command({ ...body, clientOrderToken: token++ }, /./);
      assert.match(notice.message, expected);
    };
    const row = (state, id) => state.units.find(unit => unit[0] === id);
    const privacy = state => {
      assert.equal(state.units.some(unit => unit[1] === other), false, 'enemy rows remain LOS-private');
      assert.equal(state.resourceNodes.some(node => node.id === nodeId), false, 'hidden node updates remain withheld');
      assert.equal(state.forestStocks.some(([cell]) => cell === fringe), false, 'hidden clearing is not disclosed as live stock');
      assert.equal(state.alive[other], null);
      assert.equal(state.food[other], null); assert.equal(state.wood[other], null);
      assert.equal(state.workerProduction[other], null);
    };
    await command(viewer, { type: 'move', ids: [workers[viewer]], x: side * 3.5, z: .5 }, /MOVE/);
    let approached = await clients[viewer].state(state =>
      Math.hypot(row(state, workers[viewer])[2] - side * 3.5, row(state, workers[viewer])[3] - .5) < .1
        && fogCode(state, fringe) === 1, 'forest edge approach');
    privacy(approached);
    const consumer = fogClientFixture(clients[viewer].welcome.map, viewer);
    consumer.apply(approached, true);
    assert.equal(consumer.context.latestFogCells[fringe], 1);
    assert.equal(consumer.context.minimapFogImage.data[fringe * 4 + 3], 154);
    assert.equal(consumer.context.latestForestStocks.has(fringe), false, 'static crown does not infer hidden cut');

    await command(other, { type: 'move', ids: [workers[other]], x: -side * 4.5, z: .5 }, /MOVE/);
    await clients[other].state(state => Math.hypot(row(state, workers[other])[2] + side * 4.5,
      row(state, workers[other])[3] - .5) < .1, 'opponent node approach');
    await command(other, { type: 'gather', ids: [workers[other]], nodeId }, /GATHER ORDER/);
    const productive = await clients[other].state(state => state.resourceNodes.some(node => node.id === nodeId && node.stock < 20), 'real hidden depletion');
    await command(other, { type: 'stop', ids: [workers[other]] }, /STOP ORDER/);
    await clients[viewer].state(state => state.tick >= productive.tick, 'viewer after hidden work');
    privacy(clients[viewer].latest);
    consumer.apply(clients[viewer].latest);
    assert.equal(consumer.context.latestForestStocks.has(fringe), false);

    const targetX = viewer === 0 ? -.5 : .5;
    await command(other, { type: 'move', ids: [workers[other]], x: targetX, z: .5 }, /MOVE/);
    const arrived = await clients[other].state(state => Math.hypot(row(state, workers[other])[2] - targetX,
      row(state, workers[other])[3] - .5) < .1, 'enemy occupies explored fringe');
    await clients[viewer].state(state => state.tick >= arrived.tick, 'viewer after enemy arrival');
    privacy(clients[viewer].latest);
    assert.equal(fogCode(clients[viewer].latest, fringe), 1);
    await command(viewer, { type: 'attack', ids: [workers[viewer]], targetId: workers[other] }, /^ATTACK REJECTED · TARGET UNAVAILABLE$/);
    const hiddenLiveTree = fringe + 64;
    assert.equal(fogCode(clients[viewer].latest, hiddenLiveTree), 1);
    await command(viewer, { type: 'gather', ids: [workers[viewer]], forestCell: hiddenLiveTree }, /GATHER REJECTED/);
    const health = row(clients[other].latest, workers[other])[4];
    const beforeTick = clients[viewer].latest.tick;
    // Idle authority need not broadcast another state. Check an actual later
    // persisted tick instead of requiring gratuitous idle network traffic.
    const afterAttack = await fixture.checkpoint(saved => saved.state.tickNumber >= beforeTick + 6);
    assert.equal(afterAttack.state.units.find(unit => unit.id === workers[other]).hp, health);

    const remembered = clients[viewer].latest.visibility.data;
    const closed = once(clients[viewer].socket, 'close'); clients[viewer].socket.close(); await closed;
    clients[viewer] = await fixture.connect(viewer, tokens[viewer]);
    assert.equal(clients[viewer].latest.visibility.data, remembered, 'warm reconnect retains terrain memory');
    privacy(clients[viewer].latest);

    await command(viewer, { type: 'move', ids: [workers[viewer]], x: side * 16.5, z: .5 }, /MOVE/);
    approached = await clients[viewer].state(state => Math.hypot(row(state, workers[viewer])[2] - side * 16.5,
      row(state, workers[viewer])[3] - .5) < .1, 'retreat to open ground');
    assert.equal(fogCode(approached, fringe), 1, 'forest terrain memory survives retreat');
    privacy(approached);
    const memory = approached.visibility.data;
    await fixture.stop();
    const saved = JSON.parse(await readFile(fixture.checkpointPath, 'utf8'));
    assert.equal(Buffer.from(saved.state.explored[viewer], 'base64')[fringe], 1);
    await fixture.start();
    clients = [await fixture.connect(0, tokens[0]), await fixture.connect(1, tokens[1])];
    assert.ok(clients[viewer].welcome.recoveredFromCheckpoint);
    assert.equal(clients[viewer].latest.visibility.data, memory, 'cold process restore preserves exact packed terrain memory');
    privacy(clients[viewer].latest);
    assert.equal(fogCode(clients[viewer].latest, fringe), 1);
    const epoch = clients[viewer].latest.forestEpoch;
    clients[0].send({ type: 'reset' });
    const reset = await clients[viewer].state(state => state.forestEpoch !== epoch, 'host rematch');
    assert.equal(fogCode(reset, fringe), 0, 'rematch discards terrain exploration from the prior match');
    privacy(reset);
    console.log(JSON.stringify({ scope: 'native-authority-plus-cpu-consumer', viewer, fringe,
      warmReconnect: true, coldRestart: true, hiddenNodeStock: productive.resourceNodes.find(node => node.id === nodeId).stock,
      screenshots: 0, setup: 'trusted already-cut checkpoint; all subsequent commands are native' }));
  } finally {
    if (seed) await seed.dispose();
    await fixture.dispose();
  }
});
