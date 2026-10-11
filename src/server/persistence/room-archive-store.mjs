import { mkdir, readFile, readdir, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { normalizeRoomIndex, roomIndexDocument } from '../orchestration/room-launch-options.mjs';

const ID = /^[A-Za-z0-9_-]{32}$/;
const METADATA = 'room-archive.json';

// Archive on the same volume with an atomic directory rename. Keep checkpoint,
// custom maps and the launch identity together, including across a lost index.
export function createRoomArchiveStore({ roomDirectory, archiveDirectory }) {
  function directory(root, id) {
    if (!ID.test(id)) throw new TypeError('Invalid room code.');
    return path.join(root, id);
  }

  async function read(id, root = archiveDirectory) {
    const value = JSON.parse(await readFile(path.join(directory(root, id), METADATA), 'utf8'));
    const index = normalizeRoomIndex(value.index);
    if (value.version !== 1 || !Number.isFinite(value.archivedAt)
      || !['idle-expiry', 'operator'].includes(value.reason)
      || index?.rooms.length !== 1 || index.rooms[0].id !== id) {
      throw new Error('Invalid room archive metadata; preserve the directory for operator recovery.');
    }
    return { ...index.rooms[0], archivedAt: value.archivedAt, reason: value.reason };
  }

  async function archive(room, reason) {
    const source = directory(roomDirectory, room.id);
    const target = directory(archiveDirectory, room.id);
    await mkdir(archiveDirectory, { recursive: true });
    // Never replace an existing archive, including an empty directory.
    if (await stat(target).then(() => true, error => {
      if (error.code === 'ENOENT') return false;
      throw error;
    })) throw new Error('An archive already exists for this room; preserve both directories.');
    const payload = { version: 1, archivedAt: Date.now(), reason, index: roomIndexDocument([room]) };
    const metadataPath = path.join(source, METADATA);
    await writeFile(`${metadataPath}.tmp`, JSON.stringify(payload), { mode: 0o600 });
    await rename(`${metadataPath}.tmp`, metadataPath);
    await rename(source, target);
  }

  async function restore(id) {
    const entry = await read(id);
    const target = directory(roomDirectory, id);
    if (await stat(target).then(() => true, error => {
      if (error.code === 'ENOENT') return false;
      throw error;
    })) throw new Error('An active directory already exists for this room; preserve both directories.');
    const restored = { ...entry, lastActiveAt: Date.now() };
    const metadataPath = path.join(directory(archiveDirectory, id), METADATA);
    await writeFile(`${metadataPath}.tmp`, JSON.stringify({ version: 1, archivedAt: entry.archivedAt,
      reason: entry.reason, index: roomIndexDocument([restored]) }), { mode: 0o600 });
    await rename(`${metadataPath}.tmp`, metadataPath);
    await rename(directory(archiveDirectory, id), target);
    return restored;
  }

  async function list() {
    let entries;
    try { entries = await readdir(archiveDirectory, { withFileTypes: true }); }
    catch (error) { if (error.code === 'ENOENT') return []; throw error; }
    return Promise.all(entries.filter(entry => entry.isDirectory() && ID.test(entry.name)).map(async entry => {
      try { return { ...await read(entry.name), recoverable: true }; }
      catch { return { id: entry.name, recoverable: false }; }
    }));
  }

  return { archive, restore, read, list, recover: id => read(id, roomDirectory) };
}
