#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';

const manifestPath = resolve(process.argv[2] || 'assets/units/infantry-sprite-v1/manifest.json');
const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

function edgesFor(size, count) {
  return Array.from({ length: count + 1 }, (_, index) => Math.floor(index * size / count));
}

function isInsideDirectory(filePath, directory) {
  const relativePath = relative(directory, filePath);
  return relativePath !== '..' && !relativePath.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`);
}

function readPngHeader(bytes, label) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  check(bytes.length >= 26 && bytes.subarray(0, 8).equals(signature), `${label} must be a PNG`);
  if (bytes.length < 26 || !bytes.subarray(0, 8).equals(signature)) {
    throw new Error(`${label} is not a readable PNG`);
  }
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    bitDepth: bytes[24],
    colorType: bytes[25],
  };
}

function isRect(rect) {
  return rect && ['x', 'y', 'width', 'height'].every((key) => Number.isInteger(rect[key]))
    && rect.x >= 0 && rect.y >= 0 && rect.width > 0 && rect.height > 0;
}

async function validateSpriteRuntime(manifest, width, height, manifestDirectory) {
  const runtime = manifest.spriteRuntime;
  const facings = manifest.facingColumns || [];
  const rows = manifest.rows || [];
  const grid = manifest.atlas?.frameGrid || {};
  check(runtime?.contractVersion === 1, 'spriteRuntime.contractVersion must be 1');
  check(runtime?.imageOrigin === 'top-left', 'spriteRuntime.imageOrigin must be top-left');
  check(Array.isArray(runtime?.frames), 'spriteRuntime.frames is required');
  check(Array.isArray(runtime?.animations), 'spriteRuntime.animations is required');
  check(runtime?.frames?.length === facings.length * rows.length,
    'spriteRuntime must describe every source row and facing');

  const framesById = new Map();
  for (const frame of runtime?.frames || []) {
    check(typeof frame.id === 'string' && frame.id.length > 0, 'every frame needs an id');
    check(!framesById.has(frame.id), `duplicate frame id ${frame.id}`);
    framesById.set(frame.id, frame);
    check(isRect(frame.rectPx), `${frame.id}: rectPx must be a positive integer rectangle`);
    check(isRect(frame.alphaBoundsPx), `${frame.id}: alphaBoundsPx must be a positive integer rectangle`);
    if (isRect(frame.rectPx)) {
      check(frame.rectPx.x + frame.rectPx.width <= width && frame.rectPx.y + frame.rectPx.height <= height,
        `${frame.id}: rectPx extends outside the atlas`);
    }
    if (isRect(frame.alphaBoundsPx)) {
      check(frame.alphaBoundsPx.x + frame.alphaBoundsPx.width <= width
        && frame.alphaBoundsPx.y + frame.alphaBoundsPx.height <= height,
      `${frame.id}: alphaBoundsPx extends outside the atlas`);
      if (isRect(frame.rectPx)) {
        check(frame.alphaBoundsPx.x >= frame.rectPx.x && frame.alphaBoundsPx.y >= frame.rectPx.y
          && frame.alphaBoundsPx.x + frame.alphaBoundsPx.width <= frame.rectPx.x + frame.rectPx.width
          && frame.alphaBoundsPx.y + frame.alphaBoundsPx.height <= frame.rectPx.y + frame.rectPx.height,
        `${frame.id}: alphaBoundsPx must be contained by rectPx`);
      }
    }
    const pivot = frame.groundPivotPx;
    check(pivot && Number.isInteger(pivot.x) && Number.isInteger(pivot.y),
      `${frame.id}: groundPivotPx must use integer atlas coordinates`);
    const cellColumn = frame.sourceCell?.column;
    const cellRow = frame.sourceCell?.row;
    const cellLeft = grid.columnEdgesPx?.[cellColumn];
    const cellRight = grid.columnEdgesPx?.[cellColumn + 1];
    const cellTop = grid.rowEdgesPx?.[cellRow];
    const cellBottom = grid.rowEdgesPx?.[cellRow + 1];
    if (pivot && [cellLeft, cellRight, cellTop, cellBottom].every(Number.isInteger)) {
      check(pivot.x >= cellLeft && pivot.x < cellRight && pivot.y >= cellTop && pivot.y < cellBottom,
        `${frame.id}: groundPivotPx must be inside its source cell`);
    }
    check(frame.groundAnchorMode === (frame.state === 'defeated'
      ? 'defeated-body-ground' : 'standing-feet-root-shared-across-poses'),
    `${frame.id}: groundAnchorMode must distinguish standing and defeated anchors`);
    const expectedRow = rows[frame.sourceCell?.row];
    const expectedFacing = facings.find((entry) => entry.direction === frame.facing);
    check(expectedRow?.id === frame.pose && expectedRow?.state === frame.state,
      `${frame.id}: pose/state do not match source row metadata`);
    check(expectedFacing?.column === frame.sourceCell?.column,
      `${frame.id}: facing/source column do not match manifest metadata`);
    if (expectedRow && expectedFacing) {
      check(frame.id === `${expectedRow.id}@${expectedFacing.direction}`,
        `${frame.id}: id must name its source pose and facing`);
    }
  }

  const animationKeys = new Set();
  const referencedFrames = new Set();
  const standingPivotsByFacing = new Map();
  for (const animation of runtime?.animations || []) {
    const key = `${animation.state}@${animation.facing}`;
    check(!animationKeys.has(key), `duplicate animation ${key}`);
    animationKeys.add(key);
    check(animation.id === key, `${key}: animation id must combine state and facing`);
    check(typeof animation.loop === 'boolean', `${key}: loop must be boolean`);
    check(Number.isFinite(animation.frameDurationMs) && animation.frameDurationMs >= 0,
      `${key}: frameDurationMs must be nonnegative`);
    check(Number.isFinite(animation.fps) && animation.fps >= 0, `${key}: fps must be nonnegative`);
    check(Array.isArray(animation.frameIds) && animation.frameIds.length > 0, `${key}: frameIds are required`);
    for (const frameId of animation.frameIds || []) {
      const frame = framesById.get(frameId);
      check(Boolean(frame), `${key}: missing frame ${frameId}`);
      if (frame) {
        check(frame.facing === animation.facing, `${key}: frame ${frameId} has a different facing`);
        referencedFrames.add(frameId);
      }
    }
  }
  for (const frame of framesById.values()) {
    if (frame.state === 'defeated' || !frame.groundPivotPx) continue;
    const column = frame.sourceCell?.column;
    const row = frame.sourceCell?.row;
    const cellLeft = grid.columnEdgesPx?.[column];
    const cellTop = grid.rowEdgesPx?.[row];
    if (!Number.isInteger(cellLeft) || !Number.isInteger(cellTop)) continue;
    const localPivot = [frame.groundPivotPx.x - cellLeft, frame.groundPivotPx.y - cellTop];
    const existing = standingPivotsByFacing.get(frame.facing);
    check(!existing || (existing[0] === localPivot[0] && existing[1] === localPivot[1]),
      `${frame.id}: standing pivot must stay stable across poses for this facing`);
    standingPivotsByFacing.set(frame.facing, localPivot);
  }
  check(animationKeys.size === facings.length * new Set((runtime?.animations || []).map((item) => item.state)).size,
    'each animation state must have one sequence for every facing');
  for (const frameId of framesById.keys()) check(referencedFrames.has(frameId), `${frameId}: frame is never referenced`);

  const presentation = runtime?.presentation || {};
  check(Number.isFinite(presentation.referenceStandingHeightWorld) && presentation.referenceStandingHeightWorld > 0,
    'presentation.referenceStandingHeightWorld must be positive');
  check(Number.isFinite(presentation.artBoundsWorld?.maxWidth) && presentation.artBoundsWorld.maxWidth > 0
    && Number.isFinite(presentation.artBoundsWorld?.maxHeight) && presentation.artBoundsWorld.maxHeight > 0,
  'presentation.artBoundsWorld maxWidth and maxHeight must be positive');
  check(presentation.tileFootprint?.width > 0 && presentation.tileFootprint?.depth > 0,
    'presentation.tileFootprint must be separate positive width/depth metadata');
  check(presentation.cullingBoundsWorld?.coversAllFrames === true,
    'presentation.cullingBoundsWorld must cover every frame');
  check(presentation.selectionBoundsWorld?.shape === 'circle',
    'presentation.selectionBoundsWorld must be declared separately');
  check(runtime?.anchorCalibration?.status === 'heuristic-anchor-candidate; requires visual turn/step review in game',
    'anchor calibration status must acknowledge that visual review is still required');

  const accentMask = manifest.teamTreatment?.accentMask;
  check(accentMask?.role === 'team-accent-mask', 'teamTreatment.accentMask.role must be team-accent-mask');
  check(accentMask?.channels === 'gray8' && accentMask?.maskChannel === 'red',
    'team accent mask must use gray8 data sampled from the red channel');
  check(accentMask?.colorSpace === 'linear-data', 'team accent mask must be tagged as linear data');
  check(typeof accentMask?.tintPolicy === 'string'
    && accentMask.tintPolicy.includes('preserving source luminance and alpha'),
  'team accent mask tintPolicy must preserve source luminance and alpha');
  check(accentMask?.values?.fullTeamTint === 255 && accentMask?.values?.preserveSource === 0,
    'team accent mask must define white as full tint and black as preserve');
  const maskPath = resolve(manifestDirectory, accentMask?.path || '.');
  check(isInsideDirectory(maskPath, manifestDirectory), 'team accent mask path must stay inside the pack directory');
  if (isInsideDirectory(maskPath, manifestDirectory)) {
    const maskBytes = await readFile(maskPath);
    const maskHeader = readPngHeader(maskBytes, 'team accent mask');
    check(maskHeader.width === width && maskHeader.height === height,
      'team accent mask dimensions must match the atlas');
    check(maskHeader.bitDepth === 8 && maskHeader.colorType === 0,
      'team accent mask must be 8-bit grayscale PNG');
    check(createHash('sha256').update(maskBytes).digest('hex') === accentMask?.sha256,
      'team accent mask SHA-256 does not match manifest');
    check(Number.isInteger(accentMask?.classifiedPixels) && accentMask.classifiedPixels > 0,
      'team accent mask needs a positive classifiedPixels count');
  }
}

try {
  const manifestBytes = await readFile(manifestPath);
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  const atlas = manifest.atlas || {};
  const grid = atlas.frameGrid || {};
  const columns = grid.columns;
  const rows = grid.rows;

  check(manifest.schemaVersion === 1, 'schemaVersion must be 1');
  check(/^unit\.(worker|infantry|archer)-sprite-exploration$/.test(manifest.packId || ''),
    'packId must identify a Worker, Infantry, or Archer sprite exploration');
  check(manifest.packKind === 'source-only-unit-sprite-atlas', 'unexpected packKind');
  check(atlas.role === 'source-image', 'atlas role must be source-image');
  check(typeof atlas.path === 'string' && atlas.path.length > 0, 'atlas path is required');
  check(Number.isInteger(columns) && columns > 0, 'frameGrid.columns must be a positive integer');
  check(Number.isInteger(rows) && rows > 0, 'frameGrid.rows must be a positive integer');
  check(Array.isArray(manifest.facingColumns) && manifest.facingColumns.length === columns,
    'facingColumns length must equal frameGrid.columns');
  check(Array.isArray(manifest.rows) && manifest.rows.length === rows,
    'rows length must equal frameGrid.rows');

  const atlasPath = resolve(dirname(manifestPath), atlas.path || '.');
  const relativeAtlasPath = relative(dirname(manifestPath), atlasPath);
  check(relativeAtlasPath !== '..' && !relativeAtlasPath.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`),
    'atlas path must stay inside the manifest directory');

  if (relativeAtlasPath === '..' || relativeAtlasPath.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`)) {
    throw new Error('atlas path escapes the pack directory');
  }

  const image = await readFile(atlasPath);
  const { width, height, bitDepth, colorType } = readPngHeader(image, 'atlas');
  const sha256 = createHash('sha256').update(image).digest('hex');

  check(width === atlas.dimensionsPx?.width && height === atlas.dimensionsPx?.height,
    `PNG dimensions ${width}x${height} do not match manifest dimensions`);
  check(bitDepth === 8 && colorType === 6, 'atlas must be 8-bit RGBA PNG');
  check(sha256 === atlas.sha256, 'atlas SHA-256 does not match manifest');
  check(grid.edgeRule === 'floor(index * atlasDimension / cellCount)', 'unsupported frame edge rule');
  check(JSON.stringify(grid.columnEdgesPx) === JSON.stringify(edgesFor(width, columns)),
    'columnEdgesPx do not partition the PNG dimensions');
  check(JSON.stringify(grid.rowEdgesPx) === JSON.stringify(edgesFor(height, rows)),
    'rowEdgesPx do not partition the PNG dimensions');
  check(grid.gutterPx === 0, 'this validator currently expects a zero-gutter atlas');
  await validateSpriteRuntime(manifest, width, height, dirname(manifestPath));

  if (failures.length) throw new Error(failures.join('\n'));
  console.log(`PASS ${manifest.packId} ${width}x${height} RGBA, ${columns}x${rows}, sha256 ${sha256}`);
} catch (error) {
  console.error(`FAIL ${error.message}`);
  process.exitCode = 1;
}
