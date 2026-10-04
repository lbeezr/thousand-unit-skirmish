# Selected unit portraits

The first HUD slice reuses existing project-owned generated art, byte for byte.
No illustration was generated or edited for this slice. CSS deliberately frames
the head, shoulders and pack from a high-resolution illustration; neither source
is a tiny runtime atlas face enlarged into a portrait. This is a functional first
visual, not acceptance of a final purpose-drawn portrait style.

| Runtime source | Inspected original | Dimensions | SHA-256 | Square viewport (x, y, size) |
| --- | --- | --- | --- | --- |
| [Human](human-worker-source.png) | [Approved Human idle facings](../../../docs/art-direction/human-vaelora-sprites-v1/source/Idle/facings.png) | 1774 × 887 | `323071be89e1fc6e181ec4c7b946d28048043380b4faaa285f368e6efe1c54ad` | 970, 0, 270 |
| [Boughward](boughward-worker-source.png) | [Extracted Worker illustration](../../../docs/art-direction/boughward-roster-v1/extracted/worker/00.png) | 266 × 428 | `7296c0b24ad61c02b65bfc9d6d88c8f46391bfa1efbaeba2e4c2615de07f9aa6` | 20, 0, 240 |

Approval context and generation provenance are retained in the
[Human direction](../../../docs/art-direction/human-vaelora-sprites-v1/README.md)
and [Boughward roster](../../../docs/art-direction/boughward-roster-v1/README.md).
The Human view is the third top-row facing, with swept hair, cream shirt, sage
vest and yellow bedroll. The Boughward view preserves the olive face, burgundy
clothes and woven pack. Static source pixels were inspected; in-game pixels and
native accessibility remain on the [capture checklist](../../../docs/contextual-hud-validation.md#cumulative-mac-qa-checklist).

## Infantry reuse — 4 October 2026

Two additional delivery files copy existing public illustrations byte for byte.
Human Infantry uses the restored v3 family's pinned idle source, retaining its
helmet, cream/sage clothing, short spear and six-sided shield. Boughward retains
the green face, burgundy scarf, spear and timber shield. The square viewport
deliberately shows head, shoulders and equipment; no asset pixels were edited.

| Runtime source | Inspected original | Dimensions | SHA-256 | Square viewport (x, y, size) |
| --- | --- | --- | --- | --- |
| [Human Infantry](human-infantry-source.png) | [Pinned idle facings](../../../docs/art-direction/human-roster-v1/source/infantry-idle-facings.png) | 1774 × 887 | `0a94a11f2dffd4b722d3a732aa4d3117283d3fa41c89aac6f03487d7a7930b38` | 970, 0, 310 |
| [Boughward Infantry](boughward-infantry-source.png) | [Existing isolated idle](../../../docs/art-direction/boughward-roster-v1/extracted/infantry/00.png) | 377 × 538 | `17f6ff8f66274a00c1206301b00a8e298ffc7692ec307975c77300e2a62cb33c` | 0, 0, 300 |

[Human identity restoration](../../../docs/art-direction/human-roster-v1/infantry-production-contract.json)
pins this source and Infantry v3. Original generation/extraction provenance stays
in the [Human](../../../docs/art-direction/human-roster-v1/README.md) and
[Boughward](../../../docs/art-direction/boughward-roster-v1/README.md) records.
This reuse introduces no generation, external uploads, private sources or rejected
PR25/230/241 artwork. Delivery adds 1,582,837 bytes across both PNGs.

Private CPU comparisons inspected these crops at actual 52px portrait and 20px
action size over the existing pine panel, in color and grayscale. Helmets/faces,
clothing and equipment remain distinct at 52px; detail diminishes at 20px. The
thumbnail accompanies the written product name, cost and availability reason.
These comparisons establish source inspection only. Purpose-drawn role portraits,
native HUD framing/recognition and an identified served release remain incomplete.

## Archer reuse — 4 October 2026

The established Human Archer v2 idle sheet and Boughward extracted idle are
copied byte for byte. Human retains open face, swept hair, cream shirt, sage
cape, bow and quiver. Boughward retains the smaller green goblin, long ears,
burgundy scarf, bow and quiver. CSS viewports preserve face and upper equipment;
no source pixels, character identity or default sprite family were changed.

| Runtime source | Inspected original | Dimensions | SHA-256 | Square viewport (x, y, size) |
| --- | --- | --- | --- | --- |
| [Human Archer](human-archer-source.png) | [Established idle facings](../../../docs/art-direction/human-roster-v1/source/archer-idle-facings.png) | 1774 × 887 | `29c3b3a59b3391797f34c6c29c05dc664c9bc9551e94abf56c0b132e9a159520` | 970, 0, 310 |
| [Boughward Archer](boughward-archer-source.png) | [Existing extracted idle](../../../docs/art-direction/boughward-roster-v1/extracted/archer/00.png) | 768 × 512 | `acac85ca7b45351663820ca69e8994aca8c74910915aa7d0fb164c7f9c6ce635` | 250, 0, 400 |

The [Human appearance review](../../../docs/art-direction/human-roster-v1/review.json)
is explicitly appearance-only; the [retained identity](../../../docs/human-foot-unit-coverage.md)
is Archer v2, excluding the held hooded Archer v3 PR230. The
[Boughward record](../../../docs/art-direction/boughward-roster-v1/README.md) and
[extraction](../../../docs/art-direction/boughward-roster-v1/extracted/archer/extraction.json)
retain the existing static-pose production history. These source approvals do
not establish accepted motion or native HUD recognition. Delivery adds
1,734,871 bytes across both already public PNGs, with no paid generation,
private-source upload or PR25/230/241 artwork.

Original source pixels and exact-size 52px/20px CPU comparisons were inspected
in color and grayscale on pine panel and command-button backgrounds. Transparent
source pixels retain alpha; brown RGB underneath is not an opaque backdrop.
Faces and upper equipment remain distinct in the 52px candidates. Facial detail
and bow strokes diminish at 20px, so thumbnails stay decorative beside the
written Archer name, both costs and availability reason. Native framing,
clipping, identified delivery and unassisted recognition remain incomplete.
