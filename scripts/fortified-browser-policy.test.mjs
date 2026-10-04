import assert from 'node:assert/strict';
import test from 'node:test';
import { backgroundPolicyArguments, createFortifiedBrowser } from './fortified-browser-fixture.mjs';

test('default lifecycle policy removes every throttling bypass while legacy captures retain their policy', () => {
  assert.deepEqual(backgroundPolicyArguments('default'), []);
  assert.deepEqual(backgroundPolicyArguments('unthrottled'), [
    '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding',
  ]);
});
test('unknown policy is rejected before executable discovery, profile creation or launch', async () => {
  for (const backgroundPolicy of ['bypass', null, '--no-sandbox']) {
    assert.throws(() => backgroundPolicyArguments(backgroundPolicy));
    await assert.rejects(createFortifiedBrowser({ backgroundPolicy }), /known browser background policy/);
  }
});
