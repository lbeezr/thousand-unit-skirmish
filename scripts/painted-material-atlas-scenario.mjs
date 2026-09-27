import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePaintedMaterialAtlas } from './painted-material-atlas-contract.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const manifestPath = path.join(root, 'assets/environment/frontier-painted-material-atlas-v1/manifest.json');
const valid = await validatePaintedMaterialAtlas(manifestPath);
assert.deepEqual(valid.errors, [], 'the shipped painted-material atlas should satisfy its schema and content contract');
assert.equal(valid.verifiedFileCount, 16);
assert.equal(valid.allManifestHashesVerified, true);
assert.equal(valid.manifest.materials.length, 8);
assert.equal(valid.manifest.page.mipLevels.length, 6);

const brokenUv = structuredClone(valid.manifest);
brokenUv.materials[0].uvRectTopLeft.min.u += 0.01;
const uvResult = await validatePaintedMaterialAtlas(manifestPath, brokenUv);
assert.ok(uvResult.errors.some((error) => error.includes('meadow: UV rectangle')),
  'the validator should reject UV drift even when a normalized coordinate remains in range');

const restrictedSource = structuredClone(valid.manifest);
restrictedSource.files.find((entry) => entry.id === 'source-meadow').path = 'assets/environment/frontier-v1/berries.png';
const sourceResult = await validatePaintedMaterialAtlas(manifestPath, restrictedSource);
assert.ok(sourceResult.errors.some((error) => error.includes('source-meadow: path, usage, and format')),
  'the validator should reject a source path outside the eight-material sample');

process.stdout.write('Painted-material atlas scenario passed: schema, hashes, dimensions, mip chain, UV mapping, and source allowlist.\n');
