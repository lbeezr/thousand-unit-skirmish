// Registered ordinary capture case. No browser/server launch or import effects.
import assert from 'node:assert/strict';
import path from 'node:path';
import { runNoviceScenario } from './renderer-qualification-novice.mjs';

export const id = 'novice-flow';

export async function run({ page, origin, source, capture, evidenceDirectory }, { execute = runNoviceScenario } = {}) {
  assert.ok(typeof capture === 'function', 'novice case requires the shared capture hook');
  assert.ok(typeof evidenceDirectory === 'string' && path.isAbsolute(evidenceDirectory),
    'novice case requires the owned case artifact directory');
  let sharedCaptured = false;
  const result = await execute({ page, origin, evidenceDirectory,
    release: { sourceRevision: source?.revision, digest: source?.digest },
    onSelected: async () => {
      await capture({ page, mapId: 'veyrholds-terraced-vale', checkpoint: 'selected-worker' });
      sharedCaptured = true;
    } });
  const passed = result.status === 'passed' && sharedCaptured;
  return { status: passed ? 'passed' : 'failed', checks: [
    { id: 'normal-menu-worker-pointer-move', passed },
    { id: 'source-bound-worker-selection', passed: sharedCaptured },
    { id: 'live-worker-displacement-frames', passed: result.status === 'passed' && result.frames?.length === 2 },
  ] };
}
