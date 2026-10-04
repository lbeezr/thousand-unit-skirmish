// DOM/root Practice + authoritative processes, not rendered native browser play.
// Real paid commands only; never injects positions, banks, cargo or checkpoints.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { bootGameEntry } from '../src/game-entry.mjs';
import { createWaterUnitRuntime, waterUnitOccupiedCells } from '../src/water-unit-runtime.mjs';
import { createDockPlacementContext } from '../src/dock-placement.mjs';
import { BUILDING_DEFINITIONS, UNIT_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2), option = args.find(arg => arg.startsWith('--output='));
assert.ok(args.length === 0 || (args.length === 1 && option), 'Usage: node scripts/skiff-counterflow-scenario.mjs [--output=NEW_DIRECTORY]');
const output = option ? path.resolve(option.slice(9)) : null;
if (output) await mkdir(output);
for (const key of Object.keys(process.env)) if (key.startsWith('RTS_')) delete process.env[key];
const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const sourceDirty = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim() !== '';
const inputs = ['server.mjs', 'src/water-unit-runtime.mjs', 'maps/siltmouths-confluence-grounds.json', 'scripts/skiff-counterflow-scenario.mjs'];
const hashes = async () => Object.fromEntries(await Promise.all(inputs.map(async file =>
  [file, createHash('sha256').update(await readFile(path.join(root, file))).digest('hex')])));
const sourceHashes = await hashes();
const map = JSON.parse(await readFile(path.join(root, inputs[2]))), water = createWaterUnitRuntime(map);
const dockContext = createDockPlacementContext(map, BUILDING_DEFINITIONS.dock);
const fixture = await createFortifiedFixture({ mapPath: null, supervisor: true, timeoutMs: 100_000 });
let clients, roomId, checkpointPath, tokens, workers, ids, page, order = 1;
const records = [], start = performance.now();
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} versus ${b}`);
const boat = (s, team) => s.state.units[ids[team]];
const stock = s => s.state.resourceNodes.map(({ id, stock }) => ({ id, stock }));
function safe(s) {
  const occupied = new Set();
  for (const unit of s.state.units.filter(unit => unit.kind === 'skiff' && unit.hp > 0)) {
    assert.ok(water.validRoute(unit));
    for (const cell of waterUnitOccupiedCells(water.graph, unit)) {
      assert.ok(!occupied.has(cell), 'authoritative saved hulls never overlap'); occupied.add(cell);
    }
  }
  const food = s.state.resourceNodes.filter(node => node.type === 'food').reduce((sum, node) => sum + node.stock, 0)
    + s.state.units.reduce((sum, unit) => sum + (unit.cargoType === 'food' ? unit.cargo : 0), 0)
    + s.state.teamFood.reduce((sum, value) => sum + value, 0);
  near(food, map.resourceNodes.filter(node => node.type === 'food').reduce((sum, node) => sum + node.stock, 0) + 300);
}
async function checkpoint(predicate = () => true) {
  const s = await fixture.checkpoint(predicate, checkpointPath); safe(s); return s;
}
function record(stage, s) {
  const row = { stage, tick: s.state.tickNumber, wallSeconds: (performance.now() - start) / 1000,
    food: s.state.teamFood, wood: s.state.teamWood,
    boats: ids?.map(id => { const u = s.state.units[id]; return { id, team: u.team, x: u.x, z: u.z,
      goal: u.moveGoalCell, pathIndex: u.pathIndex, pathLength: u.path.length, blocked: u.waterMoveBlocked,
      queued: u.queuedWaypoints, cargo: u.cargo, phase: u.gatherPhase }; }) ?? [] };
  records.push(row); console.log(JSON.stringify(row));
}
const command = (team, value, expression) => clients[team].command({ ...value, clientOrderToken: order++ }, expression);
const move = (team, x, z, queue = false) => command(team, { type: 'move', ids: [ids[team]], x, z, queue }, /SKIFF WATER ROUTE|WAYPOINT QUEUED/);
const arrived = (s, team, x, z) => !boat(s, team).path.length && Math.hypot(boat(s, team).x - x, boat(s, team).z - z) < 1e-7;
async function reconnect(saved) {
  await fixture.start(); clients = [await fixture.connect(0, tokens[0], roomId), await fixture.connect(1, tokens[1], roomId)];
  assert.ok(clients.every(client => client.welcome.recoveredFromCheckpoint && client.welcome.matchId === saved.matchId));
  const restored = await checkpoint(s => s.sequence > saved.sequence);
  assert.deepEqual(restored.state.teamFood, saved.state.teamFood);
  assert.deepEqual(restored.state.teamWood, saved.state.teamWood); assert.deepEqual(stock(restored), stock(saved));
  return restored;
}
async function meeting(z) {
  await clients[0].state(s => ids.every(id => {
    const row = s.units.find(row => row[0] === id);
    return row && Math.abs(row[2]) < .45 && Math.abs(row[3] - z) < .01;
  }), 'opposing paid hulls meet');
  // Four ordinary ticks distinguish reaching adjacent cells from a persistent
  // collision, still within the one-second retry window. No clock override.
  await new Promise(resolve => setTimeout(resolve, 150));
}
try {
  await fixture.start(); const origin = `http://127.0.0.1:${fixture.port}`, navigations = [];
  page = new JSDOM(await (await fetch(origin)).text(), { url: origin });
  await bootGameEntry({ win: page.window, fetchImpl: (url, options) => fetch(new URL(url, origin), options),
    navigate: url => navigations.push(new URL(url)), loadGame() { throw Error('Root Practice must navigate before rendering'); } });
  page.window.document.querySelector('#menu-practice').click();
  const deadline = Date.now() + 15000;
  while (!navigations.length && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(navigations.length, 1); roomId = navigations[0].searchParams.get('room'); assert.ok(roomId);
  const room = await (await fetch(`${origin}/api/rooms/${roomId}`)).json();
  assert.equal(room.launchOptions.practice, true); assert.equal(room.launchOptions.mode, 'pvp');
  checkpointPath = path.join(fixture.directory, 'rooms', 'rooms', roomId, 'match-state.json');
  clients = [await fixture.connect(0, null, roomId), await fixture.connect(1, null, roomId)];
  assert.ok(clients.every(client => client.welcome.state.practice && !client.welcome.state.lobby));
  assert.ok(clients[0].welcome.maps.some(entry => entry.id === map.id));
  const changed = clients.map(client => client.wait(m => m.type === 'mapChange' && m.map.id === map.id, 'canonical Confluence selection', client.messages.length));
  clients[0].send({ type: 'selectMap', mapId: map.id }); await Promise.all(changed);
  tokens = clients.map(client => client.welcome.player.sessionToken);
  workers = clients.map((client, team) => client.latest.units.filter(row => row[1] === team && row[5] === 'worker').map(row => row[0]));
  for (const team of [0, 1]) {
    const army = clients[team].latest.units.filter(row => row[1] === team).map(row => row[0]);
    await command(team, { type: 'stop', ids: army }, /STOP ORDER/);
    await command(team, { type: 'setStance', ids: army, stance: 'noAttack' }, /STANCE ORDER/);
    await command(team, { type: 'build', buildingType: 'dock', ids: workers[team], x: team ? 48.5 : -48.5, z: 23.5 }, /DOCK PLACED/);
  }
  const docks = await checkpoint(s => s.state.buildings.filter(b => b.type === 'dock' && b.complete).length === 2);
  assert.deepEqual(docks.state.teamWood, [150, 150]);
  for (const team of [0, 1]) await command(team, { type: 'trainUnit', kind: 'skiff', buildingId: docks.state.buildings.find(b => b.team === team && b.type === 'dock').id }, /QUEUED/);
  const paid = await checkpoint(s => s.state.units.filter(u => u.kind === 'skiff').length === 2);
  ids = [0, 1].map(team => paid.state.units.find(u => u.team === team && u.kind === 'skiff').id);
  assert.equal(UNIT_DEFINITIONS.skiff.cost.wood, 75); assert.deepEqual(paid.state.teamWood, [75, 75]);
  record('two-paid-docks-and-skiffs', paid);
  for (const team of [0, 1]) {
    await move(team, team ? -42.5 : 42.5, 48.5);
    await move(team, team ? -44.5 : 44.5, 49.5, true);
  }
  await meeting(40.5); await fixture.stop();
  const blocked = JSON.parse(await readFile(checkpointPath)); safe(blocked);
  for (const team of [0, 1]) {
    assert.equal(boat(blocked, team).waterMoveBlocked, true);
    assert.equal(boat(blocked, team).moveGoalCell, team ? 20517 : 20602);
    assert.equal(boat(blocked, team).queuedWaypoints.length, 1);
  }
  record('reciprocal-collision-cold-checkpoint', blocked); await reconnect(blocked);
  const crossed = await checkpoint(s => [0, 1].every(team => arrived(s, team, team ? -44.5 : 44.5, 49.5)));
  record('both-original-goals-and-pending-moves-completed-after-recovery', crossed);
  for (const team of [0, 1]) await move(team, team ? 42.5 : -42.5, 48.5);
  await move(0, -44.5, 49.5, true); await meeting(48.5);
  await command(0, { type: 'stop', ids: [ids[0]] }, /STOP ORDER/);
  const stopped = await checkpoint(s => !boat(s, 0).path.length && !boat(s, 0).queuedWaypoints.length);
  const stoppedBoat = boat(stopped, 0);
  const held = await checkpoint(s => s.state.tickNumber >= stopped.state.tickNumber + 60);
  near(boat(held, 0).x, stoppedBoat.x); near(boat(held, 0).z, stoppedBoat.z);
  assert.equal(boat(held, 0).moveGoalCell, -1); record('selected-stop-keeps-boat-idle-and-clears-pending-intent', held);
  await move(0, -42.5, 52.5);
  const replaced = await checkpoint(s => arrived(s, 0, -42.5, 52.5) && arrived(s, 1, 42.5, 48.5));
  record('replacement-goal-and-other-seat-arrival', replaced);
  for (const team of [0, 1]) await command(team, { type: 'gather', ids: [ids[team]], nodeId: `s${team}-shore-fish` }, /SKIFF/);
  await checkpoint(s => [0, 1].every(team => boat(s, team).cargo > 1 && boat(s, team).cargo < 8));
  for (const team of [0, 1]) await command(team, { type: 'stop', ids: [ids[team]] }, /STOP ORDER/);
  await fixture.stop(); const cargoSaved = JSON.parse(await readFile(checkpointPath)); safe(cargoSaved);
  assert.ok(ids.every(id => cargoSaved.state.units[id].cargo > 0 && !cargoSaved.state.units[id].gatherPhase));
  record('stopped-positive-fish-cargo-cold-checkpoint', cargoSaved);
  const cargoRestored = await reconnect(cargoSaved);
  for (const team of [0, 1]) near(boat(cargoRestored, team).cargo, boat(cargoSaved, team).cargo);
  for (const team of [0, 1]) await command(team, { type: 'returnCargo', ids: [ids[team]] }, /RETURN CARGO/);
  const delivered = await checkpoint(s => ids.every(id => s.state.units[id].cargo === 0));
  for (const team of [0, 1]) {
    near(delivered.state.teamFood[team] - cargoSaved.state.teamFood[team], boat(cargoSaved, team).cargo);
    const dock = delivered.state.buildings.find(b => b.type === 'dock' && b.team === team);
    const access = dockContext.accessAt(water.graph.cellAt(dock.x, dock.z)), unit = boat(delivered, team);
    assert.ok(access.spawnFootprint.some(cell => Math.hypot(unit.x - water.graph.pointAt(cell).x, unit.z - water.graph.pointAt(cell).z) < 1e-7));
    assert.deepEqual(unit.queuedWaypoints, []); assert.equal(unit.gatherPhase, '');
    await command(team, { type: 'returnCargo', ids: [ids[team]] }, /RETURN CARGO REJECTED/);
  }
  assert.deepEqual(delivered.state.teamWood, [75, 75]); record('retained-food-deposited-once-at-owned-docks', delivered);
  assert.deepEqual(await hashes(), sourceHashes, 'loaded runtime, map and scenario sources remain unchanged');
  const report = { evidenceType: 'authoritative-process-and-DOM-proof', sourceRevision, sourceDirty, sourceHashes,
    mapId: map.id, actualRootPracticeEntry: true, injectedState: false, paidWoodPerSeat: 175, records,
    acceptance: { reciprocalPassing: true, pendingQueueColdRecovery: true, selectedStop: true,
      replacement: true, positiveCargoColdRecovery: true, ownedDockDeposits: true },
    limits: 'No rendered browser frames, physical pointer/minimap use, screenshots, deployment or traffic-capacity claim.' };
  if (output) await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ ...report, records: records.map(({ stage }) => stage) }));
} finally { page?.window.close(); await fixture.dispose(); }
