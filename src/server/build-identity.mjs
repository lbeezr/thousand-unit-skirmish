import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const SOURCE_REVISION_PATTERN = /^[a-f0-9]{40}$/;
export const RELEASE_DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;
export const isSourceRevision = value => typeof value === 'string' && SOURCE_REVISION_PATTERN.test(value);
export const isReleaseDigest = value => typeof value === 'string' && RELEASE_DIGEST_PATTERN.test(value);

// Expose only release identifiers, never the manifest's paths or provider vars.
export function resolveBuildIdentity({ manifest, manifestError, railwayRevision } = {}) {
  const empty = { sourceRevision: null, sourceDirty: null, digest: null };
  const providerPresent = railwayRevision !== undefined && railwayRevision !== '';
  if (manifestError || (providerPresent && !isSourceRevision(railwayRevision))) {
    return { status: 'invalid', origin: 'unavailable', ...empty };
  }
  if (manifest !== undefined) {
    if (!manifest || typeof manifest !== 'object'
      || !isSourceRevision(manifest.sourceRevision)
      || typeof manifest.sourceDirty !== 'boolean'
      || !isReleaseDigest(manifest.digest)) {
      return { status: 'invalid', origin: 'packed-manifest', ...empty };
    }
    const fields = { sourceRevision: manifest.sourceRevision,
      sourceDirty: manifest.sourceDirty, digest: manifest.digest };
    return { status: providerPresent && railwayRevision !== manifest.sourceRevision ? 'conflict' : 'identified',
      origin: 'packed-manifest', ...fields };
  }
  if (providerPresent) return { status: 'identified', origin: 'railway-git',
    ...empty, sourceRevision: railwayRevision };
  return { status: 'unknown', origin: 'unavailable', ...empty };
}

export async function loadBuildIdentity(root, env = process.env) {
  let manifest;
  let manifestError = false;
  try {
    // The packer puts this private sidecar inside Docker's existing src COPY.
    const body = await readFile(path.join(root, 'src/server/release-identity.json'), 'utf8');
    if (body.length > 1_000_000) throw new Error('Oversized release manifest');
    manifest = JSON.parse(body);
  } catch (error) {
    manifestError = error.code !== 'ENOENT';
  }
  return Object.freeze(resolveBuildIdentity({ manifest, manifestError,
    railwayRevision: env.RAILWAY_GIT_COMMIT_SHA }));
}
