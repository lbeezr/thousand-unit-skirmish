import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';
import { wildlifeControlsFixture, controlsState, visibilityFor } from './wildlife-client-controls-fixture.mjs';

for (const team of [0, 1]) test(`seat ${team}: shared carcass click, remaining Food, idle Worker action and cleanup`, async t => {
  const f = await wildlifeControlsFixture(team); t.after(() => f.close());
  const node = f.map.resourceNodes.find(row => row.id === 'sheep-neutral');
  const packet = (stock = 12.25, wildlifeTeam = 1 - team) => controlsState(f.map, {
    resourceNodes: controlsState(f.map).resourceNodes.map(row => row.id === node.id
      ? { ...row, stock, wildlifeState: stock > 0 ? 'carcass' : 'depleted', wildlifeTeam, wildlifeActivity: undefined }
      : row),
  });
  for (const owner of [null, 0, 1]) {
    f.receive(packet(12.25, owner)); f.click(node, { pointerType: owner === null ? 'touch' : 'mouse' });
    assert.equal(f.w.selectedWildlifeId, node.id);
    assert.equal(f.w.ui.selected.textContent, '1 CARCASS');
    assert.equal(f.w.selectionMesh.count, 1);
    assert.match(f.w.document.querySelector('[data-context-summary]').textContent, /Sheep carcass · 12 food remaining/);
    assert.equal(f.w.ui.commandMode.textContent, 'HARVEST');
    assert.equal(f.w.ui.orderTargetToggle.disabled, true);
    for (const button of f.w.document.querySelectorAll('[data-stationary-order], [data-persistent-order]')) {
      assert.equal(button.hidden, true); assert.equal(button.disabled, true);
    }
    const count = f.sent.length; f.key('s'); f.right({ x: 0, z: 0 });
    assert.equal(f.sent.length, count, 'inspection never grants Herd/Stop');
  }
  const harvest = f.w.document.querySelector('[data-harvest-wildlife]');
  const worker = f.w.teamUnits[team].find(unit => unit.kind === 'worker');
  assert.equal(harvest.hidden, false); assert.equal(harvest.disabled, false);
  harvest.click();
  assert.equal(f.sent.at(-1).type, 'gather'); assert.equal(f.sent.at(-1).nodeId, node.id);
  assert.deepEqual(f.sent.at(-1).ids, [worker.id]);
  assert.deepEqual(f.sent.at(-1).unitGenerations, [worker.generation]);
  assert.equal(f.w.selectedWildlifeId, node.id, 'Worker action preserves carcass inspection');
  const busy = packet(3.5); busy.units = busy.units.map(row => row[0] === worker.id
    ? row.map((value, index) => index === 9 ? 'gathering' : value) : row);
  f.receive(busy);
  assert.match(f.w.document.querySelector('[data-context-summary]').textContent, /3 food remaining/);
  assert.equal(harvest.disabled, true, 'automatic action never steals a busy Worker');
  assert.equal(f.w.document.querySelector('[data-context-proxy="select-workers"]').hidden, false);
  const carrying = packet(); carrying.units = carrying.units.map(row => row[0] === worker.id
    ? row.map((value, index) => index === 6 ? 1 : index === 7 ? 'food' : value) : row);
  f.receive(carrying); assert.equal(harvest.disabled, true, 'idle cargo is not discarded');
  f.receive(packet(0.004));
  assert.match(f.w.document.querySelector('[data-context-summary]').textContent, /<1 food remaining/);
  assert.equal(f.w.selectedWildlifeId, node.id);
  for (const hidden of [packet(0), { ...packet(), resourceNodes: [] },
    { ...packet(), visibility: visibilityFor(f.map, [node]) }, { ...packet(), forestEpoch: 8 }]) {
    f.receive(packet()); f.click(node); f.receive(hidden);
    assert.equal(f.w.selectedWildlifeId, null); assert.equal(harvest.hidden, true);
    const count = f.sent.length; f.w.issueWildlifeHarvest(); assert.equal(f.sent.length, count);
  }
  f.receive(packet()); f.click(node); f.welcome(packet());
  assert.equal(f.w.selectedWildlifeId, null, 'reconnect clears stale selection');
  f.click(node); assert.equal(f.w.selectedWildlifeId, node.id, 'restored disclosed carcass can be picked');
  f.receive(packet(0)); assert.equal(f.w.wildlifeRenderer.isAvailable(node.id), false);
  assert.equal(f.w.selectionMesh.count, 0);
});

test('live selected Sheep becoming a carcass cancels armed Herd and retains inspection', async t => {
  const f = await wildlifeControlsFixture(0); t.after(() => f.close());
  const node = f.map.resourceNodes[0]; f.click(node); f.w.ui.orderTargetToggle.click();
  assert.equal(f.w.tapOrderArmed, true);
  const state = controlsState(f.map); state.resourceNodes[0] = {
    ...state.resourceNodes[0], stock: 99.5, wildlifeState: 'carcass', wildlifeActivity: undefined,
  };
  f.receive(state);
  assert.equal(f.w.selectedWildlifeId, node.id); assert.equal(f.w.tapOrderArmed, false);
  assert.equal(f.w.ui.commandMode.textContent, 'HARVEST');
  assert.equal(f.w.document.querySelector('[data-harvest-wildlife]').hidden, false);
});

for (const team of [0, 1]) test(`seat ${team}: Harvest picks nearest eligible Worker from actual snapshot positions`, async t => {
  const state = controlsState();
  const node = state.resourceNodes.find(row => row.id === 'sheep-neutral');
  Object.assign(node, { stock: 12.25, wildlifeState: 'carcass', wildlifeActivity: undefined });
  const distant = state.units.find(row => row[1] === team && row[5] === 'worker');
  distant[2] = node.x - 7; distant[3] = node.z;
  const nearWorker = [4, team, node.x + 2, node.z, 100, 'worker', 0, null, 19, 'idle'];
  const busyWorker = [5, team, node.x + 1, node.z, 100, 'worker', 0, null, 20, 'gathering'];
  const cargoWorker = [6, team, node.x, node.z + 1, 100, 'worker', 1, 'food', 21, 'idle'];
  state.units.push(nearWorker, busyWorker, cargoWorker);
  const f = await wildlifeControlsFixture(team, { state }); t.after(() => f.close());
  f.w.camera.zoom = 3; f.w.camera.updateProjectionMatrix(); f.click(node);
  assert.equal(f.w.selectedWildlifeId, node.id);
  f.w.document.querySelector('[data-harvest-wildlife]').click();
  assert.deepEqual(f.sent.at(-1).ids, [4], 'closer eligible Worker wins over lower ID and closer busy/carrying Workers');
  assert.deepEqual(f.sent.at(-1).unitGenerations, [19]);
});

test('production carcass checkpoint replays Food exactly and restored client Harvest depletes it', async t => {
  process.env.RTS_MAP = 'maps/open-field.json'; process.env.RTS_GAME_MODE = 'pvp'; process.env.RTS_PREGAME = '0';
  delete process.env.RTS_MATCH_STATE_PATH;
  const map = { ...JSON.parse(readFileSync(new URL('../maps/open-field.json', import.meta.url))),
    id: 'carcass-client-replay', name: 'CARCASS CLIENT REPLAY', width: 32, height: 24,
    fogOfWar: true, startingArmySize: 8, startingResources: { food: 0, wood: 0 },
    spawnPoints: [{ team: 0, x: -10.5, z: -4.5 }, { team: 1, x: 10.5, z: -4.5 }],
    obstacles: [], triggers: [], scenarioEvents: [], resourceNodes: [0, 1].map(team => ({
      id: `sheep-${team}`, type: 'food', stock: 22.5, x: team === 0 ? -8.5 : 8.5, z: -4.5,
      wildlifeSpecies: 'bellweather-sheep',
    })),
  };
  const fixture = await createPathingReplayFixture(map), r = fixture.replay; t.after(() => fixture.dispose());
  const conserved = () => {
    const state = r.checkpoint().state;
    const total = state.resourceNodes.reduce((sum, row) => sum + row.stock, 0)
      + state.teamFood.reduce((sum, food) => sum + food, 0)
      + state.units.filter(unit => unit.cargoType === 'food').reduce((sum, unit) => sum + unit.cargo, 0);
    assert.ok(Math.abs(total - 45) < 1e-8, 'remaining + cargo + banks equals authored Food');
  };
  const stepUntil = (predicate, label) => {
    for (let tick = 0; tick < 3000; tick++) { if (predicate()) return; r.step(); }
    assert.fail(label);
  };
  for (const team of [0, 1]) {
    const worker = r.units.find(unit => unit.team === team && unit.kind === 'worker');
    const node = r.resources.get(`sheep-${team}`);
    r.order(team, { type: 'gather', ids: [worker.id], unitGenerations: [worker.generation], nodeId: node.id });
    stepUntil(() => node.stock < 22.5 && node.stock > 0, 'Worker starts real harvest');
    r.order(team, { type: 'stop', ids: [worker.id], unitGenerations: [worker.generation] });
    r.order(team, { type: 'move', ids: [worker.id], unitGenerations: [worker.generation], x: team === 0 ? -14.5 : 14.5, z: -4.5 });
    stepUntil(() => Math.hypot(worker.x - node.x, worker.z - node.z) > 4
      && r.snapshot(team).units.find(row => row[0] === worker.id)?.[9] === 'idle',
    'gatherer leaves carcass before picking');
  }
  conserved(); const saved = r.checkpoint();
  for (let tick = 0; tick < 60; tick++) r.step();
  const expected = r.checkpoint().state;
  r.restore(structuredClone(saved));
  for (let tick = 0; tick < 60; tick++) r.step();
  assert.deepEqual(r.checkpoint().state, expected, 'exact fixed-tick replay from a partial carcass checkpoint');
  conserved();
  for (const team of [0, 1]) {
    const f = await wildlifeControlsFixture(team, { map, state: r.snapshot(team), onSend: command => r.order(team, command) });
    t.after(() => f.close()); f.w.camera.zoom = 3; f.w.camera.updateProjectionMatrix();
    const node = r.resources.get(`sheep-${team}`); f.click(node);
    assert.equal(f.w.selectedWildlifeId, node.id, 'partial restored carcass is pickable');
    f.w.document.querySelector('[data-harvest-wildlife]').click();
    assert.equal(f.sent.at(-1)?.type, 'gather', 'actual DOM action drives the authoritative Worker');
    stepUntil(() => node.stock === 0, 'client Harvest reaches depletion');
    f.receive(r.snapshot(team));
    assert.equal(f.w.selectedWildlifeId, null); assert.equal(f.w.wildlifeRenderer.isAvailable(node.id), false);
    conserved();
  }
  const depleted = r.checkpoint(); r.restore(structuredClone(depleted));
  for (const node of r.resources.values()) { assert.equal(node.stock, 0); assert.equal(node.wildlifeState, 'depleted'); }
  conserved();
});
