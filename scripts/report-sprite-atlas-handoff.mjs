#!/usr/bin/env node

import { createSpriteAtlasHandoff, validateSpriteAtlas } from './sprite-atlas-contract.mjs';

const args = process.argv.slice(2);
let manifestPath = '';
let requireReviewedPivots = false;
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === '--require-reviewed-pivots') requireReviewedPivots = true;
  else if (!manifestPath) manifestPath = arg;
  else {
    console.error(`Unknown argument: ${arg}`);
    process.exit(2);
  }
}

if (!manifestPath) {
  console.error('Usage: node scripts/report-sprite-atlas-handoff.mjs <manifest.json> [--require-reviewed-pivots]');
  process.exit(2);
}

const validation = await validateSpriteAtlas(manifestPath);
if (validation.errors.length) {
  console.error('Sprite-atlas handoff report not generated because validation failed:');
  for (const error of validation.errors) console.error(`- ${error}`);
  process.exit(1);
}

const report = createSpriteAtlasHandoff(validation);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

const unreviewedFrames = report.assets.flatMap((asset) => asset.review.unreviewedPivotFrameIds
  .map((frameId) => `${asset.id}/${frameId}`));
if (!report.integrity.allManifestHashesVerified) {
  console.error('Sprite-atlas handoff report is incomplete: not every manifest file hash was verified.');
  process.exitCode = 1;
} else if (requireReviewedPivots && unreviewedFrames.length > 0) {
  console.error(`Ground pivots need visual review: ${unreviewedFrames.join(', ')}`);
  process.exitCode = 1;
}
