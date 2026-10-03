import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'rts-visual-pack-path-safety-'));
const packRoot = path.join(tempRoot, 'pack');
const outsideModelPath = path.join(tempRoot, 'outside.glb');
const manifestPath = path.join(packRoot, 'manifest.json');
const modelPath = path.join(packRoot, 'model.glb');

function makeGlb(json) {
  const jsonBytes = Buffer.from(JSON.stringify(json), 'utf8');
  const paddingLength = (4 - (jsonBytes.length % 4)) % 4;
  const paddedJson = Buffer.concat([jsonBytes, Buffer.alloc(paddingLength, 0x20)]);
  const header = Buffer.alloc(12);
  header.write('glTF', 0, 'ascii');
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(20 + paddedJson.length, 8);
  const jsonChunkHeader = Buffer.alloc(8);
  jsonChunkHeader.writeUInt32LE(paddedJson.length, 0);
  jsonChunkHeader.writeUInt32LE(0x4e4f534a, 4);
  return Buffer.concat([header, jsonChunkHeader, paddedJson]);
}

function anchor(id) {
  return { id, node: id };
}

function runValidator(input, script = path.join(root, 'scripts/validate-visual-pack.mjs')) {
  const result = spawnSync(process.execPath, [script, input], {cwd: root, encoding: 'utf8', timeout: 10000});
  assert.ifError(result.error);
  return result;
}

function expectLoadFailure(result, message) {
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, message);
  assert.doesNotMatch(result.stderr, /node:internal|privatekey|secret/);
  assert.equal(result.stderr.includes(tempRoot), false, 'expected failure must not echo the absolute input path');
  assert.equal(result.stdout, '');
}

try {
  await mkdir(packRoot, { recursive: true });
  const outsideModel = makeGlb({
    asset: { version: '2.0' },
    scenes: [{ nodes: [] }],
    scene: 0,
    nodes: [],
    meshes: [],
    skins: [{}],
    images: [{ uri: 'outside.png' }],
    textures: [{ source: 0 }],
  });
  await writeFile(outsideModelPath, outsideModel);
  await symlink(outsideModelPath, modelPath);

  const unitBatchKeys = [
    'unit.humanoid-core',
    'unit.team-accent',
    'unit.worker.backpack',
    'unit.worker.tool',
    'unit.infantry.shield',
    'unit.infantry.spear',
    'unit.archer.bow',
    'unit.archer.quiver',
  ];
  const unitParts = unitBatchKeys.slice(0, 4).map((batchKey, index) => ({
    id: 'unit-part-' + index,
    node: 'unit-part-' + index,
    batchKey,
    paletteSlot: index === 1 ? 'team-accent' : 'neutral',
  }));
  const manifest = {
    schemaVersion: 1,
    packId: 'symlink-escape-test',
    packVersion: '1.0.0',
    packKind: 'character-building',
    coordinateSystem: { units: 'world-unit', up: '+Y', forward: '+Z', right: '+X' },
    provenance: { license: 'test-only', source: 'generated test fixture' },
    budgets: {
      maxUnitPartBins: 8,
      maxUnitTeamBatches: 16,
      projectedUnitPartBins: 0,
      projectedUnitTeamBatches: 0,
      maxEnvironmentBatches: 10,
      projectedEnvironmentBatches: 0,
      maxTextureMemoryBytes: 0,
      projectedTextureMemoryBytes: 0,
      maxAdditionalDrawCalls: 0,
      projectedAdditionalDrawCalls: 0,
      projectedBuildingDrawCallsPerStructure: 0,
    },
    files: [{
      path: 'model.glb',
      role: 'model',
      sha256: createHash('sha256').update(outsideModel).digest('hex'),
      license: 'test-only',
      provenance: 'generated test fixture',
    }],
    unitBatchRegistry: unitBatchKeys.map((batchKey, index) => index < 4
      ? { batchKey, status: 'active', modelFile: 'model.glb', node: 'unit-part-' + index }
      : { batchKey, status: 'reserved' }),
    assets: [
      {
        id: 'worker',
        kind: 'unit',
        modelFile: 'model.glb',
        boundsWorld: { width: 1, height: 0.8, depth: 1 },
        bodyHeightWorld: 0.8,
        groundAnchor: 'ground',
        parts: unitParts,
        anchors: ['ground', 'foot', 'headPivot', 'toolGrip'].map(anchor),
        stateSamples: [{ state: 'idle', poseId: 'idle' }, { state: 'build', poseId: 'build' }],
      },
      {
        id: 'barracks',
        kind: 'building',
        modelFile: 'model.glb',
        boundsWorld: { width: 3, height: 2, depth: 3 },
        footprintWorld: { width: 3, depth: 3 },
        groundAnchor: 'ground',
        parts: [{ id: 'barracks-main', node: 'barracks-main', batchKey: 'building.barracks.main', paletteSlot: 'neutral' }],
        anchors: ['ground', 'gate', 'standard', 'rallyPoint', 'productionCue'].map(anchor),
        stateSamples: [
          { state: 'construction-mid', poseId: 'construction-mid' },
          { state: 'complete', poseId: 'complete' },
        ],
      },
    ],
  };
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

  const result = spawnSync(process.execPath, [path.join(root, 'scripts/validate-visual-pack.mjs'), manifestPath], {
    cwd: root,
    encoding: 'utf8',
  });
  const output = (result.stdout || '') + (result.stderr || '');
  assert.notEqual(result.status, 0, 'an external model symlink must be rejected');
  assert.match(output, /file symlink escapes its pack directory: model\.glb/);
  assert.doesNotMatch(output, /uses skinning|embeds textures/,
    'the validator must not parse model bytes reached through an external symlink');
  console.log('Visual pack path-safety scenario passed: external model symlinks are rejected before GLB bytes are read.');

  expectLoadFailure(runValidator(path.join(tempRoot, 'private-missing', 'manifest.json')), /file path and permissions.*retry/);
  expectLoadFailure(runValidator(path.join(packRoot, 'private-missing.json')), /file path and permissions.*retry/);
  expectLoadFailure(runValidator(packRoot), /file path and permissions.*retry/);
  const privateInput = path.join(packRoot, 'private-input.json');
  await writeFile(privateInput, 'privatekey=secret');
  expectLoadFailure(runValidator(privateInput), /valid JSON.*retry/);
  assert.equal(await readFile(privateInput, 'utf8'), 'privatekey=secret', 'validation leaves author input intact');
  await writeFile(privateInput, JSON.stringify(manifest));
  const retry = runValidator(privateInput);
  assert.equal(retry.status, 1);
  assert.match(retry.stderr, /file symlink escapes its pack directory: model\.glb/,
    'repairing input reaches normal asset validation without weakening symlink checks');
  assert.doesNotMatch(retry.stderr, /could not be read|must be valid JSON/);

  // Break and repair only a copied tool/schema fixture, preserving shared source files.
  const scripts = path.join(tempRoot, 'scripts'), schemas = path.join(tempRoot, 'schemas');
  await mkdir(scripts); await mkdir(schemas);
  const isolatedTool = path.join(scripts, 'validate-visual-pack.mjs');
  const isolatedSchema = path.join(schemas, 'renderer-asset-pack-v1.schema.json');
  await copyFile(path.join(root, 'scripts/validate-visual-pack.mjs'), isolatedTool);
  const validInput = path.join(root, 'assets/environment/frontier-interactive-v1/manifest.json');
  expectLoadFailure(runValidator(validInput, isolatedTool), /bundled.*schema.*checkout.*retry/i);
  await writeFile(isolatedSchema, 'privatekey=secret');
  expectLoadFailure(runValidator(validInput, isolatedTool), /bundled.*schema.*checkout.*retry/i);
  await copyFile(path.join(root, 'schemas/renderer-asset-pack-v1.schema.json'), isolatedSchema);
  const repaired = runValidator(validInput, isolatedTool);
  assert.equal(repaired.status, 0, repaired.stderr);
  assert.match(repaired.stdout, /Visual pack validation passed/);

  await writeFile(isolatedSchema, JSON.stringify({type: 'object', properties: {packId: {enum: {}}}}));
  const fault = runValidator(validInput, isolatedTool);
  assert.equal(fault.status, 1);
  assert.match(fault.stderr, /TypeError:.*is not a function/,
    'unexpected schema processing faults remain programmer faults');
  assert.match(fault.stderr, /at checkSchema/);
  assert.doesNotMatch(fault.stderr, /file path and permissions|Check its syntax/);
  console.log('Visual pack input/schema failures, safe messages, repair/retry and programmer-fault checks passed.');
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
