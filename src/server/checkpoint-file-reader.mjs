import { open } from 'node:fs/promises';
import { StringDecoder } from 'node:string_decoder';
import { CheckpointJsonScan } from './checkpoint-json-scan.mjs';
import { XL_CHECKPOINT_JSON_LIMITS as limits, rejectCheckpointBudget } from './checkpoint-json-budget.mjs';

export const CHECKPOINT_INSPECTION_CHUNK_BYTES = 32 * 1024;

// Effective dimensions may be last/duplicated. A complete streaming pass keeps
// admitted legacy saves compatible without allocating their whole contents.
// That classification's work is linear in file bytes, including rejected files.
// Accepted XL full reads/parses are independently bounded below.
export async function readMatchCheckpointFile(filename) {
  const file = await open(filename, 'r');
  try {
    const initial = await file.stat(), scan = new CheckpointJsonScan(), decoder = new StringDecoder('utf8');
    const chunk = Buffer.allocUnsafe(CHECKPOINT_INSPECTION_CHUNK_BYTES);
    let offset = 0;
    while (offset < initial.size) {
      const { bytesRead } = await file.read(chunk, 0, Math.min(chunk.length, initial.size - offset), offset);
      if (!bytesRead) break;
      offset += bytesRead; scan.push(decoder.write(chunk.subarray(0, bytesRead)));
    }
    scan.push(decoder.end());
    const inspection = scan.finish();
    const inspected = await file.stat();
    if (initial.size !== offset || inspected.size !== initial.size || inspected.mtimeMs !== initial.mtimeMs)
      rejectCheckpointBudget('file changed during inspection');
    if (inspection.legacyCandidate) {
      // Positional inspection reads never advanced this descriptor's offset.
      // Legacy JSON/unknown fields/whitespace and its previous byte envelope
      // remain untouched; the existing parser/migrations/validator still decide.
      const serialized = await file.readFile('utf8'), final = await file.stat();
      if (final.size !== initial.size || final.mtimeMs !== initial.mtimeMs)
        rejectCheckpointBudget('file changed during legacy read');
      return serialized;
    }
    if (initial.size > limits.bytes || offset > limits.bytes) rejectCheckpointBudget('exceeds file byte quota before parse');
    if (inspection.violation) rejectCheckpointBudget(`${inspection.violation} before parse`);
    if (initial.size !== offset) rejectCheckpointBudget('file changed during inspection');
    const bytes = Buffer.allocUnsafe(offset);
    let read = 0;
    while (read < bytes.length) {
      const { bytesRead } = await file.read(bytes, read, bytes.length - read, read);
      if (!bytesRead) rejectCheckpointBudget('file truncated before parse');
      read += bytesRead;
    }
    const extra = await file.read(chunk, 0, 1, read), final = await file.stat();
    if (extra.bytesRead || final.size !== initial.size || final.mtimeMs !== initial.mtimeMs)
      rejectCheckpointBudget('file changed before parse');
    const serialized = bytes.toString('utf8'), verify = new CheckpointJsonScan();
    verify.push(serialized);
    const actual = verify.finish();
    if (actual.violation) rejectCheckpointBudget(`${actual.violation} before parse`);
    return serialized;
  } finally { await file.close(); }
}
