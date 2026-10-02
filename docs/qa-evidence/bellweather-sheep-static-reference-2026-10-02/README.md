# Bellweather Sheep cloud static-reference capture

**2 October 2026:** producer's eight-view static model pilot, documented from
a complete readable 931-line capture manifest. The documentation worker verified
the manifest's yaw/clip sequence, canvas, root, bounds and render receipt. Its
contact-sheet download failed, so pixel/anatomy observations below are attributed
to the producer; they are not a new independent visual review here.

The [derived capture contract](capture-contract.json) preserves the bounded
technical results. Original GLB, saved scene, eight uncropped color frames,
diagnostic contact sheet, source manifest and rejected shadow experiments are
retained in the producer's Library bundle. Personal Library identities remain in
the private handoff. No large binary or private original is copied to Git by
this note. The source model's redistribution/runtime admission remains unverified.

## Working cloud capture default

For this static sprite-reference asset class, the completed pilot establishes a
working cloud baseline: Blender 4.3.2, Cycles CPU, four threads, 64 samples,
denoising disabled, AgX/None, transparent RGBA color with fixed world lights.
This Blender build lacks OpenImageDenoise; the successful path leaves denoising
off. Eight 512 × 512 views completed with exit code 0 in 22.20984254 seconds,
peak RSS 862,488 KiB (about 842 MiB). This is one asset/run, not a comparative
host/GPU benchmark or a guarantee for every model. The local render required
no paid provider calls or Meshy regeneration.

Camera and normalization follow the
[prepared reference contract](../../bellweather-sheep-model-reference-pilot.md):
world +Y up, fixed orthographic camera at azimuth 45° and elevation
45.4359024848°, bounds ±1, 256 projected pixels/world unit and root `(256,256)`.
The manifest records measured root error 0.00038147 px, within the proposed
0.5 px tolerance. All eight full-frame alpha bounds are inside the canvas and
marked unclipped. Rendered rotations are 0/45/90/135/180/225/270/315° with the
existing `north` through `north-west` clip sequence. None of these frames is an
admitted atlas or runtime animation.

The original is reported unchanged at 44,244,524 bytes, 750,919 vertices and
1,416,280 triangles, with one material and a 2048 × 2048 JPEG texture. Uniform
scale yields approximate shoulder height 0.60 world units and nose-to-rump
0.88494851, 1.67% below the trial 0.90 target; no per-axis stretch was applied.
Those mesh counts/hashes and anatomy landmarks are producer measurements,
not measurements from locally materialized model bytes in this slice.

## Nose heading and body-forward differ

The model's turned head creates a measured 42.03499985° face/body heading
difference. The pilot's yaw-zero alignment uses the nose/face. A nose-facing
label therefore does not establish a neutral locomotion direction. Preserve
the separate body-forward axis and gaze angle. Before walking, obtain a neutral
pose from this saved source or otherwise measure body heading explicitly;
do not relabel these static frames as an accepted eight-direction walk.

The producer reports four attached legs/cloven hooves visible in the underside
diagnostic, face/eyes/ears/fleece/short tail, and no unwanted floor mesh. Color is
paler than the input and fleece texture repeats most visibly underneath/on the
back. Hidden anatomy is generated rather than established by the single image.
The original input hash matches the
[preserved single-Sheep input](../../art-direction/bellweather-sheep-model-input-v1/README.md).

Reopening the saved scene produced pixel-identical repeat-render data in the
producer's receipt, although PNG file bytes differed. Its separate contact-shadow
experiment was rejected: opaque/raw output and full-canvas alpha noise. Keep
those diagnostics; do not promote them to a usable shadow layer. No rig, gait,
atlas integration, model/license admission or production acceptance follows
from the color rotation pilot.

Use this proven CPU path for the next bounded static-reference capture and
retain the scene/settings and metrics for each new asset. Reuse the saved model;
this evidence creates no authorization to regenerate, spend or auto-rig it.

[Angle standard](../../asset-angle-reference-standard.md) ·
[Sheep model pilot](../../bellweather-sheep-model-reference-pilot.md) ·
[Art evolution](../../lore/art-evolution.md)
