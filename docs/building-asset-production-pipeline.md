# Building pipeline: concepts to captured models

[Documentation index](README.md) · [Asset guide](assets.md)

This is the preferred path for new building art: design matched states, model
and optimize each state, then capture registered sprite views. Use the
[direct 2D workflow](building-sprite-production-workflow.md) when modeling adds
little value.

## Workflow

1. **Read the gameplay state contract.** Identify construction/health thresholds,
   occupancy, visible base, and supported views. A static landmark may expose
   only Complete even when a review pack contains other states.
2. **Approve the complete design.** Establish silhouette, material, team cue,
   camera, scale, ground contact, and light at game size.
3. **Derive one concept per needed state.** Keep identity and registration fixed.
   Review a labeled sheet; submit each state separately to Image-to-3D.
4. **Inspect each generated model.** Check openings, roofs, silhouettes, ground,
   props, and back faces before remeshing.
5. **Optimize and measure.** Retain original and optimized models. Record requested
   and actual triangles, bytes, materials/textures, provider IDs, and actual spend.
6. **Capture matched views.** Use one orthographic camera, light, frame, world scale,
   and anchor for every state. Preserve azimuth-to-file mapping. Add masks/depth
   only for a concrete renderer use.
7. **Package repeatably.** Keep sources, models or their recorded storage location,
   captures, compressed runtime images, contact sheets, and manifest/provenance.
8. **Compare in game.** Inspect scale, registration, state identity, fringes,
   occlusion, team masks, and view transitions before default adoption.

## Variants and metadata

Use separate models when state changes silhouette or painted materials. Team
color alone can use a verified mask/material variant; inspect every view after
recoloring. Track state, team, and direction separately and never substitute a
finished frame for unsupported construction without declaring that limit.

The manifest records frame dimensions, pixels/world unit, gameplay-footprint
reference, visible bounds, anchor, camera, thresholds, team treatment, source
links, hashes, task IDs, and spend. Asset bounds do not create gameplay occupancy.

## Town Center example

The [finished pilot](../assets/buildings/town-center-meshy-review-v1/README.md)
used eight 45° azimuth steps, 46° camera elevation, and 640 × 640 frames. Its
source model had 2,233,210 triangles/93,827,260 bytes; the optimized model had
98,940 triangles/55,713,384 bytes. Its generation plus remesh consumed 35 credits.

Four additional state pairs consumed 140 credits. The
[lifecycle pack](../assets/buildings/town-center-lifecycle-meshy-v1/README.md)
contains five states × eight color views plus matching team masks. The recorded
175-credit total is historical spend, not a quote for future jobs.

Gameplay selects captured Town Center views and masks with procedural fallback.
Town Centers currently expose only Complete. Other lifecycle states are review
coverage until the simulation supplies them. The Building Variant Atlas compares
these captures with direct sprites and concepts.
