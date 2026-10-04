import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';
import { wildlifeControlsFixture } from './wildlife-client-controls-fixture.mjs';
import { TERRACED_VALE_SHEEP_IDS, TERRACED_VALE_PRE_SHEEP_MAP_HASH } from '../src/terraced-vale-sheep.mjs';

// Ordinary default HTTP/WS entry and production input bodies, followed by bounded
// fixed ticks for full 650-food pools. No position, food stock or bank is injected.
const canonical = JSON.parse(await readFile(new URL('../maps/veyrholds-terraced-vale.json', import.meta.url)));
const hashMap = map => createHash('sha256').update(JSON.stringify(map)).digest('base64url');
const serverHash = async () => createHash('sha256').update(await readFile(new URL('../server.mjs', import.meta.url))).digest('hex');
const serverSha256 = await serverHash();
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const homeIds = [0, 1].map(team => `s${team}-home-food`), EPSILON = 1e-6;
const originalFood = canonical.resourceNodes.filter(node => node.type === 'food').reduce((sum, node) => sum + node.stock, 0);
assert.equal(originalFood, 6100);
assert.equal(canonical.resourceNodes.filter(node => node.wildlifeSpecies !== undefined).length, 4);
const fixture = await createFortifiedFixture({ mapPath: null, timeoutMs: 35_000 });
let clients = [], nextToken = 1000, phase = 'default opening', replayFixture, legacyFixture;
const controls = [], bridges = [];
const node = (saved, id) => saved.state.resourceNodes.find(row => row.id === id);
const unit = (saved, id) => saved.state.units.find(row => row.id === id);
const point = row => ({ x: row.x, z: row.z });
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const frozen = row => ({ ...point(row), wildlifeState: row.wildlifeState, wildlifeTeam: row.wildlifeTeam,
  stock: row.stock, wildlifeHerd: structuredClone(row.wildlifeHerd), wildlifeGrazeAnchor: { ...row.wildlifeGrazeAnchor },
  wildlifeMotion: structuredClone(row.wildlifeMotion) });
const command = (team, value, pattern) => clients[team].command({ ...value, clientOrderToken: nextToken++ }, pattern);
const emit = (stage, detail = {}) => console.log(JSON.stringify({ stage, ...detail }));
function conserved(saved) {
  assert.deepEqual(saved.state.resourceNodes.map(row => row.id).sort(), canonical.resourceNodes.map(row => row.id).sort());
  const stock = saved.state.resourceNodes.filter(row => row.type === 'food').reduce((sum, row) => sum + row.stock, 0);
  const bank = saved.state.teamFood.reduce((sum, value) => sum + value, 0);
  const cargo = saved.state.units.filter(row => row.cargoType === 'food').reduce((sum, row) => sum + row.cargo, 0);
  assert.ok(Math.abs(stock + bank + cargo - 6400) < EPSILON, '6100 map food + 300 opening banks stays conserved');
  assert.deepEqual(saved.state.teamWood, [250, 250]);
  assert.equal(saved.state.buildings.length, 0);
}
function assertPublic(state) {
  for (const row of state.resourceNodes.filter(row => row.wildlifeSpecies !== undefined)) {
    assert.ok(TERRACED_VALE_SHEEP_IDS.includes(row.id));
    assert.equal(row.wildlifeSpecies, 'bellweather-sheep');
    assert.ok(Number.isFinite(row.x) && Number.isFinite(row.z) && Number.isFinite(row.wildlifeHeading));
    for (const key of ['wildlifeHerd', 'wildlifeGrazeAnchor', 'wildlifeMotion', 'team']) assert.equal(Object.hasOwn(row, key), false);
  }
}
async function move(team, id, destination) {
  await command(team, { type: 'move', ids: [id], ...destination }, /MOVE ORDER/);
  return clients[team].state(state => {
    const row = state.units.find(row => row[0] === id);
    return row && Math.hypot(row[2] - destination.x, row[3] - destination.z) < .8;
  }, 'ordinary Worker reaches claim/observer site');
}
async function restart() {
  const sessions = clients.map(client => client.welcome.player.sessionToken);
  const matchId = clients[0].welcome.matchId;
  await fixture.stop();
  const saved = JSON.parse(await readFile(fixture.checkpointPath, 'utf8'));
  conserved(saved);
  await fixture.start();
  clients = [await fixture.connect(0, sessions[0]), await fixture.connect(1, sessions[1])];
  assert.ok(clients.every(client => client.welcome.recoveredFromCheckpoint && client.welcome.matchId === matchId));
  const recovered = await fixture.checkpoint(row => row.sequence > saved.sequence);
  conserved(recovered);
  return { saved, recovered };
}
async function until(r, predicate, description, limit = 30_000) {
  for (let ticks = 0; ticks < limit; ticks++) {
    if (predicate()) return ticks;
    r.step();
    // Keep the harness event loop responsive in bounded batches while advancing
    // the unchanged production simulation with its ordinary fixed step.
    if (ticks % 256 === 255) await new Promise(resolve => setImmediate(resolve));
  }
  assert.ok(predicate(), `${description} within ${limit} real fixed ticks`);
}
function replayOrder(r, team, type, ids, extra = {}) {
  const units = ids.map(id => r.units.find(row => row.id === id));
  const notices = r.order(team, { type, ids, unitGenerations: units.map(row => row.generation), ...extra });
  r.drain();
  const pattern = type === 'gather' ? /GATHER ORDER/ : type === 'returnCargo' ? /RETURN CARGO ORDER/
    : type === 'move' ? /MOVE ORDER/ : /STOP ORDER/;
  assert.ok(notices.some(row => pattern.test(row.message)), JSON.stringify(notices));
}

try {
  await fixture.start();
  clients = [await fixture.connect(0), await fixture.connect(1)];
  for (const [team, client] of clients.entries()) {
    assert.equal(client.welcome.map.id, canonical.id);
    assert.equal(client.welcome.matchModeId, 'skirmish');
    assert.deepEqual([client.welcome.map.width, client.welcome.map.height], [160, 160]);
    assert.equal(client.latest.armySize, 24);
    const home = client.latest.resourceNodes.find(row => row.id === homeIds[team]);
    assert.ok(home && home.stock === 650 && home.wildlifeState === 'alive');
    assert.equal(home.wildlifeTeam, null, 'visible opening Sheep starts neutral');
    assertPublic(client.latest);
  }
  const initial = await fixture.checkpoint(saved => saved.mapDefinition.id === canonical.id);
  conserved(initial);
  assert.ok(TERRACED_VALE_SHEEP_IDS.every(id => node(initial, id).wildlifeTeam === null));
  const origin = `http://127.0.0.1:${fixture.port}`;
  const servedMain = await fetch(`${origin}/src/main.js`);
  assert.equal(servedMain.status, 200);
  assert.equal(await servedMain.text(), await readFile(new URL('../src/main.js', import.meta.url), 'utf8'));
  assert.equal((await fetch(`${origin}/src/wildlife-client-state.mjs`)).status, 200);
  emit('default Tiny opening', { map: canonical.id, mode: 'skirmish', sheep: 4, foodStock: originalFood });
  const workers = clients.map((client, team) => client.latest.units.filter(row => row[1] === team && row[5] === 'worker').map(row => row[0]));
  phase = 'natural claims and normal Herd/Stop input';
  for (const team of [0, 1]) {
    const authored = canonical.resourceNodes.find(row => row.id === homeIds[team]), sign = team ? 1 : -1;
    await move(team, workers[team][0], { x: authored.x + sign, z: authored.z });
    await clients[team].state(state => state.resourceNodes.some(row => row.id === authored.id && row.wildlifeTeam === team), 'natural home Sheep claim');
    await move(team, workers[team][0], { x: authored.x + sign * 5, z: authored.z });
    const client = clients[team];
    const f = await wildlifeControlsFixture(team, { map: client.welcome.map, state: client.latest,
      onSend: payload => client.send(payload) });
    controls.push(f);
    const bridge = event => f.receive(JSON.parse(event.data));
    client.socket.addEventListener('message', bridge); bridges.push({ client, bridge });
    const spawn = canonical.spawnPoints.find(row => row.team === team);
    // The production minimap handler chooses the camera target; the CPU fixture
    // supplies its top-down camera/layout effect without granting extra vision.
    f.w.setCamera = () => {
      f.w.camera.position.set(f.w.cameraTarget.x, 200, f.w.cameraTarget.z);
      f.w.camera.lookAt(f.w.cameraTarget); f.w.camera.updateMatrixWorld();
    };
    f.mini(spawn, { button: 0 });
    assert.ok(distance(f.w.cameraTarget, spawn) < EPSILON);
    f.w.camera.zoom = 4; f.w.camera.updateProjectionMatrix(); f.w.camera.updateMatrixWorld();
    const source = client.latest.resourceNodes.find(row => row.id === authored.id);
    f.click(source);
    assert.equal(f.w.selectedWildlifeId, source.id); assert.equal(f.w.selected.size, 0);
    const target = { x: source.x - sign * 2.5, z: source.z };
    assert.equal(f.w.wildlifeEndpointLegal(target), true);
    const after = client.messages.length;
    if (team === 0) f.right(target);
    else { f.w.ui.orderTargetToggle.click(); f.mini(target, { button: 0, pointerType: 'touch' }); }
    const herd = f.sent.at(-1);
    assert.deepEqual([herd.type, herd.nodeId, herd.resourceEpoch], ['herd', source.id, client.latest.forestEpoch]);
    await client.wait(row => row.type === 'notice' && row.clientOrderToken === herd.clientOrderToken && /HERD ORDER/.test(row.message), 'normal Herd ACK', after);
    await client.state(state => state.resourceNodes.some(row => row.id === source.id && distance(row, source) > .4), 'default Sheep moves from ordinary Herd');
    const stopAfter = client.messages.length;
    if (team === 0) f.key('s'); else f.w.document.querySelector('[data-stationary-order="stop"]').click();
    const stop = f.sent.at(-1); assert.equal(stop.type, 'stopWildlife');
    await client.wait(row => row.type === 'notice' && row.clientOrderToken === stop.clientOrderToken && row.message === 'SHEEP STOP ORDER', 'normal Stop ACK', stopAfter);
    assert.equal(f.w.ui.orderStatus.dataset.state, 'applied');
    const row = f.w.latestWildlifeView.rows.get(source.id);
    const group = f.w.scene.children.find(item => item.userData.wildlifeNodeId === source.id);
    assert.deepEqual(group.position.toArray(), [row.x, 0, row.z]);
  }
  for (const { client, bridge } of bridges) client.socket.removeEventListener('message', bridge);
  for (const f of controls) await f.close(); controls.length = 0;
  const stopped = await fixture.checkpoint(saved => homeIds.every(id => node(saved, id).wildlifeHerd === null));
  conserved(stopped);
  assert.ok(homeIds.every(id => node(stopped, id).stock === 650));
  phase = 'bounded native partial harvest and current recovery';
  for (const team of [0, 1]) await command(team, { type: 'gather', ids: [workers[team][0]], nodeId: homeIds[team] }, /GATHER ORDER/);
  await fixture.checkpoint(saved => workers.every(ids => unit(saved, ids[0]).cargo >= 1));
  for (const team of [0, 1]) await command(team, { type: 'stop', ids: [workers[team][0]] }, /STOP ORDER/);
  await fixture.checkpoint(saved => workers.every(ids => unit(saved, ids[0]).gatherPhase === '' && unit(saved, ids[0]).cargo > 0));
  const partial = await restart();
  for (const team of [0, 1]) {
    assert.deepEqual(frozen(node(partial.recovered, homeIds[team])), frozen(node(partial.saved, homeIds[team])));
    assert.equal(unit(partial.recovered, workers[team][0]).cargo, unit(partial.saved, workers[team][0]).cargo);
    await command(team, { type: 'returnCargo', ids: [workers[team][0]] }, /RETURN CARGO ORDER/);
  }
  const delivered = await fixture.checkpoint(saved => workers.every(ids => unit(saved, ids[0]).cargo === 0));
  conserved(delivered);
  const stable = await restart();
  assert.deepEqual(stable.recovered.state.teamFood, stable.saved.state.teamFood, 'cold restart cannot duplicate delivered food');
  emit('native partial harvest/recovery', { foodBanks: stable.recovered.state.teamFood,
    partialStocks: homeIds.map(id => node(stable.recovered, id).stock) });
  await fixture.stop();

  // Resume the real native checkpoint unchanged, then advance production ticks
  // without wall-clock waiting for two 650-food resources and distant returns.
  phase = 'fixed-tick shared harvest and full depletion';
  process.env.RTS_GAME_MODE = 'pvp'; process.env.RTS_MAP = ''; process.env.RTS_PREGAME = '0';
  delete process.env.RTS_MATCH_STATE_PATH;
  replayFixture = await createPathingReplayFixture(canonical);
  assert.equal(replayFixture.sourceSha256, serverSha256);
  const r = replayFixture.replay; r.restore(structuredClone(stable.recovered));
  emit('full lifecycle resumed', { tick: r.tick, units: r.units.length });
  const foreign = [workers[1][1], workers[0][1]];
  for (const team of [0, 1]) replayOrder(r, 1 - team, 'move', [foreign[team]], point(r.resources.get(homeIds[team])));
  const approachTicks = await until(r, () => homeIds.every((id, team) => {
    const worker = r.units.find(row => row.id === foreign[team]);
    return worker.hp > 0 && distance(worker, r.resources.get(id)) < 2;
  }), 'opposing Workers naturally approach the visible carcasses', 12_000);
  emit('opposing Workers reached carcasses', { approachTicks });
  for (const team of [0, 1]) {
    const row = r.snapshot(1 - team).resourceNodes.find(row => row.id === homeIds[team]);
    assert.ok(row && row.wildlifeTeam === team && row.stock > 0);
    replayOrder(r, 1 - team, 'gather', [foreign[team]], { nodeId: homeIds[team] });
    replayOrder(r, team, 'gather', [workers[team][0]], { nodeId: homeIds[team] });
  }
  await until(r, () => foreign.every(id => r.units.find(row => row.id === id).cargo > 0), 'both opposing Gather orders produce real cargo');
  emit('shared Gather produced cargo', { ids: foreign });
  const harvestTicks = await until(r, () => homeIds.every(id => r.resources.get(id).stock === 0), 'two unchanged 650-food pools fully deplete', 40_000);
  for (const team of [0, 1]) replayOrder(r, team, 'stop', [workers[team][0], foreign[1 - team]]);
  const depleted = r.checkpoint(); conserved(depleted);
  assert.ok(homeIds.every(id => node(depleted, id).wildlifeState === 'depleted'));
  assert.equal(r.validate(JSON.parse(JSON.stringify(depleted))).definition.id, canonical.id);
  r.restore(JSON.parse(JSON.stringify(depleted)));
  for (const id of homeIds) assert.deepEqual(frozen(node(r.checkpoint(), id)), frozen(node(depleted, id)));
  assert.deepEqual(r.checkpoint().state.teamFood, depleted.state.teamFood);
  for (const team of [0, 1]) {
    const carrying = [workers[team][0], foreign[1 - team]].filter(id => r.units.find(row => row.id === id).cargo > 0);
    if (carrying.length) replayOrder(r, team, 'returnCargo', carrying);
  }
  const deliveryTicks = await until(r, () => r.units.every(row => row.cargoType !== 'food' || row.cargo === 0), 'all final food cargo returns', 12_000);
  const final = r.checkpoint(); conserved(final);
  assert.ok(Math.abs(final.state.teamFood.reduce((sum, value) => sum + value, 0) - 1600) < EPSILON);
  r.restore(JSON.parse(JSON.stringify(final))); r.step();
  assert.deepEqual(r.checkpoint().state.teamFood, final.state.teamFood, 'depleted restart credits the 1300 harvested food exactly once');
  emit('fixed-tick full shared lifecycle', { approachTicks, harvestTicks, deliveryTicks, banks: final.state.teamFood });

  // A naturally harvested old ordinary-food map creates an exact pre-adoption
  // checkpoint. Only its validated match descriptor selects historical Skirmish;
  // stock, poses, units, cargo and banks come from ordinary production ticks.
  phase = 'exact previous Tiny map cold migration';
  const legacyMap = structuredClone(canonical);
  for (const row of legacyMap.resourceNodes) if (TERRACED_VALE_SHEEP_IDS.includes(row.id)) delete row.wildlifeSpecies;
  assert.equal(hashMap(legacyMap), TERRACED_VALE_PRE_SHEEP_MAP_HASH);
  legacyFixture = await createPathingReplayFixture(legacyMap);
  const old = legacyFixture.replay;
  const oldWorkers = [0, 1].map(team => old.units.find(row => row.team === team && row.kind === 'worker').id);
  for (const team of [0, 1]) replayOrder(old, team, 'gather', [oldWorkers[team]], { nodeId: homeIds[team] });
  await until(old, () => oldWorkers.every(id => old.units.find(row => row.id === id).cargo >= 1), 'ordinary old food creates natural partial cargo');
  for (const team of [0, 1]) replayOrder(old, team, 'stop', [oldWorkers[team]]);
  const legacy = old.checkpoint(); conserved(legacy);
  // A restore would run adoption immediately. Set only the historical match
  // descriptor on the naturally produced old-map capture, then validate it.
  legacy.matchModeId = 'skirmish'; legacy.matchModeVersion = 1;
  assert.equal(old.validate(structuredClone(legacy)).definition.id, canonical.id);
  assert.equal(legacy.mapHash, TERRACED_VALE_PRE_SHEEP_MAP_HASH);
  assert.equal(legacy.schemaVersion, 29);
  await writeFile(fixture.checkpointPath, JSON.stringify(legacy));
  await fixture.start(); clients = [await fixture.connect(0), await fixture.connect(1)];
  assert.ok(clients.every(client => client.welcome.recoveredFromCheckpoint));
  assert.ok(clients.every(client => client.welcome.matchModeId === 'skirmish'));
  const migrated = await fixture.checkpoint(saved => saved.mapHash === hashMap(canonical));
  conserved(migrated);
  for (const id of TERRACED_VALE_SHEEP_IDS) {
    assert.equal(node(migrated, id).stock, node(legacy, id).stock);
    assert.equal(node(migrated, id).wildlifeSpecies, 'bellweather-sheep');
    assert.equal(node(migrated, id).wildlifeState, homeIds.includes(id) ? 'carcass' : 'alive');
  }
  assert.deepEqual(migrated.state.teamFood, legacy.state.teamFood);
  for (const id of oldWorkers) assert.equal(unit(migrated, id).cargo, unit(legacy, id).cargo);
  assert.equal(await serverHash(), serverSha256, 'runtime server source stays frozen throughout this proof');
  emit('passed', { scenario: 'ordinary Tiny Sheep adoption', sourceCommit, serverSha256,
    map: canonical.id, mode: 'skirmish@1', sheep: 4, unchangedMapFood: originalFood,
    defaultHttpWsBothSeats: true, neutralVisibleOpening: true, naturalWorkerClaims: true,
    productionHerdStopInputAndCpuPose: true, partialNativeRestartAndReturnOnce: true,
    sharedOpposingGather: true, fullUnmodified650StockDepletionAndRecovery: true,
    exactOldTinyNaturalStockCargoBankMigration: true, finalFoodBanks: final.state.teamFood,
    limits: ['HTTP/WS plus real fixed ticks and Three CPU input/pose; no GPU/native/staging appearance assertion'] });
} catch (error) {
  emit('failed', { phase, message: error.message });
  throw error;
} finally {
  for (const { client, bridge } of bridges) client.socket.removeEventListener('message', bridge);
  for (const f of controls) await f.close();
  await replayFixture?.dispose(); await legacyFixture?.dispose(); await fixture.dispose();
}
