#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePaintedMaterialAtlas } from './painted-material-atlas-contract.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const manifestPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(root, 'assets/environment/frontier-painted-material-atlas-v1/manifest.json');
if (process.argv.length > 3) {
  console.error('Usage: node scripts/validate-painted-material-atlas.mjs [manifest.json]');
  process.exit(2);
}

const result = await validatePaintedMaterialAtlas(manifestPath);
if (result.errors.length) {
  console.error('Painted-material atlas validation failed:');
  for (const error of result.errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  const { manifest } = result;
  console.log(`Painted-material atlas valid: ${manifest.packId}@${manifest.packVersion}`);
  console.log(`${result.verifiedFileCount} files hash and image-header verified; 8 material UV rectangles and 6 mip levels verified.`);
}
