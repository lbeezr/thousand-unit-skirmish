import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { importSources, verifyArchive, writeCatalog, runMeshy, sanitize, cliArguments } from './assets/meshy-source-archive.mjs';

function glb(extra = {}) {
  let json = JSON.stringify({ asset: { version: '2.0' }, ...extra });
  json += ' '.repeat((4 - Buffer.byteLength(json) % 4) % 4);
  const header = Buffer.alloc(20);
  header.write('glTF'); header.writeUInt32LE(2, 4); header.writeUInt32LE(20 + Buffer.byteLength(json), 8);
  header.writeUInt32LE(Buffer.byteLength(json), 12); header.writeUInt32LE(0x4e4f534a, 16);
  return Buffer.concat([header, Buffer.from(json)]);
}

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'meshy-archive-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const source = path.join(root, 'source');
  await fs.mkdir(source);
  return { root, source, archive: path.join(root, 'permanent') };
}

test('deduplicates models, preserves provenance, and survives source deletion', async t => {
  const f = await fixture(t);
  await fs.writeFile(path.join(f.source, 'original.glb'), glb());
  await fs.writeFile(path.join(f.source, 'alias.glb'), glb());
  await fs.writeFile(path.join(f.source, 'task.json'), JSON.stringify({ id: 'task-1', model_url: 'https://signed.example/?secret=x', token: 'hidden' }));
  await importSources({ ...f, sources: [f.source] });
  await importSources({ ...f, sources: [f.source] });
  await fs.rm(f.source, { recursive: true });
  const result = await verifyArchive(f.archive);
  assert.equal(result.sourceFiles, 2);
  assert.equal(result.uniqueModels, 1);
  await fs.rm(path.join(f.archive, 'jobs'), { recursive: true });
  await fs.rm(path.join(f.archive, 'by-asset'), { recursive: true });
  await assert.rejects(verifyArchive(f.archive), /ENOENT/);
  await writeCatalog(f.archive);
  assert.equal((await verifyArchive(f.archive)).uniqueModels, 1);
  const receipts = await fs.readdir(path.join(f.archive, 'provenance'));
  assert.equal(receipts.length, 1);
  const receipt = JSON.parse(await fs.readFile(path.join(f.archive, 'provenance', receipts[0]), 'utf8'));
  assert.deepEqual(receipt.data, { id: 'task-1' });
});

test('rejects wrong source hash, truncated files and external dependencies', async t => {
  const f = await fixture(t), filename = path.join(f.source, 'model.glb');
  await fs.writeFile(filename, glb());
  await assert.rejects(importSources({ ...f, sources: [filename], expectedSha256: '0'.repeat(64) }), /hash mismatch/);
  await fs.writeFile(filename, glb().subarray(0, 22));
  await assert.rejects(importSources({ ...f, sources: [filename] }), /truncated/);
  await fs.writeFile(filename, glb({ images: [{ uri: 'missing.png' }] }));
  await assert.rejects(importSources({ ...f, sources: [filename] }), /external dependency/);
  await fs.writeFile(filename, glb({ buffers: [{ byteLength: 400 }] }));
  await assert.rejects(importSources({ ...f, sources: [filename] }), /exceeds its binary/);
  const invalidChunk = Buffer.concat([glb(), Buffer.alloc(8)]);
  invalidChunk.writeUInt32LE(invalidChunk.length, 8);
  invalidChunk.writeUInt32LE(400, invalidChunk.length - 8);
  await fs.writeFile(filename, invalidChunk);
  await assert.rejects(importSources({ ...f, sources: [filename] }), /chunk length/);
});

test('detects corrupt preserved bytes and refuses to replace them', async t => {
  const f = await fixture(t);
  await fs.writeFile(path.join(f.source, 'model.glb'), glb());
  await importSources({ ...f, sources: [f.source] });
  const result = await verifyArchive(f.archive);
  const object = path.join(f.archive, result.records[0].objectPath);
  await fs.chmod(object, 0o600);
  await fs.writeFile(object, glb({ meshes: [{}] }));
  await assert.rejects(verifyArchive(f.archive), /verification failed/);
  await assert.rejects(importSources({ ...f, sources: [f.source] }), /corrupt/);
});

test('refuses disposable worktrees and symlinked object directories', async t => {
  const f = await fixture(t);
  await fs.writeFile(path.join(f.source, 'model.glb'), glb());
  await assert.rejects(importSources({ ...f, archive: path.join(f.root, 'worktrees', 'archive'), sources: [f.source] }), /outside disposable/);
  await fs.mkdir(f.archive);
  await fs.symlink(f.source, path.join(f.archive, 'objects'));
  await assert.rejects(importSources({ ...f, sources: [f.source] }), /Symlinked/);
  await assert.rejects(verifyArchive(f.archive), /Invalid archive directory/);
});

test('organizes asset variants and stages without duplicating bytes or accepting unsafe names', async t => {
  const f = await fixture(t), filename = path.join(f.source, 'model.glb');
  await fs.writeFile(filename, glb());
  await importSources({ ...f, sources: [filename], asset: 'worker', variant: 'frontier-v2-blue', stage: 'base' });
  const first = await verifyArchive(f.archive);
  assert.match(first.records[0].namedPath, /^by-asset\/worker\/frontier-v2-blue\/base\/worker--frontier-v2-blue--base--[a-f0-9]{16}\.glb$/);
  const base = await fs.stat(path.join(f.archive, first.records[0].namedPath));
  await importSources({ ...f, sources: [filename], asset: 'worker', variant: 'frontier-v2-red', stage: 'base' });
  await fs.copyFile(filename, path.join(f.source, 'walk.glb'));
  await importSources({ ...f, sources: [path.join(f.source, 'walk.glb')], asset: 'worker', variant: 'frontier-v2-blue', stage: 'walk' });
  const result = await verifyArchive(f.archive);
  assert.equal(result.uniqueModels, 1);
  assert.equal(result.sourceFiles, 2);
  assert.equal(result.catalogEntries, 3);
  const walk = result.records.find(record => record.stage === 'walk');
  assert.equal((await fs.stat(path.join(f.archive, walk.namedPath))).ino, base.ino);
  await assert.rejects(importSources({ ...f, sources: [filename], asset: '../escape' }), /lowercase name/);
  await assert.rejects(runMeshy({ archive: f.archive, args: ['make', 'reference.png'] }), /require --asset/);
  const alias = path.join(f.archive, walk.namedPath);
  await fs.unlink(alias);
  await fs.symlink(filename, alias);
  await assert.rejects(verifyArchive(f.archive), /Named model verification failed/);
});

test('archive runner confines writes, redacts receipt secrets and archives even partial failed jobs', async t => {
  const f = await fixture(t), fake = path.join(f.root, 'fake-meshy.mjs');
  await fs.writeFile(fake, `import fs from 'node:fs'; import path from 'node:path';
const args = process.argv.slice(2), job = args[args.indexOf('--workspace') + 1];
if (process.cwd() !== job) process.exit(9);
fs.writeFileSync(path.join(job, 'model.glb'), Buffer.from('${glb().toString('base64')}', 'base64'));
console.log(JSON.stringify({task_id:'existing-task',model_url:'https://signed.example/',token:'hidden'}));
process.exit(8);`);
  const result = await runMeshy({ archive: f.archive, asset: 'worker', variant: 'frontier-v2', stage: 'base', args: ['download', '--task-id', 'existing-task', '--resource', 'image-to-3d'], runner: [process.execPath, fake] });
  assert.equal(result.exitCode, 8);
  assert.equal(result.archivedModels, true);
  assert.equal(result.modelVerification, 'passed');
  assert.match(path.basename(result.job), /^worker--frontier-v2--base--/);
  assert.deepEqual(result.receipt, { task_id: 'existing-task' });
  assert.equal((await verifyArchive(f.archive)).uniqueModels, 1);
  assert.throws(() => cliArguments(['make', 'x', '--output=/tmp/x'], '/archive/job'), /owns output/);
  assert.throws(() => cliArguments(['make', 'x', '-o/tmp/x'], '/archive/job'), /owns output/);
  assert.deepEqual(sanitize({ secret: 'x', info: 'see https://signed.example/?x=y', id: 'safe' }), { info: 'see [URL omitted]', id: 'safe' });
});

test('selective downloads use a directory so single and multiple GLBs retain their filenames', async t => {
  const f = await fixture(t), fake = path.join(f.root, 'fake-downloader.mjs');
  await fs.writeFile(fake, `import fs from 'node:fs'; import path from 'node:path';
const args=process.argv.slice(2), index=args.indexOf('--output-dir');
// CLI 0.4.0's --output names one file; --output-dir keeps enumerated asset names.
if (index<0 || args.includes('--output')) process.exit(2);
const dir=args[index+1]; fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(path.join(dir,'model.glb'),Buffer.from('${glb().toString('base64')}','base64'));
if(args.includes('--all'))fs.writeFileSync(path.join(dir,'walking.glb'),Buffer.from('${glb({ animations: [{ name: 'walk' }] }).toString('base64')}','base64'));
console.log(JSON.stringify({task_id:'existing-rig',downloads:{state:'completed'}}));`);
  for (const selection of [[], ['--all']]) {
    const result = await runMeshy({ archive: f.archive, asset: 'worker', variant: 'frontier-v2', stage: 'rigged',
      args: ['download', '--resource', 'rigging', '--task-id', 'existing-rig', ...selection], runner: [process.execPath, fake] });
    assert.equal(result.exitCode, 0);
    assert.equal(result.modelVerification, 'passed');
    assert.ok((await fs.stat(path.join(result.job, 'downloads', 'model.glb'))).isFile());
  }
  assert.equal((await verifyArchive(f.archive)).uniqueModels, 2);
});

test('a terminated CLI remains a failed operation while preserving delivered GLBs', async t => {
  const f = await fixture(t), fake = path.join(f.root, 'terminated-cli.mjs');
  await fs.writeFile(fake, `import fs from 'node:fs';
fs.writeFileSync('model.glb',Buffer.from('${glb().toString('base64')}','base64'));
process.kill(process.pid,'SIGTERM');`);
  const result = await runMeshy({ archive: f.archive, asset: 'worker', variant: 'frontier-v2', stage: 'base',
    args: ['make', '/absolute/reference.png'], runner: [process.execPath, fake] });
  assert.equal(result.exitCode, 143);
  assert.equal(result.terminationSignal, 'SIGTERM');
  assert.equal(result.archivedModels, true);
  assert.equal((await verifyArchive(f.archive)).uniqueModels, 1);
});
