import { RESOURCE_VISUAL_STAGES } from './resource-visual-state.mjs';

// These pages contain one registered painted view per state. Extra directions
// need matching authored states before this fixed-view path can consume them.
export function forestLifecycleAtlasDescriptor(pack, region) {
  const asset = pack?.assets?.[0], page = pack?.pages?.[0];
  const family = {
    bellweather: 'bellweather-field-maple', sereward: 'sereward-palm',
    'pale-meridian': 'pale-meridian-conifer', siltmouths: 'siltmouths-tidal-tree',
    vesperra: 'vesperra-mistbark', 'sombral-mere': 'sombral-mere-merebloom',
    underbough: 'underbough-copperleaf', veyrholds: 'veyrholds-highpine',
    ellionar: 'ellionar-cultivated-palm', 'ellionar-hedge': 'ellionar-garden-hedge',
    'ru-lora-fringe': 'ru-lora-fringe-canopy',
  }[region] || region;
  const file = pack?.files?.find(entry => entry.id === page?.runtimeFileId);
  const positiveInteger = value => Number.isInteger(value) && value > 0;
  const pw = page?.dimensionsPx?.width, ph = page?.dimensionsPx?.height;
  if (pack?.schemaVersion !== 1 || pack.assets?.length !== 1 || pack.pages?.length !== 1
    || asset?.id !== family || file?.path !== `${region}-lifecycle-atlas.webp`
    || pack.files.filter(entry => entry.id === page.runtimeFileId).length !== 1
    || !positiveInteger(pw) || !positiveInteger(ph)
    || file.dimensionsPx?.width !== pw || file.dimensionsPx?.height !== ph
    || page.sampling?.generateMipmaps !== true || page.sampling?.maxMipLevel !== 6
    || page.gutterPx !== 64 || page.sampling?.uvInsetPx !== 0.5
    || asset.frames?.length !== RESOURCE_VISUAL_STAGES.length
    || asset.clips?.length !== RESOURCE_VISUAL_STAGES.length) {
    throw new Error('unsupported forest atlas contract');
  }
  const canvas = asset.frames[0].canvasPx;
  if (!positiveInteger(canvas?.width) || !positiveInteger(canvas?.height)) {
    throw new Error('invalid forest state canvas');
  }
  const rects = [];
  for (const stage of RESOURCE_VISUAL_STAGES) {
    const frames = asset.frames.filter(frame => frame.id === stage);
    const clips = asset.clips.filter(clip => clip.stateId === stage);
    const frame = frames[0], clip = clips[0], rect = frame?.fallbackRectPx?.rectPx;
    if (frames.length !== 1 || clips.length !== 1
      || clip.directionId !== 'fixed-oblique' || clip.sequence?.length !== 1
      || clip.sequence[0].frameId !== stage
      || frame.canvasPx?.width !== canvas.width || frame.canvasPx?.height !== canvas.height
      || frame.groundPivotPx?.x !== canvas.width / 2 || frame.groundPivotPx?.y !== canvas.height
      || frame.fallbackRectPx?.pageId !== page.id
      || rect?.width !== canvas.width || rect?.height !== canvas.height
      || !Number.isInteger(rect.x) || !Number.isInteger(rect.y)
      || rect.x < page.gutterPx || rect.y < page.gutterPx
      || rect.x + rect.width + page.gutterPx > pw
      || rect.y + rect.height + page.gutterPx > ph
      || rects.some(other => rect.x < other.x + other.width + 2 * page.gutterPx
        && rect.x + rect.width + 2 * page.gutterPx > other.x
        && rect.y < other.y + other.height + 2 * page.gutterPx
        && rect.y + rect.height + 2 * page.gutterPx > other.y)) {
      throw new Error(`inconsistent forest lifecycle binding: ${stage}`);
    }
    rects.push(rect);
  }
  return { asset, page, file };
}
