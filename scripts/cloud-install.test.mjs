import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = fileURLToPath(new URL('..', import.meta.url));
const fields = ['npm_config_cache', 'TMPDIR', 'XDG_CONFIG_HOME', 'XDG_CACHE_HOME'];

async function fixture(run) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'rts-cloud-install-test-'));
  try {
    const checkout = path.join(directory, 'checkout with spaces');
    const bin = path.join(directory, 'bin');
    const log = path.join(directory, 'npm-calls.jsonl');
    const writer = path.join(directory, 'npm-writer.mjs');
    await mkdir(path.join(checkout, 'scripts'), { recursive: true });
    await mkdir(bin);
    await copyFile(path.join(root, 'scripts/cloud-install.sh'), path.join(checkout, 'scripts/cloud-install.sh'));
    const locked = '{"lockfileVersion":3,"packages":{}}\n';
    await writeFile(path.join(checkout, 'package-lock.json'), locked);
    await writeFile(path.join(bin, 'node'), '#!/bin/sh\nexit "${STUB_NODE_STATUS:-0}"\n');
    await writeFile(path.join(bin, 'npm'), '#!/bin/sh\nexec "$STUB_REAL_NODE" "$STUB_NPM_WRITER" "$@"\n');
    await chmod(path.join(bin, 'node'), 0o755);
    await chmod(path.join(bin, 'npm'), 0o755);
    await writeFile(writer, `import {appendFileSync} from 'node:fs';
appendFileSync(process.env.STUB_NPM_LOG, JSON.stringify({args:process.argv.slice(2),
cwd:process.cwd(), fields:Object.fromEntries(${JSON.stringify(fields)}.map(key=>[key,process.env[key]]))})+'\\n');
process.exit(Number(process.env.STUB_NPM_STATUS ?? 0));\n`);
    const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`,
      STUB_REAL_NODE: process.execPath, STUB_NPM_WRITER: writer, STUB_NPM_LOG: log };
    for (const field of fields) env[field] = path.join(directory, `${field} with spaces`);
    const execute = (overrides = {}, args = []) => spawnSync('bash',
      [path.join(checkout, 'scripts/cloud-install.sh'), ...args],
      { cwd: directory, env: { ...env, ...overrides }, encoding: 'utf8', timeout: 5000 });
    const calls = async () => {
      try { return (await readFile(log, 'utf8')).trim().split('\n').map(JSON.parse); }
      catch (error) { if (error.code === 'ENOENT') return []; throw error; }
    };
    await run({ directory, checkout, bin, env, execute, calls, locked });
  } finally { await rm(directory, { recursive: true, force: true }); }
}

test('install derives root from its location, preserves caller paths and the lock, and repeats safely', async () => {
  await fixture(async ({ checkout, env, execute, calls, locked }) => {
    for (let iteration = 0; iteration < 2; iteration++) {
      const result = execute();
      assert.ifError(result.error);
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /exports apply only to this process/);
    }
    const records = await calls();
    assert.equal(records.length, 2, 'one npm invocation per install; no other npm work');
    for (const record of records) {
      assert.deepEqual(record.args, ['ci', '--include=dev', '--no-audit', '--no-fund']);
      assert.equal(record.cwd, checkout);
      for (const field of fields) {
        assert.equal(record.fields[field], env[field]);
        assert.equal((await stat(env[field])).isDirectory(), true);
      }
    }
    assert.equal(await readFile(path.join(checkout, 'package-lock.json'), 'utf8'), locked);
    assert.deepEqual(await readFile(path.join(checkout, 'scripts/cloud-install.sh')),
      await readFile(path.join(root, 'scripts/cloud-install.sh')));
  });
});

test('unset and empty caller values use documented fallbacks without writing shared directories', async () => {
  await fixture(async ({ directory, bin, execute, calls }) => {
    const log = path.join(directory, 'mkdir-arguments.txt');
    await writeFile(path.join(bin, 'mkdir'), '#!/bin/sh\nprintf "%s\\n" "$@" > "$STUB_MKDIR_LOG"\n');
    await chmod(path.join(bin, 'mkdir'), 0o755);
    const expected = {
      npm_config_cache: '/tmp/thousand-unit-skirmish-cloud/npm-cache',
      TMPDIR: '/tmp/thousand-unit-skirmish-cloud/tmp',
      XDG_CONFIG_HOME: '/tmp/thousand-unit-skirmish-cloud/xdg-config',
      XDG_CACHE_HOME: '/tmp/thousand-unit-skirmish-cloud/xdg-cache',
    };
    for (const value of [undefined, '']) {
      const result = execute({ ...Object.fromEntries(fields.map(field => [field, value])), STUB_MKDIR_LOG: log });
      assert.ifError(result.error);
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual((await calls()).at(-1).fields, expected);
      assert.deepEqual((await readFile(log, 'utf8')).trim().split('\n'), ['-p', '--', ...Object.values(expected)]);
    }
  });
});

test('unsupported Node and invalid arguments stop before npm or directory creation', async () => {
  await fixture(async ({ env, execute, calls }) => {
    for (const [overrides, args, status] of [[{ STUB_NODE_STATUS: '1' }, [], 1], [{}, ['--browser'], 2]]) {
      const result = execute(overrides, args);
      assert.ifError(result.error);
      assert.equal(result.status, status, result.stderr);
    }
    assert.deepEqual(await calls(), []);
    for (const field of fields) await assert.rejects(stat(env[field]), { code: 'ENOENT' });
  });
});

test('failed directory preparation does not install, and npm failures propagate', async () => {
  await fixture(async ({ directory, execute, calls }) => {
    const occupied = path.join(directory, 'occupied');
    await writeFile(occupied, 'preserve this file');
    const preparation = execute({ TMPDIR: occupied });
    assert.ifError(preparation.error);
    assert.notEqual(preparation.status, 0);
    assert.deepEqual(await calls(), []);
    assert.equal(await readFile(occupied, 'utf8'), 'preserve this file');
    const installation = execute({ STUB_NPM_STATUS: '7' });
    assert.ifError(installation.error);
    assert.equal(installation.status, 7);
    assert.doesNotMatch(installation.stdout, /Locked dependencies installed/);
    assert.equal((await calls()).length, 1);
  });
});

test('skill frontmatter, relative guide link and installer version guard are usable', async () => {
  const directory = path.join(root, '.agents/skills/thousand-unit-skirmish-start');
  const skill = await readFile(path.join(directory, 'SKILL.md'), 'utf8');
  const frontmatter = skill.match(/^---\nname: ([a-z0-9-]+)\ndescription: ([^\n]+)\n---\n/);
  assert.ok(frontmatter, 'skill requires name and description frontmatter');
  assert.equal(frontmatter[1], path.basename(directory));
  assert.ok(frontmatter[2].length > 20 && frontmatter[2].length < 1024);
  assert.equal(await readFile(path.resolve(directory, '../../../docs/cloud-environment.md'), 'utf8'),
    await readFile(path.join(root, 'docs/cloud-environment.md'), 'utf8'));
  const script = await readFile(path.join(root, 'scripts/cloud-install.sh'), 'utf8');
  const guard = script.match(/^node -e '([^']+)'$/m)?.[1];
  assert.ok(guard);
  for (const [version, status] of [['22.12.0', 1], ['24.19.0', 0], ['25.0.0', 0]]) {
    const result = spawnSync(process.execPath, ['-e',
      `Object.defineProperty(process.versions,'node',{value:${JSON.stringify(version)}});${guard}`],
    { encoding: 'utf8', timeout: 5000 });
    assert.ifError(result.error);
    assert.equal(result.status, status);
    if (status) assert.match(result.stderr, /Node 24\+ required/);
  }
  // Installation must stay independent of optional browser/runtime processes.
  assert.doesNotMatch(script, /renderer-capability|chromium|npm start|no-sandbox|sudo/);
});
