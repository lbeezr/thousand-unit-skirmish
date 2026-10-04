export function validateMapAudioReference(audio) {
  if (audio === undefined) return null;
  if (!audio || typeof audio !== 'object' || Array.isArray(audio)
    || Object.keys(audio).some((key) => !['packId', 'profileId', 'version', 'sha256'].includes(key))
    || !['packId', 'profileId'].every((key) => typeof audio[key] === 'string'
      && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(audio[key]))) {
    throw new Error('Map audio must reference a packId and profileId using stable IDs.');
  }
  if ((audio.version !== undefined || audio.sha256 !== undefined)
    && (typeof audio.version !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(audio.version)
      || typeof audio.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(audio.sha256))) {
    throw new Error('Shipped audio requires a stable version and SHA-256 manifest hash together.');
  }
  return { packId: audio.packId, profileId: audio.profileId,
    ...(audio.version ? { version: audio.version, sha256: audio.sha256 } : {}) };
}
