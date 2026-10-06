import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { normalizeRoomIndex } from '../../room-launch-options.mjs';

// Paths are already resolved by the supervisor. Capture the document when its
// queued write executes so pending writes observe the existing live room state.
export function createRoomIndexStore({ dataDirectory, indexPath, captureDocument }) {
  let indexSaveQueue = Promise.resolve();

  function persist() {
    const operation = indexSaveQueue.catch(() => {}).then(async () => {
      const payload = captureDocument();
      await mkdir(dataDirectory, { recursive: true });
      const temporaryPath = `${indexPath}.${process.pid}.tmp`;
      await writeFile(temporaryPath, JSON.stringify(payload), { mode: 0o600 });
      await rename(temporaryPath, indexPath);
    });
    indexSaveQueue = operation;
    return operation;
  }

  async function read() {
    let savedRooms = [];
    let validIndex = false;
    let indexState = 'missing';
    try {
      const index = JSON.parse(await readFile(indexPath, 'utf8'));
      indexState = 'invalid';
      const normalized = normalizeRoomIndex(index);
      if (normalized) {
        validIndex = true;
        savedRooms = normalized.rooms;
        indexState = 'valid';
      }
    } catch (error) {
      if (error.code !== 'ENOENT') indexState = 'invalid';
    }
    return { savedRooms, validIndex, indexState };
  }

  return { persist, read };
}
