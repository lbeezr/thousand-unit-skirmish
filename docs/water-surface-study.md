# Water surface study

[Renderer contract](renderer-state-contract.md) · [Shore fishing](shore-fishing-foundation.md) · [Runtime audit](art-runtime-audit-2026-10-03.md)

3 October 2026; audited main `d34c1a1`. The user finds current water visually
uninteresting and wants depth, motion and fish activity. This bounded opt-in
study changes presentation while unit/pathfinding work remains the priority.

## Existing renderer

`waterRaster` derives water from obstacle cells, not painted terrain textures.
`waterContours` preserves disconnected diagonal cells and dry islands; rounded
contours inset land edges conservatively. `buildWaterSurfaceGeometry` batches
these outlines and sand-aware shore skirts at water height 0.032. Its static
vertex color pattern gives modest variation, but no animated surface or modeled
bottom. Raised terrain does not create a bathymetric water volume. Actual routes
remain the obstacle/elevation contract.

PR #38 adds `resourceVariant: "shore-fish"` to finite food nodes. Their position
is a reachable, level-zero bank marker beside cardinally adjacent level-zero
water. Stock owns depletion; food cargo/drop-off rules are shared. The existing
primitive fish marker is placeholder art. PR #39's neutral Sheep/carcass renderer
is independent and remains unchanged.

## Primary-source findings and selected technique

Three's [Water documentation](https://threejs.org/docs/pages/Water.html) describes
a reflective surface; its [r180 implementation](https://github.com/mrdoob/three.js/blob/r180/examples/jsm/objects/Water.js)
allocates a render target and renders the scene from a mirror camera. That is
a useful larger water feature, with an extra scene pass that this study avoids.

Catlike Coding's [Looking Through Water](https://catlikecoding.com/unity/tutorials/flow/looking-through-water/)
uses background/surface depth differences for underwater fog and copies the
background for refraction. It also identifies foreground-edge artifacts and
depth/MSAA limitations. Our renderer has neither a modeled bottom nor this
screen/depth-copy path. Shore distance supplies an inexpensive **apparent-depth
cue**, without implying measured bathymetry or making bottom geometry visible.

Its [Directional Flow](https://catlikecoding.com/unity/tutorials/flow/directional-flow/)
explains aligning anisotropic patterns to flow. The study uses that principle
with original low-amplitude procedural bands and a fixed direction. It does not
copy tutorial shader code/assets or simulate currents. The suggested Alexander
Ameye page could not be accessed during this audit; no findings are attributed
to it.

## Preview and opt-in match surface

Run the ordinary local server and open `/water-study.html`. It compares the
current water with the study on identical inlet/island geometry, with controls
for logical time, animation, reduced motion, simple quality, fish-site visibility,
water-cell visibility and depletion. The gold bank ring and the water-school
position are separate. This is an isolated visual fixture, not a running match.

For a match, append `?waterStudy=1` to the existing URL (use `&` when it already
has parameters). `waterStudyTime=12` fixes the cosmetic frame; `waterStudyQuality=low`
uses the original static material and allocates no field texture or ripple mesh.
Without opt-in, the existing material remains active. Default adoption and
creative acceptance are separate outcomes.

The shader reuses the original contour buffers. A two-pass approximate distance
field needs one RGBA texel per map cell, one texture sample per surface fragment,
and no reflection, screen/depth copy or vertex displacement. Map boundaries do
not invent land shores; dry islands influence the field but retain their original
geometry holes. Existing shore colors survive the treatment. Actual performance
still requires a named rendered workload; this describes architecture, not a
measured frame-time saving.

Surface timing is a pure function of supplied seconds, the map seed and optional
fixed time. The match's cosmetic driver supplies monotonic local seconds; it is
not synchronized simulation time. Reduced motion uses time zero and suppresses
fish ripples. System preference changes update the opt-in material and the
listener is removed on material disposal. Ground picking keeps its existing
terrain mesh; study water and ripple meshes do not raycast.
Both study materials preserve the existing scene-distance fog with Three's
shared fog uniforms/chunks; this does not replace fog-of-war visibility.

## Fish visibility and resource boundary

`updateWaterStudyFish` accepts current resource nodes, visible bank-resource IDs
and visible water-cell indices. All are required. It draws at most 32 instanced
ripple envelopes, each within one existing water cell. Only a matching authored
shore-fish identity with live finite positive food stock qualifies. Authored
starting stock cannot create activity. Missing bank/water visibility, depletion,
invalid mixed wildlife identity or a raised/blocked approach removes the cue.
Stable resource IDs determine phase, independent of snapshot array order.

The opt-in match surface leaves fish instances empty: it has no authoritative
fog/stock adapter yet. The preview exercises the explicit adapter contract.
Existing bank markers, Sheep rendering, economy and resource orders are unchanged.
Connect actual filtered resource snapshots and both visibility inputs before
using these ripples in a match; decorative activity must not announce hidden
stocks or unrelated harvestable fish. Fish silhouettes and boats remain art work.

## Verification and limits

`node --test scripts/water-surface-study.test.mjs` checks field/geometry integrity,
opt-in/quality/time behavior, non-picking surfaces, live identity/stock, both fog
inputs, separate bank/water positions, depletion clearing and the instance limit.
The existing water scenarios cover 511 local footprints, 189,440 interior samples
and island topology. Shore-fish and neutral-wildlife regressions also pass.
The packed-release scenario checks all four study files over actual HTTP with
correct MIME and source hashes, and follows the served game import closure.

Normal Chromium preflight failed sandbox/storage startup in this cloud workspace.
No screenshot, GPU shader compilation, appearance acceptance or rendered
performance measurement is claimed. Inspect the preview in a supported browser
before selecting its palette, amplitude or default use. No browser security
changes, asset generation or paid provider jobs were used.
