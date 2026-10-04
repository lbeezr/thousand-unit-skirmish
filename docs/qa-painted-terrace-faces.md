# Painted scree terrace faces

[Terrain backlog](asset-adoption-checklist.md#terrain-workstream-backlog) ·
[Renderer](../src/terrain-cliff-faces.mjs) ·
[Terraced Vale Tiny](../maps/veyrholds-terraced-vale.json)

Owner: terrain integration, through default binding, served release, identified
staging deployment and ordinary-game appearance. Parent staging/Mac coordinator
is the assigned downstream execution owner. Independent forest-fog/exploration
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

The implementation PR records independent review, exact tested head/merge,
clean release digest, package checks, active staging revision and actual browser
attempt. This executor previously reports `sandbox-unavailable`; no sandbox
disabling is permitted. Preserve zero screenshots as a real execution limit,
not visual acceptance.

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
