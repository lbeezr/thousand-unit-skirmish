#!/usr/bin/env node
// Preserve a user-selected native fixture receipt and its original PNG bytes.
// This checks packaging, not GPU provenance, appearance or decoded pixel content.
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export async function extractBuildingOcclusionEvidence(input, output) {
  if ((await stat(input)).size > 64 * 1024 * 1024) throw new Error('Receipt exceeds the 64 MiB packaging bound');
  const original = await readFile(input), receipt = JSON.parse(original);
  if (receipt.schema !== 'building-occlusion-native-qa-v1' || !/^[a-f0-9]{40}$/.test(receipt.config?.sourceRevision)
    || !['checks-passed-human-review-pending', 'checks-failed', 'incomplete'].includes(receipt.status)) throw new Error('Unrecognized fixture receipt');
  const width = receipt.viewport?.pixelWidth, height = receipt.viewport?.pixelHeight;
  if (![width, height].every(value => Number.isInteger(value) && value > 0 && value <= 4096)) throw new Error('Invalid raster dimensions');
  const rasters = [];
  for (const [kind, entries] of [['performance', receipt.performance], ['detail', receipt.views]]) {
    for (const [index, entry] of entries.entries()) for (const mode of ['baseline', 'candidate']) {
      const data = entry[`${mode}Png`];
      if (typeof data !== 'string' || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(data)) throw new Error('Missing paired PNG');
      const bytes = Buffer.from(data.slice(22), 'base64');
      if (bytes.length < 33 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a'
        || bytes.subarray(12, 16).toString() !== 'IHDR'
        || bytes.readUInt32BE(16) !== width || bytes.readUInt32BE(20) !== height) throw new Error('PNG header/dimensions do not match receipt');
      rasters.push({ file: `${kind}-${index}-${mode}.png`, bytes, sha256: sha(bytes) });
    }
  }
  const outputRoot = path.resolve(output);
  await mkdir(outputRoot); // Deliberately refuses an existing directory/iteration.
  await writeFile(path.join(outputRoot, 'receipt.json'), original);
  for (const raster of rasters) await writeFile(path.join(outputRoot, raster.file), raster.bytes);
  const manifest = { schema: 'building-occlusion-evidence-v1', sourceRevision: receipt.config.sourceRevision,
    reportedStatus: receipt.status, reportedHardwareGpuTimingComplete: receipt.hardwareGpuTimingComplete ?? false,
    validationScope: 'Exact PNG bytes, signatures and header dimensions; no decoded-pixel or native-GPU certification.',
    originalReceipt: { file: 'receipt.json', bytes: original.length, sha256: sha(original) },
    rasters: rasters.map(({ bytes, ...entry }) => ({ ...entry, bytes: bytes.length, width, height })) };
  await writeFile(path.join(outputRoot, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 4) throw new Error('Usage: node scripts/extract-building-occlusion-evidence.mjs RECEIPT.json NEW_OUTPUT_DIRECTORY');
  const manifest = await extractBuildingOcclusionEvidence(process.argv[2], process.argv[3]);
  console.log(JSON.stringify({ sourceRevision: manifest.sourceRevision, rasters: manifest.rasters.length, status: manifest.reportedStatus }));
}
