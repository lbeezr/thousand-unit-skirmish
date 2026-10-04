import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { bootGameEntry } from '../src/game-entry.mjs';
import { UNIT_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { constructionCostForProfile } from '../src/economy-profile.mjs';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { captureDepotSources, assertDepotSourcesUnchanged } from './depot-source-snapshot.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const map = JSON.parse(await readFile(path.join(ROOT, 'maps/veyrholds-crownroads.json')));
const args = process.argv.slice(2), option = args.find(arg => arg.startsWith('--output='));
assert.ok(option && args.length === 1, 'Usage: node scripts/crownroads-paid-scenario.mjs --output=NEW_DIRECTORY');
const output = path.resolve(option.slice(9)); await mkdir(output);
for (const key of Object.keys(process.env)) if (key.startsWith('RTS_')) delete process.env[key];
const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
const sourceDirty = Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).trim());
const sources = await captureDepotSources(ROOT, { outputDirectory: output });
const startedAt = new Date().toISOString(), wallStart = performance.now();
const fixture = await createFortifiedFixture({ mapPath: null, supervisor: true, timeoutMs: 300_000 });
const records = [], arrivals = [], spent = [0, 1].map(() => ({ food: 0, wood: 0, stone: 0 }));
const position = (team, [c, r]) => ({ x: (team ? 255 - c : c) - 127.5, z: r - 127.5 });
const unit = (s, id) => s.state.units.find(u => u.id === id);
const own = (s, team, type) => s.state.buildings.find(b => b.team === team && b.type === type);
const sum = (rows, f) => rows.reduce((n, row) => n + f(row), 0);
let clients = [], workers, infantry, tokens, checkpointPath, roomId, order = 1, page;
const checkpoint = predicate => fixture.checkpoint(predicate, checkpointPath);
async function command(team, value, expression) {
  const start = performance.now();
  const notice = await clients[team].command({ ...value, clientOrderToken: order++ }, /^(?!PLANNING )/);
  assert.match(notice.message, expression); return { message: notice.message, finalNoticeMs: performance.now() - start };
}
function record(stage, s, extra = {}) {
  assert.deepEqual(s.mapDefinition.resourceNodes, map.resourceNodes);
  for (const type of ['food', 'wood', 'stone']) {
    const supplied = sum(map.resourceNodes.filter(n => n.type === type), n => n.stock) + 2 * (map.startingResources[type] || 0);
    const accounted = sum(s.state.resourceNodes.filter(n => n.type === type), n => n.stock)
      + sum(s.state.units.filter(u => u.cargoType === type), u => u.cargo)
      + sum(s.state[type === 'food' ? 'teamFood' : type === 'wood' ? 'teamWood' : 'teamStone'], n => n)
      + sum(spent, n => n[type]);
    assert.ok(Math.abs(accounted - supplied) < 1e-5, `${stage} ${type} conservation: ${accounted} versus ${supplied}`);
  }
  records.push({ stage, tick: s.state.tickNumber, elapsedGameSeconds: s.state.matchElapsedSeconds,
    wallElapsedSeconds: (performance.now() - wallStart) / 1000,
    banks: { food: s.state.teamFood, wood: s.state.teamWood, stone: s.state.teamStone }, paid: structuredClone(spent),
    resources: s.state.resourceNodes.map(({ id, stock }) => ({ id, stock })),
    buildings: s.state.buildings.map(({ id, team, type, complete, footprint, x, z }) => ({ id, team, type, complete, footprint, x, z })),
    cargo: s.state.units.filter(u => u.cargo > 0).map(({ id, team, cargo, cargoType }) => ({ id, team, cargo, cargoType })), ...extra });
  console.log(JSON.stringify({ stage, tick: s.state.tickNumber, conserved: true }));
}
async function travel(team, id, target, kind) {
  const before = clients[team].latest, start = before.units.find(u => u[0] === id), began = performance.now();
  const notice = await command(team, { type: 'move', ids: [id], ...target }, /MOVE ORDER/);
  const arrived = await clients[team].state(s => s.tick > before.tick && s.units.some(u => u[0] === id
    && Math.hypot(u[2] - target.x, u[3] - target.z) <= .8), `${kind} complete cross-map arrival`);
  const final = arrived.units.find(u => u[0] === id);
  const result = { team, id, kind, start: { x: start[2], z: start[3] }, target,
    criterion: 'within 0.8 world units of the commanded point in a later public snapshot',
    gameSeconds: (arrived.tick - before.tick) / 30, wallSeconds: (performance.now() - began) / 1000,
    final: { x: final[2], z: final[3] }, ...notice };
  result.gameToWallRatio = result.gameSeconds / result.wallSeconds;
  arrivals.push(result); console.log(JSON.stringify({ stage: 'arrival', ...result }));
}
function tracked(promise) { promise.catch(() => {}); return promise; }
async function build(type, ids, plot) {
  for (const team of [0, 1]) {
    await command(team, { type: 'build', buildingType: type, ids: ids[team], ...position(team, plot) }, /PLACED/);
    for (const [resource, amount] of Object.entries(constructionCostForProfile(type, map.economyProfileId))) spent[team][resource] += amount;
  }
  const s = await checkpoint(s => [0, 1].every(team => own(s, team, type)?.complete));
  record(`paid-${type}-complete`, s); return s;
}
async function stopAndReturn() {
  for (const team of [0, 1]) {
    await command(team, { type: 'stop', ids: workers[team] }, /STOP ORDER/);
    await command(team, { type: 'returnCargo', ids: workers[team] }, /RETURN CARGO/);
  }
  return checkpoint(s => workers.flat().every(id => unit(s, id).cargo === 0));
}
try {
  await fixture.start(); const origin = `http://127.0.0.1:${fixture.port}`, navigations = [];
  page = new JSDOM(await (await fetch(origin)).text(), { url: origin });
  await bootGameEntry({ win: page.window, fetchImpl: (url, options) => fetch(new URL(url, origin), options),
    navigate: url => navigations.push(new URL(url)), loadGame() { throw Error('Root Practice must navigate before loading the renderer'); } });
  page.window.document.querySelector('#menu-practice').click();
  const deadline = Date.now() + 15000;
  while (!navigations.length && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(navigations.length, 1); roomId = navigations[0].searchParams.get('room'); assert.ok(roomId);
  const room = await (await fetch(`${origin}/api/rooms/${roomId}`)).json();
  assert.deepEqual(room.launchOptions, { mode: 'pvp', practice: true, matchModeId: 'authored', matchModeVersion: 1 });
  checkpointPath = path.join(fixture.directory, 'rooms', 'rooms', roomId, 'match-state.json');
  clients = [await fixture.connect(0, null, roomId), await fixture.connect(1, null, roomId)];
  const descriptor = clients[0].welcome.maps.find(m => m.id === map.id);
  assert.ok(descriptor?.ordinarySelectable && descriptor.selectable);
  assert.deepEqual([descriptor.width, descriptor.height], [256, 256]);
  const changes = clients.map(c => c.wait(m => m.type === 'mapChange' && m.map.id === map.id, 'ordinary Large selection', c.messages.length));
  clients[0].send({ type: 'selectMap', mapId: map.id }); await Promise.all(changes);
  tokens = clients.map(c => c.welcome.player.sessionToken);
  const initialFog = clients.map((c, team) => ({ team, packedBytes: Buffer.from(c.latest.visibility.data, 'base64').length,
    visibleEnemyUnits: c.latest.units.filter(u => u[1] !== team).length }));
  assert.ok(initialFog.every(f => f.packedBytes === 16384 && f.visibleEnemyUnits === 0));
  const initial = await checkpoint(s => s.mapDefinition.id === map.id);
  workers = [0, 1].map(team => initial.state.units.filter(u => u.team === team && u.kind === 'worker').map(u => u.id));
  infantry = [0, 1].map(team => initial.state.units.filter(u => u.team === team && u.kind === 'infantry').map(u => u.id));
  assert.deepEqual(workers.map(ids => ids.length), [4, 4]);
  assert.deepEqual(initial.state.teamFood, [150, 150]); assert.deepEqual(initial.state.teamWood, [250, 250]);
  for (const team of [0, 1]) {
    await command(team, { type: 'setStance', ids: [...workers[team], ...infantry[team]], stance: 'noAttack' }, /STANCE ORDER/);
    await command(team, { type: 'move', ids: infantry[team].slice(1), ...position(team, [15, 142]) }, /MOVE ORDER/);
  }
  record('public-root-authored-practice-opening', initial, { initialFog });
  const journeys = [0, 1].flatMap(team => [
    tracked(travel(team, infantry[team][0], position(1 - team, [27, 125]), 'infantry')),
    tracked(travel(team, workers[team][0], position(1 - team, [27, 128]), 'worker')
      .then(() => travel(team, workers[team][0], position(team, [27, 128]), 'worker-return'))
      .then(() => command(team, { type: 'gather', ids: [workers[team][0]], nodeId: `s${team}-home-wood` }, /GATHER ORDER/))),
  ]);
  for (const team of [0, 1]) await command(team, { type: 'gather', ids: [workers[team][3]], nodeId: `s${team}-home-wood` }, /GATHER ORDER/);
  const stables = await build('stable', workers.map(ids => ids.slice(1, 3)), [27, 138]);
  for (const team of [0, 1]) {
    await command(team, { type: 'gather', ids: [workers[team][1]], nodeId: `s${team}-home-food` }, /GATHER ORDER/);
    await command(team, { type: 'gather', ids: [workers[team][2]], nodeId: `s${team}-home-wood` }, /GATHER ORDER/);
    await command(team, { type: 'trainUnit', kind: 'scout', buildingId: own(stables, team, 'stable').id }, /SCOUT QUEUED/);
    for (const [resource, amount] of Object.entries(UNIT_DEFINITIONS.scout.cost)) spent[team][resource] += amount;
  }
  const trained = await checkpoint(s => [0, 1].every(team => s.state.units.some(u => u.team === team && u.kind === 'scout')));
  assert.equal(trained.state.units.length, 26); record('paid-scouts-trained', trained);
  for (const team of [0, 1]) {
    const id = trained.state.units.find(u => u.team === team && u.kind === 'scout').id;
    await command(team, { type: 'setStance', ids: [id], stance: 'noAttack' }, /STANCE ORDER/);
    journeys.push(tracked(travel(team, id, position(1 - team, [27, 131]), 'scout')));
  }
  const food = await checkpoint(s => s.state.teamFood.every(n => n > 110)); record('natural-food-deposited', food);
  for (const team of [0, 1]) await command(team, { type: 'gather', ids: [workers[team][1]], nodeId: `s${team}-home-wood` }, /GATHER ORDER/);
  await Promise.all(journeys);
  const funded = await checkpoint(s => s.state.teamWood.every(n => n >= 475) && s.state.teamFood.every(n => n >= 100));
  record('natural-expansion-funds-banked', funded);
  for (const team of [0, 1]) await command(team, { type: 'move', ids: workers[team], ...position(team, [62, 88]) }, /MOVE ORDER/);
  await checkpoint(s => workers.every((ids, team) => ids.every(id => {
    const u = unit(s, id), p = position(team, [62, 88]);
    return u.pathIndex >= u.path.length && Math.hypot(u.x - p.x, u.z - p.z) < 4;
  })));
  await build('town-center', workers, [62, 83]);
  await build('house', workers.map(ids => ids.slice(0, 2)), [62, 89]);
  const combat = [];
  for (const team of [0, 1]) {
    const before = clients[team].latest, target = before.homeTownCenters.find(b => b.team !== team);
    assert.ok(target);
    await command(team, { type: 'attackBuilding', ids: [infantry[team][0]], buildingId: target.id }, /ATTACK BUILDING ORDER/);
    const damaged = await clients[team].state(s => s.tick > before.tick && s.homeTownCenters.some(b => b.id === target.id && b.hp < target.hp), 'bounded explicit TC damage');
    combat.push({ team, targetId: target.id, beforeHp: target.hp, afterHp: damaged.homeTownCenters.find(b => b.id === target.id).hp });
    await command(team, { type: 'stop', ids: [infantry[team][0]] }, /STOP ORDER/);
  }
  record('both-seats-expansion-and-bounded-combat', await stopAndReturn(), { combat });
  for (const team of [0, 1]) await command(team, { type: 'stop', ids: clients[team].latest.units.filter(u => u[1] === team).map(u => u[0]) }, /STOP ORDER/);
  await fixture.stop(); const retained = JSON.parse(await readFile(checkpointPath)); record('cold-checkpoint-before', retained);
  await fixture.start(); clients = [await fixture.connect(0, tokens[0], roomId), await fixture.connect(1, tokens[1], roomId)];
  assert.ok(clients.every(c => c.welcome.recoveredFromCheckpoint && c.welcome.player.resumed));
  const restored = await checkpoint(s => s.sequence > retained.sequence);
  assert.equal(restored.matchId, retained.matchId); assert.equal(restored.mapHash, retained.mapHash);
  for (const field of ['teamFood', 'teamWood', 'teamStone', 'resourceNodes', 'buildings']) assert.deepEqual(restored.state[field], retained.state[field]);
  assert.deepEqual(restored.state.units.map(({ id, cargo, cargoType }) => ({ id, cargo, cargoType })),
    retained.state.units.map(({ id, cargo, cargoType }) => ({ id, cargo, cargoType })));
  record('cold-checkpoint-after', restored);
  const resetAfter = clients[0].messages.length; clients[0].send({ type: 'reset' });
  await clients[0].wait(m => m.type === 'notice' && m.message === 'BATTLEFIELD RESET', 'ordinary Practice reset', resetAfter);
  const reset = await checkpoint(s => s.state.buildings.length === 0 && s.state.units.length === 24
    && s.state.teamFood.every(n => n === 150) && s.state.teamWood.every(n => n === 250));
  assert.equal(reset.mapDefinition.id, map.id); assert.deepEqual(reset.state.teamStone, [0, 0]);
  for (const authored of map.resourceNodes) assert.equal(reset.state.resourceNodes.find(n => n.id === authored.id).stock, authored.stock);
  for (const cost of spent) for (const type of Object.keys(cost)) cost[type] = 0;
  record('reset-restores-finite-opening', reset);
  clients[1].socket.close(); await clients[0].state(s => s.connected === 1, 'one-human Large Practice');
  await travel(0, workers[0][0], position(0, [37, 135]), 'one-human-practice-worker');
  const solo = await checkpoint(s => s.state.tickNumber > reset.state.tickNumber + 30 && s.state.scenarioClockStarted);
  record('one-human-practice-clock-and-move', solo);
  await assertDepotSourcesUnchanged(ROOT, sources, { outputDirectory: output });
  assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(), sourceRevision);
  await writeFile(path.join(output, 'source-inputs.json'), JSON.stringify(sources, null, 2) + '\n');
  await writeFile(path.join(output, 'report.json'), JSON.stringify({ sourceRevision, sourceDirty, startedAt, completedAt: new Date().toISOString(),
    nodeVersion: process.version, sourceContentSha256: sources.sourceContentSha256, mapId: map.id, dimensions: [256, 256],
    evidenceType: 'native-authoritative-public-Authored-Practice', matchMode: 'authored@1', actualRootPracticeEntry: true,
    ordinaryCatalogSelection: true, injectedState: false, humanMatches: 0, arrivals, records,
    limits: ['DOM entry and authoritative process evidence; rendered appearance, pointer usability, deployed revision and human balance remain unverified.',
      '24 opening/26 paid units; no large-army capacity claim. Skirmish/PvE admission is separate.'] }, null, 2) + '\n');
  console.log(JSON.stringify({ stage: 'passed', sourceRevision, sourceDirty, output }));
} catch (error) {
  await writeFile(path.join(output, 'failure.json'), JSON.stringify({ sourceRevision, sourceDirty, error: String(error.stack), arrivals, records,
    lastStates: clients.map(c => ({ mapId: c.latest?.mapId, tick: c.latest?.tick, food: c.latest?.food, wood: c.latest?.wood,
      units: c.latest?.units.filter(u => ['worker', 'scout'].includes(u[5])) })) }, null, 2) + '\n');
  throw error;
} finally { page?.window.close(); await fixture.dispose(); }
