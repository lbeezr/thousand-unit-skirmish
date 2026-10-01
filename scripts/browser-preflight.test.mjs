import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp, mkdir, readdir, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {test} from 'node:test';
import {diagnoseBrowserLog, preflightBrowser, runBrowserPreflight} from './browser-preflight.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const codes = result => result.issues.map(issue => issue.code);

test('the observed cloud log retains both sandbox and storage blockers without leaking stderr', () => {
  const result = diagnoseBrowserLog('Chrome startup timeout: secret-token\n'
    + 'chrome_crashpad_handler: --database is required\n'
    + 'The SUID sandbox helper binary was found, but is not configured correctly.');
  assert.deepEqual(codes(result), ['sandbox-unavailable', 'storage-unavailable']);
  assert.equal(result.status, 'unsupported');
  assert.equal(result.screenshots, 0);
  assert.equal(result.browser, null);
  assert.doesNotMatch(JSON.stringify(result), /secret-token/);
});

test('missing browser, unknown failure, and unqualified timeout remain distinct unsupported reports', () => {
  for (const [log, code] of [['Chrome unavailable; set CHROME_PATH', 'browser-missing'],
    ['Chrome startup timeout: no endpoint', 'startup-timeout'], ['private/path unknown error', 'startup-failed'],
    ['', 'startup-failed']]) {
    const result = diagnoseBrowserLog(log);
    assert.deepEqual(codes(result), [code]);
    assert.equal(result.status, 'unsupported');
    assert.doesNotMatch(JSON.stringify(result), /private\/path/);
  }
});

test('ready requires a CDP browser version and successful cleanup; claims only startup', async () => {
  let disposed = 0;
  const result = await preflightBrowser({openBrowser: async () => ({
    version: {product: 'Chrome/151.0.0.0', protocolVersion: '1.3'},
    dispose: async () => { disposed++; },
  })});
  assert.equal(disposed, 1);
  assert.deepEqual(result, {schemaVersion: 1, scope: 'browser-startup', status: 'ready',
    browser: {product: 'Chrome/151.0.0.0', protocolVersion: '1.3'}, screenshots: 0, issues: []});
});

test('invalid version still disposes the acquired browser and cannot pass', async () => {
  let disposed = false;
  const result = await preflightBrowser({openBrowser: async () => ({version: {},
    dispose: async () => { disposed = true; }})});
  assert.equal(disposed, true);
  assert.equal(result.status, 'unsupported');
  assert.deepEqual(codes(result), ['startup-failed']);
});

test('cleanup failure overrides otherwise successful startup', async () => {
  const result = await preflightBrowser({openBrowser: async () => ({version: {product: 'Chrome/test'},
    dispose: async () => { throw new Error('private cleanup path'); }})});
  assert.equal(result.status, 'unsupported');
  assert.deepEqual(codes(result), ['cleanup-failed']);
  assert.doesNotMatch(JSON.stringify(result), /private cleanup path/);
});

test('storage failures and executable spawn failures are attributed to different prerequisites', async () => {
  for (const [syscall, code] of [['mkdtemp', 'storage-unavailable'], ['spawn /private/browser', 'browser-executable']]) {
    const result = await preflightBrowser({openBrowser: async () => {
      throw Object.assign(new Error('private detail'), {code: 'EACCES', syscall});
    }});
    assert.deepEqual(codes(result), [code]);
    assert.equal(result.status, 'unsupported');
  }
});

test('invalid CLI options do not launch or read a log', async () => {
  for (const args of [[], ['--help'], ['--diagnose='], ['--launch', '--unknown']]) {
    assert.equal(await runBrowserPreflight(args, {
      openBrowser: () => assert.fail('unexpected launch'), readLog: () => assert.fail('unexpected read'),
      usage: text => assert.match(text, /Usage:/), output: () => assert.fail('unexpected report'),
    }), 2);
  }
});

test('log mode never launches, emits parseable JSON, and never claims readiness', async () => {
  let result;
  const exit = await runBrowserPreflight(['--diagnose=local.log'], {
    readLog: async file => { assert.equal(file, 'local.log'); return 'No usable sandbox!'; },
    openBrowser: () => assert.fail('unexpected launch'), output: text => { result = JSON.parse(text); },
  });
  assert.equal(exit, 1);
  assert.equal(result.status, 'unsupported');
  assert.deepEqual(codes(result), ['sandbox-unavailable']);
});

test('explicit launch returns 0 only on successful startup and cleanup', async () => {
  for (const succeeds of [true, false]) {
    let result;
    const exit = await runBrowserPreflight(['--launch'], {
      openBrowser: async () => {
        if (!succeeds) throw new Error('Chrome unavailable; set CHROME_PATH');
        return {version: {product: 'Chrome/test'}, dispose: async () => {}};
      }, output: text => { result = JSON.parse(text); },
      readLog: () => assert.fail('unexpected read'),
    });
    assert.equal(exit, succeeds ? 0 : 1);
    assert.equal(result.status, succeeds ? 'ready' : 'unsupported');
  }
});

test('unreadable log is reported without exposing its path or launching', async () => {
  let result;
  const exit = await runBrowserPreflight(['--diagnose=private.log'], {
    readLog: async () => { throw new Error('private.log denied'); },
    openBrowser: () => assert.fail('unexpected launch'), output: text => { result = JSON.parse(text); },
  });
  assert.equal(exit, 1);
  assert.deepEqual(codes(result), ['log-unreadable']);
  assert.doesNotMatch(JSON.stringify(result), /private\.log/);
});

test('real CLI catches a non-executable browser path and removes its temporary profile',
  {skip: process.platform === 'win32'}, async () => {
    const temporary = await mkdtemp(path.join(os.tmpdir(), 'rts-preflight-test-'));
    try {
      const profiles = path.join(temporary, 'profiles');
      const executable = path.join(temporary, 'not-an-executable');
      await mkdir(profiles); await mkdir(executable);
      const run = spawnSync(process.execPath, ['scripts/browser-preflight.mjs', '--launch'], {
        cwd: root, encoding: 'utf8', timeout: 5000,
        env: {...process.env, CHROME_PATH: executable, TMPDIR: profiles},
      });
      assert.ifError(run.error);
      assert.equal(run.status, 1, run.stderr);
      assert.deepEqual(codes(JSON.parse(run.stdout)), ['browser-executable']);
      assert.deepEqual(await readdir(profiles), [], 'failed launch profile was removed');
      assert.doesNotMatch(run.stderr, /Unhandled 'error'/);
    } finally { await rm(temporary, {recursive: true, force: true}); }
  });
