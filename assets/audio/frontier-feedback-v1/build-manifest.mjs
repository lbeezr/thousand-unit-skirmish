// Rebuild the versioned runtime manifest from preserved generation provenance.
// Run from any directory with Node 24; this never calls a generation provider.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('./', import.meta.url);
const catalog = JSON.parse(await readFile(new URL('catalog.json', root), 'utf8'));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const sources = [], downloads = {}, bindings = {};
for (const item of catalog.recordings) {
  const bytes = await readFile(new URL(`sources/${item.fileName}`, root));
  if (sha256(bytes) !== item.sha256 || bytes.length !== item.bytes) throw new Error(`Original changed: ${item.fileName}`);
  if (!item.runtime) continue;
  sources.push({ id: item.id, name: item.label, fileName: item.fileName, mimeType: 'audio/mpeg', tags: ['frontier', 'interaction'],
    provenance: { provider: 'ElevenLabs', model: item.model, generationId: item.generationId,
      prompt: item.prompt, createdAt: item.createdAt, attribution: item.voiceId ? `Voice ${item.voiceName} (${item.voiceId})` : 'Generated sound effect' } });
  downloads[item.id] = { path: `/assets/audio/frontier-feedback-v1/sources/${item.fileName}`, bytes: item.bytes, sha256: item.sha256, mimeType: 'audio/mpeg' };
  const binding = bindings[item.eventKey] ||= { bus: item.bus, priority: item.priority, cooldownMs: item.cooldownMs, variants: [] };
  binding.variants.push({ sourceId: item.id, gain: item.gain, ...(item.caption ? { caption: item.caption } : {}) });
}
const manifest = { version: 'v1', pack: { schemaVersion: 1, id: 'frontier-feedback', name: 'Frontier voices and building sounds',
  sources, profiles: [{ id: 'interactions', name: 'Frontier interactions', bindings, music: {} }], compositions: [] }, downloads };
const output = new URL('../runtime/frontier-feedback/v1/', root);
await mkdir(output, { recursive: true });
const bytes = `${JSON.stringify(manifest, null, 2)}\n`;
await writeFile(new URL('manifest.json', output), bytes);
process.stdout.write(`${JSON.stringify({ packId: 'frontier-feedback', profileId: 'interactions', version: 'v1', sha256: sha256(bytes) })}\n`);
