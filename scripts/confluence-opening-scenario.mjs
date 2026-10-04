// Cross-revision proof: real old paid world, unedited room files, current restore/reset.
// Private room/session files stay in disposable fixtures; only projections are published.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { createPveHeadlessFixture } from './pve-headless-fixture.mjs';
import { CONFLUENCE_PRE_OPENING_MAP_HASH } from '../src/confluence-opening-compat.mjs';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2), legacyArg = args.find(a => a.startsWith('--legacy-source=')), outArg = args.find(a => a.startsWith('--output='));
assert.ok(args.length === 2 && legacyArg && outArg,
  'Usage: node scripts/confluence-opening-scenario.mjs --legacy-source=OLD_CLEAN_CHECKOUT --output=NEW_DIRECTORY');
const legacyRoot = path.resolve(legacyArg.slice(16)), output = path.resolve(outArg.slice(9));
await mkdir(output);
for (const key of Object.keys(process.env)) if (key.startsWith('RTS_')) delete process.env[key];
const sha = b => createHash('sha256').update(b).digest('hex');
const mapHash = m => createHash('sha256').update(JSON.stringify(m)).digest('base64url');
const identity = root => ({ revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  dirty: Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim()) });
const source = identity(ROOT), legacySource = identity(legacyRoot);
assert.equal(source.dirty, false); assert.equal(legacySource.dirty, false);
const map = JSON.parse(await readFile(path.join(ROOT, 'maps/siltmouths-confluence-grounds.json')));
const oldMapBytes = await readFile(path.join(legacyRoot, 'maps/siltmouths-confluence-grounds.json'));
assert.equal(sha(oldMapBytes), '12a9b2a71763fde866a02211cc235b38a6574095fab0040ee8582f99bd20acdc');
const oldMap = JSON.parse(oldMapBytes), correctedHash = 'aaJfD4u2B3Bga0xkgDjc7J98Y149wZl1Wc-hpzk6HNI';
const oldFixture = (await import(pathToFileURL(path.join(legacyRoot, 'scripts/fortified-crossing-fixture.mjs')))).createFortifiedFixture;
const inputHashes = {};
for (const [label, root] of [['current', ROOT], ['legacy', legacyRoot]]) for (const file of [
  'server.mjs', 'room-supervisor.mjs', 'scripts/fortified-crossing-fixture.mjs', 'maps/siltmouths-confluence-grounds.json'])
  inputHashes[`${label}:${file}`] = sha(await readFile(path.join(root, file)));
for (const file of ['src/confluence-opening-compat.mjs', 'scripts/confluence-opening-scenario.mjs', 'scripts/pve-headless-fixture.mjs'])
  inputHashes[`current:${file}`] = sha(await readFile(path.join(ROOT, file)));
const records = [], fixtures = [];
let order = 1;
const pos = (team, c, r) => ({ x: (team ? 159 - c : c) - 79.5, z: r - 79.5 });
const make = async factory => { const f = await factory({ mapPath: null, supervisor: true, timeoutMs: 180000 }); fixtures.push(f); return f; };
const command = (room, team, value, pattern) => room.clients[team].command({ ...value, clientOrderToken: order++ }, pattern);
const checkpoint = (room, pred = () => true) => room.f.checkpoint(pred, room.checkpointPath);
const stock = (s, id) => s.state.resourceNodes.find(n => n.id === id);
const sessionIdentities = snapshot => snapshot.state.seatSessions.map(({ id, team, tokenHash }) => ({ id, team, tokenHash }));
function assertSessionIdentities(before, after, description) {
  // Keep private token hashes out of an assertion diff/failure artifact.
  assert.ok(JSON.stringify(sessionIdentities(before)) === JSON.stringify(sessionIdentities(after)), description);
}
const bothConnected = lobby => [0, 1].every(team => lobby.seats.some(seat => seat.team === team && seat.connected));
function record(stage, s, extra = {}) {
  records.push({ stage, tick: s.state.tickNumber, matchId: s.matchId, mapHash: s.mapHash,
    exploredSha256: s.state.explored.map(cells => sha(Buffer.from(cells, 'base64'))),
    banks: { food: s.state.teamFood, wood: s.state.teamWood, stone: s.state.teamStone },
    resources: s.state.resourceNodes.map(({ id, type, stock, x, z }) => ({ id, type, stock, x, z })),
    buildings: s.state.buildings.map(({ id, team, type, complete, x, z, footprint }) => ({ id, team, type, complete, x, z, footprint })),
    actors: s.state.units.filter(u => u.kind === 'worker' || u.kind === 'skiff').map(({ id, team, kind, x, z, cargo, cargoType,
      gatherNodeId, gatherPhase, moveGoalCell, path, pathIndex, queuedWaypoints }) => ({ id, team, kind, x, z, cargo, cargoType,
      gatherNodeId, gatherPhase, moveGoalCell, path, pathIndex, queuedWaypoints })), ...extra });
  console.log(JSON.stringify({ stage, tick: s.state.tickNumber, mapHash: s.mapHash }));
}
function conservation(s, spentWood) {
  for (const type of ['food', 'wood', 'stone']) {
    const supplied = oldMap.resourceNodes.filter(n => n.type === type).reduce((a, n) => a + n.stock, 0) + 2 * (oldMap.startingResources[type] ?? 0);
    const accounted = s.state.resourceNodes.filter(n => n.type === type).reduce((a, n) => a + n.stock, 0)
      + s.state.units.reduce((a, u) => a + (u.cargoType === type ? u.cargo : 0), 0)
      + s.state[type === 'food' ? 'teamFood' : type === 'wood' ? 'teamWood' : 'teamStone'].reduce((a, n) => a + n, 0)
      + (type === 'wood' ? spentWood : 0);
    assert.ok(Math.abs(supplied - accounted) < 1e-5, `${type} conservation`);
  }
}
async function setup(factory, lobby = false) {
  const f = await make(factory); await f.start(); const origin = `http://127.0.0.1:${f.port}`;
  const options = lobby ? { mode: 'pvp', pregame: true, matchModeId: 'authored', matchModeVersion: 1 } : { mode: 'pvp', practice: true };
  const response = await fetch(`${origin}/api/rooms`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(options) });
  assert.equal(response.status, 201); const created = await response.json(), roomId = created.roomId; assert.ok(roomId);
  const clients = [await f.connect(0, null, roomId), await f.connect(1, null, roomId)];
  const room = { f, origin, roomId, clients, checkpointPath: path.join(f.directory, 'rooms', 'rooms', roomId, 'match-state.json') };
  const changes = clients.map(c => c.wait(m => m.type === 'mapChange' && m.map.id === map.id, 'Confluence selection', c.messages.length));
  if (lobby) {
    const joined = await clients[0].wait(m => m.type === 'lobby' && bothConnected(m.lobby), 'both humans admitted');
    clients[0].send({ type: 'configureLobby', mapId: map.id, revision: joined.lobby.revision });
  } else clients[0].send({ type: 'selectMap', mapId: map.id });
  await Promise.all(changes);
  room.tokens = clients.map(c => c.welcome.player.sessionToken);
  room.workers = clients.map((c, team) => c.latest.units.filter(u => u[1] === team && u[5] === 'worker').map(u => u[0]));
  return room;
}
async function launch(room) {
  await room.clients[0].wait(m => m.type === 'lobby' && bothConnected(m.lobby), 'both admitted humans');
  for (const team of [0, 1]) { const c = room.clients[team];
    const revision = [...c.messages].reverse().find(m => m.type === 'lobby').lobby.revision;
    c.send({ type: 'setReady', ready: true, revision });
  }
  const ready = await room.clients[0].wait(m => m.type === 'lobby' && m.lobby.canLaunch, 'both Ready');
  room.clients[0].send({ type: 'launchMatch', revision: ready.lobby.revision });
  await room.clients[0].wait(m => m.type === 'lobby' && m.lobby.phase === 'running', 'ordinary Launch');
}
async function stopCapture(room) { await room.f.stop(); return JSON.parse(await readFile(room.checkpointPath)); }
async function recover(room) {
  const f = await make(createFortifiedFixture);
  await cp(path.join(room.f.directory, 'rooms'), path.join(f.directory, 'rooms'), { recursive: true });
  const next = { ...room, f, origin: `http://127.0.0.1:${f.port}`, clients: [], checkpointPath: path.join(f.directory, 'rooms', 'rooms', room.roomId, 'match-state.json') };
  await f.start();
  // Supervisor health always starts its default room. The public session probe
  // starts this saved invite worker without connecting a peer. Running matches
  // still advance under the existing simulation contract.
  const response = await fetch(`${next.origin}/api/session?room=${room.roomId}`,
    { headers: { 'x-rts-resume-token': room.tokens[0] } });
  assert.equal(response.status, 200); assert.equal((await response.json()).valid, true);
  return next;
}
async function preserved(before, after) {
  assert.equal(after.matchId, before.matchId); assert.equal(after.mapHash, before.mapHash);
  assert.deepEqual(after.mapDefinition, before.mapDefinition);
  assert.equal(after.matchModeId, before.matchModeId); assert.equal(after.matchModeVersion, before.matchModeVersion);
  assertSessionIdentities(before, after, 'cold session identities');
  const fields = ['currentArmySize', 'teamFood', 'teamWood', 'teamStone', 'resourceNodes', 'buildings', 'units', 'explored',
    'forestStocks', 'forestEpoch', 'homeTownCenters', 'workerProduction', 'teamResearch', 'teamUpgrades',
    'triggerStates', 'scenarioEventStates', 'matchElapsedSeconds', 'scenarioClockStarted', 'victoryHoldState',
    'matchWinner', 'matchWinnerReason', 'matchWinnerTriggerId'];
  const unchanged = structuredClone(before);
  assert.ok(before.state.units.every(u => !u.movePlanningPending), 'no pending asynchronous planning at capture');
  assert.equal(after.state.nextMoveOrderId, before.state.nextMoveOrderId, 'no new asynchronous planning in compared interval');
  const witness = await createPveHeadlessFixture(before.mapDefinition,
    { matchModeId: before.matchModeId, matchModeVersion: before.matchModeVersion });
  try {
    // The adapter retains the real authority functions and disables I/O timers.
    // Restore the unedited private snapshot before any simulation step.
    witness.replay.restore(before); const exact = witness.replay.checkpoint();
    assert.equal(exact.mapHash, before.mapHash); assert.equal(exact.matchId, before.matchId);
    assert.deepEqual(exact.mapDefinition, before.mapDefinition);
    assertSessionIdentities(before, exact, 'immediate cold session identities');
    for (const field of fields) {
      assert.ok(Object.hasOwn(before.state, field), `saved ${field} exists`);
      assert.deepEqual(exact.state[field], before.state[field], `immediate cold ${field}`);
    }
    const continuedTicks = after.state.tickNumber - before.state.tickNumber;
    assert.ok(Number.isInteger(continuedTicks) && continuedTicks >= 0 && continuedTicks <= 60, 'bounded no-peer tick continuation');
    for (let tick = 0; tick < continuedTicks; tick++) witness.replay.step();
    const predicted = witness.replay.checkpoint();
    assert.equal(predicted.state.nextMoveOrderId, before.state.nextMoveOrderId);
    assert.ok(after.state.units.every(u => !u.movePlanningPending));
    for (const field of fields) assert.deepEqual(after.state[field], predicted.state[field], `native continued ${field}`);
    assert.ok(JSON.stringify(before) === JSON.stringify(unchanged), 'witness does not edit the source checkpoint');
    return { continuedTicks, immediateExactRestore: true, boundedFixedTickWitness: true };
  } finally { await witness.dispose(); }
}
async function connect(room) {
  room.clients = [await room.f.connect(0, room.tokens[0], room.roomId), await room.f.connect(1, room.tokens[1], room.roomId)];
  assert.ok(room.clients.every(c => c.welcome.recoveredFromCheckpoint));
  assert.ok(room.clients.every((c, team) => c.welcome.player.sessionToken === room.tokens[team]),
    'both seats retain their recovery tokens');
}
async function resetProof(room, before, lobby) {
  const changes = room.clients.map(c => c.wait(m => m.type === 'mapChange' && m.map.id === map.id,
    'explicit reset adopts corrected canonical geometry on each peer', c.messages.length));
  room.clients[0].send({ type: 'reset' }); const messages = await Promise.all(changes);
  for (const message of messages) assert.equal(mapHash(message.map), correctedHash);
  const reset = await checkpoint(room, s => s.mapHash === correctedHash && s.state.buildings.length === 0 && s.state.units.length === before.state.currentArmySize);
  assert.equal(reset.matchId, before.matchId); assert.equal(reset.matchModeId, 'authored'); assert.equal(reset.matchModeVersion, 1);
  assertSessionIdentities(before, reset, 'explicit reset retains session identities');
  assert.deepEqual(reset.state.teamFood, [150, 150]); assert.deepEqual(reset.state.teamWood, [250, 250]); assert.deepEqual(reset.state.teamStone, [0, 0]);
  for (const n of map.resourceNodes) assert.equal(stock(reset, n.id).stock, n.stock);
  for (const n of map.resourceNodes.filter(n => /^s[01]-(berries|timber)$/.test(n.id))) {
    assert.equal(stock(reset, n.id).x, n.x); assert.equal(stock(reset, n.id).z, n.z);
  }
  assert.ok(room.clients.every((c, team) => c.latest.resourceNodes.some(n => n.id === `s${team}-timber` && n.stock === 500)));
  if (lobby) assert.equal(reset.state.pregame.phase, 'lobby');
  record(lobby ? 'human-lobby-explicit-reset' : 'practice-explicit-reset', reset,
    { sameSessionTokens: true, mapChangeReceivedByTeams: [0, 1] });
  return reset;
}
try {
  // Practice case: real legal old House overlaps the future timber cell.
  let room = await setup(oldFixture); let spentWood = 150;
  for (const team of [0, 1]) {
    const ids = room.clients[team].latest.units.filter(u => u[1] === team).map(u => u[0]);
    await command(room, team, { type: 'stop', ids }, /STOP ORDER/);
    await command(room, team, { type: 'setStance', ids, stance: 'noAttack' }, /STANCE ORDER/);
    await command(room, team, { type: 'build', buildingType: 'house', ids: [room.workers[team][0]], ...pos(team, 28, 77) }, /PLACED|PLANNING BUILD/);
  }
  await checkpoint(room, s => [0, 1].every(t => s.state.buildings.some(b => b.team === t && b.type === 'house' && b.complete)));
  for (const team of [0, 1]) await command(room, team, { type: 'move', ids: [room.workers[team][1]], ...pos(team, 29, 71) }, /MOVE ORDER|PLANNING MOVE/);
  await checkpoint(room, s => [0, 1].every(t => { const u = s.state.units[room.workers[t][1]], p = pos(t, 29, 71); return Math.hypot(u.x - p.x, u.z - p.z) < 1; }));
  for (const team of [0, 1]) for (const [slot, suffix] of [[1, 'timber'], [2, 'berries']])
    await command(room, team, { type: 'gather', ids: [room.workers[team][slot]], nodeId: `s${team}-${suffix}` }, /GATHER ORDER/);
  let s = await checkpoint(room, s => [0, 1].every(t => [1, 2].every(i => s.state.units[room.workers[t][i]].cargo > 3)));
  conservation(s, spentWood); record('old-paid-house-partial-stocks-worker-cargo', s);
  for (const team of [0, 1]) await command(room, team, { type: 'build', buildingType: 'dock', ids: [room.workers[team][0]], ...pos(team, 31, 103) }, /PLACED|PLANNING BUILD/);
  spentWood += 200;
  s = await checkpoint(room, s => [0, 1].every(t => s.state.buildings.some(b => b.team === t && b.type === 'dock' && b.complete)));
  for (const team of [0, 1]) await command(room, team, { type: 'trainUnit', kind: 'skiff', buildingId: s.state.buildings.find(b => b.team === team && b.type === 'dock').id }, /QUEUED/);
  spentWood += 150;
  s = await checkpoint(room, s => [0, 1].every(t => s.state.units.some(u => u.team === t && u.kind === 'skiff')));
  room.boats = [0, 1].map(t => s.state.units.find(u => u.team === t && u.kind === 'skiff').id);
  for (const team of [0, 1]) await command(room, team, { type: 'gather', ids: room.workers[team], nodeId: `s${team}-berries` }, /GATHER ORDER/);
  await checkpoint(room, s => [0, 1].every(t => stock(s, `s${t}-berries`).stock === 0));
  for (const team of [0, 1]) {
    await command(room, team, { type: 'stop', ids: room.workers[team] }, /STOP ORDER/);
    await command(room, team, { type: 'returnCargo', ids: room.workers[team] }, /RETURN CARGO/);
    await command(room, team, { type: 'gather', ids: [room.boats[team]], nodeId: `s${team}-shore-fish` }, /SKIFF/);
  }
  await checkpoint(room, s => room.workers.flat().every(id => s.state.units[id].cargo === 0) && room.boats.every(id => s.state.units[id].cargo > 1));
  for (const team of [0, 1]) {
    await command(room, team, { type: 'stop', ids: [room.boats[team]] }, /STOP ORDER/);
    await command(room, team, { type: 'move', ids: [room.workers[team][3]], ...pos(team, 21, 80) }, /MOVE ORDER|PLANNING MOVE/);
  }
  await checkpoint(room, s => [0, 1].every(t => { const u = s.state.units[room.workers[t][3]], p = pos(t, 21, 80); return Math.hypot(u.x - p.x, u.z - p.z) < 1; }));
  for (const team of [0, 1]) {
    await command(room, team, { type: 'move', ids: [room.boats[team]], ...pos(1 - team, 37, 128) }, /SKIFF WATER ROUTE/);
    await command(room, team, { type: 'move', ids: [room.boats[team]], ...pos(team, 40, 125), queue: true }, /WAYPOINT QUEUED/);
    await command(room, team, { type: 'gather', ids: [room.workers[team][3]], nodeId: `s${team}-timber` }, /GATHER ORDER/);
  }
  await checkpoint(room, s => room.boats.every(id => s.state.units[id].queuedWaypoints.length === 1) && [0, 1].every(t => {
    const u = s.state.units[room.workers[t][3]]; return u.gatherPhase === 'to-node' && u.pathIndex < u.path.length;
  }));
  const old = await stopCapture(room); conservation(old, spentWood); assert.equal(old.mapHash, CONFLUENCE_PRE_OPENING_MAP_HASH);
  assert.ok(room.boats.every(id => old.state.units[id].cargo > 0 && old.state.units[id].queuedWaypoints.length === 1));
  for (const team of [0, 1]) assert.ok(old.state.buildings.find(b => b.team === team && b.type === 'house').footprint.includes(76 * 160 + (team ? 130 : 29)));
  record('old-paid-docks-depleted-food-cargo-gather-and-boat-goals', old);
  room = await recover(room); s = await checkpoint(room, s => s.sequence > old.sequence);
  record('first-cross-revision-cold-recovery', s, await preserved(old, s));
  const again = await stopCapture(room); room = await recover(room); s = await checkpoint(room, s => s.sequence > again.sequence);
  record('second-old-definition-resave-recovery', s, await preserved(again, s));
  await connect(room);
  const messageIndex = room.clients[0].messages.length;
  room.clients[0].send({ type: 'selectMap', mapId: map.id });
  await command(room, 1, { type: 'reset' }, /RESET REJECTED/);
  s = await checkpoint(room, s => s.sequence > again.sequence + 1);
  assert.equal(s.mapHash, CONFLUENCE_PRE_OPENING_MAP_HASH); assert.equal(stock(s, 's0-berries').stock, 0);
  assert.ok(!room.clients[0].messages.slice(messageIndex).some(m => m.type === 'mapChange'));
  conservation(s, spentWood); record('ongoing-same-id-selection-and-guest-reset-preserve-old-world', s);
  await checkpoint(room, s => [0, 1].every(t => s.state.teamWood[t] > old.state.teamWood[t]));
  conservation(await checkpoint(room), spentWood); record('legacy-timber-goals-deposit-with-old-house-intact', await checkpoint(room));
  await resetProof(room, old, false);

  // A real waiting legacy human lobby exercises the second reset branch and no-ops.
  let human = await setup(oldFixture, true); const waiting = await stopCapture(human);
  human = await recover(human); s = await checkpoint(human, s => s.sequence > waiting.sequence);
  record('waiting-human-lobby-cold-recovery', s, await preserved(waiting, s)); await connect(human);
  const noOpAt = human.clients[0].messages.length; human.clients[0].send({ type: 'reset' });
  s = await checkpoint(human, s => s.sequence > waiting.sequence + 1);
  assert.equal(s.mapHash, CONFLUENCE_PRE_OPENING_MAP_HASH); assert.deepEqual(s.state.units, waiting.state.units);
  assert.ok(!human.clients[0].messages.slice(noOpAt).some(m => m.type === 'mapChange'));
  for (const armySize of [250]) {
    const after = human.clients[0].messages.length;
    const revision = [...human.clients[0].messages].reverse().find(m => m.type === 'lobby').lobby.revision;
    human.clients[0].send({ type: 'configureLobby', armySize, revision });
    await human.clients[0].wait(m => m.type === 'mapChange' && m.state.armySize === armySize, 'same-ID army configuration', after);
    s = await checkpoint(human, s => s.state.currentArmySize === armySize);
    assert.equal(s.mapHash, CONFLUENCE_PRE_OPENING_MAP_HASH); assert.deepEqual(s.mapDefinition, waiting.mapDefinition);
  }
  record('waiting-lobby-reset-no-op-and-same-id-config-retain-old-definition', s);
  human.workers = human.clients.map((c, team) => c.latest.units.filter(u => u[1] === team && u[5] === 'worker').map(u => u[0]));
  await launch(human);
  for (const team of [0, 1]) {
    const ids = human.clients[team].latest.units.filter(u => u[1] === team && u[5] === 'infantry').map(u => u[0]);
    await command(human, team, { type: 'move', ids, ...pos(team, 21, 95) }, /MOVE ORDER|PLANNING MOVE/);
  }
  await checkpoint(human, s => s.state.units.filter(u => u.kind === 'infantry').every(u => Math.hypot(u.x - pos(u.team, 28, 77).x, u.z - pos(u.team, 28, 77).z) > 4));
  for (const team of [0, 1]) await command(human, team, { type: 'build', buildingType: 'house', ids: [human.workers[team][0]], ...pos(team, 28, 77) }, /PLACED|PLANNING BUILD/);
  s = await checkpoint(human, s => s.state.buildings.length === 2 && s.state.buildings.every(b => b.complete));
  conservation(s, 150); record('legacy-human-paid-house-before-explicit-reset', s);
  await resetProof(human, s, true);
  const upgraded = await checkpoint(human), duplicateAt = human.clients[0].messages.length;
  human.clients[0].send({ type: 'reset' });
  s = await checkpoint(human, s => s.sequence > upgraded.sequence);
  assert.equal(s.mapHash, correctedHash); assert.deepEqual(s.state.units, upgraded.state.units);
  assert.equal(s.state.pregame.revision, upgraded.state.pregame.revision);
  assert.ok(!human.clients[0].messages.slice(duplicateAt).some(m => m.type === 'mapChange'));
  record('corrected-waiting-reset-remains-idempotent', s);
  const fresh = await setup(createFortifiedFixture); s = await checkpoint(fresh);
  assert.equal(s.mapHash, correctedHash);
  assert.ok(fresh.clients.every((c, team) => ['berries', 'timber'].every(suffix => c.latest.resourceNodes.some(n => n.id === `s${team}-${suffix}` && n.stock === (suffix === 'berries' ? 240 : 500)))));
  record('fresh-canonical-opening-food-and-wood-visible', s);
  assert.deepEqual(identity(ROOT), source); assert.deepEqual(identity(legacyRoot), legacySource);
  await writeFile(path.join(output, 'report.json'), JSON.stringify({ status: 'passed', source, legacySource, inputHashes, records,
    checkpointEdits: false, resourceGrants: false, privateSessionStatePublished: false,
    scope: 'Native real old/corrected rooms; no rendered/deployed/capacity claim' }, null, 2) + '\n');
  console.log(JSON.stringify({ status: 'passed', sourceRevision: source.revision, output }));
} catch (error) { await writeFile(path.join(output, 'failure.json'), JSON.stringify({ source, legacySource, error: String(error.stack), records }, null, 2) + '\n'); throw error; }
finally { for (const f of fixtures.reverse()) await f.dispose(); }
