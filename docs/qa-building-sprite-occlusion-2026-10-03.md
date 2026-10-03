# Building sprite body occlusion — 3 October 2026

[Renderer contract](renderer-state-contract.md) · [Runtime art audit](art-runtime-audit-2026-10-03.md)

Source baseline: fork main `93af695c`. The ordinary Barracks and Archery Range
use the selected direct sprites through `attachBuildingSprite`. Their blended
color pass tests depth but does not write it; unit sprites draw afterward at
render order 1.1. An actor behind an opaque painted building body can therefore
draw over it. This gap is verified from the rendering contract, with an old-path
negative control; it has not been reproduced in a native GPU frame here.

## Bounded correction

[The helper](../src/building-sprites.mjs) adds one opaque, color-disabled depth
pass per successfully loaded sprite building. Alpha below 0.9 is discarded;
nearly opaque body pixels write depth before transparent sprites. Openings,
soft edges and painted shadows remain in the existing blended color pass,
whose alpha threshold stays 0.08. Actors nearer than the building depth still
pass the depth test. This is body occlusion, not a new cast-shadow effect.

Both passes share the exact texture and geometry, selected frame/facing,
center, scale, local placement and existing ground-depth shader. The shader's
below-anchor ground-plane correction is unchanged. An independent geometric
projection test disproved an initial sign-error hypothesis, so no shader-math
correction is included. No source image or asset manifest changes.

The building's existing outer group owns fog visibility and terrain placement.
Pending, failed, stale and disposed frame loads cannot leave a depth blocker;
the procedural fallback remains available. Selection, health, production and
rally cues remain separate. The depth Sprite does not raycast. Captured Frontier
and Town Center rendering use their existing separate paths. Resource marker
and fishing presentation handlers are outside this change.

## Source pixels and preservation

The existing Barracks complete/foundation Azure frames were inspected at original
640 × 640 resolution. All 20 shipped Barracks/Range construction and damage
frames, covering both teams, were fully decoded for alpha counts and SHA-256
identity. [The source receipt](qa-evidence/building-sprite-occlusion-2026-10-03/source-alpha.json)
records their existing repository paths and hashes; it is source evidence,
not a rendered comparison or validation of every frame's appearance.

At the source-sample threshold of alpha 230/255, the complete Azure Barracks
has 175,574 body pixels and 1,799 soft pixels in alpha 21–229; the foundation
has 65,579 body pixels and 2,598 soft pixels. Fully transparent openings stay
outside the depth pass. Texture interpolation may change the sampled alpha at
an edge; native review is still needed for that boundary. Existing artwork
remains at its tracked paths. No new generation, sprite, raster study or paid
job was produced by this slice.

## Cost contract and checks

`MAX_BUILDINGS = 128` bounds authoritative ordinary-match construction and
validated checkpoints. The worst architectural increment is therefore 128
draws, one per visible loaded direct-sprite building; most building types do
not use this helper. Hidden groups and unloaded frames add no visible pass.
Each added pass draws the shared Sprite's two triangles, samples the existing
map, and uses a separate opaque material/program variant. It adds one Sprite
and material per affected building, zero textures, zero vertex/index buffers
and no per-frame controller callback. This bounds draw/asset work, not GPU
milliseconds or shader compilation time.

`scripts/building-sprites.test.mjs` exercises:

- The actual patched GLSL expressions against independently projected
  ground-contact points at three camera slopes and two terrain heights,
  including foreground occlusion and unchanged projected placement.
- An old color-only negative control, opaque body rejection of a background
  actor, foreground acceptance, and low-alpha openings/shadows without depth
  writes. These are depth-buffer contract assertions, not GPU pixels.
- Exact sharing of texture/geometry/transform, unchanged color alpha,
  non-picking, fog ownership, and stale/failed/disposed load behavior.
- The server's actual building limit populated with loaded sprite groups,
  one extra front-face pass per group and no extra image request. Raising
  that limit above 128 requires revisiting the documented budget.
- Existing construction/damage updates and source-file resolution for both
  teams, together with the focused unit-clock, fishing and wildlife checks.

After integration with main `3c2aabf`, candidate `4fa97aa` passed 65 focused
tests (including the separate captured-building lifecycle suite). Documentation
checking passed 457 Markdown files and 3,001 local links. A strict clean release
contained 1,049 files; its actual HTTP/import-closure scenario passed, including
startup guards, authentication, local Three and packaged asset hashes. All
20 source-frame hashes and alpha counts were independently rechecked.

The supported browser preflight in this environment previously returned
`sandbox-unavailable` and `storage-unavailable`, producing no WebGL frame.
The `game-dev` CLI is absent. No native screenshot, GPU timing, or user
appearance acceptance is claimed. Remaining native observation: move a Worker
behind and in front of complete and foundation Barracks/Range at zoom 0.91
and 0.48 on level and raised terrain; check thin frame edges/openings, soft
shadow contact, fog hide/reveal and selection. Compare the same crowded match
before making a GPU-time performance claim.
