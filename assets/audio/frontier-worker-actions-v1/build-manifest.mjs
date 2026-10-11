// Extends the preserved first interaction manifest without rewriting its bytes.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { validateAudioPack } from '../../../src/audio-assets.mjs';
const root = new URL('./', import.meta.url);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const original = await readFile(new URL('../runtime/frontier-feedback/v1/manifest.json', root));
if (sha256(original) !== 'b13cb7b0f5a0e89fa0d8c03d86923964ed78f8a3260d6a3ba035def5aad4f55c') throw Error('Pinned first interaction manifest changed');
const manifest = JSON.parse(original);
manifest.version = 'v2';
const catalog = JSON.parse(await readFile(new URL('catalog.json', root), 'utf8'));
const bindings = manifest.pack.profiles.find(p => p.id === 'interactions').bindings;
for (const item of catalog.recordings) {
  const bytes = await readFile(new URL(`sources/${item.fileName}`, root));
  if (sha256(bytes) !== item.sha256 || bytes.length !== item.bytes) throw Error(`Original changed: ${item.fileName}`);
  if (!item.runtime) continue;
  if (manifest.pack.sources.some(s => s.id === item.id)) throw Error(`Duplicate source: ${item.id}`);
  manifest.pack.sources.push({ id: item.id, name: item.label, fileName: item.fileName, mimeType: 'audio/mpeg', tags: ['frontier', 'worker', 'interaction'],
    provenance: { provider: 'ElevenLabs', model: item.model, generationId: item.generationId,
      prompt: item.prompt, createdAt: item.createdAt, attribution: `Voice ${item.voiceName} (${item.voiceId})` } });
  manifest.downloads[item.id] = { path: `/assets/audio/frontier-worker-actions-v1/sources/${item.fileName}`,
    bytes: item.bytes, sha256: item.sha256, mimeType: 'audio/mpeg' };
  const binding = bindings[item.eventKey] ||= { bus: 'voice', priority: 1, cooldownMs: item.cooldownMs, variants: [] };
  binding.variants.push({ sourceId: item.id, gain: item.gain, caption: item.caption });
}
validateAudioPack(manifest.pack);
const output = new URL('../runtime/frontier-feedback/v2/', root);
await mkdir(output, { recursive: true });
const bytes = `${JSON.stringify(manifest, null, 2)}\n`;
await writeFile(new URL('manifest.json', output), bytes);
process.stdout.write(`${JSON.stringify({ packId: 'frontier-feedback', profileId: 'interactions', version: 'v2', sha256: sha256(bytes), sources: manifest.pack.sources.length })}\n`);
