# Painted ground atlas default adoption

[Adoption checklist](asset-adoption-checklist.md) · [Pack and provenance](../assets/environment/frontier-painted-material-atlas-v1/README.md)

Owner: painted ground atlas adoption worker. Write scope: ground texture selection,
painted-atlas loader and ground sampling shader; narrow server/Docker admission,
existing adoption guard, tests and this evidence. No building sprite paths or
resource/cliff candidate integration. Parent staging/deployment owner in the
delegating task coordinates the next staging release and Mac QA; implementation
ownership remains here until the exact deployment and ordinary-game evidence exist.

## Default binding and release

The normal `createGroundSurfaces()` path chooses the same regional/variant/quiet
texture name as before. Exactly meadow, short-grass, long-grass, forest-floor,
dirt, sand, scree and cinder resolve to cells in the existing painted atlas.
Underbough regional kits/variants, quiet mud/snow/loam, garden-loam and lunar-soil
continue using individual textures. Failure to load the manifest or any decoded
mip restores the existing individual paths.

World UVs stay at 12 units per repeat, with the same raised terrain geometry,
per-vertex alpha, slope shading and independent paint/forest feather masks.
Every shader sample folds mirrored coordinates into its inset cell after the
existing seeded stochastic rotation/offset; mirror mode uses the same address
mapping without stochastic blending. Texture gradients are transformed along
with coordinates and capped at level 5. Only authored levels 0–5 are uploaded;
GPU-generated cross-cell mips are disabled. All paints share one texture source.

The approved-runtime registry guards this default consumer, manifest, six mip
hashes and actual package inclusion. The Railway release scenario checks their
HTTP admission, bytes/MIME and omission of source/preview PNGs.

## Evidence and limits — 3 October 2026

The original manifest and actual mip-0 pixels were inspected before integration:
eight named paints, mirrored gutters and one empty ninth slot. Existing manifest
validation retains all original source/runtime hashes. No art was generated or
reencoded.

Focused runtime checks execute the real Three factories with image decode
mocked: shared six-level sRGB/clamped page, unsupported/missing mip rejection,
all eight selection paths, uncovered/regional/variant choices, mirror and
stochastic material hooks, raised geometry/world alignment and identical
feather-mask bytes. They do **not** prove GPU pixels or deployed appearance.

Passed local checks: `painted-material-atlas-runtime.test.mjs`, existing atlas
manifest/hash and UV scenarios, adoption guard (including missing mip/disconnected
binding rejection), terrain blend/elevation scenarios, client import checks,
existing Frontier default-building regression, documentation links and the
packed Railway release HTTP/hash scenario. The implementation PR records the
exact tested source revision and clean release digest.

Sandboxed Chromium preflight in this Linux execution environment failed with
`sandbox-unavailable`. Writable XDG configuration/cache fixed the separate
storage issue; sandbox startup still failed. No sandbox-disabling flags were
used. Screenshots captured here: **0**. Game-zoom visual acceptance is incomplete.

## Receiving staging/Mac QA action

Run from an identified staging release containing this PR (record source SHA,
release digest, successful active deployment id and platform source revision
separately). Verify the served manifest plus six runtime files against manifest
SHA-256; verify the new runtime helper is reachable and served.

Open an ordinary match with no terrain/art flags. On Frontier Materials, compare
atlas and pre-change screenshots at the same fitted, normal and closest camera
zooms, centered on meadow/dirt/sand and scree/cinder boundaries. Inspect repeat
boundaries and feather joins for seams, foreign cell colors, stretched bands or
empty-slot bleed. Zoom/pan through the level-5 transition and vary camera rotation.
Check the normal Millrace opening, raised Cinder Ridge and a forest-ground blend.
Check Underbough Rootways still shows its regional kit/variants; snow, mud, loam,
garden-loam and lunar-soil retain their prior surfaces. Use existing
`terrainTiling=mirror` only for a second repeat-boundary comparison, and retain
the ordinary stochastic screenshots as the default-path evidence.

Save map/action/zoom, source/deployed SHA and screenshots with observations in
this note or the implementation PR. A preview or older revision does not close
the default gameplay outcome. Until that evidence exists, deployment and
appearance remain **incomplete**, owned by this adoption worker with the parent
staging/Mac QA coordinator as the explicitly assigned downstream recipient.
