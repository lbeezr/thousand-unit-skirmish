# Water surface and fish cues

[Renderer contract](renderer-state-contract.md) · [Shore fishing](shore-fishing-foundation.md) · [Runtime audit](art-runtime-audit-2026-10-03.md)

3 October 2026; audited main `d34c1a1`. The user finds current water visually
uninteresting and wants depth, motion and fish activity. The initial opt-in
study became the default after Mac shader/appearance review and the user's
first-pass acceptance. Unit/pathfinding work remains the priority.

## Existing renderer

`waterRaster` derives water from obstacle cells, not painted terrain textures.
`waterContours` preserves disconnected diagonal cells and dry islands; rounded
contours inset land edges conservatively. `buildWaterSurfaceGeometry` batches
these outlines and sand-aware shore skirts at water height 0.032. Its static
vertex color pattern gives modest variation, but no animated surface or modeled
bottom. Raised terrain does not create a bathymetric water volume. Actual routes
remain the obstacle/elevation contract.

The [3 October low-bank shade](qa-shore-bank-shade-2026-10-03.md) adds a default
feathered land-side value cue on level-zero shores. It follows the same outline,
leaves this accepted surface unchanged, and adds one bounded static batch without
a texture or per-frame update. Its saved comparison is a Cycles CPU study;
native default match appearance and crowded GPU timing remain unobserved.

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

## Match surface and comparison fixture

Run the ordinary local server and open `/water-study.html`. It compares the
current water with the study on identical inlet/island geometry, with controls
for logical time, animation, reduced motion, simple quality, fish-site visibility,
water-cell visibility and depletion. The gold bank ring and the water-school
position are separate. This is an isolated visual fixture, not a running match.

Ordinary match URLs use the accepted surface and live fish cues by default;
the temporary `waterStudy` permission toggle is retired. `waterQuality=low`
selects the original static material and allocates no field texture or ripple
mesh/binding. System reduced motion freezes the surface and suppresses fish
ripples. These are accessibility/quality controls. `waterTime=12` fixes a cosmetic
frame for repeatable captures. Existing `waterStudyQuality` and `waterStudyTime`
links remain compatible; the shorter names take precedence when both are supplied.

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
fish ripples. System preference changes update the material and the
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

The match binds each accepted full server state packet through
`createWaterStudyFishBinding`. Wire resource rows supply ID/variant/stock;
the current map supplies land positions. The shared `shoreFishSitePositions`
contract from [PR #49](https://github.com/lbeezr/thousand-unit-skirmish/pull/49)
derives a fixed nearest adjacent water center, with lower cell index breaking
ties. Geometry is cached per map. Hiding that cell removes activity; it cannot
move the school to another visible neighbor.

For player fog snapshots, the adapter decodes that packet's packed two-bit
visibility and requires state 2 at both bank and water center. Explored state 1,
unseen state 0 and reserved state 3 do not qualify. A missing/malformed packet,
wrong map ID, missing resource list or contradictory fog setting clears activity.
It never reads the UI's remembered stocks or a previous decoded fog grid.
The binding runs before the existing fog overlay parser, so that parser's
malformed-base64 exception cannot preserve prior fish activity.
Only an explicit no-fog snapshot or the current spectator seat's unrestricted
server snapshot with `visibility: null` qualifies without cell visibility.
Disconnect/map rebuild clears instances before fresh recovery/rematch state.
Existing bank markers, Sheep rendering, economy and resource orders remain shared.

Default integration retains the same reduced-motion, low-quality,
32-instance and one-cell-envelope limits. The restrained existing surface ring
signals an active food site; its count does not quantify stock. The art lane's
reported 1.8–2.6-pixel strategic fish silhouette length motivates evaluating the
ring alongside future silhouettes. That observation is attributed to the art
lane; this cloud adapter work does not establish pixel readability. No palette,
contrast, amplitude or shader appearance was redesigned for default integration.
Fish silhouettes and boats remain art work.

## Production source homes — 7 October 2026

The default match renderer lives in `src/presentation/rendering/water/`:

| Implementation | Canonical module |
| --- | --- |
| Surface materials, field texture and fish ripples | [surface.mjs](../src/presentation/rendering/water/surface.mjs) |
| Cosmetic shore field, disclosed fish selection and time policy | [state.mjs](../src/presentation/rendering/water/state.mjs) |
| Accepted live snapshot and fog binding | [fish-binding.mjs](../src/presentation/rendering/water/fish-binding.mjs) |
| Shared contour buffers and water level | [geometry.mjs](../src/presentation/rendering/water/geometry.mjs) |

Ground surfaces, Main, environment construction and fishing-contact presentation
consume these canonical modules. The separate `/water-study.html` comparison
still uses `src/water-study-preview.mjs`; only its shared production dependencies
move. Existing exported bindings, `waterStudy` object fields and quality/time
query compatibility are retained. All tracked module/URL consumers move together;
the four former root implementation paths retire without forwarding stubs.

Shader, material, geometry, disclosure and disposal bodies are preserved except
for import paths. Source equality, packed HTTP admission, deployed identity and
actual rendered output remain separate evidence; this migration does not claim
new appearance acceptance.

## Verification and limits

`node --test scripts/water-surface-study.test.mjs` checks field/geometry integrity,
default/quality/time behavior, non-picking surfaces, live identity/stock, both fog
inputs, separate bank/water positions, depletion clearing and the instance limit.
The existing water scenarios cover 511 local footprints, 189,440 interior samples
and island topology. Shore-fish and neutral-wildlife regressions also pass.
The packed-release scenario checks all five study files over actual HTTP with
correct MIME and source hashes, and follows the served game import closure.

`scripts/water-study-fish-binding.test.mjs` exercises real packed fog bytes,
fractional live stock, fixed nearest/tied water positions, malformed/omitted
inputs, spectator transitions, map rebinding, recovery, caps and render gates.
The existing socket lifecycle tests cover current/stale disconnects and accepted
state delivery. `scripts/shore-fishing-authoring-scenario.mjs` checks both seats'
actual filtered wire packets during gather, depletion, checkpoint recovery and
rematch, alongside the existing 120-food/200-wood conservation proof.

For native match review, select **Lab · SHORE FISHING** with an ordinary URL or
`waterTime=12` for a fixed frame. Reveal a bank from land, gather its stock, then compare
active/depleted and bank/water fog states at ordinary and strategic zoom. Also
check reduced motion and `waterQuality=low`. The standalone comparison
recipe remains `/water-study.html`, 1280×720/DPR 1, Standard, time 12 then 16,
animation off, both visibility toggles on, depletion off; then toggle each
visibility/depletion/reduced-motion case. The fixture remains a regression tool.

Normal Chromium preflight failed sandbox/storage startup in this cloud workspace.
The [Mac QA record](qa-water-surface-native-2026-10-03.md) subsequently verified
compiled/linked surface and ripple programs, comparison controls and an actual
match pond at `b96557f`; the user accepted the visual direction as a first pass.
Those shader bodies are unchanged. This cloud lane read the QA provenance,
but Library returned extracted text for the PNGs, so no independent cloud pixel
inspection is claimed. The later live fish binding has current-packet and real
two-seat server proofs; its ordinary/strategic native cue recognition remains
an incremental visual check. The Mac draw-rate smoke is not an overhead benchmark.
No browser security changes, asset generation or paid provider jobs were used.
