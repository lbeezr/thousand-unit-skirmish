import { validateElevationPatches } from '../../../../map-utils.mjs';

export const MAP_STUDIO_DRAFT_VERSION = 1;

export function requireRecovery(draft, sourceMapId) {
  const state = draft?.editor;
  const definition = state?.definition;
  if (draft?.version !== MAP_STUDIO_DRAFT_VERSION || draft.sourceMapId !== sourceMapId
    || !definition || !Number.isInteger(definition.width) || !Number.isInteger(definition.height)
    || definition.width < 16 || definition.width > 256 || definition.height < 16 || definition.height > 256
    || !Array.isArray(definition.obstacles) || !Array.isArray(definition.spawnPoints)
    || !Array.isArray(definition.resourceNodes || []) || !Array.isArray(definition.triggers || [])
    || !Array.isArray(definition.scenarioEvents || []) || !Array.isArray(definition.terrainPatches || [])) {
    throw new Error('The saved draft could not be read. Discard it to start a fresh map.');
  }
  const invalid = validateElevationPatches(definition.width, definition.height, definition.elevationPatches);
  if (invalid) throw new Error(`Invalid elevation patches: ${invalid.reason}.`);
  if ((definition.terrainPatches || []).some(patch => patch === null)) {
    throw new Error('Map has a ground paint patch outside its grid or with an invalid material.');
  }
  if (definition.obstacles.some(obstacle => obstacle === null)) {
    throw new Error('Map has a terrain block outside its grid or with invalid dimensions.');
  }
  if ((definition.triggers || []).some(trigger => trigger === null)) {
    throw new Error('Map contains an invalid capture-zone trigger.');
  }
  if ((definition.scenarioEvents || []).some(event => event === null)) {
    throw new Error('Map contains an invalid timed supply event.');
  }
  if ((definition.resourceNodes || []).some(node => node === null)) {
    throw new Error('Map has an invalid, duplicate, out-of-bounds or unsupported resource node.');
  }
  const formValues = state.formValues;
  if (formValues === null) {
    throw new Error('The saved draft could not be read. Discard it to start a fresh map.');
  }
  // Capture omits file inputs; inspect stored data without invoking field getters.
  const fileEntry = formValues == null ? undefined
    : Object.getOwnPropertyDescriptor(formValues, 'studio-import-file');
  const fileValue = fileEntry?.enumerable && fileEntry.value != null
    ? Object.getOwnPropertyDescriptor(fileEntry.value, 'value')?.value : undefined;
  if (typeof fileValue === 'string' && fileValue !== '') {
    throw new Error('The saved draft could not be read. Discard it to start a fresh map.');
  }
  return { state, definition };
}
