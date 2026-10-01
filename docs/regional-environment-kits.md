# Regional environment kits

[Art lanes](art-production-lanes.md) · [Selected ecology keys](art-direction/vaelora-v1/README.md) · [Runtime status](environment-pack-v1.md)

## Player observation and outcome

On 30 September 2026 the player identified clashing ground and prop colours,
homogeneous forests and repeated asset perspectives. Organic boundaries alone
do not address these problems. Each zone needs a complete, compatible environment
kit, composed and reviewed as a landscape rather than a collection of isolated
asset previews. The selected ecology keys remain the direction source.

The following names are production proposals. They do not establish new lore,
resource types or mechanics. A species name denotes a different crown, trunk and
branch architecture, not a recoloured copy. Existing regional assets are starting
samples, not evidence that the full kit is implemented.

## Audit of the current renderer

The pre-kit `groundTexture(name)` cached one global texture per material name.
Thus a `dirt` patch used the same painted pixels in every zone. The first
Underbough runtime pass below replaces that binding for its implemented roles. Ground paints
also select vegetation indirectly through the base material rather than an
explicit regional kit. Shared source textures cannot cover every regional
combination coherently.

Bellweather mixes regional maple/hedgerow with generic oak, pine and birch.
Underbough has copperleaf and bramble; Vesperra, Sombral Mere, Siltmouths and
Pale Meridian generally repeat a single regional canopy family. Seeded scale,
mirroring and small yaw variations cannot supply missing species or viewpoints.

The inspected lifecycle atlases have four harvest states, each with one
`fixed-oblique` frame. These are **state captures, not four rotated views**.
The packing script explicitly writes `directionId: fixed-oblique`. The previous
source documentation acknowledges that additional measured camera views are
not supplied. Keep this distinction visible in manifests and acceptance records.

There is an important older exception: the [Meshy oak, pine and berry pilot](../assets/environment/frontier-meshy-sprites-v1/README.md)
already supplies eight actual camera-orbit captures per model. The current
environment loader nevertheless loads only `runtime/{family}-01.webp` for
these families. Those intact-state captures do not cover the newer regional
species, and their older depletion art is separate. Preserve this usable
capture pipeline and its source hashes; neither its camera convention nor its
lighting is interchangeable with a model-rotation bake under the fixed game
camera. The directional deficit is both asset coverage and loader selection.

## Kit roster

| Zone | Cohesive palette | Four woodland tree forms | Shrubs and ground vegetation |
| --- | --- | --- | --- |
| Bellweather | Sage and muted olive, butter highlights, warm cream bark, quiet ochre soil | Field maple, broad oak, pear, slender ash | Hedgerow, hazel, meadow herbs and barley-edge tufts |
| Underbough | Deep olive moss, warm umber wood, restrained copper and burgundy | Copperleaf, rooted oak, moss hornbeam, old plum | Thornberry bramble, low hazel, bracket fungi and rootward fungus |
| Sereward | Peach mineral soil, dusty coral, grey olive plants; turquoise concentrated at water | Oasis palm, acacia, tamarisk, drought fig | Thorn scrub, succulent clusters, sparse dry grass |
| Ellionar | Honey soil/stone, cultivated olive green, warm copper; lapis reserved for crafted accents | Cultivated palm, cypress, olive, terrace fruit tree | Garden hedge, herbs, irrigated grass margins |
| Veyrholds | Slate stone, alpine olive, subdued rusty copper | Highpine, wind fir, alpine birch, mountain rowan | Juniper, low mountain scrub, ridgegrass and ironlichen |
| Pale Meridian | Blue-grey shadows, silver/frost highlights, restrained violet | Silver conifer, frost larch, low birch, hardy willow | Winter heath, cushion scrub, moss and lichen |
| Siltmouths | Sea green foliage, silver wood, muted lilac, grey tidal soil | Tidal tree, mangrove form, salt willow, marsh alder | Salt shrub, reed beds, marsh tuber foliage |
| Vesperra | Petrol/olive green, pale bark, deep cool shadows, sparse violet accents | Mistbark, buttress elder, umbrella laurel, hanging fig | Shade shrubs, ferns, fungi, restrained vine clusters |
| Sombral Mere | Deep teal, pearl bark, soft lavender accents, cool neutral shores | Merebloom, pearl alder, lakeside willow, teal birch | Wetland shrub, lunewort, mirelily and sparse reeds |
| Ru’Lora | Charcoal, dusty violet, ivory and cold opal; emerald only at living fringe | Interior: petrified crown, hollow column, rooted spire, splintered trunk. Fringe: living canopy, buttress tree, narrow laurel, rooted fig | Interior stone fern/dead brush; living fringe broadleaf, fern and shade shrub |

Ru’Lora interior and living fringe are distinct sub-kits. Four living tree
species must not be scattered through its canonically petrified interior.
High saturation belongs to local accents, not every canopy and ground plane.
Team and command colours retain their separate gameplay meaning.

The kit also owns compatible water/shallows, banks, rocks/cliffs, fallen wood,
ordinary resource-node vegetation and environment landmarks. A regional forest
next to a generic wood-node oak still creates a visible mismatch. Buildings use
their culture's materials while sharing the scene's lighting and ground contact;
units, team accents and objective feedback keep their required readability.

## Ground coverage

Author six compatible ground roles per zone: open/clearing ground, dense ground
growth, woodland litter/root soil, worn path/base soil, exposed stone, and wet
bank/shore. Cold or sterile zones substitute appropriate snow, scree or mineral
cover for grass. Each role needs at least two independently painted tiles once
the kit's palette works in a repeated in-game swatch. Variants should differ in
quiet small-scale detail without introducing another palette or bright motifs.

Resolve an existing map material through its explicit region's kit. Preserve
semantic material names and the saved map schema: `dirt` may render differently
in Underbough and Sombral Mere without changing passability. A mixed biome needs
an authored sub-kit boundary rather than a random global texture selection.
Cache keys include the kit and material. Missing files use a recorded compatible
fallback; absence must never silently import an unrelated zone's new assets.

## Woodland composition

Use habitat and species patches: dominant canopy groups, secondary groups on
different soil/moisture, sparse minor species, young edge growth and open glades.
Do not pick all four species uniformly and independently for every cell. Start
with approximate 45/30/15/10 abundance, then tune each zone's ecology and camera
readability. Shrub and understory density respond to margins, shade and water.
Resource nodes, harvest-cell identity, depletion and reset remain authoritative.

Underbough is the first complete pilot. Its current repeated bright copperleaf
canopy needs darker olive crowns and different trunk architectures, plus quieter
clearing ground and locally matched dirt/stone. Prove the four forms together
at both camera distances before expanding the same pipeline across the roster.

## Directional production

Capture four actual asset azimuths (0°, 90°, 180°, 270°) at the existing fixed
camera elevation and orthographic scale. Give asymmetric trees, shrubs, roots
and rocks independent views. Flat seamless ground does not need camera views.
Eight azimuths can follow if four fail the rotated-camera comparison.

For model sources these must be render captures of the same asset. For painted
sources they are explicitly **authored directional drawings**, reviewed for
identity, branch structure, size and lighting continuity; do not call them
measured 3D captures. Mirroring one frame or rotating its billboard is not a
directional deliverable. Avoid baking cast shadows or a ground platform into
transparent sprites.

Pack species × harvest state × direction. A stable seeded world orientation
belongs to the tree slot; the selected frame follows its relative camera angle.
All states/directions share the root pivot and logical scale. Repeated view
changes must not make trees change species, drift, flip their lighting or lose
harvest feedback. Decorative shrubs retain their own nonblocking ownership.

## Acceptance and publication

1. Compare the complete palette beside the selected key, with 3×3 texture repeats
   and all proposed tree/shrub families in one contact sheet.
2. Inspect a representative clearing, dense woodland and wet margin at normal
   and strategic zoom. Record exact kit, renderer, map and capture perspective.
3. Show distinct species and four genuine authored/captured azimuths. A frame
   count alone does not prove identity or perspective consistency.
4. Check normal/full, worked, low, depleted and reset states at the same roots;
   exercise picking and a live harvest. Decorative ground art cannot change routes.
5. Package useful source/runtime slices progressively, recording missing roles
   and viewpoints. Do not describe a palette study as integrated runtime art.

The first Underbough board is an art-direction study; new production textures,
species, directional frames and regional loader bindings remain to be completed.
The first dark olive Root Oak intact source now exists at the designated 0°
orientation. Further verified views remain outstanding. Its pixels and alpha are
retained in the [source pack](../assets/environment/vaelora-region-kits-v2/README.md);
the first runtime family record below now documents its loader.

### First ground runtime — 1 October 2026 UTC

Three new Underbough sources now supply clearing grass, worn earth and mossy root
soil. `src/regional-ground-kits.mjs` resolves meadow/short/long grass, dirt and
forest-floor by explicit map region. The semantic paint fields stay unchanged.
The same profile supplies representative colours for the border, minimap and
Studio diagram. Other regions retain their existing bindings. `?regionalGrounds=legacy`
provides a paired review of the old materials.

The [local browser evidence](qa-evidence/underbough-ground-kit-2026-10-01/renderer-proof.json)
checks all three consuming renderer paths, switching to Bellweather without a
texture-cache leak, legacy comparison and an unchanged map definition. Captures
cover both maps at normal and strategic zoom with no console/asset errors.
The three RGB WebP encodings total 1,758,626 bytes, preserve the source dimensions,
and use no repaint, crop or resize. This is local runtime evidence, not a staging
deployment or GPU capacity measurement. Texture repetition is reviewed through
the existing mirrored/stochastic sampler, not claimed mathematically periodic.

The Root Oak, Moss Hornbeam, and Old Plum provide three additional distinct intact painted
tree sources. Root Oak now has a fixed-view harvest-state runtime; Hornbeam and Plum still
need harvest states and registration. All three need verified model/directional
views before the requested coverage is complete. This first ground pass
does not complete the four-species forest or the ten-zone kit matrix.

### First mixed Underbough canopy — 1 October 2026 UTC

Root Oak now supplies a broad dark olive form beside Copperleaf and woody
bramble. Seeded spatial groves vary its proportion across the forest while
every existing wood cell retains one harvest slot. All four fixed-view states
use registered atlas frames. [Current browser evidence](qa-evidence/underbough-root-oak-2026-10-01/underbough-rootways-renderer-proof.json)
records 1026 original cells, species counts, unchanged roots and atlas selection
through full/worked/low/depleted/reset. Vesperra is the unchanged control.
This is renderer interface evidence; a new actual worker-harvest observation
and the complete four-species directional kit remain outstanding.

### Root Oak live harvest — 1 October 2026 UTC

[Real worker evidence](qa-evidence/underbough-root-oak-live-2026-10-01/live-harvest-proof.json)
at source `5c9771e8` verifies Root Oak cell 646 through worked (3.900002), low
(1.900004), depleted (0) and reset. The renderer verifies the target family
before the gather order. The worker delivers six wood; captures include full,
worked, low, depleted and restored tree appearances. This closes the outstanding
live-harvest check for the first Root Oak runtime, not directional coverage.

### Three-tree woodland runtime — 1 October 2026 UTC

Moss Hornbeam adds a taller airy form with lighter grey bark.
[Renderer evidence](qa-evidence/underbough-hornbeam-2026-10-01/underbough-rootways-renderer-proof.json)
records 391 Root Oaks, 311 Hornbeams, 241 Copperleaf and 83 brambles in the
original 1026 cells. Four-state selection, roots and reset pass for every family;
Vesperra is the unchanged control. Plum and directional coverage remain unfinished.
The normal-scale capture also reveals that the map uses forest-floor soil in its
open clearings: the next composition correction is grass in clearings with
shaded root soil under woods. A cohesive texture collection alone does not
correct an unsuitable material-role assignment.

### Grassy clearings and shaded woodland — 1 October 2026 UTC

Underbough Rootways now authors meadow as its base instead of forest-floor.
The existing regional kit supplies muted clearing grass; the forest mask still
adds mossy root soil beneath woodland. `groundBaseMaterial` drives the ground,
border, minimap and Studio default, while `environmentTheme` keeps Underbough
vegetation tied to the region when its base is grassy. Other map fields,
settlement wear, routes and resource rules are unchanged.

[Paired current evidence](qa-evidence/underbough-clearing-ground-2026-10-01/renderer-proof.json)
compares the previous soil base and grass base with the same current kit,
map and cameras. It verifies the actual base texture, shaded root-soil texture,
all existing regional families, cache isolation and unmutated render input.
Normal and strategic captures include Bellweather as an unchanged control.
The saved `legacy` layout images mean previous soil assignment using the same
kit; they do not mean global legacy textures in this capture mode.

### Four distinct Underbough tree forms — 1 October 2026 UTC

[Current four-tree evidence](qa-evidence/underbough-four-trees-2026-10-01/underbough-rootways-renderer-proof.json)
records Root Oak 314, Hornbeam 230, Old Plum 207, Copperleaf 192 and bramble 83,
with all 1026 original wood cells and root positions preserved through harvest
state selection and reset. Wider and closer captures use the clearing grass
and shaded root-soil treatment. Each form has full/worked/low/depleted art.
These four states still supply one fixed painted view, not directional coverage.
Additional shrubs, texture roles/variants, other zones and true perspectives
remain unfinished.

[Live worker proof for all three new families](qa-evidence/underbough-family-harvest-2026-10-01/summary.json)
uses renderer-selected visible targets and verifies each family before the gather
order. Root Oak, Hornbeam and Plum reach worked, low, depleted and reset, with
no console or asset errors. This extends the initial Root Oak observation to
the current four-tree distribution.

### Model-derived directional pilot — 1 October 2026 UTC

[The existing-model perspective pack](../assets/environment/frontier-meshy-fixed-camera-v2/README.md)
contains 24 verified views: oak, pine and berry bush, eight model headings each.
Camera, lighting, scale and pivot remain fixed. This is a source pack; runtime
selection and the painted regional families' directional coverage remain
unfinished. Source hashes, provider provenance and exact RGBA atlas/frame
validation are retained. No new paid provider generation was used.

### Existing-model heading selection — 1 October 2026 UTC

The renderer now buckets generic oak and pine instances into eight model-derived
headings using each original cell as the stable seed. Their sprite cards remain
camera-facing and unflipped. Regional painted families retain their own kits.
[Actual renderer evidence](qa-evidence/resource-directions-2026-10-01/renderer-proof.json)
records all 394 original review-map trees, eight headings per family and exact
instance-matrix restoration after depletion/reset. The fixture loads the real
renderer and assets in Chrome and saves its rendered grove. This is renderer
integration evidence; it does not prove a full-match worker observation or
regional painted-tree directional coverage. Berry headings remain source-only.

### Resource-node heading selection — 1 October 2026 UTC

Full berry and oak resource-node instances now select actual model headings
from their world positions. A per-instance atlas rectangle preserves existing
slot indices and stage updates. Harvest states still use their existing fixed
painted views; intact directional coverage does not claim rotated harvest art.
The renderer preserves its directional atlas when asynchronous lifecycle art
finishes loading. [Berry renderer evidence](qa-evidence/resource-node-directions-2026-10-01/renderer-proof.json)
records 32 instances spanning all eight headings, exact depletion/reset matrix
restoration and atlas survival after real lifecycle loading. A Chrome capture
checks the compiled instanced shader. Full-match worker and staging observations
remain separate unfinished evidence.

### Full-game resource harvest observation — 1 October 2026 UTC

[Live game evidence](qa-evidence/directional-live-harvest-2026-10-01/proof.json)
records real workers gathering six food and six wood from berry/oak nodes,
worked/low/depleted appearances, reset, reload, successful directional atlas
requests and no browser errors. Captures use the full game camera and renderer.

The appearance review exposes a remaining scale problem: the fixed-camera oak
reads like a small shrub next to workers. Its recorded fitScale is 0.687358
and normalized height 1.87248 world units, versus the older orbit capture's
0.962782 fit and 2.62279 height. Berry fit similarly drops from 0.932050 to
0.665418. The new fit projects every corner of each rotated axis-aligned box;
those hypothetical corners can exceed the actual mesh silhouette. Correct the
fit using actual projected geometry and review shared scale across headings,
retaining the source model, camera and ground pivot. Successful harvest checks
do not resolve this observed art limitation.

### Measured model fit correction — 1 October 2026 UTC

The [v3 capture pack](../assets/environment/frontier-meshy-fixed-camera-v3/README.md)
replaces projected axis-aligned box corners with every actual mesh vertex,
transformed at each of eight headings. One union bounds calculation supplies
one shared scale per family. All 24 views pass unclipped-frame, distinct-view,
exact RGBA atlas/WebP and original-source hash checks. V2 remains intact.

Oak height rises from 1.87248 to 2.72417 world units; berry height from 0.77023
to 1.15752. Pine fits at 5.08549 world units. Fixed camera, world lighting,
source geometry and ground pivot are unchanged. Runtime instances and atlases
now consume v3. The release scenario verifies exact HTTP hashes from Docker
COPY output. [Repeated full-game evidence](qa-evidence/directional-fit-live-2026-10-01/proof.json)
passes real worker harvesting, reset and reload without browser errors; the
same-camera full capture shows the scale correction beside workers.

### Underbough dense ground growth — 1 October 2026 UTC

A fourth regional ground source supplies denser low moss/grass in the same
restrained olive/umber palette as the clearing texture. The original generated
PNG, exact prompt, reference and hashes are retained beside a dimension-preserving
RGB WebP export. The generated master is 1254×1254; no crop, resize or repaint
was applied. `long-grass` now resolves to this material in Underbough, while
meadow and short grass retain clearing grass. Representative diagram colour is
the measured source mean, #574a1e.

[Repeated renderer swatches](qa-evidence/underbough-dense-ground-2026-10-01/renderer-proof.json)
verify separate clearing/dense roles, unchanged map definitions and the original
Bellweather long-grass material after switching regions. Native Chrome compiled
and rendered the actual ground sampler without errors. This is an authoring
material; Underbough Rootways currently contains no long-grass paint, so this
slice does not claim new shipped-map placement. Seamless-style source generation
and stochastic sampling are visually reviewed, not a mathematical periodicity
claim. More ground roles/variants and regional perspectives remain unfinished.

### Authored dense woodland margins — 1 October 2026 UTC

Underbough Rootways now paints its dense-growth role along existing forest
margins: 568 cells, recorded as 234 row-run rectangles. A soft rendered blend
and irregular outer sampling follow the already authored tree line. Clearings
and paths retain a one-cell paint buffer; resource nodes and spawn points have
three world units of exclusion. The original 59 paint rectangles remain intact
and override any lower-priority growth paint. All non-paint map fields remain
unchanged, including all 1026 wood cells and their resources.

[Paired full-game captures](qa-evidence/underbough-woodland-ground-2026-10-01/capture-report.json)
compare previous clearing paint and the new margins using the same regional
kit, map and cameras, with Bellweather as a control. Native Chrome checks actual
texture selection and cross-region cache isolation without browser errors.
The `legacy` filenames in this dated evidence mean previous paint placement,
not global legacy textures. [Authored paint evidence](qa-evidence/underbough-woodland-ground-2026-10-01/authored-paint-proof.json)
records the original map hash and invariants. Reachability, terrain blending,
and settlement checks pass; the historical settlement baseline is retained,
with separate assertions that dense growth follows woods and preserves paths,
blockers, mirrored composition and all match rules. The transition is subtle
at strategic distance. Further regional source roles, variants and perspectives
remain unfinished.

### Cohesive Underbough wood resource nodes — 1 October 2026 UTC

Standalone wood nodes on explicitly Underbough maps now use Root Oak instead
of the generic golden model oak. The renderer reuses the same registered
four-state forest atlas, world dimensions and fixed painted view. Each stage
mesh retains the resource-node instance indices; ordinary stock transitions
change visibility/scale without moving roots. If atlas metadata is unavailable,
the existing individual Root Oak state textures are the fallback. Regional
state art does not depend on the generic interactive-resource manifest's
availability. Other regions and the model-review map retain generic artwork.

[Actual renderer frame evidence](qa-evidence/underbough-resource-oak-renderer-2026-10-01/proof.json)
checks all four stage rectangles, reset matrices and control definitions. The
[full-game worker observation](qa-evidence/underbough-resource-oak-2026-10-01/proof.json)
loads the regional atlas, captures harvest states, reset and reload, and records
no browser errors. This uses existing palette-matched artwork; it adds no new
species, provider generation, resource rules or directional frames. Root Oak
still has one painted perspective. True regional directions, palette-matched
ordinary resource plants in other zones, and additional ground roles remain
unfinished.

### Dominant Underbough species groves — 1 October 2026 UTC

The four forms previously mixed mostly independently per wood cell, so copper
crowns remained scattered throughout the forest despite modest oak-grove bias.
The shared composition selector now gives each jittered ten-cell grove a dominant
tree form, with 16% secondary selection and more woody scrub at true margins.
The terrain seed drives grove locations and species. It uses existing regional
art and keeps every authoritative cell and visible harvest root unchanged.
`?forestSpecies=scattered` preserves the previous composition for comparison.

On Rootways seed 93002 the new selection gives 395 Root Oaks, 468 hornbeams,
59 old plums, 51 copperleaf and 53 bramble slots, still 1,026 total. Same-species
neighbor agreement rises from 22.9% to 70.3%. These are descriptive values for
this authored map, not fixed species quotas for other seeds. The
[renderer comparison](qa-evidence/underbough-species-groves-2026-10-01/proof.json)
checks identical roots across compositions, all five families, representative
four-stage harvest/reset transforms, loaded art and unchanged map data.
The [full-game comparison](qa-evidence/underbough-species-groves-live-2026-10-01/capture-report.json)
records ordinary/strategic imported-match views and Bellweather controls without
browser errors. Grouped copper accents and larger quiet canopy groups were
visually inspected. This improves composition, not missing directional artwork
or additional species for other zones.

### Underbough exposed-stone role — 1 October 2026 UTC

Underbough `scree` now resolves to a dedicated shaded bedrock source: warm grey/
umber mineral detail and restrained olive moss, compatible with the clearing and
root-soil kit. Other regions retain their existing scree. Diagram, border,
minimap and Studio swatch colour use the source's mean RGB `#665336`. The
[registration record](../assets/environment/vaelora-region-kits-v2/underbough/shaded-stone-01-registration.json)
preserves original master, exact prompt, source/runtime hashes and RGB WebP
encoding; [six-source repeat review](../assets/environment/vaelora-region-kits-v2/underbough/ground-role-repeat-review-v2.png)
compares five implemented roles with two clearing variants.

Rootways has no authored exposed-stone paint; its shipped layout is unchanged.
The role is available when an Underbough author paints existing `scree` material.
The [Studio study](qa-evidence/underbough-stone-ground-open-2026-10-01/capture-report.json)
uses disposable copied maps with 64 irregular stone cells, comparing the global
ground kit with the regional kit at ordinary and strategic zoom and a Bellweather
control. This is material integration, not a new shipped stone area, raised rock
asset, collision rule or water mechanic. Wet bank/shore remains missing, and
non-clearing roles still need second source variants.

### Underbough wet-bank role — 1 October 2026 UTC

Underbough's existing `tidal-mud` paint now resolves to quiet damp woodland soil
rather than the shared Siltmouths tidal texture. It is an appearance mapping for
the wet-bank role, not a statement that the inland woodland has tides. The source
mean `#463419` also supplies its diagram, border, minimap and Studio colour.
The first candidate was rejected for recognizable leaves/roots; its original
and prompt remain alongside the revised smooth-soil master. The
[registration](../assets/environment/vaelora-region-kits-v2/underbough/wet-bank-01-registration.json)
records exact prompts, source/runtime hashes and RGB WebP encoding with no local
creative pixel editing or rescaling.

This provides first-source coverage for all six planned Underbough ground roles:
clearing, dense growth, root/litter soil, worn earth, exposed stone and wet bank.
There are seven accepted sources because clearings have two variants. The
[repeat review](../assets/environment/vaelora-region-kits-v2/underbough/ground-six-role-repeat-review.png)
compares them together. Only the clearing role currently has two independent
variants; the kit is not complete against the full variant/directional targets.

The [Studio comparison](qa-evidence/underbough-wet-bank-2026-10-01/capture-report.json)
uses copied Underbough/Bellweather maps with 64 exposed wet-soil cells beside a
small 32-cell water margin. No shipped layout is changed. The
[binding proof](qa-evidence/underbough-wet-bank-2026-10-01/renderer-proof.json)
asserts regional soil, retained Underbough canopy families, unchanged rendered
input, cache isolation, and a Siltmouths control retaining its own quiet mud.
The role adds no tide simulation, resource, elevation or collision behavior.

The same ordinary study reveals strongly angular small-water contours despite
the existing corner chamfers. Improve that renderer boundary using the exact
study map as a reproduction; soil palette coverage alone does not resolve it.

### Regional wood-resource palette selection — 1 October 2026 UTC

The resource-tree profile now covers ten existing forest palettes: Bellweather,
Underbough, Sereward, Pale Meridian, Siltmouths, Vesperra, Sombral Mere,
Veyrholds, Ellionar and Ru’Lora living fringe. Each explicit region selects its
existing canopy family, registered world dimensions and four harvest frames.
Generic model artwork remains the fallback for unknown/unset regions and the
model-review map. Ru’Lora's petrified interior has no compatible regional wood
lifecycle yet and is deliberately not assigned a living fringe tree.

[Forty renderer-frame observations](qa-evidence/regional-resource-trees-2026-10-01/proof.json)
verify family selection, stage rectangles, world dimensions, loaded textures,
reset matrices and boundary controls. [Sereward live harvesting](qa-evidence/regional-resource-sereward-2026-10-01/proof.json)
and [Pale Meridian live harvesting](qa-evidence/regional-resource-meridian-2026-10-01/proof.json)
cover real worker stock transitions, reset and reload on representative ground
palettes without browser errors. Existing Underbough live evidence covers its
profile. These are three observed live palettes, not ten full-match observations.
Release packaging, habitat and settlement checks pass.

This removes unrelated generic wood-node tree colours from the supported
regions. The reused regional artwork remains one fixed painted perspective;
no additional species or directional frames are claimed. Complete regional
ground variants, four-species canopies beyond Underbough, ordinary food-node
palettes and regional directions remain unfinished.

### Underbough thornberry food bush — 1 October 2026 UTC

Underbough food nodes now have a dedicated palette-matched shrub. Root Oak was
the brushwork/colour reference; the low olive/umber bush carries restrained
burgundy fruit. Full/worked/low/depleted states reduce fruit clusters while
retaining foliage and branches. The woody bramble asset is not reused: its
source explicitly excludes berries and its harvest art cuts stems.

The four original 1254×1254 generated PNGs and exact prompts are preserved.
[Registration and hashes](../assets/environment/vaelora-region-kits-v2/underbough/thornberry-registration.json)
record one shared crop, 1176×867 runtime frames, 1.8×1.32704 world units and
substantial-alpha ground contacts at source y1031–1032. WebP quality 90 exports
preserve cropped alpha exactly; no repaint or rescale is applied. Low-opacity
source pixels outside the registered crop remain in the original masters.
These are four food-stock states at one fixed painted perspective, not rotated
views or certified geometric camera captures.

[Renderer observations](qa-evidence/underbough-thornberry-renderer-2026-10-01/proof.json)
verify all four meshes, common dimensions, reset matrices and non-Underbough
controls. [Full-game worker proof](qa-evidence/underbough-thornberry-2026-10-01/proof.json)
loads every state, captures real food/wood gathering, reset and reload without
browser errors. Release packaging serves all four textures with exact source
hashes; habitat and settlement checks pass. Existing food locations, stock,
selection and economy rules are unchanged. Other regions retain generic food
artwork. Additional regional food plants, canopy species, ground variants and
true directional coverage remain unfinished.

### Root Oak side-view candidate — 1 October 2026 UTC

A second authored quarter-turn candidate uses explicit pruning-scar, scaffold
branch and root-buttress constraints. Its scars become occluded and its crown
narrows, providing stronger side-view cues than the earlier rejected drawing.
It remains source review only: opposite-view branch identity and common root
registration are not established. The [review record](../assets/environment/vaelora-region-kits-v2/underbough/root-oak-direction-review-v2.md)
states the remaining comparison. Requested angle is separate from accepted
direction in the manifest; accepted regional directional coverage remains zero.

The opposite-side follow-up rejects this pair: at equal visible height, the
requested 270-degree crown is 23.8% wider than the requested 90-degree crown.
This is a visual diagnostic, not a world-scale measurement, but branch continuity
and common geometry remain unproven. Preserve both originals and their
[comparison evidence](../assets/environment/vaelora-region-kits-v2/underbough/root-oak-direction-pair-review-v2.json).
Next establish a shared anatomical construction; do not derive harvest frames
from independent redraws that have not passed the intact-view comparison.

A [shared Root Oak construction proposal](art-direction/environment-camera-v1/README.md#root-oak-shared-construction-proposal--1-october-2026)
now supplies four projections of one connected 3D scaffold, named crown volumes
and root buttresses. It is an approximate drawing reference, not recovered
geometry or runtime art. Reconcile its zero-heading silhouette with the accepted
painted source before deriving a new directional set.

### Two-source Underbough clearings — 1 October 2026 UTC

A second independently generated clearing texture keeps the olive/umber palette
while removing prominent straw clumps and leaf motifs. Original source, prompt,
encoding, hashes and mean RGB are retained in its
[registration record](../assets/environment/vaelora-region-kits-v2/underbough/clearing-grass-02-registration.json).
The [3×3 source repeat sheet](../assets/environment/vaelora-region-kits-v2/underbough/clearing-grass-variant-repeat-review.png)
compares both originals; sources are not digitally recoloured or painted over.

Underbough `meadow` and `short-grass` now choose between the two sources at seeded
triangle-lattice anchors, using the existing continuous blend weights. Each
anchor selects one texture rather than explicitly sampling both sources.
GPU cost of dynamic sampler branching has not been measured.
The additional texture shares world-space UVs, scale and mip derivatives with
the first. Other regions and ground roles retain their own materials. Diagnostic
`?groundVariants=single` selects the prior source; mirror tiling also stays single.

[Renderer evidence](qa-evidence/underbough-clearing-variants-2026-10-01/proof.json)
checks successful compilation, loaded files, changed pixels, deterministic
reconstruction and unchanged map data. The
[full-game paired captures](qa-evidence/underbough-clearing-variants-live-2026-10-01/capture-report.json)
compare the same authored maps at ordinary and strategic zoom with a Bellweather
control, without browser errors. The new served WebP matches its recorded hash;
existing Docker wildcard packaging includes it. This completes two source
variants for the clearing role only; other role variants and regional kits remain
unfinished.
