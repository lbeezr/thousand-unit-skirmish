import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';

const root = fileURLToPath(new URL('../', import.meta.url)), id = 'veyrholds-crownroads';
assert.ok(process.argv.length === 2 || (process.argv.length === 4 && process.argv[2] === '--output'),
  'Use node scripts/crownroads-practice-scenario.mjs [--output FILE].');
for (const key of Object.keys(process.env)) if (key.startsWith('RTS_')) delete process.env[key];
const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const sourceDirty = Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim());
const inputs = ['scripts/crownroads-practice-scenario.mjs', 'scripts/fortified-crossing-fixture.mjs',
  `maps/${id}.json`, 'server.mjs', 'src/map-utils.mjs', 'src/elevation.mjs', 'src/gameplay-definitions.mjs', 'src/match-modes.mjs'];
const inputSHA256 = Object.fromEntries(await Promise.all(inputs.map(async name =>
  [name, createHash('sha256').update(await readFile(path.join(root, name))).digest('hex')])));
const fixture = await createFortifiedFixture({ mapPath: null, supervisor: true, timeoutMs: 25000 });
const startedAt = new Date().toISOString();
try {
  await fixture.start();
  const response = await fetch(`http://127.0.0.1:${fixture.port}/api/rooms`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'pvp', practice: true }),
  });
  assert.equal(response.status, 201);
  const room = await response.json(), roomId = room.roomId;
  const checkpoint = path.join(fixture.directory, 'rooms', 'rooms', roomId, 'match-state.json');
  let clients = [await fixture.connect(0, null, roomId), await fixture.connect(1, null, roomId)];
  const descriptor = clients[0].welcome.maps.find(map => map.id === id);
  assert.ok(descriptor.ordinarySelectable && descriptor.selectable);
  assert.deepEqual([descriptor.width, descriptor.height], [256, 256]);
  const changed = clients.map(c => c.wait(row => row.type === 'mapChange' && row.map.id === id, 'Large selection', c.messages.length));
  clients[0].send({ type: 'selectMap', mapId: id }); await Promise.all(changed);
  assert.ok(clients.every(c => Buffer.from(c.latest.visibility.data, 'base64').length === 16384));
  const tokens = clients.map(c => c.welcome.player.sessionToken);
  await fixture.stop(); const before = JSON.parse(await readFile(checkpoint, 'utf8'));
  await fixture.start(); clients = [await fixture.connect(0, tokens[0], roomId), await fixture.connect(1, tokens[1], roomId)];
  assert.ok(clients.every(c => c.welcome.recoveredFromCheckpoint && c.welcome.player.resumed));
  const after = await fixture.checkpoint(s => s.sequence > before.sequence, checkpoint);
  assert.equal(after.mapHash, before.mapHash); assert.equal(after.matchId, before.matchId);
  for (const field of ['teamFood', 'teamWood', 'teamStone']) assert.deepEqual(after.state[field], before.state[field]);
  const stocks = s => s.state.resourceNodes.map(({ id, stock }) => ({ id, stock }));
  assert.deepEqual(stocks(after), stocks(before));
  clients[1].socket.close(); await clients[0].state(s => s.connected === 1, 'one-human Large Practice');
  const worker = after.state.units.find(u => u.team === 0 && u.kind === 'worker').id;
  await clients[0].command({ type: 'move', ids: [worker], x: -90.5, z: 7.5, clientOrderToken: 90000 }, /PLANNING MOVE|MOVE ORDER/);
  const solo = await fixture.checkpoint(s => s.state.units[worker].pathIndex >= s.state.units[worker].path.length
    && Math.hypot(s.state.units[worker].x + 90.5, s.state.units[worker].z - 7.5) < 1, checkpoint);
  assert.equal(solo.state.scenarioClockStarted, true);
  const report = { sourceRevision, sourceDirty, inputSHA256, startedAt, finishedAt: new Date().toISOString(),
    evidenceType: 'public-Practice-protocol-smoke', rootDomEntry: false, injectedState: false,
    mapId: id, dimensions: [256, 256], launchOptions: room.launchOptions, packedFogBytesPerSeat: 16384,
    recoveredFromCheckpoint: true, stockAndBankPersistence: true, oneHumanPracticeMove: true,
    limits: ['Initial stocks only; no paid city or full-route arrival acceptance.', 'No rendered/deployed/capacity acceptance.'] };
  if (process.argv[3]) await writeFile(path.resolve(process.argv[3]), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
} finally { await fixture.dispose(); }
