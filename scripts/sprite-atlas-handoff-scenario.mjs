import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSpriteAtlasHandoff, validateSpriteAtlas } from './sprite-atlas-contract.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const manifestPath = path.join(root,
  'assets/buildings/archery-range-construction-v1/sprite-atlas-pack-v1.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const validation = await validateSpriteAtlas(manifestPath);
assert.deepEqual(validation.errors, [], 'the current-main Archery Range sprite pack should validate');

const report = createSpriteAtlasHandoff(validation);
assert.equal(report.reportVersion, 1);
assert.equal(report.pack.packId, 'archery-range-construction-v1');
assert.equal(report.integrity.allManifestHashesVerified, true);
assert.equal(report.integrity.declaredFileCount, manifest.files.length);
assert.equal(report.integrity.verifiedFileCount, manifest.files.length);
assert.deepEqual(report.files.map(({ id, sha256 }) => ({ id, sha256 })),
  manifest.files.map(({ id, sha256 }) => ({ id, sha256: sha256.toLowerCase() })));

const page = report.pages[0];
assert.deepEqual(page.dimensionsPx, { width: 3200, height: 640 });
assert.equal(page.teamMaskFile.id, 'team-mask');
assert.equal(page.teamMaskFile.sha256Verified, true);

const asset = report.assets.find((entry) => entry.id === 'archery-range-construction');
assert.ok(asset);
assert.equal(asset.frames.length, 5);
assert.ok(asset.frames.every((frame) => frame.canvasPx.width === 640 && frame.canvasPx.height === 640));
assert.deepEqual(asset.frames[0].groundPivotPx, { x: 320, y: 441 });
assert.equal(asset.frames[0].groundPivotStatus, 'unreviewed-estimate');
assert.deepEqual(asset.frames[0].alphaBoundsPx, { x: 43, y: 283, width: 555, height: 353 });
assert.deepEqual(asset.frames[0].fallbackRectPx.rectPx, { x: 0, y: 0, width: 640, height: 640 });
assert.deepEqual(asset.frames[0].frameRectsPx[0].rectPx, { x: 0, y: 0, width: 640, height: 640 });
assert.deepEqual(asset.clips.map((clip) => clip.stateId), [
  'foundation', 'frame', 'rails', 'canopy', 'complete',
]);
assert.ok(asset.clips.every((clip) => clip.directionId === null && clip.sequence.length === 1));
assert.equal(asset.teamCueEvidence.maskPages.length, 1);
assert.deepEqual(asset.depthCrops, [], 'the current sample has no split depth crops');
assert.equal(asset.mapPlacement.occupancyAuthority,
  'map/gameplay data; this art manifest does not define occupied cells');
assert.deepEqual(asset.mapPlacement.recommendedTileFootprintHint, { widthTiles: 3, heightTiles: 3 });
assert.deepEqual(asset.mapPlacement.artBoundsWorld, { min: [-2.5, 0, -2.5], max: [2.5, 4.5, 2.5] });
assert.equal(asset.review.groundPivotsReviewed, false);
assert.equal(asset.review.unreviewedPivotFrameIds.length, 5);

assert.throws(() => createSpriteAtlasHandoff({ ...validation, errors: ['bad manifest'] }), /valid sprite-atlas manifest/);
process.stdout.write('Sprite-atlas handoff scenario passed: exact frame metadata, masks, clips, bounds, hashes, and review limits.\n');
