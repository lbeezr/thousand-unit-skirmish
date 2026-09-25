import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
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
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
