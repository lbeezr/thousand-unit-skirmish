import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';

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
