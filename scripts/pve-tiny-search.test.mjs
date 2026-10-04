import assert from 'node:assert/strict';
import test from 'node:test';
import { replayTinySearch } from './pve-tiny-search-case.mjs';

for (const matchModeId of ['authored', 'skirmish']) for (const seeds of [[20260925, 0], [0, 20260925]]) {
  const nativeIdentity = { matchModeId, matchModeVersion: 1 };
  test(`Tiny native ${matchModeId}, configured Skirmish seeds ${seeds}: paid fogged match and reset exactly replay`, async () => {
    const first = await replayTinySearch(seeds, nativeIdentity);
    const second = await replayTinySearch(seeds, nativeIdentity, first.initial);
    assert.deepEqual(first, second, 'every order, notice, native checkpoint and reset repeats');
    console.log(JSON.stringify({ seeds, ...first.result.terminal, metrics: first.result.metrics,
      nativeIdentity: `${matchModeId}@1`, policyIdentity: 'skirmish@1' }));
  });
}
