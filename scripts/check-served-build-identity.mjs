import { isSourceRevision, isReleaseDigest } from '../src/server/build-identity.mjs';

export function validateExpectedIdentity(expected) {
  if (!isSourceRevision(expected?.sourceRevision)) {
    throw new Error('Expected source must be a full lowercase 40-character commit SHA');
  }
  if (expected.digest !== undefined && !isReleaseDigest(expected.digest)) {
    throw new Error('Expected digest must be sha256 followed by 64 lowercase hexadecimal characters');
  }
}

export function compareServedBuildIdentity(health, expected) {
  validateExpectedIdentity(expected);
  const identity = health?.buildIdentity;
  const issues = [];
  if (health?.ok !== true) issues.push('health-not-ready');
  if (identity?.status !== 'identified') issues.push('identity-unavailable-or-conflicting');
  if (!isSourceRevision(identity?.sourceRevision)) issues.push('source-missing-or-invalid');
  else if (identity.sourceRevision !== expected.sourceRevision) issues.push('source-mismatch');
  if (!['packed-manifest', 'railway-git'].includes(identity?.origin)) issues.push('identity-origin-invalid');
  if (identity?.origin === 'packed-manifest' && typeof identity.sourceDirty !== 'boolean') {
    issues.push('source-cleanliness-invalid');
  }
  if (identity?.sourceDirty === true) issues.push('source-dirty');
  if (identity?.origin === 'packed-manifest' && !isReleaseDigest(identity.digest)) issues.push('digest-invalid');
  if (identity?.origin === 'railway-git' && (identity.sourceDirty !== null || identity.digest !== null)) {
    issues.push('provider-identity-fields-invalid');
  }
  if (expected.digest !== undefined) {
    if (!isReleaseDigest(identity?.digest)) issues.push('digest-missing-or-invalid');
    else if (identity.digest !== expected.digest) issues.push('digest-mismatch');
  }
  // Do not echo an arbitrary response body, error, environment or credential.
  const served = {
    sourceRevision: isSourceRevision(identity?.sourceRevision) ? identity.sourceRevision : null,
    sourceDirty: typeof identity?.sourceDirty === 'boolean' ? identity.sourceDirty : null,
    digest: isReleaseDigest(identity?.digest) ? identity.digest : null,
    origin: ['packed-manifest', 'railway-git'].includes(identity?.origin) ? identity.origin : 'unavailable',
  };
  return { ok: issues.length === 0, expected, served,
    scope: expected.digest === undefined ? 'source' : 'source-and-declared-release-digest', issues };
}

export async function checkServedBuildIdentity(base, expected, { authorization, fetchImpl = fetch } = {}) {
  validateExpectedIdentity(expected);
  let health;
  try {
    const response = await fetchImpl(new URL('/health', base), {
      headers: authorization ? { authorization } : {},
      redirect: 'error', signal: AbortSignal.timeout(10_000),
    });
    if (response.status !== 200) {
      await response.body?.cancel();
      return { ok: false, expected, issues: [`health-http-${response.status}`] };
    }
    const reader = response.body.getReader();
    const chunks = [];
    let bytes = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 1_000_000) {
        await reader.cancel();
        return { ok: false, expected, issues: ['health-body-too-large'] };
      }
      chunks.push(Buffer.from(value));
    }
    health = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return { ok: false, expected, issues: ['health-request-or-json-failed'] };
  }
  return compareServedBuildIdentity(health, expected);
}
