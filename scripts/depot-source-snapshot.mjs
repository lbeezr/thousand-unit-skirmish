import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

// Hash the actual local runtime/harness/map inputs, including dirty and untracked
// files. Generated measurement output is not an input, even inside this repo.
export async function captureDepotSources(root, { outputDirectory = null } = {}) {
  const excluded = outputDirectory && path.resolve(outputDirectory);
  const files = [];
  async function collect(directory, recursive) {
    if (path.resolve(directory) === excluded) return;
    let entries;
    try { entries = await readdir(directory, { withFileTypes: true }); }
    catch (error) { if (error.code === 'ENOENT') return; throw error; }
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory() && recursive) await collect(fullPath, true);
      else if (entry.isFile() && /\.(?:m?js|json)$/.test(entry.name)) files.push(fullPath);
    }
  }
  await collect(root, false);
  for (const directory of ['src', 'scripts', 'maps']) await collect(path.join(root, directory), true);
  const sourceFiles = await Promise.all(files.sort().map(async file => ({
    path: path.relative(root, file), sha256: createHash('sha256').update(await readFile(file)).digest('hex'),
  })));
  return { sourceFiles, sourceContentSha256: createHash('sha256').update(JSON.stringify(sourceFiles)).digest('hex') };
}

export async function assertDepotSourcesUnchanged(root, snapshot, options) {
  const current = await captureDepotSources(root, options);
  const expected = new Map(snapshot.sourceFiles.map(file => [file.path, file.sha256]));
  const actual = new Map(current.sourceFiles.map(file => [file.path, file.sha256]));
  const changed = [...new Set([...expected.keys(), ...actual.keys()])]
    .filter(file => expected.get(file) !== actual.get(file));
  assert.equal(current.sourceContentSha256, snapshot.sourceContentSha256,
    `freeze consumed source files during measurement: ${changed.slice(0, 10).join(', ')}`);
}
