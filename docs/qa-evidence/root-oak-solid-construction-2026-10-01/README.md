# Root Oak solid construction study — 1 October 2026

The four-panel capture renders the existing proposed Root Oak anatomy as tapered
cylinder branches/roots and five ellipsoid crown volumes. One Three.js group is
rotated to 0/90/180/270 degrees under a fixed camera direction and fixed lights.
The same geometry, scale and root origin are retained; no panel-specific edits
or mirroring are used. The browser capture completed with an empty error list.
`projection-proof.json` records the branch attachment projections at each heading.

The panel was visually inspected: crown and branch occlusion change with heading,
and the solid construction is much clearer about depth than the line guide.
This remains a manual approximate proxy, not recovered geometry of the original
painted tree, finished sprite art, measured painted headings or runtime coverage.
Primitive shapes are construction aids and must not replace the production oak.

A built-in ImageGen sheet constrained by the earlier line guide was rejected:
several drawings retained front-facing scars and did not follow branch/crown
projections reliably. Its source, prompts and review are preserved in the
Underbough source folder. A solid construction reference is the next method to
try for painted finishing, with anatomy checked before lifecycle or runtime work.

The fixture reads the anatomy JSON and uses the repository's camera direction.
It can be captured through the existing RenderHandler and local CDP runner;
`/__save/` emits the PNG and JSON into this evidence directory. It does not load
or alter an authoritative match.
