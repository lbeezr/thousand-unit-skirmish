# Action glyph candidates v1

Six original project-authored 24 × 24 SVGs supplement the existing
[HUD kit](../../README.md). **Candidate sources, not integrated controls:** no
renderer, HTML, CSS, command handler, server allowlist or cursor changes are part
of this set. Docker's existing UI directory copy includes these source files,
but the game server does not expose them until runtime admission.

[Manifest](manifest.json) maps candidates to existing command selectors and
meanings. Keep written labels, hints and tooltips. A future button image should
use empty `alt` text so its SVG name does not repeat the button label.
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
mapping to existing labelled controls. Review at actual 16, 20 and 24 px over
the existing panel backing, including grayscale. A CPU contact sheet can show
source rendering, but does not establish native game reachability, recognition
or accessibility. Native horizontal-strip recapture remains separate; integration
will need the existing [icon contract](../../../../docs/ui-cursor-icon-contract.md).
