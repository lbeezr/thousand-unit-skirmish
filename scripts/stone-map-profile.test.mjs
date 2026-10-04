import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import { DEFAULT_ECONOMY_PROFILE_ID, STONE_ECONOMY_PROFILE_ID, STONE_TUNING_PROPOSAL,
  economyResources, economyRulesetRevision } from '../src/economy-profile.mjs';
import { GAMEPLAY_DEFINITIONS, GAMEPLAY_RULESET_REVISION } from '../src/gameplay-definitions.mjs';
import { seededMirroredResourceClusters, appendSeededResourceCluster } from '../src/resource-cluster-authoring.mjs';
import { applyResourceBrush, createResourceBrushEditor, previewResourceBrush,
  resourceBrushMapKey } from '../src/resource-brush-authoring.mjs';
import { mountResourceBrushControls } from '../src/resource-brush-controls.mjs';
import { createRoomLobby } from '../src/room-lobby-ui.mjs';
import { createStoneAuthoringFixture } from './stone-authoring-fixture.mjs';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import * as mapUtils from '../src/map-utils.mjs';
import * as scenarioRegions from '../src/scenario-regions.mjs';
import { validateMapRegion } from '../src/regions.mjs';
import { validateMapAudioReference } from '../src/audio-event-profile.mjs';
import { findInvalidResourceVariant } from '../src/shore-fishing.mjs';
import { TERRAIN_MATERIALS } from '../src/terrain-materials.mjs';
import { validWildlifeNodeDefinition } from '../src/wildlife-state.mjs';

test('typed offline Stone placement preserves historical geometry and splits the agreed 200 budget', async () => {
  const historical = await createStoneAuthoringFixture(), before = JSON.stringify(historical.baseMap);
  const map = { ...historical.baseMap, economyProfileId: STONE_ECONOMY_PROFILE_ID };
  const settings = { seed: historical.layout.seed, nodesPerPatch: 3, radius: 4, spawnClearance: 6,
    patches: [{ type: 'stone', x: -12.5, z: 10.5, stock: STONE_TUNING_PROPOSAL.stockPerSeat }] };
  const materialize = () => seededMirroredResourceClusters(map, settings).map(node => ({ ...node, id: `stone-candidate-${node.id}` }));
  const nodes = materialize(); assert.deepEqual(materialize(), nodes);
  assert.deepEqual(nodes.map(({ stock, ...node }) => node), historical.candidateNodes.map(({ stock, ...node }) => node));
  for (const team of [0, 1]) assert.deepEqual(nodes.filter(node => node.id.startsWith(`stone-candidate-s${team}-`)).map(node => node.stock), [67, 67, 66]);
  assert.throws(() => seededMirroredResourceClusters(historical.baseMap, settings), /Invalid/);
  assert.equal(JSON.stringify(historical.baseMap), before);
  assert.deepEqual((await createStoneAuthoringFixture()).candidateNodes, historical.candidateNodes);
});

test('additive Stone schema requires the exact profile and preserves existing food/wood stock', async () => {
  const { baseMap } = await createStoneAuthoringFixture(), before = JSON.stringify(baseMap);
  const map = { ...baseMap, economyProfileId: STONE_ECONOMY_PROFILE_ID };
  const options = { seed: 93000, type: 'stone', x: -12.5, z: 10.5, nodesPerPatch: 3, totalStock: 200 };
  const nodes = appendSeededResourceCluster(map, options), added = nodes.slice(baseMap.resourceNodes.length);
  assert.deepEqual(nodes.slice(0, baseMap.resourceNodes.length), baseMap.resourceNodes);
  assert.deepEqual(added.map(node => node.stock), [67, 67, 66]);
  assert.ok(added.every(node => node.type === 'stone'));
  assert.equal(new Set(nodes.map(node => node.id)).size, nodes.length);
  assert.throws(() => appendSeededResourceCluster(baseMap, options), /Invalid/);
  for (const economyProfileId of [null, '', 'unknown']) {
    assert.throws(() => appendSeededResourceCluster({ ...baseMap, economyProfileId }, { ...options, type: 'food' }), /Unsupported economy profile/);
  }
  const existingStone = { ...baseMap, resourceNodes: nodes };
  assert.throws(() => appendSeededResourceCluster(existingStone, { ...options, type: 'food', x: 12.5 }), /existing resource/);
  assert.throws(() => appendSeededResourceCluster(map, { ...options, type: 'gold' }), /Invalid/);
  assert.equal(JSON.stringify(baseMap), before);
});

test('profile changes invalidate Stone brush previews and history without changing legacy fingerprints', async () => {
  const { baseMap } = await createStoneAuthoringFixture();
  const legacyKey = JSON.stringify([baseMap.id, baseMap.width, baseMap.height, baseMap.terrainBase,
    baseMap.terrainPatches ?? [], baseMap.elevationPatches ?? [], baseMap.obstacles,
    baseMap.spawnPoints, baseMap.resourceNodes ?? []]);
  assert.equal(resourceBrushMapKey(baseMap), legacyKey);
  assert.equal(resourceBrushMapKey({ ...baseMap, economyProfileId: DEFAULT_ECONOMY_PROFILE_ID }), legacyKey);
  const map = structuredClone({ ...baseMap, economyProfileId: STONE_ECONOMY_PROFILE_ID });
  const options = { seed: 93000, type: 'stone', x: -12.5, z: 10.5, nodesPerPatch: 3, totalStock: 200 };
  const preview = previewResourceBrush(map, options);
  map.economyProfileId = DEFAULT_ECONOMY_PROFILE_ID;
  const before = JSON.stringify(map);
  assert.throws(() => applyResourceBrush(map, preview), /stale or unknown/);
  assert.equal(JSON.stringify(map), before);
  map.economyProfileId = STONE_ECONOMY_PROFILE_ID;
  let selectedId = null, writes = 0;
  const editor = createResourceBrushEditor({ readMap: () => map, readSelectedId: () => selectedId,
    commit: state => { map.resourceNodes = state.resourceNodes; selectedId = state.selectedResourceId; writes += 1; } });
  editor.apply(editor.preview(options));
  assert.equal(editor.canUndo, true);
  map.economyProfileId = DEFAULT_ECONOMY_PROFILE_ID;
  assert.equal(editor.canUndo, false);
  assert.throws(() => editor.undo(), /outside this history/);
  assert.equal(writes, 1);
  map.economyProfileId = STONE_ECONOMY_PROFILE_ID;
  assert.equal(editor.undo(), true);
  assert.equal(editor.canRedo, true);
  const pending = editor.preview(options);
  delete map.economyProfileId;
  const restored = JSON.stringify(map);
  assert.equal(editor.canRedo, false);
  assert.throws(() => editor.redo(), /outside this history/);
  assert.throws(() => editor.apply(pending), /outside this history/);
  assert.equal(writes, 2);
  assert.equal(JSON.stringify(map), restored);
});

test('Stone patch controls follow the loaded profile and clear pending receipts when it changes', async t => {
  const dom = new JSDOM('<section></section>'); t.after(() => dom.window.close());
  const { baseMap } = await createStoneAuthoringFixture();
  const map = structuredClone(baseMap), host = dom.window.document.querySelector('section');
  let writes = 0;
  const controls = mountResourceBrushControls({ host, readMap: () => map,
    commit: state => { map.resourceNodes = state.resourceNodes; writes++; }, redraw() {}, onCommitted() {} });
  const field = name => host.querySelector(`#studio-brush-${name}`);
  const button = name => host.querySelector(`[data-brush="${name}"]`);
  assert.deepEqual([...field('type').options].map(option => option.value), ['food', 'wood']);
  map.economyProfileId = STONE_ECONOMY_PROFILE_ID; controls.sync();
  assert.deepEqual([...field('type').options].map(option => option.value), ['food', 'wood', 'stone']);
  for (const [name, value] of Object.entries({ type: 'stone', count: 3, stock: 200, column: 20, row: 43 })) field(name).value = value;
  button('preview').click(); assert.equal(button('apply').disabled, false);
  button('apply').click(); assert.equal(writes, 1);
  assert.deepEqual(map.resourceNodes.slice(-3).map(node => [node.type, node.stock]), [['stone', 67], ['stone', 67], ['stone', 66]]);
  button('undo').click(); assert.equal(writes, 2); assert.deepEqual(map.resourceNodes, baseMap.resourceNodes);
  button('preview').click(); map.economyProfileId = DEFAULT_ECONOMY_PROFILE_ID; controls.sync();
  assert.equal(field('type').value, 'food'); assert.equal(field('type').options.length, 2);
  assert.equal(button('apply').disabled, true); assert.equal(button('redo').disabled, true);
  button('apply').click(); assert.equal(writes, 2);
});

test('actual client importer admits Stone only under the exact profile and preserves baseline selectors', async () => {
  const source = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
  const importer = source.slice(source.indexOf('function validateImportedMap('), source.indexOf('\nasync function importEditorMap('));
  const constants = Object.fromEntries([...source.matchAll(/^const (MAX_[A-Z_]+|MIN_[A-Z_]+) = (\d+);/gm)].map(match => [match[1], Number(match[2])]));
  const context = vm.createContext({ ...mapUtils, ...scenarioRegions, ...constants, MAX_PER_TEAM: 1000,
    validateMapRegion, validateMapAudioReference, findInvalidResourceVariant, validWildlifeNodeDefinition, TERRAIN_MATERIALS,
    economyResources, EDITOR_MATERIALS: ['stone', 'forest', 'water'],
    UNIT_DEFINITIONS: GAMEPLAY_DEFINITIONS.units, TECHNOLOGY_DEFINITIONS: GAMEPLAY_DEFINITIONS.technologies });
  vm.runInContext(importer, context);
  const { baseMap } = await createStoneAuthoringFixture(), before = JSON.stringify(baseMap);
  const omitted = context.validateImportedMap(baseMap);
  assert.equal(Object.hasOwn(omitted, 'economyProfileId'), false, 'omission stays absent for legacy map checksums');
  assert.equal(context.validateImportedMap({ ...baseMap, economyProfileId: DEFAULT_ECONOMY_PROFILE_ID }).economyProfileId, DEFAULT_ECONOMY_PROFILE_ID);
  const stone = { ...baseMap, economyProfileId: STONE_ECONOMY_PROFILE_ID,
    resourceNodes: [...baseMap.resourceNodes, { id: 'stone-import', type: 'stone', x: -12.5, z: 10.5, stock: 200 }] };
  assert.deepEqual(JSON.parse(JSON.stringify(context.validateImportedMap(stone))).resourceNodes, stone.resourceNodes);
  assert.throws(() => context.validateImportedMap({ ...stone, economyProfileId: DEFAULT_ECONOMY_PROFILE_ID }), /unsupported resource/);
  assert.throws(() => context.validateImportedMap({ ...stone, economyProfileId: undefined }), /unsupported resource/);
  for (const economyProfileId of [null, '', 'unknown']) assert.throws(() => context.validateImportedMap({ ...baseMap, economyProfileId }), /Unsupported economy profile/);
  assert.equal(JSON.stringify(baseMap), before);
});

test('native host rejects Stone nodes without the profile and admits explicit baseline', async t => {
  const room = await createFortifiedFixture({ mapPath: 'maps/open-field.json', timeoutMs: 15000 });
  t.after(() => room.dispose()); await room.start();
  const host = await room.connect(0), peer = await room.connect(1), { baseMap } = await createStoneAuthoringFixture();
  const before = await room.checkpoint();
  for (const [index, economyProfileId] of [undefined, DEFAULT_ECONOMY_PROFILE_ID, null, '', 'unknown'].entries()) {
    const map = { ...baseMap, id: `profile-selection-${index}`, economyProfileId,
      resourceNodes: [...baseMap.resourceNodes, { id: 'stone-rejected', type: 'stone', x: -12.5, z: 10.5, stock: 200 }] }, after = host.messages.length;
    host.send({ type: 'publishMap', map, persist: true });
    const result = await host.wait(message => message.type === 'mapRejected' || message.type === 'mapPublished', 'profile admission', after);
    assert.equal(result.type, 'mapRejected'); assert.match(result.message, /invalid or duplicate resource node|Unsupported economy profile/);
    assert.equal(host.latest.mapId, baseMap.id); assert.equal(peer.latest.mapId, baseMap.id);
    assert.equal(host.latest.rulesetRevision, GAMEPLAY_RULESET_REVISION);
  }
  for (const module of ['economy-profile.mjs', 'economy-ledger.mjs']) assert.equal((await fetch(`http://127.0.0.1:${room.port}/src/${module}`)).status, 200);
  await room.stop();
  const saved = JSON.parse(await readFile(room.checkpointPath, 'utf8'));
  assert.deepEqual(saved.state.teamFood, before.state.teamFood); assert.deepEqual(saved.state.teamWood, before.state.teamWood);
  assert.deepEqual(saved.mapDefinition.resourceNodes, before.mapDefinition.resourceNodes);
  const files = await readdir(path.join(room.directory, 'custom')).catch(error => { if (error.code === 'ENOENT') return []; throw error; });
  assert.ok(files.every(file => !file.startsWith('profile-selection-')));
  await room.start(); const resumed = await room.connect(0, host.welcome.player.sessionToken);
  const after = resumed.messages.length, map = { ...baseMap, id: 'explicit-baseline-profile', economyProfileId: DEFAULT_ECONOMY_PROFILE_ID };
  resumed.send({ type: 'publishMap', map, persist: true });
  const result = await resumed.wait(message => message.type === 'mapPublished' || message.type === 'mapRejected', 'explicit baseline admission', after);
  assert.equal(result.type, 'mapPublished', result.message);
  const baseline = JSON.parse(await readFile(path.join(room.directory, 'custom', `${map.id}.json`), 'utf8'));
  assert.equal(baseline.economyProfileId, DEFAULT_ECONOMY_PROFILE_ID); assert.deepEqual(baseline.resourceNodes, baseMap.resourceNodes);
});

test('a profile-mislabelled checkpoint with valid baseline pin/checksum is rejected and retained byte-exact', async t => {
  const room = await createFortifiedFixture({ mapPath: 'maps/open-field.json', timeoutMs: 15000 });
  t.after(() => room.dispose()); await room.start(); await room.checkpoint(); await room.stop();
  const saved = JSON.parse(await readFile(room.checkpointPath, 'utf8'));
  saved.mapDefinition.id = 'profile-checkpoint-proof'; saved.mapDefinition.economyProfileId = STONE_ECONOMY_PROFILE_ID;
  saved.mapHash = createHash('sha256').update(JSON.stringify(saved.mapDefinition)).digest('base64url');
  assert.equal(saved.rulesetRevision, GAMEPLAY_RULESET_REVISION);
  const original = JSON.stringify(saved);
  await writeFile(room.checkpointPath, original); await room.start(); await room.stop();
  const fallback = JSON.parse(await readFile(room.checkpointPath, 'utf8'));
  assert.notEqual(fallback.matchId, saved.matchId);
  const rejected = (await readdir(room.directory)).filter(name => name.startsWith('match.json.rejected-'));
  assert.ok((await Promise.all(rejected.map(name => readFile(path.join(room.directory, name), 'utf8')))).includes(original));
});

test('ordinary room lobby selects shipped Stone and both seats naturally pay, refund and recover conservation', async t => {
  const fixture = await createFortifiedFixture({ supervisor: true, mapPath: null, timeoutMs: 90000 });
  t.after(() => fixture.dispose()); await fixture.start();
  const response = await fetch(`http://127.0.0.1:${fixture.port}/api/rooms`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'pvp', pregame: true }),
  });
  assert.equal(response.status, 201);
  const { roomId } = await response.json();
  const checkpointPath = path.join(fixture.directory, 'rooms', 'rooms', roomId, 'match-state.json');
  const room = { ...fixture, checkpointPath,
    checkpoint: predicate => fixture.checkpoint(predicate, checkpointPath),
    connect: (team, token) => fixture.connect(team, token, roomId) };
  let clients = [await room.connect(0), await room.connect(1)];
  const tokens = clients.map(client => client.welcome.player.sessionToken);
  const { baseMap } = await createStoneAuthoringFixture();
  const map = JSON.parse(await readFile(new URL('../maps/stone-defense-field.json', import.meta.url), 'utf8'));
  const nodes = map.resourceNodes.filter(node => node.type === 'stone');
  assert.equal(map.economyProfileId, STONE_ECONOMY_PROFILE_ID);
  const lobbyViews = clients.map(client => {
    const dom = new JSDOM('<dialog></dialog>'); t.after(() => dom.window.close());
    const root = dom.window.document.querySelector('dialog');
    root.showModal = () => { root.open = true; }; root.close = () => { root.open = false; };
    const ui = createRoomLobby({ root, send: command => { client.send(command); return true; }, copyInvite() {} });
    return { dom, root, ui };
  });
  const updateLobby = lobby => lobbyViews.forEach((view, team) => view.ui.update(lobby, clients[team].welcome.player));
  const joined = await clients[0].wait(message => message.type === 'lobby' && message.lobby.seats.length === 2);
  updateLobby(joined.lobby);
  const select = lobbyViews[0].root.querySelector('#lobby-map');
  assert.equal(select.disabled, false);
  assert.equal([...select.options].find(option => option.value === map.id)?.textContent, 'Lab · STONE DEFENSE FIELD');
  select.value = map.id; select.dispatchEvent(new lobbyViews[0].dom.window.Event('change'));
  await Promise.all(clients.map(client => client.wait(message => message.type === 'mapChange' && message.map.id === map.id)));
  const configured = await clients[0].wait(message => message.type === 'lobby' && message.lobby.mapId === map.id);
  assert.equal(configured.lobby.armySize, 24); updateLobby(configured.lobby);
  for (const [team, client] of clients.entries()) {
    const after = client.messages.length;
    lobbyViews[team].root.querySelector('#lobby-ready').click();
    const ready = await client.wait(message => message.type === 'lobby'
      && message.lobby.seats.some(seat => seat.id === client.welcome.player.id && seat.ready), 'ordinary Ready', after);
    updateLobby(ready.lobby);
  }
  assert.equal(lobbyViews[0].root.querySelector('#lobby-launch').disabled, false);
  lobbyViews[0].root.querySelector('#lobby-launch').click();
  const launched = await clients[0].wait(message => message.type === 'lobby' && message.lobby.phase === 'running');
  updateLobby(launched.lobby);
  assert.ok(lobbyViews.every(view => !view.root.open));
  assert.ok(clients.every(client => !client.messages.some(message => message.type === 'mapPublished')));
  assert.ok(!(await readdir(path.join(path.dirname(checkpointPath), 'custom-maps'))).includes(`${map.id}.json`));
  const workers = clients.map((client, team) => client.latest.units.filter(row => row[1] === team && row[5] === 'worker').map(row => row[0]));
  const ownNodes = team => nodes.filter(node => node.id.startsWith(`stone-candidate-s${team}-`));
  const spent = [0, 0];
  function conserved(snapshot) {
    assert.deepEqual(snapshot.mapDefinition.resourceNodes, map.resourceNodes);
    assert.deepEqual(snapshot.state.resourceNodes.filter(node => node.type !== 'stone'), baseMap.resourceNodes);
    for (const team of [0, 1]) {
      const stock = snapshot.state.resourceNodes.filter(node => ownNodes(team).some(own => own.id === node.id)).reduce((sum, node) => sum + node.stock, 0);
      const cargo = snapshot.state.units.filter(unit => unit.team === team && unit.cargoType === 'stone').reduce((sum, unit) => sum + unit.cargo, 0);
      const paid = 50 * snapshot.state.buildings.filter(building => building.team === team && building.type === 'watchtower').length;
      assert.ok(Math.abs(stock + cargo + snapshot.state.teamStone[team] + paid + spent[team] - 200) < 1e-7);
    }
  }
  for (const [team, client] of clients.entries()) {
    assert.equal(client.latest.rulesetRevision, economyRulesetRevision(STONE_ECONOMY_PROFILE_ID));
    assert.deepEqual(client.latest.stone, team === 0 ? [0, null] : [null, 0]);
    await client.command({ type: 'build', buildingType: 'watchtower', ids: [workers[team][0]], x: (team ? 1 : -1) * 10.5, z: -12.5 }, /NEED .*50 STONE/);
    await client.command({ type: 'gather', ids: workers[team], nodeId: ownNodes(team)[0].id }, /GATHER ORDER/);
  }
  const carrying = await room.checkpoint(snapshot => workers.every(ids => ids.some(id => snapshot.state.units[id].cargoType === 'stone' && snapshot.state.units[id].cargo > 0)));
  conserved(carrying);
  for (const [team, client] of clients.entries()) await client.command({ type: 'stop', ids: workers[team] }, /STOP ORDER/);
  await room.stop(); const retainedCargo = JSON.parse(await readFile(room.checkpointPath, 'utf8')); conserved(retainedCargo);
  await room.start(); clients = [await room.connect(0, tokens[0]), await room.connect(1, tokens[1])];
  const resumedCargo = await room.checkpoint(snapshot => snapshot.sequence > retainedCargo.sequence); conserved(resumedCargo);
  assert.equal(resumedCargo.matchId, retainedCargo.matchId);
  assert.deepEqual(resumedCargo.state.units.map(unit => [unit.cargo, unit.cargoType]), retainedCargo.state.units.map(unit => [unit.cargo, unit.cargoType]));
  for (const [team, client] of clients.entries()) await client.command({ type: 'returnCargo', ids: workers[team] }, /RETURN CARGO/);
  await room.checkpoint(snapshot => snapshot.state.units.every(unit => unit.cargo === 0));
  for (const [team, client] of clients.entries()) await client.command({ type: 'gather', ids: workers[team], nodeId: ownNodes(team)[0].id }, /GATHER ORDER/);
  await room.checkpoint(snapshot => ownNodes(0).concat(ownNodes(1)).filter(node => node.id === ownNodes(0)[0].id || node.id === ownNodes(1)[0].id)
    .every(node => snapshot.state.resourceNodes.find(saved => saved.id === node.id).stock === 0) && snapshot.state.units.every(unit => unit.cargo === 0));
  for (const [team, client] of clients.entries()) await client.command({ type: 'stop', ids: workers[team] }, /STOP ORDER/);
  const banked = await room.checkpoint(snapshot => snapshot.state.teamStone.every(value => Math.abs(value - 67) < 1e-7)); conserved(banked);
  assert.deepEqual(banked.state.teamFood, [300, 300]); assert.deepEqual(banked.state.teamWood, [600, 600]);
  for (const [team, client] of clients.entries()) {
    await client.command({ type: 'build', buildingType: 'watchtower', ids: [workers[team][0]], x: (team ? 1 : -1) * 10.5, z: -12.5 }, /WATCHTOWER/);
    await client.state(state => state.buildings.some(building => building.team === team && !building.complete && building.progress > 0.03), 'naturally paid Stone defense');
    await client.command({ type: 'stop', ids: [workers[team][0]] }, /STOP ORDER/);
  }
  await room.stop(); const paid = JSON.parse(await readFile(room.checkpointPath, 'utf8')); conserved(paid);
  assert.deepEqual(paid.state.teamFood, [250, 250]); assert.deepEqual(paid.state.teamWood, [450, 450]);
  assert.ok(paid.state.teamStone.every(value => Math.abs(value - 17) < 1e-7));
  await room.start(); clients = [await room.connect(0, tokens[0]), await room.connect(1, tokens[1])];
  const recovered = await room.checkpoint(snapshot => snapshot.sequence > paid.sequence); conserved(recovered);
  assert.equal(recovered.matchId, paid.matchId); assert.equal(recovered.schemaVersion, 29);
  for (const key of ['teamFood', 'teamWood', 'teamStone', 'resourceNodes', 'buildings']) assert.deepEqual(recovered.state[key], paid.state[key]);
  for (const [team, client] of clients.entries()) {
    assert.ok(client.welcome.recoveredFromCheckpoint);
    const tower = paid.state.buildings.find(building => building.team === team);
    await clients[1 - team].command({ type: 'cancelConstruction', buildingId: tower.id }, /CANCEL REJECTED/);
    await client.command({ type: 'cancelConstruction', buildingId: tower.id }, /CONSTRUCTION CANCELLED.*STONE/);
    spent[team] = 50 - Math.round(50 * (1 - tower.progress) * 1e6) / 1e6;
    const refundBank = await client.state(state => !state.buildings.some(building => building.id === tower.id), 'Stone refund');
    assert.ok(Math.abs(refundBank.stone[team] - (67 - spent[team])) < 1e-7);
    await client.command({ type: 'cancelConstruction', buildingId: tower.id }, /CANCEL REJECTED/);
    assert.equal(client.latest.stone[team], refundBank.stone[team]);
  }
  const canceled = await room.checkpoint(snapshot => snapshot.state.buildings.length === 0); conserved(canceled);
  for (const team of [0, 1]) {
    const tower = paid.state.buildings.find(building => building.team === team);
    for (const [bank, cost] of [['teamFood', 50], ['teamWood', 150], ['teamStone', 50]]) {
      const refund = Math.round(cost * (1 - tower.progress) * 1e6) / 1e6;
      assert.ok(Math.abs(canceled.state[bank][team] - paid.state[bank][team] - refund) < 1e-8);
    }
  }
  for (const index of [1, 2]) {
    for (const [team, client] of clients.entries()) await client.command({ type: 'gather', ids: workers[team], nodeId: ownNodes(team)[index].id }, /GATHER ORDER/);
    await room.checkpoint(snapshot => [0, 1].every(team => snapshot.state.resourceNodes.find(node => node.id === ownNodes(team)[index].id).stock === 0)
      && snapshot.state.units.every(unit => unit.cargo === 0));
  }
  for (const [team, client] of clients.entries()) {
    await client.command({ type: 'stop', ids: workers[team] }, /STOP ORDER/);
    await client.command({ type: 'gather', ids: workers[team], nodeId: ownNodes(team)[2].id }, /RESOURCE NODE EMPTY/);
  }
  await room.stop(); const depleted = JSON.parse(await readFile(room.checkpointPath, 'utf8')); conserved(depleted);
  assert.ok(depleted.state.resourceNodes.filter(node => node.type === 'stone').every(node => node.stock === 0));
  for (const team of [0, 1]) assert.ok(Math.abs(depleted.state.teamStone[team] - (200 - spent[team])) < 1e-7);
  await room.start(); clients = [await room.connect(0, tokens[0]), await room.connect(1, tokens[1])];
  const recoveredDepletion = await room.checkpoint(snapshot => snapshot.sequence > depleted.sequence); conserved(recoveredDepletion);
  assert.deepEqual(recoveredDepletion.state.teamStone, depleted.state.teamStone);
  assert.deepEqual(recoveredDepletion.state.resourceNodes, depleted.state.resourceNodes);
  for (const [team, client] of clients.entries()) {
    await client.command({ type: 'build', buildingType: 'watchtower', ids: [workers[team][0]],
      x: (team ? 1 : -1) * 10.5, z: -12.5 }, /WATCHTOWER/);
  }
  const completed = await room.checkpoint(snapshot => snapshot.state.buildings.length === 2
    && snapshot.state.buildings.every(building => building.type === 'watchtower' && building.complete));
  conserved(completed);
  for (const team of [0, 1]) assert.ok(Math.abs(completed.state.teamStone[team] - (150 - spent[team])) < 1e-7);
  await room.stop(); await room.start(); clients = [await room.connect(0, tokens[0]), await room.connect(1, tokens[1])];
  const final = await room.checkpoint(snapshot => snapshot.sequence > completed.sequence); conserved(final);
  assert.equal(final.matchId, depleted.matchId); assert.deepEqual(final.state.teamStone, completed.state.teamStone);
  assert.deepEqual(final.state.resourceNodes, completed.state.resourceNodes);
  // Simulation resumes before the next checkpoint; its combat timer may tick.
  const structuralDefense = ({ attackCooldown, ...building }) => building;
  assert.deepEqual(final.state.buildings.map(structuralDefense), completed.state.buildings.map(structuralDefense));
  assert.ok(final.state.buildings.every(building => Number.isFinite(building.attackCooldown)
    && building.attackCooldown >= 0 && building.attackCooldown <= GAMEPLAY_DEFINITIONS.buildings.watchtower.combat.period));
  console.log(JSON.stringify({ proof: 'native-two-seat-stone-loop', mapId: map.id,
    entry: 'Create Room → Map → Lab · STONE DEFENSE FIELD → Ready → Launch match',
    shippedCatalog: true, customMapPublished: false, schemaVersion: final.schemaVersion,
    rulesetRevision: final.rulesetRevision, stockPerSeat: 200, initialStone: 0,
    bankedBeforeDefense: banked.state.teamStone, paidStone: paid.state.teamStone,
    consumedConstruction: spent, finalStone: final.state.teamStone,
    completedWatchtowers: final.state.buildings.map(building => ({ team: building.team, complete: building.complete })),
    naturalCargoRecovered: true, injectedEconomyState: false }));
});
