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
Starting landmarks use Complete; constructed Town Centers supply live progress
and health for construction, damage and repair. The Building Variant Atlas
compares these captures with direct sprites and concepts.

## Frontier Town Center handoff checklist

The newer [Frontier scale pilot](../assets/buildings/frontier-civilization-scale-pilot-v1/README.md)
is a different architectural family from the default lifecycle pack above.
Its approved Complete source is ready for further authoring, not default adoption.

| Input or review | Exact contract and present evidence | Still needed |
| --- | --- | --- |
| Complete source | [Concept](../assets/buildings/frontier-civilization-concepts-v1/town-center.png); pilot `model-provenance.json`, `town-center-measurement.json`, and `captures/town-center-complete-view-00` through `07` PNG/JSON pairs. Eight PNG hashes/dimensions match the capture manifest. | Original ignored `meshy_output/town-center.glb` is absent in this cloud checkout; retrieve the recorded approved source before model-based derivation. |
| Lifecycle coverage | Foundation at incomplete progress ≤27.5%; Frame above 27.5% and below completion; completed Critical HP ≤30%, Damaged above 30% through 60%, otherwise Complete. Complete/repair uses the live captured mapping in `src/captured-building-art.mjs`. | Matching Foundation, Frame, Damaged and Critical art: eight directions each, preserving this civic design. The older pack's forty frames belong to another design. No persistent ruins state is required. |
| Registration | Shared orthographic 46° elevation; azimuths 0–315° in 45° steps; 1024×1024 canvas, 128 pixels/world unit, ground pivot `[512,647.1527325565025]` from top left. Each state uses the same frame, scale, lighting and grounded pivot. | Registered new state captures and actual image/mask alignment checks. Declared metadata alone cannot establish pixel alignment. |
| Ownership | Small owner standards: straight-cut Azure/bar/square; forked Ember/split/diamond. Cultural ochre stays neutral. Color and aligned mask references are separate, with recorded SHA-256. | Correct standard shapes and masks for every supported state/view; current eight views have none. Generated grain emblems/forked blue pennants are illustrative, not approved faction insignia. |
| Physical scale | Measured Complete lower base 4.40×4.24 units inside registry 5×5 occupancy; about 1.913× the pilot House width. Human Worker `cast-human-sprite-v3` declares height 1.4258738550646552; its loader uses `heightWorld / maxAlphaHeight`, visibility scale and the selected frame pivot. Alpha bounds do not define collision or doorway size. | Door/exit review beside that actual selected Worker, including equipment and accessible neighboring cells. A 0.8-unit ruler and older Worker manifests do not establish this role's clearance. |
| Runtime acceptance | Opt-in full-checkout preview; Complete-only state fallback is implemented. Pilot files are absent from the hosted release. Historical preview screenshots remain dated evidence. | Both teams at ordinary 0.91/strategic 0.48 zoom; construction, damage/repair, view transitions, fog, nearby units, exits and terrain contact on a named build/map. Packaging/default adoption is a separate future slice. |

Resolve the missing state designs, standard treatment and doorway/terrain
readability through art review; none is supplied by a metadata pass. See the
[style guide](frontier-civilization-art-style.md) and
[atlas plan](building-atlas-production-plan.md) for the existing briefs.

`node scripts/validate-building-lifecycle.mjs MANIFEST` checks declared state/view
coverage, usable shared camera metadata and paired color/mask references. Add
`--require-lifecycle --require-team-masks` when checking a full-family handoff.
The current Frontier Complete-only manifest intentionally fails full admission;
the older default pack has all five states and forty mask references. This check
does not read image bytes or certify mask pixels, physical scale, provenance,
appearance, packaging or runtime adoption. Keep the capture/hash checks and
in-game review alongside it.
