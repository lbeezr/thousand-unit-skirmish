import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRoomArchiveStore } from '../src/server/persistence/room-archive-store.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'rts-room-archive-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const roomDirectory = path.join(root, 'rooms'), archiveDirectory = path.join(root, 'archived-rooms');
  const room = { id: 'a'.repeat(32), createdAt: 100, lastActiveAt: 200,
    launchOptions: { mode: 'pve', mapSeed: 12, policySeed: 34, matchModeId: 'skirmish', matchModeVersion: 1 },
    mapId: 'veyrholds-terraced-vale', matchModeId: 'skirmish', matchModeVersion: 1 };
  const source = path.join(roomDirectory, room.id), target = path.join(archiveDirectory, room.id);
  await mkdir(source, { recursive: true });
  await writeFile(path.join(source, 'match-state.json'), 'checkpoint bytes');
  return { store: createRoomArchiveStore({ roomDirectory, archiveDirectory }), room, source, target, archiveDirectory };
}

test('same-volume archive and restore retain bytes, seeds and identity; restore recovery survives index loss', async t => {
  const { store, room, source, target } = await fixture(t);
  await store.archive(room, 'operator');
  assert.equal(await readFile(path.join(target, 'match-state.json'), 'utf8'), 'checkpoint bytes');
  const [entry] = await store.list();
  assert.equal(entry.recoverable, true);
  assert.deepEqual(entry.launchOptions, room.launchOptions);
  const restored = await store.restore(room.id);
  assert.ok(restored.lastActiveAt > room.lastActiveAt);
  assert.equal(restored.createdAt, room.createdAt);
  assert.equal(restored.mapId, room.mapId);
  assert.deepEqual(await store.recover(room.id), restored);
  assert.equal(await readFile(path.join(source, 'match-state.json'), 'utf8'), 'checkpoint bytes');
  assert.deepEqual(await store.list(), []);
});

test('archive never replaces an existing destination and never discards source on storage failure', async t => {
  const { store, room, source, target, archiveDirectory } = await fixture(t);
  await mkdir(target, { recursive: true });
  await assert.rejects(store.archive(room, 'operator'), /already exists/);
  assert.equal(await readFile(path.join(source, 'match-state.json'), 'utf8'), 'checkpoint bytes');
  await rm(archiveDirectory, { recursive: true });
  await writeFile(archiveDirectory, 'storage obstruction');
  await assert.rejects(store.archive(room, 'idle-expiry'));
  assert.equal(await readFile(path.join(source, 'match-state.json'), 'utf8'), 'checkpoint bytes');
});

test('restore rejects occupied active paths and malformed metadata without touching archived checkpoint', async t => {
  const { store, room, source, target } = await fixture(t);
  await store.archive(room, 'idle-expiry');
  await mkdir(source);
  await assert.rejects(store.restore(room.id), /already exists/);
  await rm(source, { recursive: true });
  await writeFile(path.join(target, 'room-archive.json'), '{}');
  assert.deepEqual(await store.list(), [{ id: room.id, recoverable: false }]);
  await assert.rejects(store.restore(room.id), /Invalid room archive/);
  assert.equal(await readFile(path.join(target, 'match-state.json'), 'utf8'), 'checkpoint bytes');
});

test('room code traversal is rejected before filesystem access', async t => {
  const { store, room, source } = await fixture(t);
  await assert.rejects(store.archive({ ...room, id: '../elsewhere' }, 'operator'), /Invalid room code/);
  await assert.rejects(store.restore('../elsewhere'), /Invalid room code/);
  assert.equal(await readFile(path.join(source, 'match-state.json'), 'utf8'), 'checkpoint bytes');
});
