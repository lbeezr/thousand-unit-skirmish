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
  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  check(image.length >= 26 && image.subarray(0, 8).equals(pngSignature), 'atlas must be a PNG');
  if (image.length < 26 || !image.subarray(0, 8).equals(pngSignature)) {
    throw new Error('atlas is not a readable PNG');
  }

  const width = image.readUInt32BE(16);
  const height = image.readUInt32BE(20);
  const bitDepth = image[24];
  const colorType = image[25];
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

  if (failures.length) throw new Error(failures.join('\n'));
  console.log(`PASS ${manifest.packId} ${width}x${height} RGBA, ${columns}x${rows}, sha256 ${sha256}`);
} catch (error) {
  console.error(`FAIL ${error.message}`);
  process.exitCode = 1;
}
