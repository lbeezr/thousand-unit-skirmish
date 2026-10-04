# Building and construction composition — 4 October 2026

[Renderer contract](renderer-state-contract.md) · [Default buildings](frontier-building-runtime.md)

Rendering/compositing owner retains the user reports: completed Watchtower and
apparently most non-TownCenter buildings have a dark square on top; Workers
appear under construction earth; adjacent palisades have overlapping earth
squares. Gameplay, rotation/ghost preview, approved art and terrain are outside
this correction. Initial clean current source is
`faf9e718805054683e37fc7e1faac3d98ca10ae5`.

## First demonstrated cause and small correction

The shipped construction ground factory sets transparent render order 8.
Worker sprites have order 1.1, depth testing and **no depth writes**. Thus the
late earth color pass has no Worker depth to reject it and blends over Workers
where they intersect in the image. Ground now uses order -0.5 and keeps depth
testing/no depth writes and its existing height +0.002. This changes one color
pass order, with no actor/terrain height, asset, simulation or picking changes.
CPU factory contracts exercise loaded and unloaded textures, ordering relative
to real actor/captured building constants, elevated contact, capacity refusal
and empty membership. They do not establish rendered appearance.

## Layer audit

| Content | Current order / pass | Depth and alpha convention |
| --- | --- | --- |
| Terrain and opaque procedural foundations/bodies | Opaque, normally 0 | Test/write depth; ordinary geometry |
| Terrain blend / shore-bank shade | Early transparent; bank -2 | Test depth, no writes |
| Ground haze | Transparent -1 | Test depth, no writes |
| Construction earth/foundation | Transparent -0.5 (was 8) | Test depth, no writes; texture cutout 0.04 |
| Environment props/trees | Transparent normally 0 | Cutout 0.08, depth writes |
| Direct building body | Opaque 0 | Color disabled, alpha 0.9, depth writes; same texture/ground correction |
| Captured building body | Opaque child of color sprite | Color disabled, alpha 0.9, depth writes; same transform/texture |
| Direct / captured building color | Transparent 0 / 0.9 | Test depth, no writes; alpha 0.08 / 0.025; painted shadows stay in original art |
| Unit LOD / Workers | Transparent 0.8 / 1.1 | Test depth, no writes; Worker alpha 0.035, root/contact depth bias retained |
| Unit ground rings/shadows | Existing procedural pass | No new shadow plane added; live feedback remains separate |
| Selection, combat, rally / arrows | Existing orders 2–4 | Mainly depth-tested blended feedback, no writes |
| Health / attacker badges | Existing feedback | Unit health and attacker badge bypass depth intentionally; building health uses geometry |
| Placement previews | Existing orders 4–5 | Blended previews, no writes; owned by rotation/ghost workstream |
| Water / surface plants | Existing orders 5–7 | Separate water composition; dry construction does not change it |
| Fog / resource labels | Existing orders 12 / 15 | Fog and screen labels intentionally bypass depth |

Opaque passes run before transparent passes regardless of numeric order. The
ground fix preserves that occlusion; lowering its order is not flattening depth
or changing actor heights.

## Dark-square diagnosis is open

The original Watchtower view-01 PNG was visually inspected: it has the authored
roof, no extra square. Current completed captured art hides its grouped generic
fallback, while health/selection/team/combat feedback remain on the outer group.
No fallback, foundation, shadow, depth or alpha cause is yet proven for the
reported square. No geometry or source art has been removed speculatively.

Local sandboxed WebGL prerequisite at the initial source failed with
`sandbox-unavailable` and `storage-unavailable`: zero frames/screenshots. The
[qualified PR323 run](https://github.com/lbeezr/thousand-unit-skirmish/actions/runs/37215311854)
artifact was downloaded and its actual canvas inspected. That older OpenField
movement frame shows a TownCenter and qualifies the backend; it does not
reproduce the reported buildings or prove this correction.

## Retained visual acceptance

CI owner `01a10378` owns the common hosted interface, registry and dispatch.
The concrete [interface request](https://github.com/lbeezr/thousand-unit-skirmish/pull/331#issuecomment-5982274444)
proposes `site-composition`, owned file
`scripts/renderer-site-composition-scenario.mjs`. Exact current-source baseline
and candidate normal packed assets must capture real paid healthy Watchtower,
House and other families, TownCenter control, Worker front/rear crossing and
construction contact, mixed-stage palisades, gate/gap/corner, completion,
cancel/removal and elevated terrain occlusion. Inspect actual PNGs and retain
simulation state and source/release identities; screenshot manifests alone
cannot pass visual acceptance. Identified staging delivery remains separate.
