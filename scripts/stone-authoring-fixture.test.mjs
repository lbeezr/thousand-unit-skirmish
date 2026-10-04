import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { createStoneAuthoringFixture } from './stone-authoring-fixture.mjs';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { previewResourceBrush } from '../src/resource-brush-authoring.mjs';
import { buildElevationGrid, findUnreachableResourceNode } from '../src/map-utils.mjs';
import { townCenterFootprintCells } from '../src/town-center-spawn.mjs';
import { GAMEPLAY_RULESET_REVISION } from '../src/gameplay-definitions.mjs';

test('offline Stone fixture is reproducible, mirrored, finite and separate from the playable map', async () => {
  const fixture = await createStoneAuthoringFixture(), again = await createStoneAuthoringFixture();
  const original = JSON.parse(await readFile(new URL('../maps/open-field.json', import.meta.url), 'utf8'));
  assert.deepEqual(fixture, again);
  assert.deepEqual(JSON.parse(JSON.stringify(fixture)), fixture, 'ordinary JSON carries the proposed node shape');
  assert.equal(fixture.status, 'proposal-not-playable');
  assert.deepEqual(fixture.baseMap, original, 'all existing map fields and food/wood nodes remain intact');
  assert.equal(fixture.candidateNodes.length, 6);
  assert.equal(new Set([...original.resourceNodes, ...fixture.candidateNodes].map(node => node.id)).size, 10);
  for (const team of [0, 1]) {
    const nodes = fixture.candidateNodes.filter(node => node.id.startsWith(`stone-candidate-s${team}-`));
    assert.deepEqual(nodes.map(node => node.stock), [34, 34, 33]);
    assert.equal(nodes.reduce((sum, node) => sum + node.stock, 0), fixture.layout.stockPerSeat);
  }
  for (const node of fixture.candidateNodes.filter(node => node.x < 0)) {
    const opposite = fixture.candidateNodes.find(other => other.id === node.id.replace('-s0-', '-s1-'));
    assert.deepEqual(opposite, { ...node, id: node.id.replace('-s0-', '-s1-'), x: -node.x });
    assert.equal(Math.hypot(node.x - original.spawnPoints[0].x, node.z - original.spawnPoints[0].z),
      Math.hypot(opposite.x - original.spawnPoints[1].x, opposite.z - original.spawnPoints[1].z));
  }
});

test('proposed nodes have open, reachable cells, reserved base space and distinct footprints', async () => {
  const { baseMap: map, candidateNodes: nodes, layout } = await createStoneAuthoringFixture();
  const cell = node => Math.floor(node.z + map.height / 2) * map.width + Math.floor(node.x + map.width / 2);
  const blocked = new Uint8Array(map.width * map.height);
  for (const rect of map.obstacles) for (let row = rect.row; row < rect.row + rect.height; row++) {
    blocked.fill(1, row * map.width + rect.column, row * map.width + rect.column + rect.width);
  }
  for (const team of [0, 1]) for (const index of townCenterFootprintCells(map.spawnPoints, team, map.width, map.height)) blocked[index] = 1;
  const allNodes = [...map.resourceNodes, ...nodes];
  assert.equal(new Set(allNodes.map(cell)).size, allNodes.length);
  for (const node of nodes) {
    assert.equal(node.type, 'stone');
    assert.ok(Number.isSafeInteger(node.stock) && node.stock > 0);
    assert.ok(Math.abs(node.x) < map.width / 2 && Math.abs(node.z) < map.height / 2);
    assert.equal(blocked[cell(node)], 0);
    assert.ok(Math.hypot(Math.abs(node.x) - 12.5, node.z - 10.5) <= layout.radius);
    for (const spawn of map.spawnPoints) assert.ok(Math.max(Math.abs(node.x - spawn.x), Math.abs(node.z - spawn.z)) > layout.spawnClearance);
    for (const other of allNodes) if (other !== node) assert.ok(Math.hypot(node.x - other.x, node.z - other.z) >= 2);
  }
  assert.equal(findUnreachableResourceNode(map.width, map.height, blocked, map.spawnPoints, allNodes,
    buildElevationGrid(map.width, map.height, map.elevationPatches)), null);
});

test('normal authoring and authoritative publication reject Stone nodes and starting banks', async t => {
  const { baseMap, candidateNodes } = await createStoneAuthoringFixture(), source = JSON.stringify(baseMap);
  assert.throws(() => previewResourceBrush(baseMap, { seed: 93000, type: 'stone', x: -12.5, z: 10.5, totalStock: 101 }), /Invalid/);
  assert.equal(JSON.stringify(baseMap), source);
  const room = await createFortifiedFixture({ mapPath: 'maps/open-field.json', timeoutMs: 15000 });
  t.after(() => room.dispose()); await room.start();
  const host = await room.connect(0), peer = await room.connect(1);
  const before = await room.checkpoint();
  const candidates = [
    { ...baseMap, id: 'stone-candidate-nodes', resourceNodes: [...baseMap.resourceNodes, ...candidateNodes] },
    ...[0, 101].map(stock => ({ ...baseMap, id: `stone-candidate-bank-${stock}`, startingResources: { food: 150, wood: 250, stone: stock } })),
  ];
  for (const candidate of candidates) {
    const after = host.messages.length;
    host.send({ type: 'publishMap', map: candidate, persist: true });
    const result = await host.wait(message => message.type === 'mapRejected' || message.type === 'mapPublished', 'proposed Stone admission', after);
    assert.equal(result.type, 'mapRejected');
    assert.match(result.message, /resource node|starting food or wood/);
    assert.equal(host.latest.mapId, baseMap.id); assert.equal(peer.latest.mapId, baseMap.id);
  }
  await room.stop();
  const saved = JSON.parse(await readFile(room.checkpointPath, 'utf8'));
  assert.deepEqual(saved.mapDefinition.resourceNodes, before.mapDefinition.resourceNodes);
  assert.deepEqual(saved.state.teamFood, before.state.teamFood);
  assert.deepEqual(saved.state.teamWood, before.state.teamWood);
  const files = await readdir(path.join(room.directory, 'custom')).catch(error => {
    if (error.code === 'ENOENT') return []; throw error;
  });
  assert.ok(candidates.every(candidate => !files.includes(`${candidate.id}.json`)), 'no proposed map reaches the saved catalog');
});

test('legacy migration conserves fractional banks/cargo and depletion; unsupported Stone saves remain recoverable', async t => {
  const room = await createFortifiedFixture({ mapPath: 'maps/open-field.json', timeoutMs: 15000 });
  t.after(() => room.dispose()); await room.start(); await room.checkpoint(); await room.stop();
  const legacy = JSON.parse(await readFile(room.checkpointPath, 'utf8'));
  legacy.schemaVersion = 11; delete legacy.rulesetRevision; delete legacy.factionId;
  delete legacy.matchModeId; delete legacy.matchModeVersion;
  delete legacy.economyProfileId; delete legacy.state.teamStone;
  legacy.state.teamFood = [137.25, 91.5]; legacy.state.teamWood = [203.75, 44.25];
  legacy.state.resourceNodes[0].stock = 0; legacy.state.resourceNodes[1].stock = 7.25;
  const worker = legacy.state.units.find(unit => unit.kind === 'worker');
  assert.ok(worker); worker.cargo = 3.125; worker.cargoType = 'food'; worker.gatherPhase = '';
  await writeFile(room.checkpointPath, JSON.stringify(legacy)); await room.start(); await room.stop();
  const migrated = JSON.parse(await readFile(room.checkpointPath, 'utf8'));
  assert.equal(migrated.matchId, legacy.matchId); assert.equal(migrated.rulesetRevision, GAMEPLAY_RULESET_REVISION);
  assert.deepEqual(migrated.state.teamFood, legacy.state.teamFood); assert.deepEqual(migrated.state.teamWood, legacy.state.teamWood);
  assert.deepEqual(migrated.state.resourceNodes, legacy.state.resourceNodes, 'migration never replenishes depleted or partial stocks');
  const recoveredWorker = migrated.state.units.find(unit => unit.id === worker.id);
  assert.equal(recoveredWorker.cargo, worker.cargo); assert.equal(recoveredWorker.cargoType, worker.cargoType);
  assert.deepEqual(migrated.state.teamStone, [0, 0], 'legacy migration creates no mineral grant');

  const { candidateNodes } = await createStoneAuthoringFixture();
  const stoneMap = structuredClone(migrated);
  stoneMap.mapDefinition.resourceNodes.push(...candidateNodes); stoneMap.state.resourceNodes.push(...candidateNodes);
  const stoneCargo = structuredClone(migrated);
  stoneCargo.state.units.find(unit => unit.id === worker.id).cargoType = 'stone';
  const futurePin = structuredClone(migrated);
  futurePin.rulesetRevision = `v1:${'0'.repeat(64)}`; futurePin.state.teamStone = [7.25, 13.5];
  for (const unsupported of [stoneMap, stoneCargo, futurePin]) {
    const source = JSON.stringify(unsupported);
    await writeFile(room.checkpointPath, source); await room.start(); await room.stop();
    const fallback = JSON.parse(await readFile(room.checkpointPath, 'utf8'));
    assert.notEqual(fallback.matchId, migrated.matchId, 'unsupported mineral state cannot resume under food/wood rules');
    const rejected = (await readdir(room.directory)).filter(name => name.startsWith('match.json.rejected-'));
    assert.ok((await Promise.all(rejected.map(name => readFile(path.join(room.directory, name), 'utf8')))).includes(source),
      'each rejected save is preserved byte-for-byte for a compatible future loader');
  }
});
