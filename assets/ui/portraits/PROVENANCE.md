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


## Farm runtime reuse — 4 October 2026

The existing [admitted default Frontier Farm family](../../buildings/frontier-economy-models-v1/README.md)
supplies the requested selection illustration directly. Its [manifest](../../buildings/frontier-economy-models-v1/farm-complete-renderer.json)
SHA256 is `6a4ab7f6821c11e322eb2908c33b1cc96c5e32f6be2bfb33f683813754cb4800`;
[world source/staging acceptance](../../../docs/qa-frontier-economy-art-2026-10-04.md)
at `b07df5578aadf78b7b2a15dd46be56fd5b67fbf1` is separate from this HUD delivery.
No image is generated, edited, duplicated or newly admitted. Private GLBs,
capture recipes and source comparisons remain outside browser admission.

All eight 1024×1024 originals use existing view-01 (45° illustrative view),
with CSS viewport x260/y420/size500 in the existing 52px portrait and 40px inline
figure. Their exact alpha union x280..738/y439..817 leaves 20/19/22/103px margins;
the roof, scaffold, field and base remain intact. Original source pixels and
compact color/grayscale studies were inspected: planted rows and exhausted bare
soil remain distinct, as does the open construction frame. This fixed identity
illustration does not claim the current camera yaw or live team standards.

Paths below are relative to `assets/buildings/frontier-economy-models-v1`.

| Registered state | Existing runtime source | SHA256 |
| --- | --- | --- |
| `complete` | `runtime/farm-complete-view-01.png` | `f0da663928ba4966af97acd4ee7789f9cd6aa0dea0914bb4ded94e2fd27ce90d` |
| `foundation` | `runtime/farm-foundation-view-01.png` | `9b8967590e5e69922d255ed497708182b3071fa7b722c8e778e566e8a1e34f56` |
| `frame` | `runtime/farm-frame-view-01.png` | `4706bd3dbb074d0920da0ae0b9e894f0f7c7cde7a8815bb89b489367ef7103ea` |
| `damaged` | `runtime/farm-damaged-view-01.png` | `abb6dca80af2f9570924d91fbb7be000b986529b3c7643bca75a379d75e919ad` |
| `critical` | `runtime/farm-critical-view-01.png` | `473fa8907174defa518b585851ddbc9848b48465148c45d11aeeea6abcaa6875` |
| `exhausted` | `runtime/farm-exhausted-view-01.png` | `b42f0b6d27b29cf75d3ee08a36b7cb6611b30d415725d6dc2431d318c108d66c` |
| `exhausted-damaged` | `runtime/farm-exhausted-damaged-view-01.png` | `c64285adf8e3aebe968208ce4e882f5f3998bb9783737c6ede1366bc49dc4a2c` |
| `exhausted-critical` | `runtime/farm-exhausted-critical-view-01.png` | `e2ffa644e3d23d6ef3d6f0dbc1c77ac7a809afb25bb4da073c81c1a375dd0dd9` |

The HUD follows registered construction/health/exhaustion thresholds, while
requiring authoritative completion before showing available food. Missing or
invalid state fields and image failures retain the labelled Food symbol; text,
stock and Worker instructions remain authoritative. [The ordinary paid capture
recipe](../../../docs/hud-art-integration.md#ordinary-game-capture-recipe-and-remaining-evidence)
retains identified containing delivery, native crop/contrast/keyboard inspection
and human recognition as unfinished. No native screenshot is claimed by CPU studies.
