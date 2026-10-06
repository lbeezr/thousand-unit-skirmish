import path from 'node:path';
import { TERRAIN_MATERIALS } from '../terrain-materials.mjs';
import { CLIENT_ASSET_PATHS, ENVIRONMENT_MODULE_PATH } from './client-asset-paths.mjs';

// Shared exact static admission contract; does not read or serve files.
export function isClientStaticAsset(relative) {
  const publicClientAsset = CLIENT_ASSET_PATHS.includes(relative);
  const publicUiAsset = [
    'assets/ui/portraits/human-worker-source.png', 'assets/ui/portraits/boughward-worker-source.png',
    'assets/ui/cursors/select-add.png',
    'assets/ui/cursors/select-remove.png',
    'assets/ui/cursors/box-crossing.png',
    'assets/ui/cursors/move-queued.png',
    'assets/ui/cursors/attack.png',
    'assets/ui/cursors/attack-move-queued.png',
    'assets/ui/cursors/gather-wood.png',
    'assets/ui/cursors/rally.png',
    'assets/ui/cursors/unavailable.png',
    'assets/ui/preview.html', 'assets/ui/cursors/manifest.json',
    'assets/ui/cursors/select.png', 'assets/ui/cursors/select.svg',
    'assets/ui/cursors/box-select.png', 'assets/ui/cursors/box-select.svg',
    'assets/ui/cursors/move.png', 'assets/ui/cursors/move.svg',
    'assets/ui/cursors/attack-move.png', 'assets/ui/cursors/attack-move.svg',
    'assets/ui/cursors/gather.png', 'assets/ui/cursors/gather.svg',
    'assets/ui/cursors/build-valid.png', 'assets/ui/cursors/build-valid.svg',
    'assets/ui/cursors/build-blocked.png', 'assets/ui/cursors/build-blocked.svg',
    'assets/ui/icons/wood.svg', 'assets/ui/icons/food.svg', 'assets/ui/icons/move.svg',
    'assets/ui/icons/attack.svg', 'assets/ui/icons/gather.svg', 'assets/ui/icons/build.svg',
    'assets/ui/icons/actions/patrol.svg', 'assets/ui/icons/actions/follow.svg',
    'assets/ui/icons/actions/stop.svg', 'assets/ui/icons/actions/hold-position.svg',
    'assets/ui/icons/actions/return-cargo.svg', 'assets/ui/icons/actions/formation.svg',
  ].includes(relative);
  const publicEnvironmentModule = relative === ENVIRONMENT_MODULE_PATH;
  const publicPaintedMaterialAtlasAsset = /^assets\/environment\/frontier-painted-material-atlas-v1\/(?:manifest\.json|frontier-painted-material-atlas-mip-[0-5]\.webp)$/.test(relative);
  const publicOakDepletionAtlasAsset = /^assets\/environment\/frontier-oak-depletion-atlas-v1\/(?:manifest\.json|oak-depletion-mip-[0-5]\.webp)$/.test(relative);
  const publicEnvironmentAtlasMetadata = ['bellweather', 'sereward', 'pale-meridian', 'siltmouths', 'vesperra', 'sombral-mere', 'underbough', 'underbough-bramble', 'underbough-root-oak', 'underbough-moss-hornbeam', 'underbough-young-hornbeam', 'underbough-leafy-hornbeam-v2', 'underbough-muted-copperleaf-v2', 'underbough-old-plum', 'veyrholds', 'ellionar', 'ellionar-hedge', 'sereward-acacia', 'sereward-scrub', 'bellweather-hedgerow', 'ru-lora-fringe'].some((region) =>
    relative === `assets/environment/frontier-v1/${region}-lifecycle-atlas.json`);
  const publicEnvironmentAsset = path.dirname(relative) === 'assets/environment/frontier-v1'
    && ['.png', '.webp'].includes(path.extname(relative))
    && ['oak', 'pine', 'silver-birch', 'field-maple', 'hazel-thicket',
      'ru-lora-fringe-canopy', 'ru-lora-fringe-canopy-worked', 'ru-lora-fringe-canopy-low', 'ru-lora-fringe-canopy-depleted', 'ru-lora-fringe-lifecycle-atlas', 'ru-lora-fringe-broadleaf', 'bellweather-field-maple', 'bellweather-hedgerow', 'bellweather-meadow-herbs', 'bellweather-meadow-clover', 'bellweather-wild-barley', 'vesperra-shade-fern', 'vesperra-shade-fern-02', 'vesperra-veilcap', 'vesperra-spiral-podvine', 'siltmouths-silver-reed', 'siltmouths-marsh-tuber', 'pale-meridian-violet-lichen', 'pale-meridian-silver-moss', 'pale-meridian-frostberry', 'sombral-mere-lunewort', 'sombral-mere-noctilune', 'sombral-mere-mirelily', 'underbough-low-hazel', 'underbough-rootward-fungus', 'underbough-rootward-fungus-02', 'veyrholds-ridgegrass', 'veyrholds-suncrest', 'veyrholds-alpine-moss', 'ellionar-sunbloom', 'ellionar-garden-vine', 'sereward-succulent', 'sereward-succulent-02',
      'bellweather-hedgerow-worked', 'bellweather-hedgerow-low', 'bellweather-hedgerow-depleted',
      'bellweather-lifecycle-atlas', 'bellweather-hedgerow-lifecycle-atlas', 'sereward-lifecycle-atlas', 'pale-meridian-lifecycle-atlas', 'siltmouths-lifecycle-atlas', 'vesperra-lifecycle-atlas', 'sombral-mere-lifecycle-atlas', 'underbough-lifecycle-atlas', 'underbough-bramble-lifecycle-atlas', 'veyrholds-lifecycle-atlas', 'ellionar-lifecycle-atlas', 'ellionar-hedge-lifecycle-atlas', 'sereward-scrub-lifecycle-atlas', 'sereward-acacia-lifecycle-atlas',
      'sombral-mere-merebloom', 'sombral-mere-merebloom-worked', 'sombral-mere-merebloom-low', 'sombral-mere-merebloom-depleted',
      'vesperra-mistbark', 'vesperra-mistbark-worked', 'vesperra-mistbark-low', 'vesperra-mistbark-depleted',
      'siltmouths-tidal-tree', 'siltmouths-tidal-tree-worked', 'siltmouths-tidal-tree-low', 'siltmouths-tidal-tree-depleted',
      'pale-meridian-conifer', 'pale-meridian-conifer-worked', 'pale-meridian-conifer-low', 'pale-meridian-conifer-depleted',
      'bellweather-field-maple-worked', 'bellweather-field-maple-low', 'bellweather-field-maple-depleted',
      'veyrholds-highpine-worked', 'veyrholds-highpine-low', 'veyrholds-highpine-depleted',
      'veyrholds-highpine', 'veyrholds-ironlichen-outcrop', 'ru-lora-fiendwood', 'ru-lora-stone-fern', 'ru-lora-broken-trunk', 'ru-lora-god-bone',
      'underbough-copperleaf', 'underbough-bramble',
      'underbough-bramble-worked', 'underbough-bramble-low', 'underbough-bramble-depleted',
      'underbough-copperleaf-worked', 'underbough-copperleaf-low', 'underbough-copperleaf-depleted',
      'sereward-palm', 'sereward-acacia', 'sereward-scrub',
      'sereward-palm-worked', 'sereward-palm-low', 'sereward-palm-depleted',
      'sereward-scrub-worked', 'sereward-scrub-low', 'sereward-scrub-depleted',
      'sereward-acacia-worked', 'sereward-acacia-low', 'sereward-acacia-depleted',
      'ellionar-cultivated-palm', 'ellionar-garden-hedge',
      'ellionar-cultivated-palm-worked', 'ellionar-cultivated-palm-low', 'ellionar-cultivated-palm-depleted',
      'ellionar-garden-hedge-worked', 'ellionar-garden-hedge-low', 'ellionar-garden-hedge-depleted',
      'rock-boulder-cluster', 'basalt-ridge-cap', 'cliff-end-cap',
      'berries', 'rock-outcrop', 'basalt-ridge', 'cliff', 'seamstone',
      'underbough-thornberry', 'underbough-thornberry-worked', 'underbough-thornberry-low', 'underbough-thornberry-depleted',
      'underbough-dense-growth-v2', 'underbough-clearing-grass-v2', 'underbough-clearing-grass-02-v2', 'underbough-root-soil-v2', 'underbough-root-soil-02-v2', 'underbough-worn-dirt-v2', 'underbough-worn-dirt-02-v2', 'underbough-shaded-stone-v2', 'underbough-wet-bank-v2',
      'underbough-old-plum-lifecycle-atlas', 'underbough-old-plum', 'underbough-old-plum-worked', 'underbough-old-plum-low', 'underbough-old-plum-depleted',
      'underbough-moss-hornbeam-lifecycle-atlas', 'underbough-moss-hornbeam', 'underbough-moss-hornbeam-worked', 'underbough-moss-hornbeam-low', 'underbough-moss-hornbeam-depleted',
      'underbough-muted-copperleaf-v2-lifecycle-atlas', 'underbough-muted-copperleaf-v2', 'underbough-muted-copperleaf-v2-worked', 'underbough-muted-copperleaf-v2-low', 'underbough-muted-copperleaf-v2-depleted',
      'underbough-leafy-hornbeam-v2-lifecycle-atlas', 'underbough-leafy-hornbeam-v2', 'underbough-leafy-hornbeam-v2-worked', 'underbough-leafy-hornbeam-v2-low', 'underbough-leafy-hornbeam-v2-depleted',
      'underbough-young-hornbeam-lifecycle-atlas', 'underbough-young-hornbeam', 'underbough-young-hornbeam-worked', 'underbough-young-hornbeam-low', 'underbough-young-hornbeam-depleted',
      'underbough-root-oak-lifecycle-atlas', 'underbough-root-oak', 'underbough-root-oak-worked', 'underbough-root-oak-low', 'underbough-root-oak-depleted',
      'bellweather-quiet-meadow', 'siltmouths-quiet-mud', 'pale-meridian-quiet-snow', 'vesperra-quiet-loam',
      ...TERRAIN_MATERIALS].includes(path.basename(relative, path.extname(relative)));
  const publicPodvineViewAsset = relative === 'assets/environment/vesperra-podvine-views-v1/views-atlas.webp' || relative === 'assets/environment/vesperra-podvine-worked-v1/review-atlas.webp' || relative === 'assets/environment/vesperra-podvine-low-v1/lifecycle-atlas.webp' || relative === 'assets/environment/vesperra-veilcap-views-v1/views-atlas.webp' || relative === 'assets/environment/vesperra-veilcap-worked-v2/veilcap-worked-atlas.webp' || relative === 'assets/environment/ellionar-sunbloom-views-v1/sunbloom-views-atlas.webp' || relative === 'assets/environment/ellionar-sunbloom-crowns-v2/sunbloom-crowns-atlas.webp' || relative === 'assets/environment/ellionar-sunbloom-worked-v3/sunbloom-worked-atlas.webp' || relative === 'assets/environment/ellionar-sunbloom-low-v4/sunbloom-low-atlas.webp';
  const publicInteractiveEnvironmentAsset = path.dirname(relative) === 'assets/environment/frontier-interactive-v1'
    && (relative === 'assets/environment/frontier-interactive-v1/manifest.json'
      || (path.extname(relative) === '.webp'
        && /^(?:(?:oak|berries)-(?:full|worked|low|depleted)|construction-(?:earthwork|foundation))$/
          .test(path.basename(relative, path.extname(relative)))));
  const publicDirectionalResourceAtlas = /^assets\/environment\/frontier-meshy-fixed-camera-v3\/(oak|berries)\/\1-atlas\.webp$/.test(relative);
  const publicMeshyResourceAsset = /^assets\/environment\/frontier-meshy-(?:sprites-v1|fixed-camera-v3)\/(oak|pine|berries)\/runtime\/\1-0[0-7]\.webp$/.test(relative);
  const publicEnvironmentPilotAsset = path.dirname(relative) === 'assets/environment/frontier-cliff-pilot-v1/runtime'
    && /^(cliff-color-0[0-7]\.webp|cliff-depth-0[0-7]\.png)$/.test(path.basename(relative));
  const publicBuildingSpriteAsset = (
    path.dirname(relative) === 'assets/buildings/town-center-meshy-review-v1/runtime'
    && /^town-center-view-0[0-7]\.webp$/.test(path.basename(relative))
  ) || ['barracks', 'archery-range'].some((kind) =>
    path.dirname(relative) === `assets/buildings/${kind === 'barracks' ? 'barracks-sprite-test-v1' : 'archery-range-sprite-v1'}/runtime`
    && new RegExp(`^${kind}-(foundation|frame|complete|damaged|critical)-(azure|ember)\\.webp$`).test(path.basename(relative)));
  const publicMapAsset = path.dirname(relative) === 'maps' && path.extname(relative) === '.json';
  const publicUnitSpriteAsset = [
    ...['worker', 'infantry', 'spearman', 'archer', 'scout', 'rider', 'siege-engine'].map(role => [`boughward-${role}`, 'v1']),
    ['worker', 'v1'], ['worker', 'v2'], ['worker', 'v3'],
    ['infantry', 'v1'], ['infantry', 'v2'], ['infantry', 'v3'], ['infantry', 'v4'], ['spearman', 'v1'], ['scout', 'v1'], ['rider', 'v1'], ['siege-engine', 'v1'], ['archer', 'v1'], ['archer', 'v2'],
    ...['human', 'orc', 'elf', 'troll'].map(role => [role, 'v1', 'cast']),
    ['human', 'v2', 'cast'], ['human', 'v3', 'cast'],
  ].some(([role, version, prefix]) => {
    const directory = `assets/units/${prefix ? `${prefix}-` : ''}${role}-sprite-${version}`;
    return [
      `${directory}/sprite-atlas-pack-v1.json`,
      `${directory}/${prefix || role}-atlas-runtime.png`,
      `${directory}/team-accent-mask.png`,
    ].includes(relative);
  });
  const publicFrontierCompleteAsset = /^assets\/buildings\/(?:frontier-civilization-scale-pilot-v1\/(?:(?:town-center|house)-complete-renderer\.json|captures\/(?:town-center|house)-complete-view-0[0-7]\.png)|frontier-civilization-models-v1\/(?:(?:storehouse|stable|workshop|watchtower)-complete-renderer\.json|captures\/(?:storehouse|stable|workshop|watchtower)-complete-view-0[0-7]\.png)|frontier-civilization-military-models-v1\/(?:(?:barracks|archery-range)-complete-renderer\.json|captures\/(?:barracks|archery-range)-complete-view-0[0-7]\.png))$/.test(relative);
  const publicFrontierEconomyAsset = /^assets\/buildings\/frontier-economy-models-v1\/(?:(?:mill|farm|dock)-complete-renderer\.json|runtime\/(?:mill|dock)-(?:foundation|frame|complete|damaged|critical)-view-0[0-7]\.png|runtime\/farm-(?:foundation|frame|complete|damaged|critical|exhausted|exhausted-damaged|exhausted-critical)-view-0[0-7]\.png)$/.test(relative);
  const publicWildlifeAsset = [
    'assets/wildlife/bellweather-sheep-static-v1/static-preview-binding.json',
    'assets/wildlife/bellweather-sheep-static-v1/sprite-atlas-pack-v1.json',
    'assets/wildlife/bellweather-sheep-static-v1/sheep-atlas-runtime.png',
  ].includes(relative);
  const buildingPackRoot = 'assets/buildings/town-center-lifecycle-meshy-v1';
  const publicBuildingLifecycleManifest = relative === `${buildingPackRoot}/lifecycle-grid.json`;
  const publicBuildingLifecycleRuntimeAsset = path.dirname(relative) === `${buildingPackRoot}/runtime`
    && /^(?:town-center-(?:foundation|frame|complete|damaged|critical)-view-\d{2}\.webp|team-mask-(?:foundation|frame|complete|damaged|critical)-view-\d{2}\.png)$/.test(path.basename(relative));
  const publicZoneAudioAsset = (relative === 'assets/audio/runtime/rts-feedback-test/v1/manifest.json'
    || /^assets\/audio\/runtime\/vaelora-(?:bellweather|underbough|sereward|ellionar|veyrholds|pale-meridian|siltmouths|vesperra|sombral-mere|ru-lora-fringe|ru-lora-interior)\/v[12]\/manifest\.json$/.test(relative))
    || relative === 'assets/audio/vaelora-zones-v1/catalog.json'
    || /^assets\/audio\/vaelora-zones-v1\/sources\/tus_(?:bellweather|underbough|sereward|ellionar|veyrholds|pale-meridian|siltmouths|vesperra|sombral-mere|ru-lora-fringe|ru-lora-interior)_(?:music|terrain|contrast|signature)_0[12]_v001\.mp3$/.test(relative)
    || /^assets\/audio\/vaelora-pilot-v1\/sources\/tus_ui_(?:wood-token|iron-latch|muted-pluck|horn-note)_01_v001\.mp3$/.test(relative);
  return !(!publicZoneAudioAsset && !publicClientAsset && !publicEnvironmentModule && !publicPaintedMaterialAtlasAsset && !publicOakDepletionAtlasAsset && !publicEnvironmentAsset && !publicEnvironmentAtlasMetadata && !publicUiAsset
    && !publicDirectionalResourceAtlas && !publicMeshyResourceAsset && !publicPodvineViewAsset && !publicInteractiveEnvironmentAsset && !publicEnvironmentPilotAsset && !publicBuildingSpriteAsset && !publicMapAsset
    && !publicFrontierCompleteAsset && !publicFrontierEconomyAsset && !publicUnitSpriteAsset && !publicWildlifeAsset && !publicBuildingLifecycleManifest && !publicBuildingLifecycleRuntimeAsset);
}
