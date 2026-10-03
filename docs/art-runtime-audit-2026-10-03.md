# Building and environment runtime audit — 3 October 2026

[Asset guide](assets.md) · [Architecture wiki](lore/frontier-architecture.md) ·
[Preserved art](lore/art-evolution.md) · [Preferred pipeline](building-asset-production-pipeline.md)

Audit baseline: fork main `9b6214605baf702d9f90ff61b3f2f9e5c77b9d9e`.
All eight selected concept PNGs match their source manifest. Six families have
successful model-production provenance and 48 captured PNGs, all matching their
renderer-manifest hashes; all 48 decode as unclipped 1024-square RGBA. View 01 pixels for all six were inspected in this cloud
workspace: these are saved source captures, not new game screenshots.

## What was made and what the game uses

| New Frontier family | Concept → model evidence | Registered sprites of this design | Default match art | Preview and release status |
| --- | --- | --- | --- | --- |
| Town Center | [Concept](../assets/buildings/frontier-civilization-concepts-v1/town-center.png); successful [Meshy record](../assets/buildings/frontier-civilization-scale-pilot-v1/model-provenance.json), model SHA-256 `c86e1e55223df8b26c8060622ea3bbd2fb49e78ae576417734bd8eb6a30c6faa` | [Eight Complete views](../assets/buildings/frontier-civilization-scale-pilot-v1/town-center-complete-renderer.json), 5,240,284 PNG bytes | Older five-state/eight-view Town Center pack with team masks | Existing opt-in loader; this slice admits its manifest and eight PNGs to the release, selectable alone with `frontierBuildingsPreview=town-center` |
| House | [Concept](../assets/buildings/frontier-civilization-concepts-v1/house.png); successful [Meshy record](../assets/buildings/frontier-civilization-scale-pilot-v1/model-provenance.json) | [Eight Complete views](../assets/buildings/frontier-civilization-scale-pilot-v1/house-complete-renderer.json), 2,586,641 PNG bytes | Procedural House | Full-checkout opt-in; preview files remain outside Docker |
| Storehouse | [Concept](../assets/buildings/frontier-civilization-concepts-v1/storehouse.png); successful [Meshy record](../assets/buildings/frontier-civilization-models-v1/model-provenance.json) | [Eight Complete views](../assets/buildings/frontier-civilization-models-v1/storehouse-complete-renderer.json), 1,759,248 PNG bytes | Procedural profile through the existing House presentation role | Full-checkout opt-in; preview files remain outside Docker |
| Stable | [Concept](../assets/buildings/frontier-civilization-concepts-v1/stable.png); successful [Meshy record](../assets/buildings/frontier-civilization-models-v1/model-provenance.json) | [Eight Complete views](../assets/buildings/frontier-civilization-models-v1/stable-complete-renderer.json), 2,511,756 PNG bytes | Procedural profile through the existing Barracks presentation role | Full-checkout opt-in; preview files remain outside Docker |
| Workshop | [Concept](../assets/buildings/frontier-civilization-concepts-v1/workshop.png); successful [Meshy record](../assets/buildings/frontier-civilization-models-v1/model-provenance.json) | [Eight Complete views](../assets/buildings/frontier-civilization-models-v1/workshop-complete-renderer.json), 2,179,042 PNG bytes | Procedural profile through the existing Archery Range presentation role | Full-checkout opt-in; preview files remain outside Docker |
| Watchtower | [Concept](../assets/buildings/frontier-civilization-concepts-v1/watchtower.png); successful [Meshy record](../assets/buildings/frontier-civilization-models-v1/model-provenance.json) | [Eight Complete views](../assets/buildings/frontier-civilization-models-v1/watchtower-complete-renderer.json), 1,747,020 PNG bytes | Procedural Watchtower | Full-checkout opt-in; preview files remain outside Docker |
| Barracks | [New concept](../assets/buildings/frontier-civilization-concepts-v1/barracks.png); no corresponding new-kit Meshy record found in the two Frontier model packs | One illustrated Complete concept; no new-kit directional renderer manifest found | Older direct five-state/two-team sprites | New design source-only; earlier Barracks GLB/construction packs are separate designs |
| Archery Range | [New concept](../assets/buildings/frontier-civilization-concepts-v1/archery-range.png); no corresponding new-kit Meshy record found in the two Frontier model packs | One illustrated Complete concept; no new-kit directional renderer manifest found | Older direct five-state/two-team sprites | New design source-only; earlier Range construction packs are separate designs |

The model records describe completed production, not lost or nonexistent models.
Their six recorded `meshy_output/<family>.glb` paths are absent in this cloud
checkout. Git ignores that directory; cloud absence says nothing about the Mac's
current files. The parent reports the Town Center original recovered on the Mac
at 129,781,816 bytes with the hash above. That recovery has not been independently
verified here. The published PNGs are sufficient for this Complete preview;
deriving new model states requires authorized access to the original source.

## Exact missing lifecycle work

The [captured loader](../src/captured-building-art.mjs) already consumes
`foundation`, `frame`, `complete`, `damaged` and `critical`. Its defaults select
Foundation at construction progress ≤27.5%, Frame above that until completion,
Critical at health ≤30%, and Damaged at health ≤60%; manifests can specify the
thresholds. The older direct Barracks/Range loader uses its own 20%/90%
construction and 66%/33% health thresholds. Do not conflate these contracts.

All six new Frontier renderer manifests declare only Complete and no team masks.
For the Town Center pilot, full existing-contract admission needs 32 additional
color views (four states × eight headings) and 40 aligned masks (including the
eight existing Complete views), with shared camera, scale, ground pivot and hashes.
The [lifecycle validator](../scripts/validate-building-lifecycle.mjs) checks that
contract with `--require-lifecycle --require-team-masks`. Existing Complete-only
packs intentionally fail that full-admission check; this preview does not waive it.

The engine currently removes destroyed buildings from the visible snapshot and
disposes their visuals. Neither loader consumes a `destroyed`/`ruins` state or
collapse animation. Destruction art therefore also needs an explicit transient
presentation/event contract; generating a sixth state alone would not display it.
Critical damage and final destruction are different work.

## Bounded visible integration

Use `?frontierBuildingsPreview=town-center` on a game URL, or append
`&frontierBuildingsPreview=town-center` to an existing room URL. Reload to apply.
Only Town Centers request the new family. Complete uses the existing verified
capture loader; missing construction/damage states yield to the older lifecycle
art. Selection, health, production, rally cues, fog and simulation retain their
current ownership. The captured art has no team masks and its painted pennants
are not reliable team indicators. This is an opt-in art preview.

The original `frontierBuildingsPreview=1` still compares all six families in a
full checkout. Five remain absent from the release. Default URLs keep current
art. No model is added to Docker, no new binary is committed, and no source
capture, manifest, prompt or model-provenance record is changed.

Next: obtain the existing Town Center source through an authorized private
transfer, derive its four missing states and aligned masks, then verify
construction → completion → damage → repair and destruction removal for both
seats at ordinary/strategic zoom. Reuse that completed family workflow for the
other five captured designs; Barracks/Range first need their new-kit model/view
stage. No paid generation or replacement of the recovered model is needed to
start the Town Center pilot.

## What currently gives the world depth and motion

| Capability | Actual binding and status | Limit / next useful improvement |
| --- | --- | --- |
| Grounding and shadows | [Building ground-depth shader](../src/building-sprites.mjs) is used by direct and captured building sprites; world transforms sample terrain height. Sprite illumination/contact detail is painted or captured into the image. | No `renderer.shadowMap` setup or live shadow-casting sun was found. [Unit batches](../src/unit-sprite-runtime.mjs) explicitly disable cast/receive shadows; no independent contact-shadow batch was found. A small grounded shadow layer would need its own fog, overlap and cost checks. |
| Occlusion and depth | Environment cutouts write depth; unit/building cards depth-test, with depth-write disabled and explicit render ordering. Instanced atlases and grounded billboards are active. The [cliff pilot](../src/environment-pilot.mjs) has per-pixel depth and a review page. | Cliff depth is a review experiment, not default battlefield occlusion. A billboard is still a card, not a volumetric canopy/building; crossing units and overlapping sprites require camera-specific checks. |
| Lighting and color | [Main scene](../src/main.js) creates Hemisphere and Directional lights and sRGB output. Terrain side walls use Standard material. Most unit, vegetation, ground and building cards use Basic/Sprite materials with tone mapping disabled. | These cards retain baked light; changing the sun does not relight them or create shadows. Source lighting, ground tint and atlas finish need scene calibration rather than more lights. |
| Ground variety | [Ground sampling](../src/terrain-texture-sampling.mjs) adds seeded rotation/offset and paired texture sampling; Underbough has organic paint edges, regional grounds and forest-height/margin composition in [environment art](../src/environment-art.mjs). | Existing alternatives such as `forestAges=young`/`pockets` remain previews. Repeated single-perspective regional trees and palette/scale consistency remain visible art-review work. |
| Water and vegetation motion | Water uses the authored surface geometry and vertex-colored Basic material. Plants have authored headings and stock-dependent full/worked/low feedback; selected open plants clear beneath building footprints. | No time-driven water wave/ripple shader or wind-deformation path was found. Plant stock changes are state feedback, not swaying or harvesting animation. |
| Fog and mist | Main has distance fog and an authoritative fog-of-war texture overlay. [Animated ground mist](../src/terrain-atmosphere.mjs) is actively bound by environment art, default on jungle-loam/lunar-soil; `terrainAtmosphere=clear` disables it and `mist` forces the study. | Fog of war, distance fog and decorative mist serve different purposes. Mist coverage uses wet-ground masks and does not improve building lifecycle or occlusion. |
| Particles and combat feedback | Main renders health, impact flashes, target rings and production/rally indicators with ordinary materials and bounded updates. | No general ambient particle emitter, wind-blown leaves, dust plume or building-collapse particle system was found in the served source. Add only a cue needed by the selected scene/action. |
| Ambient audio | [Audio runtime](../src/audio.mjs) defaults ambience on; current map/profile bindings load shipped regional music/ambience and loop after audio-context input unlock. Mute/levels/preferences can suppress them, and synth wind is the unavailable-pack fallback. | Source delivery and playback wiring do not establish listening/mix acceptance. Audit the selected scene at recorded levels, with captions and critical cues still readable. |
| Wildlife | Main has no active animal entity/atlas binding at this baseline. The [sheep design](wildlife-bellweather-sheep.md) remains a proposal. | Separate workers own authoritative wildlife and directional sheep art. Neither the references nor this building preview add a living/harvestable animal. |
| Performance | Renderer and unit runtime use instancing, atlas batching, update masks and existing diagnostic/capture instrumentation; [testing](testing.md) defines bounded measurements. | No new measured GPU/frame-time budget is established here. Full 2,000-unit capacity remains an evidence gap in the [roadmap](roadmap.md); unmeasured extra effects cannot be called free. |

Three.js materials already compile shaders. Project custom shader extensions
handle unit atlas/team tint, forest/plant/resource atlas coordinates and bounded
mips, stochastic ground sampling and building ground depth; ground mist has a
dedicated ShaderMaterial. Building team masks are currently composited into a
canvas texture by the captured loader, not tinted by a new building shader.
No EffectComposer, bloom or SSAO/postprocessing chain was found in served `src`.
Shaders can add restrained movement/contact feedback, but cannot supply missing
constructed/ruined geometry or authored silhouette consistency.

## Recommended single-scene polish proof

Use the existing Underbough Rootways mature-settlement scene with one Town Center,
Workers, a mixed woodland edge and water in the same view. Keep the same map
revision/checkpoint, seed, camera transform, viewport/DPR, zoom, unit load and
audio settings for every before/after. Work in this order:

1. Complete the new Town Center's five-state/mask family and package it through
   the current loader. Replay build, damage, repair and final removal; reserve a
   collapse/ruins sequence for an explicit engine event contract.
2. Calibrate root contact, source light/palette and crossings beside actual
   Workers/trees. Compare a single bounded contact-shadow experiment only if
   this view demonstrates a grounding gap; verify hidden enemy entities cannot
   leave shadow cues. Correct anchors/depth before introducing extra effects.
3. Add one restrained motion cue to that view: a rooted grass/understory sway
   batch or water surface motion. Keep paths, food/wood states and team cues
   readable at strategic zoom. Wildlife can join after its separately owned
   authority/art contracts pass; a static reference cannot supply it.

For each step, inspect paired pixels and measure frame/update p50/p95, draw calls,
triangles, texture/memory accounting and long tasks under the same bounded 250-unit
workload. Record hardware/browser and the observed delta before setting a device
budget or extending the effect. This is a proposed polish slice, not new creative,
performance or browser acceptance. It does not require a new shader stack or paid
asset jobs.

## Evidence and limits

Focused checks cover preview selection, all six capture hashes, lifecycle
coverage, stale/failing requests, existing default sprites and contextual HUD.
The [release scenario](../scripts/railway-release-scenario.mjs) checks the actual
packed HTTP runtime: the nine Town Center files are explicitly admitted, PNG
bytes/MIME/hashes survive packaging, the served client import graph resolves,
and other new-family files remain outside this bounded package.

```sh
node --test scripts/frontier-building-preview.test.mjs scripts/frontier-building-renderer.test.mjs scripts/captured-building-state-race.test.mjs scripts/captured-building-manifest-retry.test.mjs scripts/building-lifecycle-validation.test.mjs scripts/building-sprites.test.mjs scripts/ci-sharding.test.mjs scripts/contextual-hud.test.mjs
node scripts/railway-release-scenario.mjs
npm run docs:check
```

This cloud slice does not establish fresh browser rendering, creative acceptance,
deployment or final default adoption. No browser security setting was changed.
The Mac building owner's dirty source work and private HUD/support artifacts
remain outside this PR. Shared runtime edits are limited to the preview import
and selector in `src/main.js`, one public module entry in `server.mjs`, and
explicit release files; no Map Studio or wildlife contract is edited.
