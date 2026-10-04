import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { startQaBrowser, stopChild } from './temporary-resources.mjs';

const sourceRoot = path.resolve(import.meta.dirname, '..');
const retained = 'rts-release-user-retained';
async function fixture(action) {
  const base = await mkdtemp(path.join(os.tmpdir(), 'rts-temp-cleanup-test-'));
  const root = path.join(base, 'repo'), scratch = path.join(base, 'scratch');
  try {
    await mkdir(path.join(root, 'scripts'), { recursive: true });
    await mkdir(path.join(root, 'src'));
    await symlink(path.join(sourceRoot, 'node_modules'), path.join(root, 'node_modules'), 'dir');
    await mkdir(path.join(scratch, retained), { recursive: true });
    await writeFile(path.join(scratch, retained, 'screenshot.png'), 'unrelated screenshot bytes');
    for (const script of ['pack-railway-release.mjs', 'release/pack-railway-release.mjs', 'railway-release-scenario.mjs', 'check-client-imports.mjs', 'check-served-build-identity.mjs', 'check-runtime-imports.mjs', 'module-imports.mjs', 'temporary-resources.mjs']) {
      await mkdir(path.dirname(path.join(root, 'scripts', script)), { recursive: true });
      await copyFile(path.join(sourceRoot, 'scripts', script), path.join(root, 'scripts', script));
    }
    await mkdir(path.join(root, 'src', 'server'));
    for (const file of ['client-asset-paths.mjs', 'build-identity.mjs']) {
      await copyFile(path.join(sourceRoot, 'src', 'server', file), path.join(root, 'src', 'server', file));
    }
    const runtime = ['room-supervisor.mjs', 'server.mjs', 'origin-policy.mjs', 'simulation-scheduler.mjs'];
    for (const file of runtime) await writeFile(path.join(root, file), 'process.exit(0);\n');
    await writeFile(path.join(root, 'src', 'kept.mjs'), 'export const kept = true;\n');
    await writeFile(path.join(root, 'Dockerfile'), 'FROM scratch\nCOPY ' + runtime.join(' ') + ' /app/\nCOPY src /app/src/\n');
    await writeFile(path.join(root, '.dockerignore'), '*\n' + runtime.map(file => '!' + file).join('\n') + '\n');
    await writeFile(path.join(root, 'package.json'), '{"type":"module"}\n');
    await writeFile(path.join(root, 'package-lock.json'), '{}\n');
    const git = (...args) => {
      const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
    };
    git('init', '-q'); git('add', '.');
    git('-c', 'user.name=Temporary fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'fixture');
    const run = (script, args = [], env = {}) => spawnSync(process.execPath, ['scripts/' + script, ...args], {
      cwd: root, encoding: 'utf8', timeout: 10000, env: { ...process.env, TMPDIR: scratch, ...env },
    });
    await action({ root, scratch, run });
    assert.equal(await readFile(path.join(scratch, retained, 'screenshot.png'), 'utf8'), 'unrelated screenshot bytes');
  } finally { await rm(base, { recursive: true, force: true }); }
}
const onlyRetained = async scratch => assert.deepEqual(await readdir(scratch), [retained]);

test('successful pack stays available until its caller removes it; unrelated output survives', () => fixture(async ({ scratch, run }) => {
  const result = run('pack-railway-release.mjs');
  assert.ifError(result.error); assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(path.dirname(output.directory), scratch);
  assert.equal(JSON.parse(await readFile(path.join(output.directory, 'release-manifest.json'))).sourceDirty, false);
  assert.equal(await readFile(path.join(output.directory, 'src/kept.mjs'), 'utf8'), 'export const kept = true;\n');
  await rm(output.directory, { recursive: true });
  await onlyRetained(scratch);
}));

test('packer removes its partial snapshot on a recursive-copy failure', () => fixture(async ({ root, scratch, run }) => {
  await symlink(path.join(scratch, retained, 'screenshot.png'), path.join(root, 'src', 'zz-link.mjs'));
  const result = run('pack-railway-release.mjs', ['--allow-dirty']);
  assert.ifError(result.error); assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Release source cannot be a symlink/);
  await onlyRetained(scratch);
}));

test('packer removes a fully copied snapshot when the final clean-checkout check fails', () => fixture(async ({ root, scratch, run }) => {
  const bin = path.join(root, 'fake-bin'); await mkdir(bin);
  const counter = path.join(root, 'status-count');
  await writeFile(path.join(bin, 'git'), '#!' + process.execPath + '\n'
    + 'import fs from "node:fs";\nconst counter = ' + JSON.stringify(counter) + ';\n'
    + 'if (process.argv[2] === "rev-parse") console.log("0".repeat(40));\n'
    + 'else { let n = fs.existsSync(counter) ? Number(fs.readFileSync(counter)) : 0; fs.writeFileSync(counter, String(n + 1)); if(n) console.log(" M server.mjs"); }\n', { mode: 0o755 });
  const result = run('pack-railway-release.mjs', [], { PATH: bin + path.delimiter + process.env.PATH });
  assert.ifError(result.error); assert.notEqual(result.status, 0);
  assert.match(result.stderr, /changed during packaging/);
  await onlyRetained(scratch);
}));

test('invalid Docker input fails before allocating a snapshot', () => fixture(async ({ root, scratch, run }) => {
  await writeFile(path.join(root, 'Dockerfile'), 'FROM scratch\nADD src /app/src/\n');
  const result = run('pack-railway-release.mjs', ['--allow-dirty']);
  assert.ifError(result.error); assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Use COPY instead of ADD/);
  await onlyRetained(scratch);
}));

for (const stage of ['symlink', 'docker-assertion', 'after-volume']) {
  test('release scenario cleans up when setup fails at ' + stage, () => fixture(async ({ root, scratch, run }) => {
    const mock = 'import {mkdtemp, mkdir, writeFile} from "node:fs/promises";\n'
      + 'import os from "node:os"; import path from "node:path";\n'
      + 'const directory = await mkdtemp(path.join(os.tmpdir(), "rts-release-"));\n'
      + (stage === 'symlink' ? 'await mkdir(path.join(directory, "node_modules"));\n' : '')
      + 'await writeFile(path.join(directory, "Dockerfile"), ' + JSON.stringify(stage === 'docker-assertion' ? 'FROM scratch\n' : 'COPY origin-policy.mjs /app/\n') + ');\n'
      + 'await writeFile(path.join(directory, "room-supervisor.mjs"), "process.exit(0);\\n");\n'
      + 'console.log(JSON.stringify({directory}));\n';
    await writeFile(path.join(root, 'scripts/release/pack-railway-release.mjs'), mock);
    const result = run('railway-release-scenario.mjs');
    assert.ifError(result.error); assert.notEqual(result.status, 0);
    assert.match(result.stderr, stage === 'symlink' ? /EEXIST/ : /AssertionError/);
    await onlyRetained(scratch);
  }));
}

test('real release scenario removes its package and volume after the caller finishes', () => fixture(async ({ scratch }) => {
  const result = spawnSync(process.execPath, ['scripts/railway-release-scenario.mjs'], {
    cwd: sourceRoot, encoding: 'utf8', timeout: 30000, env: { ...process.env, TMPDIR: scratch },
  });
  assert.ifError(result.error); assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Railway release scenario passed/);
  await onlyRetained(scratch);
}));

async function fakeBrowser(root, scratch, ignoreSignal = false) {
  const script = path.join(root, 'browser.mjs'), proof = path.join(root, 'shutdown-proof');
  await writeFile(script, 'import fs from "node:fs"; import path from "node:path";\n'
    + 'const profile = process.argv.find(arg => arg.startsWith("--user-data-dir=")).split("=")[1];\n'
    + 'process.on("SIGTERM", () => {' + (ignoreSignal ? ''
      : 'setTimeout(() => { fs.writeFileSync(process.argv[2], fs.existsSync(profile) ? "profile-present" : "profile-lost"); process.exit(0); }, 30);') + '});\n'
    + 'fs.writeFileSync(path.join(profile, "ready"), "ready"); setInterval(() => {}, 1000);\n');
  const browser = await startQaBrowser('qa-profile-', process.execPath, [script, proof], { temporaryRoot: scratch });
  try {
    const deadline = Date.now() + 3000;
    while (true) {
      try { await readFile(path.join(browser.profile, 'ready')); break; }
      catch (error) { if (error.code !== 'ENOENT' || Date.now() > deadline) throw error; }
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    return { ...browser, proof };
  } catch (error) { await browser.dispose(); throw error; }
}

test('browser waits for close before removing its profile and leaves screenshots alone', () => fixture(async ({ root, scratch }) => {
  const browser = await fakeBrowser(root, scratch);
  try {
    await browser.dispose(); await browser.dispose();
    assert.equal(await readFile(browser.proof, 'utf8'), 'profile-present');
    await onlyRetained(scratch);
  } finally { await browser.dispose(); }
}));

test('browser profile is removed even when capture work throws early', () => fixture(async ({ root, scratch }) => {
  const browser = await fakeBrowser(root, scratch);
  await assert.rejects(async () => {
    try { throw new Error('early capture failure'); }
    finally { await browser.dispose(); }
  }, /early capture failure/);
  await onlyRetained(scratch);
}));

test('failed browser spawn cleans its allocated profile', () => fixture(async ({ root, scratch }) => {
  await assert.rejects(startQaBrowser('qa-profile-', path.join(root, 'missing-browser'), [], { temporaryRoot: scratch }),
    { code: 'ENOENT' });
  await onlyRetained(scratch);
}));

test('a child ignoring termination is killed and closed before disposal', () => fixture(async ({ root, scratch }) => {
  const browser = await fakeBrowser(root, scratch, true);
  try {
    await stopChild(browser.chrome, { graceMs: 30 });
    assert.equal(browser.chrome.signalCode, 'SIGKILL');
    assert.equal(await readFile(path.join(browser.profile, 'ready'), 'utf8'), 'ready');
    await browser.dispose(); await onlyRetained(scratch);
  } finally { await browser.dispose(); }
}));

test('an exited child with inherited pipes waits for close without another signal', () => fixture(async ({ root, scratch }) => {
  const profile = await mkdtemp(path.join(scratch, 'pipe-profile-'));
  const script = path.join(root, 'pipe-parent.mjs'), proof = path.join(root, 'pipe-proof');
  const descendant = 'const fs = require("node:fs"); setTimeout(() => { fs.writeFileSync('
    + JSON.stringify(proof) + ', fs.existsSync(' + JSON.stringify(profile) + ')?"profile-present":"profile-lost"); }, 600);';
  await writeFile(script, 'import {spawn} from "node:child_process";\n'
    + 'spawn(process.execPath, ["-e", ' + JSON.stringify(descendant) + '], {stdio:"inherit"}).unref(); process.exit(0);\n');
  const child = spawn(process.execPath, [script], { stdio: ['ignore', 'pipe', 'pipe'] });
  let closed = false; child.once('close', () => { closed = true; });
  try {
    await once(child, 'exit'); assert.equal(closed, false, 'descendant still holds the pipes');
    child.kill = () => assert.fail('must not signal the exited process');
    await stopChild(child, { graceMs: 30 });
    assert.equal(closed, true, 'close is the disposal boundary');
    assert.equal(await readFile(proof, 'utf8'), 'profile-present');
    await stopChild(child); // Already closed is an immediate, safe repeated call.
  } finally {
    if (!closed) await once(child, 'close');
    await rm(profile, { recursive: true, force: true });
  }
  await onlyRetained(scratch);
}));

test('all ten main QA entrypoints clean up after browser startup failure', { skip: process.platform !== 'linux' }, () => fixture(async ({ scratch }) => {
  for (const name of ['vegetation', 'directional-resource', 'regional-mist', 'quiet-meadow', 'organic-landscapes',
    'forest-habitat', 'studio-landscape', 'settlement-ground', 'terrain-rotation', 'terrain-variety']) {
    const result = spawnSync(process.execPath, ['scripts/qa-' + name + '-browser.mjs'], {
      cwd: sourceRoot, encoding: 'utf8', timeout: 5000, env: { ...process.env, TMPDIR: scratch },
    });
    assert.ifError(result.error); assert.notEqual(result.status, 0);
    assert.match(result.stderr, /ENOENT/); assert.doesNotMatch(result.stderr, /Unhandled 'error'/);
    await onlyRetained(scratch);
  }
}));

test('vegetation validates options before acquiring any browser profile', () => fixture(async ({ scratch }) => {
  const result = spawnSync(process.execPath, ['scripts/qa-vegetation-browser.mjs'], {
    cwd: sourceRoot, encoding: 'utf8', timeout: 5000,
    env: { ...process.env, TMPDIR: scratch, RTS_VEGETATION_REGION: 'invalid-fixture-region' },
  });
  assert.ifError(result.error); assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unknown vegetation capture region/);
  await onlyRetained(scratch);
}));
