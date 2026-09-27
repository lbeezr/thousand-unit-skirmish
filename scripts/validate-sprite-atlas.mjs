#!/usr/bin/env node

import { validateSpriteAtlas } from './sprite-atlas-contract.mjs';

const manifestPath = process.argv[2];
if (!manifestPath || process.argv.length > 3) {
  console.error('Usage: node scripts/validate-sprite-atlas.mjs <manifest.json>');
  process.exit(2);
}

const result = await validateSpriteAtlas(manifestPath);
if (result.errors.length) {
  console.error('Sprite-atlas validation failed:');
  for (const error of result.errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  const { manifest } = result;
  console.log(`Sprite-atlas manifest valid: ${manifest.packId}@${manifest.packVersion}`);
  console.log(`${manifest.files.length} files, ${manifest.pages.length} pages, ${manifest.assets.length} assets`);
}
