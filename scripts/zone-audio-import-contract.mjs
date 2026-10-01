import {validateAudioPack} from '../src/audio-assets.mjs';

// Mirror the metadata projection in Audio Zones' Save sources to Audio Studio.
// Validation only: no source, catalog, library, or recording is modified.
export function validateZoneAudioImportMetadata(catalog) {
  if (!Array.isArray(catalog?.sources)) throw new Error('catalog.sources: must be an array');
  const pack = {schemaVersion: 1, id: 'vaelora-zone-sources-v1',
    name: 'Vaelora — all-zone source candidates', compositions: [], profiles: [],
    sources: catalog.sources.map(s => ({id: s.id, name: s.id.replaceAll('-', ' '),
      fileName: s.file.split('/').at(-1), mimeType: 'audio/mpeg', tags: [s.zone, s.family, 'candidate'],
      durationSeconds: s.actualDurationSeconds, sampleRate: s.sampleRate, channels: s.channels,
      provenance: {provider: 'ElevenLabs', prompt: s.prompt, model: s.model, createdAt: s.downloadedOn,
        attribution: `Flow node ${s.nodeId}; see repository catalog for hashes and settings`}}))};
  try { return validateAudioPack(pack); }
  catch (error) {
    const message = error.message.replace(/^pack\.sources\[(\d+)\]\.provenance\.(model|createdAt):/,
      (_, index, field) => `catalog.sources[${index}].${field === 'createdAt' ? 'downloadedOn' : 'model'}:`);
    throw new Error(message, {cause: error});
  }
}
