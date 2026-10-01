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

`groundTexture(name)` caches and loads one global texture per material name.
Thus a `dirt` patch uses the same painted pixels in every zone. Ground paints
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
orientation. Further authored views are in production. Its pixels and alpha are
retained in the [source pack](../assets/environment/vaelora-region-kits-v2/README.md);
it is not loaded by the game yet.
