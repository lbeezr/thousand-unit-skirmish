import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { captureDepotSources, assertDepotSourcesUnchanged } from './depot-source-snapshot.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'depot-source-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'src'));
  await mkdir(path.join(root, 'scripts'));
  await writeFile(path.join(root, 'server.mjs'), 'local server input');
  await writeFile(path.join(root, 'src', 'rules.mjs'), 'already modified local rules');
  return root;
}

test('new in-repo JSON output does not invalidate consumed source provenance', async t => {
  const root = await fixture(t), outputDirectory = path.join(root, 'scripts', 'study-output');
  const options = { outputDirectory };
  const snapshot = await captureDepotSources(root, options);
  await mkdir(outputDirectory);
  await writeFile(path.join(outputDirectory, 'case.json'), '{"result":"completed"}');
  await writeFile(path.join(outputDirectory, 'report.json'), '{"cases":1}');
  await assertDepotSourcesUnchanged(root, snapshot, options);
  assert.equal(snapshot.sourceFiles.length, 2);
  assert.ok(!snapshot.sourceFiles.some(file => file.path.includes('study-output')));
});

test('a further edit to an already dirty input and new source dependencies are detected', async t => {
  const root = await fixture(t);
  const snapshot = await captureDepotSources(root);
  await writeFile(path.join(root, 'src', 'rules.mjs'), 'changed again without changing git status');
  await assert.rejects(assertDepotSourcesUnchanged(root, snapshot), /freeze consumed source files.*rules.mjs/);
  await writeFile(path.join(root, 'src', 'rules.mjs'), 'already modified local rules');
  await assertDepotSourcesUnchanged(root, snapshot);
  await writeFile(path.join(root, 'scripts', 'new-harness.mjs'), 'new local dependency');
  await assert.rejects(assertDepotSourcesUnchanged(root, snapshot), /freeze consumed source files.*new-harness.mjs/);
});
