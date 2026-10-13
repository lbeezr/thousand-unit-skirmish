#!/usr/bin/env node
// Private production-source tooling. Nothing in this archive is a game asset admission.
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, constants } from 'node:fs';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const defaultArchive = path.join(os.homedir(), 'Documents/thousand-unit-skirmish-source-archive/meshy');
const schemaVersion = 1;
const hashPattern = /^[a-f0-9]{64}$/;
const slugPattern = /^[a-z0-9][a-z0-9-]{0,63}$/;

function identity(options, required = false) {
  const fields = ['asset', 'variant', 'stage'];
  if (required && fields.some(key => !options[key])) throw new Error('Production runs require --asset, --variant and --stage');
  const values = { asset: options.asset || 'legacy', variant: options.variant || 'unclassified', stage: options.stage || 'source' };
  for (const [key, value] of Object.entries(values)) if (!slugPattern.test(value))
    throw new Error(`${key} must be a lowercase name of 1–64 letters, digits or hyphens`);
  return values;
}

function namedPath(record) {
  const { asset, variant, stage } = identity(record);
  return path.join('by-asset', asset, variant, stage, `${asset}--${variant}--${stage}--${record.sha256.slice(0, 16)}.glb`);
}

async function nameObject(archive, record) {
  const relative = namedPath(record), filename = path.join(archive, relative);
  let directory = archive;
  for (const part of path.dirname(relative).split(path.sep)) {
    directory = path.join(directory, part);
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    if ((await fs.lstat(directory)).isSymbolicLink()) throw new Error('Symlinked named-model directory');
  }
  const object = await objectFile(archive, record.sha256);
  try { await fs.link(object, filename); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  const stat = await fs.lstat(filename), original = await fs.stat(object);
  if (!stat.isFile() || stat.isSymbolicLink()
    || ((stat.ino !== original.ino || stat.dev !== original.dev) && await digest(filename) !== record.sha256))
    throw new Error('Named model does not match its preserved object');
  return relative;
}

export async function digest(filename) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filename)) hash.update(chunk);
  return hash.digest('hex');
}

export function sanitize(value) {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !/(url|token|secret|password|authorization|api.?key|cookie)/i.test(key))
    .map(([key, item]) => [key, sanitize(item)]));
  if (typeof value === 'string') return value
    .replace(/https?:\/\/\S+/g, '[URL omitted]')
    .replace(/\bmsy_[A-Za-z0-9_-]+/g, '[key omitted]');
  return value;
}

async function prepare(archive) {
  archive = path.resolve(archive);
  // Worktree cleanup must never be able to remove the permanent source copy.
  if (archive.split(path.sep).includes('worktrees')) throw new Error('Archive must be outside disposable worktrees');
  await fs.mkdir(archive, { recursive: true, mode: 0o700 });
  if ((await fs.lstat(archive)).isSymbolicLink()) throw new Error('Archive must not be a symlink');
  archive = await fs.realpath(archive);
  if (archive.split(path.sep).includes('worktrees')) throw new Error('Archive must be outside disposable worktrees');
  for (const dir of ['objects', 'records', 'provenance', 'jobs']) {
    await fs.mkdir(path.join(archive, dir), { recursive: true, mode: 0o700 });
    if ((await fs.lstat(path.join(archive, dir))).isSymbolicLink()) throw new Error(`Symlinked archive directory: ${dir}`);
  }
  return archive;
}

async function readJson(filename) { return JSON.parse(await fs.readFile(filename, 'utf8')); }

async function saveJson(filename, value) {
  const temporary = `${filename}.${randomUUID()}.tmp`;
  const handle = await fs.open(temporary, 'wx', 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`);
    await handle.sync();
  } finally { await handle.close(); }
  try { await fs.rename(temporary, filename); }
  finally { await fs.rm(temporary, { force: true }); }
}

async function glbInfo(filename) {
  const size = (await fs.stat(filename)).size;
  const handle = await fs.open(filename, 'r');
  try {
    const header = Buffer.alloc(20);
    await handle.read(header, 0, header.length, 0);
    if (size < 20 || header.toString('ascii', 0, 4) !== 'glTF'
      || header.readUInt32LE(4) !== 2 || header.readUInt32LE(8) !== size
      || header.readUInt32LE(16) !== 0x4e4f534a) throw new Error(`Invalid or truncated GLB: ${filename}`);
    const length = header.readUInt32LE(12);
    if (!length || length % 4 || length > 64 * 1024 * 1024 || 20 + length > size) throw new Error(`Invalid GLB JSON chunk: ${filename}`);
    const json = Buffer.alloc(length);
    await handle.read(json, 0, length, 20);
    const model = JSON.parse(json.toString('utf8').trim());
    let offset = 20 + length, binaryBytes = 0;
    while (offset < size) {
      if (offset + 8 > size) throw new Error(`Truncated GLB chunk header: ${filename}`);
      const chunk = Buffer.alloc(8);
      await handle.read(chunk, 0, 8, offset);
      const chunkBytes = chunk.readUInt32LE(0);
      if (chunkBytes % 4 || offset + 8 + chunkBytes > size) throw new Error(`Invalid GLB chunk length: ${filename}`);
      if (chunk.readUInt32LE(4) === 0x004e4942) binaryBytes += chunkBytes;
      offset += 8 + chunkBytes;
    }
    // A claimed self-contained archive must not silently lose external textures/buffers.
    for (const item of [...(model.buffers || []), ...(model.images || [])]) {
      if (item.uri && !item.uri.startsWith('data:')) throw new Error(`GLB has external dependency ${item.uri}; package it before archiving`);
    }
    if ((model.buffers || []).some(buffer => !buffer.uri && buffer.byteLength > binaryBytes))
      throw new Error(`GLB buffer exceeds its binary chunk: ${filename}`);
    return { bytes: size, meshes: model.meshes?.length || 0, animations: model.animations?.map(x => x.name || '(unnamed)') || [] };
  } finally { await handle.close(); }
}

async function* files(root) {
  const stat = await fs.lstat(root);
  if (!stat.isDirectory()) { yield root; return; }
  for (const entry of (await fs.readdir(root, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const filename = path.join(root, entry.name);
    if (entry.isDirectory()) yield* files(filename);
    else if (entry.isFile()) yield filename;
    // Do not follow directory aliases or stale model aliases into deleted worktrees.
  }
}

async function objectFile(archive, hash) {
  if (!hashPattern.test(hash)) throw new Error('Invalid object hash');
  const filename = path.join(archive, 'objects', `${hash}.glb`);
  const stat = await fs.lstat(filename);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Invalid archive object: ${hash}`);
  return filename;
}

export async function importSources({ archive = defaultArchive, sources, label = 'Meshy source', expectedSha256, asset, variant, stage }) {
  const names = identity({ asset, variant, stage });
  archive = await prepare(archive);
  if (expectedSha256 && (sources.length !== 1 || !(await fs.stat(sources[0])).isFile()))
    throw new Error('--expected-sha256 requires one model file');
  const imported = [];
  for (const source of sources) {
    const absolute = path.resolve(source);
    if ((absolute === archive || absolute.startsWith(`${archive}${path.sep}`))
      && !absolute.startsWith(`${path.join(archive, 'jobs')}${path.sep}`)) throw new Error('Cannot import archive into itself');
    for await (const filename of files(absolute)) {
      if (path.extname(filename).toLowerCase() === '.json') {
        // Provider receipts may contain expiring signed URLs. Keep safe lineage only.
        const rawHash = await digest(filename);
        let value;
        try { value = sanitize(await readJson(filename)); }
        catch { continue; }
        await saveJson(path.join(archive, 'provenance', `${rawHash}.json`), { schemaVersion, source: filename, sourceSha256: rawHash, data: value });
        continue;
      }
      if (path.extname(filename).toLowerCase() !== '.glb') continue;
      const info = await glbInfo(filename);
      const hash = await digest(filename);
      if (expectedSha256 && hash !== expectedSha256) throw new Error(`Source hash mismatch: ${filename}`);
      const objectPath = path.join('objects', `${hash}.glb`);
      const destination = path.join(archive, objectPath);
      try {
        const existing = await objectFile(archive, hash);
        if (await digest(existing) !== hash) throw new Error(`Existing archive object is corrupt: ${hash}`);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        const temporary = `${destination}.${randomUUID()}.tmp`;
        try {
          await fs.copyFile(filename, temporary, constants.COPYFILE_EXCL);
          if (await digest(temporary) !== hash) throw new Error(`Copy verification failed: ${filename}`);
          const handle = await fs.open(temporary, 'r+');
          try { await handle.sync(); } finally { await handle.close(); }
          await fs.chmod(temporary, 0o400);
          // A concurrent importer must never overwrite a preserved object.
          try { await fs.link(temporary, destination); }
          catch (error) {
            if (error.code !== 'EEXIST') throw error;
            if (await digest(await objectFile(archive, hash)) !== hash) throw new Error('Concurrent archive object mismatch');
          }
        } finally { await fs.rm(temporary, { force: true }); }
      }
      const record = { schemaVersion, provider: 'Meshy', label, filename: path.basename(filename), source: filename,
        relativeSource: path.relative((await fs.stat(absolute)).isDirectory() ? absolute : path.dirname(absolute), filename),
        sha256: hash, objectPath, ...info, ...names };
      record.namedPath = await nameObject(archive, record);
      const recordId = createHash('sha256').update(`${filename}\0${hash}\0${names.asset}\0${names.variant}\0${names.stage}`).digest('hex');
      await saveJson(path.join(archive, 'records', `${recordId}.json`), record);
      imported.push(record);
    }
  }
  if (!imported.length) throw new Error('No self-contained GLB models found');
  return { archive, sourceFiles: imported.length, uniqueModels: new Set(imported.map(x => x.sha256)).size };
}

export async function verifyArchive(archive = defaultArchive, { verifyNames = true } = {}) {
  archive = path.resolve(archive);
  for (const dir of ['', 'objects', 'records', 'provenance', 'jobs']) {
    const stat = await fs.lstat(path.join(archive, dir));
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`Invalid archive directory: ${dir || archive}`);
  }
  const records = [];
  for (const name of await fs.readdir(path.join(archive, 'records'))) if (name.endsWith('.json')) {
    const record = await readJson(path.join(archive, 'records', name));
    if (record.schemaVersion !== schemaVersion || !hashPattern.test(record.sha256)
      || record.objectPath !== `objects/${record.sha256}.glb`) throw new Error(`Invalid archive record: ${name}`);
    records.push(record);
  }
  const unique = new Map(records.map(record => [record.sha256, record]));
  let bytes = 0;
  for (const [hash, record] of unique) {
    const filename = await objectFile(archive, hash);
    const info = await glbInfo(filename);
    if (info.bytes !== record.bytes || await digest(filename) !== hash) throw new Error(`Archive verification failed: ${record.filename}`);
    bytes += info.bytes;
  }
  for (const record of records) if (record.bytes !== unique.get(record.sha256).bytes) throw new Error('Conflicting model byte counts');
  for (const record of records) if (record.namedPath) {
    if (record.namedPath !== namedPath(record)) throw new Error('Invalid named model path');
    if (!verifyNames) continue;
    let directory = archive;
    for (const part of path.dirname(record.namedPath).split(path.sep)) {
      directory = path.join(directory, part);
      if ((await fs.lstat(directory)).isSymbolicLink()) throw new Error('Symlinked named-model directory');
    }
    const filename = path.join(archive, record.namedPath), stat = await fs.lstat(filename);
    const original = await fs.stat(await objectFile(archive, record.sha256));
    if (!stat.isFile() || stat.isSymbolicLink()
      || ((stat.ino !== original.ino || stat.dev !== original.dev) && await digest(filename) !== record.sha256))
      throw new Error('Named model verification failed');
  }
  return { archive, sourceFiles: new Set(records.map(record => `${record.source}\0${record.sha256}`)).size,
    catalogEntries: records.length, uniqueModels: unique.size, bytes, records };
}

export async function writeCatalog(archive = defaultArchive) {
  archive = await prepare(archive);
  const result = await verifyArchive(archive, { verifyNames: false });
  // Older recovered records retain their original names and receive a browseable legacy index.
  for (const record of result.records) record.namedPath = await nameObject(result.archive, record);
  await saveJson(path.join(result.archive, 'catalog.json'), { schemaVersion, verifiedAt: new Date().toISOString(), ...result });
  const rows = result.records.map(r => `| ${r.label.replaceAll('|', '/')} | ${r.relativeSource.replaceAll('|', '/')} | ${(r.bytes / 1e6).toFixed(1)} | [${r.sha256.slice(0, 12)}](${r.namedPath}) |`);
  await fs.writeFile(path.join(result.archive, 'README.md'), `# Thousand Unit Skirmish Meshy source archive\n\nPrivate production sources, independent of Git worktrees. Do not delete when cleaning a checkout.\n\n${result.uniqueModels} unique models, ${result.sourceFiles} recorded source paths, ${(result.bytes / 1e9).toFixed(3)} GB. Every object passed SHA-256, byte-count and self-contained GLB checks.\n\nBrowse readable models under by-asset/<asset>/<variant>/<stage>/. Named files are hard links to the read-only objects/<sha256>.glb and use no extra model storage. catalog.json maps names and original paths to each object. Provenance contains sanitized task receipts; jobs retains future CLI output. recovery.json, when present, records missing originals. This directory is a local archive, not an off-device backup. Standalone verification: node archive.mjs verify. After restoring objects/records/provenance, node archive.mjs index verifies bytes and rebuilds named links and the catalog.\n\n| Collection | Original relative path | MB | SHA-256 |\n| --- | --- | ---: | --- |\n${rows.join('\n')}\n`, { mode: 0o600 });
  return { archive: result.archive, sourceFiles: result.sourceFiles, uniqueModels: result.uniqueModels, bytes: result.bytes };
}

export function cliArguments(args, job) {
  const forbidden = ['--workspace', '--output', '-o', '--output-dir', '--project', '--save-json', '--api-key', '--overwrite', '--verbose', '-v'];
  if (!args.length || ['auth', 'api', 'delete'].includes(args[0]) || args.includes('delete')) throw new Error('Use the Meshy CLI directly for authentication and non-production operations');
  if (args.some(arg => forbidden.some(flag => arg === flag || arg.startsWith(`${flag}=`)) || /^-o./.test(arg)))
    throw new Error('Archive runner owns output/workspace/project paths; use existing secure CLI authentication');
  // The selective downloader treats --output as a single file, even without an extension.
  const outputFlag = args[0] === 'download' ? '--output-dir' : '--output';
  return [...args, '--workspace', job, outputFlag, path.join(job, 'downloads'), '--output-schema', 'v1', '--format', 'json', '--no-update-check'];
}

export async function runMeshy({ archive = defaultArchive, args, label, asset, variant, stage, runner = ['npm', 'exec', '--yes', '--package=meshy-cli@0.4.0', '--', 'meshy'] }) {
  const names = identity({ asset, variant, stage }, true);
  archive = await prepare(archive);
  const job = path.join(archive, 'jobs', `${names.asset}--${names.variant}--${names.stage}--${new Date().toISOString().replaceAll(':', '-')}--${randomUUID().slice(0, 8)}`);
  await fs.mkdir(job, { mode: 0o700 });
  const command = cliArguments(args, job);
  const child = spawn(runner[0], [...runner.slice(1), ...command], { cwd: job, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.on('data', chunk => { stderr += chunk; });
  const { code, signal } = await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code, signal) => resolve({ code: code ?? (signal ? 128 + (os.constants.signals[signal] || 0) : 1), signal }));
  });
  let receipt;
  try { receipt = sanitize(JSON.parse(stdout)); }
  catch { receipt = { output: sanitize(stdout) }; }
  await saveJson(path.join(job, 'receipt.json'), { schemaVersion, ...names, exitCode: code, terminationSignal: signal, receipt, stderr: sanitize(stderr) });
  let found = false;
  for await (const filename of files(job)) if (filename.endsWith('.glb')) found = true;
  if (found) {
    await importSources({ archive, sources: [job], ...names, label: label || `${names.asset} / ${names.variant} / ${names.stage}` });
    await writeCatalog(archive);
  }
  return { archive, job, ...names, exitCode: code, terminationSignal: signal, archivedModels: found, modelVerification: found ? 'passed' : 'pending', receipt };
}

async function main() {
  const argv = process.argv.slice(2);
  const command = argv.shift();
  const options = { archive: process.env.RTS_MESHY_ARCHIVE || defaultArchive, sources: [] };
  let forwarded = [];
  while (argv.length) {
    const key = argv.shift();
    if (key === '--') { forwarded = argv; break; }
    if (!['--archive', '--source', '--label', '--expected-sha256', '--asset', '--variant', '--stage'].includes(key) || !argv.length) throw new Error(`Unknown or incomplete option: ${key}`);
    const value = argv.shift();
    if (key === '--source') options.sources.push(value);
    else options[{ '--archive': 'archive', '--label': 'label', '--expected-sha256': 'expectedSha256', '--asset': 'asset', '--variant': 'variant', '--stage': 'stage' }[key]] = value;
  }
  let result;
  if (command === 'import') {
    if (!options.sources.length) throw new Error('Import requires --source FILE_OR_DIRECTORY');
    await importSources(options);
    result = await writeCatalog(options.archive);
  } else if (command === 'verify') {
    const { records, ...summary } = await verifyArchive(options.archive);
    result = summary;
  } else if (command === 'index') {
    result = await writeCatalog(options.archive);
  } else if (command === 'run') {
    result = await runMeshy({ ...options, args: forwarded });
    process.exitCode = result.exitCode || 0;
  } else throw new Error('Usage: meshy-source-archive.mjs import --source PATH | verify | index | run --asset NAME --variant NAME --stage NAME -- MESHY_ARGUMENTS [--archive PATH before --]');
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => {
  process.stderr.write(`${sanitize(error.message)}\n`);
  process.exitCode = 1;
});
