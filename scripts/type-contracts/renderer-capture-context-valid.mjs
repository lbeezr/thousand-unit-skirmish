import { validateCaptureContext } from '../renderer-capture-context.mjs';

/** @param {unknown} candidate */
export async function checkedCapture(candidate) {
  const context = validateCaptureContext(candidate);
  context.evidenceDirectory.toUpperCase();
  // @ts-expect-error background policy cannot admit arbitrary launch flags
  context.backgroundPolicy = '--disable-background-timer-throttling';
  await context.capture({ mapId: 'veyrholds-terraced-vale', checkpoint: 'move-feedback' });
  // @ts-expect-error browser lifecycle belongs to the shared runner
  context.browser;
  // @ts-expect-error adapters receive one fixed context version
  context.version = 2;
  // @ts-expect-error source identity cannot be reassigned by an adapter
  context.source.digest = 'private';
  // @ts-expect-error screenshot checkpoints require an explicit observed map
  await context.capture({ checkpoint: 'missing-map' });
}
