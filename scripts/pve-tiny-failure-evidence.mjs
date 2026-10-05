import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { gzipSync, gunzipSync } from 'node:zlib';

export const TINY_FAILURE_PREFIX = 'PVE_TINY_FAILURE ';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const root = fileURLToPath(new URL('..', import.meta.url));

function sourceInfo() {
  const revision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
  const dirty = spawnSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' });
  return { revision: revision.status === 0 ? revision.stdout.trim() : null,
    dirty: dirty.status === 0 ? Boolean(dirty.stdout.trim()) : null };
}

// Analysis artifact only: no snapshot call, native dispatch or policy input.
export function encodeTinyFailureEvidence(record) {
  const bytes = Buffer.from(JSON.stringify(record));
  return { encoding: 'gzip-base64', bytes: bytes.length, sha256: sha(bytes),
    data: gzipSync(bytes).toString('base64') };
}

export function decodeTinyFailureEvidence(envelope) {
  assert.equal(envelope.encoding, 'gzip-base64');
  const bytes = gunzipSync(Buffer.from(envelope.data, 'base64'));
  assert.equal(bytes.length, envelope.bytes, 'Tiny failure evidence length');
  assert.equal(sha(bytes), envelope.sha256, 'Tiny failure evidence checksum');
  return JSON.parse(bytes.toString('utf8'));
}

export function assertTinySearchCompletion(record, emit = line => process.stderr.write(`${line}\n`)) {
  try {
    if (record.final.state.matchWinner === -1) {
      const evidence = encodeTinyFailureEvidence({ schemaVersion: 1, source: sourceInfo(), ...record });
      emit(`${TINY_FAILURE_PREFIX}${JSON.stringify(evidence)}`);
    }
  } finally {
    // Retention cannot turn a failed match into a pass, including sink errors.
    assert.notEqual(record.final.state.matchWinner, -1,
      'configured Tiny match must complete within 3,600 seconds');
  }
}
