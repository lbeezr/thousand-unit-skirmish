# Generated sprite-strip adoption contract

[Atlas format](sprite-atlas-contract-v1.md) · [Character pipeline](unit-character-meshy-pipeline.md) · [Production lanes](art-production-lanes.md)

Adoption decision, 3 October 2026. The native review of Game Studio
`game-studio:sprite-pipeline` 0.1.2 supplied the workflow and bundled-helper
findings below. The review read the official bundle; no bundled scripts were
executed or installed. The fishing worker owns its strip adapter, generation,
assets and tests. This contract adds no second adapter or provider job.

## Adopt the workflow; register frames explicitly

Use an approved seed, generate an action as a whole strip, and inspect the
complete sequence before expanding the action/facing set. Preserve actor scale,
ground contact, appearance and equipment through one declared calibration.

Every import supplies source image dimensions, explicit half-open slot rectangles,
authoritative projected ground anchors in slot-local coordinates, one calibrated
uniform scale across the action/facing set, one destination ground anchor and
logical canvas, explicit direction order, frame durations and loop policy.
Missing anchors require review; alpha bounds cannot supply them.

For each source pixel in its slot-local coordinate system, use:

```text
destinationPixel = destinationGroundAnchor
                 + scale * (sourcePixel - sourceGroundAnchor)
```

Apply that same geometric transform to color and its unit R-channel ownership
mask. Preserve linear scalar mask data. Cropping is optional storage optimization:
retain the logical canvas and its pivot, and record each crop's canvas-local
`offsetPx`. Do not recenter or bottom-align a frame after cropping.

Grow the shared canvas/margins to contain a wide net, a net below the feet,
raised tools and all poses. A low ground pivot is a contact coordinate, not the
bottom of visible alpha. A crouch has a shorter visible body at the same scale;
do not stretch it to standing height or shrink the actor to fit equipment.
Validate clipping on final decoded pixels, including thin/faint equipment edges.

## Preserve calibration through the current runtime

The [unit loader](../src/unit-sprite-runtime.mjs) currently derives
`worldPerPixel = asset.heightWorld / maxFrameAlphaHeight`. Preserve the approved
ratio across imported actions/facings. Keeping a fixed numerical `heightWorld`
while net bounds increase `maxFrameAlphaHeight` shrinks the actor; a crouching-only
pack can cause the opposite error. For a source-to-destination pixel scale `s`,
the corresponding destination world-per-pixel is source world-per-pixel divided
by `s`. Export metadata must retain that calibration, or the consuming integration
must use the explicit calibrated value. Keep anatomical size, art bounds,
selection bounds and gameplay occupancy distinct.

For the calibrated 3D pipeline, preserve root/camera transforms, projected anchor
and capture density directly. Do not apply silhouette-derived scale corrections
after rendering. Record model yaw, clip and sample time for unit captures;
camera-orbit building records use their separate direction convention.

## Lock the correct loop seed and both image channels

Distinguish an appearance reference from the first pose of a loop. A standing
idle image locked as frame one of a kneeling fishing loop causes a stand-up on
every repetition. Use the approved kneeling loop-start pose, or keep a deliberate
non-looping entry transition outside that loop when its consuming path exists.

Lock both the working seed's decoded color RGBA and its ownership-mask samples,
dimensions and anchor. Preserve original source-file hashes as provenance.
Repacking/re-encoding can change a PNG's byte hash while preserving its pixels.
If shared resampling is required, establish the working seed with that declared
transform once, then verify exact identity at the declared lock stage after
reconstructing any crop offsets. Do not silently lock color while replacing or
regenerating its mask.

## Guard the reviewed helper boundaries

| Reviewed behavior in Game Studio 0.1.2 | Project adoption rule |
| --- | --- |
| Canvas helper centers the slot band; normalizer slices the full width | Require `canvasWidth == frameCount * slotWidth`, or extract explicit slot rectangles with the real band offset. Do not infer equal full-width slices for a centered, padded band. |
| Normalizer crops alpha above 8, recenters and bottom-aligns | Replace those placement/scale decisions with the anchored transform. Alpha measurements are diagnostic bounds, not pivot or anatomical-scale authority. |
| Preview helper natural-sorts all PNGs and supplies static inspection | Pass explicit files or use a clean directory. Keep masks, seeds, pages and contact sheets out of frame enumeration. Use actual timed-loop playback and in-engine review. |

The existing [project preview](../scripts/preview-sprite-atlas.mjs) plays canonical
clip sequences using their declared durations and loop flag. Use it with
[validation](../scripts/validate-sprite-atlas.mjs) and
[handoff reporting](../scripts/report-sprite-atlas-handoff.mjs), then inspect
ground contact, both teams and ordinary/strategic game zoom in the consuming path.
Contact sheets alone do not establish motion quality.

Unit ownership masks use linear gray8 **R** coverage. Captured-building masks use
**alpha** with their Canvas consumer; keep their exporter and mask-only dithering
control separate. Check semantic neutral skin/net/tool pixels stay untinted.
Do not use a global hue selector as ownership authority.

## Fishing-adapter acceptance checks

These are required implementation checks, not results claimed by this document:

- Wide net extension expands bounds without changing actor scale or root.
- A net below the feet retains the same ground anchor and sufficient lower margin.
- A crouch reduces body height without rescaling head/body proportions.
- Empty color slots, malformed rectangles, ambiguous slot overlap and clipping
  fail with an explicit diagnosis. A mask can be empty when its cue is occluded.
- All eight declared directions retain the same calibration and correct mapping.
- Locked seed color and mask both match; loop-start pose and loop seam agree.
- Explicit frame durations survive import and timed playback.
- Neutral skin/net remain untinted; owner accents respond to both team colors.
- Transparent margins survive packing/cropping and final decoding without clipping.
- Runtime world-per-pixel remains calibrated when equipment changes alpha bounds.

Record inputs, rectangles, anchors, shared scale, timing, seed identities and
results in the adapter's authoring receipt and the existing canonical manifest
fields. Keep unsupported receipt fields in a sidecar instead of extending the
canonical schema implicitly. Further reusable validation can consume that
artifact; generation and adapter implementation remain in the fishing lane.
