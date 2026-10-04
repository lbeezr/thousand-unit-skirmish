import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadBuildIdentity, resolveBuildIdentity } from '../src/server/build-identity.mjs';
import { checkServedBuildIdentity, compareServedBuildIdentity, validateExpectedIdentity } from './check-served-build-identity.mjs';

const sourceRevision = 'a'.repeat(40);
const otherRevision = 'b'.repeat(40);
const digest = `sha256:${'c'.repeat(64)}`;
const manifest = { sourceRevision, sourceDirty: false, digest, files: ['private-source'] };
const expected = { sourceRevision, digest };
const identity = resolveBuildIdentity({ manifest });
const health = { ok: true, buildIdentity: identity };

test('packed identity matches source and declared release digest without exposing file paths', () => {
  assert.equal(compareServedBuildIdentity(health, expected).ok, true);
  assert.deepEqual(Object.keys(identity).sort(), ['digest', 'origin', 'sourceDirty', 'sourceRevision', 'status']);
  assert.equal(JSON.stringify(identity).includes('private-source'), false);
});

test('Railway commit metadata proves source only and leaves cleanliness/digest unknown', () => {
  const buildIdentity = resolveBuildIdentity({ railwayRevision: sourceRevision });
  assert.equal(buildIdentity.sourceDirty, null);
  assert.equal(buildIdentity.digest, null);
  const result = compareServedBuildIdentity({ ok: true, buildIdentity }, { sourceRevision });
  assert.equal(result.ok, true);
  assert.equal(result.scope, 'source');
  assert.equal(compareServedBuildIdentity({ ok: true, buildIdentity }, expected).ok, false);
});

for (const [name, buildIdentity, issue] of [
  ['wrong served source', { ...identity, sourceRevision: otherRevision }, 'source-mismatch'],
  ['wrong served digest', { ...identity, digest: `sha256:${'d'.repeat(64)}` }, 'digest-mismatch'],
  ['dirty packed source', { ...identity, sourceDirty: true }, 'source-dirty'],
  ['unknown packed cleanliness', { ...identity, sourceDirty: null }, 'source-cleanliness-invalid'],
  ['unknown identity', resolveBuildIdentity(), 'identity-unavailable-or-conflicting'],
  ['manifest/provider conflict', resolveBuildIdentity({ manifest, railwayRevision: otherRevision }), 'identity-unavailable-or-conflicting'],
  ['malformed manifest cannot fall back to provider', resolveBuildIdentity({ manifest: {}, railwayRevision: sourceRevision }), 'identity-unavailable-or-conflicting'],
  ['malformed provider', resolveBuildIdentity({ railwayRevision: 'not-a-sha' }), 'source-missing-or-invalid'],
]) {
  test(`${name} fails the expected-versus-served contract`, () => {
    const result = compareServedBuildIdentity({ ok: true, buildIdentity }, expected);
    assert.equal(result.ok, false);
    assert.ok(result.issues.includes(issue));
  });
}

test('fixed local manifest wins only when provider agrees; malformed data fails safely', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'rts-build-identity-'));
  try {
    assert.equal((await loadBuildIdentity(root, {})).status, 'unknown');
    await mkdir(path.join(root, 'src/server'), { recursive: true });
    await writeFile(path.join(root, 'src/server/release-identity.json'), JSON.stringify(manifest));
    assert.deepEqual(await loadBuildIdentity(root, { RAILWAY_GIT_COMMIT_SHA: sourceRevision }), identity);
    await writeFile(path.join(root, 'src/server/release-identity.json'), '{secret malformed');
    const invalid = await loadBuildIdentity(root, { RAILWAY_GIT_COMMIT_SHA: sourceRevision });
    assert.equal(invalid.status, 'invalid');
    assert.equal(JSON.stringify(invalid).includes('secret'), false);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('expected source is explicit and validated before any deployment lookup', () => {
  for (const value of [undefined, 'main', 'a'.repeat(7), 'A'.repeat(40), [sourceRevision]]) {
    assert.throws(() => validateExpectedIdentity({ sourceRevision: value }), /full lowercase/);
  }
  assert.throws(() => validateExpectedIdentity({ sourceRevision, digest: 'invalid' }), /Expected digest/);
  const missing = spawnSync(process.execPath, ['scripts/railway-smoke.mjs', '--environment', 'staging'],
    { encoding: 'utf8' });
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /Expected source must be a full/);
  assert.doesNotMatch(missing.stderr, /Railway .* lookup failed/);
});

test('authenticated health comparison forbids redirects, bounds response and hides failures', async () => {
  let calls = 0;
  const result = await checkServedBuildIdentity('http://127.0.0.1:4173', expected, {
    authorization: 'Basic fixture-only', fetchImpl: async (url, options) => {
      calls++;
      assert.equal(url.pathname, '/health');
      assert.equal(options.redirect, 'error');
      assert.equal(options.headers.authorization, 'Basic fixture-only');
      assert.ok(options.signal instanceof AbortSignal);
      return Response.json(health);
    },
  });
  assert.equal(calls, 1);
  assert.equal(result.ok, true);
  for (const response of [new Response('private secret', { status: 401 }),
    new Response('private malformed'), new Response('x'.repeat(1_000_001))]) {
    const failure = await checkServedBuildIdentity('http://127.0.0.1:4173', expected,
      { fetchImpl: async () => response });
    assert.equal(failure.ok, false);
    assert.equal(JSON.stringify(failure).includes('private'), false);
  }
  const failure = await checkServedBuildIdentity('http://127.0.0.1:4173', expected,
    { fetchImpl: async () => { throw new Error('credential private'); } });
  assert.deepEqual(failure.issues, ['health-request-or-json-failed']);
});

test('untrusted health metadata is sanitized in failure receipts', () => {
  const result = compareServedBuildIdentity({ ok: true,
    buildIdentity: { status: 'identified', origin: 'secret', sourceRevision: 'secret', digest: 'secret' } }, expected);
  assert.equal(result.ok, false);
  assert.equal(JSON.stringify(result).includes('secret'), false);
  assert.equal(compareServedBuildIdentity({ ...health, ok: false }, expected).ok, false);
});

test('release smoke exits nonzero with a machine-readable mismatch before assets or WebSockets', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'rts-identity-smoke-cli-'));
  try {
    const railway = path.join(root, 'railway');
    await writeFile(railway, `#!/usr/bin/env node
const command = process.argv[2];
console.log(JSON.stringify(command === 'domain'
  ? { domains: [{ type: 'service', syncStatus: 'ACTIVE', domain: 'fixture.invalid' }] }
  : { RTS_ACCESS_PASSWORD: 'fixture-secret' }));
`, { mode: 0o700 });
    const preload = path.join(root, 'fetch-fixture.mjs');
    await writeFile(preload, `globalThis.fetch = async (url, options) => {
const pathname = new URL(url).pathname;
if (pathname === '/ready') return Response.json({ ok: true });
if (!options.headers.authorization) return new Response('Unauthorized', { status: 401 });
if (pathname === '/health') return Response.json(${JSON.stringify(health)});
throw new Error('Identity mismatch must stop later checks');
};
`);
    const result = spawnSync(process.execPath, ['--import', preload, 'scripts/release/railway-smoke.mjs',
      '--environment', 'staging', '--project', 'fixture', '--expected-source', otherRevision],
    { encoding: 'utf8', timeout: 5000, env: { ...process.env, NODE_OPTIONS: '', PATH: `${root}${path.delimiter}${process.env.PATH}` } });
    assert.equal(result.status, 1, result.stderr);
    const receipt = JSON.parse(result.stdout);
    assert.equal(receipt.ok, false);
    assert.deepEqual(receipt.identity.issues, ['source-mismatch']);
    assert.equal(receipt.checks.length, 3);
    assert.equal(result.stdout.includes('fixture-secret'), false);
    assert.equal(result.stderr, '');
  } finally { await rm(root, { recursive: true, force: true }); }
});
