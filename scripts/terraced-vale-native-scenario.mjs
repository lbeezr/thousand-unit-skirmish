import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUILDING_DEFINITIONS } from '../src/gameplay-definitions.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
// Default preserves the accepted Tiny reproduction; Small uses its authored pads.
const mapId = process.argv[2] ?? 'veyrholds-terraced-vale';
const layouts = {
  'veyrholds-terraced-vale': { base: 57.5, park: 68.5, expansion: 39.5, expansionZ: -21.5, house: 31.5 },
  'veyrholds-threefold-basin': { base: 70.5, park: 82.5, expansion: 46.5, expansionZ: -34.5, house: 38.5 },
};
assert.ok(Object.hasOwn(layouts, mapId), 'Specify one of the authored Tiny/Small map IDs.');
const layout = layouts[mapId];
const map = JSON.parse(await readFile(path.join(root, 'maps', `${mapId}.json`)));
const temporary = await mkdtemp(path.join(os.tmpdir(), 'rts-terraced-vale-native-'));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const report = { sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  mapId, mapSHA256: createHash('sha256').update(await readFile(path.join(root, 'maps', `${mapId}.json`))).digest('hex'),
  startedAt: new Date().toISOString(), arrivals: [], economy: [], browserVerified: false, deployedVerified: false };
const emit = (stage, detail) => console.log(JSON.stringify({ stage, ...detail }));
const unit = (state, id) => state.units.find(row => row[0] === id);
const own = (state, team, kind) => state.units.filter(row => row[1] === team && row[4] > 0 && row[5] === kind);
const near = (row, point, radius = 0.8) => row && Math.hypot(row[2] - point.x, row[3] - point.z) <= radius;
let server, port, nextToken = 1;
const clients = [];

async function stopServer() {
  if (!server || server.exitCode !== null || server.signalCode !== null) return;
  const child = server; child.kill('SIGINT');
  let timeout;
  const done = await Promise.race([once(child, 'exit').then(() => true), new Promise(resolve => {
    timeout = setTimeout(() => resolve(false), 5000);
  })]); clearTimeout(timeout);
  if (!done) { child.kill('SIGKILL'); await once(child, 'exit'); }
}
async function startServer(checkpoint, practice = false) {
  const listener = createServer(); listener.listen(0, '127.0.0.1'); await once(listener, 'listening');
  port = listener.address().port; await new Promise(resolve => listener.close(resolve));
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('RTS_')));
  Object.assign(env, { PORT: String(port), RTS_HOST: '127.0.0.1', RTS_CUSTOM_MAP_DIRECTORY: path.join(temporary, 'custom'),
    RTS_MATCH_STATE_PATH: checkpoint, RTS_TICK_DIAGNOSTICS: '1', ...(practice ? { RTS_SOLO_PRACTICE: '1' } : {}) });
  server = spawn(process.execPath, ['server.mjs'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; server.stdout.on('data', chunk => { log += chunk; }); server.stderr.on('data', chunk => { log += chunk; });
  for (let attempt = 0; attempt < 150; attempt++) {
    if (server.exitCode !== null) throw new Error(`Server exited: ${log}`);
    try { const response = await fetch(`http://127.0.0.1:${port}/health`); if (response.ok) return; } catch {}
    await sleep(100);
  }
  throw new Error(`Server health timeout: ${log}`);
}
async function connectClient(team, resumeToken = null) {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`, ['rts-v1', ...(resumeToken ? [`rts-resume.${resumeToken}`] : [])]);
  const waiters = [], history = [];
  const client = { socket, team, current: null, send: command => socket.send(JSON.stringify(command)),
    wait(predicate, timeoutMs = 120000, includeHistory = true) {
      const existing = includeHistory && history.find(predicate); if (existing) return Promise.resolve(existing);
      return new Promise((resolve, reject) => { const waiter = { predicate, resolve, reject,
        timeout: setTimeout(() => { waiters.splice(waiters.indexOf(waiter), 1);
          reject(new Error(`Team ${team} timeout; recent notices ${JSON.stringify(history.filter(row => row.type === 'notice').slice(-5))}`)); }, timeoutMs) };
        waiters.push(waiter); });
    },
    state(predicate, timeoutMs) { if (this.current && predicate(this.current)) return Promise.resolve(this.current);
      return this.wait(row => row.type === 'state' && predicate(row), timeoutMs, false); },
  };
  socket.addEventListener('close', () => {
    for (const waiter of waiters.splice(0)) {
      clearTimeout(waiter.timeout); waiter.reject(new Error(`Team ${team} socket closed while waiting`));
    }
  });
  socket.addEventListener('message', event => { let row; try { row = JSON.parse(event.data); } catch { return; }
    if (row.type === 'state') client.current = row;
    if (row.state) client.current = row.state;
    history.push(row); if (history.length > 100) history.shift();
    for (const waiter of [...waiters]) if (waiter.predicate(row)) {
      waiters.splice(waiters.indexOf(waiter), 1); clearTimeout(waiter.timeout); waiter.resolve(row);
    }
  });
  clients.push(client); client.welcome = await client.wait(row => row.type === 'welcome');
  assert.equal(client.welcome.player.team, team); return client;
}
async function closeClients() {
  await Promise.all(clients.splice(0).map(client => new Promise(resolve => {
    if (client.socket.readyState === WebSocket.CLOSED) return resolve();
    client.socket.addEventListener('close', resolve, { once: true }); client.socket.close();
  })));
}
async function order(client, command, prefix) {
  const token = nextToken++; const began = performance.now();
  const notice = client.wait(row => row.type === 'notice' && row.clientOrderToken === token
    && !row.message.startsWith('PLANNING '));
  client.send({ ...command, clientOrderToken: token });
  const result = await notice; assert.ok(result.message.startsWith(prefix), result.message);
  return { finalNoticeMs: performance.now() - began, message: result.message };
}
// Concurrent journeys are all awaited later; keep early failures handled until then.
function tracked(promise) { promise.catch(() => {}); return promise; }
async function travel(client, id, target, kind) {
  const before = client.current, start = [...unit(before, id)], began = performance.now();
  const accepted = await order(client, { type: 'move', ids: [id], ...target }, 'MOVE ORDER');
  const arrived = await client.state(state => state.tick > before.tick && near(unit(state, id), target));
  const result = { team: client.team, kind, start: { x: start[2], z: start[3] }, target,
    criterion: 'within 0.8 world units of the commanded point', gameSeconds: (arrived.tick - before.tick) / 30,
    wallSeconds: (performance.now() - began) / 1000, finalNoticeMs: accepted.finalNoticeMs,
    final: { x: unit(arrived, id)[2], z: unit(arrived, id)[3] } };
  report.arrivals.push(result); emit('arrival', result); return arrived;
}
async function build(client, type, ids, target) {
  const previous = new Set(client.current.buildings.map(row => row.id));
  const before = { food: client.current.food[client.team], wood: client.current.wood[client.team] };
  await order(client, { type: 'build', buildingType: type, ids, ...target }, `${BUILDING_DEFINITIONS[type].label.toUpperCase()} PLACED`);
  const completed = await client.state(state => state.buildings.some(row => row.team === client.team
    && row.type === type && row.complete && !previous.has(row.id)));
  const building = completed.buildings.find(row => row.team === client.team && row.type === type && row.complete && !previous.has(row.id));
  let persisted;
  for (let attempt = 0; attempt < 50; attempt++) {
    const snapshot = JSON.parse(await readFile(path.join(temporary, 'match.json'), 'utf8'));
    persisted = snapshot.state.buildings.find(row => row.id === building.id && row.complete);
    if (persisted) break;
    await sleep(100);
  }
  assert.ok(persisted, 'completed paid building must enter the authoritative checkpoint');
  report.economy.push({ team: client.team, type, target, before,
    after: { food: completed.food[client.team], wood: completed.wood[client.team] },
    cost: BUILDING_DEFINITIONS[type].cost,
    footprintCells: persisted.footprint.length, completeAtGameSeconds: completed.matchElapsedSeconds });
  emit('paid-building', report.economy.at(-1)); return building;
}

try {
  const checkpoint = path.join(temporary, 'match.json');
  await startServer(checkpoint);
  const seats = [await connectClient(0), await connectClient(1)];
  const entry = seats[0].welcome.maps.find(row => row.id === map.id);
  assert.ok(entry && !entry.name.startsWith('Lab'), 'candidate must appear as a normal regional choice');
  assert.ok(entry.matchModes.some(mode => mode.id === 'skirmish'),
    `Skirmish registry binding for ${map.id} is pending; do not substitute a fixture for ordinary acceptance.`);
  if (seats[0].current.mapId !== map.id) {
    const changes = seats.map(client => client.wait(row => row.type === 'mapChange' && row.map.id === map.id));
    seats[0].send({ type: 'selectMap', mapId: map.id }); await Promise.all(changes);
  }
  assert.equal(seats[0].welcome.matchModeId, 'skirmish');
  report.ordinaryDefaultMode = 'skirmish@1';
  report.normalCatalogEntry = { id: entry.id, name: entry.name, summary: entry.summary };
  report.initialFog = seats.map(client => ({ team: client.team, bytes: Buffer.from(client.current.visibility.data, 'base64').length,
    enemyVisibleUnits: client.current.units.filter(row => row[1] !== client.team).length }));
  for (const row of report.initialFog) { assert.equal(row.bytes, Math.ceil(map.width * map.height / 4)); assert.equal(row.enemyVisibleUnits, 0); }
  emit('ordinary-entry', { mapId: map.id, initialFog: report.initialFog });
  const journeys = seats.map(async client => {
    const team = client.team, sign = team ? 1 : -1, workers = own(client.current, team, 'worker').map(row => row[0]);
    const infantry = own(client.current, team, 'infantry').map(row => row[0]);
    // Keep the economy/travel measurement peaceful using a normal player command.
    // Aggressive idle actors otherwise attack the opposite seat's returning miners.
    await order(client, { type: 'setStance', stance: 'noAttack', ids: infantry }, 'STANCE ORDER');
    client.send({ type: 'move', ids: infantry.slice(1), x: sign * layout.park, z: 14.5 });
    const foot = tracked(travel(client, infantry[0], { x: -sign * layout.base, z: -2.5 }, 'infantry'));
    const worker = tracked(travel(client, workers[0], { x: -sign * layout.base, z: 0.5 }, 'worker')
      .then(() => travel(client, workers[0], { x: sign * layout.base, z: 0.5 }, 'worker-return'))
      .then(() => order(client, { type: 'gather', ids: [workers[0]], nodeId: `s${team}-home-wood` }, 'GATHER ORDER')));
    await order(client, { type: 'gather', ids: [workers[3]], nodeId: `s${team}-home-wood` }, 'GATHER ORDER');
    const stable = await build(client, 'stable', workers.slice(1, 3), { x: sign * layout.base, z: 10.5 });
    await order(client, { type: 'gather', ids: [workers[1]], nodeId: `s${team}-home-food` }, 'GATHER ORDER');
    await order(client, { type: 'gather', ids: [workers[2]], nodeId: `s${team}-home-wood` }, 'GATHER ORDER');
    await order(client, { type: 'trainUnit', buildingId: stable.id, kind: 'scout' }, 'SCOUT QUEUED');
    const spawned = await client.state(state => own(state, team, 'scout').length === 1);
    await order(client, { type: 'setStance', stance: 'noAttack', ids: [own(spawned, team, 'scout')[0][0]] }, 'STANCE ORDER');
    const scout = tracked(travel(client, own(spawned, team, 'scout')[0][0], { x: -sign * layout.base, z: 3.5 }, 'scout'));
    const food = await client.state(state => state.tick >= spawned.tick && state.food[team] > 150 - 40);
    report.economy.push({ team, event: 'paid-food-deposit', stock: food.food[team], gameSeconds: food.matchElapsedSeconds });
    await order(client, { type: 'gather', ids: [workers[1]], nodeId: `s${team}-home-wood` }, 'GATHER ORDER');
    await Promise.all([foot, worker, scout]);
    const saved = await client.state(state => state.wood[team] >= 475 && state.food[team] >= 100, 240000);
    emit('expansion-funded', { team, food: saved.food[team], wood: saved.wood[team], gameSeconds: saved.matchElapsedSeconds });
    const approach = { x: sign * layout.expansion, z: layout.expansionZ + 6 };
    await order(client, { type: 'move', ids: workers, ...approach }, 'MOVE ORDER');
    await client.state(state => workers.every(id => near(unit(state, id), approach, 4)));
    await build(client, 'town-center', workers, { x: sign * layout.expansion, z: layout.expansionZ });
    await build(client, 'house', workers.slice(0, 2), { x: sign * layout.house, z: layout.expansionZ });
    return { team, food: client.current.food[team], wood: client.current.wood[team],
      exploredFogBytes: Buffer.from(client.current.visibility.data, 'base64').length };
  });
  report.finalEconomy = await Promise.all(journeys);
  report.combat = await Promise.all(seats.map(async client => {
    const before = client.current;
    const target = before.homeTownCenters.find(row => row.team !== client.team);
    const attacker = own(before, client.team, 'infantry')[0];
    assert.ok(target && attacker, 'the cross-base Infantry must disclose the opposing home TC');
    await order(client, { type: 'attackBuilding', buildingId: target.id, ids: [attacker[0]] }, 'ATTACK BUILDING ORDER');
    const damaged = await client.state(state => state.tick > before.tick
      && state.homeTownCenters.some(row => row.id === target.id && row.hp < target.hp), 30000);
    const result = { team: client.team, targetId: target.id, beforeHP: target.hp,
      afterHP: damaged.homeTownCenters.find(row => row.id === target.id).hp,
      elapsedGameSeconds: (damaged.tick - before.tick) / 30 };
    await order(client, { type: 'stop', ids: [attacker[0]] }, 'STOP ORDER');
    emit('explicit-building-combat', result); return result;
  }));
  const sessions = seats.map(client => client.welcome.player.sessionToken);
  await closeClients(); await stopServer(); await startServer(checkpoint);
  const recovered = [await connectClient(0, sessions[0]), await connectClient(1, sessions[1])];
  for (const client of recovered) {
    assert.equal(client.welcome.player.resumed, true); assert.equal(client.current.mapId, map.id);
    assert.ok(client.current.buildings.some(row => row.team === client.team && row.type === 'town-center' && row.complete && !row.home));
  }
  report.coldRecovery = true;
  const resets = recovered.map(client => client.wait(row => row.type === 'state' && row.mapId === map.id && row.armySize === 24
    && row.food[client.team] === 150 && row.wood[client.team] === 250 && !row.buildings.some(building => !building.home)));
  recovered[0].send({ type: 'reset' }); await Promise.all(resets); report.rematch = true;
  await closeClients(); await stopServer();
  await startServer(path.join(temporary, 'practice.json'), true);
  const practice = await connectClient(0);
  if (practice.current.mapId !== map.id) {
    const changed = practice.wait(row => row.type === 'mapChange' && row.map.id === map.id);
    practice.send({ type: 'selectMap', mapId: map.id }); await changed;
  }
  const start = practice.current;
  assert.equal(start.practice, true); assert.equal(start.connected, 1);
  const id = own(start, 0, 'worker')[0][0];
  const moved = await travel(practice, id, { x: -layout.base + 9, z: 0.5 }, 'practice-worker');
  assert.equal(moved.scenarioClockStarted, true); report.oneHumanPractice = true;
  report.passed = true;
} catch (error) { report.passed = false; report.error = { name: error.name, message: error.message };
  process.exitCode = 1;
} finally {
  await closeClients(); await stopServer(); await rm(temporary, { recursive: true, force: true });
  report.finishedAt = new Date().toISOString(); emit('final', report);
}
