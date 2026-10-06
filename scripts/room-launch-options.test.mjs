import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { EventEmitter, once } from 'node:events';
import { createServer, request as httpRequest } from 'node:http';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import vm from 'node:vm';
import ts from 'typescript';
import { createRoomIndexStore } from '../src/server/persistence/room-index-store.mjs';
import {
  buildRoomWorkerEnvironment,
  completeRoomLaunchOptions,
  freshRoomLaunchOptions,
  FRESH_PVE_UNSUPPORTED_REASON,
  normalizeRoomIndex,
  normalizeRoomLaunchOptions,
  normalizeRoomMetadata,
  roomIndexDocument,
  roomResponseMetadata,
} from '../src/room-launch-options.mjs';
import { normalizeMatchMode } from '../src/match-modes.mjs';
import { PVE_MAP_IDS, readPveLaunchOptions, selectPveMapId } from '../src/pve-match.mjs';

const roomId = 'a'.repeat(32);

function workerReadyFixture() {
  const source = readFileSync(new URL('../room-supervisor.mjs', import.meta.url), 'utf8');
  const parsed = ts.createSourceFile('room-supervisor.mjs', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const names = ['startWorker', 'readWorkerHealth'];
  const functions = parsed.statements.filter(statement =>
    ts.isFunctionDeclaration(statement) && names.includes(statement.name?.text));
  assert.deepEqual(functions.map(statement => statement.name.text), names);
  const timeoutDeclaration = parsed.statements.find(statement => ts.isVariableStatement(statement)
    && statement.declarationList.declarations.some(declaration => declaration.name.getText(parsed) === 'WORKER_START_TIMEOUT_MS'));
  assert.ok(timeoutDeclaration);
  const child = new EventEmitter();
  child.exitCode = null;
  child.pid = 1;
  const kills = [], timers = [], cleared = [], updates = [];
  child.kill = signal => { kills.push(signal); return true; };
  const workerProcesses = new Set();
  // Execute the actual startup/health functions and timeout constant. Only the
  // child IPC transport and startup clock are synthetic; health uses Node HTTP.
  const context = vm.createContext({ buildRoomWorkerEnvironment, normalizeRoomMetadata,
    NORMAL_HUMAN_MATCH_MODE: { matchModeId: 'skirmish', matchModeVersion: 1 },
    process: { env: {}, execPath: process.execPath }, ROOT: fileURLToPath(new URL('../', import.meta.url)),
    WORKER_PATH: 'server.mjs', workerProcesses, spawn: () => child,
    logWorkerOutput: () => {}, console: { log: () => {} }, httpRequest,
    setTimeout: (callback, milliseconds) => {
      const timer = { callback, milliseconds }; timers.push(timer); return timer;
    },
    clearTimeout: timer => { cleared.push(timer); },
  });
  vm.runInContext([timeoutDeclaration, ...functions].map(statement => statement.getFullText(parsed)).join('\n'), context);
  const pending = context.startWorker('/tmp/ready-contract-maps', '/tmp/ready-contract-match', 'contract',
    { mode: 'pvp' }, (metadata, worker) => updates.push({ metadata, worker }));
  assert.equal(timers.length, 1);
  assert.equal(timers[0].milliseconds, 15_000);
  return { child, pending, kills, timers, cleared, updates, workerProcesses, readHealth: context.readWorkerHealth };
}

test('worker ready ignores malformed ports and accepts later valid readiness with unchanged metadata', async () => {
  for (const port of [undefined, null, '4173', false, -1, 0, .5, NaN, Infinity, 65536, 70000, Number.MAX_SAFE_INTEGER]) {
    const fixture = workerReadyFixture();
    const initial = { mapId: 'underbough-rootways', matchModeId: 'skirmish', matchModeVersion: 1 };
    fixture.child.emit('message', { type: 'ready', port, roomMetadata: initial });
    await Promise.resolve();
    assert.equal(fixture.cleared.length, 0, 'malformed readiness leaves the startup timeout active');
    assert.deepEqual(fixture.kills, []);
    assert.deepEqual(fixture.updates, []);
    fixture.child.emit('message', { type: 'ready', port: 4173, roomMetadata: initial });
    const worker = await fixture.pending;
    assert.equal(worker.port, 4173);
    assert.equal(worker.child, fixture.child);
    assert.equal(JSON.stringify(worker.roomMetadata), JSON.stringify(initial));
    assert.deepEqual(fixture.cleared, [fixture.timers[0]]);
    fixture.child.emit('message', { type: 'ready', port: 65535 });
    assert.equal(worker.port, 4173, 'duplicate readiness cannot replace the worker');
    const updated = { mapId: 'veyrholds-terraced-vale', matchModeId: 'authored', matchModeVersion: 1 };
    fixture.child.emit('message', { type: 'roomMetadata', roomMetadata: updated });
    assert.equal(fixture.updates.length, 1);
    assert.equal(fixture.updates[0].worker, worker);
    assert.equal(JSON.stringify(worker.roomMetadata), JSON.stringify(updated));
    fixture.child.emit('message', { type: 'roomMetadata', roomMetadata: { mapId: '../invalid' } });
    assert.equal(fixture.updates.length, 1);
    fixture.child.emit('error', new Error('late child error'));
    fixture.timers[0].callback();
    assert.deepEqual(fixture.cleared, [fixture.timers[0]], 'settled startup retains its original cleanup');
    fixture.child.emit('exit', 0, null);
    assert.equal(fixture.workerProcesses.size, 0);
    assert.deepEqual(fixture.kills, []);
  }
});

test('worker ready retains port endpoints and existing timeout, error and early-exit cleanup', async () => {
  for (const port of [1, 65535]) {
    const fixture = workerReadyFixture();
    fixture.child.emit('message', { type: 'ready', port });
    assert.equal((await fixture.pending).port, port);
    fixture.child.emit('exit', 0, null);
    assert.equal(fixture.workerProcesses.size, 0);
  }
  for (const stage of ['timeout', 'error', 'exit']) {
    const fixture = workerReadyFixture();
    fixture.child.emit('message', { type: 'ready', port: 65536 });
    const failure = new Error('child startup error');
    const rejected = assert.rejects(fixture.pending, error => stage === 'error'
      ? error === failure : error.message === (stage === 'timeout'
        ? 'contract did not become ready in time.' : 'contract exited before startup (code 1, signal none).'));
    if (stage === 'timeout') fixture.timers[0].callback();
    else if (stage === 'error') fixture.child.emit('error', failure);
    else fixture.child.emit('exit', 1, null);
    await rejected;
    assert.deepEqual(fixture.kills, ['SIGTERM']);
    assert.deepEqual(fixture.cleared, [fixture.timers[0]]);
    if (stage !== 'exit') fixture.child.emit('exit', 1, null);
    assert.equal(fixture.workerProcesses.size, 0);
  }
});

test('later valid worker readiness reaches the actual health consumer successfully', async t => {
  const server = createServer((request, response) => {
    assert.equal(request.url, '/health');
    response.end(JSON.stringify({ ok: true }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const fixture = workerReadyFixture();
  fixture.child.emit('message', { type: 'ready', port: 70000 });
  let reads = 0;
  fixture.child.emit('message', { type: 'ready', get port() { return ++reads === 1 ? server.address().port : 70000; } });
  const worker = await fixture.pending;
  assert.equal(worker.port, server.address().port);
  assert.equal(reads, 1, 'worker keeps the port that passed validation');
  assert.equal((await fixture.readHealth(worker)).ok, true);
  fixture.child.exitCode = 0;
  fixture.child.emit('exit', 0, null);
  assert.equal(await fixture.readHealth(worker), null);
  assert.equal(fixture.workerProcesses.size, 0);
});

async function roomIndexFixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'room-index-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const dataDirectory = path.join(root, 'data');
  const indexPath = path.join(dataDirectory, 'rooms.json');
  return { root, dataDirectory, indexPath, temporaryPath: `${indexPath}.${process.pid}.tmp` };
}

test('room index store captures live state when each serialized write executes', async t => {
  const fixture = await roomIndexFixture(t);
  let timestamp = 1;
  const priorDocuments = [];
  const store = createRoomIndexStore({ ...fixture, captureDocument: () => {
    priorDocuments.push(existsSync(fixture.indexPath) ? readFileSync(fixture.indexPath, 'utf8') : null);
    return roomIndexDocument([{ id: roomId, createdAt: 0, lastActiveAt: timestamp++, launchOptions: { mode: 'pvp' } }]);
  } });
  assert.equal(existsSync(fixture.dataDirectory), false, 'construction performs no I/O');
  const first = store.persist();
  const second = store.persist();
  timestamp = 10;
  assert.equal(priorDocuments.length, 0, 'enqueueing does not capture the document');
  await Promise.all([first, second]);
  const bytes = await readFile(fixture.indexPath, 'utf8');
  assert.equal(priorDocuments[0], null);
  assert.equal(JSON.parse(priorDocuments[1]).rooms[0].lastActiveAt, 10, 'next capture follows the previous rename');
  assert.equal(JSON.parse(bytes).rooms[0].lastActiveAt, 11);
  assert.equal(bytes, JSON.stringify(JSON.parse(bytes)), 'the persisted document remains compact');
  assert.equal((await stat(fixture.indexPath)).mode & 0o777, 0o600);
  assert.equal(existsSync(fixture.temporaryPath), false, 'successful rename consumes the PID temporary file');
});

test('room index store propagates the current capture error and recovers the next queued write', async t => {
  const fixture = await roomIndexFixture(t);
  const failure = new Error('capture failed');
  let captures = 0;
  const store = createRoomIndexStore({ ...fixture, captureDocument: () => {
    if (++captures === 1) throw failure;
    return roomIndexDocument([]);
  } });
  const failed = store.persist();
  const recovered = store.persist();
  await assert.rejects(failed, error => error === failure);
  await recovered;
  assert.equal(captures, 2);
  assert.deepEqual(JSON.parse(await readFile(fixture.indexPath, 'utf8')), roomIndexDocument([]));
});

test('room index serialization remains after directory creation and preserves its error', async t => {
  const fixture = await roomIndexFixture(t);
  const failure = new Error('serialization failed');
  const store = createRoomIndexStore({ ...fixture, captureDocument: () => ({ toJSON() {
    assert.equal(existsSync(fixture.dataDirectory), true);
    throw failure;
  } }) });
  await assert.rejects(store.persist(), error => error === failure);
  assert.equal(existsSync(fixture.temporaryPath), false);
});

test('room index store propagates mkdir, write and rename faults without adding cleanup', async t => {
  for (const stage of ['mkdir', 'write', 'rename']) {
    await t.test(stage, async t => {
      const fixture = await roomIndexFixture(t);
      if (stage === 'mkdir') await writeFile(fixture.dataDirectory, 'directory collision');
      else await mkdir(fixture.dataDirectory);
      if (stage === 'write') await mkdir(fixture.temporaryPath);
      if (stage === 'rename') await mkdir(fixture.indexPath);
      const store = createRoomIndexStore({ ...fixture, captureDocument: () => roomIndexDocument([]) });
      await assert.rejects(store.persist(), error => ['EEXIST', 'EISDIR', 'ENOTDIR'].includes(error.code));
      assert.equal(existsSync(fixture.temporaryPath), stage !== 'mkdir', stage);
      if (stage === 'rename') {
        assert.equal(await readFile(fixture.temporaryPath, 'utf8'), JSON.stringify(roomIndexDocument([])),
          'rename failure leaves the existing temporary payload');
      }
      await rm(stage === 'mkdir' ? fixture.dataDirectory : stage === 'write' ? fixture.temporaryPath : fixture.indexPath,
        { recursive: true });
      await store.persist();
      assert.deepEqual(JSON.parse(await readFile(fixture.indexPath, 'utf8')), roomIndexDocument([]));
    });
  }
});

test('room index read classifies missing and invalid data without creating or repairing files', async t => {
  const fixture = await roomIndexFixture(t);
  const store = createRoomIndexStore({ ...fixture, captureDocument: () => { throw new Error('read captured a write'); } });
  assert.deepEqual(await store.read(), { savedRooms: [], validIndex: false, indexState: 'missing' });
  assert.equal(existsSync(fixture.dataDirectory), false);
  await mkdir(fixture.dataDirectory);
  for (const bytes of ['{', JSON.stringify({ version: 99, rooms: [] }), JSON.stringify({ version: 1,
    rooms: [{ id: roomId, createdAt: 1, lastActiveAt: 2 }, { id: roomId, createdAt: 1, lastActiveAt: 2 }] })]) {
    await writeFile(fixture.indexPath, bytes);
    assert.deepEqual(await store.read(), { savedRooms: [], validIndex: false, indexState: 'invalid' });
    assert.equal(await readFile(fixture.indexPath, 'utf8'), bytes, 'invalid input is retained for host recovery policy');
  }
  await rm(fixture.indexPath);
  await mkdir(fixture.indexPath);
  assert.deepEqual(await store.read(), { savedRooms: [], validIndex: false, indexState: 'invalid' });
});

test('room index read preserves version migrations and document order', async t => {
  const fixture = await roomIndexFixture(t);
  await mkdir(fixture.dataDirectory);
  const store = createRoomIndexStore({ ...fixture, captureDocument: () => roomIndexDocument([]) });
  for (const version of [1, 2, 3]) {
    const document = { version, rooms: [
      { id: roomId, createdAt: 1, lastActiveAt: 2, ...(version === 1 ? {} : { launchOptions: { mode: 'pvp' } }) },
      { id: 'b'.repeat(32), createdAt: 1, lastActiveAt: 9, ...(version === 1 ? {} : { launchOptions: { mode: 'pvp' } }) },
    ] };
    await writeFile(fixture.indexPath, JSON.stringify(document));
    assert.deepEqual(await store.read(), {
      savedRooms: normalizeRoomIndex(document).rooms, validIndex: true, indexState: 'valid',
    });
  }
});

test('room index IDs require primitive strings without coercion across supported versions', () => {
  for (const version of [1, 2, 3]) {
    const entry = id => ({ id, createdAt: 1, lastActiveAt: 2,
      ...(version === 1 ? {} : { launchOptions: { mode: 'pvp' } }) });
    for (const id of [roomId, 'A9_-'.repeat(8), '_'.repeat(32), '-'.repeat(32)]) {
      const document = JSON.parse(JSON.stringify({ version, rooms: [entry(id)] }));
      assert.deepEqual(normalizeRoomIndex(document), {
        version: 3, rooms: [{ ...entry(id), launchOptions: { mode: 'pvp' } }],
      });
      assert.deepEqual(document.rooms[0], entry(id), 'normalization does not mutate the caller');
      assert.equal(normalizeRoomIndex({ version, rooms: [entry(id), entry(id)] }), null,
        'duplicate valid string IDs reject the entire document');
    }
    for (const id of [[roomId], [[roomId]], [], {}, null, undefined, 0, true,
      new String(roomId), { toString() { return roomId; } },
      { toString() { throw new Error('must not coerce an ID'); } },
      Symbol('room'), 1n, '', 'a'.repeat(31), 'a'.repeat(33), 'a'.repeat(31) + '/']) {
      assert.equal(normalizeRoomIndex({ version, rooms: [entry(id)] }), null);
    }
    const duplicateArrays = JSON.parse(JSON.stringify({ version, rooms: [entry([roomId]), entry([roomId])] }));
    assert.equal(normalizeRoomIndex(duplicateArrays), null, 'coercible arrays cannot bypass string duplicate checks');
    let reads = 0;
    const changing = { ...entry(roomId), get id() { return ++reads === 1 ? roomId : [roomId]; } };
    assert.equal(normalizeRoomIndex({ version, rooms: [changing] }).rooms[0].id, roomId,
      'the returned ID is the primitive string that passed validation');
    assert.equal(reads, 1);
  }
});

test('room index store classifies coercible JSON IDs as invalid without rewriting', async t => {
  const fixture = await roomIndexFixture(t);
  await mkdir(fixture.dataDirectory);
  const store = createRoomIndexStore({ ...fixture, captureDocument: () => { throw new Error('read captured a write'); } });
  for (const version of [1, 2, 3]) for (const id of [[roomId], [[roomId]], [], {}, null, true, 0]) {
    const bytes = JSON.stringify({ version, rooms: [{ id, createdAt: 1, lastActiveAt: 2,
      ...(version === 1 ? {} : { launchOptions: { mode: 'pvp' } }) }] });
    await writeFile(fixture.indexPath, bytes);
    assert.deepEqual(await store.read(), { savedRooms: [], validIndex: false, indexState: 'invalid' });
    assert.equal(await readFile(fixture.indexPath, 'utf8'), bytes);
    assert.equal(existsSync(fixture.temporaryPath), false);
  }
});

test('actual supervisor recovers room directories after an index contains an array ID', { timeout: 20_000 }, async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'room-index-id-recovery-'));
  const dataDirectory = path.join(root, 'room-data');
  const directory = path.join(dataDirectory, 'rooms', roomId);
  await mkdir(directory, { recursive: true });
  const retainedPath = path.join(directory, 'retained-data.txt');
  await writeFile(retainedPath, 'existing room data');
  const now = Date.now();
  await writeFile(path.join(dataDirectory, 'rooms.json'), JSON.stringify({ version: 3,
    rooms: [{ id: [roomId], createdAt: now, lastActiveAt: now, launchOptions: { mode: 'pvp' } }] }));
  const child = spawn(process.execPath, [fileURLToPath(new URL('../room-supervisor.mjs', import.meta.url))], {
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    env: { PATH: process.env.PATH, PORT: '0', RTS_HOST: '127.0.0.1',
      RTS_ROOM_DATA_DIRECTORY: dataDirectory, RTS_CUSTOM_MAP_DIRECTORY: path.join(root, 'custom-maps') },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const exited = once(child, 'exit');
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGINT');
      await Promise.race([exited, delay(8000, null, { ref: false })]);
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }
    await exited;
    await rm(root, { recursive: true, force: true });
  });
  const deadline = Date.now() + 10_000;
  let address;
  while (Date.now() < deadline) {
    assert.equal(child.exitCode, null, output);
    address = output.match(/RTS room supervisor listening at (http:\/\/127\.0\.0\.1:\d+) · 1 invite rooms/)?.[1];
    if (address && output.includes('[default room] RTS prototype server listening')) break;
    await delay(20);
  }
  assert.ok(address && output.includes('[default room] RTS prototype server listening'), output);
  assert.equal((await fetch(address)).status, 200);
  assert.match(output, /Room index is malformed or unsupported; preserving room directories and rebuilding the index/);
  assert.match(output, /Recovered 1 room directory missing from the index/);
  assert.equal(await readFile(retainedPath, 'utf8'), 'existing room data');
  const rebuilt = JSON.parse(await readFile(path.join(dataDirectory, 'rooms.json'), 'utf8'));
  assert.equal(rebuilt.version, 3);
  assert.deepEqual(rebuilt.rooms.map(entry => entry.id), [roomId]);
  assert.deepEqual(rebuilt.rooms[0].launchOptions, { mode: 'pvp' });
  assert.deepEqual(normalizeRoomIndex(rebuilt), rebuilt);
});

test('room launch options default to PvP and validate PvE mode and uint32 seeds', () => {
  assert.deepEqual(normalizeRoomLaunchOptions(), { mode: 'pvp' });
  assert.deepEqual(normalizeRoomLaunchOptions({ mode: 'pve', mapSeed: '17', policySeed: 0 }), {
    mode: 'pve', mapSeed: 17, policySeed: 0,
  });
  let generatedSeed = 42;
  assert.deepEqual(completeRoomLaunchOptions({ mode: 'pve' }, () => generatedSeed++), {
    mode: 'pve', mapSeed: 42, policySeed: 43,
  });
  assert.throws(() => normalizeRoomLaunchOptions({ mode: 'coop' }), /pvp.*pve/);
  assert.throws(() => normalizeRoomLaunchOptions({ mode: 'pve', mapSeed: -1 }), /unsigned 32-bit/);
  assert.throws(() => normalizeRoomLaunchOptions({ mode: 'pve', policySeed: 0x1_0000_0000 }), /unsigned 32-bit/);
  assert.throws(() => normalizeRoomLaunchOptions({ mode: 'pvp', mapSeed: 4 }), /do not accept PvE seeds/);
  assert.throws(() => normalizeRoomLaunchOptions({ mode: 'pve', extra: true }), /Unknown room launch option/);
});

test('worker environment carries explicit launch mode and clears inherited PvE settings', () => {
  const inherited = {
    KEEP_ME: 'value', RTS_GAME_MODE: 'pve', RTS_PVE_MAP_SEED: '2', RTS_PVE_POLICY_SEED: '3',
  };
  assert.deepEqual(buildRoomWorkerEnvironment(inherited, { mode: 'pvp' }), {
    KEEP_ME: 'value', RTS_GAME_MODE: 'pvp', RTS_MAP: 'maps/bellweather-millrace.json',
  });
  assert.deepEqual(buildRoomWorkerEnvironment(inherited, {
    mode: 'pve', mapSeed: 2, policySeed: 3,
  }), {
    KEEP_ME: 'value', RTS_GAME_MODE: 'pve', RTS_PVE_MAP_SEED: '2', RTS_PVE_POLICY_SEED: '3',
  });
  assert.throws(() => buildRoomWorkerEnvironment(inherited, { mode: 'pve', mapSeed: 2 }), /both seeds/);
  assert.deepEqual(inherited.RTS_GAME_MODE, 'pve', 'parent environment is not mutated');
});

test('room index v3 persists complete options and migrates v1 rooms to PvP defaults', () => {
  const document = roomIndexDocument([{
    id: roomId, createdAt: 10, lastActiveAt: 20,
    launchOptions: { mode: 'pve', mapSeed: 17, policySeed: 23 }, mapId: 'woodland-expanse',
  }]);
  assert.equal(document.version, 3);
  assert.deepEqual(normalizeRoomIndex(document), document);
  assert.deepEqual(normalizeRoomIndex({
    version: 1, rooms: [{ id: roomId, createdAt: 10, lastActiveAt: 20 }],
  }), {
    version: 3,
    rooms: [{ id: roomId, createdAt: 10, lastActiveAt: 20, launchOptions: { mode: 'pvp' } }],
  });
  assert.equal(normalizeRoomIndex({ version: 2, rooms: [{ id: roomId, createdAt: 10, lastActiveAt: 20,
    launchOptions: { mode: 'pve', mapSeed: 17 } }] }), null, 'persisted PvE options require both seeds');
});

const authored = { matchModeId: 'authored', matchModeVersion: 1 };
const objective = { matchModeId: 'objective-control', matchModeVersion: 1 };
const skirmish = { matchModeId: 'skirmish', matchModeVersion: 1 };
const bannerfall = { matchModeId: 'bannerfall', matchModeVersion: 1 };

test('Bannerfall human and Practice launches carry only explicit mode identity and preserve ordinary defaults', () => {
  const inherited = { KEEP_ME: 'yes', RTS_GAME_MODE: 'pve', RTS_PVE_MAP_SEED: '3', RTS_PVE_POLICY_SEED: '4',
    RTS_MATCH_MODE_ID: 'skirmish', RTS_MATCH_MODE_VERSION: '99', RTS_SOLO_PRACTICE: '1', RTS_PREGAME: '1' };
  const before = { ...inherited };
  for (const [options, expected] of [
    [{ mode: 'pvp', pregame: true, ...bannerfall }, { KEEP_ME: 'yes', RTS_GAME_MODE: 'pvp', RTS_PREGAME: '1',
      RTS_MATCH_MODE_ID: 'bannerfall', RTS_MATCH_MODE_VERSION: '1', RTS_MAP: 'maps/bannerfall-arena.json' }],
    [{ mode: 'pvp', practice: true, ...bannerfall }, { KEEP_ME: 'yes', RTS_GAME_MODE: 'pvp', RTS_SOLO_PRACTICE: '1',
      RTS_MATCH_MODE_ID: 'bannerfall', RTS_MATCH_MODE_VERSION: '1', RTS_MAP: 'maps/bannerfall-arena.json' }],
    [{ mode: 'pvp', ...bannerfall }, { KEEP_ME: 'yes', RTS_GAME_MODE: 'pvp',
      RTS_MATCH_MODE_ID: 'bannerfall', RTS_MATCH_MODE_VERSION: '1', RTS_MAP: 'maps/bannerfall-arena.json' }],
  ]) {
    assert.deepEqual(normalizeRoomLaunchOptions(options), options);
    assert.deepEqual(completeRoomLaunchOptions(options), options);
    assert.deepEqual(buildRoomWorkerEnvironment(inherited, options), expected);
    const room = { id: roomId, createdAt: 1, lastActiveAt: 2, launchOptions: options,
      mapId: 'bannerfall-arena', ...bannerfall };
    const index = roomIndexDocument([room]);
    assert.deepEqual(normalizeRoomIndex(index), index);
    assert.deepEqual(roomResponseMetadata(room), { launchOptions: options, mapId: 'bannerfall-arena',
      ...bannerfall, roomMetadata: { mapId: 'bannerfall-arena', ...bannerfall } });
  }
  assert.deepEqual(inherited, before);
  assert.deepEqual(normalizeRoomLaunchOptions(), { mode: 'pvp' });
  assert.deepEqual(buildRoomWorkerEnvironment(inherited, {}), {
    KEEP_ME: 'yes', RTS_GAME_MODE: 'pvp', RTS_MAP: 'maps/bellweather-millrace.json',
  });
  assert.throws(() => normalizeRoomLaunchOptions({ pregame: true, practice: true, ...bannerfall }), /Practice starts/);
});

test('Bannerfall rejects AI before seed generation with its own capability explanation', () => {
  let generated = 0;
  for (const options of [{ mode: 'pve', ...bannerfall }, { mode: 'pve', mapSeed: 3, policySeed: 4, ...bannerfall }]) {
    assert.throws(() => completeRoomLaunchOptions(options, () => generated++), error =>
      /Bannerfall supports human matches and Practice; its AI is not implemented/.test(error.message)
        && !/Skirmish|base-elimination/.test(error.message));
    assert.throws(() => buildRoomWorkerEnvironment({}, options), /Bannerfall.*AI is not implemented/);
  }
  assert.equal(generated, 0);
  assert.throws(() => normalizeRoomLaunchOptions({ matchModeId: 'bannerfall' }), /requires both/);
  assert.throws(() => normalizeRoomLaunchOptions({ ...bannerfall, matchModeVersion: 2 }), /Unsupported matchModeVersion/);
});

test('Bannerfall room preset overrides an inherited map while ordinary rooms retain it', () => {
  const inherited = { RTS_MAP: 'maps/bellweather-millrace.json' };
  assert.equal(buildRoomWorkerEnvironment(inherited, { mode: 'pvp', ...bannerfall }).RTS_MAP,
    'maps/bannerfall-arena.json');
  assert.equal(buildRoomWorkerEnvironment(inherited, { mode: 'pvp' }).RTS_MAP,
    'maps/bellweather-millrace.json');
  assert.deepEqual(inherited, { RTS_MAP: 'maps/bellweather-millrace.json' });
});

test('explicit paired match modes preserve human launch settings and reject invalid identities', () => {
  for (const identity of [authored, objective, skirmish]) {
    for (const options of [{ mode: 'pvp', ...identity }, { mode: 'pvp', pregame: true, ...identity },
      { mode: 'pvp', practice: true, ...identity }]) {
      assert.deepEqual(normalizeRoomLaunchOptions(options), options);
      assert.deepEqual(completeRoomLaunchOptions(options), options);
    }
  }
  for (const invalid of [{ matchModeId: 'skirmish' }, { matchModeVersion: 1 },
    { matchModeId: 'unknown', matchModeVersion: 1 }, { ...skirmish, matchModeVersion: '1' },
    { ...skirmish, matchModeVersion: 2 }]) {
    assert.throws(() => normalizeRoomLaunchOptions(invalid), /Match mode requires both|Unsupported matchMode/);
  }
});

test('complete launch normalization accepts explicit Tiny Skirmish and preserves historical identities', () => {
  for (const identity of [authored, objective, skirmish]) {
    let seed = 41;
    assert.deepEqual(completeRoomLaunchOptions({ mode: 'pve', ...identity }, () => seed++), {
      mode: 'pve', ...identity, mapSeed: 41, policySeed: 42,
    });
    assert.deepEqual(completeRoomLaunchOptions({ mode: 'pve', ...identity, mapSeed: 7, policySeed: 8 }), {
      mode: 'pve', ...identity, mapSeed: 7, policySeed: 8,
    });
  }
});

test('worker environment clears inherited mode identity and writes only explicit pairs', () => {
  const inherited = { KEEP_ME: 'yes', RTS_GAME_MODE: 'pve', RTS_MATCH_MODE_ID: 'skirmish',
    RTS_MATCH_MODE_VERSION: '88', RTS_SOLO_PRACTICE: '1', RTS_PREGAME: '1' };
  assert.deepEqual(buildRoomWorkerEnvironment(inherited, { mode: 'pvp' }), {
    KEEP_ME: 'yes', RTS_GAME_MODE: 'pvp', RTS_MAP: 'maps/bellweather-millrace.json',
  });
  assert.deepEqual(buildRoomWorkerEnvironment(inherited, { mode: 'pvp', practice: true, ...skirmish }), {
    KEEP_ME: 'yes', RTS_GAME_MODE: 'pvp', RTS_SOLO_PRACTICE: '1',
    RTS_MATCH_MODE_ID: 'skirmish', RTS_MATCH_MODE_VERSION: '1',
    RTS_MAP: 'maps/veyrholds-terraced-vale.json',
  });
  assert.deepEqual(buildRoomWorkerEnvironment(inherited, { mode: 'pve', mapSeed: 3, policySeed: 4, ...objective }), {
    KEEP_ME: 'yes', RTS_GAME_MODE: 'pve', RTS_PVE_MAP_SEED: '3', RTS_PVE_POLICY_SEED: '4',
    RTS_MATCH_MODE_ID: 'objective-control', RTS_MATCH_MODE_VERSION: '1',
  });
  assert.equal(inherited.RTS_MATCH_MODE_VERSION, '88');
});

test('worker metadata requires a valid map and complete known mode pair when explicit', () => {
  assert.deepEqual(normalizeRoomMetadata({ mapId: 'bellweather-millrace', ...skirmish }), {
    mapId: 'bellweather-millrace', ...skirmish,
  });
  for (const invalid of [{ ...skirmish }, { mapId: '../bad', ...skirmish },
    { mapId: 'bellweather-millrace', matchModeId: 'skirmish' },
    { mapId: 'bellweather-millrace', matchModeVersion: 1 },
    { mapId: 'bellweather-millrace', ...skirmish, matchModeVersion: 2 },
    { mapId: 'bellweather-millrace', matchModeId: 'unknown', matchModeVersion: 1 }]) {
    assert.equal(normalizeRoomMetadata(invalid), null);
  }
});

test('room API reports effective worker identity ahead of initial launch identity', () => {
  const launchOptions = Object.freeze({ mode: 'pvp', pregame: true, ...objective });
  assert.deepEqual(roomResponseMetadata({ launchOptions, mapId: 'bellweather-millrace', ...skirmish }), {
    launchOptions, mapId: 'bellweather-millrace', ...skirmish,
    roomMetadata: { mapId: 'bellweather-millrace', ...skirmish },
  });
  assert.deepEqual(roomResponseMetadata({ launchOptions }), { launchOptions, ...objective });
  assert.deepEqual(roomResponseMetadata({ launchOptions, mapId: 'bellweather-millrace' }), {
    launchOptions, mapId: 'bellweather-millrace', ...objective,
    roomMetadata: { mapId: 'bellweather-millrace', ...objective },
  });
  assert.deepEqual(launchOptions, { mode: 'pvp', pregame: true, ...objective });
});

test('index v3 independently round-trips initial and effective identity', () => {
  const room = { id: roomId, createdAt: 10, lastActiveAt: 20,
    launchOptions: { mode: 'pvp', pregame: true, ...objective },
    mapId: 'underbough-rootways', ...skirmish };
  const document = roomIndexDocument([room]);
  assert.deepEqual(document, { version: 3, rooms: [room] });
  assert.deepEqual(normalizeRoomIndex(document), document);
  for (const invalid of [{ ...room, matchModeVersion: 2 }, { ...room, mapId: null }]) {
    assert.equal(normalizeRoomIndex({ version: 3, rooms: [invalid] }), null);
    assert.throws(() => roomIndexDocument([invalid]), /Invalid room metadata/);
  }
  const partial = { ...room }; delete partial.matchModeVersion;
  assert.equal(normalizeRoomIndex({ version: 3, rooms: [partial] }), null);
});

test('legacy index versions migrate without inventing explicit mode fields', () => {
  const entry = { id: roomId, createdAt: 10, lastActiveAt: 20 };
  assert.deepEqual(normalizeRoomIndex({ version: 1, rooms: [entry] }), {
    version: 3, rooms: [{ ...entry, launchOptions: { mode: 'pvp' } }],
  });
  const legacyPve = { ...entry, launchOptions: { mode: 'pve', mapSeed: 4, policySeed: 8 },
    mapId: 'woodland-expanse' };
  assert.deepEqual(normalizeRoomIndex({ version: 2, rooms: [legacyPve] }), { version: 3, rooms: [legacyPve] });
  assert.deepEqual(normalizeRoomIndex({ version: 3, rooms: [legacyPve] }), { version: 3, rooms: [legacyPve] });
  for (const version of [1, 2]) {
    for (const invalid of [{ ...legacyPve, ...authored },
      { ...legacyPve, launchOptions: { ...legacyPve.launchOptions, ...objective } },
      { ...legacyPve, roomMetadata: { mapId: legacyPve.mapId, ...skirmish } }]) {
      assert.equal(normalizeRoomIndex({ version, rooms: [invalid] }), null);
    }
  }
  assert.equal(normalizeRoomIndex({ version: 4, rooms: [legacyPve] }), null);
});

test('worker room metadata only accepts a bounded map identifier', () => {
  assert.deepEqual(normalizeRoomMetadata({ mapId: 'woodland-expanse' }), { mapId: 'woodland-expanse' });
  assert.equal(normalizeRoomMetadata(null), null);
  assert.equal(normalizeRoomMetadata({ mapId: '../rooms' }), null);
  assert.equal(normalizeRoomMetadata({ mapId: 'x'.repeat(129) }), null);
  assert.deepEqual(roomResponseMetadata({
    launchOptions: { mode: 'pve', mapSeed: 17, policySeed: 23 }, mapId: 'woodland-expanse',
  }), {
    launchOptions: { mode: 'pve', mapSeed: 17, policySeed: 23 },
    mapId: 'woodland-expanse',
    roomMetadata: { mapId: 'woodland-expanse' },
  });
});

test('pregame opts in only PvP rooms and survives worker/index round trips', () => {
  const options = { mode: 'pvp', pregame: true };
  assert.deepEqual(completeRoomLaunchOptions(options), options);
  assert.deepEqual(normalizeRoomLaunchOptions({ pregame: false }), { mode: 'pvp' });
  assert.throws(() => normalizeRoomLaunchOptions({ mode: 'pve', pregame: true }));
  assert.throws(() => normalizeRoomLaunchOptions({ pregame: 'true' }));
  assert.equal(buildRoomWorkerEnvironment({ RTS_PREGAME: '1' }, { mode: 'pvp' }).RTS_PREGAME, undefined);
  assert.equal(buildRoomWorkerEnvironment({}, options).RTS_PREGAME, '1');
  const document = roomIndexDocument([{ id: roomId, createdAt: 1, lastActiveAt: 2, launchOptions: options }]);
  assert.deepEqual(normalizeRoomIndex(document), document);
});

test('practice is explicit, isolated from AI/pregame and survives room recovery', () => {
  const options = { mode: 'pvp', practice: true };
  assert.deepEqual(completeRoomLaunchOptions(options), options);
  assert.deepEqual(normalizeRoomLaunchOptions({ practice: false }), { mode: 'pvp' });
  for (const invalid of [{ mode: 'pve', practice: true }, { mode: 'pve', practice: false },
    { practice: 'true' }, { practice: true, pregame: true }]) {
    assert.throws(() => normalizeRoomLaunchOptions(invalid), /Practice|Practice starts/);
  }
  const inherited = { RTS_SOLO_PRACTICE: '1', RTS_PREGAME: '1' };
  assert.deepEqual(buildRoomWorkerEnvironment(inherited, options), {
    RTS_GAME_MODE: 'pvp', RTS_SOLO_PRACTICE: '1', RTS_MAP: 'maps/bellweather-millrace.json',
  });
  assert.equal(buildRoomWorkerEnvironment(inherited, { mode: 'pvp' }).RTS_SOLO_PRACTICE, undefined);
  assert.equal(buildRoomWorkerEnvironment(inherited, { mode: 'pvp', pregame: true }).RTS_SOLO_PRACTICE, undefined);
  assert.equal(buildRoomWorkerEnvironment(inherited, { mode: 'pve', mapSeed: 1, policySeed: 2 }).RTS_SOLO_PRACTICE, undefined);
  assert.deepEqual(inherited, { RTS_SOLO_PRACTICE: '1', RTS_PREGAME: '1' });
  const document = roomIndexDocument([{ id: roomId, createdAt: 1, lastActiveAt: 2, launchOptions: options }]);
  assert.deepEqual(normalizeRoomIndex(document), document);
  assert.deepEqual(roomResponseMetadata({ launchOptions: options }), { launchOptions: options });
});

test('fresh pregame selects Skirmish while Practice and plain authoring select explicit Authored', () => {
  for (const [options, identity] of [[{ pregame: true }, skirmish], [{ mode: 'pvp', pregame: true }, skirmish],
    [{ practice: true }, authored], [{ mode: 'pvp', practice: true }, authored]]) {
    const before = structuredClone(options);
    assert.deepEqual(freshRoomLaunchOptions(options), { mode: 'pvp', ...options, ...identity });
    assert.deepEqual(options, before);
  }
  for (const options of [undefined, null, {}, { mode: 'pvp' }, { pregame: false }, { practice: false }]) {
    assert.deepEqual(freshRoomLaunchOptions(options), { mode: 'pvp', ...authored });
  }
  for (const identity of [authored, objective, skirmish]) {
    for (const options of [{ mode: 'pvp', ...identity }, { mode: 'pvp', pregame: true, ...identity },
      { mode: 'pvp', practice: true, ...identity }]) {
      assert.deepEqual(freshRoomLaunchOptions(options), options, 'explicit selections are retained');
    }
  }
  for (const options of [{ matchModeId: 'skirmish' }, { matchModeVersion: 1 },
    { ...skirmish, matchModeVersion: 2 }, { practice: true, pregame: true }]) {
    assert.throws(() => freshRoomLaunchOptions(options));
  }
});

test('fresh PvE chooses explicit Tiny Skirmish and keeps supplied seeds without mutating options', () => {
  for (const options of [{ mode: 'pve' }, { mode: 'pve', ...skirmish },
    { mode: 'pve', mapSeed: 0, policySeed: 0xffffffff }]) {
    const before = structuredClone(options);
    assert.deepEqual(freshRoomLaunchOptions(options), { ...options, ...skirmish });
    assert.deepEqual(options, before);
    let next = 41;
    const completed = completeRoomLaunchOptions(freshRoomLaunchOptions(options), () => next++);
    assert.deepEqual(completed, { mode: 'pve', ...skirmish,
      mapSeed: options.mapSeed ?? 41, policySeed: options.policySeed ?? 42 });
  }
});

test('fresh unsupported AI identities reject before seed completion while saved AI stays usable', () => {
  let generated = 0;
  for (const options of [{ mode: 'pve', ...authored }, { mode: 'pve', ...objective }]) {
    const before = structuredClone(options);
    assert.throws(() => completeRoomLaunchOptions(freshRoomLaunchOptions(options), () => generated++),
      error => error instanceof TypeError && error.message === FRESH_PVE_UNSUPPORTED_REASON);
    assert.deepEqual(options, before);
  }
  for (const invalid of [{ mode: 'pve', matchModeId: 'skirmish' },
    { mode: 'pve', ...skirmish, matchModeVersion: 2 },
    { mode: 'pve', mapId: 'veyrholds-threefold-basin' }]) {
    assert.throws(() => completeRoomLaunchOptions(freshRoomLaunchOptions(invalid), () => generated++));
  }
  assert.equal(generated, 0);
  assert.match(FRESH_PVE_UNSUPPORTED_REASON, /160 × 160 Terraced Vale.*Skirmish@1/);
  assert.match(FRESH_PVE_UNSUPPORTED_REASON, /Existing AI rooms can still be resumed/);
  const saved = { mode: 'pve', mapSeed: 0, policySeed: 0xffffffff };
  assert.deepEqual(completeRoomLaunchOptions(saved, () => generated++), saved);
  assert.equal(generated, 0, 'restoration keeps existing seeds');
});

test('explicit Tiny Skirmish ignores inherited maps and every seed preserves its supported preset', () => {
  const inherited = Object.freeze({ RTS_MAP: 'maps/veyrholds-threefold-basin.json', KEEP_ME: 'yes' });
  for (const mapSeed of [0, 1, 2, 0xfffffffe, 0xffffffff]) {
    const options = completeRoomLaunchOptions(freshRoomLaunchOptions({ mode: 'pve', mapSeed, policySeed: 17 }));
    const environment = buildRoomWorkerEnvironment(inherited, options, { mapId: 'underbough-rootways', ...authored });
    assert.equal(environment.RTS_MAP, 'maps/veyrholds-terraced-vale.json');
    assert.deepEqual(readPveLaunchOptions(environment), {
      mode: 'pve', mapSeed, policySeed: 17, mapId: 'veyrholds-terraced-vale',
    });
    const room = { id: roomId, createdAt: 1, lastActiveAt: 2, launchOptions: options,
      mapId: 'veyrholds-terraced-vale', ...skirmish };
    assert.deepEqual(normalizeRoomIndex(roomIndexDocument([room])).rooms[0], room);
    assert.equal(environment.KEEP_ME, 'yes');
  }
  assert.equal(inherited.RTS_MAP, 'maps/veyrholds-threefold-basin.json');
  for (const fields of [{ RTS_MATCH_MODE_ID: 'skirmish' }, { RTS_MATCH_MODE_VERSION: '1' },
    { RTS_MATCH_MODE_ID: 'skirmish', RTS_MATCH_MODE_VERSION: '2' },
    { RTS_MATCH_MODE_ID: 'skirmish', RTS_MATCH_MODE_VERSION: '1.0' }]) {
    assert.throws(() => readPveLaunchOptions({ RTS_GAME_MODE: 'pve', RTS_PVE_MAP_SEED: '0',
      RTS_PVE_POLICY_SEED: '17', ...fields }), /requires both|Unsupported matchMode/);
  }
});

test('legacy omitted identities stay Authored through normalization and all accepted index versions', () => {
  for (const options of [undefined, { mode: 'pvp' }, { mode: 'pvp', pregame: true },
    { mode: 'pvp', practice: true }, { mode: 'pve', mapSeed: 17, policySeed: 23 }]) {
    const normalized = normalizeRoomLaunchOptions(options);
    assert.deepEqual(normalizeMatchMode(normalized), authored);
    assert.equal(Object.hasOwn(normalized, 'matchModeId'), false);
    assert.equal(Object.hasOwn(normalized, 'matchModeVersion'), false);
  }
  const entry = { id: roomId, createdAt: 10, lastActiveAt: 20 };
  for (const version of [1, 2, 3]) {
    const room = version === 1 ? entry : { ...entry, launchOptions: { mode: 'pvp', pregame: true } };
    const normalized = normalizeRoomIndex({ version, rooms: [room] });
    assert.deepEqual(normalizeMatchMode(normalized.rooms[0].launchOptions), authored);
    assert.deepEqual(normalized.rooms[0].launchOptions,
      version === 1 ? { mode: 'pvp' } : { mode: 'pvp', pregame: true });
    assert.equal(Object.hasOwn(normalized.rooms[0], 'matchModeId'), false);
    assert.equal(Object.hasOwn(normalized.rooms[0], 'matchModeVersion'), false);
  }
});

test('fresh mode identity overrides inherited maps; omitted legacy identity preserves its historical map', () => {
  const parent = Object.freeze({ KEEP_ME: 'yes', RTS_MAP: 'maps/underbough-rootways.json',
    RTS_MATCH_MODE_ID: 'skirmish', RTS_MATCH_MODE_VERSION: '88' });
  for (const legacy of [{ mode: 'pvp' }, { mode: 'pvp', pregame: true }, { mode: 'pvp', practice: true }]) {
    const environment = buildRoomWorkerEnvironment(parent, legacy);
    assert.equal(environment.RTS_MAP, parent.RTS_MAP);
    assert.equal(environment.RTS_MATCH_MODE_ID, undefined);
    assert.equal(environment.RTS_MATCH_MODE_VERSION, undefined);
  }
  for (const [options, map] of [
    [{ pregame: true }, 'veyrholds-terraced-vale'],
    [{ practice: true }, 'veyrholds-terraced-vale'],
    [{}, 'veyrholds-terraced-vale'],
    [{ pregame: true, ...objective }, 'woodland-expanse'],
  ]) {
    const fresh = freshRoomLaunchOptions(options);
    const environment = buildRoomWorkerEnvironment(parent, fresh);
    assert.equal(environment.RTS_MAP, `maps/${map}.json`);
    assert.equal(environment.RTS_MATCH_MODE_ID, fresh.matchModeId);
    assert.equal(environment.RTS_MATCH_MODE_VERSION, '1');
    assert.equal(environment.KEEP_ME, 'yes');
  }
  const legacyAi = buildRoomWorkerEnvironment(parent, { mode: 'pve', mapSeed: 3, policySeed: 5, ...objective });
  assert.equal(legacyAi.RTS_MAP, parent.RTS_MAP, 'PvE restoration keeps its seed-owned map selection');
  assert.equal(readPveLaunchOptions(legacyAi).mapId, 'underbough-rootways');
  assert.equal(parent.RTS_MAP, 'maps/underbough-rootways.json');
});

test('legacy PvE seeds keep the exact curated map pool independently of fresh admission', () => {
  assert.deepEqual(PVE_MAP_IDS, ['bellweather-millrace', 'underbough-rootways']);
  for (const [seed, mapId] of [[0, 'bellweather-millrace'], [1, 'underbough-rootways'],
    [2, 'bellweather-millrace'], [0xfffffffe, 'bellweather-millrace'], [0xffffffff, 'underbough-rootways']]) {
    assert.equal(selectPveMapId(seed), mapId);
    const options = completeRoomLaunchOptions({ mode: 'pve', mapSeed: seed, policySeed: 17 });
    const entry = { id: roomId, createdAt: 10, lastActiveAt: 20, launchOptions: options, mapId };
    const restored = normalizeRoomIndex({ version: 2, rooms: [entry] }).rooms[0];
    assert.deepEqual(restored, entry);
    assert.deepEqual(normalizeMatchMode(restored.launchOptions), authored);
    const environment = buildRoomWorkerEnvironment({}, restored.launchOptions);
    assert.deepEqual(readPveLaunchOptions(environment), { mode: 'pve', mapSeed: seed, policySeed: 17, mapId });
  }
});

test('explicit historical Authored and Objective Control retain the exact direct seeded map pool', () => {
  for (const identity of [authored, objective]) {
    for (const [mapSeed, mapId] of [[0, 'bellweather-millrace'], [1, 'underbough-rootways'],
      [0xfffffffe, 'bellweather-millrace'], [0xffffffff, 'underbough-rootways']]) {
      const launch = Object.freeze({ mode: 'pve', ...identity, mapSeed, policySeed: 17 });
      const environment = buildRoomWorkerEnvironment({ RTS_MAP: 'maps/veyrholds-terraced-vale.json' }, launch);
      assert.deepEqual(readPveLaunchOptions(environment), { mode: 'pve', mapSeed, policySeed: 17, mapId });
      assert.deepEqual(normalizeRoomLaunchOptions(launch), launch);
      assert.equal(environment.RTS_MAP, 'maps/veyrholds-terraced-vale.json', 'historical PvE seeds still own selection');
    }
  }
});

test('verified saved map and effective identity override fresh defaults without mutating launch options', () => {
  const parent = Object.freeze({ RTS_MAP: 'maps/veyrholds-terraced-vale.json', KEEP_ME: 'yes' });
  const launch = Object.freeze({ mode: 'pvp', pregame: true, ...authored });
  const metadata = Object.freeze({ mapId: 'underbough-rootways', ...skirmish });
  assert.deepEqual(buildRoomWorkerEnvironment(parent, launch, metadata), {
    RTS_MAP: 'maps/underbough-rootways.json', KEEP_ME: 'yes', RTS_GAME_MODE: 'pvp', RTS_PREGAME: '1',
    RTS_MATCH_MODE_ID: 'skirmish', RTS_MATCH_MODE_VERSION: '1',
  });
  assert.deepEqual(launch, { mode: 'pvp', pregame: true, ...authored });
  assert.deepEqual(metadata, { mapId: 'underbough-rootways', ...skirmish });
  assert.deepEqual(parent, { RTS_MAP: 'maps/veyrholds-terraced-vale.json', KEEP_ME: 'yes' });
  assert.deepEqual(buildRoomWorkerEnvironment(parent, { mode: 'pvp' }, { mapId: 'stonepass-crossing' }), {
    RTS_MAP: 'maps/stonepass-crossing.json', KEEP_ME: 'yes', RTS_GAME_MODE: 'pvp',
  }, 'historical omitted identity remains omitted and therefore Authored');
  const legacyAi = buildRoomWorkerEnvironment(parent, { mode: 'pve', mapSeed: 0, policySeed: 17 }, metadata);
  assert.equal(legacyAi.RTS_MAP, parent.RTS_MAP);
  assert.equal(legacyAi.RTS_MATCH_MODE_ID, undefined);
  assert.deepEqual(readPveLaunchOptions(legacyAi), {
    mode: 'pve', mapSeed: 0, policySeed: 17, mapId: 'bellweather-millrace',
  }, 'saved metadata cannot replace seed-owned PvE launch semantics');
  for (const invalid of [{ mapId: '../bad', ...skirmish },
    { mapId: 'underbough-rootways', matchModeId: 'skirmish' },
    { mapId: 'underbough-rootways', ...skirmish, matchModeVersion: 2 }]) {
    assert.deepEqual(buildRoomWorkerEnvironment(parent, launch, invalid), buildRoomWorkerEnvironment(parent, launch),
      'invalid metadata does not partially apply a map or identity');
  }
});
