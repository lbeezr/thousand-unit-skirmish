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
