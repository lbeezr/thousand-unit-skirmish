# Fixed-camera resource views with measured mesh fit

Captured 1 October 2026 UTC from the same untouched source GLBs as v2. All
24 views retain the exact game camera, fixed lighting, ground anchor (320,480),
640×640 frame, and one common scale per family across eight model headings.

V2 fitted projected corners of each rotated axis-aligned box. Those fictitious
corners exceeded the actual silhouette and shrank the oak and berry bush.
V3 projects every mesh vertex, transformed into world space at each heading,
then fits their union. Oak fitScale rises from 0.687358 to 1, normalized height
1.87248 to 2.72417 world units. Berry fit rises from 0.665418 to 1. Pine remains
frame-limited at 0.819341, height 5.08549. No per-heading rescale is applied.

Each manifest retains source hashes, provider task IDs, camera convention,
fit method and model measurements. Existing ignored source GLBs are under
`meshy_output/organic-perspective-pilot/`. No provider jobs were requested.
Reproduce with `scripts/render-resource-sprite-pack.py --capture-mode model-rotation`
and the manifest model path, normalization width and task IDs, using a fresh
output directory. V2 source captures remain intact for comparison.

`python3 scripts/validate-fixed-camera-resources.py` checks the v3 pack by default:
24 distinct nonempty unclipped frames, exact RGBA atlas and lossless WebP,
source hashes when locally present, direction metadata and shared anchor.
An optional positional pack path audits v2 or another capture pack.
