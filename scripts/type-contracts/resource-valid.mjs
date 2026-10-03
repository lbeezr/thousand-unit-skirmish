// Compile-only stock -> canonical stage -> scale and filtered legacy transitions.
import { RESOURCE_VISUAL_STAGES, resourceVisualScale, resourceVisualStage,
  resourceVisualTransitionStages } from '../../src/resource-visual-state.mjs';

/** @type {import('../../src/resource-visual-state.mjs').ResourceVisualStage} */
const stage = resourceVisualStage(66, 100);
resourceVisualScale(stage).toFixed(2);
for (const registered of RESOURCE_VISUAL_STAGES) resourceVisualScale(registered);

// Unknown legacy values are intentionally supported by the membership boundary.
for (const current of [undefined, null, 'unknown', { stage: 'full' }]) {
  for (const dirtyStage of resourceVisualTransitionStages(current, stage)) {
    resourceVisualScale(dirtyStage).toFixed(2);
  }
}
