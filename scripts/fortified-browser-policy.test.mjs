import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { backgroundPolicyArguments, createFortifiedBrowser } from './fortified-browser-fixture.mjs';

test('actual launcher omits throttling bypasses for lifecycle while legacy captures retain all three', async () => {
  const code = (await readFile(new URL('./fortified-browser-fixture.mjs', import.meta.url), 'utf8'))
    .replace(/^import .+;\n/gm, '').replace(/export /g, '');
  for (const backgroundPolicy of [undefined, 'default', 'unthrottled']) {
    let args, disposals = 0;
    const context = vm.createContext({ assert, os, path, process: { env: {}, platform: 'linux' },
      stat: async () => ({}), mkdtemp: async () => '/tmp/cpu-only-browser-profile', rm: async () => { disposals++; },
      spawn: (_, actualArgs) => { args = actualArgs; return {
        pid: null, exitCode: 1, signalCode: null, on() {}, stderr: { on() {} },
      }; },
    });
    vm.runInContext(code, context);
    // Only the process/filesystem boundaries are injected; no browser is spawned.
    await assert.rejects(context.createFortifiedBrowser(backgroundPolicy === undefined ? undefined : { backgroundPolicy }), /Chrome exited/);
    assert.equal(disposals, 1);
    assert.deepEqual(Array.from(args).filter(arg => /^--disable-(background|renderer-background)/.test(arg)),
      backgroundPolicy === 'default' ? [] : [
        '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding',
      ]);
    assert.ok(args.includes('--remote-debugging-address=127.0.0.1'));
    assert.ok(args.includes('--user-data-dir=/tmp/cpu-only-browser-profile'));
    assert.ok(!args.includes('--no-sandbox'));
  }
});
test('unknown policy is rejected before executable discovery, profile creation or launch', async () => {
  for (const backgroundPolicy of ['bypass', null, '--no-sandbox']) {
    assert.throws(() => backgroundPolicyArguments(backgroundPolicy));
    await assert.rejects(createFortifiedBrowser({ backgroundPolicy }), /known browser background policy/);
  }
});
