import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSpriteAtlasHandoff, validateSpriteAtlas } from './sprite-atlas-contract.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const packRoot = path.join(root, 'assets/buildings/town-center-sprite-v1');
const manifestPath = path.join(packRoot, 'sprite-atlas-pack-v1.json');
const [manifest, grid] = await Promise.all([
  readFile(manifestPath, 'utf8').then(JSON.parse),
  readFile(path.join(packRoot, 'sprite-grid.json'), 'utf8').then(JSON.parse),
]);
const validation = await validateSpriteAtlas(manifestPath);
assert.deepEqual(validation.errors, [], 'the Town Center canonical sprite pack should validate');

const report = createSpriteAtlasHandoff(validation);
assert.equal(report.pack.packId, 'town-center-sprite-v1');
assert.equal(report.pack.maturity, 'runtime-candidate');
assert.equal(report.integrity.allManifestHashesVerified, true);
assert.equal(report.integrity.declaredFileCount, 4,
  'hash the original, normalized source page, and both runtime variants');
assert.equal(report.integrity.verifiedFileCount, manifest.files.length);

const fileByPath = new Map(manifest.files.map((file) => [file.path, file]));
const original = fileByPath.get('source/town-center-complete.png');
const normalized = fileByPath.get('source/normalized/town-center-complete.png');
assert.deepEqual(original.dimensionsPx, { width: 1254, height: 1254 });
assert.deepEqual(normalized.dimensionsPx, { width: 640, height: 640 });
const runtimeFiles = manifest.files.filter((file) => file.usage === 'runtime');
assert.equal(runtimeFiles.length, 2);
assert.ok(runtimeFiles.every((file) => file.dimensionsPx.width === 640 && file.dimensionsPx.height === 640));

const states = grid.runtimeFrames.states;
const teams = grid.runtimeFrames.teams;
assert.deepEqual(states, ['complete'], 'this static map landmark must not imply lifecycle art');
assert.deepEqual(teams, ['azure', 'ember']);
assert.equal(manifest.pages.length, states.length * teams.length);
assert.ok(manifest.pages.every((page) => page.sourceFileId === 'complete-source-grid'));
for (const team of teams) {
  const page = manifest.pages.find((candidate) => candidate.id === `complete-${team}-page`);
  assert.ok(page, `missing complete/${team} page`);
  assert.equal(page.runtimeFileId, `complete-${team}-runtime`);
}

const asset = report.assets.find((candidate) => candidate.id === 'town-center');
assert.ok(asset);
assert.equal(asset.frames.length, 2);
assert.equal(asset.clips.length, 2);
assert.deepEqual(asset.clips.map((clip) => clip.stateId), ['complete', 'complete']);
assert.deepEqual(asset.teamCueEvidence.teamVariantIds.sort(), [...teams].sort());
assert.deepEqual(asset.frames[0].groundPivotPx, {
  x: grid.spriteFrame.anchorPixelFromTopLeft[0],
  y: grid.spriteFrame.anchorPixelFromTopLeft[1],
});
assert.ok(asset.frames.every((frame) => frame.groundPivotStatus === 'unreviewed-estimate'));
assert.equal(asset.review.groundPivotsReviewed, false);
assert.equal(asset.mapPlacement.recommendedTileFootprintHint, null,
  'the decorative Town Center has no gameplay occupancy footprint');
assert.equal(asset.mapPlacement.occupancyAuthority,
  'map/gameplay data; this art manifest does not define occupied cells');
assert.equal(asset.layers[0].drawLayer, 'midground');
assert.deepEqual(asset.depthCrops, [], 'the complete sprite is a single full-canvas layer, not a depth split');
assert.ok(manifest.provenance.notes.includes('no gameplay footprint'));
assert.ok(manifest.provenance.notes.includes('renderer integration remains pending'));

process.stdout.write('Town Center sprite-atlas scenario passed: static state, team pages, no gameplay footprint, bounds, hashes, and pending integration are explicit.\n');
