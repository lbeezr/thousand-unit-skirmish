# Frontier Barracks and Archery Range replacement

[Architecture wiki](lore/frontier-architecture.md) · [Adoption checklist](asset-adoption-checklist.md) · [Capture pipeline](building-asset-production-pipeline.md)

The two military buildings still use the older artwork in normal matches.
The newer cream/oak/sage designs exist as preserved Complete concepts, but
neither has matching production models or captured runtime views. This is a
production gap before renderer adoption. Archery Range is a building that
produces Archers; the Archer unit and its combat behavior are separate work.

The building workstream owns replacement of **both** buildings through source
production, default binding, release inclusion, identified delivery and actual
gameplay verification. This source audit closes none of those replacement
steps. Acceptance for the six already adopted Frontier families remains open
under [PR141](https://github.com/lbeezr/thousand-unit-skirmish/pull/141) and the
[ordinary-game recipe](qa-frontier-building-adoption.md).

## Verified inventory · 3 October 2026

Inspected checkout `d063ad5dada38dbccdaa4321fb9f80eb9385aa40`, its tracked files,
the public Git tree at `00ff45d9702dfbcf9da6f6ac88e0ca4381e374dc`, both new
concept PNGs, both current Azure Complete WebPs and both older Blender Complete
preview PNGs. These asset directories and the two binding modules have no
changes between those revisions. This is source inspection, not a fresh
staging-browser observation. Mac-only uncommitted or ignored files are outside
this inventory; absence here does not prove their absence on the Mac.

| Stage | Barracks | Archery Range | What it establishes |
| --- | --- | --- | --- |
| Selected new design | [Concept](../assets/buildings/frontier-civilization-concepts-v1/barracks.png), 1432 × 1098 RGBA, 1,931,831 bytes | [Concept](../assets/buildings/frontier-civilization-concepts-v1/archery-range.png), 1312 × 1199 RGBA, 1,793,381 bytes | One illustrative Complete view each; saved and already embedded in the wiki. Exact prompts and output history remain in the [concept pack](../assets/buildings/frontier-civilization-concepts-v1/README.md). |
| Matching textured production model | None in the tracked source/capture packs | None in the tracked source/capture packs | New-design model production is incomplete. |
| Other textured models | [Construction GLB sample](../assets/units-buildings/frontier-barracks-construction-v1/README.md); earlier [v0.2 sample](../assets/units-buildings/frontier-glb-sample-v2/README.md) | [Construction GLB sample](../assets/units-buildings/frontier-archery-range-construction-v1/README.md) | Older locally authored source-review designs, with editable Blender files and an embedded project atlas; not models derived from the selected new concepts. |
| Other sprites/captures | [Current five-state direct pack](../assets/buildings/barracks-sprite-test-v1/README.md) | [Current direct pack](../assets/buildings/archery-range-sprite-v1/README.md) and [five-stage construction candidate](../assets/buildings/archery-range-construction-v1/README.md) | Current direct frames are usable older designs. The Range candidate is a retained comparison with an estimated pivot, no live binding and no damage states. |
| New-design registered views / renderer manifest | Absent | Absent | The two existing Frontier capture packs cover six other families. A loader switch cannot supply these missing assets. |
| Normal binding / release at `00ff45d` | `barracks-sprite-test-v1/runtime`: ten WebPs | `archery-range-sprite-v1/runtime`: ten WebPs | [Direct loader](../src/building-sprites.mjs) and [main factories](../src/main.js) select these packs; Docker explicitly includes them. The [Frontier selector](../src/frontier-building-preview.mjs) has no entry for either building. |

The two concept SHA-256 values match their existing manifest:

- Barracks: `2b607b401d2e20c1eb586360590ab9cd1a2bfc1c60373675e5df3ec24e5f8557`.
- Archery Range: `728caf60da4e74d8c29d99b0503a0d0d08230e33f0866c202e795a74f141a910`.

The construction GLB headers and embedded JSON were inspected directly. Barracks
is 176,480 bytes; Range is 174,620 bytes. Each has eighteen nodes, eight meshes,
two materials and one embedded PNG atlas. Their authoring manifests explicitly
declare `source-review-only` and `runtimeReady: false`; they are not compatible
renderer manifests. Declared bases are 3.2 × 3.2 units, whereas current gameplay
occupancy is 3 × 3 cells. Those declarations do not replace a geometric scale or
clearance review. No gameplay GLB consumer or new-design capture follows from
the existence of these files.

## Pixel observations and design corrections

The current Complete frames have dark gray, mossy roofs, weathered timber and
stone; each is a compact single-roof building. The new Barracks has cream
infill, pale stone, honey-oak framing, sage roof planes, side shelters, a broad
arched gate and organized weapons. The new Range has an open three-target
practice bay, substantial visible posts, bow storage and a small enclosed
annex. These functional silhouettes and their warmer common materials should
survive at game size. The older Blender previews show simpler hall/canopy
samples, not these new detailed designs.

Both new concepts paint a forked blue standard. Replace that illustrative
detail with the actual straight-cut Azure and forked Ember standards, preserving
their distinct bar treatment. Cultural ochre remains neutral; the grain emblem
is illustrative rather than approved faction insignia. Do not recolor target
rings or assume an independently fitted wiki image establishes world scale.

## Next bounded production and adoption slices

1. **Author the new Complete pair.** Derive editable geometry and materials from
   the preserved concepts, with grounded origins and usable back faces. Local
   Blender is available in this audited cloud environment; the optional
   `game-dev` CLI is absent. No paid generation is authorized or required by
   this plan. Retain originals, source hashes, modeling/capture commands and
   license/provenance. Reusing old mesh helpers is possible; merely exporting
   the older samples again does not implement the selected designs.
2. **Measure and capture the pair.** Start at 2.8-unit visible base width within
   existing 3-cell occupancy, then measure both base axes and review actual
   selected Worker doorway/bay clearance. Preserve shared orthographic 46°
   elevation, azimuths 0–315° in 45° steps, 128 pixels/world unit, 1024-square
   frames and the established ground pivot. Produce sixteen transparent
   Complete PNGs, their capture/measurement/provenance records and two
   compatible Complete renderer manifests. These are required new outputs,
   not files presently delivered. Correct ownership through neutral source
   standards plus live team geometry or verified aligned masks.
3. **Adopt one useful family at a time.** Add the verified manifest to the
   existing captured-building selector; admit only its manifest and requested
   PNGs in HTTP/Docker/release paths. Preserve health, selection, live standards,
   rally, queues, exits, fog and body depth. Keep the current direct sprite
   pack as explicit loading/missing-state fallback. Check both teams in an
   ordinary paid match at an identified served revision, including Workers in
   front and behind the building. Complete-only adoption is an incremental
   milestone; full replacement remains owned.
4. **Finish lifecycle coverage and verify it.** Derive matched Foundation,
   Frame, Damaged and Critical designs/captures from each new Complete model.
   The shared captured path uses incomplete progress ≤27.5% for Foundation,
   later incomplete progress for Frame, and completed HP ≤30% / ≤60% for
   Critical / Damaged. The retained direct fallback currently uses 20%/90%
   construction and 66%/33% health boundaries. Record the selected path and
   test its actual boundaries, repair, destruction/rebuild, fog and raised
   terrain. Do not label the old five-stage construction candidate as five
   lifecycle states. Full five-state coverage is forty color views per family;
   masks are additional only when that ownership method is used.

Keep all exploratory generations and source comparisons in their existing
packs and wiki links. Add future model/capture iterations beside them with
truthful status. Do not overwrite originals, publish private model sources or
add large binaries merely to make the inventory appear complete.
