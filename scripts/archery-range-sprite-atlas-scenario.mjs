import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSpriteAtlasHandoff, validateSpriteAtlas } from './sprite-atlas-contract.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const packRoot = path.join(root, 'assets/buildings/archery-range-sprite-v1');
const manifestPath = path.join(packRoot, 'sprite-atlas-pack-v1.json');
const [manifest, grid] = await Promise.all([
  readFile(manifestPath, 'utf8').then(JSON.parse),
  readFile(path.join(packRoot, 'sprite-grid.json'), 'utf8').then(JSON.parse),
]);
const validation = await validateSpriteAtlas(manifestPath);
assert.deepEqual(validation.errors, [], 'the Archery Range canonical sprite pack should validate');

const report = createSpriteAtlasHandoff(validation);
assert.equal(report.pack.packId, 'archery-range-sprite-v1');
assert.equal(report.pack.maturity, 'runtime-candidate');
assert.equal(report.integrity.allManifestHashesVerified, true);
assert.equal(report.integrity.declaredFileCount, manifest.files.length);
assert.equal(report.integrity.verifiedFileCount, manifest.files.length);
assert.equal(manifest.files.length, 20, 'hash the original sources, normalized source pages, and both runtime variants');

const rawSources = manifest.files.filter((file) => file.path.startsWith('source/archery-range-'));
const normalizedSources = manifest.files.filter((file) => file.path.startsWith('source/normalized/'));
const runtimeFiles = manifest.files.filter((file) => file.usage === 'runtime');
assert.equal(rawSources.length, 5);
assert.ok(rawSources.every((file) => file.dimensionsPx.width === 1254 && file.dimensionsPx.height === 1254));
assert.equal(normalizedSources.length, grid.runtimeFrames.states.length);
assert.ok(normalizedSources.every((file) => file.dimensionsPx.width === 640 && file.dimensionsPx.height === 640));
assert.equal(runtimeFiles.length, grid.runtimeFrames.states.length * grid.runtimeFrames.teams.length);

assert.equal(manifest.pages.length, grid.runtimeFrames.states.length * grid.runtimeFrames.teams.length);
assert.ok(manifest.pages.every((page) => page.dimensionsPx.width === 640 && page.dimensionsPx.height === 640));
for (const state of grid.runtimeFrames.states) {
  for (const team of grid.runtimeFrames.teams) {
    const page = manifest.pages.find((candidate) => candidate.id === `${state}-${team}-page`);
    assert.ok(page, `missing ${state}/${team} page`);
    assert.equal(page.runtimeFileId, `${state}-${team}-runtime`);
    assert.equal(page.sourceFileId, `${state}-source-grid`);
  }
}

const asset = report.assets.find((candidate) => candidate.id === 'archery-range');
assert.ok(asset);
assert.equal(asset.frames.length, 10);
assert.deepEqual(asset.frames[0].canvasPx, { width: 640, height: 640 });
assert.deepEqual(asset.frames[0].groundPivotPx, {
  x: grid.spriteFrame.anchorPixelFromTopLeft[0],
  y: grid.spriteFrame.anchorPixelFromTopLeft[1],
});
assert.ok(asset.frames.every((frame) => frame.groundPivotStatus === 'unreviewed-estimate'));
assert.equal(asset.review.groundPivotsReviewed, false);
assert.equal(asset.review.unreviewedPivotFrameIds.length, 10);
assert.deepEqual(asset.clips.map((clip) => clip.stateId).filter((state, index, all) => all.indexOf(state) === index).sort(),
  [...grid.runtimeFrames.states].sort());
assert.deepEqual(asset.teamCueEvidence.teamVariantIds.sort(), [...grid.runtimeFrames.teams].sort());
assert.deepEqual(asset.mapPlacement.recommendedTileFootprintHint, {
  widthTiles: grid.worldGrid.gameplayFootprintCells[0],
  heightTiles: grid.worldGrid.gameplayFootprintCells[1],
});
assert.equal(asset.mapPlacement.occupancyAuthority,
  'map/gameplay data; this art manifest does not define occupied cells');
assert.deepEqual(asset.mapPlacement.artBoundsWorld, {
  min: [-2.5, 0, -2.5],
  max: [2.5, 5, 2.5],
});
assert.equal(asset.layers[0].drawLayer, 'midground');
assert.equal(asset.layers[0].batchKey, 'building.archery-range');
assert.deepEqual(asset.depthCrops, [], 'the complete sprite is a single full-canvas midground layer, not a depth split');
assert.ok(manifest.provenance.notes.includes('renderer integration remains pending'));

const splitManifest = structuredClone(manifest);
const splitAsset = splitManifest.assets[0];
splitAsset.layers = [
  { id: 'building', drawLayer: 'actor', batchKey: 'building.archery-range' },
  { id: 'awning', drawLayer: 'foreground', batchKey: 'building.archery-range.awning' },
];
splitAsset.frames[0].frameRectsPx.push({
  layerId: 'awning',
  pageId: splitAsset.frames[0].fallbackRectPx.pageId,
  rectPx: { x: 100, y: 80, width: 180, height: 90 },
  offsetPx: { x: 210, y: 260 },
});
const splitReport = createSpriteAtlasHandoff({ ...validation, manifest: splitManifest });
assert.equal(splitReport.assets[0].depthCrops.length, 1);
assert.equal(splitReport.assets[0].depthCrops[0].drawLayer, 'foreground');

process.stdout.write('Archery Range sprite-atlas scenario passed: source grid, team pages, lifecycle clips, bounds, hashes, and pending integration are explicit.\n');
