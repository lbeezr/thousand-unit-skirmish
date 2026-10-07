# Painted scree terrace faces

[Terrain backlog](asset-adoption-checklist.md#terrain-workstream-backlog) ·
[Renderer](../src/terrain-cliff-faces.mjs) ·
[Terraced Vale Tiny](../maps/veyrholds-terraced-vale.json)

Owner: terrain integration, through default binding, served release, identified
staging deployment and ordinary-game appearance. The current cloud testing/CI
owner receives renderer qualification and capture execution under the
[testing strategy](testing-strategy.md#start-here). Mac testing was stopped by
the user and is not a dependency. Independent forest-fog/exploration
work remains with its own worker; this slice does not edit `main.js` or fog rules.

## Report and bounded fix

The user likes the painted dry grass, cracked stone and soft material transitions
on Veyrholds Terraced Vale Tiny, but reports raw-looking untextured vertical faces
on its raised central bands. Identified staging source at report time:
`53a47ee379660f30b65776ea813f3a986d29aa37`, successful active deployment
`e104638c-2c8b-433b-8928-7b53a8f3494e`. This user observation is not a controlled
capture or acceptance of the new face treatment.

The stock 160 × 160 map puts scree on level-2 high ground, dry grass/meadow on
level-1 shelves and short grass/dirt in the valley. The old vertical discontinuity
mesh has positions and normals only; a plain rough lit material supplies its
color. The new default applies only when the base is `scree`. It reuses the
approved scree selected by the existing regional/atlas/fallback loader. Other
bases retain the old plain material; the low-ridge candidate and existing cliff
sprites remain separate.

Face UVs use `(x + z + map origin) / 12` horizontally and height `/ 12`
vertically. Horizontal phase therefore agrees at straight and orthogonal joins,
and vertical density follows world height rather than stretching a tile to each
wall. Existing stochastic rotation/offset and authored atlas mip-5/inset rules
apply to every face sample. This is a real 3D surface, so it needs a surface color
texture rather than a camera-specific cliff picture or cutout sprite.

The painted material uses the ground's fixed palette/shading style. Facet values
keep vertical direction legible. Narrow opaque color bands feather toward the
adjacent upper/lower terrain palette: 0.12/0.16 world units, at most 35%/30% mix.
These are color transitions, not new grass/rubble art or matching ground-image
samples. They retain the stone detail and depth coverage. Painted faces align
to the existing base surface's -0.025 offset; top paint overlays keep their
existing offsets. No new cap, ledge, footprint, blocker or height is introduced.

## Checks and cost

The original Terraced Vale face position buffer at `0fc2e9b8` has 1,704 vertices
(568 triangles), SHA-256
`fef64ba2e212a89a674072006ed12d1c9b54f634cb992aef3e824b24b8c8d8f5`.
The new local position/normal buffers match it exactly. A mesh offset aligns
painted face endpoints with the unchanged normal ground corners. Tests cover
that contact, finite attributes, world density, corner phases, untouched map
and authoritative elevations, no faces on flat/one-level ramps, normal/mirror
atlas sampling, missing-atlas individual fallback, opaque depth and unaffected
non-scree material/picking behavior. Factory image decode is mocked; shader
hook checks do not prove WebGL compilation or GPU pixels.

No new image requests, image bytes, texture clones or GPU image sources. The
existing wall remains one batch with the same triangle count. Terraced Vale's
attribute array payload grows from 40,896 to 129,504 bytes (+88,608; 86.53 KiB),
before driver overhead. Default stochastic stone sampling adds three texture
reads per covered face fragment plus the small color-band calculation; no
performance improvement is claimed. Actual rendering cost remains unmeasured.

Normal runtime admission is covered by the existing painted-atlas declaration,
its six packaged/hash-checked dependencies and the explicit scree-face consumer
guard. The new helper is part of the served client import graph. No source image,
Meshy job, new material pack or private publication is involved.

## Ordinary-game acceptance remains open

### Directional shading correction — 7 October 2026

The new cliff-presentation audit at clean source
`ac4a09dd4e27a8c355726f5fd4b53a25fc364590` confirms that the earlier raw,
untextured-face gap is already addressed by PR295's default approved scree
binding. The actual consumer is now
[`presentation/rendering/ground-surfaces.mjs`](../src/presentation/rendering/ground-surfaces.mjs),
through `environment-art.mjs`; no replacement texture or material redesign is
justified without rendered evidence.

One reproducible presentation defect remains: the cliff shade assumes +Z
winding where the original triangles point toward -Z when the preceding cell
is higher. Compared with the normal ground renderer's world light direction,
156 +Z vertices use 0.77 instead of 0.93, and 108 -Z vertices use 0.93 instead
of 0.77. The 1,368 X-facing vertices already agree. Another 72 vertices belong
to zero-area taper triangles and contribute no visible facet.

The bounded correction changes only that Z coefficient sign. Its selected
treatment reuses the [approved painted scree source](../assets/environment/frontier-v1/scree.png),
the [atlas/provenance](../assets/environment/frontier-painted-material-atlas-v1/README.md)
and [Veyrholds art backing](art-direction/vaelora-v1/README.md), with the existing
ground renderer as the directional-value comparison. Acceptance: all 1,632
nondegenerate cliff vertices agree with the ground's normal-based shading;
the baseline positions, normals, 12-world-unit UVs, corner phases, lip offsets,
edge bands, atlas/fallback, opaque depth and picking contracts still pass.
Map elevation, pathability, sight, resource placement and identity stay untouched.
No shader reads, attributes, images or geometry are added. Runtime files are
the cliff helper alone; tests, this note and its CPU receipt are the other edits.

The [independent triangle-cross-product audit](qa-evidence/cliff-directional-shading-2026-10-07/geometry-review.json)
derives directions from original position triples, independently of the helper's
axis branch and stored normals: the baseline has 264 wrongly shaded visible
vertices and the correction has zero. All six non-color attribute buffers
byte-match baseline, including the original positions/normals and UVs; the
Terraced Vale map SHA-256 is unchanged. This is single-agent CPU/source review,
not an independent reviewer or GPU evidence. A separate reviewer remains needed.
The 26 focused cliff/atlas/adoption tests, both atlas scenarios, terrain blend,
type, import, docs and asset-adoption checks pass. The broader native elevation
scenario fails at `elevation-scenario.mjs:184` (a route contains a repeated cell,
`0 !== 1` for adjacent steps); it is outside this render-only diff and remains
with the active movement owner. No full CPU-suite pass is claimed.

The saved cloud environment's one supported Chromium launch reports
`sandbox-unavailable` and `storage-unavailable`: **zero game frames and zero
screenshots**. `game-dev` is unavailable. No restrictions were bypassed.
This CPU-reproduced correction does not claim visual acceptance. The cliff
presentation owner retains ordinary Terraced Vale Tiny capture on an identified
containing release: both wall orientations and corners at normal/strategic zoom,
ground contact, mip transitions and depth/fog coverage. Publication is a separate
draft; ready/merge and staging delivery are outside this slice.

[PR295](https://github.com/lbeezr/thousand-unit-skirmish/pull/295) merged at
`db4648120be92db0a3d372b457e0b78fff22cbf2`. That exact merge passed the 18
face/atlas/adoption tests and packaged HTTP/client admission checks. Its clean
release digest is
`sha256:c6d2c4f705a2ae8597dfdd8cca857ae678f24126e67c430bb05ca884f1adee19`;
the helper and existing manifest/six mip files are packed and byte-match source.
The post-merge platform read still identified deployment
`e104638c-2c8b-433b-8928-7b53a8f3494e` at source
`53a47ee379660f30b65776ea813f3a986d29aa37`, which does not contain PR295.
Refresh the deployed identity before capture; merge and packaging do not prove
staging delivery.

The retained startup attempt reports `sandbox-unavailable`, zero screenshots.
The current cloud testing/CI owner must qualify WebGL2 and production packed-game
rendering under the linked strategy before the ordinary-game capture below.
Do not repeat unchanged blocked startup or disable its sandbox. Terrain integration
retains acceptance. Containing staging delivery, rendered seam/mip/stretch/contact
and depth/fog checks, and actual GPU rendering cost all remain **pending**.

On an identified containing staging build, enter ordinary Practice → Veyrholds
Terraced Vale Tiny with no art flags. Inspect the central high scree strip from
both seats at fitted, normal and closest zoom. Check both wall orientations,
straight joins and right-angle corners for stretched fragments, repeating bands,
atlas foreign colors, cracks or bright/dark seams. Check top/bottom contact and
that edge colors stay subordinate to the stone. Compare the surviving painted
tops, dry-grass shelves, meadow campuses and short-grass valley against the
reported build. Pan/zoom through mip transitions.

Issue actual moves through the unchanged broad passes and ramps; confirm face
height distinguishes blocked two-level edges from traversable one-level slopes.
Check Workers and buildings in front/behind a face, and fog hiding/reveal with
the independent fog owner's containing build. Repeat on a plain non-scree raised
map and a smooth ramp. Record source/release/deployment IDs, map/action/zoom,
observations and screenshots before accepting appearance. If scree used as a
vertical material needs further art adjustment, make that decision from these
renders rather than inventing a new cliff source in advance.
