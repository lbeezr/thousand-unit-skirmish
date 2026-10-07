import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';
import { priorTerracedValeGroves } from '../src/terraced-vale-sheep.mjs';

export async function runTerracedValeGroveRecoveryScenario() {
  const map = JSON.parse(await readFile(new URL('../maps/veyrholds-terraced-vale.json', import.meta.url)));
  const prior = priorTerracedValeGroves(map);
  const replayFixture = await createPathingReplayFixture(prior);
  const fixture = await createFortifiedFixture({ mapPath: null, timeoutMs: 35_000 });
  try {
    // A validated historical waiting-lobby descriptor around the untouched
    // authored opening; no stock, banks, buildings or unit positions are injected.
    const saved = replayFixture.replay.checkpoint();
    saved.matchModeId = 'skirmish'; saved.matchModeVersion = 1;
    saved.state.pregame = { phase: 'lobby', revision: 0 };
    saved.state.scenarioClockStarted = false; saved.state.matchElapsedSeconds = 0;
    replayFixture.replay.validate(structuredClone(saved));
    await writeFile(fixture.checkpointPath, JSON.stringify(saved));
    await fixture.start();
    const clients = [await fixture.connect(0), await fixture.connect(1)];
    for (const client of clients) {
      assert.equal(client.welcome.recoveredFromCheckpoint, true);
      assert.deepEqual(client.welcome.map.resourceNodes, prior.resourceNodes);
    }
    const joined = await clients[0].wait(message => message.type === 'lobby'
      && message.lobby.seats.length === 2 && message.lobby.seats.every(seat => seat.connected), 'recovered human lobby');
    clients[0].send({ type: 'configureLobby', armySize: 250, revision: joined.lobby.revision });
    await clients[0].wait(message => message.type === 'mapChange' && message.state.armySize === 250, 'same-ID army configuration');
    const configured = await fixture.checkpoint(value => value.state.currentArmySize === 250);
    assert.deepEqual(configured.mapDefinition, prior); assert.equal(configured.mapHash, saved.mapHash);
    const lobby = [...clients[0].messages].reverse().find(message => message.type === 'lobby').lobby;
    for (const client of clients) client.send({ type: 'setReady', ready: true, revision: lobby.revision });
    const ready = await clients[0].wait(message => message.type === 'lobby' && message.lobby.canLaunch, 'both Ready');
    clients[0].send({ type: 'launchMatch', revision: ready.lobby.revision });
    await clients[0].wait(message => message.type === 'lobby' && message.lobby.phase === 'running', 'ordinary Launch');
    const after = clients[0].messages.length;
    clients[0].send({ type: 'reset' });
    await clients[0].wait(message => message.type === 'mapChange' && message.map.resourceNodes.length === 16, 'host reset adopts the grove', after);
    const reset = await fixture.checkpoint(value => value.state.pregame.phase === 'lobby' && value.mapHash !== saved.mapHash);
    assert.deepEqual(reset.mapDefinition, map);
    assert.deepEqual(reset.state.teamWood, [250, 250]);
    for (const row of reset.state.resourceNodes.filter(row => /-home-wood(?:-|$)/.test(row.id))) assert.equal(row.stock, 325);
    return { historicalNodes: 12, resetNodes: 16, nativeSameMapLobbyRetention: true, nativeExplicitHostResetAdoption: true };
  } finally { await replayFixture.dispose(); await fixture.dispose(); }
}

// Normal default HTTP/WS orders, then unchanged production fixed ticks for the
// full authored stock. No units, resource stock, banks or movement are injected.
export async function runTerracedValeGroveScenario() {
  const map = JSON.parse(await readFile(new URL('../maps/veyrholds-terraced-vale.json', import.meta.url)));
  const fixture = await createFortifiedFixture({ mapPath: null, timeoutMs: 35_000 });
  let replayFixture;
  try {
    await fixture.start();
    const clients = [await fixture.connect(0), await fixture.connect(1)];
    const initial = await fixture.checkpoint();
    assert.deepEqual(initial.mapDefinition, map);
    assert.equal(map.resourceNodes.length, 16);
    const workers = [0, 1].map(team => initial.state.units.find(row => row.team === team && row.kind === 'worker').id);
    for (const team of [0, 1]) {
      assert.equal(clients[team].welcome.map.id, map.id);
      assert.equal(clients[team].welcome.matchModeId, 'skirmish');
      await clients[team].command({ type: 'gather', ids: [workers[team]], nodeId: `s${team}-home-wood`,
        clientOrderToken: 7000 + team }, /GATHER ORDER/);
    }
    const admitted = await fixture.checkpoint(saved => workers.every(id =>
      saved.state.units.find(row => row.id === id).gatherNodeId));
    await fixture.stop();
    replayFixture = await createPathingReplayFixture(map);
    const r = replayFixture.replay;
    r.restore(structuredClone(admitted));
    const targets = [new Set(), new Set()], firstDepleted = [null, null];
    let ticks = 0, partialRecovery = false;
    const groveNodes = () => [...r.resources.values()].filter(row => /^s[01]-home-wood(?:-|$)/.test(row.id));
    const conserved = () => {
      const stock = [...r.resources.values()].filter(row => row.type === 'wood').reduce((sum, row) => sum + row.stock, 0);
      const cargo = r.units.filter(row => row.cargoType === 'wood').reduce((sum, row) => sum + row.cargo, 0);
      assert.ok(Math.abs(stock + cargo + r.wood[0] + r.wood[1] - 8450) < 1e-6);
    };
    for (; ticks < 60_000; ticks++) {
      for (const team of [0, 1]) {
        const worker = r.units.find(row => row.id === workers[team]);
        if (worker.gatherNodeId) targets[team].add(worker.gatherNodeId);
        if (firstDepleted[team] === null && r.resources.get(`s${team}-home-wood`).stock === 0) firstDepleted[team] = ticks;
      }
      if (!partialRecovery && firstDepleted.every(value => value !== null)) {
        const saved = r.checkpoint();
        r.restore(structuredClone(saved));
        assert.deepEqual(r.checkpoint().state, saved.state, 'continuation checkpoint restores exactly');
        conserved(); partialRecovery = true;
      }
      if (groveNodes().every(row => row.stock === 0)
        && workers.every(id => { const worker = r.units.find(row => row.id === id); return worker.cargo === 0 && !worker.gatherPhase; })) break;
      r.step();
      if (ticks % 256 === 255) await new Promise(resolve => setImmediate(resolve));
    }
    assert.ok(ticks < 60_000, 'both full opening groves deplete and final cargo returns without another gather order');
    assert.equal(partialRecovery, true);
    for (const team of [0, 1]) {
      assert.deepEqual([...targets[team]].sort(), ['', '-1', '-2'].map(suffix => `s${team}-home-wood${suffix}`));
      assert.ok(Math.abs(r.wood[team] - 1225) < 1e-6, 'exact 975 stock reaches each opening bank');
    }
    conserved();
    const final = r.checkpoint();
    r.restore(structuredClone(final));
    for (let tick = 0; tick < 180; tick++) r.step();
    assert.deepEqual(r.wood, final.state.teamWood, 'depleted recovery never credits twice');
    return { map: map.id, nodes: map.resourceNodes.length, ticks, firstDepleted,
      targets: targets.map(set => [...set]), wood: [...r.wood], defaultHttpWsBothSeats: true,
      fullAuthored975StockPerSeat: true, partialAndDepletedRecovery: true,
      limits: ['Native HTTP/WS admission plus production source-copy fixed ticks; no rendered or deployed acceptance.'] };
  } finally {
    await replayFixture?.dispose(); await fixture.dispose();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  console.log(JSON.stringify({ stage: 'passed', ...await runTerracedValeGroveScenario() }));
