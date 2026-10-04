# Building sprite-atlas production plan

[Art lanes](art-production-lanes.md) · [Model/capture pipeline](building-asset-production-pipeline.md) · [Sprite contract](sprite-atlas-contract-v1.md)

Original proposal, 30 September 2026, inspected at local revision `d595708`.
Current building checkpoint, 4 October 2026: source
`53a47ee379660f30b65776ea813f3a986d29aa37`, compared with fork main
`e7b99ae726fbb5bac3d31da64913c9b630f997cc`. The eight Complete manifests,
64 PNGs and shared selector/captured/direct helpers are unchanged between them.
This reconciliation changes documentation only; it produces no new art.

## Current outcome and next gaps

All eight original Frontier **Complete-only** families are default-bound in
[`src/frontier-building-preview.mjs`](../src/frontier-building-preview.mjs).
The reported manual staging deployment `e104638c-2c8b-433b-8928-7b53a8f3494e`
uses source `53a47ee379660f30b65776ea813f3a986d29aa37`. Read-only Railway
inspection on 4 October verified terminal `SUCCESS` at 13:29:02 UTC and one
running replica for `game` in staging. The [adoption checklist](asset-adoption-checklist.md#building-deployment-follow-up--4-october-2026)
records the exact identity and remaining delivery/appearance boundaries.
Deployment metadata does not prove browser asset bytes or ordinary-game pixels.

The Complete production/binding queue is finished. The building workstream
retains these distinct unfinished outcomes:

| Gap | Current behavior/evidence | Next bounded action |
| --- | --- | --- |
| Matching construction and damage | Each new family has only Complete: no matching Foundation, Frame, Damaged or Critical views. Missing states select older Town Center lifecycle, direct military or procedural fallback. | Derive and register one family's missing states from its preserved design/source after reviewing the existing Complete at game size; retain explicit fallback until then. |
| Destruction presentation | A removed building's visual group is disposed; no matching collapse/ruins animation or persistent ruin contract is implemented. | Select a bounded collapse presentation only when its lifecycle/removal cue is defined; verify destruction/rebuild with current behavior first. |
| Worker clearance and scale | Source dimensions and pivots are measured; the pilot's 0.8-unit ruler is not the selected runtime Worker. Storehouse height and the taller/narrower Barracks remain review points. | Inspect actual Workers at doors, bays and production exits, front/rear and at both zoom levels; record observed defects before refitting art. |
| Ordinary-game lifecycle and occlusion acceptance | No completed eight-family ordinary-game capture is recorded in the [owned recipe](qa-frontier-building-adoption.md). CPU depth/feedback tests and source sheets do not establish pixels. | With the cloud testing owner, qualify the supported cloud renderer, then inspect one paid Barracks on the flat acceptance map at an identified served build: both seats, construction, damage/repair, front/rear Workers, team standards and removal. Follow with raised-ground contact and fog reveal/hide on the raised/fog map. |

The immediate scoped step is the last row's **existing-art paid Barracks
acceptance**, using the [ordinary-game recipe](qa-frontier-building-adoption.md)
and [cloud capability contract](testing-strategy.md#start-here). Mac testing is
stopped and is not a dependency. The recorded cloud renderer/staging blockers
remain open until the cloud testing owner supplies linked capability evidence;
a probe alone does not close game appearance. This doc slice starts no generation,
new art publication, paid job, runtime change or deployment.

## Reference found and reviewed

Historical 30 September inspection: downloaded references were in
`/Users/lb/Downloads`. Those Mac-only files have not been re-inspected in this
cloud reconciliation:

- `City_Builder_Village_Buildings_part_1/` and `City_Builder_Village_Buildings_part_2.zip`: 25 village designs including houses, village hall, longhouse, stable, granary, lumber shed, watchtower, windmill, watermill, farmhouse barn, forge and market stall.
- `castles_pack_part_1.zip`, `castles_pack_part_2.zip`, `castles_pack_part_3.zip`, and `castles_pack_extra.zip`: castle, palace, manor and fortress families. Inspected archive listings contain 75 named designs in parts 1–3 and 20 in extra.

Visually inspected the village timber-frame house rotation sheet, the Rajput palace rotation sheet from castle part 1, and our current Town Center eight-view contact sheet. The village pack's README identifies polyy.ai generation and specifies an 8 × 4 grid with 32 azimuth views, 11.25° apart, at 30° elevation. It offers nine grid resolutions, three lighting choices, palette variants, aligned normal/height maps and transparent backgrounds. The castle example also visibly contains 32 views; its precise camera/scale contract still needs confirmation before reuse.

The reference demonstrates reusable direction sheets and strong architecture families. Its `1x1` village labels normalize every design to one reference tile; they do not establish physical scale relative to our Workers or our 3/5-cell gameplay footprints. Our camera uses 46° elevation. Do a camera comparison before importing reference pixels. Preserve source/license provenance if any downloaded pixels enter a runtime pack.

A **sprite sheet** is the regular grid of views/states. A **texture atlas** is the packed runtime texture, possibly with differently sized rectangles. A **building sprite pack** includes those images, manifest, masks, pivots, source and previews. Plan one pack per building, with independently packable atlas pages; avoid one enormous sheet for the whole roster.

## Roster and retained design briefs

`src/gameplay-definitions.mjs` defines thirteen buildings, including Palisade Wall/Gate, the food-only Mill, finite Farm and shoreline Dock. Mill, Farm and Dock use the [registered economy lifecycle family](../assets/buildings/frontier-economy-models-v1/README.md) by default, with procedural House failure fallback and [identified game acceptance](qa-frontier-economy-art-2026-10-04.md). The original eight-building concept family is default Complete art; lifecycle completion remains its own outcome. Footprint is square occupancy in world cells, not image canvas size. `src/main.js` passes live building state to the captured helper; older Town Center and direct Barracks/Range artwork remains fallback. Some pack READMEs describe earlier static-center behavior; current code and expansion/repair rules own coverage.

| Original proposal order | Building | Current footprint | Gameplay identity | Retained art brief and useful reference |
| --- | --- | --- | --- | --- |
| 1 | Town Center | 5 × 5 | Workers, resource drop-off, population, Tier II research | Civic anchor: broad main hall, secondary wing or arcade, prominent entrance/plaza and raised central feature. Village hall/longhouse plus restrained manor/keep massing. Rework scale and silhouette first; existing five-state/eight-view captures are a baseline. |
| 1 | House | 3 × 3 | Population | Clearly smaller domestic cottage, one principal roof and chimney. Thatched cottage/timber-frame house. Produce alongside Town Center as the scale control. |
| 2 | Storehouse | 3 × 3 | Food and wood drop-off | Broad loading opening, covered bay, crates/logs and grain storage. Granary/lumber shed. Must read differently from House. |
| Later | [Mill brief](frontier-mill-art-brief.md) | 3 × 3 | Food-only drop-off; provisional 75 wood / 15 seconds / 1,000 HP | Distinct eight-direction Mill art and construction/damage are default; static sails satisfy the initial brief. Rotation requires a separate layer/clip. Artwork does not change its drop-off rules. |
| Later | [Finite Farm](farm-finite-planting.md) | 3 × 3 | Owner-harvested 200-food pool; provisional 60 wood / 15 Worker-seconds / 600 HP | Distinct field/shed art has construction/damage and separate exhausted variants; no growth or automatic replanting. |
| Later | Palisade | 1 × 1 | Paid defensive blocker | Existing procedural wall profile; finished connection and lifecycle art belongs to the wall outcome. It is outside the original eight-building concept family. |
| Later | [Palisade Gate](palisade-gates.md) | 1 × 1 | Paid manually operated passage | Procedural open/closed leaves share the Wall profile; no finished Gatehouse artwork is claimed. |
| Later | [Dock foundation](dock-shoreline-foundation.md) | 3 × 3 dry land beside water | Paid shoreline producer of provisional Skiffs; no drop-off or population | Distinct landing/boathouse art has construction/damage. The visible landing changes no collision, derived berth or vessel rules. |
| 2 | Stable | 3 × 3 | Scout/Rider production and mounted research | Open stalls, paddock cues, hay and tack; recognizable horse-scale entrances. Reference stable. |
| 2 | Workshop | 3 × 3 | Siege production and engineering | Wide assembly bay, beams, wheels and unfinished machinery. Forge/longhouse vocabulary; distinguish from a domestic smithy. |
| 2 | Watchtower | 3 × 3 | Ranged defense and sight | Narrow elevated platform with strong vertical silhouette. Reference watchtower; tall does not mean a broad civic base. |
| 3 | Barracks | 3 × 3 | Infantry/Spearman and military research | Military hall, weapon racks, training frontage and banners. Retain useful existing identity; bring camera/scale/directions into the shared contract. |
| 3 | Archery Range | 3 × 3 | Archers and fletching research | Open shooting lanes, targets and canopy. Retain current useful design; targets must survive strategic zoom. |

The order above is the retained 30 September design proposal, not an outstanding
Complete queue. All eight Complete concepts and capture families now exist.
Mill/Farm/wall/Gate/Dock remain separate outcomes; they do not enlarge the
original eight-family lifecycle accounting.

The concept family is preserved in the architecture wiki, and eight new
Complete families have default bindings. The military pair has original local
models/captures; older direct sprites remain state/loading fallback. Follow the [Barracks/Archery Range replacement plan](frontier-barracks-range-authoring.md)
for source limits, ordinary-game acceptance and full lifecycle
ownership. Older construction GLBs and Range atlas candidates are retained
comparisons, not matching production models of the new concepts.

## Current scale evidence and remaining clearance review

The earlier player observation that Town Center looked small and house-like
motivated the civic-hall scale pilot. The new eight-family Complete contract is
1024 × 1024 at 128 pixels/world unit: an eight-unit canvas, orthographic 46°
elevation, eight 45° azimuths and ground pivot approximately `(512, 647.153)`.
The old 640-square/five-unit captures and five-unit direct military sprites
describe retained fallback lineage, not the new Complete canvas. Canvas width
does not establish visible building width or gameplay occupancy.

The [pilot's measured lower bases](../assets/buildings/frontier-civilization-scale-pilot-v1/README.md#measured-registration)
are Town Center 4.40 × 4.24 and House 2.30 × 2.95 world units; their X-width
ratio is 1.913. The [support-family capture record](../assets/buildings/frontier-civilization-models-v1/README.md#delivered-evidence)
retains Storehouse/Workshop 2.8-unit and Watchtower 1.8-unit width targets and
Stable's adjusted 2.75-unit width target. Both military bases measure
approximately 2.8 × 2.8. These are source registration facts, not doorway,
terrain-contact or player-recognition acceptance.

Make the remaining ordinary-game comparison with the actual selected Worker,
House, Town Center, Barracks and Watchtower. Show occupancy outlines, ground
anchors, doors and visible bases at normal and strategic zoom on flat/raised
ground. Keep camera, lighting and density identical; do not resize each object
to independently fill the same square.

Retained starting targets from the original proposal, subject to that review:

- House visible ground base: about 2–2.5 world units across, contained within its 3-cell occupancy.
- Ordinary production/drop-off buildings: about 2.5–3 units across; distinguish their yard/open-space allocation.
- Town Center visible ground base: about 4–4.5 units across within its 5-cell occupancy, roughly 1.7–2 times House width. Use wings and a civic entrance so enlargement also changes identity. Give its central mass more height than House, without requiring it to exceed Watchtower height.
- Watchtower base: about 1.5–2 units across, with height carrying recognition. Keep its full silhouette in a taller canvas if necessary.
- Calibrate doors and bays against the actual Worker/Rider art; do not establish a second incompatible human scale.

Measure visible alpha bounds and modeled ground dimensions separately. A projected image width includes height and perspective, so alpha width alone is not a ground-footprint measurement. If the enlarged Town Center needs a larger canvas, enlarge the canvas at the same pixels/world unit and update anchor metadata. Never grow collision implicitly from image bounds. Verify that decorative overhangs do not conceal accessible exits or neighboring occupancy. Scale correction may require model redesign/re-capture, not merely a sprite multiplier.

## Views, states and runtime packaging

Use the existing preferred model-to-capture workflow: complete concept → matched lifecycle concepts/models → shared orthographic capture → manifest and runtime images. Start with eight azimuths at 45° intervals and 46° elevation, matching the Town Center convention. Review view switching before choosing 16 or the reference pack's 32 views; additional directions multiply all states and masks.

Current delivery is eight manifests plus 64 Complete PNGs: 72 requested runtime
paths, with their source hashes verified at both checkpoint revisions. Full
matched Foundation, Frame, Complete, Damaged and Critical coverage would be
five states × eight directions = 40 color frames per type, 320 across the
original eight. The missing four states account for 256 views. Team treatment
needs explicit per-view review; live standards already carry ownership. Add
aligned masks only where that method is useful and verified, rather than
assuming 320 mask frames are mandatory. Atlas count follows measured memory;
coverage is not a generation-call or required texture count.

Record actual simulation progress/HP mapping per pack. The captured selector
uses incomplete progress ≤27.5% for Foundation, later incomplete progress for
Frame, completed HP ≤30% for Critical and ≤60% for Damaged. New Complete art
returns above 60% HP after repair. Missing states fall back; direct military
fallback instead uses <20% / <90% construction and ≥66% / ≥33% health bands,
including old Complete art late in construction. Preserve these distinctions
until matched states are supplied. Derive new states from the same design with
registered camera, scale and pivot. Ruins, fire/smoke, doors and production
clips are optional later layers tied to supported cues; destroyed persistence
is not implied. Keep selection, health, rally and queue feedback in the renderer.

The captured helper already selects directions for all eight Complete families
and loads individual frames. Packed-atlas sampling remains future renderer
work. Keep individual compatibility frames if introducing atlas pages, and
verify the actual consumer before calling an atlas integrated. Use the existing
sprite contract for bounds, pages, clips, pivots and provenance.

Keep lighting/palette alternatives as source experiments rather than multiplying the entire runtime family. Start with one coherent Frontier architectural kit and team accents; Vaelora regional architecture is a later variant outcome.

## Future buildings: separate design briefs

These are absent from the current building registry. Prepare reference boards or complete concepts when their gameplay roles are selected; defer full lifecycle atlases until footprints and states are known.

| Candidate | Proposed role to resolve | Reference/design direction |
| --- | --- | --- |
| Lumber camp | Dedicated wood economy, if distinct from Storehouse | Lumber shed, log piles and covered cutting bay. |
| Blacksmith | Dedicated upgrade building, if research moves from producers | Forge, chimney and open work area. Current forging research does not imply a separate implemented smithy. |
| Market | Trade/economy function | Market stall/courtyard. |
| Castle/Keep | Major defensive or advanced-production role | Selected keep/castle family; substantially stronger fortified identity than civic Town Center. |
| Future walls and Gatehouse | Defense beyond the registered Palisade Wall/Gate | Larger fortified gatehouse and wall families need selected gameplay roles and footprints. The one-cell manual Gate is listed above. |
| Temple and specialty buildings | Only after a gameplay role is selected | Chapel/shrine references; no full production queue yet. Dock's implemented shoreline foundation is listed above. |

## Delivery sequence and review evidence

1. Qualify the supported cloud renderer once under the testing strategy. If it
   remains blocked, retain the specific failure/owner and continue source work;
   do not substitute preview or CPU evidence for ordinary-game acceptance.
2. Verify actual served selector/helper/manifest/image bytes against the
   identified staging source, then run the bounded paid Barracks check above.
   Keep existing source galleries and originals; add real game receipts when obtained.
3. Extend the same paid acceptance to the other seven families, including
   actual Worker clearance, both teams/zooms, view transitions, fog, raised
   ground, production exits, selection, rally and queue feedback.
4. For one family, produce matching Foundation/Frame/Damaged/Critical coverage
   from available authorized sources and verify boundary transitions, repair,
   cancellation and destruction/rebuild. The six earlier editable GLBs are
   recorded as ignored local sources and are not in the tracked cloud checkout;
   public military scripts/provenance are available. Source availability must
   be resolved before promising those six lifecycle captures.
5. Define and review collapse presentation separately from the four missing
   states. Measure decoded texture memory and native draw cost on a mixed
   settlement before atlas packing, extra directions or new effects. The
   [body-depth fixture](qa-building-occlusion-native-plan-2026-10-03.md) is a
   cost/appearance comparison, not ordinary-game acceptance.

The “remaining six Complete families” task is obsolete. No new paid model
purchase is implied. Worker v1/v2/v3 declare 0.9385/0.8933/1.05-unit heights;
the pilot's 0.8-unit ruler remains approximate. See the
[style guide](frontier-civilization-art-style.md#worker-scale-evidence) for actual
runtime scaling and the [architecture wiki](lore/frontier-architecture.md) for
preserved concepts, original captures and their evolution.

## Reusable capture admission

`node scripts/build-frontier-complete-manifests.mjs` verifies each model family before producing renderer metadata: eight unique 45° directions, consistent orthographic camera/density/canvas, grounded pivots within numerical tolerance, measured uniform scale, shared grounding/lighting, explicit frame paths and actual pixel-file SHA-256. The renderer tests include deliberate camera, pivot, scale, light, direction and path drift. A new civilization should satisfy this same contract before game bindings are added; passing it does not certify role recognition, doorway scale or missing lifecycle/team art.
