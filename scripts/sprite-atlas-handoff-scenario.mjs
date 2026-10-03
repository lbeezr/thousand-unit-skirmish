import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
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

const temporary = await mkdtemp(path.join(os.tmpdir(), 'sprite-atlas-diagnostics-'));
try {
  const input = path.join(temporary, 'private-manifest.json');
  await writeFile(input, 'privatekey=secret');
  const malformed = await validateSpriteAtlas(input);
  assert.equal(malformed.diagnostic.code, 'manifest-invalid-json');
  assert.ok(malformed.diagnostic.cause instanceof SyntaxError);
  assert.match(malformed.errors[0], /valid JSON.*retry/);
  assert.doesNotMatch(JSON.stringify(malformed), /privatekey|secret|private-manifest/);
  for (const script of ['validate-sprite-atlas.mjs', 'report-sprite-atlas-handoff.mjs', 'preview-sprite-atlas.mjs']) {
    const run = spawnSync(process.execPath, [path.join(root, 'scripts', script), input], {encoding: 'utf8', timeout: 5000});
    assert.ifError(run.error); assert.equal(run.status, 1, run.stderr);
    assert.match(run.stderr, /valid JSON.*retry/);
    assert.doesNotMatch(run.stderr, /privatekey|secret|private-manifest|node:internal/);
    assert.equal(run.stdout, '');
  }
  const missing = await validateSpriteAtlas(path.join(temporary, 'private-missing', 'manifest.json'));
  assert.equal(missing.diagnostic.code, 'manifest-unreadable');
  assert.equal(missing.diagnostic.cause.code, 'ENOENT');
  assert.match(missing.errors[0], /file path and permissions.*retry/);
  assert.doesNotMatch(JSON.stringify(missing), /private-missing/);
  assert.deepEqual((await validateSpriteAtlas(manifestPath)).errors, [], 'valid retry must not retain prior input failures');
  await assert.rejects(validateSpriteAtlas(null), {name: 'TypeError'}, 'programmer argument faults remain exceptions');

  // Isolate broken bundled-schema fixtures; never edit the repository's own schemas.
  const scripts = path.join(temporary, 'scripts'), schemas = path.join(temporary, 'schemas');
  await mkdir(scripts); await mkdir(schemas);
  for (const name of ['sprite-atlas-contract.mjs', 'validate-sprite-atlas.mjs']) {
    await copyFile(path.join(root, 'scripts', name), path.join(scripts, name));
  }
  const isolated = await import(pathToFileURL(path.join(scripts, 'sprite-atlas-contract.mjs')).href);
  let unavailable = await isolated.validateSpriteAtlas(manifestPath);
  assert.equal(unavailable.diagnostic.code, 'schema-unavailable');
  assert.equal(unavailable.diagnostic.cause.code, 'ENOENT');
  assert.match(unavailable.errors[0], /bundled.*schema.*checkout.*retry/i);
  const names = ['sprite-atlas-pack-v1.schema.json', 'sprite-atlas-capture-v1.schema.json'];
  for (const name of names) await copyFile(path.join(root, 'schemas', name), path.join(schemas, name));
  for (const name of names) {
    await writeFile(path.join(schemas, name), 'privatekey=secret');
    unavailable = await isolated.validateSpriteAtlas(manifestPath);
    assert.equal(unavailable.diagnostic.code, 'schema-unavailable');
    assert.ok(unavailable.diagnostic.cause instanceof SyntaxError);
    assert.doesNotMatch(JSON.stringify(unavailable), /privatekey|secret/);
    const run = spawnSync(process.execPath, [path.join(scripts, 'validate-sprite-atlas.mjs'), manifestPath], {encoding: 'utf8', timeout: 5000});
    assert.ifError(run.error); assert.equal(run.status, 1, run.stderr);
    assert.match(run.stderr, /checkout.*retry/);
    assert.doesNotMatch(run.stderr, /privatekey|secret|node:internal/);
    await copyFile(path.join(root, 'schemas', name), path.join(schemas, name));
    assert.deepEqual((await isolated.validateSpriteAtlas(manifestPath)).errors, [], 'repair permits a valid retry');
  }
} finally { await rm(temporary, {recursive: true, force: true}); }
process.stdout.write('Sprite-atlas input/schema causes, safe CLI diagnostics and retry checks passed.\n');
