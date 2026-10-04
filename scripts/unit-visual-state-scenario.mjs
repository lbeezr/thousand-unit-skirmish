import assert from 'node:assert/strict';
import {
  unitActionPoseAllowed, unitCargoVisualState, unitWorkerActionPose,
} from '../src/unit-visual-state.mjs';

assert.equal(unitActionPoseAllowed(100, 0), true,
  'living units may show their current action pose');
assert.equal(unitActionPoseAllowed(1, 0), true,
  'living units at low health may show their current action pose');
assert.equal(unitActionPoseAllowed(0, 0), false,
  'defeated units must not show action poses');
assert.equal(unitActionPoseAllowed(-1, 0), false,
  'units below zero health must not show action poses');
assert.equal(unitActionPoseAllowed(100, 1234), false,
  'an active defeat animation takes precedence over another action pose');

assert.equal(unitCargoVisualState('worker', 100, true, 0, null), 'none',
  'empty Workers have no cargo cue');
assert.equal(unitCargoVisualState('worker', 100, true, 4, 'wood'), 'wood',
  'wood cargo uses the wood cue');
assert.equal(unitCargoVisualState('worker', 100, true, 4, 'food'), 'food',
  'food cargo uses the food cue');
assert.equal(unitCargoVisualState('worker', 100, true, 4, null), 'unknown',
  'cargo without a known type uses a neutral cue');
assert.equal(unitCargoVisualState('worker', 100, true, 1, 'wood'),
  unitCargoVisualState('worker', 100, true, 9, 'wood'),
  'amount changes within one resource type retain the same visual state');
assert.equal(unitCargoVisualState('infantry', 100, true, 4, 'wood'), 'none',
  'non-Workers do not inherit cargo cues');
assert.equal(unitCargoVisualState('worker', 0, true, 4, 'wood'), 'none',
  'defeated Workers do not retain cargo cues');
assert.equal(unitCargoVisualState('worker', Number.NaN, true, 4, 'wood'), 'none',
  'invalid health does not expose a cargo cue');
assert.equal(unitCargoVisualState('worker', 100, false, 4, 'food'), 'none',
  'fog-hidden Workers do not expose cargo cues');

assert.equal(unitActionPoseAllowed(0, 1234), false,
  'defeated units must not show action poses during their defeat animation');

assert.equal(unitWorkerActionPose('worker', true, 'gathering', 'gather-wood', false), 'chopping',
  'wood gatherers use the broad chopping cue');
assert.equal(unitWorkerActionPose('worker', true, 'gathering', 'gather-food', false), 'berry-gathering',
  'food gatherers use the shorter berry-picking cue');
assert.equal(unitWorkerActionPose('worker', true, 'gathering', null, false), 'none',
  'assigned gathering without confirmed activity has no work pose');
assert.equal(unitWorkerActionPose('worker', true, 'gathering', 'gather-stone', false), 'gathering',
  'confirmed Stone preserves the existing neutral procedural cue, with no dedicated sprite art');
assert.equal(unitWorkerActionPose('worker', true, 'building', 'build', false), 'construction',
  'positive construction keeps its existing hammer cue');
assert.equal(unitWorkerActionPose('worker', true, 'repairing', 'repair', false), 'construction', 'repair reuses the declared construction action cue');
for (const task of ['building', 'repairing']) {
  assert.equal(unitWorkerActionPose('worker', true, task, null, false), 'none',
    `${task} waiting has no procedural work pose`);
}
assert.equal(unitWorkerActionPose('worker', true, 'building', 'repair', false), 'none',
  'incompatible receipt has no procedural work pose');
assert.equal(unitWorkerActionPose('worker', true, 'returning', 'gather-food', false), 'none',
  'workers returning to base do not swing');
assert.equal(unitWorkerActionPose('worker', true, 'gathering', 'gather-wood', true), 'none',
  'workers moving to a resource do not swing');
assert.equal(unitWorkerActionPose('worker', false, 'gathering', 'gather-wood', false), 'none',
  'fog-hidden workers do not expose an action pose');
assert.equal(unitWorkerActionPose('infantry', true, 'gathering', 'gather-wood', false), 'none',
  'non-workers do not inherit worker action poses');

process.stdout.write('Unit visual-state scenario passed: defeat priority, fog safety, and worker action mapping.\n');
