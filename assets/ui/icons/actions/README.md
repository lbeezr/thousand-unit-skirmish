# Default action glyphs

Six original project-authored 24 × 24 SVGs supplement the existing
[HUD kit](../../README.md). Existing labelled controls use these images by
default at 20 px. The server explicitly admits all six SVGs; Docker and clean
release packages include them. Deployed delivery and native game recognition
remain incomplete in the [adoption ledger](../../../../docs/asset-adoption-checklist.md).

[Manifest](manifest.json) maps sources to existing command selectors and
meanings. Written labels, hints and tooltips remain; button images use empty
`alt` text so the SVG name does not repeat the button label. The Command drawer
uses the same Patrol, Follow, Stop and Hold position images.
The Formation mapping applies only to selected-unit contexts. The same details
button displays Rally / upgrade details for a building; retain that separate
meaning rather than applying the Formation glyph to building controls.

| Glyph | Shape | Meaning boundary |
| --- | --- | --- |
| [Patrol](patrol.svg) | Opposing bent arrows | Repeated travel between endpoints, distinct from one-way Move. |
| [Follow](follow.svg) | Two unit silhouettes and an arrow toward the leader | Friendly leader tracking, not attack targeting. |
| [Stop](stop.svg) | Solid square | Task/queue cancellation; no cargo loss implied. |
| [Hold position](hold-position.svg) | Shield around a planted position marker | Stationary defense without chase; no armor bonus implied. |
| [Return cargo](return-cargo.svg) | Returning arrow, receiving tray and crate | Deposit carried resources, distinct from Gather. |
| [Formation](formation.svg) | Units aligned in ranks | Open formation/route choices, not an immediate order. |

The set reuses pine `#131b16`, pale text `#e5e8d7` and lime `#d5ef78` from the
existing kit. Meaning comes from shape and retained labels, rather than accent
color. No decorative frame, embedded raster image, font, provider generation or
external source is used. SVGs are both editable sources and eventual delivery
files; see [provenance](../../PROVENANCE.md).

Validate with `node --test scripts/hud-action-icons.test.mjs` from the repository
root. Source tests check XML, dimensions, self-contained vector content and
mapping to default labelled controls. Run
`node scripts/hud-action-icons-serving-scenario.mjs [clean-release-directory]`
for default HTML, GET/HEAD, MIME/hash and source-only rejection checks.
Review at actual 16, 20 and 24 px over
the existing panel backing, including grayscale. A CPU contact sheet can show
source rendering, but does not establish native game reachability, recognition
or accessibility. Native horizontal-strip recapture remains separate; use the
[icon contract](../../../../docs/ui-cursor-icon-contract.md) and
[game recipe](../../../../docs/contextual-hud-validation.md#six-default-action-glyphs--3-october-2026).

Initial PR130 CPU source review at 16, 20 and 24 px, plus 24 px grayscale, found distinct
silhouettes with labels retained. Follow's connecting arrow and Return cargo's
crate seam weaken at 16 px. Prefer the existing 20 px action-image size during a
integration; retain the written cargo label and Hold's no-chase explanation.
This is a candidate recommendation, not native or unassisted recognition acceptance.

## Follow and Return cargo refinement — 3 October 2026

Follow keeps both unit silhouettes and uses a larger curved 2 px connection
toward the leader. Return cargo uses a filled generic crate and one bent arrow
entering an open receiver. It adds no harvesting tool, resource-specific mark
or repeated Patrol route. Manifest IDs, paths, selectors and meanings stay unchanged.

A private CPU comparison preserves the original sources and shows both versions
at exact 16, 20 and 24 px, with grayscale at every size. The larger connection
and filled crate remain visible at 16 px; retain the written labels and prefer
the existing 20 px action-image size, now used by default. The compact HUD owner
retains deployed delivery and parent-owned native game verification; source
rendering and integration tests do not close those steps.
