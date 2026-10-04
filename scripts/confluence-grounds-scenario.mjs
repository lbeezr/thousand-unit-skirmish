// Ordinary root Practice entry, authored catalog selection and real paid commands.
// Never writes a bank, unit, resource, position or checkpoint fixture.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { bootGameEntry } from '../src/game-entry.mjs';
import { BUILDING_DEFINITIONS, UNIT_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { constructionCostForProfile } from '../src/economy-profile.mjs';
import { farmHarvestNodeId } from '../src/farm-harvest.mjs';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { captureDepotSources, assertDepotSourcesUnchanged } from './depot-source-snapshot.mjs';
import { CONFLUENCE_LAYOUT as layout } from './generate-confluence-grounds.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const map = JSON.parse(await readFile(path.join(ROOT, 'maps/siltmouths-confluence-grounds.json')));
const args = process.argv.slice(2), option = args.find(arg => arg.startsWith('--output='));
assert.ok(option && args.length === 1, 'Usage: node scripts/confluence-grounds-scenario.mjs --output=NEW_DIRECTORY');
const output = path.resolve(option.slice(9)); await mkdir(output);
// Isolate this child scenario from ambient developer fixture overrides.
for (const key of Object.keys(process.env)) if (key.startsWith('RTS_')) delete process.env[key];
const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
const sourceDirty = execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).trim() !== '';
const sources = await captureDepotSources(ROOT, { outputDirectory: output });
const startedAt = new Date().toISOString(), wallStart = performance.now();
const fixture = await createFortifiedFixture({ mapPath: null, supervisor: true, timeoutMs: 180_000 });
const records = [], spent = [0, 1].map(() => ({ food: 0, wood: 0, stone: 0 }));
const sum = (rows, f) => rows.reduce((n, row) => n + f(row), 0);
const near = (a, b, why) => assert.ok(Math.abs(a - b) < 1e-5, `${why}: ${a} versus ${b}`);
const own = (s, team, type) => s.state.buildings.find(b => b.team === team && b.type === type);
const node = (s, id) => s.state.resourceNodes.find(n => n.id === id);
const position = (team, [c, r]) => ({ x: (team ? 159 - c : c) - 79.5, z: r - 79.5 });
let clients = [], workers, tokens, checkpointPath, roomId, order = 1, page;
const checkpoint = predicate => fixture.checkpoint(predicate, checkpointPath);
async function command(team, value, expression) {
  const notice = await clients[team].command({ ...value, clientOrderToken: order++ }, /./);
  assert.match(notice.message, expression); return notice;
}
function record(stage, s, extra = {}) {
  assert.deepEqual(s.mapDefinition.resourceNodes, map.resourceNodes);
  for (const type of ['food', 'wood', 'stone']) {
    const supplied = sum(map.resourceNodes.filter(n => n.type === type), n => n.stock)
      + 2 * (map.startingResources[type] || 0)
      + (type === 'food' ? s.state.buildings.filter(b => b.type === 'farm' && b.complete).length * BUILDING_DEFINITIONS.farm.harvest.stock : 0);
    const accounted = sum(s.state.resourceNodes.filter(n => n.type === type), n => n.stock)
      + sum(s.state.units.filter(u => u.cargoType === type), u => u.cargo)
      + sum(s.state[type === 'food' ? 'teamFood' : type === 'wood' ? 'teamWood' : 'teamStone'], n => n)
      + sum(spent, n => n[type])
      + (type === 'food' ? sum(s.state.buildings.filter(b => b.type === 'farm'), b => b.harvestStock) : 0);
    near(accounted, supplied, `${stage} ${type} conservation`);
  }
  records.push({ stage, tick: s.state.tickNumber, elapsedGameSeconds: s.state.matchElapsedSeconds,
    wallElapsedSeconds: (performance.now() - wallStart) / 1000,
    banks: { food: s.state.teamFood, wood: s.state.teamWood, stone: s.state.teamStone },
    paid: structuredClone(spent), resources: s.state.resourceNodes.map(({ id, stock, wildlifeState, wildlifeTeam }) => ({ id, stock, wildlifeState, wildlifeTeam })),
    buildings: s.state.buildings.map(({ id, team, type, complete, harvestStock }) => ({ id, team, type, complete, harvestStock })),
    cargo: s.state.units.filter(u => u.cargo > 0).map(({ id, team, cargo, cargoType, gatherPhase, dropoffBuildingId }) => ({ id, team, cargo, cargoType, gatherPhase, dropoffBuildingId })), ...extra });
  console.log(JSON.stringify({ stage, tick: s.state.tickNumber, conserved: true }));
}
async function stopAndReturn(ids = workers) {
  for (const team of [0, 1]) {
    await command(team, { type: 'stop', ids: ids[team] }, /STOP ORDER/);
    await command(team, { type: 'returnCargo', ids: ids[team] }, /RETURN CARGO/);
  }
  return checkpoint(s => ids.flat().every(id => s.state.units[id].cargo === 0));
}
async function moveWorkers(plot) {
  for (const team of [0, 1]) await command(team, { type: 'move', ids: workers[team], ...position(team, plot) }, /PLANNING MOVE|MOVE ORDER/);
  return checkpoint(s => workers.every((ids, team) => ids.every(id => {
    const u = s.state.units[id], p = position(team, plot);
    return u.pathIndex >= u.path.length && Math.hypot(u.x - p.x, u.z - p.z) < 4;
  })));
}
async function build(type, plot) {
  for (const team of [0, 1]) {
    await command(team, { type: 'build', buildingType: type, ids: workers[team], ...position(team, plot) }, /PLACED|PLANNING BUILD/);
    for (const [resource, amount] of Object.entries(constructionCostForProfile(type, map.economyProfileId))) spent[team][resource] += amount;
  }
  const s = await checkpoint(s => [0, 1].every(team => own(s, team, type)?.complete));
  record(`paid-${type}-complete`, s); return s;
}
try {
  await fixture.start(); const origin = `http://127.0.0.1:${fixture.port}`, navigations = [];
  page = new JSDOM(await (await fetch(origin)).text(), { url: origin });
  await bootGameEntry({ win: page.window, fetchImpl: (url, options) => fetch(new URL(url, origin), options),
    navigate: url => navigations.push(new URL(url)), loadGame() { throw Error('Root menu must navigate before loading the renderer'); } });
  page.window.document.querySelector('#menu-practice').click();
  const deadline = Date.now() + 15000;
  while (!navigations.length && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(navigations.length, 1); roomId = navigations[0].searchParams.get('room'); assert.ok(roomId);
  const room = await (await fetch(`${origin}/api/rooms/${roomId}`)).json();
  assert.deepEqual(room.launchOptions, { mode: 'pvp', practice: true, matchModeId: 'authored', matchModeVersion: 1 });
  checkpointPath = path.join(fixture.directory, 'rooms', 'rooms', roomId, 'match-state.json');
  clients = [await fixture.connect(0, null, roomId), await fixture.connect(1, null, roomId)];
  assert.ok(clients.every(c => c.welcome.state.practice && !c.welcome.state.lobby));
  assert.ok(clients[0].welcome.maps.some(m => m.id === map.id));
  const changes = clients.map(c => c.wait(m => m.type === 'mapChange' && m.map.id === map.id, 'ordinary arena selection', c.messages.length));
  clients[0].send({ type: 'selectMap', mapId: map.id }); await Promise.all(changes);
  tokens = clients.map(c => c.welcome.player.sessionToken);
  workers = clients.map((c, team) => c.latest.units.filter(u => u[1] === team && u[5] === 'worker').map(u => u[0]));
  assert.deepEqual(workers.map(ids => ids.length), [4, 4]);
  for (const team of [0, 1]) {
    const ids = clients[team].latest.units.filter(u => u[1] === team).map(u => u[0]);
    await command(team, { type: 'stop', ids }, /STOP ORDER/);
    await command(team, { type: 'setStance', ids, stance: 'noAttack' }, /STANCE ORDER/);
    assert.ok(clients[team].latest.resourceNodes.some(n => n.id === `s${team}-sheep-0` && n.wildlifeState === 'alive'));
  }
  const initial = await checkpoint(s => s.mapDefinition.id === map.id);
  assert.deepEqual(initial.state.teamFood, [150, 150]); assert.deepEqual(initial.state.teamWood, [250, 250]);
  assert.deepEqual(initial.state.teamStone, [0, 0]); record('ordinary-practice-authored-start', initial);
  await moveWorkers([29, 66]);
  for (const team of [0, 1]) await command(team, { type: 'build', buildingType: 'watchtower', ids: workers[team], ...position(team, layout.plots.watchtower) }, /NEED .*50 STONE/);
  const denied = await checkpoint(); assert.deepEqual(denied.state.buildings, initial.state.buildings);
  assert.deepEqual(denied.state.teamWood, [250, 250]); record('unfunded-tower-rejected', denied);
  for (const team of [0, 1]) await command(team, { type: 'gather', ids: workers[team], nodeId: `s${team}-timber` }, /GATHER ORDER/);
  await checkpoint(s => s.state.teamWood.every(n => n >= 600));
  record('natural-local-wood-banked', await stopAndReturn());
  for (const team of [0, 1]) await command(team, { type: 'gather', ids: workers[team], nodeId: `s${team}-stone-0` }, /GATHER ORDER/);
  await checkpoint(s => s.state.teamStone.every(n => n >= 50)); record('natural-local-stone-banked', await stopAndReturn());
  await build('farm', layout.plots.farm); await build('mill', layout.plots.mill);
  await build('watchtower', layout.plots.watchtower);
  const docks = await build('dock', layout.docks[0]);
  for (const team of [0, 1]) {
    await command(team, { type: 'trainUnit', kind: 'skiff', buildingId: own(docks, team, 'dock').id }, /QUEUED/);
    for (const [resource, amount] of Object.entries(UNIT_DEFINITIONS.skiff.cost)) spent[team][resource] += amount;
  }
  const afloat = await checkpoint(s => [0, 1].every(team => s.state.units.some(u => u.team === team && u.kind === 'skiff')));
  const boats = [0, 1].map(team => afloat.state.units.find(u => u.team === team && u.kind === 'skiff').id);
  record('paid-skiffs-trained', afloat);
  for (const team of [0, 1]) {
    await command(team, { type: 'gather', ids: [boats[team]], nodeId: `s${team}-shore-fish` }, /SKIFF/);
    await command(team, { type: 'gather', ids: [workers[team][0]], nodeId: `s${team}-sheep-0` }, /GATHER ORDER/);
  }
  const sheepFood = await checkpoint(s => workers.every((ids, team) => s.state.units[ids[0]].cargoType === 'food'
    && s.state.units[ids[0]].cargo > 0 && node(s, `s${team}-sheep-0`).wildlifeState === 'carcass'));
  record('nearby-neutral-sheep-harvested', sheepFood);
  await stopAndReturn(workers.map(ids => [ids[0]]));
  const farmReady = await checkpoint();
  for (const team of [0, 1]) {
    await command(team, { type: 'gather', ids: [workers[team][0]], nodeId: farmHarvestNodeId(own(farmReady, 1 - team, 'farm').id) }, /FARM BELONGS TO THE OTHER TEAM/);
    await command(team, { type: 'gather', ids: [workers[team][0]], nodeId: farmHarvestNodeId(own(farmReady, team, 'farm').id) }, /GATHER ORDER/);
    await command(team, { type: 'gather', ids: [workers[team][1]], nodeId: `s${team}-shore-fish` }, /GATHER ORDER/);
  }
  const crops = await checkpoint(s => workers.every((ids, team) => s.state.units[ids[0]].cargo > 0 && own(s, team, 'farm').harvestStock < 200)
    && boats.every(id => s.state.units[id].cargo > 0));
  record('finite-farm-and-shared-worker-skiff-fish', crops);
  await stopAndReturn(workers.map(ids => [ids[0]]));
  const millDeposit = await checkpoint(s => workers.every((ids, team) => s.state.units[ids[0]].dropoffBuildingId === own(s, team, 'mill').id));
  record('farm-food-delivered-to-nearby-mill', millDeposit);
  // Real opposing infantry expose both completed tower firing arcs while fishing continues.
  const targets = [0, 1].map(team => initial.state.units.find(u => u.team === team && u.kind === 'infantry').id);
  for (const team of [0, 1]) {
    const tower = own(millDeposit, 1 - team, 'watchtower');
    await command(team, { type: 'move', ids: [targets[team]], x: tower.x + (team ? 4 : -4), z: tower.z + 2 }, /PLANNING MOVE|MOVE ORDER/);
  }
  const damaged = await checkpoint(s => targets.every(id => s.state.units[id].hp < initial.state.units[id].hp && s.state.units[id].hp > 0));
  record('both-paid-watchtowers-fire', damaged, { targetHp: targets.map(id => damaged.state.units[id].hp) });
  for (const team of [0, 1]) await command(team, { type: 'move', ids: [targets[team]], ...position(1 - team, [30, 84]) }, /PLANNING MOVE|MOVE ORDER/);
  await checkpoint(s => targets.every(id => s.state.units[id].pathIndex >= s.state.units[id].path.length));
  const fishDelivered = await checkpoint(s => [0, 1].every(team => node(s, `s${team}-shore-fish`).stock < 170
    && s.state.teamFood[team] > 110)); record('finite-fish-food-delivered', fishDelivered);
  await stopAndReturn(workers); await stopAndReturn(boats.map(id => [id]));
  // Traverse the actual connected bays in both directions, away from Dock berths.
  for (const team of [0, 1]) await command(team, { type: 'move', ids: [boats[team]], ...position(1 - team, [37, 128]) }, /SKIFF WATER ROUTE|PLANNING MOVE|MOVE ORDER/);
  const crossed = await checkpoint(s => boats.every((id, team) => {
    const u = s.state.units[id], p = position(1 - team, [37, 128]); return u.pathIndex >= u.path.length && Math.hypot(u.x - p.x, u.z - p.z) < 1;
  })); record('both-skiffs-cross-connected-bays', crossed);
  await fixture.stop(); const retained = JSON.parse(await readFile(checkpointPath)); record('cold-checkpoint-before', retained);
  await writeFile(path.join(output, 'retained-checkpoint.json'), JSON.stringify(retained) + '\n');
  await fixture.start(); clients = [await fixture.connect(0, tokens[0], roomId), await fixture.connect(1, tokens[1], roomId)];
  assert.ok(clients.every(c => c.welcome.recoveredFromCheckpoint));
  const restored = await checkpoint(s => s.sequence > retained.sequence);
  assert.equal(restored.matchId, retained.matchId); assert.equal(restored.mapHash, retained.mapHash);
  for (const field of ['teamFood', 'teamWood', 'teamStone']) assert.deepEqual(restored.state[field], retained.state[field]);
  const stocks = s => s.state.resourceNodes.map(({ id, type, stock, wildlifeState }) => ({ id, type, stock, wildlifeState }));
  assert.deepEqual(stocks(restored), stocks(retained));
  const paidBuildings = s => s.state.buildings.map(({ attackCooldown, ...b }) => b);
  assert.deepEqual(paidBuildings(restored), paidBuildings(retained));
  assert.deepEqual(restored.state.units.map(({ id, cargo, cargoType }) => ({ id, cargo, cargoType })),
    retained.state.units.map(({ id, cargo, cargoType }) => ({ id, cargo, cargoType })));
  record('cold-checkpoint-after', restored);
  const resetAfter = clients[0].messages.length; clients[0].send({ type: 'reset' });
  await clients[0].wait(m => m.type === 'notice' && m.message === 'BATTLEFIELD RESET', 'ordinary Practice reset', resetAfter);
  const reset = await checkpoint(s => s.state.buildings.length === 0 && s.state.units.length === 24
    && s.state.teamFood.every(n => n === 150) && s.state.teamWood.every(n => n === 250));
  assert.deepEqual(reset.state.teamStone, [0, 0]); assert.equal(reset.mapDefinition.id, map.id);
  for (const authored of map.resourceNodes) assert.equal(node(reset, authored.id).stock, authored.stock);
  assert.ok(reset.state.resourceNodes.filter(n => n.wildlifeSpecies).every(n => n.wildlifeState === 'alive'));
  for (const cost of spent) for (const type of Object.keys(cost)) cost[type] = 0;
  record('authored-reset-restores-finite-opening', reset);
  clients[1].socket.close(); await clients[0].state(s => s.connected === 1, 'single-player Practice');
  const id = reset.state.units.find(u => u.team === 0 && u.kind === 'worker').id;
  await command(0, { type: 'move', ids: [id], ...position(0, [30, 87]) }, /PLANNING MOVE|MOVE ORDER/);
  const solo = await checkpoint(s => s.state.tickNumber > reset.state.tickNumber + 30 && s.state.units[id].pathIndex >= s.state.units[id].path.length
    && Math.hypot(s.state.units[id].x - position(0, [30, 87]).x, s.state.units[id].z - position(0, [30, 87]).z) < 1);
  assert.equal(solo.state.scenarioClockStarted, true); record('one-human-practice-clock-and-move', solo);
  await assertDepotSourcesUnchanged(ROOT, sources, { outputDirectory: output });
  assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(), sourceRevision);
  await writeFile(path.join(output, 'source-inputs.json'), JSON.stringify(sources, null, 2) + '\n');
  await writeFile(path.join(output, 'report.json'), JSON.stringify({ sourceRevision, sourceDirty, startedAt, completedAt: new Date().toISOString(), nodeVersion: process.version,
    sourceContentSha256: sources.sourceContentSha256, mapId: map.id, dimensions: [160, 160], economyProfileId: map.economyProfileId,
    evidenceType: 'native-authoritative-ordinary-practice', injectedState: false, actualRootPracticeEntry: true,
    ordinaryCatalogSelection: true, humanMatches: 0, records,
    limits: ['DOM entry plus native server; browser rendering, pointer usability, deployed revision and human balance remain unverified.',
      'Catalog visibility of older compact fixtures is a separate mode-owner change; this run proves the admitted arena.'] }, null, 2) + '\n');
  console.log(JSON.stringify({ stage: 'passed', sourceRevision, sourceDirty, output }));
} catch (error) {
  await writeFile(path.join(output, 'failure.json'), JSON.stringify({ sourceRevision, sourceDirty,
    error: String(error.stack), records, lastStates: clients.map(c => ({ mapId: c.latest?.mapId, tick: c.latest?.tick, food: c.latest?.food,
      wood: c.latest?.wood, stone: c.latest?.stone, units: c.latest?.units.filter(u => ['worker', 'skiff'].includes(u[5])) })) }, null, 2) + '\n');
  throw error;
} finally { page?.window.close(); await fixture.dispose(); }
