import assert from 'node:assert/strict';
import test from 'node:test';
import { replayTinySearch } from './pve-tiny-search-case.mjs';

const authored = { matchModeId: 'authored', matchModeVersion: 1 };
for (const seeds of [[20260925, 0], [0, 20260925]]) {
  test(`Tiny canonical authored elimination, configured Skirmish seeds ${seeds}: paid fogged match and reset exactly replay`, async () => {
    const first = await replayTinySearch(seeds, authored);
    const second = await replayTinySearch(seeds, authored, first.initial);
    assert.deepEqual(first, second, 'every order, notice, native checkpoint and reset repeats');
    console.log(JSON.stringify({ seeds, ...first.result.terminal, metrics: first.result.metrics,
      nativeIdentity: 'authored@1', policyIdentity: 'skirmish@1' }));
  });
}
